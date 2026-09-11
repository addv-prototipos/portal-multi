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

function checkCredentials(username, password) {
  if (!adminUsers.has(username)) return false;
  const expectedPassword = adminUsers.get(username);
  return timingSafeEqualStrings(String(password), String(expectedPassword));
}

function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

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

module.exports = { requireAdminAuth, requireAdminArea, recargarAdminUsers, listarAdminUsers, loadAdminUsers };
