require('dotenv').config();

const crypto = require('crypto');
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
const {
  obtenerUsoUsuarios,
  crearAdminInicialFisico,
  ErrorActivacionFisica,
  listarUsuariosAdminTenant,
  reasignarRaizTenant,
  ErrorReasignarRaiz,
} = require('./utils/notificarBackend');
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
  eliminarPlan,
  ErrorPlan,
} = require('./utils/planes');
const {
  crearBorrador,
  obtenerBorrador,
  obtenerEstadoPago,
  actualizarBorrador,
  verificarSlugDisponible,
  ErrorOnboarding,
} = require('./utils/onboardingBorrador');
const { crearCheckoutSession, procesarEventoWebhook } = require('./utils/stripePagos');
const { resolverPlanPorClave } = require('./utils/onboardingConversion');
const { ErrorUpscale, listarUpscale, crearUpscale, editarUpscale, archivarUpscale, reactivarUpscale } = require('./utils/upscale');
const { getConfigMsi, setConfigMsi, metodosPagoInfo, listarCodigosDescuento, crearCodigoDescuento, desactivarCodigoDescuento, activarCodigoDescuento, eliminarCodigoDescuento, reemplazarCodigoDescuento } = require('./utils/stripeConfig');
const { getConfigRecordatorios, setConfigRecordatorios, listarEnSeguimiento, procesarRecordatoriosPendientes } = require('./utils/recordatorios');
const { calcularResumenCapacidad } = require('./utils/discoCapacidad');
const { ErrorUpscaleCompra, simularCompraUpscale, confirmarCompraUpscale } = require('./utils/tenantUpscaleCompra');
const {
  ErrorCancelacion,
  obtenerEstadoCancelacion,
  aplicarDescuentoRetencion,
  pausarSuscripcion,
  registrarEncuestaSalida,
  confirmarCancelacion,
  enviarPropuestaRetencion,
} = require('./utils/cancelacionSuscripcion');
const { ErrorUpgradePlan, listarOpcionesSubirPlan, confirmarSubirPlan } = require('./utils/upgradePlan');
const { evaluarYEnviarAlertaCapacidadDisco } = require('./utils/discoCapacidadAlerta');
const {
  getDiscoAlertaEmail,
  setDiscoAlertaEmail,
  getDiscoTopeTenantMb,
  setDiscoTopeTenantMb,
} = require('./utils/ajustesGlobales');
const { listarReporteCupones } = require('./utils/reporteCupones');
const { listarReporteCancelaciones } = require('./utils/reporteCancelaciones');
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

// Bug real encontrado en vivo (punto en curso, 2026-10-29): el polling de
// "¿ya se confirmó mi pago?" (cada 5s, ver OnboardingModal.tsx) compartía
// el límite de 40/15min de onboardingPublicLimiter — un visitante
// esperando OXXO/SPEI (que el propio código documenta como "minutos a
// días") topaba el límite a los ~3 minutos, y el error 429 quedaba
// silenciado en el frontend (catch sin mostrar nada), dejando la UI
// pegada en "Casi listo" para siempre sin ninguna señal. Límite propio,
// mucho más holgado — es una lectura barata de solo-estado, no una
// escritura — alcanza para polling continuo durante toda la ventana.
const onboardingEstadoPagoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
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
  // El webhook de Stripe vive bajo /api/control por conveniencia de
  // enrutamiento (nginx ya proxea ese prefijo aquí) pero Stripe llama
  // servidor-a-servidor, sin Origin ni sec-fetch-site de navegador — su
  // autenticación real es la firma HMAC que valida el handler mismo
  // (STRIPE_WEBHOOK_SECRET), nunca este gate pensado para el operador
  // logueado desde su propio navegador.
  if (req.path === '/webhooks/stripe' || req.path === '/api/control/webhooks/stripe') return next();
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
// verify: captura el body crudo (Buffer) ANTES de que express.json lo
// parsee — el webhook de Stripe (más abajo) necesita exactamente esos
// bytes para validar la firma con STRIPE_WEBHOOK_SECRET; una vez
// parseado a objeto ya no se puede reconstruir el string original byte a
// byte (JSON.stringify no garantiza el mismo orden/espaciado que Stripe
// firmó). Barato: solo guarda el Buffer, no duplica el trabajo de parseo.
app.use(express.json({ limit: '30mb', verify: (req, res, buf) => { req.rawBody = buf; } }));

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
// Punto en curso (isla de precios): ensanchado de /api/public/onboarding
// a /api/public — misma política de CORS cubre ahora también
// GET /api/public/planes, pensado para el mismo origen (clarvo.mx).
app.use('/api/public', onboardingCors);

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
      const { planClave, ciclo, utmSource } = req.body || {};
      const borrador = await crearBorrador({ planClave, ciclo, utmSource });
      res.status(201).json({ ok: true, borrador });
    } catch (err) {
      if (err instanceof ErrorOnboarding) return res.status(mapearErrorOnboarding(err)).json({ error: err.message });
      throw err;
    }
  })
);

