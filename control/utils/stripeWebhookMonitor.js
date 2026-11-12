// Monitoreo de salud REAL del webhook de Stripe en producción (punto en
// curso, pedido explícito del usuario tras el deploy del punto 491):
// stripeWebhookHealth.js ya detecta si el endpoint quedó DESREGISTRADO
// (el incidente del punto 465) — este módulo detecta el caso distinto
// "el endpoint existe y Stripe SÍ lo está llamando, pero algo truena al
// procesar" (firma inválida o un error real dentro de
// procesarEventoWebhook), que antes solo quedaba en `console.error`,
// invisible salvo que alguien revisara logs a mano. Fire-and-forget en
// los 2 call sites (control/server.js), mismo criterio que
// discoCapacidadAlerta.js: un fallo al enviar la alerta nunca debe tumbar
// la respuesta al webhook.
//
// Reusa el mismo correo de alertas operativas que la capacidad de disco
// (ajustesGlobales.js:getDiscoAlertaEmail) — un solo operador, un solo
// buzón de alertas, no un campo nuevo por tipo de alerta. Sin ese correo
// configurado, ninguna de las 2 funciones hace nada (mismo fail-silent
// que discoCapacidadAlerta.js cuando no hay destinatario).

const { getValorTexto, setValorTexto, getDiscoAlertaEmail } = require('./ajustesGlobales');

const CLAVE_FIRMA_ALERTADO_EN = 'stripe_webhook_firma_alertado_en';
// 1h: no repetir el correo de firma inválida mientras siga la misma
// racha (puede ser ruido — un escaneo aislado — o un secreto real
// desincronizado; si se repite pasada la hora, se vuelve a avisar).
const COOLDOWN_FIRMA_MS = 60 * 60 * 1000;
// 30min por tipo de evento: Stripe puede reintentar el mismo evento
// varias veces si Stripe cree que no respondimos a tiempo — sin
// cooldown, un error real repetido inundaría el buzón.
const COOLDOWN_ERROR_MS = 30 * 60 * 1000;

function claveErrorAlertado(tipo) {
  return `stripe_webhook_error_alertado_${String(tipo || 'desconocido').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
}

async function pasoCooldown(clave, cooldownMs) {
  const anterior = await getValorTexto(clave);
  const ahora = Date.now();
  if (anterior && ahora - new Date(anterior).getTime() < cooldownMs) return false;
  await setValorTexto(clave, new Date(ahora).toISOString());
  return true;
}

// Llamar cuando `stripe.webhooks.constructEvent` falla para TODOS los
// secretos candidatos (prueba y producción) — ver control/server.js,
// ruta POST /api/control/webhooks/stripe.
async function registrarFirmaInvalida({ mensaje } = {}) {
  const correo = await getDiscoAlertaEmail();
  if (!correo) return;
  if (!(await pasoCooldown(CLAVE_FIRMA_ALERTADO_EN, COOLDOWN_FIRMA_MS))) return;
  const { enviarCorreoBase } = require('./notificarBackend');
  await enviarCorreoBase({
    destinatario: correo,
    asunto: 'Clarvo — firma de webhook de Stripe inválida',
    eyebrow: 'Alerta operativa',
    titulo: 'Firma de webhook de Stripe inválida',
    parrafos: [
      'Llegó un evento de Stripe cuya firma no coincidió con ningún secreto conocido (prueba ni producción).',
      'Puede ser ruido (un intento aislado) o un secreto real desincronizado — si se repite, revisa /control → Upscale y Stripe → Configurar Stripe.',
      mensaje ? `Detalle: ${mensaje}` : null,
    ].filter(Boolean),
  }).catch((err) => console.error('No se pudo enviar la alerta de firma de webhook inválida:', err.message));
}

// Llamar cuando `procesarEventoWebhook(event)` lanza — la firma YA era
// válida (Stripe de verdad entregó el evento, ya respondimos 200), pero
// algo truena antes de aplicar el cambio real (activar un tenant, cobrar
// una renovación, cancelar una suscripción). Este es el caso "colgado o
// roto" real: Stripe da el evento por entregado y nunca vuelve a
// reintentarlo si no hay nadie viendo los logs.
async function registrarErrorProcesamiento({ tipo, id, mensaje }) {
  const correo = await getDiscoAlertaEmail();
  if (!correo) return;
  if (!(await pasoCooldown(claveErrorAlertado(tipo), COOLDOWN_ERROR_MS))) return;
  const { enviarCorreoBase } = require('./notificarBackend');
  await enviarCorreoBase({
    destinatario: correo,
    asunto: `Clarvo — error procesando webhook de Stripe (${tipo || 'desconocido'})`,
    eyebrow: 'Alerta operativa',
    titulo: 'Error procesando un webhook de Stripe',
    parrafos: [
      `Stripe entregó el evento "${tipo || 'desconocido'}"${id ? ` (${id})` : ''} con firma válida, pero el procesamiento falló.`,
      'Esto puede significar un tenant sin activar, una suscripción sin renovar o un cambio de plan sin aplicar.',
      'Revisa los logs de control (docker service logs clarvo_control) para el detalle completo.',
      mensaje ? `Detalle: ${mensaje}` : null,
    ].filter(Boolean),
  }).catch((err) => console.error('No se pudo enviar la alerta de error de procesamiento de webhook:', err.message));
}

module.exports = { registrarFirmaInvalida, registrarErrorProcesamiento };
