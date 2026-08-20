const crypto = require('crypto');
const { pool } = require('../db');
const { verifyPassword, hashPassword } = require('./authUsuario');

// Hash de relleno para cuando el usuario/RFC administrativo no existe
// (Seguridad, ver auditoría OWASP) — mismo motivo y mismo patrón que
// HASH_RELLENO_LOGIN en server.js (login de cliente): sin esto,
// `if (!fila) return null;` hace corto-circuito antes de llamar a
// verifyPassword (scrypt, el paso costoso), lo que deja una diferencia de
// tiempo medible entre "ese usuario administrativo no existe" y "existe,
// contraseña incorrecta" que permitiría enumerar cuentas administrador/
// fiscal por temporización.
const HASH_RELLENO_ADMIN = hashPassword(crypto.randomBytes(32).toString('hex'));

/**
 * Lee las credenciales de administrador desde la variable de entorno ADMIN_USERS.
 * Formato: "usuario1:contrasena1,usuario2:contrasena2"
 * Si no se define, usa admin/admin por defecto.
 *
 * Para cambiar la contraseña o agregar administradores, edita ADMIN_USERS
 * en docker-compose.yml o en el archivo .env — no requiere tocar código.
 *
 * Este mecanismo se conserva TAL CUAL (sin cambios) por instrucción
 * explícita: sigue siendo el archivo/variable de configuración de
 * administradores. Lo que se agregó es ADICIONAL, no un reemplazo — ver
 * requireAdminAuth() más abajo para los otros dos mecanismos.
 */
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

const adminUsers = loadAdminUsers();

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compara igual contra si mismo para mantener un tiempo constante,
    // evitando filtrar la longitud esperada mediante temporizacion.
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

// ---------- Cuenta de respaldo "admin" (guardada en MySQL) ----------
// Es la ÚNICA cuenta de administrador cuya contraseña vive fuera de
// ADMIN_USERS — sirve como medida de seguridad ("break glass") para no
// quedar fuera del panel si se pierde acceso al archivo/variable de
// entorno o se olvida esa contraseña. Se siembra con "admin" la primera
// vez que arranca el backend (ver ensureSchema() en db.js) y se puede
// cambiar desde la interfaz gráfica (PUT /api/admin/config/admin-password
// en server.js). Esta regla es EXCLUSIVA del usuario "admin" — cualquier
// otro administrador (perfil "administrador"/"fiscal" en la tabla
// usuarios, creados desde el panel) no tiene este respaldo.
async function verificarCuentaRespaldoAdmin(password) {
  const [filas] = await pool.query(
    "SELECT valor FROM configuracion WHERE clave = 'admin_fallback_password_hash'"
  );
  if (filas.length === 0) return false;
  return verifyPassword(password, filas[0].valor);
}

// ---------- Usuarios con perfil administrador/fiscal ----------
// A diferencia de los clientes (perfil "cliente", que solo pueden entrar
// al portal de usuario con cookie de sesión), estos perfiles pueden
// autenticarse con Basic Auth para entrar al panel de administración,
// usando su RFC (o el nombre de usuario que se le haya asignado) como
// "usuario" y su contraseña normal. Si alguno olvida su contraseña, no
// tiene ningún respaldo especial: cualquier administrador se la puede
// restablecer desde la vista "Usuarios" del panel, igual que a un cliente.
async function verificarUsuarioAdministrativo(usuario, password) {
  const [filas] = await pool.query(
    "SELECT rfc, password_hash, perfil FROM usuarios WHERE rfc = ? AND perfil IN ('administrador', 'fiscal')",
    [usuario]
  );
  const fila = filas[0];
  // verifyPassword() SIEMPRE se llama (con el hash real o con el de
  // relleno) para que el tiempo de respuesta no delate por sí solo si el
  // usuario existe — ver HASH_RELLENO_ADMIN arriba.
  const passwordValida = verifyPassword(password, fila ? fila.password_hash : HASH_RELLENO_ADMIN);
  if (!fila || !passwordValida) return null;
  return fila;
}

/**
 * Middleware de autenticacion HTTP Basic para las rutas /api/admin/*.
 * Acepta credenciales de CUALQUIERA de estos tres mecanismos:
 *   1. ADMIN_USERS (variable de entorno, sin cambios respecto a antes).
 *   2. La cuenta de respaldo "admin" guardada en MySQL.
 *   3. Un usuario con perfil "administrador" o "fiscal" en la tabla usuarios.
 */