// Punto en curso (isla de precios, opción 1 confirmada — fetch en el
// navegador): fuente real para la ficha pública de cada plan en
// clarvo.mx. Filtra por publicado_sitio=1 — los 3 registros de prueba
// E2E (sin ese flag) y cualquier plan interno sin publicar nunca se
// exponen aquí, mismo criterio anti-enumeración del resto del sitio.
// Lista de columnas explícita (nunca SELECT *): esta ruta no tiene auth,
// cualquier columna nueva de `planes` queda privada hasta que alguien
// decida a propósito agregarla aquí.
app.get(
  '/api/public/planes',
  onboardingPublicLimiter,
  asyncHandler(async (req, res) => {
    const [filas] = await obtenerPool().query(
      `SELECT nombre, descripcion, precio_mensual, precio_anual, max_usuarios, disco_cuota_mb,
              facturacion_habilitada, ventas_habilitado, gastos_habilitado, cxc_habilitado,
              inventarios_habilitado, auditoria_habilitado, portal_clientes_habilitado,
              sucursales_habilitado, marca_lookfeel_habilitado, promociones_habilitado,
              reportes_por_reporte_habilitado, reportes_cortes_habilitado,
              reportes_eliminados_habilitado, reportes_estado_inventario_habilitado,
              reportes_estado_tickets_habilitado
         FROM planes WHERE publicado_sitio = 1 AND activo = 1 ORDER BY orden`
    );
    res.json({ planes: filas });
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

// Punto Stripe ("cobrar primero, activar después" — confirmado por el
// usuario): ESTA ruta ya NO aprovisiona nada directamente — antes
// (POST /api/public/onboarding/convertir/:token) cualquiera con el token
// y un Turnstile válido podía activarse sin pagar. convertirBorrador()
// ahora solo lo invoca control/utils/stripePagos.js, desde el webhook de
// Stripe (o de forma síncrona ahí mismo si el pago ya se confirmó al
// instante) — nunca un endpoint público directo. El frontend usa esta
// ruta para generar el Checkout y, después del redirect, GET
// estado-pago/:token (abajo) para saber cuándo ya se activó.
app.post(
  '/api/public/onboarding/pagar/:token',
  onboardingPublicLimiter,
  asyncHandler(async (req, res) => {
    const verificacion = await verificarTurnstile((req.body || {}).turnstileToken, req.ip);
    if (!verificacion.ok) {
      return res.status(400).json({ error: 'No pudimos verificar que eres humano. Intenta de nuevo.' });
    }
    try {
      const resultado = await crearCheckoutSession(req.params.token);
      res.json({ ok: true, ...resultado });
    } catch (err) {
      if (err instanceof ErrorOnboarding) return res.status(mapearErrorOnboarding(err)).json({ error: err.message });
      throw err;
    }
  })
);

// Polling público (sin datos sensibles): el frontend lo usa después del
// redirect de Stripe para saber si el webhook ya activó la cuenta —
// nunca expone el estado de un tenant por su cuenta, solo lo que YA está
// ligado a este borrador específico (mismo criterio que el resto de
// onboarding: el token es la única llave).
app.get(
  '/api/public/onboarding/estado-pago/:token',
  onboardingEstadoPagoLimiter,
  asyncHandler(async (req, res) => {
    try {
      const borrador = await obtenerEstadoPago(req.params.token);
      const activado = borrador.estado === 'convertido';
      let resultado = null;
      if (activado && borrador.slug) {
        const plan = await resolverPlanPorClave(borrador.plan_clave, obtenerPool());
        const base = (process.env.PUBLIC_APP_BASE_URL || 'https://clarvo.mx').replace(/\/$/, '');
        resultado = {
          slug: borrador.slug,
          urlAdmin: `${base}/${borrador.slug}/admin`,
          urlPortal: !plan || plan.portal_clientes_habilitado ? `${base}/${borrador.slug}` : null,
        };
      }
      res.json({
        pagoEstado: borrador.pago_estado,
        metodoPago: borrador.metodo_pago,
        estado: borrador.estado,
        activado,
        resultado,
      });
    } catch (err) {
      if (err instanceof ErrorOnboarding) return res.status(mapearErrorOnboarding(err)).json({ error: err.message });
      throw err;
    }
  })
);

// Webhook de Stripe — a propósito FUERA de /api/control (bloqueado por
// requireOrigenPropio, pensado para el propio operador logueado) y de
// /api/public/onboarding (CORS angosto a ONBOARDING_CORS_ORIGIN, pensado
// para el navegador del prospecto). Stripe llama server-a-servidor, sin
// Origin de navegador — su autenticación real es la firma HMAC
// (STRIPE_WEBHOOK_SECRET), no un gate de origen/CORS. req.rawBody viene
// del `verify` de express.json() de arriba — Stripe exige el body crudo
// exacto para validar esa firma.
app.post('/api/control/webhooks/stripe', async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    // Fail-closed, mismo criterio que turnstile.js: sin configurar, nunca
    // procesa un evento sin poder verificar de verdad que viene de Stripe.
    return res.status(503).json({ error: 'Webhook de Stripe no configurado.' });
  }
  const Stripe = require('stripe');
  const stripe = new Stripe(stripeKey);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.get('stripe-signature'), webhookSecret);
  } catch (err) {
    console.error('Firma de webhook de Stripe inválida:', err.message);
    return res.status(400).json({ error: 'Firma inválida.' });
  }

  // Responde 200 de inmediato y procesa después — Stripe reintenta con
  // backoff si no recibe 2xx en unos segundos; procesarEventoWebhook() ya
  // es idempotente (stripe_eventos_procesados) así que un reintento
  // nunca duplica nada, pero no hay razón para hacer que Stripe espere el
  // aprovisionamiento completo del tenant.
  res.json({ received: true });
  try {
    await procesarEventoWebhook(event);
  } catch (err) {
    console.error(`Error procesando evento de Stripe "${event.type}" (${event.id}):`, err);
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

// Punto en curso: lista las cuentas perfil administrador de un tenant,
// para la pestaña "Usuarios" del modal de edición — alcance mínimo a
// propósito (decisión del usuario): solo lectura de ese subconjunto,
// nada de editar/suspender/eliminar desde aquí, eso sigue siendo
// exclusivo de /admin → Usuarios. 502 si el backend no respondió (nunca
// se asume una lista vacía a ciegas, mismo criterio que uso-usuarios).
app.get(
  '/api/control/tenants/:slug/usuarios-admin',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const usuarios = await listarUsuariosAdminTenant(req.params.slug);
    if (usuarios == null) {
      return res.status(502).json({ error: 'No se pudo consultar los administradores del tenant.' });
    }
    res.json({ ok: true, usuarios });
  })
);

