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

// Comisión REAL que Stripe retiene por procesar el cobro (Balance
// Transaction API) — nunca un porcentaje fijo inventado, siempre el dato
// real de ESE cargo específico (verificado contra la API real: varía por
// invoice, no es un 3.6% parejo). Solo resoluble para invoices YA
// pagadas — el Charge y su balance_transaction nacen junto con el pago
// exitoso, no existen antes. Stripe limita el expand anidado a 4
// niveles (confirmado real: "cannot expand more than 4 levels" con
// 'payments.data.payment.payment_intent.latest_charge.balance_transaction'
// de un solo jalón) — por eso son 2 llamadas encadenadas, nunca una.
// Nunca tumba el listado/CFDI completo si no se puede resolver (pago
// manual viejo, reembolso parcial, etc.) — esa factura simplemente
// queda sin desglose de comisión, el flujo sigue con el monto bruto.
async function obtenerComisionStripe(stripe, invoiceId, estadoInvoice) {
  if (estadoInvoice !== 'paid') return null;
  try {
    const conPagos = await stripe.invoices.retrieve(invoiceId, {
      expand: ['payments.data.payment.payment_intent'],
    });
    const pago = conPagos.payments?.data?.[0]?.payment;
    const piId = typeof pago?.payment_intent === 'string' ? pago.payment_intent : pago?.payment_intent?.id;
    if (!piId) return null;
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge.balance_transaction'] });
    const charge = pi.latest_charge;
    const bt = typeof charge === 'object' && charge ? charge.balance_transaction : null;
    if (!bt || typeof bt !== 'object') return null;
    return {
      fee: Math.round(Number(bt.fee || 0)) / 100,
      net: Math.round(Number(bt.net || 0)) / 100,
    };
  } catch (err) {
    return null;
  }
}

// Desglose real (propuesta 2, "tarjeta de desglose") — 2 deducciones
// independientes, nunca mezcladas: el DESCUENTO (cupón de un solo cobro,
// ver stripeConfig.js — las invoices siguientes de la misma suscripción
// simplemente no lo traen, Stripe ya resuelve el "solo una vez" solo) y
// la COMISIÓN de Stripe (arriba, siempre presente en un cobro real,
// tenga o no cupón). Ninguna de las 2 vive a nivel línea en Stripe (el
// cupón se adjunta a la Subscription completa, la comisión es del cargo
// completo) — se prorratean aquí proporcional al peso de cada línea en
// el subtotal, nunca presentadas como un dato que Stripe calculó así.
function lineasDeInvoice(invoice, comisionStripeTotal) {
  const data = Array.isArray(invoice.lines?.data) ? invoice.lines.data : [];
  const subtotalBruto = Number(invoice.subtotal || 0);
  const descuentoTotalCentavos = Math.max(0, Number(invoice.subtotal || 0) - Number(invoice.total || 0));
  const comisionTotalCentavos = Math.max(0, Math.round((comisionStripeTotal || 0) * 100));
  return data.map((linea) => {
    const montoBruto = Number(linea.amount || 0) / 100;
    const pesoLinea = subtotalBruto > 0 ? Number(linea.amount || 0) / subtotalBruto : 0;
    const descuentoLinea = Math.round(pesoLinea * descuentoTotalCentavos) / 100;
    const comisionLinea = Math.round(pesoLinea * comisionTotalCentavos) / 100;
    return {
      descripcion: limpiarDescripcionLinea(linea.description || 'Cargo de suscripción'),
      monto: montoBruto,
      descuento: descuentoLinea,
      comisionStripe: comisionLinea,
      montoNeto: Math.round((montoBruto - descuentoLinea - comisionLinea) * 100) / 100,
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
  const facturas = await Promise.all(
    lista.data
      .filter((invoice) => invoice.status === 'paid' || invoice.status === 'open' || invoice.status === 'uncollectible')
      .map(async (invoice) => {
        const primeraLinea = invoice.lines?.data?.[0] || null;
        const periodoUnix = primeraLinea?.period?.start || invoice.created;
        const solicitud = solicitudesPorInvoice.get(invoice.id) || null;
        const subtotal = Number(invoice.subtotal || 0) / 100;
        const total = Number(invoice.total || 0) / 100;
        const comision = await obtenerComisionStripe(stripe, invoice.id, invoice.status);
        const comisionStripe = comision ? comision.fee : null;
        // Lo que de verdad llega a la cuenta de Clarvo — sin comisión
        // resoluble (edge case raro) se cae al bruto, nunca null, para
        // que la tabla siempre tenga un número que mostrar.
        const montoNeto = comision ? comision.net : total;
        return {
          id: invoice.id,
          folio: invoice.number || invoice.id,
          periodoEtiqueta: etiquetaMes(periodoUnix),
          periodoOrden: periodoUnix,
          subtotal,
          total,
          // Math.max(0, ...): nunca negativo por redondeo de centavos.
          descuento: Math.max(0, Math.round((subtotal - total) * 100) / 100),
          comisionStripe,
          montoNeto,
          estado: estadoDeInvoice(invoice),
          fechaCobro: invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
            : null,
          fechaVencimiento: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
          lineas: lineasDeInvoice(invoice, comisionStripe),
          hostedUrl: invoice.hosted_invoice_url || null,
          pdfUrl: invoice.invoice_pdf || null,
          solicitudFactura: solicitud
            ? { folio: solicitud.folio, estado: solicitud.estado, motivoRechazo: solicitud.motivo_rechazo }
            : null,
        };
      })
  );
  return facturas.sort((a, b) => b.periodoOrden - a.periodoOrden);
}

// Decisión del usuario (punto 477, reafirmada en este punto — el CFDI
// se factura por lo que de verdad LLEGA a la cuenta de Clarvo, no por lo
// que el cliente pagó). Dos deducciones posibles sobre el precio de
// catálogo: el descuento de un cupón (si lo hubo) y la comisión REAL que
// Stripe retiene por procesar el cobro (siempre presente en un cargo
// real, tenga o no cupón — ver obtenerComisionStripe arriba). Ninguna de
// las 2 llega a la cuenta de Clarvo, así que ninguna de las 2 se
// factura — el CFDI se emite por el NETO (`comision.net`), nunca por
// `invoice.total` (eso es lo que pagó el cliente, no lo que Clarvo
// recibió). Sin comisión resoluble (edge case raro: pago manual viejo,
// reembolso parcial), se cae al bruto de la invoice en vez de bloquear
// la emisión del CFDI por completo.
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
  const comision = await obtenerComisionStripe(stripe, invoice.id, invoice.status);
  if (comision) return comision.net;
  return Math.round(Number(invoice.total || 0)) / 100;
}

module.exports = { listarFacturasTenant, montoRealInvoiceTenant };
