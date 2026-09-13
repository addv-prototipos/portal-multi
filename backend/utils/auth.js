const crypto = require('crypto');
const { pool, obtenerPoolControl } = require('../db');
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

let adminUsers = loadAdminUsers();

function recargarAdminUsers(nuevoValor) {
  if (typeof nuevoValor === 'string') {
    process.env.ADMIN_USERS = nuevoValor;
  }
  adminUsers = loadAdminUsers();
  return adminUsers;
}

function listarAdminUsers() {
  return Array.from(adminUsers.entries()).map(([usuario]) => usuario);
}

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

// ---------- Credencial API por empresa (para uso en Swagger y consumo directo) ----------
// Cada empresa puede tener una credencial dedicada (api_usuario / password)
// gestionada desde /control (tabla control_tenants.api_credenciales).
// Solo es válida para EL tenant que indica req.tenant (slug de la URL
// /<slug>/api/* o header X-Tenant-Slug). No es global: sin tenant no se
// verifica. Hash con scrypt igual que usuarios.
function hashApiPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}
function verifyApiPassword(password, hash) {
  if (!hash || !hash.includes(':')) return false;
  const [salt, expected] = hash.split(':');
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}
async function verificarCredencialApi(usuario, password, tenantSlug) {
  if (!tenantSlug) return null;
  try {
    const poolControl = obtenerPoolControl();
    const [filas] = await poolControl.query(
      'SELECT api_usuario, password_hash, tenant_slug FROM api_credenciales WHERE api_usuario = ? AND tenant_slug = ? AND activo = 1 LIMIT 1',
      [usuario, tenantSlug]
    );
    const fila = filas[0];
    // timing-safe: siempre se paga el costo de scrypt, exista o no la fila
    // (mismo patrón que verificarClaveApi/verificarUsuarioSucursal/
    // verificarUsuarioAdministrativo en este archivo) — un corto-circuito
    // antes de verifyApiPassword() dejaría una diferencia de tiempo medible
    // que permitiría enumerar qué api_usuario existen por tenant.
    const passwordValida = verifyApiPassword(password, fila ? fila.password_hash : HASH_RELLENO_ADMIN);
    if (!fila || !passwordValida) return null;
    return { api_usuario: fila.api_usuario, tenant_slug: fila.tenant_slug };
  } catch (err) {
    console.error('Error verificando credencial API:', err.message);
    return null;
  }
}

async function verificarClaveApi(apiKey, tenantSlug) {
  if (!tenantSlug || !apiKey) return null;
  try {
    const poolControl = obtenerPoolControl();
    const [filas] = await poolControl.query(
      'SELECT api_usuario, api_key_hash, tenant_slug FROM api_credenciales WHERE tenant_slug = ? AND activo = 1 LIMIT 10',
      [tenantSlug]
    );
    for (const fila of filas) {
      if (!fila.api_key_hash) continue;
      if (verifyApiPassword(apiKey, fila.api_key_hash)) {
        return { api_usuario: fila.api_usuario, tenant_slug: fila.tenant_slug };
      }
    }
    // dummy timingSafe para no filtrar existencia
    verifyApiPassword(apiKey, HASH_RELLENO_ADMIN);
    return null;
  } catch (err) {
    console.error('Error verificando clave API:', err.message);
    return null;
  }
}

