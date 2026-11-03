// Self-healing del webhook de Stripe (punto en curso, incidente real de
// producción: un tenant pagó de verdad y se quedó atorado 3h45min porque
// NUNCA hubo ningún webhook registrado en Stripe — ni un error de firma,
// ni un crash: cero registros en el log de nginx para esa ruta, cero
// endpoints en `stripe.webhookEndpoints.list()`. Este módulo existe para
// que ESO específicamente nunca vuelva a pasar inadvertido, en modo
// prueba o en modo live por igual (los webhooks de Stripe son por modo —
// cada API key solo ve/crea endpoints de SU PROPIO modo).
//
// Diseño (ver la discusión completa en PROJECT_STATE.md, punto en
// curso): un contenedor de Swarm no puede escribir el `.env` del HOST
// (STRIPE_WEBHOOK_SECRET llega vía `environment:` interpolado por
// `docker stack deploy`, no por bind mount ni env_file dentro del
// contenedor) — así que "autoescribir para que sobreviva un restart" se
// resuelve en 2 capas, no con un `fs.writeFile` ingenuo:
//   1) Si el endpoint de Stripe no existe, SE CREA aquí mismo (ok, vía
//      API) y el secreto nuevo (`whsec_...`, Stripe solo lo expone UNA
//      vez, al crear) se guarda en `ajustes_globales` (clave
//      `stripe_webhook_secret_actual`, mismo patrón clave/valor que
//      `getValorTexto`/`setValorTexto` ya trae) — fuente de verdad que
//      SÍ sobrevive un restart del contenedor, sin tocar ningún archivo
//      del host.
//   2) El propio endpoint `/api/control/webhooks/stripe` (ver
//      server.js) intenta verificar la firma con `process.env.
//      STRIPE_WEBHOOK_SECRET` primero y, si falla, reintenta con el
//      valor guardado en `ajustes_globales` — así un `.env` del host
//      desactualizado nunca vuelve a bloquear un pago real: la base de
//      datos manda. `VULTR/sync-stripe-webhook-secret.sh` (host, cron)
//      sincroniza el `.env` real desde esta misma fuente para que
//      también quede consistente ahí, pero NO es el candado que importa
//      — el candado real es este fallback en el momento de verificar la
//      firma.

const { obtenerStripe, APP_BASE_URL } = require('./stripePagos');
const { getValorTexto, setValorTexto } = require('./ajustesGlobales');

const URL_WEBHOOK = `${APP_BASE_URL}/api/control/webhooks/stripe`;
const CLAVE_SECRETO_ACTUAL = 'stripe_webhook_secret_actual';
const CLAVE_ULTIMA_VERIFICACION = 'stripe_webhook_ultima_verificacion';
const CLAVE_ULTIMO_RESULTADO = 'stripe_webhook_ultimo_resultado';

// Los 7 tipos que control/utils/stripePagos.js:procesarEventoWebhook()
// de verdad maneja (ver su switch) — nunca "todos los eventos", mismo
// criterio de superficie mínima que el resto del proyecto.
const EVENTOS_REQUERIDOS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

function eventosFaltantes(enabledEvents) {
  if (Array.isArray(enabledEvents) && enabledEvents.includes('*')) return [];
  const actuales = new Set(enabledEvents || []);
  return EVENTOS_REQUERIDOS.filter((e) => !actuales.has(e));
}

// Devuelve el secreto a usar para verificar una firma: primero el que ya
// trae el proceso vivo (`process.env`, lo normal si `.env` está al día),
// y si no coincide, el guardado en BD (ver diseño arriba) — nunca al
// revés, para no preferir un valor de BD potencialmente más viejo sobre
// uno de `.env` recién desplegado a propósito.
async function secretosCandidatos() {
  const candidatos = [];
  if (process.env.STRIPE_WEBHOOK_SECRET) candidatos.push(process.env.STRIPE_WEBHOOK_SECRET);
  const deBd = await getValorTexto(CLAVE_SECRETO_ACTUAL);
  if (deBd && !candidatos.includes(deBd)) candidatos.push(deBd);
  return candidatos;
}

