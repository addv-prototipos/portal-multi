const crypto = require('crypto');
const { requiereFeature } = require('./requiereFeature');

// Clave con la que se firman los tokens de sesión de los usuarios del
// portal (RFC + contraseña). Es independiente de las credenciales de
// administrador (ADMIN_USERS). En producción, define SESSION_SECRET con un
// valor propio y secreto; si no se define, se genera uno aleatorio al
// arrancar — funciona, pero invalida las sesiones activas cada vez que el
// contenedor se reinicia, así que para producción sí conviene fijarlo.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas
const COOKIE_NOMBRE = 'sesion_usuario';

// ---------- Contraseñas ----------
// Se usa scrypt (integrado en Node, sin dependencias nuevas) en vez de
// bcrypt, para no reintroducir un paquete con compilación nativa como la
// que se quitó al migrar de SQLite a MySQL.

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, almacenado) {
  if (!almacenado || !almacenado.includes(':')) return false;
  const [salt, hashGuardado] = almacenado.split(':');
  try {
    const hashCalculado = crypto.scryptSync(password, salt, 64).toString('hex');
    const bufGuardado = Buffer.from(hashGuardado, 'hex');
    const bufCalculado = Buffer.from(hashCalculado, 'hex');
    if (bufGuardado.length !== bufCalculado.length) return false;
    return crypto.timingSafeEqual(bufGuardado, bufCalculado);
  } catch (e) {
    return false;
  }
}

// Reglas: al menos 8 caracteres, al menos un número, al menos una letra
// minúscula y al menos una letra mayúscula.
function validarPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un número.';
  }
  if (!/[a-z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra minúscula.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.';
  }
  return null;
}

// ---------- Tokens de recuperación de contraseña ----------
// De un solo uso: el valor que viaja en el link del correo (32 bytes de
// entropía, imposible de adivinar) NUNCA se guarda tal cual en la base de
// datos — se guarda su hash (sha256, aquí NO hace falta scrypt: no es una
// contraseña de humano con entropía baja que haya que proteger de fuerza
// bruta offline, ya trae 256 bits de aleatoriedad real). Comparar
// `hashTokenRecuperacion(token)` contra la columna es suficiente y barato
// de verificar en cada intento sin abrir una ventana de fuerza bruta útil.
function generarTokenRecuperacion() {
  return crypto.randomBytes(32).toString('hex');
}

