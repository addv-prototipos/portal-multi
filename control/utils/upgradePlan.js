// Subir de plan desde la misma ventana de upscale (propuesta D1,
// aprobada junto con la Sección D de la propuesta visual) — dos
// entradas reales ya existentes, no se construyen de cero:
//   - Desde /control: el modal "Editar empresa" YA permite reasignar el
//     plan de un tenant (PUT /api/control/tenants/:slug) — esto NO
//     duplica eso, solo lo complementa con el camino self-service desde
//     Mi Cuenta.
//   - Desde Mi Cuenta (self-service, admin raíz): este archivo. Sube el
//     PRECIO real de la Subscription de Stripe (swap del Subscription
//     Item del plan, con proración cobrada de inmediato — mismo patrón
//     ya usado para upscale) y actualiza `tenants.plan_id` para que el
//     resto del sistema (requiereFeature, límites de max_usuarios/disco,
//     etc.) vea el plan nuevo de inmediato.
//
// "Siguiente plan" se decide por `planes.orden` (columna ya existente en
// el catálogo) — nunca un nombre hardcodeado.

const { obtenerPool } = require('../db');

class ErrorUpgradePlan extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorUpgradePlan';
    this.codigo = codigo; // 'no_encontrado' | 'sin_suscripcion' | 'validacion'
  }
}

async function cargarTenantPorSlug(slug, db) {
  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  return filas[0] || null;
}

async function cargarPlanPorId(id, db) {
  const [filas] = await db.query('SELECT * FROM planes WHERE id = ? AND activo = 1 AND eliminado_en IS NULL', [id]);
  return filas[0] || null;
}

// Lista las opciones "hacia arriba" (orden mayor al plan actual) — la
// primera (orden más bajo entre las disponibles) se marca recomendada.
// Si el tenant no tiene plan asignado, se listan TODOS los planes
// activos (no hay "actual" con qué comparar).
async function listarOpcionesSubirPlan(slug, db = obtenerPool()) {
  const tenant = await cargarTenantPorSlug(slug, db);
  if (!tenant || tenant.estado === 'baja') {
    throw new ErrorUpgradePlan('Empresa no encontrada.', 'no_encontrado');
  }

  let planActual = null;
  if (tenant.plan_id) {
    planActual = await cargarPlanPorId(tenant.plan_id, db);
  }

  const [filas] = await db.query(
    `SELECT id, nombre, precio_mensual, precio_anual, orden FROM planes
      WHERE activo = 1 AND eliminado_en IS NULL ${planActual ? 'AND orden > ?' : ''}
      ORDER BY orden ASC`,
    planActual ? [planActual.orden] : []
  );

  return {
    planActualId: planActual ? planActual.id : null,
    planActualNombre: planActual ? planActual.nombre : null,
    ciclo: tenant.suscripcion_ciclo === 'anual' ? 'anual' : 'mensual',
    opciones: filas.map((f, i) => ({
      id: f.id,
      nombre: f.nombre,
      precioMensual: f.precio_mensual == null ? null : Number(f.precio_mensual),
      precioAnual: f.precio_anual == null ? null : Number(f.precio_anual),
      recomendado: i === 0,
    })),
  };
}

// Busca, entre los Subscription Items reales, el que corresponde al
// PLAN (no a un upscale) — cualquier item cuyo id NO esté en
// tenant_upscales_activos.stripe_subscription_item_id para este tenant.
async function buscarItemDePlan(stripe, tenant, db) {
  const [filasUpscale] = await db.query(
    `SELECT stripe_subscription_item_id FROM tenant_upscales_activos WHERE tenant_id = ? AND activo = 1 AND stripe_subscription_item_id IS NOT NULL`,
    [tenant.id]
  );
  const idsUpscale = new Set(filasUpscale.map((f) => f.stripe_subscription_item_id));
  const items = await stripe.subscriptionItems.list({ subscription: tenant.stripe_subscription_id, limit: 100 });
  const itemPlan = items.data.find((item) => !idsUpscale.has(item.id));
  if (!itemPlan) {
    throw new ErrorUpgradePlan('No se encontró el renglón del plan en tu suscripción de Stripe — contacta a soporte.', 'validacion');
  }
  return itemPlan;
}

const CLAVE_PRODUCTO_PLAN_STRIPE = 'stripe_product_id_plan';