// Verifica (y, si autoReparar, registra/reactiva) el webhook de Stripe
// para la URL/modo activos de esta API key. Idempotente — nunca crea un
// segundo endpoint si ya existe uno para esta misma URL; nunca toca
// endpoints de OTRA URL (ej. uno viejo apuntando a yt.addv.com.mx se
// reporta como "ajeno", nunca se borra solo, por si todavía se usa).
async function verificarYRepararWebhook({ autoReparar = true } = {}) {
  const stripe = obtenerStripe();
  const resultado = {
    url: URL_WEBHOOK,
    modo: null,
    accion: 'ninguna', // 'ninguna' | 'creado' | 'reactivado' | 'eventos_actualizados'
    ok: false,
    endpointId: null,
    secretoNuevo: null,
    endpointsAjenos: [],
    error: null,
  };

  try {
    const lista = await stripe.webhookEndpoints.list({ limit: 100 });
    resultado.modo = lista.data.some((e) => e.livemode) ? 'live' : (lista.data.length ? 'prueba' : 'desconocido');
    resultado.endpointsAjenos = lista.data
      .filter((e) => e.url !== URL_WEBHOOK)
      .map((e) => ({ id: e.id, url: e.url, status: e.status }));

    const propio = lista.data.find((e) => e.url === URL_WEBHOOK);

    if (!propio) {
      if (!autoReparar) {
        resultado.error = 'No existe ningún webhook registrado para esta URL.';
        return resultado;
      }
      const creado = await stripe.webhookEndpoints.create({
        url: URL_WEBHOOK,
        enabled_events: EVENTOS_REQUERIDOS,
        description: 'Clarvo — autogenerado por stripeWebhookHealth.js',
      });
      await setValorTexto(CLAVE_SECRETO_ACTUAL, creado.secret);
      process.env.STRIPE_WEBHOOK_SECRET = creado.secret;
      resultado.accion = 'creado';
      resultado.endpointId = creado.id;
      resultado.secretoNuevo = creado.secret;
      resultado.modo = creado.livemode ? 'live' : 'prueba';
      resultado.ok = true;
    } else {
      resultado.endpointId = propio.id;
      resultado.modo = propio.livemode ? 'live' : 'prueba';
      const faltan = eventosFaltantes(propio.enabled_events);
      const deshabilitado = propio.status !== 'enabled';

      if ((faltan.length > 0 || deshabilitado) && autoReparar) {
        await stripe.webhookEndpoints.update(propio.id, {
          enabled_events: EVENTOS_REQUERIDOS,
          disabled: false,
        });
        resultado.accion = deshabilitado ? 'reactivado' : 'eventos_actualizados';
      } else if (faltan.length > 0 || deshabilitado) {
        resultado.error = deshabilitado
          ? 'El webhook existe pero Stripe lo deshabilitó (fallos repetidos de entrega).'
          : `Al webhook le faltan eventos: ${faltan.join(', ')}.`;
        return resultado;
      }
      resultado.ok = true;
    }
  } catch (err) {
    resultado.error = err.message;
    return resultado;
  }

  await setValorTexto(CLAVE_ULTIMA_VERIFICACION, new Date().toISOString());
  await setValorTexto(CLAVE_ULTIMO_RESULTADO, JSON.stringify({
    ok: resultado.ok,
    accion: resultado.accion,
    modo: resultado.modo,
    endpointId: resultado.endpointId,
  }));
  return resultado;
}

async function estadoGuardado() {
  const [ultimaVerificacion, ultimoResultado] = await Promise.all([
    getValorTexto(CLAVE_ULTIMA_VERIFICACION),
    getValorTexto(CLAVE_ULTIMO_RESULTADO),
  ]);
  return {
    ultimaVerificacion,
    ultimoResultado: ultimoResultado ? JSON.parse(ultimoResultado) : null,
  };
}

module.exports = {
  URL_WEBHOOK,
  EVENTOS_REQUERIDOS,
  CLAVE_SECRETO_ACTUAL,
  secretosCandidatos,
  verificarYRepararWebhook,
  estadoGuardado,
};
