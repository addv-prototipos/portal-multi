// Compra de un upscale (disco o usuarios — catálogo genérico
// `funcionalidades_upscale`) por un tenant. Generaliza la propuesta B5
// original (solo disco) a un segundo recurso real (punto en curso,
// decisión explícita del usuario: "igual con los upscale se suman a su
// pago mensual").
//
// Cambio de fondo respecto a la versión anterior de este archivo: el
// upscale RECURRENTE ya NO se cobra con un Stripe Checkout de una sola
// vez — se agrega como un Subscription Item real a la MISMA Subscription
// del tenant (stripe.subscriptionItems.create) y se factura de inmediato
// con una proración (el tenant YA tiene un método de pago guardado en
// Stripe desde que pagó su plan, así que no hace falta un Checkout
// nuevo ni redirigir a nada). A partir de aquí, Stripe cobra ese upscale
// junto con el plan en CADA corte futuro sin que nadie tenga que hacer
// nada manual — la fila en tenant_upscales_activos guarda el
// stripe_subscription_item_id para poder tocarlo después (subir
// cantidad, o quitarlo si algún día se permite reducir el upscale).
//
// Los upscale con tipo_cobro='unico' (si el catálogo llega a tener uno)
// siguen el Checkout de una sola vez de siempre — ver
// confirmarCompraUpscale() más abajo, rama 'unico'.
//
// Solo existe UNA funcionalidad "comprable" por tipo de recurso a la
// vez: la primera fila activa de funcionalidades_upscale con la columna
// de ese recurso no nula (el operador la crea desde /control → Upscale y
// Stripe, catálogo genérico ya existente).

const { obtenerPool } = require('../db');
const { notificarInvalidacionCache } = require('./notificarBackend');
const { getDiscoTopeTenantMb } = require('./ajustesGlobales');

const DIAS_UMBRAL_COBRO_INMEDIATO = 20;
const ZONA_NEGOCIO_CONTROL = 'America/Mexico_City';

// Un solo lugar que sabe, por tipo de recurso, qué columna del catálogo
// leer, qué columna de tenants actualizar y cómo se llama para el
// nombre del producto en Stripe — agregar un tercer recurso en el futuro
// es sumar una entrada aquí, no tocar cada función de abajo.
const RECURSOS = {
  disco: {
    columnaCatalogo: 'disco_mb',
    columnaCuota: 'disco_cuota_mb',
    columnaUpscaleCantidad: 'disco_upscale_mb',
    columnaUpscaleMonto: 'disco_upscale_monto',
    columnaOtorgadoActivos: 'disco_mb_otorgado',
    etiquetaUnidad: 'MB',
  },
  usuarios: {
    columnaCatalogo: 'usuarios_otorgados',
    columnaCuota: 'max_usuarios',
    columnaUpscaleCantidad: 'usuarios_upscale',
    columnaUpscaleMonto: 'usuarios_upscale_monto',
    columnaOtorgadoActivos: 'usuarios_otorgados',
    etiquetaUnidad: 'usuario(s)',
  },
};

class ErrorUpscaleCompra extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorUpscaleCompra';
    this.codigo = codigo; // 'no_encontrado' | 'validacion' | 'sin_catalogo' | 'tipo_invalido'
  }
}

