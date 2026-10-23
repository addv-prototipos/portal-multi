require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { obtenerPool } = require('./db');
const { requireAdminAuth, requireAdminArea } = require('./utils/auth');
const { asegurarTablaAuditoria, registrarAccesoAdmin, listarAuditoria } = require('./utils/adminAuditoria');
const { asegurarColumnasCicloVidaTenant } = require('./scripts/ensureSchema');
const {
  listarTenants,
  obtenerTenantPorSlug,
  activarTenant,
  suspenderTenant,
  reactivarTenant,
  darDeBajaTenant,
  eliminarTenantDefinitivo,
  vaciarPapelera,
  purgarBajasVencidas,
  recalcularUsoDisco,
  ErrorTransicionTenant,
  ErrorCalculoDisco,
} = require('./utils/tenantLifecycle');
const { crearTenantIntake, ErrorIntakeTenant } = require('./utils/tenantIntake');
const { actualizarMarcaTenant, subirLogoAlBackend, ErrorMarcaTenant } = require('./utils/tenantMarca');
const { validarSlug } = require('./utils/tenant');
const { getImagenMaxMb, setImagenMaxMb, getImportMaxFilas, setImportMaxFilas } = require('./utils/ajustesGlobales');
const { getAccesoMinio, setAccesoMinio, ErrorAccesoMinio } = require('./utils/accesoMinio');
const { getAccesoSmtp, setAccesoSmtp, ErrorAccesoSmtp } = require('./utils/accesoSmtp');
const { ErrorCifrado } = require('./utils/cifrado');
const { actualizarTemaTenant, ErrorTemaTenant } = require('./utils/tenantTema');
const { actualizarSuscripcionTenant, ErrorSuscripcionTenant } = require('./utils/tenantSuscripcion');
const { actualizarDatosTenant, ErrorEdicionTenant } = require('./utils/tenantEdicion');
const { obtenerUsoUsuarios, crearAdminInicialFisico, ErrorActivacionFisica } = require('./utils/notificarBackend');
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
const {
  listarPlanes,
  obtenerPlan,
  crearPlan,
  actualizarPlan,
  archivarPlan,
  reactivarPlan,
  ErrorPlan,
} = require('./utils/planes');
const {
  crearBorrador,
  obtenerBorrador,
  actualizarBorrador,
  verificarSlugDisponible,
  ErrorOnboarding,
} = require('./utils/onboardingBorrador');
const { convertirBorrador } = require('./utils/onboardingConversion');
const { verificarTurnstile } = require('./utils/turnstile');
const { hashPasswordAdmin, validarPasswordAdmin, derivarNombreUsuario } = require('./utils/credencialesAdmin');
const { isValidEmail } = require('./utils/validateFiscal');

const PORT = Number(process.env.PORT || 4001);
// Auditoría 2026-09-03 (hallazgo #9, mismo criterio que backend/server.js):
// default `false` (CORS deshabilitado) en vez de '*' — el despliegue normal
// sirve todo bajo el mismo origen vía nginx.
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || false;

const app = express();
// Número de saltos de proxy confiados para resolver `req.ip` (usado por
// la auditoría de arriba) — mismo razonamiento y mismo env var que
// `backend/server.js` (buscar `TRUST_PROXY_HOPS` ahí para el detalle
// completo): 1 = solo el nginx de este docker-compose local; un VPS con
// un nginx del HOST por delante del stack necesita 2, o el `ip` guardado
// termina siendo el de ese proxy intermedio, no el del navegador real.
const TRUST_PROXY_HOPS = (() => {
  const crudo = process.env.TRUST_PROXY_HOPS;
  const n = crudo === undefined || crudo === '' ? 1 : Number(crudo);
  return Number.isInteger(n) && n >= 0 ? n : 1;
})();
app.set('trust proxy', TRUST_PROXY_HOPS);

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

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

// Onboarding público (clarvo.mx → modal de alta, Segmento A, 2026-10-13):
// sin req.adminUser (nadie se autentica todavía), así que es su propio
// limiter, más estricto que adminApiLimiter a propósito (ese asume
// tráfico ya autenticado) — frena spam/enumeración de slugs desde un
// visitante anónimo.
const onboardingPublicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveTenantIp,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' },
});

