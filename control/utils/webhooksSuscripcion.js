// Ciclo de vida REAL de la Subscription de Stripe (punto en curso,
// reemplaza el cobro único) — estos 4 eventos son los que garantizan
// que el cobro recurrente mensual/anual se refleje en nuestra propia
// BD sin intervención manual de un operador:
//
//   invoice.payment_succeeded   -> cada corte cobrado de verdad,
//                                  recalcula suscripcion_expira_en desde
//                                  el periodo real que Stripe facturó
//                                  (nunca "hoy + 1 mes" calculado a
//                                  mano, para no desincronizarse si
//                                  Stripe cobra un día distinto).
//   invoice.payment_failed      -> 'vencida' (reusa el candado 402 ya
//                                  existente en backend/utils/auth.js —
//                                  bloquea SOLO admin, portal sigue
//                                  activo, grace period mientras Stripe
//                                  reintenta el cobro solo).
//   customer.subscription.updated   -> sincroniza
//                                  suscripcion_cancelar_al_corte (espejo
//                                  local de cancel_at_period_end).
//   customer.subscription.deleted   -> el periodo YA terminó de verdad
//                                  (cancelación efectiva, o Stripe agotó
//                                  reintentos) -> SUSPENDE el tenant
//                                  (bloquea admin Y portal, mismo
//                                  mecanismo que /control usa para
//                                  suspender a mano).

const { obtenerPool } = require('../db');
const { suspenderTenant, ErrorTransicionTenant } = require('./tenantLifecycle');
const { enviarCorreoBase, listarUsuariosAdminTenant } = require('./notificarBackend');

const APP_BASE_URL = (process.env.PUBLIC_APP_BASE_URL || 'https://clarvo.mx').replace(/\/$/, '');

// Mismo destino y mismo query param que "factura lista"
// (facturacionGestion.js:urlFacturacionClarvo) — comparten la sección
// "Facturación de Clarvo" de Mi Cuenta, duplicado a propósito (archivos
// distintos, sin un solo punto compartido entre ellos todavía).
function urlFacturacionClarvo(slug) {
  return `${APP_BASE_URL}/${slug}/admin?ir=facturacion-clarvo`;
}

// Campana ya avisaba "Se cobró tu suscripción" (backend:
// GET /admin/notificaciones/cobros, lee Stripe en vivo) — sin correo.
// Mismo criterio que "factura lista" (facturacionGestion.js:marcarLista):
// solo a la cuenta raíz, fire-and-forget (un correo que falla nunca debe
// tumbar el webhook ni el UPDATE que ya se guardó).
async function notificarCobroExitosoAlTenant(slug, invoice) {
  const usuarios = await listarUsuariosAdminTenant(slug);
  const raiz = Array.isArray(usuarios) ? usuarios.find((u) => u.es_cuenta_raiz) : null;
  if (!raiz || !raiz.email) return;
  const monto = Number(invoice.amount_paid || 0) / 100;
  const montoTexto = monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const folio = invoice.number || invoice.id;
  await enviarCorreoBase({
    destinatario: raiz.email,
    asunto: 'Se cobró tu suscripción de Clarvo',
    eyebrow: 'Facturación de Clarvo',
    titulo: 'Se cobró tu suscripción',
    parrafos: [`Se cobraron $${montoTexto} MXN de tu suscripción (folio ${folio}).`],
    cta: { href: urlFacturacionClarvo(slug), texto: 'Ver mi recibo' },
  });
}

async function cargarTenantPorSubscriptionId(subscriptionId, db) {
  if (!subscriptionId) return null;
  const [filas] = await db.query('SELECT * FROM tenants WHERE stripe_subscription_id = ? LIMIT 1', [subscriptionId]);
  return filas[0] || null;
}

// Bug real encontrado validando en vivo (punto en curso, nunca con
// node --check): en la versión de la API que trae el SDK instalado,
// `invoice.subscription` ya NO existe — el id vive en
// `invoice.parent.subscription_details.subscription`. Con el campo
// viejo, `subscriptionId` salía `undefined`, `cargarTenantPorSubscriptionId`
// regresaba null, y el handler retornaba sin actualizar NADA — el
// webhook respondía 200 igual (nunca tronaba), así que la renovación
// real quedaba completamente silenciosa, sin ningún error que avisara.
// Se deja el campo viejo como fallback por si la cuenta se pineara
// alguna vez a una versión de API anterior.
function resolverSubscriptionIdDeInvoice(invoice) {
  const nuevo = invoice.parent?.subscription_details?.subscription;
  if (nuevo) return typeof nuevo === 'string' ? nuevo : nuevo.id;
  const viejo = invoice.subscription;
  return typeof viejo === 'string' ? viejo : viejo?.id || null;
}

