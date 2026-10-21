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

// Hallazgo M-02 (sonar.html, 2026-10-14): admin.js/control.js guardaban
// la contraseña real del operador en sessionStorage (btoa, reversible
// en 1 línea) para reenviarla como Basic Auth en cada request — un XSS
// o una extensión de navegador comprometida la exponía en claro, no un
// token revocable. Se agrega un token de sesión opaco y firmado
// (HMAC-SHA256) como alternativa — ADITIVA, Basic Auth sigue
// funcionando exactamente igual para Swagger/scripts/curl y para los
// mecanismos de API (api_clave/api_credencial), solo admin.js/control.js
// migran a Bearer. Decisión explícita del usuario (2026-10-15): 30 min
// de vida, DESLIZANTE (cada request válido reemite un token fresco vía
// la cabecera X-Admin-Session-Token — ver emitirTokenSesion() más
// abajo) y re-validación INSTANTÁNEA contra la BD/ADMIN_USERS en cada
// request autenticado con Bearer (nunca confía ciegamente en el
// payload firmado para el estado de suspensión — mismo nivel de
// seguridad que Basic Auth, que ya revalida en cada petición).
// Mismo env var que authUsuario.js (SESSION_SECRET) — reusar el nombre
// simplifica la configuración en prod (un solo secreto), pero cada
// módulo calcula su PROPIO fallback aleatorio si falta (dominios de
// firma independientes, nunca se verifican entre sí).
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

// Emite (o renueva) el token de sesión tras CUALQUIER autenticación
// exitosa vía admin_users/perfil_bd — tanto la primera vez (Basic, login
// real con la contraseña recién tecleada) como cada request posterior
// (Bearer, sesión deslizante). La cabecera se manda siempre que haya
// autenticación, nunca solo en /login — admin.js intercepta esta
// cabecera en su wrapper global de fetch() (ver comentario "punto 290"
// ahí) y actualiza sessionStorage sin tocar los 200+ call sites.
function emitirTokenSesion(req, res) {
  const ahora = Date.now();
  const token = signAdminToken({
    usuario: req.adminUser,
    perfil: req.adminPerfil,
    mecanismo: req.adminMecanismo,
    tenantSlug: req.tenant ? req.tenant.slug : null,
    iat: ahora,
    exp: ahora + DURACION_TOKEN_SESION_MS,
  });
  res.set('X-Admin-Session-Token', token);
}

// Lookup SIN verificación de password — solo se usa DESPUÉS de que la
// firma HMAC del token ya probó la identidad; a diferencia de
// verificarUsuarioAdministrativo() (que mezcla lookup+password a
// propósito, por el blindaje de timing contra enumeración de cuentas),
// aquí no hay contraseña que comparar, así que ese blindaje no aplica.
async function obtenerUsuarioAdministrativoPorRfc(rfc) {
  const [filas] = await pool.query(
    "SELECT rfc, perfil, activo, nombre, email, debe_cambiar_password FROM usuarios WHERE rfc = ? AND perfil IN ('administrador', 'fiscal', 'ventas', 'inventario')",
    [rfc]
  );
  return filas[0] || null;
}

