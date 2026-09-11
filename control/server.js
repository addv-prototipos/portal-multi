require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { obtenerPool } = require('./db');
const { requireAdminAuth, requireAdminArea } = require('./utils/auth');
const { asegurarTablaAuditoria, registrarAccesoAdmin } = require('./utils/adminAuditoria');
const { asegurarColumnasCicloVidaTenant } = require('./scripts/ensureSchema');
const {
  listarTenants,
  activarTenant,
  suspenderTenant,
  reactivarTenant,
  darDeBajaTenant,
  ErrorTransicionTenant,
} = require('./utils/tenantLifecycle');
const { crearTenantIntake, ErrorIntakeTenant } = require('./utils/tenantIntake');
const { actualizarMarcaTenant, subirLogoAlBackend, ErrorMarcaTenant, MAX_MARCA_LOGO_MB } = require('./utils/tenantMarca');
const { actualizarTemaTenant, ErrorTemaTenant } = require('./utils/tenantTema');
const { actualizarDatosTenant, ErrorEdicionTenant } = require('./utils/tenantEdicion');
const { swaggerSpec } = require('./utils/swagger');
const swaggerUi = require('swagger-ui-express');
const {
  listarCredencialesPorTenant,
  crearCredencialApi,
  rotarCredencialApi,
  revocarCredencialApi,
} = require('./utils/apiCredenciales');
const {
  listarGruposSucursal,
  obtenerGrupoSucursal,
  crearGrupoSucursal,
  actualizarGrupoSucursal,
  eliminarGrupoSucursal,
  crearUsuarioSucursal,
  actualizarUsuarioSucursal,
  ErrorSucursal,
} = require('./utils/sucursales');

const PORT = Number(process.env.PORT || 4001);
// Auditoría 2026-09-03 (hallazgo #9, mismo criterio que backend/server.js):
// default `false` (CORS deshabilitado) en vez de '*' — el despliegue normal
// sirve todo bajo el mismo origen vía nginx.
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || false;

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
// Límite de body amplio a propósito: el logo de marca se recibe aquí como
// base64 desde el navegador (hasta 2 MB de archivo, ~2.7 MB de texto) y se
// reenvía al backend por su endpoint interno — ver PUT
// /api/control/tenants/:slug/marca y backend/server.js
// (POST /internal/marca-logo/:slug).
app.use(express.json({ limit: '4mb' }));

// Sin req.tenant en este servicio (nunca resuelve un tenant específico),
// así que la clave de los limiters es siempre "sin-tenant:IP" — mismo
// nombre de función que backend/server.js, comportamiento equivalente.
function claveTenantIp(req) {
  return `sin-tenant:${req.ip}`;
}

// Mismo criterio que backend/server.js: adminApiLimiter es permisivo
// (uso legítimo normal), adminCredencialesLimiter frena fuerza bruta de
// credenciales específicamente (Basic Auth manda credenciales en CADA
// petición, no solo en un login dedicado).
const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveTenantIp,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' },
});

const adminCredencialesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveTenantIp,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos fallidos. Intenta de nuevo mas tarde.' },
});

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('Error no controlado en la ruta:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Ocurrio un error interno. Intenta de nuevo.' });
      }
    });
  };
}

// Traduce ErrorTransicionTenant al código HTTP correcto: 404 si el slug
// no existe, 502 si el paso físico en el backend falló (solo aplica a
// "activar" — ver ErrorTransicionTenant.codigo 'error_fisico' en
// tenantLifecycle.js), 409 para cualquier otro estado que no admite la
// transición pedida.
async function manejarTransicionTenant(res, ejecutarTransicion) {
  try {
    const tenant = await ejecutarTransicion();
    res.json({ ok: true, tenant });
  } catch (err) {
    if (err instanceof ErrorTransicionTenant) {
      const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'error_fisico' ? 502 : 409;
      return res.status(estatus).json({ error: err.message });
    }
    throw err;
  }
}

app.use(adminCredencialesLimiter);

// Auditoría de todo lo que sirve este servicio — salta GET (no hay ruta
// de login propia, la sonda de credenciales es GET /api/control/tenants,
// una lectura sin efecto de auditoría relevante). tenantSlug siempre
// null: este servicio actúa cross-tenant por definición.
app.use((req, res, next) => {
  res.on('finish', () => {
    if (req.method === 'GET') return;
    if (!req.adminUser) return;
    registrarAccesoAdmin({
      actor: req.adminUser,
      mecanismo: req.adminMecanismo,
      perfil: req.adminPerfil,
      tenantSlug: null,
      metodo: req.method,
      ruta: req.path,
      estatus: res.statusCode,
      ip: req.ip,
    }).catch((err) => console.error('No se pudo auditar el acceso de control:', err.message));
  });
  next();
});