function fechaDesdeUnix(segundosUnix) {
  return new Date(segundosUnix * 1000).toISOString().slice(0, 10);
}

async function manejarPagoRenovacionExitoso(invoice, db) {
  const subscriptionId = resolverSubscriptionIdDeInvoice(invoice);
  const tenant = await cargarTenantPorSubscriptionId(subscriptionId, db);
  if (!tenant) return;

  const linea = Array.isArray(invoice.lines?.data) ? invoice.lines.data[0] : null;
  const finPeriodo = linea?.period?.end;
  await db.query(
    `UPDATE tenants
        SET suscripcion_estatus = 'pagada',
            suscripcion_expira_en = COALESCE(?, suscripcion_expira_en)
      WHERE id = ?`,
    [finPeriodo ? fechaDesdeUnix(finPeriodo) : null, tenant.id]
  );
  console.log(`Corte cobrado: tenant "${tenant.slug}" renovado (invoice ${invoice.id}).`);
  notificarCobroExitosoAlTenant(tenant.slug, invoice).catch((err) => {
    console.error(`No se pudo notificar a "${tenant.slug}" el cobro de su suscripción (invoice ${invoice.id}):`, err.message);
  });
}

async function manejarPagoRenovacionFallido(invoice, db) {
  const subscriptionId = resolverSubscriptionIdDeInvoice(invoice);
  const tenant = await cargarTenantPorSubscriptionId(subscriptionId, db);
  if (!tenant) return;
  await db.query(`UPDATE tenants SET suscripcion_estatus = 'vencida' WHERE id = ?`, [tenant.id]);
  console.error(`Cobro de renovación fallido: tenant "${tenant.slug}" (invoice ${invoice.id}) -> suscripcion_estatus='vencida'.`);
}

async function manejarSuscripcionActualizada(subscription, db) {
  const tenant = await cargarTenantPorSubscriptionId(subscription.id, db);
  if (!tenant) return;
  await db.query(
    `UPDATE tenants SET suscripcion_cancelar_al_corte = ? WHERE id = ?`,
    [subscription.cancel_at_period_end ? 1 : 0, tenant.id]
  );
}

async function manejarSuscripcionEliminada(subscription, db) {
  const tenant = await cargarTenantPorSubscriptionId(subscription.id, db);
  if (!tenant) return;
  await db.query(
    `UPDATE tenants SET suscripcion_estatus = 'cancelada', suscripcion_cancelar_al_corte = 0 WHERE id = ?`,
    [tenant.id]
  );
  try {
    await suspenderTenant(tenant.slug, { actor: 'stripe-webhook' }, db);
    console.log(`Suscripción terminada de verdad: tenant "${tenant.slug}" suspendido (subscription ${subscription.id}).`);
  } catch (err) {
    // Si ya estaba suspendido/baja por otra vía, aplicarTransicion()
    // tira ErrorTransicionTenant con codigo='estado_invalido' — no es un
    // error real en este contexto (el objetivo, "bloqueado", ya se
    // cumple), solo se deja constancia.
    if (!(err instanceof ErrorTransicionTenant)) throw err;
    console.log(`Tenant "${tenant.slug}" ya no estaba 'activo' al terminar su Subscription (${err.message}) — sin cambios.`);
  }
}

async function enrutarEventoSuscripcion(event, db = obtenerPool()) {
  const objeto = event.data.object;
  switch (event.type) {
    case 'invoice.payment_succeeded':
      await manejarPagoRenovacionExitoso(objeto, db);
      break;
    case 'invoice.payment_failed':
      await manejarPagoRenovacionFallido(objeto, db);
      break;
    case 'customer.subscription.updated':
      await manejarSuscripcionActualizada(objeto, db);
      break;
    case 'customer.subscription.deleted':
      await manejarSuscripcionEliminada(objeto, db);
      break;
    default:
      break;
  }
}

module.exports = { enrutarEventoSuscripcion };
