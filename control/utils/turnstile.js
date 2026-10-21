// Hallazgo M-06 (sonar_1.1.html, Fase D, punto 410, decisión del usuario
// 2026-10-21): el onboarding público (clarvo.mx) auto-aprovisionaba
// tenants reales sin ningún anti-bot. Verifica el token de Cloudflare
// Turnstile contra su endpoint oficial antes de permitir
// POST /api/public/onboarding/convertir/:token (el único paso que de
// verdad crea infraestructura).
//
// Falla CERRADO a propósito: sin TURNSTILE_SECRET_KEY configurado, no se
// omite la verificación — se rechaza el onboarding. Desarrollo local usa
// el secret key PÚBLICO de prueba que documenta Cloudflare (ver
// docker-compose.yml), nunca un secreto real.
const ENDPOINT_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verificarTurnstile(token, ip) {
  const secreto = process.env.TURNSTILE_SECRET_KEY;
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

module.exports = { verificarTurnstile };
