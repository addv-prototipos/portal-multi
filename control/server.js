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

const PORT = Number(process.env.PORT || 4001);
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10kb' }));

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
      const tenant = await crearTenantIntake(req.body || {}, { actor: req.adminUser });
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