// §58: usuario de sucursal compartido — dado de alta en /control para un
// GRUPO de tenants asociados, válido en CUALQUIERA de ellos sin
// credenciales nuevas. La credencial vive SOLO en la BD de control
// (tabla usuarios_sucursal, gestionada por /control); se verifica en vivo
// contra esa misma tabla usando la conexión que este proceso YA mantiene
// abierta para resolver cualquier tenant por slug (obtenerPoolControl())
// — decisión cerrada: ni fan-out ni endpoint interno nuevo, una sola
// fuente de verdad. `verifyApiPassword` es compatible byte a byte con el
// hash que genera control/utils/apiCredenciales.js:hashPasswordApi()
// (mismo formato salt:hash de scrypt).
async function verificarUsuarioSucursal(usuario, password, grupoSucursalId) {
  if (!grupoSucursalId) return null;
  try {
    const poolControl = obtenerPoolControl();
    const [filas] = await poolControl.query(
      'SELECT usuario, password_hash, perfil FROM usuarios_sucursal WHERE grupo_sucursal_id = ? AND usuario = ? AND activo = 1 LIMIT 1',
      [grupoSucursalId, usuario]
    );
    const fila = filas[0];
    // verifyApiPassword() SIEMPRE se llama (con el hash real o con el de
    // relleno) para no filtrar por temporización si el usuario de
    // sucursal existe — mismo criterio que verificarUsuarioAdministrativo.
    const passwordValida = verifyApiPassword(password, fila ? fila.password_hash : HASH_RELLENO_ADMIN);
    if (!fila || !passwordValida) return null;
    return { usuario: fila.usuario, perfil: fila.perfil };
  } catch (err) {
    console.error('Error verificando usuario de sucursal:', err.message);
    return null;
  }
}

// ---------- Usuarios con perfil administrador/fiscal/ventas ----------
// A diferencia de los clientes (perfil "cliente", que solo pueden entrar
// al portal de usuario con cookie de sesión), estos perfiles pueden
// autenticarse con Basic Auth para entrar al panel de administración,
// usando su RFC (o el nombre de usuario que se le haya asignado) como
// "usuario" y su contraseña normal. Si alguno olvida su contraseña, no
// tiene ningún respaldo especial: cualquier administrador se la puede
// restablecer desde la vista "Usuarios" del panel, igual que a un cliente.
async function verificarUsuarioAdministrativo(usuario, password) {
  const [filas] = await pool.query(
    "SELECT rfc, password_hash, perfil, activo FROM usuarios WHERE rfc = ? AND perfil IN ('administrador', 'fiscal', 'ventas')",
    [usuario]
  );
  const fila = filas[0];
  // verifyPassword() SIEMPRE se llama (con el hash real o con el de
  // relleno) para que el tiempo de respuesta no delate por sí solo si el
  // usuario existe — ver HASH_RELLENO_ADMIN arriba.
  const passwordValida = verifyPassword(password, fila ? fila.password_hash : HASH_RELLENO_ADMIN);
  if (!fila || !passwordValida) return null;
  // La contraseña ya es correcta en este punto — recién aquí es seguro
  // distinguir "suspendida" de "no existe/contraseña mala" sin ayudar a
  // enumerar cuentas con solo probar usuarios al azar. Comparación
  // explícita contra 0/false (no un simple !fila.activo): una fila real de
  // MySQL siempre trae la columna (DEFAULT 1, NOT NULL), pero así no se
  // rompe si algún día una consulta la omite por accidente.
  if (fila.activo === 0 || fila.activo === false) return { suspendido: true };
  return fila;
}

