// Reactivación de un tenant archivado por trial vencido sin pago (o pago
// desde el muro de /admin mientras sigue 'activo' pero bloqueado, antes
// de que el job lo archive) — mismo Checkout Session hosted de Stripe
// para ambos caminos, mismo webhook handler. El link de 15 días que llega
// por correo NUNCA pasa por /admin ni por el candado anti-enumeración de
// slugs (ver CLAUDE.md, punto 422: cualquier estado != 'activo' responde
// 404 genérico) — usa un token propio, público, independiente de
// cualquier sesión de administrador.

const crypto = require('crypto');
const { obtenerPool } = require('../db');
const { obtenerStripe, montoCentavos, APP_BASE_URL } = require('./stripePagos');
const { reactivarTenant, darDeBajaTenant, MOTIVO_BAJA_TRIAL_VENCIDO } = require('./tenantLifecycle');
const { enviarCorreoBase } = require('./notificarBackend');
const { sumarCiclo } = require('./tenantSuscripcion');

class ErrorReactivacion extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorReactivacion';
    this.codigo = codigo; // 'no_encontrado' | 'token_invalido' | 'validacion'
  }
}

// Vigencia del link de correo — mismo número que
// DIAS_RETENCION_BAJA_TRIAL_VENCIDO hoy, pero una constante propia a
// propósito: son dos conceptos distintos (cuándo deja de servir el link
// vs. cuándo se purga el tenant) que solo COINCIDEN en valor por ahora.
const DIAS_VIGENCIA_TOKEN = 15;

function generarToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Mismo criterio de zona fija ya usado en backend/utils/suscripcionTenant.js
// y control/utils/tenantSuscripcion.js — esto es administrativo (cuándo
// vence un trial/token), no un corte financiero por tenant.
function hoyYYYYMMDD(zonaHoraria = 'America/Mexico_City') {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const obj = {};
  for (const parte of partes) obj[parte.type] = parte.value;
  return `${obj.year}-${obj.month}-${obj.day}`;
}

// Reusa un token vigente si ya hay uno sin usar y sin vencer — nunca
// genera uno nuevo en cada llamada, para que reintentar (ej. un futuro
// recordatorio) no invalide un link que el cliente ya tenía abierto.
async function obtenerOCrearTokenReactivacion(tenantId, db = obtenerPool()) {
  const ahora = new Date();
  const [vigentes] = await db.query(
    `SELECT token FROM reactivacion_tokens WHERE tenant_id = ? AND usado_en IS NULL AND expira_en > ? ORDER BY creado_en DESC LIMIT 1`,
    [tenantId, ahora]
  );
  if (vigentes.length > 0) return vigentes[0].token;
  const token = generarToken();
  const expiraEn = new Date(ahora.getTime() + DIAS_VIGENCIA_TOKEN * 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO reactivacion_tokens (tenant_id, token, expira_en, creado_en) VALUES (?, ?, ?, ?)`,
    [tenantId, token, expiraEn, ahora]
  );
  return token;
}

async function validarToken(token, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT rt.id, rt.tenant_id, rt.expira_en, rt.usado_en, t.slug, t.nombre_empresa
       FROM reactivacion_tokens rt JOIN tenants t ON t.id = rt.tenant_id
      WHERE rt.token = ?`,
    [token]
  );
  const fila = filas[0];
  if (!fila) throw new ErrorReactivacion('Este link no es válido.', 'token_invalido');
  if (fila.usado_en) throw new ErrorReactivacion('Este link ya se usó — tu cuenta ya debería estar activa. Si no es así, contáctanos.', 'token_invalido');
  if (new Date(fila.expira_en).getTime() < Date.now()) {
    throw new ErrorReactivacion('Este link ya venció.', 'token_invalido');
  }
  return fila;
}