// Un solo Product de Stripe, reusado para TODOS los cambios de plan de
// TODOS los tenants (el contenedor no necesita variar por plan — el
// precio sí, y ese siempre es ad-hoc) — mismo motivo que
// tenantUpscaleCompra.js:obtenerOCrearProductoStripe, cacheado en
// `ajustes_globales` (tabla clave/valor de plataforma, ya existente)
// en vez de en el catálogo de planes porque es UN solo valor compartido,
// no uno por plan.
async function obtenerOCrearProductoPlanStripe(stripe, db) {
  const [filas] = await db.query('SELECT valor FROM ajustes_globales WHERE clave = ?', [CLAVE_PRODUCTO_PLAN_STRIPE]);
  if (filas.length > 0 && filas[0].valor) return filas[0].valor;
  const producto = await stripe.products.create({ name: 'Clarvo — Plan de suscripción' });
  await db.query(
    `INSERT INTO ajustes_globales (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_PRODUCTO_PLAN_STRIPE, producto.id]
  );
  return producto.id;
}

async function confirmarSubirPlan(slug, nuevoPlanId, { actor } = {}, db = obtenerPool()) {
  const tenant = await cargarTenantPorSlug(slug, db);
  if (!tenant || tenant.estado === 'baja') {
    throw new ErrorUpgradePlan('Empresa no encontrada.', 'no_encontrado');
  }
  if (!tenant.stripe_subscription_id) {
    throw new ErrorUpgradePlan('Esta empresa no tiene una suscripción real de Stripe — contacta a soporte.', 'sin_suscripcion');
  }
  const nuevoPlan = await cargarPlanPorId(Number(nuevoPlanId), db);
  if (!nuevoPlan) {
    throw new ErrorUpgradePlan('El plan elegido no existe o ya no está disponible.', 'validacion');
  }

  const ciclo = tenant.suscripcion_ciclo === 'anual' ? 'anual' : 'mensual';
  const precioNuevo = ciclo === 'anual' ? (nuevoPlan.precio_anual ?? nuevoPlan.precio_mensual) : (nuevoPlan.precio_mensual ?? nuevoPlan.precio_anual);
  if (precioNuevo == null) {
    throw new ErrorUpgradePlan('El plan elegido todavía no tiene un precio configurado.', 'validacion');
  }

  // Pre-flight ANTES de tocar Stripe (bug real encontrado validando en
  // vivo, punto en curso): tenantEdicion.js:actualizarDatosTenant corre
  // SU PROPIO candado de tope de disco y puede rechazar el cambio —
  // si eso pasara DESPUÉS de cobrar la proración, el tenant pagaría por
  // un cambio de plan que nunca se aplicó. Mismo cálculo que esa función
  // (base del plan nuevo + upscale de disco ya comprado), para fallar
  // ANTES de cobrar, nunca después.
  const { getDiscoTopeTenantMb } = require('./ajustesGlobales');
  const topeTenantMb = await getDiscoTopeTenantMb();
  if (topeTenantMb != null && nuevoPlan.disco_cuota_mb != null) {
    const cuotaResultante = Number(nuevoPlan.disco_cuota_mb) + Number(tenant.disco_upscale_mb || 0);
    if (cuotaResultante > topeTenantMb) {
      throw new ErrorUpgradePlan(
        `Este plan llevaría tu cuota de disco a ${cuotaResultante.toLocaleString('es-MX')} MB, por encima del tope máximo por empresa (${topeTenantMb.toLocaleString('es-MX')} MB) — contacta a soporte si necesitas más de ese límite.`,
        'validacion'
      );
    }
  }

  const { obtenerStripe, montoCentavos } = require('./stripePagos');
  const stripe = obtenerStripe();
  const itemPlan = await buscarItemDePlan(stripe, tenant, db);
  const productId = await obtenerOCrearProductoPlanStripe(stripe, db);
  const intervaloStripe = ciclo === 'anual' ? 'year' : 'month';

  await stripe.subscriptionItems.update(itemPlan.id, {
    price_data: {
      currency: 'mxn',
      unit_amount: montoCentavos(precioNuevo),
      recurring: { interval: intervaloStripe },
      product: productId,
    },
    proration_behavior: 'create_prorations',
  });

  // Factura la proración YA — mismo criterio que el upscale (punto en
  // curso): nunca dejarla pendiente al siguiente corte.
  const factura = await stripe.invoices.create({ customer: tenant.stripe_customer_id, subscription: tenant.stripe_subscription_id, auto_advance: false });
  const finalizada = await stripe.invoices.finalizeInvoice(factura.id);
  if (finalizada.status !== 'paid') {
    await stripe.invoices.pay(factura.id);
  }

  // tenantEdicion.js:actualizarDatosTenant ya es la única vía para
  // reasignar plan_id (mismo helper que usa /control) — reusar en vez de
  // un UPDATE directo mantiene las reglas de dependencia/validación de
  // ese módulo funcionando igual aquí. OJO (bug real encontrado
  // validando en vivo, punto en curso): esa función fija
  // disco_cuota_mb/max_usuarios al valor BASE del plan nuevo — pisa
  // cualquier upscale que el tenant ya hubiera comprado y pagado por
  // separado (tenant.disco_upscale_mb/usuarios_upscale, columnas que
  // existían ANTES de este cambio de plan). Se re-aplica después,
  // exclusivo a este flujo — no se tocó actualizarDatosTenant() porque
  // también lo usa /control y un cambio ahí tiene alcance más amplio.
  const { actualizarDatosTenant } = require('./tenantEdicion');
  await actualizarDatosTenant(
    slug,
    { nombreEmpresa: tenant.nombre_empresa, contactoEmail: tenant.contacto_email, planId: nuevoPlan.id },
    { actor, db }
  );
  if (tenant.disco_upscale_mb || tenant.usuarios_upscale) {
    await db.query(
      `UPDATE tenants
          SET disco_cuota_mb = disco_cuota_mb + ?,
              max_usuarios = CASE WHEN max_usuarios IS NULL THEN NULL ELSE max_usuarios + ? END
        WHERE id = ?`,
      [tenant.disco_upscale_mb || 0, tenant.usuarios_upscale || 0, tenant.id]
    );
  }

  return { ok: true, planNombre: nuevoPlan.nombre, monto: precioNuevo, ciclo };
}

module.exports = {
  ErrorUpgradePlan,
  listarOpcionesSubirPlan,
  confirmarSubirPlan,
};
