// Sonda sintética del webhook de Stripe (Opción B, acordada con el
// usuario): manda una firma deliberadamente inválida a
// POST /api/control/webhooks/stripe y espera EXACTAMENTE 400 — eso prueba,
// sin tocar Stripe ni esperar ningún evento real, que nginx → control →
// candado de firma siguen funcionando de punta a punta. Cualquier otra
// respuesta (200 = el candado de firma se cayó, 502/504/ECONNREFUSED =
// infra rota, 503 = Stripe sin configurar) es una falla real.
//
// Se identifica con 2 cabeceras (`X-Kerberos-Probe` + `X-Internal-Secret`)
// para que control/server.js pueda reconocerla y NO disparar la alerta por
// correo de "firma inválida" (ver stripeWebhookMonitor.js) — sin esto, la
// corrida periódica de esta sonda mandaría un correo de pánico falso cada
// vez que el cooldown de 1h expirara. Solo un llamador que ya tiene
// INTERNAL_CACHE_SECRET puede activar ese silencio — el header solo, sin el
// secreto, nunca basta (ver el candado espejo en control/server.js).

const http = require('http');
const https = require('https');

const INTERVALO_MS = 5 * 60 * 1000; // 5 min — cadencia acordada con el usuario
const TIMEOUT_MS = 4000;

let ultimoResultado = null;
let timer = null;

function sondaWebhookStripe() {
  return new Promise((resolve) => {
    const urlCruda = process.env.CONTROL_STRIPE_WEBHOOK_URL || '';
    const secreto = process.env.INTERNAL_CACHE_SECRET || '';
    const verificadoEn = new Date().toISOString();

    if (!urlCruda || !secreto) {
      resolve({
        ok: false,
        statusCode: null,
        latenciaMs: null,
        verificadoEn,
        error: 'CONTROL_STRIPE_WEBHOOK_URL o INTERNAL_CACHE_SECRET sin configurar en Kerberos.',
      });
      return;
    }

    let destino;
    try {
      destino = new URL(urlCruda);
    } catch (e) {
      resolve({ ok: false, statusCode: null, latenciaMs: null, verificadoEn, error: 'CONTROL_STRIPE_WEBHOOK_URL inválida.' });
      return;
    }

    const cliente = destino.protocol === 'https:' ? https : http;
    const cuerpo = JSON.stringify({ id: 'evt_kerberos_sonda', object: 'event', tipo: 'sonda_sintetica' });
    const inicio = Date.now();

    const peticion = cliente.request(
      {
        hostname: destino.hostname,
        port: destino.port || (destino.protocol === 'https:' ? 443 : 80),
        path: `${destino.pathname}${destino.search}`,
        method: 'POST',
        timeout: TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(cuerpo),
          // Firma deliberadamente inválida — nunca puede validar contra
          // ningún secreto real, por diseño.
          'stripe-signature': 't=0,v1=sonda-kerberos-firma-siempre-invalida',
          'X-Kerberos-Probe': '1',
          'X-Internal-Secret': secreto,
        },
      },
      (respuesta) => {
        respuesta.resume();
        respuesta.on('end', () => {
          const sano = respuesta.statusCode === 400;
          resolve({
            ok: sano,
            statusCode: respuesta.statusCode,
            latenciaMs: Date.now() - inicio,
            verificadoEn,
            error: sano ? null : `Respuesta inesperada: HTTP ${respuesta.statusCode} (se esperaba 400).`,
          });
        });
      }
    );
    peticion.on('timeout', () => peticion.destroy(new Error('Tiempo de espera agotado')));
    peticion.on('error', (err) => {
      resolve({
        ok: false,
        statusCode: null,
        latenciaMs: Date.now() - inicio,
        verificadoEn,
        error: err.message,
      });
    });
    peticion.end(cuerpo);
  });
}

// Corre la sonda y actualiza la caché en memoria — usada tanto por el
// timer periódico como por el disparo manual (deploy gate / botón en el
// dashboard). Nunca lanza: una falla de red ES el resultado, no una
// excepción que tumbe al llamador.
async function correrSondaAhora() {
  ultimoResultado = await sondaWebhookStripe();
  return ultimoResultado;
}

function iniciarSondaStripePeriodica() {
  if (timer) return; // nunca doble-arrancar
  correrSondaAhora().catch(() => {});
  timer = setInterval(() => {
    correrSondaAhora().catch(() => {});
  }, INTERVALO_MS);
  // No debe mantener vivo el proceso por sí solo (irrelevante aquí, pero
  // mismo criterio defensivo que cualquier timer de larga vida).
  if (timer.unref) timer.unref();
}

function obtenerUltimoResultadoSonda() {
  return ultimoResultado;
}

module.exports = {
  iniciarSondaStripePeriodica,
  correrSondaAhora,
  obtenerUltimoResultadoSonda,
  sondaWebhookStripe,
};