// Resuelve el precio real del plan YA asignado al tenant (nunca un monto
// que llegue de fuera) — mismo criterio que crearCheckoutSession() del
// onboarding (stripePagos.js), adaptado: aquí el plan no viene de un
// borrador, viene de `tenants.plan_id` (el operador ya se lo asignó al
// dar de alta manual).
async function crearCheckoutSessionReactivacion(tenantId, { db = obtenerPool() } = {}) {
  const [filas] = await db.query(
    `SELECT t.id, t.slug, t.nombre_empresa, t.plan_id, t.suscripcion_ciclo,
            p.nombre AS plan_nombre, p.precio_mensual, p.precio_anual
       FROM tenants t LEFT JOIN planes p ON p.id = t.plan_id
      WHERE t.id = ?`,
    [tenantId]
  );
  const tenant = filas[0];
  if (!tenant) throw new ErrorReactivacion('Empresa no encontrada.', 'no_encontrado');
  if (!tenant.plan_id) {
    throw new ErrorReactivacion('Esta empresa no tiene un plan asignado todavía — asígnalo desde /control antes de poder cobrar.', 'validacion');
  }
  const ciclo = tenant.suscripcion_ciclo === 'anual' ? 'anual' : 'mensual';
  const precio = ciclo === 'anual' ? tenant.precio_anual : tenant.precio_mensual;
  if (precio === null || precio === undefined) {
    throw new ErrorReactivacion('Este plan todavía no tiene un precio configurado. Contacta a soporte.', 'validacion');
  }

  const stripe = obtenerStripe();
  const intervaloStripe = ciclo === 'anual' ? 'year' : 'month';
  const intervaloNombre = ciclo === 'anual' ? 'año' : 'mes';

  // Mismo criterio ya documentado en el proyecto: el Price nunca vive en
  // el catálogo de Stripe, se arma al vuelo (price_data) con el precio
  // real resuelto arriba — el Product/Price que Stripe genera es efímero.
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: 'mxn',
          unit_amount: montoCentavos(precio),
          recurring: { interval: intervaloStripe },
          product_data: { name: `Clarvo — ${tenant.plan_nombre || 'tu plan'} (${intervaloNombre})` },
        },
        quantity: 1,
      },
    ],
    metadata: { tipo: 'reactivacion', tenantId: String(tenant.id) },
    subscription_data: { metadata: { tipo: 'reactivacion', tenantId: String(tenant.id) } },
    success_url: `${APP_BASE_URL}/${tenant.slug}/admin?reactivado=1`,
    cancel_url: `${APP_BASE_URL}/${tenant.slug}/admin`,
  });

  return { checkoutUrl: session.url };
}

// Entry point del link público (token del correo) — valida y arma el
// Checkout en un solo paso, para que el router de server.js solo tenga
// que hacer el redirect.
async function crearCheckoutSessionDesdeToken(token, db = obtenerPool()) {
  const fila = await validarToken(token, db);
  return crearCheckoutSessionReactivacion(fila.tenant_id, { db });
}

// Webhook (enrutado desde stripePagos.js por metadata.tipo==='reactivacion').
// Idempotente vía yaProcesado(event.id), que ya corre ANTES de llegar aquí.
async function manejarReactivacionConfirmada(session, db) {
  const tenantId = session.metadata && Number(session.metadata.tenantId);
  if (!tenantId) {
    console.error('checkout.session de reactivación sin metadata.tenantId — no se puede reactivar nada con esto.', session.id);
    return;
  }
  const [filas] = await db.query('SELECT id, slug, suscripcion_ciclo FROM tenants WHERE id = ?', [tenantId]);
  const tenant = filas[0];
  if (!tenant) {
    console.error(`Reactivación confirmada para tenant_id=${tenantId}, pero ya no existe.`, session.id);
    return;
  }

  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
  const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
  const ciclo = tenant.suscripcion_ciclo === 'anual' ? 'anual' : 'mensual';
  const hoy = hoyYYYYMMDD();
  const expiraEn = sumarCiclo(hoy, ciclo);

  // suscripcion_origen NUNCA se toca aquí — sigue siendo 'manual', la
  // verdad histórica de cómo nació este tenant, aunque ya esté pagando.
  await db.query(
    `UPDATE tenants
        SET suscripcion_estatus = 'pagada', stripe_customer_id = ?, stripe_subscription_id = ?,
            suscripcion_ciclo_inicia_en = ?, suscripcion_expira_en = ?
      WHERE id = ?`,
    [stripeCustomerId, stripeSubscriptionId, hoy, expiraEn, tenant.id]
  );

  // Si estaba archivado (vino del link de 15 días), lo reactiva — si
  // seguía 'activo' (pagó desde el muro antes de que el job lo
  // archivara), reactivarTenant() es un no-op seguro: solo transiciona
  // desde 'suspendido'/'baja', nunca desde 'activo'.
  await reactivarTenant(tenant.slug, { actor: 'stripe-webhook:reactivacion' }, db).catch((err) => {
    console.error(`No se pudo reactivar "${tenant.slug}" tras el pago (puede que ya estuviera activo):`, err.message);
  });

  await db.query(`UPDATE reactivacion_tokens SET usado_en = ? WHERE tenant_id = ? AND usado_en IS NULL`, [new Date(), tenant.id]);

  console.log(`Tenant "${tenant.slug}" pagado/reactivado tras confirmar Stripe (reactivación).`);
}