function exigirTipoValido(tipo) {
  if (!RECURSOS[tipo]) {
    throw new ErrorUpscaleCompra(`Tipo de upscale desconocido: "${tipo}".`, 'tipo_invalido');
  }
  return RECURSOS[tipo];
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

async function obtenerFuncionalidadDisponible(tipo, db) {
  const recurso = exigirTipoValido(tipo);
  const [filas] = await db.query(
    `SELECT * FROM funcionalidades_upscale WHERE activo = 1 AND ${recurso.columnaCatalogo} IS NOT NULL ORDER BY orden, id LIMIT 1`
  );
  return filas[0] || null;
}

async function cargarTenantPorSlug(slug, db) {
  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  return filas[0] || null;
}

function validarTenantYFuncionalidad(tipo, tenant, funcionalidad) {
  const recurso = exigirTipoValido(tipo);
  if (!tenant || tenant.estado === 'baja') {
    throw new ErrorUpscaleCompra('Empresa no encontrada.', 'no_encontrado');
  }
  if (tipo === 'disco' && tenant.disco_cuota_mb == null) {
    throw new ErrorUpscaleCompra('Tu plan ya tiene almacenamiento ilimitado — no necesitas comprar espacio adicional.', 'validacion');
  }
  if (tipo === 'usuarios' && tenant[recurso.columnaCuota] == null) {
    throw new ErrorUpscaleCompra('Tu plan ya tiene usuarios ilimitados — no necesitas comprar usuarios adicionales.', 'validacion');
  }
  if (!funcionalidad) {
    throw new ErrorUpscaleCompra('Esta compra no está disponible todavía.', 'sin_catalogo');
  }
}

function calcularResumenCompra(tipo, tenant, funcionalidad, cantidad) {
  const recurso = exigirTipoValido(tipo);
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
    tipo,
    funcionalidadId: funcionalidad.id,
    funcionalidadNombre: funcionalidad.nombre,
    cantidad,
    cantidadOtorgada: Number(funcionalidad[recurso.columnaCatalogo]) * cantidad,
    monto: Number(precioUnitario) * cantidad,
    ciclo,
    diasRestantes,
    cobroInmediato,
    fechaCorte: expiraEn,
    unidad: recurso.etiquetaUnidad,
    tipoCobro: funcionalidad.tipo_cobro,
  };
}

// Tope máximo de disco POR TENANT, indistinto del plan (punto 433) — solo
// aplica a disco hoy; no hay un tope equivalente para usuarios (fuera de
// alcance de este pase, no se pidió).
async function validarTopeTenant(tipo, tenant, resumen) {
  if (tipo !== 'disco') return;
  const topeTenantMb = await getDiscoTopeTenantMb();
  if (topeTenantMb == null) return;
  const cuotaResultante = Number(tenant.disco_cuota_mb) + resumen.cantidadOtorgada;
  if (cuotaResultante > topeTenantMb) {
    throw new ErrorUpscaleCompra(
      `Esta compra llevaría la cuota de esta empresa a ${cuotaResultante.toLocaleString('es-MX')} MB, por encima del tope máximo por empresa (${topeTenantMb.toLocaleString('es-MX')} MB) — contacta a soporte si necesitas más de ese límite.`,
      'validacion'
    );
  }
}

async function simularCompraUpscale(slug, tipo = 'disco', cantidad = 1, db = obtenerPool()) {
  const [tenant, funcionalidad] = await Promise.all([
    cargarTenantPorSlug(slug, db),
    obtenerFuncionalidadDisponible(tipo, db),
  ]);
  validarTenantYFuncionalidad(tipo, tenant, funcionalidad);
  const resumen = calcularResumenCompra(tipo, tenant, funcionalidad, cantidad);
  await validarTopeTenant(tipo, tenant, resumen);
  return resumen;
}

// Busca si este tenant YA tiene un upscale activo de la MISMA
// funcionalidad con un Subscription Item real — evita crear un segundo
// renglón de cobro para "lo mismo" cada vez que compra más; en vez de
// eso, sube la cantidad del item existente.
async function buscarUpscaleActivoConItem(tenantId, funcionalidadId, db) {
  const [filas] = await db.query(
    `SELECT * FROM tenant_upscales_activos
      WHERE tenant_id = ? AND funcionalidad_id = ? AND activo = 1 AND stripe_subscription_item_id IS NOT NULL
      ORDER BY id DESC LIMIT 1`,
    [tenantId, funcionalidadId]
  );
  return filas[0] || null;
}