// Reasigna la cuenta raíz/maestra de un tenant desde /control — el
// autoservicio en /admin → Usuarios se mantiene intacto (ambos caminos
// conviven, decisión del usuario), este es el camino adicional para que
// el super admin lo haga sin pedirle acceso al tenant.
app.put(
  '/api/control/tenants/:slug/usuarios-admin/:id/raiz',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const data = await reasignarRaizTenant(req.params.slug, req.params.id);
      res.json({ ok: true, mensaje: data.mensaje });
    } catch (err) {
      if (err instanceof ErrorReasignarRaiz) {
        const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'validacion' ? 400 : 502;
        return res.status(estatus).json({ error: err.message });
      }
      throw err;
    }
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
      // Editar/reasignar plan puede cambiar disco_cuota_mb — se evalúa en
      // caliente en vez de esperar al intervalo de la próxima hora
      // (fire-and-forget, después de responder: nunca debe retrasar ni
      // tumbar el guardado si el correo de alerta falla).
      evaluarYEnviarAlertaCapacidadDisco().catch((err) => {
        console.error('No se pudo evaluar la alerta de capacidad de disco tras editar el tenant:', err.message);
      });
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

// Capacidad de disco de infraestructura (punto en curso, propuesta
// "Sección C"): cuánto disco físico real se puede repartir entre todos
// los tenants + a dónde avisar al 80% + el tope máximo POR TENANT
// (indistinto del plan, 2026-10-27). GET regresa ajustes + el resumen
// calculado (comprometido/disponible/semáforo/desglose/capacidadFuente)
// en una sola llamada. `capacidad_total_mb` YA NO se guarda desde aquí —
// se lee en vivo de Garage dentro de `calcularResumenCapacidad()`
// (ver `resumen.capacidadTotalMb`/`resumen.capacidadFuente`).
app.get(
  '/api/control/ajustes/disco-capacidad',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const [alertaEmail, topeTenantMb, resumen] = await Promise.all([
      getDiscoAlertaEmail(),
      getDiscoTopeTenantMb(),
      calcularResumenCapacidad(),
    ]);
    res.json({ alerta_email: alertaEmail, tope_tenant_mb: topeTenantMb, resumen });
  })
);