// Hallazgo M-03 (sonar.html, 2026-10-14): /api/control se autentica con
// Basic Auth, que el navegador reenvía automáticamente a CUALQUIER
// request hacia este mismo origen/realm — incluida una disparada por un
// <form>/fetch de un sitio ajeno mientras la víctima (el super-admin)
// tiene sesión cacheada. Caso real citado en el informe: "suspender/
// eliminar tenant, vaciar papelera, rotar credenciales" vía un
// <form method=post> cruzado. CORS no basta (solo evita que el
// ATACANTE lea la respuesta, la mutación ya corrió del lado servidor).
// Mismo criterio exacto que backend/server.js: comparar `Origin` (si el
// navegador lo manda, siempre en POST/PUT/PATCH/DELETE) contra
// `req.get('host')`, + `Sec-Fetch-Site` como señal extra. Alcance
// SOLO `/api/control/*` (prefijo del path, no global) — las rutas
// `/api/public/onboarding/*` son públicas por diseño y cross-origin a
// propósito desde clarvo.mx (su propio `onboardingCors`, más abajo),
// aplicar esto ahí rompería ese flujo real. Cliente server-to-server
// (api_usuario/api_clave) nunca manda `Origin`, pasa sin tocar.
function requireOrigenPropio(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const secFetchSite = req.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }
  const origin = req.get('origin');
  if (origin) {
    let origenHost = null;
    try {
      origenHost = new URL(origin).host;
    } catch (err) {
      origenHost = null;
    }
    const mismoOrigen = origenHost && origenHost === req.get('host');
    const origenPermitidoPorCors = ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN;
    if (!mismoOrigen && !origenPermitidoPorCors) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
  }
  next();
}
app.use('/api/control', requireOrigenPropio);

// Hallazgo M-05 (sonar.html, 2026-10-14): adminCredencialesLimiter
// (global, todo método) vivía DESPUÉS de express.json({ limit: '30mb' })
// — cada request anónimo pagaba el parseo completo de hasta ~27 MB
// ANTES de que el limiter pudiera responder 429. El rate limit no
// depende del body (solo de la IP), así que se adelanta aquí, antes del
// parser — ningún endpoint lo necesitaba después.
app.use(adminCredencialesLimiter);

// Límite de body amplio a propósito: el logo/favicon de marca se recibe
// aquí como base64 desde el navegador (Punto 370: el máximo configurable
// llega hasta IMAGEN_MAX_MB_MAX = 20 MB de archivo, ~27.4 MB de texto) y
// se reenvía al backend por su endpoint interno — ver PUT
// /api/control/tenants/:slug/marca y backend/server.js
// (POST /internal/marca-logo/:slug, POST /internal/favicon/:slug).
app.use(express.json({ limit: '30mb' }));

// CORS propio de esta superficie — independiente de ALLOWED_ORIGIN de
// arriba (ese gate protege /api/control/*, autenticado, default
// deshabilitado por la auditoría 2026-09-03 hallazgo #9). El wizard de
// onboarding es público por diseño y vive solo bajo
// /api/public/onboarding/*, nunca bajo /api/control/* — nunca ensanchar
// ALLOWED_ORIGIN para esto.
const ONBOARDING_CORS_ORIGIN = process.env.ONBOARDING_CORS_ORIGIN || 'https://clarvo.mx';
const onboardingCors = cors({ origin: ONBOARDING_CORS_ORIGIN, credentials: false });

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