async function aplicarUpscale(tipo, tenant, funcionalidad, resumen, { estado, stripeCheckoutSessionId = null, stripeSubscriptionItemId = null }, db) {
  const recurso = exigirTipoValido(tipo);
  const ahora = new Date();
  await db.query(
    `UPDATE tenants
        SET ${recurso.columnaCuota} = ${recurso.columnaCuota} + ?,
            ${recurso.columnaUpscaleCantidad} = ${recurso.columnaUpscaleCantidad} + ?,
            ${recurso.columnaUpscaleMonto} = ${recurso.columnaUpscaleMonto} + ?
      WHERE id = ?`,
    [resumen.cantidadOtorgada, resumen.cantidadOtorgada, resumen.monto, tenant.id]
  );
  await db.query(
    `INSERT INTO tenant_upscales_activos
       (tenant_id, funcionalidad_id, cantidad, ${recurso.columnaOtorgadoActivos}, monto_recurrente, ciclo, primer_cobro_estado, stripe_checkout_session_id, stripe_subscription_item_id, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenant.id, funcionalidad.id, resumen.cantidad, resumen.cantidadOtorgada, resumen.monto, resumen.ciclo, estado, stripeCheckoutSessionId, stripeSubscriptionItemId, ahora, ahora]
  );
  notificarInvalidacionCache(tenant.slug).catch((err) => {
    console.error(`No se pudo invalidar la caché del backend tras el upscale de "${tenant.slug}":`, err.message);
  });
}

// A diferencia de un Checkout Session (price_data.product_data inline,
// siempre efímero — ver stripePagos.js), `stripe.subscriptionItems.create()`
// EXIGE un Product ya existente en el catálogo de Stripe (confirmado real
// contra la API de prueba: "Received unknown parameter:
// items[0][price_data][product_data]") — no acepta product_data. Se crea
// UNA sola vez por funcionalidad, la primera vez que se necesita, y se
// reusa siempre después (cacheado en funcionalidades_upscale.stripe_product_id).
// El PRECIO sigue siendo ad-hoc en cada compra (price_data con
// unit_amount/recurring) — solo este contenedor se persiste, por
// requisito de la API, no por elección de diseño.
async function obtenerOCrearProductoStripe(funcionalidad, stripe, db) {
  if (funcionalidad.stripe_product_id) return funcionalidad.stripe_product_id;
  const producto = await stripe.products.create({ name: funcionalidad.nombre });
  await db.query('UPDATE funcionalidades_upscale SET stripe_product_id = ? WHERE id = ?', [producto.id, funcionalidad.id]);
  funcionalidad.stripe_product_id = producto.id;
  return producto.id;
}

// Camino real recurrente (tipo_cobro='recurrente', el único que existe
// hoy en el catálogo): agrega/sube un Subscription Item en la MISMA
// Subscription del tenant y lo factura de inmediato con una proración —
// requiere que el tenant ya tenga una Subscription real (todo tenant
// creado desde este punto en adelante la tiene; ver stripePagos.js).
async function cobrarUpscaleRecurrenteViaSubscription(tipo, tenant, funcionalidad, resumen, db) {
  if (!tenant.stripe_subscription_id) {
    throw new ErrorUpscaleCompra(
      'Esta empresa no tiene una suscripción real de Stripe — contacta a soporte para activar el upscale.',
      'validacion'
    );
  }
  const { obtenerStripe, montoCentavos } = require('./stripePagos');
  const stripe = obtenerStripe();
  const intervaloStripe = resumen.ciclo === 'anual' ? 'year' : 'month';

  const existente = await buscarUpscaleActivoConItem(tenant.id, funcionalidad.id, db);
  let item;
  if (existente) {
    const nuevaCantidad = existente.cantidad + resumen.cantidad;
    item = await stripe.subscriptionItems.update(existente.stripe_subscription_item_id, {
      quantity: nuevaCantidad,
      proration_behavior: 'create_prorations',
    });
  } else {
    const productId = await obtenerOCrearProductoStripe(funcionalidad, stripe, db);
    item = await stripe.subscriptionItems.create({
      subscription: tenant.stripe_subscription_id,
      price_data: {
        currency: 'mxn',
        unit_amount: montoCentavos(
          resumen.ciclo === 'anual' ? (funcionalidad.precio_anual ?? funcionalidad.precio_mensual) : (funcionalidad.precio_mensual ?? funcionalidad.precio_anual)
        ),
        recurring: { interval: intervaloStripe },
        product: productId,
      },
      quantity: resumen.cantidad,
      proration_behavior: 'create_prorations',
    });
  }

  // Factura la proración YA (en vez de dejarla pendiente para el
  // siguiente corte automático) — decisión del usuario: el upscale se
  // cobra de inmediato, no se espera al corte. `invoices.create` junta
  // cualquier invoice item pendiente (la proración recién creada) en una
  // factura nueva; finalize+pay la cobra en el mismo request.
  const factura = await stripe.invoices.create({
    customer: tenant.stripe_customer_id,
    subscription: tenant.stripe_subscription_id,
    auto_advance: false,
  });
  const finalizada = await stripe.invoices.finalizeInvoice(factura.id);
  if (finalizada.status !== 'paid') {
    await stripe.invoices.pay(factura.id);
  }

  return item;
}

// Confirma la compra. Rama 'recurrente' (hoy la única real): cobra ya
// vía Subscription Item, sin redirigir a ningún Checkout. Rama 'unico'
// (por si el catálogo llega a tener algo así en el futuro): mismo
// Checkout de una sola vez de siempre.
async function confirmarCompraUpscale(slug, tipo = 'disco', cantidad = 1, { successUrl, cancelUrl } = {}, db = obtenerPool()) {
  const [tenant, funcionalidad] = await Promise.all([
    cargarTenantPorSlug(slug, db),
    obtenerFuncionalidadDisponible(tipo, db),
  ]);
  validarTenantYFuncionalidad(tipo, tenant, funcionalidad);
  const resumen = calcularResumenCompra(tipo, tenant, funcionalidad, cantidad);
  await validarTopeTenant(tipo, tenant, resumen);

  if (funcionalidad.tipo_cobro === 'unico') {
    if (!successUrl || !cancelUrl) {
      throw new ErrorUpscaleCompra('successUrl y cancelUrl son obligatorios para una compra de cobro único.', 'validacion');
    }
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
        tipo_recurso: tipo,
        tenant_slug: slug,
        funcionalidad_id: String(funcionalidad.id),
        cantidad: String(resumen.cantidad),
        cantidad_otorgada: String(resumen.cantidadOtorgada),
        monto: String(resumen.monto),
        ciclo: resumen.ciclo,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return { ok: true, cobroInmediato: true, checkoutUrl: session.url, resumen };
  }

  // Recurrente: siempre se cobra ya, vía la Subscription real — nunca el
  // camino viejo de "pendiente_corte" (ese camino era solo para cuando
  // no existía una Subscription real que pudiera cobrar sola).
  const item = await cobrarUpscaleRecurrenteViaSubscription(tipo, tenant, funcionalidad, resumen, db);
  await aplicarUpscale(tipo, tenant, funcionalidad, resumen, { estado: 'cobrado_hoy', stripeSubscriptionItemId: item.id }, db);
  return { ok: true, cobroInmediato: true, cobradoViaSuscripcion: true, resumen };
}

// Llamado desde el webhook de Stripe (ver stripePagos.js) solo para la
// rama 'unico' (Checkout de una sola vez) — la rama recurrente ya no usa
// Checkout, se cobra de forma síncrona en confirmarCompraUpscale().
async function confirmarUpscalePagado(session, db = obtenerPool()) {
  const meta = session.metadata || {};
  const slug = meta.tenant_slug;
  const tipo = meta.tipo_recurso || 'disco';
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
    cantidadOtorgada: Number(meta.cantidad_otorgada),
    monto: Number(meta.monto),
    cantidad: Number(meta.cantidad) || 1,
    ciclo: meta.ciclo === 'anual' ? 'anual' : 'mensual',
  };
  await aplicarUpscale(tipo, tenant, funcionalidad, resumen, { estado: 'cobrado_hoy', stripeCheckoutSessionId: session.id }, db);
  console.log(`Upscale (${tipo}) aplicado tras pago confirmado: tenant "${slug}", +${resumen.cantidadOtorgada}.`);
}

module.exports = {
  ErrorUpscaleCompra,
  DIAS_UMBRAL_COBRO_INMEDIATO,
  RECURSOS,
  obtenerFuncionalidadDisponible,
  simularCompraUpscale,
  confirmarCompraUpscale,
  confirmarUpscalePagado,
};
