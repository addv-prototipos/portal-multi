// "Facturación de Clarvo" en Mi Cuenta (punto 467+) — historial real de
// cobros de la suscripción de un tenant, leído directo de Stripe (nunca
// se duplica en una tabla local: Stripe YA es la fuente de verdad de cada
// invoice, mismo criterio que el resto de la integración de pagos, ver
// CLAUDE.md "los planes NUNCA viven como Product/Price en el catálogo").

const { obtenerStripe } = require('./stripePagos');
const { obtenerPool } = require('../db');

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function etiquetaMes(unixSeconds) {
  const fecha = new Date(unixSeconds * 1000);
  return `${MESES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
}

function estadoDeInvoice(invoice) {
  if (invoice.status === 'paid') return 'pagado';
  if (invoice.status === 'uncollectible') return 'vencido';
  return 'pendiente';
}

// Stripe genera la descripción de la línea sola (ej. "1 × Clarvo - Crece
// (at $799.00 / month)") — el paréntesis del precio es ruido aquí porque
// el monto ya se muestra en su propia columna; se recorta solo para
// mostrar, nunca se toca el monto real.
function limpiarDescripcionLinea(descripcion) {
  return descripcion.replace(/\s*\(at\s+\$[\d,.]+\s*\/\s*\w+\)\s*$/i, '');
}

// Desglose real (propuesta 2, "tarjeta de desglose") — el descuento que
// trae esta invoice (si tiene uno, SOLO en el cobro donde de verdad se
// aplicó: los cupones de este catálogo son siempre duration:'once', ver
// stripeConfig.js, así que las invoices SIGUIENTES de la misma
// suscripción simplemente no traen descuento, sin que este código tenga
// que decidir nada sobre "cada cuánto aplica" — eso ya lo resuelve
// Stripe solo). El descuento vive a nivel INVOICE (el cupón se adjunta a
// la Subscription completa, nunca a una línea), así que Stripe no
// entrega un desglose nativo por línea — se prorratea aquí
// proporcional al peso de cada línea en el subtotal, y se marca
// `prorrateado:true` para que la UI nunca lo presente como un dato que
// Stripe calculó así.
function lineasDeInvoice(invoice) {
  const data = Array.isArray(invoice.lines?.data) ? invoice.lines.data : [];
  const subtotalBruto = Number(invoice.subtotal || 0);
  const descuentoTotalCentavos = Math.max(0, Number(invoice.subtotal || 0) - Number(invoice.total || 0));
  return data.map((linea) => {
    const montoBruto = Number(linea.amount || 0) / 100;
    const descuentoLinea = subtotalBruto > 0
      ? Math.round((Number(linea.amount || 0) / subtotalBruto) * descuentoTotalCentavos) / 100
      : 0;
    return {
      descripcion: limpiarDescripcionLinea(linea.description || 'Cargo de suscripción'),
      monto: montoBruto,
      descuento: descuentoLinea,
      montoNeto: Math.round((montoBruto - descuentoLinea) * 100) / 100,
    };
  });
}

// Excluye 'draft' (todavía no es un cobro real) y 'void' (se canceló antes
// de cobrarse) — ninguno de los 2 es un cargo que el tenant deba ver en su
// estado de cuenta.
async function listarFacturasTenant(slug, { limite = 12, db = obtenerPool() } = {}) {
  const [filas] = await db.query('SELECT stripe_customer_id FROM tenants WHERE slug = ?', [slug]);
  const stripeCustomerId = filas[0]?.stripe_customer_id || null;
  if (!stripeCustomerId) return [];
  const stripe = obtenerStripe();
  const lista = await stripe.invoices.list({ customer: stripeCustomerId, limit: limite });
  // Punto 469: estado real de "Solicitar factura" por cobro — un solo
  // SELECT para todas las solicitudes de este tenant, nunca una query
  // por invoice dentro del .map() de abajo.
  const [solicitudesFilas] = await db.query(
    'SELECT invoice_id, folio, estado, motivo_rechazo FROM tenant_solicitudes_factura WHERE tenant_slug = ?',
    [slug]
  );
  const solicitudesPorInvoice = new Map(solicitudesFilas.map((s) => [s.invoice_id, s]));
  return lista.data
    .filter((invoice) => invoice.status === 'paid' || invoice.status === 'open' || invoice.status === 'uncollectible')
    .map((invoice) => {
      const primeraLinea = invoice.lines?.data?.[0] || null;
      const periodoUnix = primeraLinea?.period?.start || invoice.created;
      const solicitud = solicitudesPorInvoice.get(invoice.id) || null;
      const subtotal = Number(invoice.subtotal || 0) / 100;
      const total = Number(invoice.total || 0) / 100;
      return {
        id: invoice.id,
        folio: invoice.number || invoice.id,
        periodoEtiqueta: etiquetaMes(periodoUnix),
        periodoOrden: periodoUnix,
        subtotal,
        total,
        // Math.max(0, ...): nunca negativo por redondeo de centavos.
        descuento: Math.max(0, Math.round((subtotal - total) * 100) / 100),
        estado: estadoDeInvoice(invoice),
        fechaCobro: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
          : null,
        fechaVencimiento: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        lineas: lineasDeInvoice(invoice),
        hostedUrl: invoice.hosted_invoice_url || null,
        pdfUrl: invoice.invoice_pdf || null,
        solicitudFactura: solicitud
          ? { folio: solicitud.folio, estado: solicitud.estado, motivoRechazo: solicitud.motivo_rechazo }
          : null,
      };
    })
    .sort((a, b) => b.periodoOrden - a.periodoOrden);
}

// Decisión del usuario (punto en curso — reemplaza el criterio anterior
// de "precio de catálogo", que vivía aquí como montoCatalogoTenant() y
// se retiró por completo: ya no se usa en ningún lado). El CFDI real
// debe coincidir con lo que Stripe de verdad cobró en ESE invoice — nunca el
// precio de catálogo. Si hubo un descuento (cupón de un solo cobro, ver
// stripeConfig.js), el CFDI se emite por el monto YA con descuento; el
// mes siguiente, sin descuento activo, el invoice.total vuelve solo al
// precio de catálogo — no hace falta ninguna lógica especial aquí para
// "solo una vez", Stripe ya lo resuelve con duration:'once'.
// `invoiceId` nunca se confía a ciegas (es del frontend) — se verifica
// que el customer del invoice real sea el mismo que el de este tenant
// antes de usar su monto, mismo criterio que cualquier otro candado
// cross-tenant del proyecto.
async function montoRealInvoiceTenant(slug, invoiceId, db = obtenerPool()) {
  const [filas] = await db.query('SELECT stripe_customer_id FROM tenants WHERE slug = ?', [slug]);
  const stripeCustomerId = filas[0]?.stripe_customer_id || null;
  if (!stripeCustomerId) return null;
  const stripe = obtenerStripe();
  let invoice;
  try {
    invoice = await stripe.invoices.retrieve(invoiceId);
  } catch (err) {
    return null;
  }
  if (!invoice || invoice.customer !== stripeCustomerId) return null;
  return Math.round(Number(invoice.total || 0)) / 100;
}

module.exports = { listarFacturasTenant, montoRealInvoiceTenant };