// Swagger — UI y JSON (punto 137). Público para listar, probar requiere Basic super.
// CSP para Swagger UI: sus <script> son src= externos del mismo origen,
// script-src 'self' ya los permite sin 'unsafe-inline'; el único
// new Function() del bundle es un fallback de globalThis para navegadores
// viejos, inalcanzable en la práctica — no hace falta 'unsafe-eval'.
// style-src SÍ necesita 'unsafe-inline' (bloques <style> literales del HTML).
app.use('/api/control/docs', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob:; script-src 'self' https:; style-src 'self' https: 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https: data:");
  next();
});
app.get('/api/control/docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api/control/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

// Health check real: confirma que control_tenants sí es alcanzable, no
// solo que el proceso contestó — mismo criterio que backend/server.js.
app.get('/health', async (req, res) => {
  try {
    await Promise.race([
      obtenerPool().query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', error: 'La base de datos no está disponible.' });
  }
});

app.get(
  '/api/control/tenants',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const { estado, q } = req.query;
    const tenants = await listarTenants({ estado, q });
    res.json({ tenants });
  })
);

// Captura de la intención de dar de alta una empresa nueva (segmento 9c,
// ver PROJECT_STATE.md): guarda la fila en estado "provisioning" SIN
// privilegios root de MySQL — el aprovisionamiento físico lo completa
// después un operador corriendo backend/scripts/provisionar-tenant.js,
// que detecta estas filas y las reutiliza. 201 alta registrada / 400
// datos que no pasan la validación / 409 slug ya registrado.
app.post(
  '/api/control/tenants',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const body = req.body || {};

      // Logo de marca opcional: se sube al almacenamiento (vía backend
      // interno) ANTES de crear la fila, para que el intake guarde la
      // ruta pública resultante junto con la marca. Si el alta después
      // falla (ej. slug duplicado), el archivo queda huérfano en
      // almacenamiento — inofensivo (se sobrescribe si se reintenta con
      // ese mismo slug), y no vale la pena un paso de limpieza por un
      // caso de esquina.
      let marcaLoGoUrl = null;
      if (typeof body.logoBase64 === 'string' && body.logoBase64.length > 0) {
        let buffer;
        try {
          buffer = Buffer.from(body.logoBase64, 'base64');
        } catch (err) {
          return res.status(400).json({ error: 'El contenido del logo no es un base64 válido.' });
        }
        if (buffer.length === 0) {
          return res.status(400).json({ error: 'El logo está vacío.' });
        }
        if (buffer.length > MAX_MARCA_LOGO_MB * 1024 * 1024) {
          return res.status(400).json({ error: `El logo excede el tamaño máximo permitido de ${MAX_MARCA_LOGO_MB} MB.` });
        }
        try {
          marcaLoGoUrl = await subirLogoAlBackend(body.slug || '', buffer);
        } catch (err) {
          if (err instanceof ErrorMarcaTenant) {
            return res.status(err.codigo === 'backend' ? 502 : 400).json({ error: err.message });
          }
          throw err;
        }
      }

      const tenant = await crearTenantIntake({ ...body, marcaLoGoUrl }, { actor: req.adminUser });
      res.status(201).json({ ok: true, tenant });
    } catch (err) {
      if (err instanceof ErrorIntakeTenant) {
        const estatus = err.codigo === 'slug_existe' ? 409 : 400;
        return res.status(estatus).json({ error: err.message });
      }
      throw err;
    }
  })
);

// Completa el aprovisionamiento de una empresa capturada desde el intake
// (segmento 9c) que quedó en "provisioning" — delega la parte física
// (CREATE DATABASE + esquema) al backend, ver tenantLifecycle.js/
// notificarBackend.js para el detalle completo. Único mecanismo, junto
// con el CLI backend/scripts/provisionar-tenant.js, que completa este
// paso — ninguno de los dos requiere ya privilegios root para el 99% de
// los casos (root solo se necesitó UNA vez, para el GRANT inicial).
app.post(
  '/api/control/tenants/:slug/activar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    await manejarTransicionTenant(res, () => activarTenant(req.params.slug, { actor: req.adminUser }));
  })
);