// Job automático (llamado desde un temporizador propio en
// control/server.js:iniciar(), mismo patrón que purga/recordatorios).
// Archiva cualquier trial MANUAL vencido sin pago (nunca tocó Stripe de
// verdad) y manda el correo con el link de 15 días. Un tenant que falla
// no detiene al resto del barrido.
async function archivarTrialsVencidosSinPago(db = obtenerPool()) {
  const hoy = hoyYYYYMMDD();
  const [candidatos] = await db.query(
    `SELECT id, slug, nombre_empresa, contacto_email
       FROM tenants
      WHERE estado IN ('activo','suspendido')
        AND suscripcion_estatus = 'prueba'
        AND suscripcion_origen = 'manual'
        AND stripe_subscription_id IS NULL
        AND suscripcion_expira_en IS NOT NULL
        AND suscripcion_expira_en < ?`,
    [hoy]
  );

  let archivados = 0;
  for (const t of candidatos) {
    try {
      await darDeBajaTenant(t.slug, { actor: 'sistema:trial-vencido', motivo: MOTIVO_BAJA_TRIAL_VENCIDO }, db);
      archivados++;
      if (t.contacto_email) {
        const token = await obtenerOCrearTokenReactivacion(t.id, db);
        const link = `${APP_BASE_URL}/api/public/reactivacion/${token}`;
        await enviarCorreoBase({
          destinatario: t.contacto_email,
          asunto: 'Tu periodo de prueba terminó — tienes 15 días para reactivar tu cuenta',
          cuerpo:
            `Hola,\n\nTu periodo de prueba de Clarvo para "${t.nombre_empresa}" terminó sin que se agregara ` +
            `un método de pago, así que pausamos tu cuenta.\n\nTus datos siguen intactos, nada se perdió. Si quieres ` +
            `seguir usando Clarvo, agrega tu método de pago aquí dentro de los próximos ${DIAS_VIGENCIA_TOKEN} días:\n${link}\n\n` +
            `Si no hacemos nada de tu parte en ese tiempo, tu cuenta y toda su información se eliminarán de forma ` +
            `permanente — sin posibilidad de recuperarla después.\n\n— Clarvo`,
        }).catch((err) => console.error(`No se pudo enviar el correo de trial vencido a "${t.slug}":`, err.message));
      } else {
        console.error(`Trial vencido archivado para "${t.slug}" pero sin contacto_email — no se pudo avisar.`);
      }
    } catch (err) {
      console.error(`No se pudo archivar el trial vencido de "${t.slug}":`, err.message);
    }
  }
  return { archivados, total: candidatos.length };
}

module.exports = {
  ErrorReactivacion,
  crearCheckoutSessionReactivacion,
  crearCheckoutSessionDesdeToken,
  manejarReactivacionConfirmada,
  archivarTrialsVencidosSinPago,
  validarToken,
  DIAS_VIGENCIA_TOKEN,
};