function hashTokenRecuperacion(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ---------- Tokens de sesión ----------
// Token firmado con HMAC-SHA256, sin estado en el servidor (no requiere
// tabla de sesiones ni limpieza periódica). Formato: base64url(payload) +
// "." + firma. El payload incluye el RFC, el tenant ("tid") y la fecha de
// expiración.
//
// Multi-tenant (segmento 3 del plan, ver PROJECT_STATE.md): cuando hay un
// tenant resuelto (`req.tenant`, puesto por
// `backend/utils/tenantContext.js`), el token se firma con una CLAVE
// DERIVADA de ese tenant en vez del secreto maestro directamente — un
// token firmado para "cliente1" falla la verificación de FIRMA contra
// "cliente2" (no solo el chequeo del campo `tid`), porque las claves ya
// son distintas. Sin tenant resuelto (todo el tráfico real hoy, hasta que
// nginx empiece a mandar el header de tenant en un segmento posterior),
// se firma con el secreto maestro tal cual — comportamiento IDÉNTICO al
// de antes de este cambio.
function claveParaTenant(tenantSlug) {
  if (!tenantSlug) return Buffer.from(SESSION_SECRET, 'utf8');
  const derivada = crypto.hkdfSync('sha256', SESSION_SECRET, '', tenantSlug, 32);
  return Buffer.from(derivada);
}

function firmar(texto, tenantSlug) {
  return crypto.createHmac('sha256', claveParaTenant(tenantSlug)).update(texto).digest('base64url');
}

function crearTokenSesion(rfc, tenantSlug = null) {
  const payload = JSON.stringify({ rfc, tid: tenantSlug, exp: Date.now() + SESSION_DURACION_MS });
  const payloadCodificado = Buffer.from(payload, 'utf8').toString('base64url');
  const firma = firmar(payloadCodificado, tenantSlug);
  return `${payloadCodificado}.${firma}`;
}

function verificarTokenSesion(token, tenantSlugEsperado = null) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadCodificado, firma] = token.split('.');
  if (!payloadCodificado || !firma) return null;

  const firmaEsperada = firmar(payloadCodificado, tenantSlugEsperado);
  const bufFirma = Buffer.from(firma);
  const bufEsperada = Buffer.from(firmaEsperada);
  if (bufFirma.length !== bufEsperada.length || !crypto.timingSafeEqual(bufFirma, bufEsperada)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadCodificado, 'base64url').toString('utf8'));
    if (!payload.rfc || !payload.exp || payload.exp < Date.now()) return null;
    // Defensa en profundidad: aunque una firma válida ya implica que el
    // token se creó con la clave de ESTE tenant (o, sin tenant, con el
    // secreto maestro), se confirma también el campo `tid` explícitamente
    // — nunca depender de un solo mecanismo para algo tan sensible como
    // el aislamiento entre clientes.
    if ((payload.tid || null) !== (tenantSlugEsperado || null)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Candado de "portal de clientes" (ver PROJECT_STATE.md — gobierno de
// funcionalidades por tenant desde /control): requireUserAuth es el único
// chokepoint por el que pasan TODAS las rutas de sesión de cliente, así
// que componerlo aquí una sola vez cubre el portal entero de un jalón —
// no hace falta repetirlo ruta por ruta. Responde 404 (no 403) antes de
// siquiera leer la cookie de sesión.
const candadoPortalClientes = requiereFeature('portalClientesHabilitado');

// Middleware: exige una sesión de usuario válida (cookie httpOnly) y
// expone el RFC autenticado en req.userRfc. No debe confundirse con
// requireAdminAuth (Basic Auth, para /admin) — son sistemas separados.
function requireUserAuth(req, res, next) {
  candadoPortalClientes(req, res, () => {
    const token = req.cookies ? req.cookies[COOKIE_NOMBRE] : null;
    const tenantSlug = req.tenant ? req.tenant.slug : null;
    const payload = verificarTokenSesion(token, tenantSlug);
    if (!payload) {
      return res.status(401).json({ error: 'Tu sesión no es válida o expiró. Inicia sesión de nuevo.' });
    }
    req.userRfc = payload.rfc;
    next();
  });
}

// A diferencia de requireUserAuth, esta función NO rechaza la petición si
// no hay sesión — solo informa el RFC si existe una válida, o null si no.
// Pensada para rutas públicas que funcionan tanto con sesión (ej. un
// cliente ya logueado subiendo su constancia desde csf.html) como sin
// ella (acceso público/anónimo), donde la sesión es informativa, no un
// requisito para usar la ruta.
function obtenerRfcSesionOpcional(req) {
  const token = req.cookies ? req.cookies[COOKIE_NOMBRE] : null;
  const tenantSlug = req.tenant ? req.tenant.slug : null;
  const payload = verificarTokenSesion(token, tenantSlug);
  return payload ? payload.rfc : null;
}

// `tenantSlug`: cuando hay un tenant resuelto, la cookie se acota con
// `path: '/<slug>'` — el navegador ni siquiera ADJUNTA esta cookie en
// peticiones a `/otro-slug/...` (defensa adicional, a nivel de navegador,
// además de la clave de firma distinta por tenant de `crearTokenSesion`).
// Sin tenant (todo el tráfico real hoy), `path: '/'` — comportamiento
// idéntico al de antes de este cambio.
function establecerCookieSesion(res, rfc, tenantSlug = null) {
  const token = crearTokenSesion(rfc, tenantSlug);
  res.cookie(COOKIE_NOMBRE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Hallazgo M-18 (sonar_1.1.html, 2026-10-19): con la configuración
    // previa (secure: COOKIE_SECURE === 'true'), un backend que arranca
    // con NODE_ENV=production y SIN definir COOKIE_SECURE enviaba la
    // cookie de sesión por HTTP plano, en silencio — la app creía estar
    // en producción (y disparaba todos los fail-closed de C-02/M-15) pero
    // la cookie no. Fail-closed real: en producción, `secure` es `true`
    // SIEMPRE — verificarAbortarSiCookieInsegura() aborta el arranque si
    // se pide explícitamente COOKIE_SECURE=false en producción, mismo
    // criterio que C-02/M-15 (ningún valor conocido-inseguro corre en
    // prod ni por silencio ni por configuración explícita). Fuera de
    // producción (desarrollo/LAN por HTTP, docker-compose.yml local) se
    // conserva el comportamiento de siempre: opt-in explícito con
    // COOKIE_SECURE=true, default false.
    secure: process.env.NODE_ENV === 'production' ? true : process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_DURACION_MS,
    path: tenantSlug ? `/${tenantSlug}` : '/',
  });
}

// M-18: se corre al cargar el módulo (mismo momento que loadAdminUsers()
// en auth.js para C-02) — aborta el arranque ANTES de levantar el
// servidor, nunca en silencio al primer login. Pedir explícitamente
// COOKIE_SECURE=false con NODE_ENV=production es exactamente el estado
// que este hallazgo describe (la app se cree en producción y manda la
// sesión por HTTP plano) — se rechaza sin excepción, incluido el propio
// docker-compose.yml de desarrollo de este repo si algún día se usa así
// contra un dominio real.
function verificarAbortarSiCookieInsegura() {
  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'false') {
    throw new Error(
      'COOKIE_SECURE=false con NODE_ENV=production. Fail-closed a propósito (hallazgo M-18): ' +
      'la cookie de sesión nunca debe viajar por HTTP plano en producción. ' +
      'Quita COOKIE_SECURE del entorno (o ponlo en "true") si el sitio ya se sirve por HTTPS real; ' +
      'si necesitas NODE_ENV=production sin HTTPS (solo pruebas locales/LAN), usa NODE_ENV=development.'
    );
  }
}
verificarAbortarSiCookieInsegura();

// El `path` debe coincidir EXACTAMENTE con el usado al establecer la
// cookie (`establecerCookieSesion`) — un navegador solo borra una cookie
// cuyo path declarado coincide con el que ya tiene guardado.
function limpiarCookieSesion(res, tenantSlug = null) {
  res.clearCookie(COOKIE_NOMBRE, { path: tenantSlug ? `/${tenantSlug}` : '/' });
}

module.exports = {
  hashPassword,
  verifyPassword,
  validarPassword,
  generarTokenRecuperacion,
  hashTokenRecuperacion,
  crearTokenSesion,
  verificarTokenSesion,
  requireUserAuth,
  obtenerRfcSesionOpcional,
  establecerCookieSesion,
  limpiarCookieSesion,
};