app.post(
  '/api/control/tenants/:slug/suspender',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    await manejarTransicionTenant(res, () => suspenderTenant(req.params.slug, { actor: req.adminUser }));
  })
);

app.post(
  '/api/control/tenants/:slug/reactivar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    await manejarTransicionTenant(res, () => reactivarTenant(req.params.slug, { actor: req.adminUser }));
  })
);

app.post(
  '/api/control/tenants/:slug/baja',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    await manejarTransicionTenant(res, () => darDeBajaTenant(req.params.slug, { actor: req.adminUser }));
  })
);

// Actualiza la marca (y opcionalmente el logo) de un tenant — el nombre
// con el que la empresa quiere ser reconocida en los correos del portal,
// con prioridad sobre el nombre genérico por defecto. El logo llega como
// base64 y se reenvía al backend principal para persistirlo en MinIO (ver
// control/utils/tenantMarca.js). 200 marca actualizada / 400 datos que no
// pasan la validación / 404 slug inexistente / 502 el backend rechazó el
// logo.
app.put(
  '/api/control/tenants/:slug/marca',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const tenant = await actualizarMarcaTenant(req.params.slug, req.body || {}, { actor: req.adminUser });
      res.json({ ok: true, tenant });
    } catch (err) {
      if (err instanceof ErrorMarcaTenant) {
        const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'backend' ? 502 : 400;
        return res.status(estatus).json({ error: err.message });
      }
      throw err;
    }
  })
);

// Actualiza el tema / identidad visual de un tenant (segmento "Look &
// Feel", ver PROJECT_STATE.md punto 105): paleta de colores, tipografías
// del catálogo, radio de esquinas y favicon, que personalizan el portal
// de la empresa sobre el diseño base ADDV. `tema` es un objeto parcial
// (las claves ausentes conservan el diseño base); `restablecer: true`
// devuelve el tenant al diseño base ADDV. 200 tema actualizado / 400
// datos que no pasan la validación (incluido contraste AA) / 404 slug
// inexistente / 502 el backend rechazó el favicon.
app.put(
  '/api/control/tenants/:slug/tema',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const tenant = await actualizarTemaTenant(req.params.slug, req.body || {}, { actor: req.adminUser });
      res.json({ ok: true, tenant });
    } catch (err) {
      if (err instanceof ErrorTemaTenant) {
        const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'backend' ? 502 : 400;
        return res.status(estatus).json({ error: err.message });
      }
      throw err;
    }
  })
);

// Edición completa de una empresa existente (segmento "edición", ver
// PROJECT_STATE.md punto 104): todos los campos del alta + slug opcional
// (solo se aplica si el operador lo habilitó explícitamente — switch en
// la UI — y dispara la migración de archivos en el backend vía
// /internal/renombrar-slug ANTES de tocar la fila). 200 actualizado /
// 400 datos que no pasan la validación / 404 slug inexistente / 409 slug
// nuevo ya registrado / 502 la migración de almacenamiento falló.
app.put(
  '/api/control/tenants/:slug',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const tenant = await actualizarDatosTenant(req.params.slug, req.body || {}, { actor: req.adminUser });
      res.json({ ok: true, tenant });
    } catch (err) {
      if (err instanceof ErrorEdicionTenant) {
        const estatus =
          err.codigo === 'no_encontrado' ? 404 : err.codigo === 'slug_existe' ? 409 : err.codigo === 'backend' ? 502 : 400;
        return res.status(estatus).json({ error: err.message });
      }
      throw err;
    }
  })
);

// ---------- Credenciales API por empresa (para uso en Swagger y consumo directo de APIs) ----------
// Solo super puede gestionarlas. Cada empresa tiene a lo más 1 activa; se muestra usuario + hash nunca en claro
// salvo al crear/rotar (password_plano solo una vez). Especifica para uso de las APIs: el cliente usa
// Basic Auth con este usuario/password contra /<slug>/api/* o /api/* con X-Tenant-Slug, y Swagger lo consume vía Authorize.
app.get(
  '/api/control/tenants/:slug/credenciales',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const lista = await listarCredencialesPorTenant(req.params.slug);
    res.json({ credenciales: lista });
  })
);

app.post(
  '/api/control/tenants/:slug/credenciales',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const cred = await crearCredencialApi(req.params.slug, req.adminUser);
      res.status(201).json({ ok: true, credencial: cred });
    } catch (err) {
      if (err.codigo === 'ya_existe') return res.status(409).json({ error: err.message });
      throw err;
    }
  })
);

