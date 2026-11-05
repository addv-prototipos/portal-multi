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

function lineasDeInvoice(invoice) {
  const data = Array.isArray(invoice.lines?.data) ? invoice.lines.data : [];
  return data.map((linea) => ({
    descripcion: limpiarDescripcionLinea(linea.description || 'Cargo de suscripción'),
    monto: Number(linea.amount || 0) / 100,
  }));
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
      return {
        id: invoice.id,
        folio: invoice.number || invoice.id,
        periodoEtiqueta: etiquetaMes(periodoUnix),
        periodoOrden: periodoUnix,
        total: Number(invoice.total || 0) / 100,
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

// Punto en curso — corrección: "Solicitar factura" (CFDI real vía SAT)
// nunca se pide por lo que Stripe cobró internamente (puede venir
// prorrateado, o neto de su comisión) — se pide por el PRECIO DE
// CATÁLOGO vigente (el mismo que se muestra al aplicar el plan en el
// sitio: plan + upscales activos, ya con IVA incluido por convención de
// precios al público en México — ver Checkout real, que nunca desglosa
// IVA aparte). La comisión real de Stripe es contabilidad interna de
// ADDV (gasto deducible), invisible para el tenant. Monto de cada
// upscale = `monto_recurrente` (el precio YA contratado/congelado al
// comprarlo, nunca el precio de catálogo actual si cambió después —
// mismo criterio que cualquier snapshot de precio ya contratado en este
// proyecto). Nunca se recibe del frontend: se recalcula aquí siempre
// ("nunca confiar en lo que mandó el frontend" para un monto de
// negocio).
async function montoCatalogoTenant(slug, db = obtenerPool()) {
  const [tenantFilas] = await db.query(
    `SELECT t.id, t.suscripcion_ciclo, p.nombre AS plan_nombre,
            p.precio_mensual, p.precio_anual
       FROM tenants t LEFT JOIN planes p ON p.id = t.plan_id
      WHERE t.slug = ?`,
    [slug]
  );
  const tenant = tenantFilas[0];
  if (!tenant) return { total: 0, lineas: [] };

  const ciclo = tenant.suscripcion_ciclo === 'anual' ? 'anual' : 'mensual';
  const precioPlan = ciclo === 'anual' ? tenant.precio_anual : tenant.precio_mensual;
  const lineas = [];
  if (precioPlan != null) {
    lineas.push({
      descripcion: `Clarvo — ${tenant.plan_nombre || 'tu plan'} (${ciclo === 'anual' ? 'año' : 'mes'})`,
      monto: Number(precioPlan),
    });
  }

  const [upscales] = await db.query(
    `SELECT f.nombre, u.monto_recurrente
       FROM tenant_upscales_activos u
       JOIN funcionalidades_upscale f ON f.id = u.funcionalidad_id
      WHERE u.tenant_id = ? AND u.activo = 1`,
    [tenant.id]
  );
  for (const upscale of upscales) {
    lineas.push({ descripcion: upscale.nombre, monto: Number(upscale.monto_recurrente) });
  }

  const total = Math.round(lineas.reduce((suma, l) => suma + l.monto, 0) * 100) / 100;
  return { total, lineas };
}

module.exports = { listarFacturasTenant, montoCatalogoTenant };