app.put(
  '/api/control/ajustes/disco-capacidad',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    try {
      if (body.alerta_email !== undefined) {
        await setDiscoAlertaEmail(body.alerta_email);
      }
      if (body.tope_tenant_mb !== undefined) {
        await setDiscoTopeTenantMb(body.tope_tenant_mb);
      }
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const resumen = await calcularResumenCapacidad();
    // Guardar un ajuste de capacidad puede cruzar el umbral de inmediato
    // (bajar la capacidad total, por ejemplo) — se evalúa en caliente en
    // vez de esperar al intervalo de la próxima hora.
    evaluarYEnviarAlertaCapacidadDisco().catch((err) => {
      console.error('No se pudo evaluar la alerta de capacidad de disco tras guardar ajustes:', err.message);
    });
    res.json({ ok: true, resumen });
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
  if (err.codigo === 'tiene_empresas') return 409;
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

// Eliminar: soft-delete permanente, solo si ya está archivado y con 0
// empresas asignadas — ver eliminarPlan() en utils/planes.js. 409 (no
// 400) cuando el candado es "tiene empresas", para que el frontend
// distinga ese caso de un error de validación genérico.
app.delete(
  '/api/control/planes/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await eliminarPlan(Number(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ErrorPlan) {
        return res.status(mapearErrorPlan(err)).json({ error: err.message, codigo: err.codigo });
      }
      throw err;
    }
  })
);

// ---------- Punto en curso: catálogo de funcionalidades upscale ----------
app.get(
  '/api/control/upscale',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const items = await listarUpscale();
    res.json({ items });
  })
);

