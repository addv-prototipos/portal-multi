// Compra de un upscale de almacenamiento por un tenant (propuesta B5,
// "simulador de fecha"): regla de 20 días confirmada por el usuario —
// si faltan MÁS de 20 días para el corte (suscripcion_expira_en), se
// cobra HOY vía Stripe Checkout (mismo "cobrar primero, activar
// después" que onboarding, ver stripePagos.js); si faltan 20 días o
// menos, se aplica de inmediato SIN cobrar — el monto ya queda sumado a
// tenants.disco_upscale_monto y se cobra junto con el plan en el
// siguiente corte (decisión del usuario: no hay todavía un cobro
// recurrente automático real — ver tenantSuscripcion.js — así que ese
// cobro del corte lo termina de procesar un operador en /control,
// mismo criterio manual que el estatus de cobro hoy).
//
// El upscale es RECURRENTE (decisión del usuario, lectura literal de su
// mensaje): disco_cuota_mb y disco_upscale_mb suben de forma
// PERMANENTE, y disco_upscale_monto se suma para siempre a la
// mensualidad/anualidad del tenant — no es una compra de una sola vez
// que solo amplía espacio sin tocar el precio recurrente.
//
// Solo existe UNA funcionalidad "compra-ble" de disco a la vez: la
// primera fila activa de funcionalidades_upscale con disco_mb no nulo
// (el operador la crea desde /control → Upscale y Stripe, mismo
// catálogo genérico ya existente — ningún código nuevo hace falta ahí).

const { obtenerPool } = require('../db');
const { notificarInvalidacionCache } = require('./notificarBackend');
const { getDiscoTopeTenantMb } = require('./ajustesGlobales');

const DIAS_UMBRAL_COBRO_INMEDIATO = 20;
const ZONA_NEGOCIO_CONTROL = 'America/Mexico_City';

class ErrorUpscaleCompra extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorUpscaleCompra';
    this.codigo = codigo; // 'no_encontrado' | 'validacion' | 'sin_catalogo'
  }
}

function hoyYYYYMMDD() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO_CONTROL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const obj = {};
  for (const parte of partes) obj[parte.type] = parte.value;
  return `${obj.year}-${obj.month}-${obj.day}`;
}

function diasEntre(fechaInicioYYYYMMDD, fechaFinYYYYMMDD) {
  const [a1, m1, d1] = fechaInicioYYYYMMDD.split('-').map(Number);
  const [a2, m2, d2] = fechaFinYYYYMMDD.split('-').map(Number);
  const inicio = Date.UTC(a1, m1 - 1, d1);
  const fin = Date.UTC(a2, m2 - 1, d2);
  return Math.round((fin - inicio) / 86400000);
}

async function obtenerFuncionalidadDiscoDisponible(db) {
  const [filas] = await db.query(
    `SELECT * FROM funcionalidades_upscale
      WHERE activo = 1 AND disco_mb IS NOT NULL
      ORDER BY orden, id LIMIT 1`
  );
  return filas[0] || null;
}

async function cargarTenantPorSlug(slug, db) {
  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  return filas[0] || null;
}

function validarTenantYFuncionalidad(tenant, funcionalidad) {
  if (!tenant || tenant.estado === 'baja') {
    throw new ErrorUpscaleCompra('Empresa no encontrada.', 'no_encontrado');
  }
  if (tenant.disco_cuota_mb == null) {
    throw new ErrorUpscaleCompra('Tu plan ya tiene almacenamiento ilimitado — no necesitas comprar espacio adicional.', 'validacion');
  }
  if (!funcionalidad) {
    throw new ErrorUpscaleCompra('La compra de espacio adicional no está disponible todavía.', 'sin_catalogo');
  }
}