async function requireAdminAuth(req, res, next) {
  // Multi-tenant (segmento 3 del plan): con dominio único compartido entre
  // tenants, los navegadores cachean credenciales Basic por origin+realm,
  // no por path — si el realm fuera siempre el mismo texto, el navegador
  // podría reintentar en silencio credenciales de "cliente1" contra
  // "/cliente2/admin". Incluir el slug en el realm evita ese cruce. Sin
  // tenant resuelto (todo el tráfico real hoy), el realm es el de
  // siempre, sin cambios.
  const realm = req.tenant ? `Administracion-${req.tenant.slug}` : 'Administracion';

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', `Basic realm="${realm}"`);
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

  // 1. ADMIN_USERS (mecanismo original, sin cambios en la autenticación
  // en sí) — se le asigna el perfil "super": no es parte del sistema de
  // perfiles granular (administrador/fiscal) que se creó después, así
  // que restringirlo de la misma forma rompería el mecanismo original
  // de acceso para cualquier despliegue que ya dependa de él. Acceso
  // total, sin restricciones de vistas ni de tarjetas en el panel.
  if (checkCredentials(username, password)) {
    req.adminUser = username;
    req.adminPerfil = 'super';
    req.adminMecanismo = 'admin_users';
    return next();
  }

  // 2. Cuenta de respaldo "admin" (solo aplica a ese nombre de usuario exacto)
  // — también "super": es justamente la cuenta de "no quedarse fuera del
  // panel", así que no tendría sentido que ADEMÁS estuviera restringida
  // por perfil.
  if (username === 'admin') {
    try {
      if (await verificarCuentaRespaldoAdmin(password)) {
        req.adminUser = 'admin';
        req.adminPerfil = 'super';
        req.adminMecanismo = 'fallback_admin';
        return next();
      }
    } catch (err) {
      console.error('Error verificando la cuenta de respaldo "admin":', err);
    }
  }

  // 3. Usuarios administrativos (perfil administrador/fiscal) creados desde el panel
  try {
    const usuarioAdmin = await verificarUsuarioAdministrativo(username, password);
    if (usuarioAdmin) {
      req.adminUser = usuarioAdmin.rfc;
      req.adminPerfil = usuarioAdmin.perfil;
      req.adminMecanismo = 'perfil_bd';
      return next();
    }
  } catch (err) {
    console.error('Error verificando usuario administrativo:', err);
  }

  res.set('WWW-Authenticate', `Basic realm="${realm}"`);
  return res.status(401).json({ error: 'Usuario o contrasena incorrectos.' });
}

// ---------- Autorización por área (segunda capa, además de requireAdminAuth) ----------
// requireAdminAuth() solo confirma "esta sesión es válida" — QUIÉN es,
// no qué le corresponde ver. Este middleware es la segunda capa: dado
// un área del panel, confirma que el perfil de la sesión (req.adminPerfil,
// ya puesto por requireAdminAuth) tenga permiso sobre ESA área en
// particular, replicando en el backend la misma restricción que
// admin.js ya aplica visualmente (ocultando botones y tarjetas) — para
// que ocultar el botón en la interfaz no sea la única barrera real.
// "super" (la cuenta de respaldo "admin" y las cuentas de ADMIN_USERS)
// pasa siempre, sin importar qué áreas se le pidan — mismo criterio que
// ya usa el mapa de restricciones del frontend.
//
// SIEMPRE se usa DESPUÉS de requireAdminAuth en la cadena de middlewares
// de una ruta (ej. `requireAdminAuth, requireAdminArea('tickets'), ...`),
// nunca solo: no vuelve a autenticar, solo autoriza sobre una sesión que
// ya se confirmó válida.
function requireAdminArea(...perfilesPermitidos) {
  return function (req, res, next) {
    if (req.adminPerfil === 'super' || perfilesPermitidos.includes(req.adminPerfil)) {
      return next();
    }
    return res.status(403).json({ error: 'Tu perfil no tiene acceso a esta sección.' });
  };
}

// Para las dos rutas de "Cuenta de respaldo admin" — ni siquiera un
// perfil "super" que entró por ADMIN_USERS con otro nombre debe poder
// leer o cambiar la contraseña de la cuenta "admin" en sí; mismo
// criterio que ya aplica el frontend para mostrar esa tarjeta.
function requireUsuarioAdminExacto(req, res, next) {
  if (req.adminUser === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Solo el usuario "admin" puede acceder a esto.' });
}

module.exports = { requireAdminAuth, requireAdminArea, requireUsuarioAdminExacto };
