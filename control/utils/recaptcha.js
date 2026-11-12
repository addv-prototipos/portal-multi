// Reemplaza a Cloudflare Turnstile (punto 410/M-06, sonar_1.1.html) por
// Google reCAPTCHA v2 Checkbox — decisión explícita del usuario, 2026-11-12.
// Verifica el token contra el endpoint oficial antes de permitir
// POST /api/public/onboarding/pagar/:token (el único paso que de verdad
// mueve dinero).
//
// Falla CERRADO a propósito: sin RECAPTCHA_SECRET_KEY configurado, no se
// omite la verificación — se rechaza el onboarding. Desarrollo local usa
// el secret key PÚBLICO de prueba que documenta Google (ver
// docker-compose.yml y DOCS/recaptcha.html), nunca un secreto real.
const ENDPOINT_SITEVERIFY = 'https://www.google.com/recaptcha/api/siteverify';

async function verificarRecaptcha(token, ip) {
  const secreto = process.env.RECAPTCHA_SECRET_KEY;
  if (!secreto) {
    return { ok: false, motivo: 'no_configurado' };
  }
  if (typeof token !== 'string' || !token) {
    return { ok: false, motivo: 'token_faltante' };
  }

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  if (ip) cuerpo.set('remoteip', ip);

  try {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 5000);
    const respuesta = await fetch(ENDPOINT_SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
      signal: controlador.signal,
    });
    clearTimeout(timeout);
    if (!respuesta.ok) return { ok: false, motivo: 'error_http' };
    const datos = await respuesta.json();
    if (!datos.success) return { ok: false, motivo: 'rechazado' };
    return { ok: true };
  } catch (err) {
    return { ok: false, motivo: 'error_red' };
  }
}

module.exports = { verificarRecaptcha };