function calcularResumenCompra(tenant, funcionalidad, cantidad) {
  const ciclo = tenant.suscripcion_ciclo === 'anual' ? 'anual' : 'mensual';
  const precioUnitario = ciclo === 'anual'
    ? (funcionalidad.precio_anual ?? funcionalidad.precio_mensual)
    : (funcionalidad.precio_mensual ?? funcionalidad.precio_anual);
  if (precioUnitario == null) {
    throw new ErrorUpscaleCompra('Esta funcionalidad todavía no tiene un precio configurado.', 'sin_catalogo');
  }

  const expiraEn = tenant.suscripcion_expira_en ? String(tenant.suscripcion_expira_en).slice(0, 10) : null;
  const diasRestantes = expiraEn ? diasEntre(hoyYYYYMMDD(), expiraEn) : null;
  const cobroInmediato = diasRestantes === null ? true : diasRestantes > DIAS_UMBRAL_COBRO_INMEDIATO;

  return {
    funcionalidadId: funcionalidad.id,
    funcionalidadNombre: funcionalidad.nombre,
    cantidad,
    mbOtorgado: Number(funcionalidad.disco_mb) * cantidad,
    monto: Number(precioUnitario) * cantidad,
    ciclo,
    diasRestantes,
    cobroInmediato,
    fechaCorte: expiraEn,
  };
}

// Tope máximo de disco POR TENANT, indistinto del plan (punto en curso,
// 2026-10-27, mismo candado que tenantEdicion.js:resolverPlanYFunciones)
// — un upscale que llevaría la cuota de esta empresa por encima del tope
// se rechaza con error claro, nunca se recorta en silencio. Se valida
// ANTES de tocar Stripe (nunca cobrar algo que de todas formas se va a
// rechazar).
async function validarTopeTenant(tenant, resumen) {
  const topeTenantMb = await getDiscoTopeTenantMb();
  if (topeTenantMb == null) return;
  const cuotaResultante = Number(tenant.disco_cuota_mb) + resumen.mbOtorgado;
  if (cuotaResultante > topeTenantMb) {
    throw new ErrorUpscaleCompra(
      `Esta compra llevaría la cuota de esta empresa a ${cuotaResultante.toLocaleString('es-MX')} MB, por encima del tope máximo por empresa (${topeTenantMb.toLocaleString('es-MX')} MB) — contacta a soporte si necesitas más de ese límite.`,
      'validacion'
    );
  }
}

async function simularCompraUpscale(slug, cantidad = 1, db = obtenerPool()) {
  const [tenant, funcionalidad] = await Promise.all([
    cargarTenantPorSlug(slug, db),
    obtenerFuncionalidadDiscoDisponible(db),
  ]);
  validarTenantYFuncionalidad(tenant, funcionalidad);
  const resumen = calcularResumenCompra(tenant, funcionalidad, cantidad);
  await validarTopeTenant(tenant, resumen);
  return resumen;
}