app.post(
  '/api/control/upscale',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const item = await crearUpscale(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      if (err instanceof ErrorUpscale) return res.status(err.codigo === 'no_encontrado' ? 404 : 400).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/upscale/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const item = await editarUpscale(Number(req.params.id), req.body || {});
      res.json({ ok: true, item });
    } catch (err) {
      if (err instanceof ErrorUpscale) return res.status(err.codigo === 'no_encontrado' ? 404 : 400).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/upscale/:id/archivar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await archivarUpscale(Number(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ErrorUpscale) return res.status(err.codigo === 'no_encontrado' ? 404 : 400).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/upscale/:id/reactivar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await reactivarUpscale(Number(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ErrorUpscale) return res.status(err.codigo === 'no_encontrado' ? 404 : 400).json({ error: err.message });
      throw err;
    }
  })
);

// ---------- Compra de upscale de almacenamiento, llamada desde backend ----------
// El admin del tenant NUNCA tiene credenciales de /control — compra su
// upscale desde Mi Cuenta (backend), que llama a estos 2 endpoints
// internos con el mismo secreto compartido que ya protege
// notificarInvalidacionCache/activarTenantFisico (primera vez que la
// llamada va en sentido backend→control, no al revés — mismo mecanismo,
// dirección nueva).
function secretoInternoValido(req) {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  const recibido = req.get('X-Internal-Secret') || '';
  if (!secretoEsperado) return false;
  const bufEsperado = Buffer.from(secretoEsperado);
  const bufRecibido = Buffer.from(recibido);
  if (bufEsperado.length !== bufRecibido.length) {
    crypto.timingSafeEqual(bufEsperado, bufEsperado);
    return false;
  }
  return crypto.timingSafeEqual(bufEsperado, bufRecibido);
}

app.post('/internal/upscale/simular', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug, tipo, cantidad } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug es obligatorio.' });
  try {
    const resumen = await simularCompraUpscale(slug, tipo || 'disco', Number(cantidad) || 1);
    res.json({ ok: true, resumen });
  } catch (err) {
    if (err instanceof ErrorUpscaleCompra) {
      const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'sin_catalogo' ? 409 : 400;
      return res.status(estatus).json({ error: err.message, codigo: err.codigo });
    }
    throw err;
  }
}));

// Nota: successUrl/cancelUrl ya NO son obligatorios aquí — solo los usa
// la rama tipo_cobro='unico' (Checkout de una sola vez). La rama
// recurrente (hoy la única real en el catálogo) cobra de inmediato vía
// Subscription Item, sin ningún redirect.
app.post('/internal/upscale/confirmar', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug, tipo, cantidad, successUrl, cancelUrl } = req.body || {};
  if (!slug) {
    return res.status(400).json({ error: 'slug es obligatorio.' });
  }
  try {
    const resultado = await confirmarCompraUpscale(slug, tipo || 'disco', Number(cantidad) || 1, { successUrl, cancelUrl });
    res.json(resultado);
  } catch (err) {
    if (err instanceof ErrorUpscaleCompra) {
      const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'sin_catalogo' ? 409 : 400;
      return res.status(estatus).json({ error: err.message, codigo: err.codigo });
    }
    throw err;
  }
}));

// ---------- Cancelación de suscripción con retención (A2+A1) + encuesta de salida (C1) ----------
// Mismo patrón backend->control que /internal/upscale/* arriba — el
// admin raíz está autenticado en backend/, pero stripe_subscription_id,
// el candado de "descuento ya usado" y la Subscription real viven en
// control_tenants. Siempre llamado por un admin raíz ya validado en
// backend/ (ver backend/server.js) — este secreto es la única barrera
// aquí, igual que el resto de /internal/*.
function manejarErrorCancelacion(err, res) {
  if (err instanceof ErrorCancelacion) {
    const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'sin_suscripcion' ? 409 : 400;
    return res.status(estatus).json({ error: err.message, codigo: err.codigo });
  }
  throw err;
}