// Auditoría de todo lo que sirve este servicio. Hallazgo M-19/A09
// (sonar_1.1.html): antes saltaba TODO GET, así que ninguna lectura
// cross-tenant (listado de tenants, credenciales MinIO/SMTP enmascaradas,
// uso de usuarios y planes) dejaba traza — la única categoría OWASP que
// seguía sin cumplir. `!req.adminUser` ya filtra las rutas públicas (health,
// docs, onboarding, el propio probe de credenciales) sin necesidad del
// chequeo de método: solo queda auditada la lectura de alguien YA
// autenticado. `req.originalUrl` (no `req.path`) para que los filtros de
// query string aplicados (ej. `?busqueda=...`) queden en el evento.
// tenantSlug siempre null: este servicio actúa cross-tenant por
// definición.
app.use((req, res, next) => {
  res.on('finish', () => {
    if (!req.adminUser) return;
    registrarAccesoAdmin({
      actor: req.adminUser,
      mecanismo: req.adminMecanismo,
      perfil: req.adminPerfil,
      tenantSlug: null,
      metodo: req.method,
      ruta: req.originalUrl,
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
// Hallazgo m-01 (sonar_1.1.html, Fase D, punto 410): mismo criterio que
// backend/server.js — DOCS_ENABLED invertido a opt-in (apagado por
// defecto, 404 nunca 403); el compose de desarrollo lo fija a "true".
function docsHabilitados() {
  return process.env.DOCS_ENABLED === 'true';
}
app.use('/api/control/docs', (req, res, next) => {
  if (!docsHabilitados()) return res.status(404).json({ error: 'Ruta no encontrada.' });
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob:; script-src 'self' https:; style-src 'self' https: 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https: data:");
  next();
});
app.get('/api/control/docs.json', (req, res) => {
  if (!docsHabilitados()) return res.status(404).json({ error: 'Ruta no encontrada.' });
  res.json(swaggerSpec);
});
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

// ---------- Onboarding público (clarvo.mx → modal de alta, Segmento A) ----------
// Sin requireAdminAuth a propósito: quien llama es un prospecto desde el
// navegador, todavía sin cuenta. app.use (no app.get/post) para que el
// preflight OPTIONS de CORS también quede cubierto bajo este prefijo.
app.use('/api/public/onboarding', onboardingCors);

function mapearErrorOnboarding(err) {
  if (err.codigo === 'no_encontrado') return 404;
  if (err.codigo === 'slug_tomado' || err.codigo === 'estado_invalido') return 409;
  // Nunca 502/503/504 aquí: nginx (frontend/nginx.conf.template) intercepta
  // esos códigos globalmente y los disfraza de mantenimiento.html — mismo
  // gotcha ya documentado en CLAUDE.md, corregido antes para Accesos
  // MinIO/SMTP. Un fallo real de aprovisionamiento sigue siendo un error
  // real del servidor, así que es 500, no 502.
  if (err.codigo === 'aprovisionamiento') return 500;
  return 400;
}

app.post(
  '/api/public/onboarding/borrador',
  onboardingPublicLimiter,
  asyncHandler(async (req, res) => {
    try {
      const { planClave, ciclo } = req.body || {};
      const borrador = await crearBorrador({ planClave, ciclo });
      res.status(201).json({ ok: true, borrador });
    } catch (err) {
      if (err instanceof ErrorOnboarding) return res.status(mapearErrorOnboarding(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.get(
  '/api/public/onboarding/borrador/:token',
  onboardingPublicLimiter,
  asyncHandler(async (req, res) => {
    try {
      const borrador = await obtenerBorrador(req.params.token);
      res.json({ borrador });
    } catch (err) {
      if (err instanceof ErrorOnboarding) return res.status(mapearErrorOnboarding(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/public/onboarding/borrador/:token',
  onboardingPublicLimiter,
  asyncHandler(async (req, res) => {
    try {
      const borrador = await actualizarBorrador(req.params.token, req.body || {});
      res.json({ ok: true, borrador });
    } catch (err) {
      if (err instanceof ErrorOnboarding) return res.status(mapearErrorOnboarding(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.get(
  '/api/public/onboarding/slug-disponible',
  onboardingPublicLimiter,
  asyncHandler(async (req, res) => {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim().toLowerCase() : '';
    try {
      const disponible = await verificarSlugDisponible(slug);
      res.json({ slug, disponible });
    } catch (err) {
      if (err instanceof ErrorOnboarding) return res.status(mapearErrorOnboarding(err)).json({ error: err.message });
      throw err;
    }
  })
);

// Segmento B (13 oct 2026): convierte un borrador completo en un tenant
// real — intake + aprovisionamiento físico + plan + usuario admin, sin
// intervención de un operador (self-service, decisión explícita del
// usuario). Ver control/utils/onboardingConversion.js para el detalle
// paso a paso; cada paso es idempotente, así que reintentar esta misma
// ruta tras un error de red nunca duplica nada.
app.post(
  '/api/public/onboarding/convertir/:token',
  onboardingPublicLimiter,
  asyncHandler(async (req, res) => {
    // Hallazgo M-06 (sonar_1.1.html, Fase D, punto 410): única ruta que de
    // verdad aprovisiona infraestructura — exige Turnstile antes de tocar
    // convertirBorrador(). Mensaje genérico a propósito (nunca distingue
    // "sin token" de "token inválido"/"sin configurar" al cliente, mismo
    // criterio anti-enumeración del resto del sitio).
    const verificacion = await verificarTurnstile((req.body || {}).turnstileToken, req.ip);
    if (!verificacion.ok) {
      return res.status(400).json({ error: 'No pudimos verificar que eres humano. Intenta de nuevo.' });
    }
    try {
      const resultado = await convertirBorrador(req.params.token);
      res.json({ ok: true, ...resultado });
    } catch (err) {
      if (err instanceof ErrorOnboarding) return res.status(mapearErrorOnboarding(err)).json({ error: err.message });
      throw err;
    }
  })
);

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

      // Hallazgo M-07 (sonar.html, 2026-10-14): subirLogoAlBackend()
      // usaba body.slug SIN VALIDAR para armar la URL interna
      // (/internal/marca-logo/<slug>) — un slug tipo
      // "../../eliminar-tenant/victim" invocaba un endpoint interno
      // PRIVILEGIADO distinto, con el X-Internal-Secret real. El resto
      // de la validación de slug vive dentro de crearTenantIntake(), que
      // se llama DESPUÉS de subir el logo — hay que adelantar el
      // chequeo aquí para que ningún slug inválido llegue siquiera a
      // armar esa URL.
      const errorSlug = validarSlug(body.slug);
      if (errorSlug) return res.status(400).json({ error: errorSlug });

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
        const imagenMaxMb = await getImagenMaxMb();
        if (buffer.length > imagenMaxMb * 1024 * 1024) {
          return res.status(400).json({ error: `El logo excede el tamaño máximo permitido de ${imagenMaxMb} MB.` });
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
//
// Gap real encontrado por el usuario (13 oct 2026): el alta MANUAL desde
// "Nueva empresa" nunca pedía credenciales de administrador — un tenant
// creado así quedaba sin forma de entrar (ningún bootstrap de sesión
// existe para un tenant con 0 usuarios). El Segmento B del onboarding
// público ya resolvió esto para el wizard de clarvo.mx; aquí se reusa el
// MISMO backend interno (/internal/crear-admin-inicial, idempotente) para
// cerrar el mismo hueco en el alta manual — opcional (`adminEmail`/
// `adminPassword` en el body): si el operador los captura en "Nueva
// empresa", esta misma llamada activa Y deja el administrador listo con
// la contraseña real que esa persona va a usar — mismo criterio
// self-service que el wizard, nunca se le pide cambiarla después
// (decisión explícita del usuario: sería redundante, ya la escribió
// aquí). Si se dejan en blanco, el comportamiento es IDÉNTICO al de
// siempre (solo activa, sin admin) — no rompe el flujo de dos pasos para
// quien lo prefiera así.
app.post(
  '/api/control/tenants/:slug/activar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const { adminEmail, adminPassword } = req.body || {};

    let correoAdmin = null;
    let passwordHashAdmin = null;
    if (adminEmail || adminPassword) {
      correoAdmin = typeof adminEmail === 'string' ? adminEmail.trim().toLowerCase() : '';
      if (!correoAdmin || !isValidEmail(correoAdmin)) {
        return res.status(400).json({ error: 'Correo del administrador inválido.' });
      }
      const errorPassword = validarPasswordAdmin(adminPassword);
      if (errorPassword) {
        return res.status(400).json({ error: errorPassword });
      }
      passwordHashAdmin = hashPasswordAdmin(adminPassword);
    }

    let tenant;
    try {
      tenant = await activarTenant(slug, { actor: req.adminUser });
    } catch (err) {
      if (!(err instanceof ErrorTransicionTenant)) throw err;
      // Reintento idempotente: si YA quedó "activo" (el paso del admin
      // falló la vez pasada, o el operador volvió a dar clic) y esta vez
      // sí trae credenciales, no es un error — se continúa directo al
      // paso del administrador. Cualquier otro estado/motivo se comporta
      // EXACTAMENTE igual que antes de este cambio.
      if (err.codigo === 'estado_invalido' && correoAdmin && passwordHashAdmin) {
        const existente = await obtenerTenantPorSlug(slug);
        if (!existente || existente.estado !== 'activo') {
          return res.status(409).json({ error: err.message });
        }
        tenant = existente;
      } else {
        const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'error_fisico' ? 502 : 409;
        return res.status(estatus).json({ error: err.message });
      }
    }

    let adminCreado = false;
    if (correoAdmin && passwordHashAdmin) {
      try {
        const resultado = await crearAdminInicialFisico(slug, {
          email: correoAdmin,
          passwordHash: passwordHashAdmin,
          nombreUsuario: derivarNombreUsuario(correoAdmin),
        });
        adminCreado = !resultado.yaExistia;
      } catch (err) {
        // El tenant ya quedó activo — nunca se revierte por esto (mismo
        // criterio que el resto de este archivo). 500, nunca 502/503/504:
        // esta ruta SÍ pasa por el nginx público (/api/control/*), que
        // intercepta esos códigos globalmente y los disfraza de
        // mantenimiento.html (gotcha ya documentado en CLAUDE.md).
        const motivo =
          err instanceof ErrorActivacionFisica
            ? err.message
            : 'El tenant se activó, pero no se pudo crear el usuario administrador.';
        return res.status(500).json({ error: motivo, tenant, reintentarActivarConAdmin: true });
      }
    }

    res.json({ ok: true, tenant, adminCreado });
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

// Punto 347 (gobierno de funcionalidades): recalcula el uso real de disco
// de un tenant bajo demanda — nunca automático, nunca en el camino de
// otra ruta. 502 si el backend/MinIO no respondieron (nunca se escribe
// "0 bytes" a ciegas, ver recalcularUsoDisco en tenantLifecycle.js).
app.post(
  '/api/control/tenants/:slug/recalcular-disco',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const tenant = await recalcularUsoDisco(req.params.slug, { actor: req.adminUser });
      res.json({ ok: true, tenant });
    } catch (err) {
      if (err instanceof ErrorTransicionTenant) {
        return res.status(err.codigo === 'no_encontrado' ? 404 : 409).json({ error: err.message });
      }
      if (err instanceof ErrorCalculoDisco) {
        return res.status(502).json({ error: err.message });
      }
      throw err;
    }
  })
);

// Punto 350/351 (Regla 8 extendida): uso real de usuarios cuotables del
// tenant — solo lectura, para que el banner de "Editar empresa" avise del
// impacto ANTES de guardar un max_usuarios/plan nuevo, nunca solo después.
// 502 si el backend no respondió (nunca se asume 0 usuarios a ciegas,
// mismo criterio que recalcularUsoDisco).
app.get(
  '/api/control/tenants/:slug/uso-usuarios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const total = await obtenerUsoUsuarios(req.params.slug);
    if (total == null) {
      return res.status(502).json({ error: 'No se pudo consultar el uso de usuarios del tenant.' });
    }
    res.json({ ok: true, total });
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

// Elimina un tenant PARA SIEMPRE (punto 345, "papelera") — DROP DATABASE
// + archivos en MinIO + sus filas en control_tenants, solo alcanzable
// desde "baja" (candado extra deliberado: 2 pasos antes de algo
// irreversible). Mismo mapeo de errores que el resto (404/409/502) vía
// manejarTransicionTenant — 502 si el paso físico en el backend falló
// (ErrorTransicionTenant.codigo 'error_fisico').
app.post(
  '/api/control/tenants/:slug/eliminar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    await manejarTransicionTenant(res, () => eliminarTenantDefinitivo(req.params.slug, { actor: req.adminUser }));
  })
);

// Vacía TODA la papelera (todos los tenants en "baja") de una sentada —
// nunca falla en bloque: un tenant que no se pudo eliminar se reporta en
// "fallidos" sin detener a los demás. 200 siempre que la operación
// misma corrió (aunque algún tenant individual haya fallado) — el
// frontend decide cómo mostrar una respuesta parcial.
app.post(
  '/api/control/tenants/papelera/vaciar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const resultado = await vaciarPapelera({ actor: req.adminUser });
    res.json({ ok: true, ...resultado });
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

// Actualiza la suscripción de un tenant (punto en curso, propuesta 3
// aprobada): modo de prueba, ciclo de facturación, fecha de expiración y
// estatus de cobro — este último editado a mano por ahora (sin
// integración real de Stripe). 200 actualizado / 400 datos que no pasan
// la validación / 404 slug inexistente.
app.put(
  '/api/control/tenants/:slug/suscripcion',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const tenant = await actualizarSuscripcionTenant(req.params.slug, req.body || {}, { actor: req.adminUser });
      res.json({ ok: true, tenant });
    } catch (err) {
      if (err instanceof ErrorSuscripcionTenant) {
        const estatus = err.codigo === 'no_encontrado' ? 404 : 400;
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

// Ajustes globales de la plataforma (Punto 370) — hoy solo imagen_max_mb,
// pensado para crecer sin agregar rutas nuevas (ver ajustesGlobales.js).
app.get(
  '/api/control/ajustes/imagen-max-mb',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const imagen_max_mb = await getImagenMaxMb();
    res.json({ imagen_max_mb });
  })
);

app.put(
  '/api/control/ajustes/imagen-max-mb',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const imagen_max_mb = await setImagenMaxMb((req.body || {}).imagen_max_mb);
      res.json({ ok: true, imagen_max_mb });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  })
);

// Límite de filas del importador masivo de Inventarios (CSV/XLSX/XLS) —
// antes fijo e inalcanzable desde ninguna UI (inv_import_max_filas,
// per-tenant, backend/utils/inventarioConfig.js); ahora un solo valor de
// plataforma, mismo patrón que imagen_max_mb.
app.get(
  '/api/control/ajustes/import-max-filas',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const import_max_filas = await getImportMaxFilas();
    res.json({ import_max_filas });
  })
);

app.put(
  '/api/control/ajustes/import-max-filas',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const import_max_filas = await setImportMaxFilas((req.body || {}).import_max_filas);
      res.json({ ok: true, import_max_filas });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  })
);

// "Accesos — MinIO" (punto en curso): bloc de notas cifrado con
// URL/usuario/password de MinIO, SOLO informativo (ver cabecera de
// accesoMinio.js — no sincroniza con backend/ ni con MinIO real). Mismo
// criterio de middlewares que el resto de /control (solo perfil super).
//
// Hallazgo M-08/M-19 (sonar.html, 2026-10-14): GET/PUT devolvían el
// password descifrado en CADA respuesta — el frontend lo cargaba
// automáticamente al abrir la pestaña "Accesos" (nunca a petición del
// operador), así que cualquier bug de auth, proxy que loguee bodies o
// extensión del navegador lo exponía sin que nadie lo hubiera pedido
// realmente. Y como la auditoría global salta TODO GET (comentario de
// más abajo, "salta GET"), ver ese password tampoco dejaba rastro. Fix:
// GET/PUT ahora enmascaran (`passwordConfigurada: boolean`, nunca el
// valor real); el valor real solo se obtiene con el nuevo endpoint
// `POST .../revelar`, que al ser POST (no GET) SÍ pasa por la auditoría
// global existente — cierra M-19 para este caso puntual sin tocar la
// regla general de "no auditar lecturas".
function enmascararAccesoMinio(acceso) {
  const { password, ...resto } = acceso;
  return { ...resto, passwordConfigurada: Boolean(password) };
}

app.get(
  '/api/control/accesos/minio',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const acceso = await getAccesoMinio();
      res.json(enmascararAccesoMinio(acceso));
    } catch (err) {
      if (err instanceof ErrorAccesoMinio || err instanceof ErrorCifrado) {
        // Nunca 502/503/504: nginx los intercepta globalmente y los
        // disfraza de "sitio en mantenimiento" (gotcha documentado en
        // CLAUDE.md) — un error real de configuración (CONTROL_VAULT_KEY
        // faltante) usa 500, no 503, para que el mensaje real le llegue
        // al operador en vez de una pantalla de robot genérica.
        return res.status(err.codigo === 'config' ? 500 : 400).json({ error: err.message });
      }
      throw err;
    }
  })
);

app.post(
  '/api/control/accesos/minio/revelar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const acceso = await getAccesoMinio();
      res.json({ password: acceso.password });
    } catch (err) {
      if (err instanceof ErrorAccesoMinio || err instanceof ErrorCifrado) {
        return res.status(err.codigo === 'config' ? 500 : 400).json({ error: err.message });
      }
      throw err;
    }
  })
);

app.put(
  '/api/control/accesos/minio',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const acceso = await setAccesoMinio(req.body || {});
      res.json({ ok: true, ...enmascararAccesoMinio(acceso) });
    } catch (err) {
      if (err instanceof ErrorAccesoMinio || err instanceof ErrorCifrado) {
        // Nunca 502/503/504: nginx los intercepta globalmente y los
        // disfraza de "sitio en mantenimiento" (gotcha documentado en
        // CLAUDE.md) — un error real de configuración (CONTROL_VAULT_KEY
        // faltante) usa 500, no 503, para que el mensaje real le llegue
        // al operador en vez de una pantalla de robot genérica.
        return res.status(err.codigo === 'config' ? 500 : 400).json({ error: err.message });
      }
      throw err;
    }
  })
);

// "Accesos — SMTP" (punto en curso, mismo pedido del usuario): copia del
// SMTP del sitio base (sin tenant) ya configurado en backend/, para que
// control/ pueda mandar sus propios correos (ej. bienvenida de
// onboarding) sin depender de backend en tiempo real. Mismo patrón que
// "Accesos — MinIO" (bloc de notas cifrado, reusa ajustes_globales) —
// ver cabecera de accesoSmtp.js.
// Hallazgo M-08/M-19 (sonar.html): mismo criterio de enmascarar +
// revelar auditado que accesoMinio.js arriba.
function enmascararAccesoSmtp(acceso) {
  const { password, ...resto } = acceso;
  return { ...resto, passwordConfigurada: Boolean(password) };
}

app.get(
  '/api/control/accesos/smtp',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const acceso = await getAccesoSmtp();
      res.json(enmascararAccesoSmtp(acceso));
    } catch (err) {
      if (err instanceof ErrorAccesoSmtp || err instanceof ErrorCifrado) {
        return res.status(err.codigo === 'config' ? 500 : 400).json({ error: err.message });
      }
      throw err;
    }
  })
);

app.post(
  '/api/control/accesos/smtp/revelar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const acceso = await getAccesoSmtp();
      res.json({ password: acceso.password });
    } catch (err) {
      if (err instanceof ErrorAccesoSmtp || err instanceof ErrorCifrado) {
        return res.status(err.codigo === 'config' ? 500 : 400).json({ error: err.message });
      }
      throw err;
    }
  })
);

app.put(
  '/api/control/accesos/smtp',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const acceso = await setAccesoSmtp(req.body || {});
      res.json({ ok: true, ...enmascararAccesoSmtp(acceso) });
    } catch (err) {
      if (err instanceof ErrorAccesoSmtp || err instanceof ErrorCifrado) {
        return res.status(err.codigo === 'config' ? 500 : 400).json({ error: err.message });
      }
      throw err;
    }
  })
);

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

