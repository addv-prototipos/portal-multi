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
  suspenderTenant,
  reactivarTenant,
  darDeBajaTenant,
  ErrorTransicionTenant,
} = require('./utils/tenantLifecycle');
const { crearTenantIntake, ErrorIntakeTenant } = require('./utils/tenantIntake');
const { actualizarMarcaTenant, subirLogoAlBackend, ErrorMarcaTenant, MAX_MARCA_LOGO_MB } = require('./utils/tenantMarca');
const { actualizarDatosTenant, ErrorEdicionTenant } = require('./utils/tenantEdicion');

const PORT = Number(process.env.PORT || 4001);
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';

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
// no existe, 409 si existe pero está en un estado que no admite la
// transición pedida.
async function manejarTransicionTenant(res, ejecutarTransicion) {
  try {
    const tenant = await ejecutarTransicion();
    res.json({ ok: true, tenant });
  } catch (err) {
    if (err instanceof ErrorTransicionTenant) {
      const estatus = err.codigo === 'no_encontrado' ? 404 : 409;
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

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

async function iniciar() {
  await asegurarTablaAuditoria();
  await asegurarColumnasCicloVidaTenant(obtenerPool());

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