app.post('/internal/suscripcion/estado-cancelacion', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug es obligatorio.' });
  try {
    res.json({ ok: true, ...(await obtenerEstadoCancelacion(slug)) });
  } catch (err) {
    manejarErrorCancelacion(err, res);
  }
}));

app.post('/internal/suscripcion/descuento-retencion', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug, actor } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug es obligatorio.' });
  try {
    res.json(await aplicarDescuentoRetencion(slug, { actor }));
  } catch (err) {
    manejarErrorCancelacion(err, res);
  }
}));

app.post('/internal/suscripcion/pausar', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug, actor } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug es obligatorio.' });
  try {
    res.json(await pausarSuscripcion(slug, { actor }));
  } catch (err) {
    manejarErrorCancelacion(err, res);
  }
}));

app.post('/internal/suscripcion/encuesta-salida', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug, motivo, comentario } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug es obligatorio.' });
  try {
    res.json(await registrarEncuestaSalida(slug, { motivo, comentario }));
  } catch (err) {
    manejarErrorCancelacion(err, res);
  }
}));

app.post('/internal/suscripcion/cancelar', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug, actor } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug es obligatorio.' });
  try {
    res.json(await confirmarCancelacion(slug, { actor }));
  } catch (err) {
    manejarErrorCancelacion(err, res);
  }
}));

// ---------- Subir de plan desde Mi Cuenta (D1) — self-service, complementa (no reemplaza) el modal "Editar empresa" de /control ----------
app.post('/internal/suscripcion/opciones-plan', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug es obligatorio.' });
  try {
    res.json({ ok: true, ...(await listarOpcionesSubirPlan(slug)) });
  } catch (err) {
    if (err instanceof ErrorUpgradePlan) {
      const estatus = err.codigo === 'no_encontrado' ? 404 : 400;
      return res.status(estatus).json({ error: err.message, codigo: err.codigo });
    }
    throw err;
  }
}));

app.post('/internal/suscripcion/subir-plan', asyncHandler(async (req, res) => {
  if (!secretoInternoValido(req)) return res.status(403).json({ error: 'No autorizado.' });
  const { slug, planId, actor } = req.body || {};
  if (!slug || !planId) return res.status(400).json({ error: 'slug y planId son obligatorios.' });
  try {
    res.json(await confirmarSubirPlan(slug, planId, { actor }));
  } catch (err) {
    if (err instanceof ErrorUpgradePlan) {
      const estatus = err.codigo === 'no_encontrado' ? 404 : err.codigo === 'sin_suscripcion' ? 409 : 400;
      return res.status(estatus).json({ error: err.message, codigo: err.codigo });
    }
    throw err;
  }
}));

// ---------- Punto en curso: configuración de Stripe (MSI, métodos, descuentos) ----------
app.get(
  '/api/control/stripe/msi',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    res.json(await getConfigMsi());
  })
);

app.put(
  '/api/control/stripe/msi',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const resultado = await setConfigMsi(req.body || {});
      res.json({ ok: true, ...resultado });
    } catch (err) {
      if (err.codigo === 'validacion') return res.status(400).json({ error: err.message });
      throw err;
    }
  })
);

app.get(
  '/api/control/stripe/metodos-pago',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    // Punto en curso: el panel "Métodos de pago" se fusiona con un
    // resumen real de monetización (opciones D2+D3 de la propuesta
    // visual aprobada) — 3 cifras que YA existen en sus propios módulos
    // (Reporte de cupones, Recordatorios, catálogo Upscale), solo
    // reutilizadas aquí, nunca recalculadas con otro criterio.
    const [upscaleActivas, enSeguimiento, cupones] = await Promise.all([
      listarUpscale({ soloActivos: true }),
      listarEnSeguimiento(),
      listarReporteCupones(),
    ]);
    const ingresoCupones = cupones.reduce((acc, c) => acc + (Number(c.ingreso) || 0), 0);
    res.json({
      ...metodosPagoInfo(),
      resumenMonetizacion: {
        ingresoCupones: Math.round(ingresoCupones * 100) / 100,
        borradoresEnSeguimiento: enSeguimiento.length,
        upscaleActivas: upscaleActivas.length,
      },
    });
  })
);

