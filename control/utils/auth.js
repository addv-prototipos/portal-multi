const crypto = require('crypto');

// Auth de /control (segmento 9b) — SOLO el mecanismo ADMIN_USERS, a
// diferencia de backend/utils/auth.js que además acepta la cuenta de
// respaldo "admin" y usuarios perfil administrador/fiscal (ambos viven
// en la BD del tenant por defecto, no en control_tenants). Decisión
// explícita del usuario: los super admins de ADDV que entran aquí se
// gestionan SOLO por esta variable de entorno — los usuarios normales de
// cliente/admin de cada empresa se siguen gestionando donde ya se
// gestionan hoy (pantalla "Usuarios" del panel /admin), sin ningún
// cambio ahí. Esto también es lo que permite que este servicio tenga una
// credencial de MySQL angosta (solo control_tenants, ver
// backend/scripts/lib/controlDb.js) sin perder ningún mecanismo de
// login: ADMIN_USERS no toca base de datos en absoluto.
//
// Formato: "usuario1:contrasena1,usuario2:contrasena2" — mismo formato
// que backend/utils/auth.js, deliberadamente compatible (se espera que
// ambos contenedores compartan el mismo valor de ADMIN_USERS).
function loadAdminUsers() {
  const raw = process.env.ADMIN_USERS && process.env.ADMIN_USERS.trim();
  // C-02: este chequeo tiene que vivir ANTES del fallback de abajo — si
  // `source` ya cae a 'admin:admin' aquí, el chequeo de `users.size === 0`
  // más abajo nunca se dispara (el fallback ya dejó 1 usuario), así que
  // ADMIN_USERS vacío/ausente nunca llegaría a tronar en producción.
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error(
      'ADMIN_USERS no está definido con NODE_ENV=production. ' +
      'Fail-closed a propósito (hallazgo C-02): admin:admin nunca debe correr en producción — y aquí protege además las 44 rutas cross-tenant de /control.'
    );
  }
  const source = raw || 'admin:admin';

  const users = new Map();
  source.split(',').forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) return;
    const user = trimmed.slice(0, separatorIndex).trim();
    const pass = trimmed.slice(separatorIndex + 1);
    if (user) users.set(user, pass);
  });

  if (users.size === 0) {
    // Hallazgo C-02 (sonar.html): fail-closed solo en producción — en
    // dev/test admin:admin se conserva tal cual (login de pruebas local
    // de siempre, mismo criterio que backend/utils/auth.js).
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ADMIN_USERS no está definido (o no parsea ningún usuario válido) con NODE_ENV=production. ' +
        'Fail-closed a propósito (hallazgo C-02): admin:admin nunca debe correr en producción — y aquí protege además las 44 rutas cross-tenant de /control.'
      );
    }
    users.set('admin', 'admin');
  }
  return users;
}

let adminUsers = loadAdminUsers();

function recargarAdminUsers(nuevoValor) {
  if (typeof nuevoValor === 'string') {
    process.env.ADMIN_USERS = nuevoValor;
  }
  adminUsers = loadAdminUsers();
  return adminUsers;
}