/**
 * Middleware de autenticacion HTTP Basic para las rutas /api/admin/*.
 * Acepta credenciales de CUALQUIERA de estos dos mecanismos:
 *   1. ADMIN_USERS (variable de entorno, sin cambios respecto a antes).
 *   2. Un usuario con perfil "administrador", "fiscal" o "ventas" en la tabla usuarios.
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

  // 0. Clave API por empresa (SOLO header X-API-Key) — autoriza uso de las APIs como esta clave API por empresa.
  // Se verifica ANTES de exigir Basic, para que `curl -H "X-API-Key: ..."` no necesite también Basic.
  // Auditoría 2026-09-03 (retest del hallazgo #4): esta rama también leía
  // `req.cookies.api_key` como alternativa al header — se quitó de aquí
  // también (el primer intento solo lo había quitado de la rama "4b" más
  // abajo, dejando este camino vivo, mismo riesgo de CSRF que se creía
  // cerrado).
  if (req.tenant && req.tenant.slug) {
    const claveApiPrevia = req.get ? req.get('X-API-Key') : (req.headers['x-api-key'] || req.headers['X-API-Key']);
    if (claveApiPrevia) {
      try {
        const credClave = await verificarClaveApi(String(claveApiPrevia), req.tenant.slug);
        if (credClave) {
          req.adminUser = credClave.api_usuario;
          req.adminPerfil = 'super';
          req.adminMecanismo = 'api_clave';
          return next();
        }
      } catch (err) {
        console.error('Error verificando clave API (pre-Basic):', err.message);
      }
    }
  }

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

  // 2. Usuarios administrativos (perfil administrador/fiscal) creados desde el panel
  try {
    const usuarioAdmin = await verificarUsuarioAdministrativo(username, password);
    if (usuarioAdmin && usuarioAdmin.suspendido) {
      return res.status(403).json({ error: 'Tu cuenta está suspendida. Contacta a un administrador.' });
    }
    if (usuarioAdmin) {
      req.adminUser = usuarioAdmin.rfc;
      req.adminPerfil = usuarioAdmin.perfil;
      req.adminMecanismo = 'perfil_bd';
      return next();
    }
  } catch (err) {
    console.error('Error verificando usuario administrativo:', err.message);
  }

  // 3. Credencial API por empresa (para Swagger/consumo programático) — solo si hay tenant resuelto
  if (req.tenant && req.tenant.slug) {
    try {
      const credApi = await verificarCredencialApi(username, password, req.tenant.slug);
      if (credApi) {
        req.adminUser = credApi.api_usuario;
        // 'super' para que tenga acceso total al tenant (como ADMIN_USERS pero acotado al slug)
        req.adminPerfil = 'super';
        req.adminMecanismo = 'api_credencial';
        return next();
      }
    } catch (err) {
      console.error('Error verificando credencial API:', err.message);
    }
    // 3b. Clave API vía header X-API-Key — autoriza uso de las APIs como esta
    // clave API por empresa. Ya NO se acepta por cookie (`api_key`): esa
    // cookie nunca la fija el servidor, así que solo llegaba si un operador
    // la guardaba a mano siguiendo la sugerencia vieja de la UI/Swagger —
    // sin SameSite/token CSRF propios, un sitio malicioso podía disparar una
    // petición cross-site que el navegador acompañara con esa cookie. El
    // header no tiene ese problema (el navegador nunca lo adjunta solo).
    const claveApi = req.get ? req.get('X-API-Key') : (req.headers['x-api-key'] || req.headers['X-API-Key']);
    if (claveApi) {
      try {
        const credClave = await verificarClaveApi(String(claveApi), req.tenant.slug);
        if (credClave) {
          req.adminUser = credClave.api_usuario;
          req.adminPerfil = 'super';
          req.adminMecanismo = 'api_clave';
          return next();
        }
      } catch (err) {
        console.error('Error verificando clave API:', err.message);
      }
    }

    // 4. Usuario de sucursal compartido (§58) — solo si el tenant resuelto
    // pertenece a un grupo de sucursales asociadas.
    if (req.tenant.grupoSucursalId) {
      try {
        const usuarioSucursal = await verificarUsuarioSucursal(username, password, req.tenant.grupoSucursalId);
        if (usuarioSucursal) {
          req.adminUser = usuarioSucursal.usuario;
          req.adminPerfil = usuarioSucursal.perfil;
          req.adminMecanismo = 'usuario_sucursal';
          return next();
        }
      } catch (err) {
        console.error('Error verificando usuario de sucursal:', err.message);
      }
    }
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
// "super" (las cuentas de ADMIN_USERS) pasa siempre, sin importar qué
// áreas se le pidan — mismo criterio que ya usa el mapa de restricciones
// del frontend.
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

module.exports = { requireAdminAuth, requireAdminArea, recargarAdminUsers, listarAdminUsers, loadAdminUsers };