app.get(
  '/api/control/stripe/descuentos',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      res.json({ items: await listarCodigosDescuento() });
    } catch (err) {
      if (err.codigo === 'no_configurado') return res.status(503).json({ error: err.message });
      throw err;
    }
  })
);

app.post(
  '/api/control/stripe/descuentos',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const item = await crearCodigoDescuento(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      if (err.codigo === 'validacion' || err.codigo === 'no_configurado') {
        return res.status(err.codigo === 'no_configurado' ? 503 : 400).json({ error: err.message });
      }
      // Errores propios de la API de Stripe (ej. código ya existe) — mensaje
      // tal cual, Stripe ya los redacta en español/inglés según la cuenta.
      if (err.type && err.type.startsWith('Stripe')) return res.status(400).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/stripe/descuentos/:id/desactivar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await desactivarCodigoDescuento(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      if (err.codigo === 'no_configurado') return res.status(503).json({ error: err.message });
      if (err.type && err.type.startsWith('Stripe')) return res.status(400).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/stripe/descuentos/:id/activar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await activarCodigoDescuento(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      if (err.codigo === 'validacion' || err.codigo === 'no_configurado') {
        return res.status(err.codigo === 'no_configurado' ? 503 : 400).json({ error: err.message });
      }
      if (err.type && err.type.startsWith('Stripe')) return res.status(400).json({ error: err.message });
      throw err;
    }
  })
);

app.delete(
  '/api/control/stripe/descuentos/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      await eliminarCodigoDescuento(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      if (err.codigo === 'validacion' || err.codigo === 'no_configurado') {
        return res.status(err.codigo === 'no_configurado' ? 503 : 400).json({ error: err.message });
      }
      if (err.type && err.type.startsWith('Stripe')) return res.status(400).json({ error: err.message });
      throw err;
    }
  })
);

app.put(
  '/api/control/stripe/descuentos/:id/reemplazar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const item = await reemplazarCodigoDescuento(req.params.id, req.body || {});
      res.json({ ok: true, item });
    } catch (err) {
      if (err.codigo === 'validacion' || err.codigo === 'no_configurado') {
        return res.status(err.codigo === 'no_configurado' ? 503 : 400).json({ error: err.message });
      }
      if (err.type && err.type.startsWith('Stripe')) return res.status(400).json({ error: err.message });
      throw err;
    }
  })
);

// ---------- Punto en curso: recordatorios de activación ----------
app.get(
  '/api/control/recordatorios/config',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    res.json(await getConfigRecordatorios());
  })
);

app.put(
  '/api/control/recordatorios/config',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      res.json({ ok: true, ...(await setConfigRecordatorios(req.body || {})) });
    } catch (err) {
      if (err.codigo === 'validacion') return res.status(400).json({ error: err.message });
      throw err;
    }
  })
);

app.get(
  '/api/control/recordatorios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    res.json({ items: await listarEnSeguimiento() });
  })
);

// Botón "Procesar ahora" — mismo trabajo que el scheduler automático,
// para probar sin esperar la siguiente vuelta de la hora.
app.post(
  '/api/control/recordatorios/procesar-ahora',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    res.json({ ok: true, ...(await procesarRecordatoriosPendientes()) });
  })
);

// ---------- Punto en curso: reporte de cupones ----------
app.get(
  '/api/control/reportes/cupones',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    res.json({ items: await listarReporteCupones() });
  })
);

// ---------- Sección E (propuesta E1): reporte de cancelaciones ----------
app.get(
  '/api/control/reportes/cancelaciones',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    res.json(await listarReporteCancelaciones());
  })
);