// Aplica el upscale YA (cuota de disco sube de inmediato en los 2
// caminos) — la diferencia entre 'cobrado_hoy' y 'pendiente_corte' es
// SOLO si el primer cargo se cobró ya vía Stripe o se dejó pendiente
// para el siguiente corte manual. db recibido ya debe estar dentro de
// una conexión (no un pool) cuando se llama desde dentro de una
// transacción — aquí siempre se usa el pool porque no hay nada más que
// coordinar atómicamente en el mismo request.
async function aplicarUpscale(tenant, funcionalidad, resumen, { estado, stripeCheckoutSessionId = null }, db) {
  const ahora = new Date();
  await db.query(
    `UPDATE tenants
        SET disco_cuota_mb = disco_cuota_mb + ?,
            disco_upscale_mb = disco_upscale_mb + ?,
            disco_upscale_monto = disco_upscale_monto + ?
      WHERE id = ?`,
    [resumen.mbOtorgado, resumen.mbOtorgado, resumen.monto, tenant.id]
  );
  await db.query(
    `INSERT INTO tenant_upscales_activos
       (tenant_id, funcionalidad_id, cantidad, disco_mb_otorgado, monto_recurrente, ciclo, primer_cobro_estado, stripe_checkout_session_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenant.id, funcionalidad.id, resumen.cantidad, resumen.mbOtorgado, resumen.monto, resumen.ciclo, estado, stripeCheckoutSessionId, ahora, ahora]
  );
  notificarInvalidacionCache(tenant.slug).catch((err) => {
    console.error(`No se pudo invalidar la caché del backend tras el upscale de "${tenant.slug}":`, err.message);
  });
}

// Confirma la compra: si faltan más de 20 días para el corte, crea un
// Stripe Checkout Session y regresa la URL (nada se aplica todavía —
// ver confirmarUpscalePagado(), que corre desde el webhook cuando
// Stripe avisa que el dinero ya llegó). Si faltan 20 días o menos, se
// aplica de inmediato sin tocar Stripe.
async function confirmarCompraUpscale(slug, cantidad = 1, { successUrl, cancelUrl }, db = obtenerPool()) {
  const [tenant, funcionalidad] = await Promise.all([
    cargarTenantPorSlug(slug, db),
    obtenerFuncionalidadDiscoDisponible(db),
  ]);
  validarTenantYFuncionalidad(tenant, funcionalidad);
  const resumen = calcularResumenCompra(tenant, funcionalidad, cantidad);
  await validarTopeTenant(tenant, resumen);

  if (!resumen.cobroInmediato) {
    await aplicarUpscale(tenant, funcionalidad, resumen, { estado: 'pendiente_corte' }, db);
    return { ok: true, cobroInmediato: false, resumen };
  }

  // Lazy require: mismo motivo que enrutarPagoConfirmado en
  // stripePagos.js (evita el ciclo de dependencias entre los dos
  // archivos — cada uno necesita algo del otro solo en tiempo de
  // ejecución, nunca al cargar el módulo).
  const { obtenerStripe, montoCentavos } = require('./stripePagos');
  const stripe = obtenerStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'mxn',
          unit_amount: montoCentavos(resumen.monto),
          product_data: { name: `Clarvo — ${funcionalidad.nombre} (${resumen.cantidad}×)` },
        },
        quantity: 1,
      },
    ],
    metadata: {
      tipo: 'upscale',
      tenant_slug: slug,
      funcionalidad_id: String(funcionalidad.id),
      cantidad: String(resumen.cantidad),
      mb_otorgado: String(resumen.mbOtorgado),
      monto: String(resumen.monto),
      ciclo: resumen.ciclo,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { ok: true, cobroInmediato: true, checkoutUrl: session.url, resumen };
}

// Llamado desde el webhook de Stripe (ver stripePagos.js) cuando el pago
// de un upscale ya se confirmó — aplica los cambios reales (antes de
// esto, nada en la BD refleja la compra: mismo "cobrar primero, activar
// después" que onboarding).
async function confirmarUpscalePagado(session, db = obtenerPool()) {
  const meta = session.metadata || {};
  const slug = meta.tenant_slug;
  if (!slug) {
    console.error('checkout.session de upscale sin metadata.tenant_slug — no se puede aplicar.', session.id);
    return;
  }
  const tenant = await cargarTenantPorSlug(slug, db);
  if (!tenant) {
    console.error(`checkout.session de upscale para un tenant que ya no existe ("${slug}").`, session.id);
    return;
  }
  const funcionalidadId = Number(meta.funcionalidad_id);
  const [filasFuncionalidad] = await db.query('SELECT * FROM funcionalidades_upscale WHERE id = ?', [funcionalidadId]);
  const funcionalidad = filasFuncionalidad[0];
  if (!funcionalidad) {
    console.error(`checkout.session de upscale con funcionalidad_id "${funcionalidadId}" que ya no existe.`, session.id);
    return;
  }

  const resumen = {
    mbOtorgado: Number(meta.mb_otorgado),
    monto: Number(meta.monto),
    cantidad: Number(meta.cantidad) || 1,
    ciclo: meta.ciclo === 'anual' ? 'anual' : 'mensual',
  };
  await aplicarUpscale(tenant, funcionalidad, resumen, { estado: 'cobrado_hoy', stripeCheckoutSessionId: session.id }, db);
  console.log(`Upscale aplicado tras pago confirmado: tenant "${slug}", +${resumen.mbOtorgado} MB.`);
}

module.exports = {
  ErrorUpscaleCompra,
  DIAS_UMBRAL_COBRO_INMEDIATO,
  obtenerFuncionalidadDiscoDisponible,
  simularCompraUpscale,
  confirmarCompraUpscale,
  confirmarUpscalePagado,
};
