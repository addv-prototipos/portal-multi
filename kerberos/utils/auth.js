const crypto = require('crypto');

// Auth de Kerberos (app de monitoreo, independiente de /control) — mismo
// mecanismo EXACTO que control/utils/auth.js (usuario:pass en un .env
// dedicado, Basic Auth + token de sesión Bearer firmado HMAC), nada
// inventado aquí. Diferencia: dos listas, no una.
//   - ADMIN_USERS: la MISMA variable que usa /control — un super admin
//     siempre entra a Kerberos sin ninguna alta adicional (perfil
//     'super', mecanismo 'admin_users').
//   - KERBEROS_USERS: lista EXCLUSIVA de Kerberos, gestionada solo desde
//     /control → Super Admins → "Usuarios Kerberos" (perfil 'kerberos',
//     mecanismo 'kerberos_users') — estas cuentas nunca entran a /control.
// Ambos .env los monta Docker de solo lectura en este contenedor — nunca
// se escriben aquí, solo se recargan en memoria vía /internal/reload-*.

function parsePares(raw, fallbackAdminAdmin) {
  const source = (raw || '').trim() || (fallbackAdminAdmin ? 'admin:admin' : '');
  const users = new Map();
  source.split(',').forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return;
    const idx = trimmed.indexOf(':');
    if (idx === -1) return;
    const user = trimmed.slice(0, idx).trim();
    const pass = trimmed.slice(idx + 1);
    if (user) users.set(user, pass);
  });
  return users;
}

function loadAdminUsers() {
  const raw = process.env.ADMIN_USERS && process.env.ADMIN_USERS.trim();
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_USERS no está definido con NODE_ENV=production. Fail-closed a propósito, mismo criterio que control/utils/auth.js.');
  }
  return parsePares(raw, true);
}

function loadKerberosUsers() {
  const raw = process.env.KERBEROS_USERS && process.env.KERBEROS_USERS.trim();
  return parsePares(raw, false);
}

let adminUsers = loadAdminUsers();
let kerberosUsers = loadKerberosUsers();

function recargarAdminUsers(nuevoValor) {
  if (typeof nuevoValor === 'string') process.env.ADMIN_USERS = nuevoValor;
  adminUsers = loadAdminUsers();
  return adminUsers;
}

function recargarKerberosUsers(nuevoValor) {
  if (typeof nuevoValor === 'string') process.env.KERBEROS_USERS = nuevoValor;
  kerberosUsers = loadKerberosUsers();
  return kerberosUsers;
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Mismo candado anti-enumeración por timing que control/utils/auth.js
// (hallazgo m-05, sonar_1.1.html) — se revisa primero ADMIN_USERS, luego
// KERBEROS_USERS, pero SIEMPRE se ejecuta una comparación de longitud fija
// en cualquier rama para que "no existe en ninguna lista" tarde lo mismo
// que "existe pero contraseña incorrecta".
const DUMMY_PASSWORD = 'x'.repeat(64);

function checkCredentials(username, password) {
  if (adminUsers.has(username)) {
    const ok = timingSafeEqualStrings(String(password), String(adminUsers.get(username)));
    return ok ? { perfil: 'super', mecanismo: 'admin_users' } : null;
  }
  if (kerberosUsers.has(username)) {
    const ok = timingSafeEqualStrings(String(password), String(kerberosUsers.get(username)));
    return ok ? { perfil: 'kerberos', mecanismo: 'kerberos_users' } : null;
  }
  timingSafeEqualStrings(String(password), DUMMY_PASSWORD);
  return null;
}

const SESSION_SECRET_KERBEROS = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DURACION_TOKEN_SESION_MS = 30 * 60 * 1000;

function signToken(payload) {
  const cuerpo = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const firma = crypto.createHmac('sha256', SESSION_SECRET_KERBEROS).update(cuerpo).digest('hex');
  return `${cuerpo}.${firma}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token) return null;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const cuerpo = token.slice(0, idx);
  const firma = token.slice(idx + 1);
  const firmaEsperada = crypto.createHmac('sha256', SESSION_SECRET_KERBEROS).update(cuerpo).digest('hex');
  if (firma.length !== firmaEsperada.length || !timingSafeEqualStrings(firma, firmaEsperada)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
  return payload;
}

function emitirTokenSesion(req, res) {
  const ahora = Date.now();
  const token = signToken({
    usuario: req.kerberosUser,
    perfil: req.kerberosPerfil,
    mecanismo: req.kerberosMecanismo,
    iat: ahora,
    exp: ahora + DURACION_TOKEN_SESION_MS,
  });
  res.set('X-Kerberos-Session-Token', token);
}

function usuarioSigueVigente(usuario, mecanismo) {
  if (mecanismo === 'admin_users') return adminUsers.has(usuario);
  if (mecanismo === 'kerberos_users') return kerberosUsers.has(usuario);
  return false;
}

function requireKerberosAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Bearer' && encoded) {
    const payload = verifyToken(encoded);
    if (!payload || !usuarioSigueVigente(payload.usuario, payload.mecanismo)) {
      res.set('WWW-Authenticate', 'Basic realm="Kerberos"');
      return res.status(401).json({ error: 'Autenticación requerida.' });
    }
    req.kerberosUser = payload.usuario;
    req.kerberosPerfil = payload.perfil;
    req.kerberosMecanismo = payload.mecanismo;
    emitirTokenSesion(req, res);
    return next();
  }

  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="Kerberos"');
    return res.status(401).json({ error: 'Autenticación requerida.' });
  }

  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch (e) {
    return res.status(400).json({ error: 'Credenciales inválidas.' });
  }
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return res.status(400).json({ error: 'Credenciales inválidas.' });
  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  const resultado = checkCredentials(username, password);
  if (resultado) {
    req.kerberosUser = username;
    req.kerberosPerfil = resultado.perfil;
    req.kerberosMecanismo = resultado.mecanismo;
    emitirTokenSesion(req, res);
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Kerberos"');
  return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
}

module.exports = {
  requireKerberosAuth,
  recargarAdminUsers,
  recargarKerberosUsers,
  checkCredentials,
  signToken,
  verifyToken,
};