/**
 * Lee las credenciales de administrador desde la variable de entorno ADMIN_USERS.
 * Formato: "usuario1:contrasena1,usuario2:contrasena2"
 * Si no se define, usa admin/admin por defecto — SOLO fuera de producción
 * (ver hallazgo C-02, sonar.html: con NODE_ENV=production, no tener
 * ADMIN_USERS aborta el arranque en vez de exponer credenciales públicas
 * conocidas; en dev/test, admin:admin se conserva tal cual, es el login
 * de pruebas local de siempre).
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
  // C-02: este chequeo tiene que vivir ANTES del fallback de abajo — si
  // `source` ya cae a 'admin:admin' aquí, el chequeo de `users.size === 0`
  // más abajo nunca se dispara (el fallback ya dejó 1 usuario), así que
  // ADMIN_USERS vacío/ausente nunca llegaría a tronar en producción.
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error(
      'ADMIN_USERS no está definido con NODE_ENV=production. ' +
      'Fail-closed a propósito (hallazgo C-02): admin:admin nunca debe correr en producción.'
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
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ADMIN_USERS no está definido (o no parsea ningún usuario válido) con NODE_ENV=production. ' +
        'Fail-closed a propósito (hallazgo C-02): admin:admin nunca debe correr en producción.'
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

// Hallazgo m-05 (sonar_1.1.html, 2026-10-19 — mismo patrón encontrado en
// control/utils/auth.js, corregido ahí también): el corte temprano por
// "usuario no existe" permitía enumerar usuarios ADMIN_USERS válidos por
// timing. DUMMY_PASSWORD como password "esperado" cuando el usuario no
// existe, para que exista/no-exista siempre pague el mismo costo.
const DUMMY_PASSWORD = 'x'.repeat(64);

function checkCredentials(username, password) {
  const existe = adminUsers.has(username);
  const expectedPassword = existe ? adminUsers.get(username) : DUMMY_PASSWORD;
  const coincide = timingSafeEqualStrings(String(password), String(expectedPassword));
  return existe && coincide;
}

// ---------- Credencial API por empresa (para uso en Swagger y consumo directo) ----------
// Cada empresa puede tener una credencial dedicada (api_usuario / password)
// gestionada desde /control (tabla control_tenants.api_credenciales).
// Solo es válida para EL tenant que indica req.tenant (slug de la URL
// /<slug>/api/* o header X-Tenant-Slug). No es global: sin tenant no se
// verifica. Hash con scrypt igual que usuarios.
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

// ---------- Usuarios con perfil administrador/fiscal/ventas/inventario ----------
// A diferencia de los clientes (perfil "cliente", que solo pueden entrar
// al portal de usuario con cookie de sesión), estos perfiles pueden
// autenticarse con Basic Auth para entrar al panel de administración,
// usando su RFC (o el nombre de usuario que se le haya asignado) O su
// correo como "usuario" y su contraseña normal — mismo patrón OR ya
// probado en POST /api/auth/login (portal cliente): el valor recibido se
// compara en mayúsculas contra `rfc` y en minúsculas contra `email`,
// nunca mezclado (punto 383, decisión explícita del usuario: "con
// correo o RFC basta, no los dos" — antes el alta ya exigía ambos,
// ahora el username es opcional al crear la cuenta y el login acepta
// cualquiera de los dos que sí se haya capturado). Si alguno olvida su
// contraseña, no tiene ningún respaldo especial: cualquier administrador
// se la puede restablecer desde la vista "Usuarios" del panel, igual que
// a un cliente.
async function verificarUsuarioAdministrativo(usuarioIngresado, password) {
  // "nombre"/"email" viajan junto con la fila de autenticación (mismo
  // query, cero costo extra) para que quien llame a requireAdminAuth
  // pueda identificar a la persona real detrás de la sesión (ej. quién
  // registró una venta, punto 320) sin tener que volver a golpear la
  // tabla — "rfc" aquí es solo el nombre de usuario de login para estos
  // 4 perfiles (nunca un RFC fiscal real, ver server.js:3270), así que
  // nunca debe mostrarse como si fuera la identidad de la persona.
  const [filas] = await pool.query(
    "SELECT rfc, password_hash, perfil, activo, nombre, email, debe_cambiar_password FROM usuarios WHERE (rfc = ? OR email = ?) AND perfil IN ('administrador', 'fiscal', 'ventas', 'inventario')",
    [usuarioIngresado.toUpperCase(), usuarioIngresado.toLowerCase()]
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
 *   2. Un usuario con perfil "administrador", "fiscal", "ventas" o "inventario" en la tabla usuarios.
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

  // Hallazgo M-02: Bearer (token de sesión, ver emitirTokenSesion()
  // arriba) — SOLO para admin_users/perfil_bd, los 2 mecanismos que usa
  // el login de navegador de admin.js/control.js. api_clave/
  // api_credencial/usuario_sucursal (consumo programático, sin sesión de
  // navegador) siguen exclusivamente con Basic, sin cambios.
  if (scheme === 'Bearer' && encoded) {
    const payload = verifyAdminToken(encoded);
    if (!payload) {
      res.set('WWW-Authenticate', `Basic realm="${realm}"`);
      return res.status(401).json({ error: 'Autenticacion requerida.' });
    }
    // Candado cross-tenant: un token emitido bajo el tenant A nunca debe
    // autenticar contra el tenant B, aunque por coincidencia exista un
    // "rfc" igual en ambas bases — Basic Auth lo evita de forma natural
    // (la contraseña solo es válida en SU tenant); el token, al no volver
    // a pedir contraseña, necesita este chequeo explícito.
    const tenantActual = req.tenant ? req.tenant.slug : null;
    if (payload.tenantSlug !== tenantActual) {
      res.set('WWW-Authenticate', `Basic realm="${realm}"`);
      return res.status(401).json({ error: 'Autenticacion requerida.' });
    }
    if (payload.mecanismo === 'admin_users') {
      // Re-chequeo instantáneo: si ADMIN_USERS cambió (recargarAdminUsers,
      // vía /control) y este usuario ya no existe, el token muere aquí
      // mismo sin esperar a que expire — mismo nivel de revocación
      // inmediata que ya tiene Basic Auth.
      if (!adminUsers.has(payload.usuario)) {
        res.set('WWW-Authenticate', `Basic realm="${realm}"`);
        return res.status(401).json({ error: 'Autenticacion requerida.' });
      }
      req.adminUser = payload.usuario;
      req.adminPerfil = 'super';
      req.adminMecanismo = 'admin_users';
      emitirTokenSesion(req, res);
      return next();
    }
    if (payload.mecanismo === 'perfil_bd') {
      try {
        const fila = await obtenerUsuarioAdministrativoPorRfc(payload.usuario);
        if (!fila) {
          res.set('WWW-Authenticate', `Basic realm="${realm}"`);
          return res.status(401).json({ error: 'Autenticacion requerida.' });
        }
        // Re-chequeo instantáneo de suspensión — igual de inmediato que
        // Basic Auth, nunca espera a que expire el token (decisión
        // explícita del usuario, 2026-10-15).
        if (fila.activo === 0 || fila.activo === false) {
          return res.status(403).json({ error: 'Tu cuenta está suspendida. Contacta a un administrador.', codigo: 'CUENTA_SUSPENDIDA' });
        }
        req.adminUser = fila.rfc;
        req.adminPerfil = fila.perfil;
        req.adminMecanismo = 'perfil_bd';
        req.adminNombre = fila.nombre || null;
        req.adminEmail = fila.email || null;
        req.adminDebeCambiarPassword = Boolean(fila.debe_cambiar_password);
        emitirTokenSesion(req, res);
        return next();
      } catch (err) {
        console.error('Error verificando token de sesión (perfil_bd):', err.message);
        res.set('WWW-Authenticate', `Basic realm="${realm}"`);
        return res.status(401).json({ error: 'Autenticacion requerida.' });
      }
    }
    // Token con un mecanismo que esta ruta no reconoce (firma válida
    // pero payload inesperado) — nunca se asume válido por default.
    res.set('WWW-Authenticate', `Basic realm="${realm}"`);
    return res.status(401).json({ error: 'Autenticacion requerida.' });
  }

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
    emitirTokenSesion(req, res);
    return next();
  }

  // 2. Usuarios administrativos (perfil administrador/fiscal) creados desde el panel
  try {
    const usuarioAdmin = await verificarUsuarioAdministrativo(username, password);
    if (usuarioAdmin && usuarioAdmin.suspendido) {
      // codigo (no solo el texto) para que el frontend distinga este 403 de
      // cualquier otro (cuota excedida, perfil sin acceso, módulo apagado)
      // sin depender de comparar el mensaje — ver admin.js, interceptor
      // global de fetch (punto 290, fix logout inmediato).
      return res.status(403).json({ error: 'Tu cuenta está suspendida. Contacta a un administrador.', codigo: 'CUENTA_SUSPENDIDA' });
    }
    if (usuarioAdmin) {
      req.adminUser = usuarioAdmin.rfc;
      req.adminPerfil = usuarioAdmin.perfil;
      req.adminMecanismo = 'perfil_bd';
      // Identidad real de la persona (si ya la capturó en "Mi Cuenta"),
      // para no tener que volver a consultar "usuarios" en cada ruta que
      // necesite mostrar quién hizo algo (punto 320) — "adminUser" (el
      // "rfc") es solo su nombre de usuario de login, nunca la identidad.
      req.adminNombre = usuarioAdmin.nombre || null;
      req.adminEmail = usuarioAdmin.email || null;
      // Bug real (punto 321 addendum): "Forzar cambio de contraseña" al
      // crear la cuenta guardaba el flag en la BD, pero nada del login de
      // /admin (Basic Auth) lo consultaba — solo el login del portal de
      // cliente (/api/auth/login) lo hacía. Expuesto aquí para que
      // GET /api/admin/login pueda devolverlo e interceptar el login.
      req.adminDebeCambiarPassword = Boolean(usuarioAdmin.debe_cambiar_password);
      emitirTokenSesion(req, res);
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