// Propuesta de retención por correo — disparo manual del operador desde
// el reporte, nunca automático (reemplaza "Subir plan", que no tenía
// sentido para un tenant que ya cancela).
app.post(
  '/api/control/cancelaciones/:slug/propuesta',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      res.json(await enviarPropuestaRetencion(req.params.slug, { actor: req.adminUser }));
    } catch (err) {
      if (err instanceof ErrorCancelacion) {
        const estatus = err.codigo === 'no_encontrado' ? 404 : 400;
        return res.status(estatus).json({ error: err.message, codigo: err.codigo });
      }
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
  const { asegurarTablaApiCredenciales, asegurarTablasSucursales, asegurarTablaPlanes, asegurarTablaAjustesGlobales, asegurarTablaOnboardingBorradores, asegurarTablaStripeEventos, asegurarTablaUpscale, asegurarTablaUpscaleActivos, asegurarTablaCancelacionesEncuesta } = require('./scripts/ensureSchema');
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
  await asegurarTablaStripeEventos(obtenerPool());
  await asegurarTablaUpscale(obtenerPool());
  await asegurarTablaUpscaleActivos(obtenerPool());
  await asegurarTablaCancelacionesEncuesta(obtenerPool());

  app.listen(PORT, () => {
    console.log(`Control escuchando en el puerto ${PORT}`);
  });

  iniciarPurgaAutomatica();
  iniciarRecordatoriosAutomaticos();
  iniciarAlertaCapacidadDiscoAutomatica();
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

// Recordatorios de activación: mismo criterio de fondo que la purga de
// arriba (sin cron externo). Cada hora alcanza para que la regla de
// "OXXO/SPEI siempre cada 24h" tenga margen de sobra sin esperar casi un
// día completo a que corra — procesarRecordatoriosPendientes() ya decide
// internamente, por borrador, si de verdad toca enviar algo en esta
// vuelta.
const INTERVALO_RECORDATORIOS_MS = 60 * 60 * 1000;
let recordatoriosEnCurso = false;

function iniciarRecordatoriosAutomaticos() {
  const ejecutar = async () => {
    if (recordatoriosEnCurso) return;
    recordatoriosEnCurso = true;
    try {
      const { enviados, archivados } = await procesarRecordatoriosPendientes();
      if (enviados || archivados) {
        console.log(`Recordatorios de activación: ${enviados} enviado(s), ${archivados} borrador(es) archivado(s) por agotar intentos.`);
      }
    } catch (err) {
      console.error('Error corriendo los recordatorios de activación:', err.message);
    } finally {
      recordatoriosEnCurso = false;
    }
  };

  setTimeout(ejecutar, 45 * 1000);
  setInterval(ejecutar, INTERVALO_RECORDATORIOS_MS);
}

// Capacidad de disco (punto en curso): mismo criterio que los
// recordatorios de arriba — sin cron externo, un intervalo en proceso
// alcanza. Cada hora porque el cambio típico (asignar/editar un plan de
// tenant) ya dispara una evaluación inmediata aparte (ver
// tenantEdicion.js) — este intervalo es solo el respaldo para cuando el
// cruce del umbral lo provoca un ajuste de la capacidad total configurada
// en vez de un cambio de tenant.
const INTERVALO_DISCO_CAPACIDAD_MS = 60 * 60 * 1000;
let discoCapacidadEnCurso = false;

function iniciarAlertaCapacidadDiscoAutomatica() {
  const ejecutar = async () => {
    if (discoCapacidadEnCurso) return;
    discoCapacidadEnCurso = true;
    try {
      await evaluarYEnviarAlertaCapacidadDisco();
    } catch (err) {
      console.error('Error evaluando la capacidad de disco:', err.message);
    } finally {
      discoCapacidadEnCurso = false;
    }
  };

  setTimeout(ejecutar, 60 * 1000);
  setInterval(ejecutar, INTERVALO_DISCO_CAPACIDAD_MS);
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
