// SMTP default de la plataforma: cualquier tenant (o el sitio base) sin
// su propia configuración SMTP completa usa este fallback en vez de
// fallar al enviar correos. La fuente real vive en control/
// (control/utils/accesoSmtp.js, cifrada con CONTROL_VAULT_KEY) — backend/
// nunca tiene esa llave, así que el valor DESCIFRADO se obtiene vía el
// mismo canal interno ya usado para "Compra de upscale..."
// (llamarControlInterno en server.js, X-Internal-Secret + INTERNAL_CACHE_SECRET)
// duplicado aquí a propósito (control/ y backend/ son builds separados).
//
// Cacheado 45s, mismo patrón que ajustesGlobales.js: si control/ no
// responde o no tiene nada guardado, se sirve el último valor conocido
// (o null) en vez de tumbar el envío de correo por una dependencia
// intermitente.
const CACHE_TTL_MS = Number(process.env.SMTP_DEFAULT_CACHE_TTL_MS || 45 * 1000);

let cache = null; // { valor: object|null, resueltoEn: number }

async function consultarControl() {
  const url = process.env.CONTROL_INTERNAL_URL || 'http://control:4001';
  const secreto = process.env.INTERNAL_CACHE_SECRET;
  if (!secreto) return null;
  const res = await fetch(`${url}/internal/smtp-default`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secreto },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || !data.ok) return null;
  const configurado = Boolean(data.host && data.usuario && data.password);
  if (!configurado) return null;
  return {
    host: data.host,
    puerto: data.puerto,
    seguridad: data.seguridad,
    usuario: data.usuario,
    password: data.password,
    nombre_remitente: data.nombreRemitente || '',
    correo_remitente: data.correoRemitente || '',
    verificado_en: data.verificadoEn || null,
  };
}

async function obtenerSmtpDefaultCacheado() {
  if (cache && Date.now() - cache.resueltoEn < CACHE_TTL_MS) {
    return cache.valor;
  }
  let valor = null;
  try {
    valor = await consultarControl();
  } catch (err) {
    valor = cache ? cache.valor : null;
  }
  cache = { valor, resueltoEn: Date.now() };
  return valor;
}

module.exports = { obtenerSmtpDefaultCacheado };