function listarAdminUsers() {
  return Array.from(adminUsers.keys()).sort();
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

// Hallazgo m-05 (sonar_1.1.html, 2026-10-19): el corte temprano por
// "usuario no existe" (antes de llegar al timingSafeEqualStrings de
// abajo) permitía enumerar usuarios válidos por timing — un intento
// contra un usuario real tarda lo mismo que uno inexistente SOLO si
// ambos casos ejecutan la misma comparación. DUMMY_PASSWORD como
// password "esperado" cuando el usuario no existe, para que la rama
// exista/no-exista siempre pague el mismo costo; el AND final con
// `existe` es barato y no vuelve a introducir una rama de timing
// significativa (mismo criterio ya aceptado para el caso de longitudes
// distintas dentro de timingSafeEqualStrings).
const DUMMY_PASSWORD = 'x'.repeat(64);

function checkCredentials(username, password) {
  const existe = adminUsers.has(username);
  const expectedPassword = existe ? adminUsers.get(username) : DUMMY_PASSWORD;
  const coincide = timingSafeEqualStrings(String(password), String(expectedPassword));
  return existe && coincide;
}

// Hallazgo M-02 (sonar.html, 2026-10-14): mismo fix que
// backend/utils/auth.js — control.js guardaba la contraseña real del
// super-admin en sessionStorage (btoa, reversible en 1 línea). Token
// de sesión opaco firmado (HMAC-SHA256) como alternativa ADITIVA a
// Basic Auth (que sigue funcionando igual para scripts/curl/Swagger).
// Más simple que el de backend/: control solo tiene el mecanismo
// ADMIN_USERS (sin tabla de usuarios propia, sin concepto de tenant),
// así que no hace falta el candado cross-tenant ni la rama perfil_bd.
// Mismo criterio ya confirmado por el usuario: 30 min, deslizante,
// re-chequeo instantáneo contra ADMIN_USERS en cada request.
const SESSION_SECRET_ADMIN = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DURACION_TOKEN_SESION_MS = 30 * 60 * 1000;

function signAdminToken(payload) {
  const cuerpo = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const firma = crypto.createHmac('sha256', SESSION_SECRET_ADMIN).update(cuerpo).digest('hex');
  return `${cuerpo}.${firma}`;
}

function verifyAdminToken(token) {
  if (typeof token !== 'string' || !token) return null;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const cuerpo = token.slice(0, idx);
  const firma = token.slice(idx + 1);
  const firmaEsperada = crypto.createHmac('sha256', SESSION_SECRET_ADMIN).update(cuerpo).digest('hex');
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
  const token = signAdminToken({
    usuario: req.adminUser,
    perfil: req.adminPerfil,
    mecanismo: req.adminMecanismo,
    iat: ahora,
    exp: ahora + DURACION_TOKEN_SESION_MS,
  });
  res.set('X-Admin-Session-Token', token);
}

function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  // M-02: Bearer (token de sesión) — único mecanismo aquí es
  // admin_users, re-chequeado contra el mapa VIGENTE en cada request
  // (revocación instantánea si cambia vía recargarAdminUsers()).
  if (scheme === 'Bearer' && encoded) {
    const payload = verifyAdminToken(encoded);
    if (!payload || payload.mecanismo !== 'admin_users' || !adminUsers.has(payload.usuario)) {
      res.set('WWW-Authenticate', 'Basic realm="Control"');
      return res.status(401).json({ error: 'Autenticacion requerida.' });
    }
    req.adminUser = payload.usuario;
    req.adminPerfil = 'super';
    req.adminMecanismo = 'admin_users';
    emitirTokenSesion(req, res);
    return next();
  }

  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="Control"');
    return res.status(401).json({ error: 'Autenticacion requerida.' });
  }

  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch (e) {
    return res.status(400).json({ error: 'Credenciales invalidas.' });
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return res.status(400).json({ error: 'Credenciales invalidas.' });
  }
  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (checkCredentials(username, password)) {
    req.adminUser = username;
    req.adminPerfil = 'super';
    req.adminMecanismo = 'admin_users';
    emitirTokenSesion(req, res);
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Control"');
  return res.status(401).json({ error: 'Usuario o contrasena incorrectos.' });
}

// Se mantiene por consistencia con backend/utils/auth.js y como defensa
// en profundidad: hoy el único mecanismo (ADMIN_USERS) siempre pone
// adminPerfil='super', así que este gate nunca rechaza a nadie que ya
// pasó requireAdminAuth — pero si algún día se agrega un segundo
// mecanismo con otro perfil, el gate ya está aquí sin tener que
// recordarlo.
function requireAdminArea(...perfilesPermitidos) {
  return function (req, res, next) {
    if (req.adminPerfil === 'super' || perfilesPermitidos.includes(req.adminPerfil)) {
      return next();
    }
    return res.status(403).json({ error: 'Tu perfil no tiene acceso a esta sección.' });
  };
}

module.exports = {
  requireAdminAuth,
  requireAdminArea,
  recargarAdminUsers,
  listarAdminUsers,
  loadAdminUsers,
  checkCredentials,
  signAdminToken,
  verifyAdminToken,
};