app.post(
  '/api/control/tenants/:slug/credenciales/:id/rotar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const cred = await rotarCredencialApi(Number(req.params.id), req.params.slug, req.adminUser);
      res.json({ ok: true, credencial: cred });
    } catch (err) {
      if (err.codigo === 'no_encontrado') return res.status(404).json({ error: err.message });
      throw err;
    }
  })
);

app.delete(
  '/api/control/tenants/:slug/credenciales/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await revocarCredencialApi(Number(req.params.id), req.params.slug);
      res.json({ ok: true });
    } catch (err) {
      if (err.codigo === 'no_encontrado') return res.status(404).json({ error: err.message });
      throw err;
    }
  })
);

// ---------- Sucursales (§58): agrupar tenants del mismo negocio con ----------
// usuarios de acceso compartidos, válidos en cualquier sucursal asociada.
// Solo /control (este servicio) asocia/desasocia sucursales y administra
// los usuarios compartidos (decisión cerrada) — la credencial vive SOLO
// en la BD de control, el backend la verifica en vivo contra esta misma
// tabla (ver backend/utils/auth.js), sin duplicarla en cada tenant.
function mapearErrorSucursal(err) {
  if (err.codigo === 'no_encontrado') return 404;
  if (err.codigo === 'conflicto') return 409;
  return 400;
}

app.get(
  '/api/control/grupos-sucursal',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const grupos = await listarGruposSucursal();
    res.json({ grupos });
  })
);

app.post(
  '/api/control/grupos-sucursal',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const grupo = await crearGrupoSucursal(req.body || {}, { actor: req.adminUser });
      res.status(201).json({ ok: true, grupo });
    } catch (err) {
      if (err instanceof ErrorSucursal) return res.status(mapearErrorSucursal(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.get(
  '/api/control/grupos-sucursal/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const grupo = await obtenerGrupoSucursal(Number(req.params.id));
      res.json({ grupo });
    } catch (err) {
      if (err instanceof ErrorSucursal) return res.status(mapearErrorSucursal(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/grupos-sucursal/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const grupo = await actualizarGrupoSucursal(Number(req.params.id), req.body || {}, { actor: req.adminUser });
      res.json({ ok: true, grupo });
    } catch (err) {
      if (err instanceof ErrorSucursal) return res.status(mapearErrorSucursal(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.delete(
  '/api/control/grupos-sucursal/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await eliminarGrupoSucursal(Number(req.params.id), { actor: req.adminUser });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ErrorSucursal) return res.status(mapearErrorSucursal(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.post(
  '/api/control/grupos-sucursal/:id/usuarios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const usuario = await crearUsuarioSucursal(Number(req.params.id), req.body || {}, { actor: req.adminUser });
      res.status(201).json({ ok: true, usuario });
    } catch (err) {
      if (err instanceof ErrorSucursal) return res.status(mapearErrorSucursal(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/grupos-sucursal/:id/usuarios/:usuarioId',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await actualizarUsuarioSucursal(Number(req.params.id), Number(req.params.usuarioId), req.body || {});
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ErrorSucursal) return res.status(mapearErrorSucursal(err)).json({ error: err.message });
      throw err;
    }
  })
);

// ---------- Punto 247: gestión de super admins (ADMIN_USERS en .env) ----------
// Híbrido: super = ADMIN_USERS (.env) + usuarios perfil super en BD (si los hay),
// pero la alta/edición/baja de ADMIN_USERS solo se hace aquí, en /control,
// escribiendo en el .env del host (montado como volumen) para que el servidor
// tenga acceso directo si la UI falla. El .env es la fuente de verdad en disco;
// el Map en memoria se recarga sin reiniciar y se notifica al backend para
// que recargue también (POST /internal/reload-admin-users).
app.get(
  '/api/control/super-admins',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const { listarSuperAdmins } = require('./utils/adminEnv');
    const lista = listarSuperAdmins();
    res.json({ superAdmins: lista });
  })
);

app.post(
  '/api/control/super-admins',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const { leerAdminUsersDeEnv, guardarAdminUsersEnEnv, parsearAdminUsers, validarUsuario, validarPassword, notificarBackendRecarga, ErrorAdminEnv } = require('./utils/adminEnv');
    const { recargarAdminUsers } = require('./utils/auth');
    const body = req.body || {};
    const usuario = String(body.usuario || '').trim();
    const password = String(body.password || '');
    const errU = validarUsuario(usuario);
    if (errU) return res.status(400).json({ error: errU });
    const errP = validarPassword(password);
    if (errP) return res.status(400).json({ error: errP });
    const { valor } = leerAdminUsersDeEnv();
    const map = parsearAdminUsers(valor);
    if (map.has(usuario)) return res.status(409).json({ error: 'Ese usuario super ya existe.' });
    map.set(usuario, password);
    const nuevoValor = Array.from(map.entries()).map(([u, p]) => `${u}:${p}`).join(',');
    try {
      guardarAdminUsersEnEnv(nuevoValor);
      recargarAdminUsers(nuevoValor);
      await notificarBackendRecarga(nuevoValor);
    } catch (e) {
      return res.status(500).json({ error: 'No se pudo guardar en .env: ' + e.message });
    }
    res.status(201).json({ ok: true, superAdmins: Array.from(map.keys()).sort() });
  })
);

app.put(
  '/api/control/super-admins/:usuario',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const { leerAdminUsersDeEnv, guardarAdminUsersEnEnv, parsearAdminUsers, validarPassword, notificarBackendRecarga } = require('./utils/adminEnv');
    const { recargarAdminUsers } = require('./utils/auth');
    const usuario = String(req.params.usuario || '').trim();
    const password = String((req.body || {}).password || '');
    const errP = validarPassword(password);
    if (errP) return res.status(400).json({ error: errP });
    const { valor } = leerAdminUsersDeEnv();
    const map = parsearAdminUsers(valor);
    if (!map.has(usuario)) return res.status(404).json({ error: 'Usuario super no encontrado.' });
    map.set(usuario, password);
    const nuevoValor = Array.from(map.entries()).map(([u, p]) => `${u}:${p}`).join(',');
    try {
      guardarAdminUsersEnEnv(nuevoValor);
      recargarAdminUsers(nuevoValor);
      await notificarBackendRecarga(nuevoValor);
    } catch (e) {
      return res.status(500).json({ error: 'No se pudo guardar en .env: ' + e.message });
    }
    res.json({ ok: true, superAdmins: Array.from(map.keys()).sort() });
  })
);