// ---------- Punto 347: catálogo de planes (gobierno de funcionalidades) ----------
// Independiente de cualquier tenant — se crea/nombra primero, se asigna
// después (ver tenants.plan_id, Fase 3). Mismo criterio de respuesta que
// grupos-sucursal arriba: super-only, soft-delete, sin FK físico.
function mapearErrorPlan(err) {
  if (err.codigo === 'no_encontrado') return 404;
  return 400;
}

app.get(
  '/api/control/planes',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const incluirArchivados = req.query.incluirArchivados === 'true';
    const planes = await listarPlanes({ incluirArchivados });
    res.json({ planes });
  })
);

app.post(
  '/api/control/planes',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const plan = await crearPlan(req.body || {});
      res.status(201).json({ ok: true, plan });
    } catch (err) {
      if (err instanceof ErrorPlan) return res.status(mapearErrorPlan(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.get(
  '/api/control/planes/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const plan = await obtenerPlan(Number(req.params.id));
      res.json({ plan });
    } catch (err) {
      if (err instanceof ErrorPlan) return res.status(mapearErrorPlan(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/planes/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const plan = await actualizarPlan(Number(req.params.id), req.body || {});
      res.json({ ok: true, plan });
    } catch (err) {
      if (err instanceof ErrorPlan) return res.status(mapearErrorPlan(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/planes/:id/archivar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const plan = await archivarPlan(Number(req.params.id));
      res.json({ ok: true, plan });
    } catch (err) {
      if (err instanceof ErrorPlan) return res.status(mapearErrorPlan(err)).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/planes/:id/reactivar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const plan = await reactivarPlan(Number(req.params.id));
      res.json({ ok: true, plan });
    } catch (err) {
      if (err instanceof ErrorPlan) return res.status(mapearErrorPlan(err)).json({ error: err.message });
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
    const { leerAdminUsersDeEnv, guardarAdminUsersEnEnv, parsearAdminUsers, validarUsuario, validarPassword, notificarBackendRecarga } = require('./utils/adminEnv');
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

// ---------- Punto 347: Auditoría cross-tenant ----------
// A diferencia de GET /api/admin/auditoria (backend) que SIEMPRE acota a
// un solo tenant, aquí es lo opuesto: un super ve accesos de CUALQUIER
// empresa (o todas, sin filtro). Mismos filtros/forma de respuesta que
// el equivalente de /admin, con "tenantSlug" agregado.
app.get(
  '/api/control/auditoria',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const limpiar = (valor, max) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '') || undefined;
    const actor = limpiar(req.query.actor, 100);
    const tenantSlug = limpiar(req.query.tenantSlug, 50);
    const desde = limpiar(req.query.desde, 20);
    const hasta = limpiar(req.query.hasta, 20);
    const limite = req.query.limite ? Number(req.query.limite) : 100;

    const filas = await listarAuditoria({ actor, tenantSlug, desde, hasta, limite });

    res.json({
      total: filas.length,
      registros: filas.map((f) => ({
        id: f.id,
        ocurridoEn: f.ocurrido_en,
        actor: f.actor,
        mecanismo: f.mecanismo,
        perfil: f.perfil,
        tenantSlug: f.tenant_slug,
        metodo: f.metodo,
        ruta: f.ruta,
        estatus: f.resultado_estatus,
        ip: f.ip,
      })),
    });
  })
);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

async function iniciar() {
  await asegurarTablaAuditoria();
  const { asegurarTablaApiCredenciales, asegurarTablasSucursales, asegurarTablaPlanes, asegurarTablaAjustesGlobales, asegurarTablaOnboardingBorradores } = require('./scripts/ensureSchema');
  // asegurarTablasSucursales() debe correr ANTES de
  // asegurarColumnasCicloVidaTenant(): esta última hace un UPDATE sobre
  // `tenants.grupo_sucursal_id`, columna que crea asegurarTablasSucursales
  // — en una base de datos 100% nueva (sin ninguna corrida previa de
  // ensureSchema) el orden original fallaba con "Unknown column
  // 'grupo_sucursal_id'" (bug latente, nunca visible hasta ahora porque
  // todo ambiente existente ya tenía la columna de una corrida anterior).
  await asegurarTablasSucursales(obtenerPool());
  await asegurarColumnasCicloVidaTenant(obtenerPool());
  await asegurarTablaApiCredenciales(obtenerPool());
  await asegurarTablaPlanes(obtenerPool());
  await asegurarTablaAjustesGlobales(obtenerPool());
  await asegurarTablaOnboardingBorradores(obtenerPool());

  app.listen(PORT, () => {
    console.log(`Control escuchando en el puerto ${PORT}`);
  });

  iniciarPurgaAutomatica();
}

// Temporizador propio dentro del proceso de control/ (mecanismo elegido
// con el usuario — nada de cron externo ni infraestructura nueva): corre
// una vez al arrancar (con un pequeño retraso, para no competir con las
// migraciones de iniciar()) y luego cada 24h, sin depender de que ningún
// operador abra /control. `enCurso` evita que dos corridas se encimen si
// una tarda más de 24h (no debería, pero es una guarda barata). Un fallo
// nunca tumba el proceso — se loguea y se reintenta en la siguiente
// vuelta, mismo criterio que el resto del archivo (fire-and-forget para
// trabajo de fondo que no debe bloquear ni abortar el servicio real).
const INTERVALO_PURGA_MS = 24 * 60 * 60 * 1000;
let purgaEnCurso = false;

function iniciarPurgaAutomatica() {
  const ejecutar = async () => {
    if (purgaEnCurso) return;
    purgaEnCurso = true;
    try {
      const { eliminados, fallidos } = await purgarBajasVencidas();
      if (eliminados.length || fallidos.length) {
        console.log(
          `Purga automática de tenants en baja (>30 días): ${eliminados.length} eliminados, ${fallidos.length} fallidos.`,
          { eliminados, fallidos }
        );
      }
    } catch (err) {
      console.error('Error corriendo la purga automática de tenants en baja:', err.message);
    } finally {
      purgaEnCurso = false;
    }
  };

  setTimeout(ejecutar, 30 * 1000);
  setInterval(ejecutar, INTERVALO_PURGA_MS);
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

// Probar el guard CSRF (M-03) por HTTP vía supertest no puede fijar un
// Origin que coincida con el host real (puerto efímero asignado en
// cada corrida) — se expone para un test unitario directo y
// determinista, mismo criterio que backend/server.js:app.hostPermitido.
app.requireOrigenPropio = requireOrigenPropio;

module.exports = app;