app.delete(
  '/api/control/super-admins/:usuario',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const { leerAdminUsersDeEnv, guardarAdminUsersEnEnv, parsearAdminUsers, notificarBackendRecarga } = require('./utils/adminEnv');
    const { recargarAdminUsers } = require('./utils/auth');
    const usuario = String(req.params.usuario || '').trim();
    const { valor } = leerAdminUsersDeEnv();
    const map = parsearAdminUsers(valor);
    if (!map.has(usuario)) return res.status(404).json({ error: 'Usuario super no encontrado.' });
    if (usuario === req.adminUser) return res.status(409).json({ error: 'No puedes eliminar tu propia cuenta super.' });
    if (map.size <= 1) return res.status(409).json({ error: 'Debe quedar al menos un super admin.' });
    map.delete(usuario);
    const nuevoValor = Array.from(map.entries()).map(([u, p]) => `${u}:${p}`).join(',');
    try {
      guardarAdminUsersEnEnv(nuevoValor);
      recargarAdminUsers(nuevoValor);
      await notificarBackendRecarga(nuevoValor);
    } catch (e) {
      return res.status(500).json({ error: 'No se pudo guardar en .env: ' + e.message });
    }
    res.json({ ok: true, superAdmins: Array.from(map.keys()).sort() });
  })
);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

async function iniciar() {
  await asegurarTablaAuditoria();
  await asegurarColumnasCicloVidaTenant(obtenerPool());
  const { asegurarTablaApiCredenciales, asegurarTablasSucursales } = require('./scripts/ensureSchema');
  await asegurarTablaApiCredenciales(obtenerPool());
  await asegurarTablasSucursales(obtenerPool());

  app.listen(PORT, () => {
    console.log(`Control escuchando en el puerto ${PORT}`);
  });
}

// Igual que backend/server.js: solo arranca si este archivo se ejecuta
// directamente, no cuando un test hace require('./server') para probar
// la app con supertest.
if (require.main === module) {
  process.on('uncaughtException', (err) => {
    console.error('Excepción no controlada — cerrando el proceso:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (razon) => {
    console.error('Promesa rechazada sin atrapar — cerrando el proceso:', razon);
    process.exit(1);
  });

  iniciar().catch((err) => {
    console.error('No se pudo iniciar el servicio de control:', err);
    process.exit(1);
  });
}

module.exports = app;
