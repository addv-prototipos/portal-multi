require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const { pool, ensureSchema, cerrarTodosLosPoolsTenant, ejecutarComoTenant } = require('./db');
const { resolverTenantMiddleware, resolverTenantPorSlug, invalidarCacheTenant } = require('./utils/tenantContext');
const { validarSlug } = require('./utils/tenant');
const storage = require('./utils/storage');
const {
  parsearTemaDesdeFila,
  temaAVariables,
  fuentesAUrlGoogle,
} = require('./utils/tenantTema');
const { requireAdminAuth, requireAdminArea, requireUsuarioAdminExacto } = require('./utils/auth');
const { asegurarTablaAuditoria, registrarAccesoAdmin } = require('./utils/adminAuditoria');
const {
  hashPassword,
  verifyPassword,
  validarPassword,
  requireUserAuth,
  obtenerRfcSesionOpcional,
  establecerCookieSesion,
  limpiarCookieSesion,
} = require('./utils/authUsuario');
const {
  CAMPOS_CONFIGURABLES,
  getCamposObligatorios,
  setCamposObligatorios,
  getRetencionTicketsDias,
  setRetencionTicketsDias,
  ZONAS_HORARIAS_MEXICO,
  getConfiguracionGlobal,
  setConfiguracionGlobal,
  formatearFechaHoraMexico,
} = require('./utils/config');
const {
  extraerTextoPdf,
  pareceConstanciaFiscal,
  extraerCodigoPostal,
  extraerRFC,
  extraerRegimenesFiscales,
  determinarTipoPersona,
  extraerNombreRazonSocial,
} = require('./utils/pdfExtract');
const {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_ZIP_MIME_TYPES,
  ALLOWED_ZIP_EXTENSIONS,
  detectRealMimeType,
  detectRealImageMimeType,
  esZipValido,
  zipContienePdfYXml,
  sanitizeText,
  sanitizeTextoLibre,
  isValidEmail,
  isValidRFC,
  isValidRFCRequerido,
  isValidTelefono,
  isValidTipoPersona,
} = require('./utils/validate');
const {
  getUsosCfdi,
  getInfoSincronizacion,
  sincronizarDesdeOrigen,
} = require('./utils/usoCfdi');
const { getConfigSmtp, setConfigSmtp, configSmtpParaMostrar, enviarCorreo, aplicarPlantilla, DEFAULTS_SMTP } = require('./utils/email');
const {
  ejecutarLimpiezaConReporte,
  getInfoUltimaLimpieza,
  CLAVE_ULTIMA_LIMPIEZA_TICKETS,
  CLAVE_ULTIMA_LIMPIEZA_ORDENES,
} = require('./utils/ticketsCleanup');
const { generarYEnviarReporte, generarCSV, generarExcelBuffer } = require('./utils/reportes');

const PORT = process.env.PORT || 4000;
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 5);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
// VESTIGIAL desde el segmento 5 del plan multi-tenant (ver
// PROJECT_STATE.md): ningún archivo se lee/escribe/borra de este
// directorio ya — todo el almacenamiento de constancias/tickets/facturas
// se movió a MinIO (ver backend/utils/storage.js). Se deja esta creación
// de carpetas sin tocar a propósito (es inofensiva, y quitarla implica
// tocar también el bind mount de docker-compose.yml y el
// chown/entrypoint que dependen de él) — limpieza de infraestructura
// pendiente, documentada como tal, no confundir con que el almacenamiento
// siga viviendo aquí.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const TICKETS_UPLOAD_DIR = path.join(UPLOAD_DIR, 'tickets');
const FACTURAS_UPLOAD_DIR = path.join(UPLOAD_DIR, 'facturas');
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(TICKETS_UPLOAD_DIR)) {
  fs.mkdirSync(TICKETS_UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(FACTURAS_UPLOAD_DIR)) {
  fs.mkdirSync(FACTURAS_UPLOAD_DIR, { recursive: true });
}

const app = express();

// El backend solo es alcanzable a través de nginx (no expone su puerto al
// host — ver docker-compose.yml), así que confiar en los encabezados
// X-Forwarded-* es seguro: nginx es la única fuente posible de peticiones.
// Esto hace que `req.protocol` refleje el protocolo real que usó el
// cliente (http/https) en vez de siempre "http" (que es lo que ve el
// backend en el salto interno nginx → backend). Se usa para construir la
// URL del portal en el correo de invitación (ver enviarInvitacionPortal),
// para que funcione igual en localhost, una IP de red local, o un dominio
// real con HTTPS, sin necesidad de configurar una URL fija a mano.
//
// El valor es `1` (confiar exactamente UN salto — nginx, el único que
// existe en este docker-compose), no `true`. `true` confía en TODA la
// cadena de proxies sin límite, lo que a su vez le permite a cualquiera
// mandar su propio encabezado X-Forwarded-For falso y hacerse pasar por
// otra IP — express-rate-limit (ver adminApiLimiter/adminLoginLimiter/
// submitLimiter/authLimiter más abajo, todos limitan por IP) lo señala
// explícitamente como un hueco de seguridad real: con `true`, alguien
// podría evadir el límite de intentos de fuerza bruta del login solo
// cambiando ese encabezado en cada intento.
app.set('trust proxy', 1);

app.use(helmet());
// `credentials: true` es necesario para que las cookies de sesión de
// usuario viajen en peticiones entre origenes distintos. En el despliegue
// normal (nginx sirviendo el frontend y reenviando /api al backend) el
// navegador ve todo como el mismo origen, así que esto no aplica; solo
// importa si consumes la API desde un dominio distinto — en ese caso,
// define CORS_ORIGIN con ese dominio exacto (no "*", que los navegadores
// rechazan combinado con credenciales).
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
// Límite de body amplio a propósito: el logo de marca del tenant llega
// aquí como base64 desde el contenedor "control" (hasta
// MAX_MARCA_LOGO_MB = 2 MB de archivo, ~2.7 MB de texto base64) — ver
// POST /internal/marca-logo/:slug más abajo. Las rutas que reciben
// archivos usan multer con sus propios límites, y cada ruta valida el
// tamaño real de lo que recibe.
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
// Multi-tenant (segmento 3, ver PROJECT_STATE.md): resuelve `req.tenant` y
// el pool de MySQL activo a partir del encabezado `X-Tenant-Slug`. Montado
// antes que cualquier ruta para que TODO lo que sigue (rate limiters,
// requireUserAuth, requireAdminAuth, las rutas mismas) pueda usar
// `req.tenant`. No-op para cualquier petición sin ese encabezado — es
// decir, para todo el tráfico real hoy.
app.use(resolverTenantMiddleware);

// Multi-tenant (bug encontrado durante la verificación funcional del
// segmento 9c — ver PROJECT_STATE.md): el AsyncLocalStorage de
// `ejecutarComoTenant` NO se propaga de forma confiable al callback de
// multer/busboy. El stream del request lo crea el HTTP server FUERA del
// `almacenTenant.run(...)` del middleware, y los eventos de busboy se
// despachan en ese contexto, así que `almacenTenant.getStore()` puede
// devolver undefined dentro del callback (es una carrera: unas veces
// heredaba el store y otras no). Eso hacía que `pool.query(...)` dentro de
// los callbacks de multer cayera al pool por defecto y escribiera en la BD
// equivocada (registros/tickets de un tenant en `portal_facturacion`).
//
// Solución: el middleware deja el pool del tenant en `req.poolTenant`
// (ver tenantContext.js), y `subirConTenant` envuelve el callback de
// multer para re-entrar al contexto del tenant antes de ejecutar el
// handler — determinista, sin depender de la propagación del ALS.
function reanudarContextoTenant(req, fn) {
  if (req && req.poolTenant) return ejecutarComoTenant(req.poolTenant, fn);
  return fn();
}

function subirConTenant(multerUpload, campo, req, res, cb) {
  multerUpload.single(campo)(req, res, (err) => reanudarContextoTenant(req, () => cb(err)));
}

// Multi-tenant (segmento 7, ver PROJECT_STATE.md): la clave de cada
// limiter de abajo pasa de ser solo la IP a "tenant:IP" — sin esto, una
// IP compartida (NAT corporativo, proxy) que interactúa con DOS tenants
// distintos compartiría la MISMA cuota entre ambos, causando throttling
// cruzado entre clientes que ni se conocen entre sí. Sin tenant resuelto
// (todo el tráfico real hoy, hasta que nginx mande X-Tenant-Slug — ver
// segmento 4), la clave sigue siendo efectivamente "por IP" (el prefijo
// "sin-tenant:" es el mismo para todos), así que el comportamiento actual
// no cambia.
function claveTenantIp(req) {
  return `${req.tenant ? req.tenant.slug : 'sin-tenant'}:${req.ip}`;
}

// Limita solicitudes al endpoint de envio para mitigar abuso/DoS
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveTenantIp,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' },
});

// Limita intentos de acceso al panel de administracion para mitigar fuerza bruta.
// Se usa SOLO en /api/admin/login — el único endpoint donde alguien
// SIN sesión válida todavía puede estar probando contraseñas.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveTenantIp,
  message: { error: 'Demasiados intentos. Intenta de nuevo mas tarde.' },
});

// Multi-tenant (segmento 7): además del límite por tenant+IP de arriba,
// un límite AGREGADO por tenant (sin IP) para /api/auth/login y
// /api/admin/login — un ataque de fuerza bruta distribuido contra el
// admin de UN tenant desde muchas IPs distintas no queda acotado solo
// con el límite por IP individual. Techo mucho más alto que los límites
// por IP (no busca frenar uso legítimo, solo un volumen agregado
// anómalo). `skip` cuando no hay tenant resuelto: sin esto, TODO el
// tráfico real de hoy (que nunca trae tenant) compartiría un solo
// balde "sin-tenant" global — un límite nuevo que no existía antes de
// este segmento. Con el skip, este limiter es un no-op hasta que el
// segmento 4 esté en producción de verdad (nginx mandando el encabezado).
const tenantAggregateAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.tenant ? req.tenant.slug : 'sin-tenant'),
  skip: (req) => !req.tenant,
  message: { error: 'Demasiados intentos para este tenant. Intenta de nuevo mas tarde.' },
});

// Limita el resto de los endpoints del panel (los otros 45, todos
// protegidos por requireAdminAuth) — mucho más permisivo que el de
// login a propósito. Antes ESTE MISMO límite (50 cada 15 min) se
// compartía con el de login, y con eso el panel se quedaba sin cuota
// en cuestión de minutos con el uso normal: solo cargar el panel al
// iniciar sesión ya dispara varias peticiones en paralelo (config
// fiscal, campos obligatorios, catálogo de Uso de CFDI, notificación de
// tickets pendientes, la tabla de Constancias...), y cada vista nueva
// que se visita agrega varias más — con varias personas usando el
// panel a la vez (o incluso una sola persona navegando activamente
// entre vistas), 50 en 15 minutos se agota rápido. Esto es lo que
// causaba el "429 Too Many Requests" y la sensación de que "el sistema
// deja de responder" — no era un problema de memoria ni del contenedor
// en sí, por lo que aumentar la memoria del contenedor no lo arreglaba.
// Sigue habiendo un límite (no es ilimitado) para protegerse de un
// posible abuso, solo que uno que de verdad alcanza para uso legítimo.
const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveTenantIp,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' },
});

// Segmento 7 (seguridad multi-tenant): adminLoginLimiter arriba solo cubre
// GET /api/admin/login, pero Basic Auth manda las credenciales en CADA
// petición — sin esto, alguien puede probar contraseñas directo contra
// cualquiera de los otros ~45 endpoints de /api/admin/*, que solo tienen
// adminApiLimiter (pensado para no estorbar uso legítimo, no para frenar
// fuerza bruta: 2000 intentos en 15 min). skipSuccessfulRequests evita que
// uso normal (200) consuma la cuota — solo credenciales incorrectas (401)
// la gastan.
const adminCredencialesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveTenantIp,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos fallidos. Intenta de nuevo mas tarde.' },
});

// Limita login/registro para mitigar fuerza bruta y registros automatizados
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveTenantIp,
  message: { error: 'Demasiados intentos. Intenta de nuevo mas tarde.' },
});

// Multer: se guarda en memoria para poder validar el contenido real
// del archivo (magic numbers) antes de escribirlo a disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error('TIPO_NO_PERMITIDO'));
      return;
    }
    cb(null, true);
  },
});

// Uploader separado para tickets: acepta imagenes (jpg/png/webp) en vez de
// PDF, ya que un ticket de compra es una foto, no un documento oficial.
const uploadImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      cb(new Error('TIPO_NO_PERMITIDO'));
      return;
    }
    cb(null, true);
  },
});

// Uploader para que el admin suba la factura ya generada de un ticket. Va
// comprimida en un ZIP porque un CFDI real siempre se entrega como el par
// PDF + XML, y un <input type="file"> normal no permite adjuntar dos
// archivos a la vez — así que se piden juntos dentro de un solo ZIP. El
// filtro aquí es de extensión/MIME declarados (rápido, buena UX); la
// verificación real de contenido (firma binaria) pasa después, dentro del
// handler — ver esZipValido en utils/validate.js.
const uploadFactura = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_ZIP_MIME_TYPES.has(file.mimetype) || !ALLOWED_ZIP_EXTENSIONS.has(ext)) {
      cb(new Error('TIPO_NO_PERMITIDO'));
      return;
    }
    cb(null, true);
  },
});

function extensionForMime(mime) {
  return mime === 'application/pdf' ? '.pdf' : '';
}

// Envuelve un handler async para mandar cualquier error no controlado a una
// respuesta 500 en vez de dejarlo como una promesa rechazada sin atender
// (Express 4 no hace esto automaticamente para handlers async).
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

// Segmento 7 (seguridad multi-tenant): sin caché en respuestas de API.
// El diseño actual ya es seguro por construcción (el slug vive en la URL,
// /<slug>/api/..., así que un cache por URL nunca mezcla tenants) — esto
// es defensa en profundidad para el día que se agregue un CDN/proxy
// compartido delante de nginx.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/api/admin', adminCredencialesLimiter);

// Segmento 7 (seguridad multi-tenant): auditoría de uso de las rutas
// admin — quién (actor + mecanismo: admin_users/fallback_admin/perfil_bd),
// cuándo, sobre qué tenant, qué acción, con qué resultado. Solo mutaciones
// (POST/PUT/DELETE) más siempre /login — auditar cada GET de las ~45
// rutas de lectura generaría ruido sin valor de seguridad proporcional.
// `res.on('finish', ...)` se registra ANTES de que la ruta corra, pero se
// dispara DESPUÉS de que toda la cadena (incluyendo requireAdminAuth, que
// pone req.adminUser/req.adminMecanismo) haya terminado — así que para
// entonces esos campos ya están poblados si la autenticación llegó a
// resolverse. Fire-and-forget: un fallo al auditar nunca debe tumbar la
// respuesta real que ya se mandó.
app.use('/api/admin', (req, res, next) => {
  res.on('finish', () => {
    if (req.method === 'GET' && req.path !== '/login') return;
    if (!req.adminUser) return;
    registrarAccesoAdmin({
      actor: req.adminUser,
      mecanismo: req.adminMecanismo,
      perfil: req.adminPerfil,
      tenantSlug: req.tenant ? req.tenant.slug : null,
      metodo: req.method,
      ruta: req.path,
      estatus: res.statusCode,
      ip: req.ip,
    }).catch((err) => console.error('No se pudo auditar el acceso admin:', err.message));
  });
  next();
});

// Segmento 9b: endpoint interno para que el servicio "control" (contenedor
// propio, ver PROJECT_STATE.md) pueda invalidar la caché de resolución de
// tenant de ESTE proceso después de suspender/reactivar/dar de baja un
// tenant — antes (cuando /control vivía en este mismo proceso) bastaba
// llamar invalidarCacheTenant() directamente; ahora son dos contenedores
// distintos, así que esta llamada HTTP es el reemplazo. NO se expone por
// nginx (no hay ningún location que la proxee desde afuera) — solo
// alcanzable en la red interna de Docker, o por la URL que defina
// BACKEND_INTERNAL_URL en el contenedor "control" si éste corre en un
// servidor aparte. Protegido por un secreto compartido (mismo valor en
// ambos contenedores) en vez de dejarlo abierto a cualquiera que lo
// encuentre.
app.post('/internal/cache-tenant/invalidar', (req, res) => {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  if (!secretoEsperado || req.get('X-Internal-Secret') !== secretoEsperado) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  invalidarCacheTenant((req.body && req.body.slug) || null);
  res.json({ ok: true });
});

// ---------- Logo de marca del tenant (segmento "marca") ----------
// El logo de la marca de cada empresa vive en MinIO (mismo bucket
// compartido, key "marca/<slug>/logo") y se referencia en
// control_tenants.tenants.marca_logo_url como ruta RELATIVA
// ("/api/marca-logo/<slug>") — el backend la convierte a absoluta con
// detectarUrlPortal(req) al armar los correos. El GET público sirve el
// archivo con cache largo (es un logo: va en correos, no es sensible).
const MAX_MARCA_LOGO_MB = Number(process.env.MAX_MARCA_LOGO_MB || 2);
const MAX_MARCA_LOGO_BYTES = MAX_MARCA_LOGO_MB * 1024 * 1024;

// Sube el logo de marca de un tenant. Solo el contenedor "control" lo usa
// (el administrador de control carga el logo y este servicio lo persiste
// en MinIO) — misma protección por secreto compartido que
// /internal/cache-tenant/invalidar, y NO se expone por nginx. El logo
// llega como base64 en el body (el contenedor control no tiene SDK S3 ni
// multer; ya depende de este endpoint interno para la caché). La key no
// lleva extensión: el Content-Type se guarda como metadata del objeto y
// el GET público lo devuelve tal cual.
app.post('/internal/marca-logo/:slug', (req, res) => {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  if (!secretoEsperado || req.get('X-Internal-Secret') !== secretoEsperado) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  const body = req.body || {};
  const base64 = typeof body.base64 === 'string' ? body.base64 : '';
  if (!base64) {
    return res.status(400).json({ error: 'Falta el contenido del logo (base64).' });
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (err) {
    return res.status(400).json({ error: 'El contenido del logo no es un base64 válido.' });
  }
  if (buffer.length === 0) {
    return res.status(400).json({ error: 'El logo está vacío.' });
  }
  if (buffer.length > MAX_MARCA_LOGO_BYTES) {
    return res.status(413).json({ error: `El logo excede el tamaño máximo permitido de ${MAX_MARCA_LOGO_MB} MB.` });
  }

  // Se valida el contenido real (firma binaria), no solo el MIME que manda
  // el cliente — mismo criterio que las imágenes de tickets.
  const mimeReal = detectRealImageMimeType(buffer);
  if (!mimeReal) {
    return res.status(400).json({ error: 'El archivo no es una imagen válida (JPG, PNG o WEBP).' });
  }

  storage
    .guardarArchivo('marca', slug, 'logo', buffer, mimeReal)
    .then(() => {
      res.json({ ok: true, url: `/api/marca-logo/${slug}` });
    })
    .catch((err) => {
      console.error(`Error guardando el logo de marca del tenant "${slug}":`, err);
      res.status(500).json({ error: 'No se pudo guardar el logo.' });
    });
});

// Borra el logo de marca de un tenant de MinIO. Lo usa el contenedor
// "control" cuando el administrador quita el logo (misma protección por
// secreto que el POST de arriba). La fila de control la actualiza el
// propio control; aquí solo se elimina el archivo.
app.delete('/internal/marca-logo/:slug', (req, res) => {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  if (!secretoEsperado || req.get('X-Internal-Secret') !== secretoEsperado) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  storage
    .eliminarArchivo('marca', slug, 'logo')
    .then(() => res.json({ ok: true }))
    .catch((err) => {
      console.error(`Error borrando el logo de marca del tenant "${slug}":`, err);
      res.status(500).json({ error: 'No se pudo borrar el logo.' });
    });
});

// ---------- Favicon del tenant (segmento "Look & Feel") ----------
// Mismo patrón que el logo de marca: la imagen vive en MinIO (key
// "marca/<slug>/favicon") y se referencia en el tema como ruta relativa
// ("/api/favicon/<slug>"). Solo el contenedor "control" sube/borra (por
// endpoint interno con secreto compartido); el GET público sirve el
// archivo con cache largo. Se aceptan los mismos formatos que el logo
// (JPG/PNG/WEBP), validados por firma binaria.

// Sube el favicon de un tenant.
app.post('/internal/favicon/:slug', (req, res) => {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  if (!secretoEsperado || req.get('X-Internal-Secret') !== secretoEsperado) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  const body = req.body || {};
  const base64 = typeof body.base64 === 'string' ? body.base64 : '';
  if (!base64) {
    return res.status(400).json({ error: 'Falta el contenido del favicon (base64).' });
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (err) {
    return res.status(400).json({ error: 'El contenido del favicon no es un base64 válido.' });
  }
  if (buffer.length === 0) {
    return res.status(400).json({ error: 'El favicon está vacío.' });
  }
  if (buffer.length > MAX_MARCA_LOGO_BYTES) {
    return res.status(413).json({ error: `El favicon excede el tamaño máximo permitido de ${MAX_MARCA_LOGO_MB} MB.` });
  }

  const mimeReal = detectRealImageMimeType(buffer);
  if (!mimeReal) {
    return res.status(400).json({ error: 'El archivo no es una imagen válida (JPG, PNG o WEBP).' });
  }

  storage
    .guardarArchivo('marca', slug, 'favicon', buffer, mimeReal)
    .then(() => {
      res.json({ ok: true, url: `/api/favicon/${slug}` });
    })
    .catch((err) => {
      console.error(`Error guardando el favicon del tenant "${slug}":`, err);
      res.status(500).json({ error: 'No se pudo guardar el favicon.' });
    });
});

// Borra el favicon de un tenant de MinIO.
app.delete('/internal/favicon/:slug', (req, res) => {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  if (!secretoEsperado || req.get('X-Internal-Secret') !== secretoEsperado) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  storage
    .eliminarArchivo('marca', slug, 'favicon')
    .then(() => res.json({ ok: true }))
    .catch((err) => {
      console.error(`Error borrando el favicon del tenant "${slug}":`, err);
      res.status(500).json({ error: 'No se pudo borrar el favicon.' });
    });
});

// Renombra el slug de un tenant: migra TODOS sus archivos en MinIO (los
// del prefijo "<slug>/" — constancias, tickets, facturas — y el logo de
// marca "marca/<slug>/logo") al slug nuevo, verificando que la copia no
// perdió objetos antes de borrar los viejos. Lo usa el contenedor
// "control" cuando el operador cambia el slug desde /control (segmento
// "edición", ver PROJECT_STATE.md punto 104). Misma protección por
// secreto compartido que los demás /internal/*, y NO se expone por nginx.
//
// nginx NO necesita tocarse ni recargarse para el slug nuevo: sus rutas
// de tenant son dinámicas por regex (segmento 4), así que cualquier slug
// válido empieza a funcionar en cuanto el backend resuelve al tenant por
// el nuevo valor (control invalida la caché de resolución después).
app.post('/internal/renombrar-slug', async (req, res) => {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  if (!secretoEsperado || req.get('X-Internal-Secret') !== secretoEsperado) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const body = req.body || {};
  const slugAnterior = String(body.slugAnterior || '').toLowerCase();
  const slugNuevo = String(body.slugNuevo || '').toLowerCase();
  const errorAnterior = validarSlug(slugAnterior);
  if (errorAnterior) {
    return res.status(400).json({ error: 'Slug anterior inválido.' });
  }
  const errorNuevo = validarSlug(slugNuevo);
  if (errorNuevo) {
    return res.status(400).json({ error: 'Slug nuevo inválido.' });
  }
  if (slugAnterior === slugNuevo) {
    return res.status(400).json({ error: 'Los slugs son el mismo.' });
  }

  try {
    // 1. Copiar el prefijo de archivos del tenant (verificado por conteo:
    //    si el destino no tiene tantos objetos como el origen, abortar sin
    //    borrar nada).
    const esperados = await storage.contarObjetosPrefijo(slugAnterior);
    const copiados = await storage.copiarPrefijo(slugAnterior, slugNuevo);
    if (esperados !== copiados) {
      return res.status(502).json({
        error: `La migración de archivos quedó incompleta (${copiados}/${esperados} objetos copiados). No se borró nada.`,
      });
    }

    // 2. Mover el logo de marca y el favicon si el tenant tiene alguno.
    let logoMovido = false;
    if (await storage.existeArchivo('marca', slugAnterior, 'logo')) {
      await storage.copiarArchivo('marca', slugAnterior, 'logo', 'marca', slugNuevo, 'logo');
      logoMovido = true;
    }
    let faviconMovido = false;
    if (await storage.existeArchivo('marca', slugAnterior, 'favicon')) {
      await storage.copiarArchivo('marca', slugAnterior, 'favicon', 'marca', slugNuevo, 'favicon');
      faviconMovido = true;
    }

    // 3. Solo hasta aquí se borra lo viejo.
    const borrados = await storage.eliminarPrefijo(slugAnterior);
    if (logoMovido) {
      await storage.eliminarArchivo('marca', slugAnterior, 'logo');
    }
    if (faviconMovido) {
      await storage.eliminarArchivo('marca', slugAnterior, 'favicon');
    }

    res.json({ ok: true, copiados, borrados, logoMovido, faviconMovido });
  } catch (err) {
    console.error(`Error migrando archivos del slug "${slugAnterior}" a "${slugNuevo}":`, err);
    res.status(502).json({ error: 'No se pudo migrar el almacenamiento del tenant al slug nuevo.' });
  }
});

// Sirve el logo de marca de un tenant. Público a propósito: va incrustado
// en los correos que reciben los clientes, así que no puede requerir
// autenticación. Cache-Control largo porque el logo solo cambia cuando el
// administrador de control lo reemplaza (y, al hacerlo, la URL relativa
// guardada en la BD es la misma — el contenido nuevo se propaga con la
// misma caché de navegador, aceptable para un logo).
app.get('/api/marca-logo/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(404).json({ error: 'Logo no encontrado.' });
  }

  try {
    if (!(await storage.existeArchivo('marca', slug, 'logo'))) {
      return res.status(404).json({ error: 'Logo no encontrado.' });
    }
    const { stream, contentType } = await storage.obtenerArchivo('marca', slug, 'logo');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  } catch (err) {
    console.error(`Error sirviendo el logo de marca del tenant "${slug}":`, err);
    res.status(500).json({ error: 'No se pudo leer el logo.' });
  }
});

// Favicon del tenant (segmento "Look & Feel"): sirve la imagen con cache
// largo (un favicon cambia rara vez; el navegador lo re-pide si cambia la
// URL del <link>). 404 si el tenant no subió uno.
app.get('/api/favicon/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(404).json({ error: 'Favicon no encontrado.' });
  }

  try {
    if (!(await storage.existeArchivo('marca', slug, 'favicon'))) {
      return res.status(404).json({ error: 'Favicon no encontrado.' });
    }
    const { stream, contentType } = await storage.obtenerArchivo('marca', slug, 'favicon');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  } catch (err) {
    console.error(`Error sirviendo el favicon del tenant "${slug}":`, err);
    res.status(500).json({ error: 'No se pudo leer el favicon.' });
  }
});

// Tema / identidad visual del tenant (segmento "Look & Feel", ver
// PROJECT_STATE.md punto 105). Público a propósito: el frontend lo
// consume en el <head> de TODAS las páginas del portal (antes de
// cualquier login) para pintar las CSS variables del tenant sobre el
// diseño base ADDV. Cache corto (5 min): un cambio de marca debe
// propagarse pronto, a diferencia del logo (24h).
//
// Siempre responde 200 con el tema del tenant (o vacío si no tiene uno,
// lo que significa "usar el diseño base ADDV") — no distingue por
// código de estado entre "tenant sin tema" y "tenant inexistente",
// igual que el logo (404 solo para slug con formato inválido).
app.get('/api/tema/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(404).json({ error: 'Tema no encontrado.' });
  }

  try {
    const tenant = await resolverTenantPorSlug(slug);
    const tema = parsearTemaDesdeFila(tenant);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      slug,
      marca: (tenant && tenant.marca) || null,
      marcaLoGoUrl: (tenant && tenant.marca_logo_url) || null,
      tema,
      variables: temaAVariables(tema),
      fuentesGoogle: fuentesAUrlGoogle(tema),
    });
  } catch (err) {
    console.error(`Error sirviendo el tema del tenant "${slug}":`, err);
    res.status(500).json({ error: 'No se pudo leer el tema.' });
  }
});

// ---------- Rutas ----------

// Health check REAL (no solo "el proceso está corriendo"): además de
// responder, verifica que la base de datos sí esté alcanzable con un
// SELECT 1 rápido. Un health check que solo confirma "el proceso
// contestó" da falsos positivos — Docker (y cualquier orquestador) lo
// vería como "saludable" aunque el pool de conexiones a MySQL esté
// agotado, desconectado, o MySQL mismo esté caído/reiniciando — que es
// exactamente el tipo de situación que causa fallos intermitentes: el
// contenedor "se ve bien" pero las peticiones reales fallan. Con
// timeout corto (2s) para no dejar el health check colgado si la base
// de datos está lenta en vez de caída del todo.
app.get('/api/health', async (req, res) => {
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    res.json({ status: 'ok', maxFileSizeMb: MAX_FILE_SIZE_MB });
  } catch (err) {
    res.status(503).json({ status: 'error', error: 'La base de datos no está disponible.' });
  }
});

// ---------- Autenticación de usuario (login por RFC + contraseña) ----------
// Sistema independiente de las credenciales de administrador: aquí un
// "usuario" es el contribuyente que quiere subir tickets para facturar.

// Registro: pide correo electrónico, teléfono, el RFC con el que va a
// facturar, y contraseña. El correo es el mismo campo `usuarios.email`
// que también captura el administrador al crear una cuenta desde el
// panel (ver POST /api/admin/usuarios) — misma columna, misma validación
// (isValidEmail) — así que ambos caminos para llegar a una cuenta de
// cliente dejan el dato en el mismo lugar, con la misma regla.
app.post(
  '/api/auth/registro',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const rfc = sanitizeText(body.rfc, 13).toUpperCase();
    const email = sanitizeText(body.email, 200).toLowerCase();
    const telefono = sanitizeText(body.telefono, 20);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidRFCRequerido(rfc)) {
      return res.status(400).json({ error: 'Ingresa un RFC válido.' });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    }
    if (!isValidTelefono(telefono)) {
      return res.status(400).json({ error: 'Ingresa un número de teléfono válido (10 dígitos).' });
    }
    const errorPassword = validarPassword(password);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }

    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE rfc = ?', [rfc]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con este RFC. Inicia sesión.' });
    }

    const ahora = new Date();
    const passwordHash = hashPassword(password);
    await pool.query(
      `INSERT INTO usuarios (rfc, email, telefono, password_hash, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rfc, email, telefono.replace(/[\s\-()]/g, ''), passwordHash, ahora, ahora]
    );

    establecerCookieSesion(res, rfc, req.tenant ? req.tenant.slug : null);
    res.status(201).json({ ok: true, rfc, mensaje: 'Cuenta creada correctamente.' });
  })
);

// Inicio de sesión: el backend acepta cualquier valor que coincida con
// `usuarios.rfc`, sin filtrar por perfil (la tabla no distingue el campo
// de "usuario" entre RFC y nombre de usuario, es la misma columna) — así
// que técnicamente sirve tanto para clientes (RFC) como para cuentas
// administrador/fiscal (nombre de usuario). En la práctica, el formulario
// de `login.html` (la parte del cliente) solo deja capturar un RFC con
// formato válido — administrador/fiscal deben entrar por `/admin` (HTTP
// Basic Auth), su acceso previsto. El límite de 50 caracteres en este
// endpoint (en vez de 13, el máximo de un RFC real) se conserva por
// compatibilidad y para no truncar el valor recibido, aunque el
// formulario público ya no lo necesite para su propio flujo.
app.post(
  '/api/auth/login',
  authLimiter,
  tenantAggregateAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const rfc = sanitizeText(body.rfc, 50).toUpperCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!rfc || !password) {
      return res.status(400).json({ error: 'Ingresa tu RFC y tu contraseña.' });
    }

    const [filas] = await pool.query('SELECT * FROM usuarios WHERE rfc = ?', [rfc]);
    const usuario = filas[0];

    // Mensaje generico (no revela si el RFC existe o no) para no facilitar
    // enumeracion de cuentas registradas.
    if (!usuario || !verifyPassword(password, usuario.password_hash)) {
      return res.status(401).json({ error: 'RFC o contraseña incorrectos.' });
    }

    establecerCookieSesion(res, rfc, req.tenant ? req.tenant.slug : null);
    res.json({
      ok: true,
      rfc,
      telefono: usuario.telefono,
      debeCambiarPassword: Boolean(usuario.debe_cambiar_password),
    });
  })
);

app.post('/api/auth/logout', (req, res) => {
  limpiarCookieSesion(res, req.tenant ? req.tenant.slug : null);
  res.json({ ok: true });
});

// Confirma si la sesion sigue siendo valida (para que el frontend decida
// si mostrar el login o el tablero al cargar cualquier pagina protegida).
// Tambien indica si el usuario debe cambiar su contraseña (por ejemplo,
// porque un administrador le restableció una temporal) — se consulta en
// vivo en la base de datos, no se guarda en el token de sesión, para que
// un cambio hecho por el administrador aplique de inmediato aunque la
// sesión ya estuviera abierta.
app.get(
  '/api/auth/me',
  requireUserAuth,
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      'SELECT debe_cambiar_password FROM usuarios WHERE rfc = ?',
      [req.userRfc]
    );
    const debeCambiarPassword = filas[0] ? Boolean(filas[0].debe_cambiar_password) : false;
    res.json({ rfc: req.userRfc, debeCambiarPassword });
  })
);

// Cambio de contraseña del propio usuario (requiere sesión activa). Se usa
// tanto de forma voluntaria como cuando debe_cambiar_password obliga a
// hacerlo antes de continuar. No pide la contraseña anterior porque el
// usuario ya se autenticó con ella para tener esta sesión.
app.put(
  '/api/auth/password',
  requireUserAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const password = typeof body.password === 'string' ? body.password : '';
    const errorPassword = validarPassword(password);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }

    const passwordHash = hashPassword(password);
    await pool.query(
      'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, actualizado_en = ? WHERE rfc = ?',
      [passwordHash, new Date(), req.userRfc]
    );
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente.' });
  })
);

// ---------- Tickets (comprobantes de compra para facturar) ----------
// Requieren sesion de usuario. Un ticket siempre queda asociado al RFC de
// la sesion que lo sube — nunca se manda un RFC distinto en el cuerpo de
// la peticion, precisamente para que sea imposible generar una solicitud a
// nombre de otro RFC.

function generarFolio(id) {
  return `TK-${String(id).padStart(6, '0')}`;
}

// Identificador único de cada orden de compra ("No. Compra"), mismo
// patrón que el folio de tickets pero con su propio prefijo.
function generarNumeroCompra(id) {
  return `OC-${String(id).padStart(6, '0')}`;
}

// Detecta la URL base del portal (protocolo + dominio) a partir de la
// propia petición entrante, en vez de depender de una variable de entorno
// fija — así los enlaces en los correos (invitación al crear un usuario,
// aviso de nuevo ticket al contador) funcionan igual en desarrollo local,
// por IP de red local, o en producción con dominio real y HTTPS. Requiere
// `app.set('trust proxy', 1)` (ver arriba) para que `req.protocol`
// refleje el protocolo real detrás de nginx. Devuelve cadena vacía si por
// alguna razón no se pudo detectar el host, para que el llamador pueda
// omitir el enlace en vez de mandar una URL rota.
function detectarUrlPortal(req) {
  return req.get('host') ? `${req.protocol}://${req.get('host')}` : '';
}

// Opciones válidas del dropdown "Tipo de pago" al subir un ticket. Se
// guardan como "slug" en la base de datos (ver CHECK chk_tickets_tipo_pago
// en backend/db.js); las etiquetas en español son solo para mensajes de
// error del backend — el frontend tiene su propia copia para mostrar el
// dropdown, ya que no hay un endpoint dedicado para esto (son fijas, a
// diferencia del catálogo de Uso de CFDI, que sí se sincroniza con el SAT).
const TIPOS_PAGO = {
  efectivo: 'Pago en efectivo',
  transferencia: 'Pago con transferencia',
  tarjeta_debito: 'Pago con tarjeta de débito',
  tarjeta_credito: 'Pago con tarjeta de crédito',
  otro: 'Otro',
};

app.post('/api/tickets', requireUserAuth, submitLimiter, (req, res) => {
  subirConTenant(uploadImagen, 'imagen', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `La imagen excede el tamaño máximo permitido de ${MAX_FILE_SIZE_MB} MB.`,
        });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({ error: 'Solo se aceptan imágenes en formato JPG, PNG o WEBP.' });
      }
      console.error('Error al subir el ticket:', err);
      return res.status(400).json({ error: 'No se pudo procesar la imagen.' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Debes adjuntar una foto o imagen del ticket.' });
      }

      // Sin una constancia de situación fiscal activa para este RFC, no hay
      // correo al que avisarle al cliente cuando su factura esté lista (ver
      // notificarFacturaListaAlCliente más abajo, que depende de
      // registros.email). Por eso esto SÍ se rechaza del lado del
      // servidor, y no solo se advierte en la interfaz: el aviso emergente
      // de tickets.html es una ayuda para que el cliente lo sepa antes de
      // llenar el formulario, pero la regla real vive aquí.
      const [registroDelRfc] = await pool.query(
        'SELECT id FROM registros WHERE rfc = ? AND eliminado_en IS NULL LIMIT 1',
        [req.userRfc]
      );
      if (registroDelRfc.length === 0) {
        return res.status(400).json({
          error: 'Antes de subir un ticket, necesitamos tu constancia de situación fiscal. Súbela desde "Subir constancia de situación fiscal" en tu tablero.',
          codigo: 'SIN_CONSTANCIA',
        });
      }

      const body = req.body || {};

      // Todo este bloque (verificación de No. Compra + fecha + hora +
      // total, y el vínculo del ticket con su orden) solo aplica si
      // "Orden de compra" está habilitada globalmente — con el
      // interruptor apagado, un ticket se acepta sin estos cuatro
      // campos, igual que funcionaba la app antes de que existiera esta
      // funcionalidad. `ordenCompraId` se queda en null en ese caso (la
      // columna `tickets.orden_compra_id` ya es NULL-able desde que se
      // creó, así que no hace falta ningún cambio de esquema para esto).
      const configGlobalTicket = await getConfiguracionGlobal();
      let ordenCompraId = null;

      if (configGlobalTicket.ordenes_compra_habilitado) {
        // Verificación contra la orden de compra: el cliente debe capturar
        // el No. Compra, fecha, hora y total exactamente como le llegaron
        // en el correo de confirmación cuando el administrador registró su
        // orden — así se confirma que en verdad hay una compra registrada
        // antes de aceptar el ticket para facturar. Los cuatro son
        // obligatorios (no configurables como uso_cfdi/tipo_pago/
        // comentarios, ya que esta validación es la razón de ser de este
        // flujo, no un campo opcional más).
        //
        // La fecha/hora se EXTRAEN del texto capturado (con una expresión
        // regular sin anclar al inicio/fin), en vez de exigir que la
        // cadena completa coincida exactamente — copiar y pegar desde un
        // correo (sobre todo uno HTML) puede traer espacios extra,
        // espacios de no separación (NBSP) invisibles, o — en correos
        // enviados antes de esta corrección — la fecha y la hora juntas en
        // un solo valor ("24/jul/2026 09:30:45"). Si el cliente pega ese
        // valor completo en el campo "Fecha", igual se reconoce el
        // fragmento de fecha válido dentro, en vez de rechazarlo solo por
        // traer texto de más.
        // La fecha y la hora se leen con `sanitizeTextoLibre` (sin
        // `validator.escape()`), NO con `sanitizeText` — este último
        // convierte "/" en la entidad HTML "&#x2F;" (pensado para texto
        // que se va a mostrar dentro de una página HTML propia, donde eso
        // sí hace falta), lo que corrompía por completo el formato de la
        // fecha ("24/jul/2026" → "24&#x2F;jul&#x2F;2026") ANTES de que la
        // expresión regular de abajo la evaluara — sin importar qué tan
        // bien escrita estuviera la fecha, nunca iba a coincidir. Es el
        // mismo criterio que ya usa el asunto/cuerpo de un correo (ver
        // sanitizeTextoLibre más arriba): la extracción por expresión
        // regular de más abajo ya limita el resultado final a un juego de
        // caracteres seguro (dígitos, letras y "/"), así que no hace falta
        // el escape de `sanitizeText` para este campo en particular.
        const numeroCompra = sanitizeText(body.numero_compra, 20).toUpperCase();
        const fechaCompraCruda = sanitizeTextoLibre(body.fecha_compra, 40);
        const horaCompraCruda = sanitizeTextoLibre(body.hora_compra, 40);
        const totalCompra = Number(body.total_compra);

        if (!numeroCompra) {
          return res.status(400).json({ error: 'El número de compra es obligatorio.' });
        }

        const matchFecha = fechaCompraCruda.match(/\d{2}\/[a-záéíóúñ]{3}\/\d{4}/i);
        if (!matchFecha) {
          return res.status(400).json({ error: 'La fecha de compra debe tener el formato dd/mmm/aaaa (ej. 24/jul/2026).' });
        }
        const fechaCompraTexto = matchFecha[0];

        const matchHora = horaCompraCruda.match(/([01]\d|2[0-3]):[0-5]\d:[0-5]\d/);
        if (!matchHora) {
          return res.status(400).json({ error: 'La hora de compra debe tener el formato HH:mm:ss (ej. 09:30:45).' });
        }
        const horaCompraTexto = matchHora[0];

        if (!Number.isFinite(totalCompra) || totalCompra <= 0) {
          return res.status(400).json({ error: 'El total de la compra debe ser un número mayor a cero.' });
        }

        // Un solo mensaje genérico para cualquier discrepancia (no se
        // encontró el número de compra, o sí se encontró pero la fecha/
        // hora/total no coinciden) — a propósito, para no revelar cuál
        // dato en particular está mal y facilitar que alguien adivine una
        // combinación válida por partes.
        const MENSAJE_COMPRA_NO_ENCONTRADA = 'No se encuentra registrada la compra para facturar.';

        const [ordenesCoincidentes] = await pool.query(
          'SELECT * FROM ordenes_compra WHERE numero_compra = ? AND eliminado_en IS NULL LIMIT 1',
          [numeroCompra]
        );
        if (ordenesCoincidentes.length === 0) {
          return res.status(400).json({ error: MENSAJE_COMPRA_NO_ENCONTRADA, codigo: 'COMPRA_NO_ENCONTRADA' });
        }
        const ordenCompra = ordenesCoincidentes[0];

        // La fecha/hora de la orden se guarda en UTC — se le da formato con
        // la MISMA zona horaria configurada actualmente (ver
        // formatearFechaHoraMexico), igual que se hizo al mostrarla en el
        // correo de confirmación, para comparar exactamente lo mismo que
        // el cliente vio ahí.
        const fechaOrdenFormateada = formatearFechaHoraMexico(
          new Date(`${String(ordenCompra.fecha_compra).replace(' ', 'T')}Z`),
          configGlobalTicket.zona_horaria
        );

        const coincideFecha = fechaOrdenFormateada.fecha.toLowerCase() === fechaCompraTexto.toLowerCase();
        const coincideHora = fechaOrdenFormateada.hora === horaCompraTexto;
        const coincideTotal = Math.abs(Number(ordenCompra.total) - totalCompra) < 0.005; // tolerancia de medio centavo por redondeo

        if (!coincideFecha || !coincideHora || !coincideTotal) {
          return res.status(400).json({ error: MENSAJE_COMPRA_NO_ENCONTRADA, codigo: 'COMPRA_NO_ENCONTRADA' });
        }

        // No se puede volver a facturar la misma orden de compra. Se
        // considera "ya facturada" si ya existe un ticket vinculado a esta
        // orden (por numero_compra + fecha, ya confirmados arriba) cuya
        // factura ya se subió (estatus = 'listo') — el mismo criterio que
        // ya usa el ícono de "facturado" en la tabla del admin.
        const [ticketsYaFacturados] = await pool.query(
          `SELECT id FROM tickets
           WHERE orden_compra_id = ? AND estatus = 'listo' AND eliminado_en IS NULL
           LIMIT 1`,
          [ordenCompra.id]
        );
        if (ticketsYaFacturados.length > 0) {
          return res.status(400).json({
            error: 'Esa compra ya fue facturada.',
            codigo: 'COMPRA_YA_FACTURADA',
          });
        }

        ordenCompraId = ordenCompra.id;
      }

      const usoCfdi = sanitizeText(body.uso_cfdi, 10).toUpperCase();
      const tipoPago = sanitizeText(body.tipo_pago, 30).toLowerCase();
      const tipoPagoOtro = sanitizeText(body.tipo_pago_otro, 100);
      const comentarios = sanitizeText(body.comentarios, 1000);

      // Se reutiliza la misma configuracion de "campos obligatorios" que ya
      // usa el formulario de constancia, para que el Uso de CFDI se
      // comporte de forma consistente en toda la app (un solo lugar donde
      // el administrador decide si es obligatorio u opcional).
      const camposObligatoriosTicket = await getCamposObligatorios();
      const usosCfdiVigentesTicket = await getUsosCfdi();
      if (usoCfdi && !usosCfdiVigentesTicket.some((u) => u.clave === usoCfdi)) {
        return res.status(400).json({ error: 'El Uso de CFDI seleccionado no es válido.' });
      }
      if (camposObligatoriosTicket.uso_cfdi && !usoCfdi) {
        return res.status(400).json({ error: 'El Uso de CFDI es obligatorio.' });
      }
      // Tipo de pago: si se manda, debe ser una de las 5 opciones del
      // dropdown (mismas que valida el CHECK de la base de datos),
      // incluyendo "otro". Puede ser obligatorio u opcional, según la
      // misma configuración de "campos obligatorios" del panel (igual que
      // Uso de CFDI). Si se elige específicamente "otro", el campo de
      // especificación SÍ es obligatorio sin importar esa configuración —
      // "otro" sin ningún detalle no le sirve de nada al administrador.
      if (tipoPago && !Object.prototype.hasOwnProperty.call(TIPOS_PAGO, tipoPago)) {
        return res.status(400).json({ error: 'Selecciona un tipo de pago válido.' });
      }
      if (camposObligatoriosTicket.tipo_pago && !tipoPago) {
        return res.status(400).json({ error: 'El tipo de pago es obligatorio.' });
      }
      if (tipoPago === 'otro' && !tipoPagoOtro) {
        return res.status(400).json({ error: 'Especifica el tipo de pago.' });
      }
      if (camposObligatoriosTicket.comentarios && !comentarios) {
        return res.status(400).json({ error: 'Los comentarios son obligatorios.' });
      }

      req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

      const realMime = detectRealImageMimeType(req.file.buffer);
      if (!realMime || !ALLOWED_IMAGE_MIME_TYPES.has(realMime)) {
        return res.status(400).json({ error: 'El contenido del archivo no coincide con una imagen válida.' });
      }

      const extensiones = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
      const storedFilename = `${crypto.randomUUID()}${extensiones[realMime] || ''}`;
      await storage.guardarArchivo(storage.prefijoTenant(req), 'tickets', storedFilename, req.file.buffer, realMime);

      const ahora = new Date();
      const [resultado] = await pool.query(
        `INSERT INTO tickets
          (folio, rfc, uso_cfdi, tipo_pago, tipo_pago_otro, comentarios, orden_compra_id, imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
           estatus, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
        [
          'TEMP', // se reemplaza abajo una vez que conocemos el id autoincremental
          req.userRfc,
          usoCfdi || null,
          tipoPago || null,
          tipoPago === 'otro' ? tipoPagoOtro : null,
          comentarios || null,
          ordenCompraId,
          req.file.originalname.slice(0, 255),
          storedFilename,
          realMime,
          req.file.size,
          ahora,
          ahora,
        ]
      );

      const folio = generarFolio(resultado.insertId);
      await pool.query('UPDATE tickets SET folio = ? WHERE id = ?', [folio, resultado.insertId]);

      // Notifica al contador del RFC (si tiene correo configurado) de que
      // hay un ticket nuevo para facturar. No se espera (await) a que
      // termine ni se deja que una falla aquí afecte la respuesta al
      // usuario — el ticket ya se guardó correctamente sin importar si el
      // correo se pudo enviar o no. Si no hay correo de contador
      // configurado para este RFC, el administrador lo verá reflejado en
      // GET /api/admin/tickets/pendientes-sin-contador la próxima vez que
      // inicie sesión.
      const urlPortalTicket = detectarUrlPortal(req);
      notificarNuevoTicketAlContador(req.userRfc, folio, urlPortalTicket, marcaDelTenant(req)).catch((err) => {
        console.error('No se pudo notificar el nuevo ticket al contador:', err.message);
      });

      res.status(201).json({
        ok: true,
        folio,
        mensaje: `Tu ticket se registró correctamente. Guarda tu folio ${folio} para darle seguimiento.`,
      });
    } catch (innerErr) {
      console.error('Error al guardar el ticket:', innerErr);
      res.status(500).json({ error: 'Ocurrió un error interno. Intenta de nuevo.' });
    }
  });
});

// Logo para el correo de confirmación de orden de compra, con diseño de
// "ticket". Parametrizado: si en el futuro se agrega una pantalla en el
// panel para subir/capturar un logo real (ver logo_url en
// getConfiguracionGlobal, backend/utils/config.js), esta función ya está
// lista para usarlo — por ahora, sin esa configuración todavía, genera un
// logo de texto simple (nada que dependa de alojar/servir una imagen).
// `marca` (segmento "marca" de control): si el tenant definió su marca,
// se usa en el `alt` de la imagen y en el logo de texto; si no, cae al
// nombre por defecto de la app.
const MARCA_DEFECTO = 'ADDV';

function marcaDelTenant(req) {
  return (req && req.tenant && req.tenant.marca) || MARCA_DEFECTO;
}

function logoTicketHtml(logoUrl, marca) {
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="Portal de Facturación ${escapeHtmlCorreo(marca)}" style="max-width:180px; max-height:60px; display:block; margin:0 auto;" />`;
  }
  return `
    <div style="display:inline-block; background:#0F6E5D; color:#ffffff; font-family:Georgia,'Times New Roman',serif; font-weight:bold; font-size:20px; letter-spacing:0.06em; padding:10px 18px; border-radius:6px;">
      ${escapeHtmlCorreo(marca)}
    </div>`;
}

// Arma el correo de confirmación de una orden de compra, con diseño
// tipo "ticket" (recibo) — pensado para que el cliente lo identifique de
// un vistazo como comprobante, guarde el No. Compra, y sepa exactamente
// qué sigue: entrar al portal y subir su ticket para pedir la factura.
// Devuelve tanto la versión HTML (el ticket en sí) como una versión de
// texto plano equivalente (ver la nota en utils/email.js sobre por qué
// siempre se manda ambas).
function construirCorreoOrdenCompra({ numeroCompra, fechaFormateada, concepto, cantidad, ivaPorcentaje, total, email, urlPortal, logoUrl, marca }) {
  const enlaceLogin = urlPortal ? `${urlPortal}/login` : '';

  const filaTicket = (etiqueta, valor, destacado) => `
    <tr>
      <td style="padding:6px 0; font-family:'Courier New',Courier,monospace; font-size:13px; color:${destacado ? '#0B5548' : '#4A4A4A'}; ${destacado ? 'font-weight:bold;' : ''}">${etiqueta}</td>
      <td style="padding:6px 0; font-family:'Courier New',Courier,monospace; font-size:${destacado ? '15px' : '13px'}; color:${destacado ? '#0B5548' : '#1A1A1A'}; text-align:right; ${destacado ? 'font-weight:bold;' : ''}">${valor}</td>
    </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:24px 12px; background:#F0EFEA; font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto;">
    <tr>
      <td style="text-align:center; padding-bottom:18px;">
        ${logoTicketHtml(logoUrl, marca)}
      </td>
    </tr>
    <tr>
      <td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px dashed #C9C4B8; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:26px 28px 6px; text-align:center;">
              <p style="margin:0; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#7A756A;">Orden de compra</p>
              <p style="margin:6px 0 0; font-size:22px; font-weight:bold; color:#1A1A1A; font-family:'Courier New',Courier,monospace;">${escapeHtmlCorreo(numeroCompra)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px 0;">
              <div style="border-top:1px dashed #C9C4B8;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${filaTicket('Fecha', escapeHtmlCorreo(fechaFormateada.fecha))}
                ${filaTicket('Hora', escapeHtmlCorreo(fechaFormateada.hora))}
                ${filaTicket('Concepto', escapeHtmlCorreo(concepto))}
                ${filaTicket('Cantidad', `$${cantidad.toFixed(2)} MXN`)}
                ${filaTicket(`IVA (${ivaPorcentaje}%)`, `$${(total - cantidad).toFixed(2)} MXN`)}
              </table>
              <div style="border-top:1px dashed #C9C4B8; margin:10px 0;"></div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${filaTicket('TOTAL A FACTURAR', `$${total.toFixed(2)} MXN`, true)}
              </table>
              <div style="border-top:1px dashed #C9C4B8; margin:10px 0;"></div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${filaTicket('Correo', escapeHtmlCorreo(email))}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 10px 0;">
        <p style="margin:0 0 14px; font-size:14.5px; line-height:1.55; color:#333333;">¡Hola! Te confirmamos que registramos tu compra <strong>${escapeHtmlCorreo(numeroCompra)}</strong>. Con estos datos ya puedes solicitar tu factura desde el portal.</p>
        <p style="margin:0 0 14px; font-size:14.5px; line-height:1.55; color:#333333;"><strong>Guarda este correo</strong> — tómale una foto o captura de pantalla — porque, al solicitar tu factura en el portal, te pediremos que captures el <strong>No. Compra, Fecha, Hora y Total exactamente como aparecen arriba</strong> (cada uno en su propio campo), además de la imagen de tu ticket de compra.</p>
        ${enlaceLogin ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto;">
          <tr>
            <td style="border-radius:8px; background:#0F6E5D;">
              <a href="${enlaceLogin}" style="display:inline-block; padding:12px 28px; font-size:14.5px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px;">Iniciar sesión y solicitar mi factura</a>
            </td>
          </tr>
        </table>` : ''}
        <p style="margin:18px 0 0; font-size:12.5px; line-height:1.5; color:#8A8578; text-align:center;">Si no esperabas este correo, contacta a tu administrador. Portal de Facturación ${escapeHtmlCorreo(marca)}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const texto =
    `ORDEN DE COMPRA — ${numeroCompra}\n\n` +
    `Fecha: ${fechaFormateada.fecha}\n` +
    `Hora: ${fechaFormateada.hora}\n` +
    `Concepto: ${concepto}\n` +
    `Cantidad: $${cantidad.toFixed(2)} MXN\n` +
    `IVA (${ivaPorcentaje}%): $${(total - cantidad).toFixed(2)} MXN\n` +
    `TOTAL A FACTURAR: $${total.toFixed(2)} MXN\n` +
    `Correo: ${email}\n\n` +
    `¡Hola! Te confirmamos que registramos tu compra ${numeroCompra}. Con estos datos ya puedes solicitar tu factura desde el portal.\n\n` +
    `Guarda este correo — tómale una foto o captura de pantalla — porque, además de estos datos, al solicitar tu factura en el portal también te pediremos la imagen de tu ticket de compra.\n\n` +
    (enlaceLogin ? `Inicia sesión aquí para solicitar tu factura: ${enlaceLogin}\n\n` : '') +
    `Si no esperabas este correo, contacta a tu administrador.`;

  return { html, texto };
}

function escapeHtmlCorreo(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Envía el correo de confirmación al cliente cuando se registra una orden
// de compra. "Fire-and-forget", mismo criterio que el resto de los
// correos de esta app: si falla (SMTP sin configurar, etc.), la orden ya
// se guardó correctamente de todas formas.
async function enviarCorreoOrdenCompra(datos) {
  const { html, texto } = construirCorreoOrdenCompra(datos);
  await enviarCorreo({
    destinatario: datos.email,
    asunto: `Confirmación de compra — ${datos.numeroCompra}`,
    cuerpo: texto,
    html,
  });
}

// Envía la invitación al portal cuando el administrador crea una cuenta
// desde el panel (POST /api/admin/usuarios) — incluye el usuario (RFC o
// nombre de usuario) y la contraseña temporal, para que la persona pueda
// entrar de inmediato. Es "fire-and-forget": si el correo SMTP no está
// configurado o falla el envío, la cuenta ya se creó correctamente de
// todas formas (ver el llamador en POST /api/admin/usuarios).
const PERFIL_TEXTO = {
  cliente: 'Cliente',
  administrador: 'Administrador',
  fiscal: 'Fiscal',
};

async function enviarInvitacionPortal({ email, rfc, password, perfil, urlPortal, marca }) {
  const perfilTexto = PERFIL_TEXTO[perfil] || perfil;
  const marcaCorreo = marca || MARCA_DEFECTO;

  // El enlace depende del perfil, porque cada uno entra por un lugar
  // distinto: "cliente" usa el portal público (RFC + contraseña, cookie
  // de sesión, ruta /login); "administrador" y "fiscal" entran al panel
  // de administración (HTTP Basic Auth, ruta /admin) — mandarles un
  // enlace a /login sería incorrecto, ya que ese formulario no es por
  // donde ellos acceden. En ambos casos la URL base (protocolo + dominio)
  // se sigue detectando de la propia petición del administrador que creó
  // la cuenta (ver el llamador en POST /api/admin/usuarios), así que
  // funciona igual sin importar el contexto de despliegue (localhost, IP
  // de red local, o un dominio real con HTTPS en producción).
  const rutaSegunPerfil = perfil === 'cliente' ? '/login' : '/admin';
  const etiquetaAcceso = perfil === 'cliente' ? 'Portal' : 'Panel de administración';
  const enlacePortal = urlPortal ? `${urlPortal}${rutaSegunPerfil}` : '';

  // Si por alguna razón no se pudo detectar el host de la petición, se
  // omite la línea del enlace en vez de mandar una URL rota — el
  // usuario/contraseña siguen siendo suficientes para entrar manualmente.
  await enviarCorreo({
    destinatario: email,
    asunto: `Te invitamos al Portal de Facturación ${marcaCorreo}`,
    cuerpo:
      `Hola,\n\n` +
      `Se creó una cuenta para ti en el Portal de Facturación ${marcaCorreo}, con perfil "${perfilTexto}".\n\n` +
      `Usuario: ${rfc}\n` +
      `Contraseña temporal: ${password}\n\n` +
      (enlacePortal
        ? `${etiquetaAcceso}: ${enlacePortal}\n\n` +
          `Ingresa ahí con estas credenciales y cambia tu contraseña en cuanto puedas.\n\n`
        : `Ingresa con estas credenciales y cambia tu contraseña en cuanto puedas.\n\n`) +
      `Si no esperabas este correo, contacta a tu administrador.`,
  });
}

// Envía la notificación de "nuevo ticket para facturar" al correo del
// contador configurado globalmente por el administrador (dentro de la
// configuración SMTP, ver backend/utils/email.js). Si ese correo no está
// configurado, o si el correo SMTP no está configurado en general,
// simplemente no manda nada (no es un error: es un estado esperado,
// cubierto por la notificación al administrador en el panel).
// El "correo de quien va a facturar" (contador) ahora es un valor único y
// global que captura el administrador dentro de la configuración de
// correo SMTP — no un campo por cliente/RFC como en una versión anterior.
async function notificarNuevoTicketAlContador(rfc, folio, urlPortal, marca) {
  const config = await getConfigSmtp();
  const correoContador = config && config.correo_contador;
  if (!correoContador) return;
  const marcaCorreo = marca || MARCA_DEFECTO;

  // Mismo mecanismo de auto-detección de URL que ya usa la invitación al
  // crear un usuario (ver enviarInvitacionPortal más abajo): la URL base
  // viene de la propia petición que subió el ticket, no de una variable
  // de entorno fija, así que el enlace funciona igual sin importar el
  // contexto de despliegue. El destinatario de este correo (quien va a
  // facturar) entra por el mismo lugar que un administrador/fiscal — HTTP
  // Basic Auth en /admin — así que el enlace apunta ahí.
  const enlacePanel = urlPortal ? `${urlPortal}/admin` : '';

  await enviarCorreo({
    destinatario: correoContador,
    asunto: `Nuevo ticket para facturar — Folio ${folio}`,
    cuerpo:
      `Se subió un nuevo ticket de compra para facturar.\n\n` +
      `RFC: ${rfc}\n` +
      `Folio: ${folio}\n\n` +
      (enlacePanel
        ? `Ingresa al panel de administración del Portal de Facturación ${marcaCorreo} para revisarlo y generar la factura correspondiente:\n${enlacePanel}`
        : `Ingresa al panel de administración del Portal de Facturación ${marcaCorreo} para revisarlo y generar la factura correspondiente.`),
  });
}

// Lista los tickets del RFC de la sesion actual (nunca los de otro RFC).
app.get(
  '/api/tickets',
  requireUserAuth,
  asyncHandler(async (req, res) => {
    const [tickets] = await pool.query(
      `SELECT id, folio, estatus, uso_cfdi, tipo_pago, comentarios, imagen_nombre_original, factura_nombre_original,
              creado_en, actualizado_en
       FROM tickets WHERE rfc = ? AND eliminado_en IS NULL ORDER BY creado_en DESC`,
      [req.userRfc]
    );
    res.json({ tickets });
  })
);

// Descarga la factura de un ticket propio, solo si ya esta en estatus "listo".
app.get(
  '/api/tickets/:id/factura',
  requireUserAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM tickets WHERE id = ? AND rfc = ?', [id, req.userRfc]);
    const ticket = filas[0];
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (ticket.estatus !== 'listo' || !ticket.factura_nombre_guardado) {
      return res.status(409).json({ error: 'La factura de este ticket todavía no está disponible.' });
    }

    const prefijo = storage.prefijoTenant(req);
    if (!(await storage.existeArchivo(prefijo, 'facturas', ticket.factura_nombre_guardado))) {
      return res.status(404).json({ error: 'El archivo de la factura ya no existe en el servidor.' });
    }

    res.setHeader('Content-Type', ticket.factura_mime || 'application/octet-stream');
    const originalName = ticket.factura_nombre_original || `factura-${ticket.folio}.zip`;
    const asciiFallback = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
    );
    await storage.enviarArchivoARespuesta(prefijo, 'facturas', ticket.factura_nombre_guardado, res);
  })
);

// Publica (sin autenticacion): indica que campos del formulario son
// obligatorios actualmente, para que la pagina publica los marque en vivo.
// El correo y el archivo siempre son obligatorios y no se incluyen aqui
// porque no son configurables. También incluye si "Orden de compra" está
// habilitada — tickets.html usa esto para mostrar/ocultar por completo
// la sección "Verifica tu compra" y activar/desactivar su validación.
app.get(
  '/api/config/campos-obligatorios',
  asyncHandler(async (req, res) => {
    const campos = await getCamposObligatorios();
    const configGlobal = await getConfiguracionGlobal();
    res.json({ ...campos, ordenes_compra_habilitado: configGlobal.ordenes_compra_habilitado });
  })
);

// Publica (sin autenticacion): catalogo de "Uso de CFDI" para llenar el
// dropdown del formulario. Se sincroniza con el SAT desde el panel de
// administracion; mientras tanto se sirve el catalogo guardado (o el
// catalogo incluido por defecto si nunca se ha sincronizado).
app.get(
  '/api/catalogos/uso-cfdi',
  asyncHandler(async (req, res) => {
    res.json({ usos: await getUsosCfdi() });
  })
);

// Publica (sin autenticacion): informa cada cuántos días se eliminan
// automáticamente los tickets, para que el tablero del cliente muestre el
// aviso correspondiente. `dias: null` significa que el borrado automático
// no está activado.
app.get(
  '/api/config/tickets-retencion',
  asyncHandler(async (req, res) => {
    const dias = await getRetencionTicketsDias();
    res.json({ dias });
  })
);

// Busca un registro existente por RFC (llave de identificación principal,
// ya que es un identificador único del contribuyente) y, si no hay RFC o no
// coincide, cae de vuelta al correo (retrocompatibilidad con registros
// creados cuando el RFC era opcional o no se capturaba). Usado por el
// formulario público para mostrar la vista previa antes de reemplazar.
// IMPORTANTE: esta ruta debe declararse ANTES que "/api/registro/:email",
// o Express interpretaría "buscar" como el valor del parámetro :email.
app.get(
  '/api/registro/buscar',
  asyncHandler(async (req, res) => {
    const email = sanitizeText(req.query.email, 200).toLowerCase();
    const rfc = sanitizeText(req.query.rfc, 13).toUpperCase();

    if (!email && !rfc) {
      return res.status(400).json({ error: 'Se requiere correo o RFC para buscar.' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Correo electronico invalido.' });
    }

    const columnas = `nombre, tipo_persona, rfc, email, indicaciones,
                       archivo_nombre_original, archivo_mime, actualizado_en`;
    let registro = null;

    if (rfc) {
      const [filas] = await pool.query(
        `SELECT ${columnas} FROM registros WHERE rfc = ? AND eliminado_en IS NULL`,
        [rfc]
      );
      registro = filas[0] || null;
    }
    if (!registro && email) {
      const [filas] = await pool.query(
        `SELECT ${columnas} FROM registros WHERE email = ? AND eliminado_en IS NULL`,
        [email]
      );
      registro = filas[0] || null;
    }

    if (!registro) {
      return res.json({ existe: false });
    }
    return res.json({ existe: true, registro });
  })
);

// Consulta si el RFC de la sesión actual (cookie de usuario) ya tiene una
// constancia activa asociada. A diferencia de GET /api/registro/buscar
// (pública, y devuelve los datos completos del registro), esta ruta
// requiere sesión y solo informa si existe o no — pensada para
// tickets.html, que necesita avisar antes de subir un ticket si el
// cliente todavía no ha subido su constancia (sin esa constancia, no hay
// correo al que avisarle cuando la factura esté lista).
// IMPORTANTE: esta ruta debe declararse ANTES que "/api/registro/:email"
// (justo abajo), o Express interpretaría "existe" como el valor del
// parámetro :email — exactamente el mismo motivo por el que
// "/api/registro/buscar" ya se declara antes que ":email" (ver el aviso
// original más arriba). Antes de esta corrección, esta ruta era código
// inalcanzable: cualquier petición a /api/registro/existe caía en
// /api/registro/:email con email="existe", fallaba isValidEmail() y
// siempre respondía 400 — el requireUserAuth de esta ruta nunca llegaba
// a ejecutarse.
app.get(
  '/api/registro/existe',
  requireUserAuth,
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      'SELECT id FROM registros WHERE rfc = ? AND eliminado_en IS NULL LIMIT 1',
      [req.userRfc]
    );
    res.json({ existe: filas.length > 0 });
  })
);

// Consulta si ya existe un registro/archivo para un correo dado.
// Se conserva por retrocompatibilidad; el formulario público ahora usa
// GET /api/registro/buscar (arriba), que también considera el RFC.
app.get(
  '/api/registro/:email',
  asyncHandler(async (req, res) => {
    const email = String(req.params.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Correo electronico invalido.' });
    }
    const [filas] = await pool.query(
      `SELECT nombre, tipo_persona, rfc, email, indicaciones,
              archivo_nombre_original, archivo_mime, actualizado_en
       FROM registros WHERE email = ? AND eliminado_en IS NULL`,
      [email]
    );
    const registro = filas[0] || null;

    if (!registro) {
      return res.json({ existe: false });
    }
    return res.json({ existe: true, registro });
  })
);

app.post('/api/registro', submitLimiter, (req, res) => {
  subirConTenant(upload, 'archivo', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `El archivo excede el tamano maximo permitido de ${MAX_FILE_SIZE_MB} MB.`,
        });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({
          error: 'Solo se aceptan archivos en formato PDF (Constancia de Situación Fiscal emitida por el SAT).',
        });
      }
      console.error('Error de carga:', err);
      return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
    }

    try {
      const body = req.body || {};
      const tipoPersona = sanitizeText(body.tipo_persona, 10);
      const rfcRaw = sanitizeText(body.rfc, 13).toUpperCase();
      const email = sanitizeText(body.email, 200).toLowerCase();
      const confirmarReemplazo = String(body.confirmar_reemplazo) === 'true';

      // Esta ruta es pública (funciona con y sin sesión — ver csf.html),
      // así que la sesión se lee de forma OPCIONAL (nunca rechaza la
      // petición por no tener una). Si hay sesión, su RFC es la
      // referencia autoritativa para la validación de más abajo (el RFC
      // de la constancia debe corresponder a esa cuenta); si no hay
      // sesión, se usa el RFC capturado en el formulario, si se dio uno.
      const rfcSesion = obtenerRfcSesionOpcional(req);
      const rfcReferencia = rfcSesion || rfcRaw || null;

      // Que campos son obligatorios se lee en vivo de la base de datos, asi
      // que un cambio hecho desde el panel de administracion aplica de
      // inmediato, sin reiniciar el servidor. El correo y el archivo no son
      // configurables: siempre son obligatorios. El nombre/razon social ya
      // no se captura en el formulario: se extrae del PDF mas abajo, asi
      // que tampoco es configurable como obligatorio/opcional. El Uso de
      // CFDI y las indicaciones de facturación tampoco se capturan aquí —
      // se quitaron de este formulario; Uso de CFDI sigue existiendo como
      // campo configurable, pero ahora solo aplica al subir un ticket (ver
      // POST /api/tickets), no a la constancia.
      const camposObligatorios = await getCamposObligatorios();

      // Validaciones de campos
      if (tipoPersona && !isValidTipoPersona(tipoPersona)) {
        return res.status(400).json({ error: 'Selecciona un tipo de persona valido.' });
      }
      if (camposObligatorios.tipo_persona && !tipoPersona) {
        return res.status(400).json({ error: 'Selecciona un tipo de persona.' });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Ingresa un correo electronico valido.' });
      }
      if (rfcRaw && !isValidRFC(rfcRaw)) {
        return res.status(400).json({ error: 'El RFC ingresado no tiene un formato valido.' });
      }
      if (camposObligatorios.rfc && !rfcRaw) {
        return res.status(400).json({ error: 'El RFC es obligatorio.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Debes adjuntar tu constancia de situacion fiscal.' });
      }

      // multer/busboy decodifican el header "Content-Disposition" del archivo
      // (que incluye su nombre original) como latin1 en vez de UTF-8, por lo
      // que acentos y eñes llegan corruptos (ej. "COTIZACIÃN" en vez de
      // "COTIZACIÓN"). Se corrige reinterpretando esos mismos bytes como UTF-8.
      req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

      // Verifica que el contenido real del archivo coincida con un tipo permitido
      const realMime = detectRealMimeType(req.file.buffer);
      if (!realMime || !ALLOWED_MIME_TYPES.has(realMime)) {
        return res.status(400).json({
          error: 'El contenido del archivo no coincide con un PDF válido.',
        });
      }

      // Valida que el PDF sea realmente una Constancia de Situación Fiscal /
      // Cédula de Identificación Fiscal del SAT (busca frases que solo
      // aparecen en ese documento), y aprovecha para extraer el código
      // postal, el/los régimen(es) fiscal(es) y el nombre/razón social, para
      // que se vean desde el panel de administración sin abrir el archivo.
      const textoPdf = await extraerTextoPdf(req.file.buffer);
      if (textoPdf === null) {
        return res.status(400).json({
          error: 'El PDF no se pudo procesar. Verifica que sea un archivo PDF válido y no esté dañado.',
        });
      }
      if (!pareceConstanciaFiscal(textoPdf)) {
        return res.status(400).json({
          error:
            'El PDF no parece ser una Constancia de Situación Fiscal / Cédula de Identificación Fiscal del SAT. Verifica el archivo e intenta de nuevo.',
        });
      }
      const codigoPostal = extraerCodigoPostal(textoPdf);
      const regimenesFiscales = extraerRegimenesFiscales(textoPdf);
      const regimenFiscalTexto = regimenesFiscales.length ? regimenesFiscales.join('\n') : null;
      // El nombre/razón social ya no lo captura el usuario: se lee del PDF.
      // Si no se pudo determinar, se guarda vacío en vez de bloquear la
      // carga (igual que régimen fiscal y código postal, que también son
      // de mejor esfuerzo).
      const nombre = extraerNombreRazonSocial(textoPdf) || '';

      // El RFC de la constancia y el RFC de la cuenta/formulario deben
      // ser el mismo — la relación entre un contribuyente y su constancia
      // es 1 a 1, así que no debería poder subirse la constancia de una
      // persona distinta a la que está en sesión (o a la que se escribió
      // en el formulario, si no hay sesión). A diferencia del nombre,
      // régimen fiscal y código postal (que son de mejor esfuerzo y nunca
      // bloquean la carga), esta validación SÍ bloquea si hay una
      // discrepancia real — pero solo si se pudo determinar el RFC de la
      // constancia Y hay un RFC de referencia con el cual compararlo; si
      // cualquiera de los dos falta, no hay nada que comparar y la carga
      // continúa igual que antes.
      const rfcConstancia = extraerRFC(textoPdf);
      if (rfcConstancia && rfcReferencia && rfcConstancia !== rfcReferencia) {
        return res.status(400).json({
          error: `El RFC de la constancia (${rfcConstancia}) no coincide con el RFC de tu cuenta (${rfcReferencia}). Solo puedes subir tu propia constancia de situación fiscal.`,
        });
      }

      // Regla: un solo archivo activo por contribuyente. El RFC es el
      // identificador principal (es único por contribuyente), y se usa como
      // primer criterio de búsqueda. Si no se capturó RFC (sigue siendo un
      // campo opcional/configurable), se cae de vuelta al correo, igual que
      // en versiones anteriores, por retrocompatibilidad.
      let existente = null;
      if (rfcRaw) {
        const [filas] = await pool.query(
          'SELECT * FROM registros WHERE rfc = ? AND eliminado_en IS NULL',
          [rfcRaw]
        );
        existente = filas[0] || null;
      }
      if (!existente) {
        const [filas] = await pool.query(
          'SELECT * FROM registros WHERE email = ? AND eliminado_en IS NULL',
          [email]
        );
        existente = filas[0] || null;
      }

      // Si no hay un registro ACTIVO con el mismo RFC/correo, pero sí hay
      // uno en la papelera (borrado lógico) con ese mismo RFC o correo, se
      // "revive" en lugar de intentar insertar uno nuevo: como el correo es
      // único en la base de datos, un INSERT fallaría mientras ese correo
      // siga perteneciendo, aunque sea a un registro eliminado.
      let registroEnPapelera = null;
      if (!existente) {
        if (rfcRaw) {
          const [filas] = await pool.query(
            'SELECT * FROM registros WHERE rfc = ? AND eliminado_en IS NOT NULL',
            [rfcRaw]
          );
          registroEnPapelera = filas[0] || null;
        }
        if (!registroEnPapelera) {
          const [filas] = await pool.query(
            'SELECT * FROM registros WHERE email = ? AND eliminado_en IS NOT NULL',
            [email]
          );
          registroEnPapelera = filas[0] || null;
        }
      }

      const registroAActualizar = existente || registroEnPapelera;

      // Si el registro que se va a actualizar/revivir (encontrado por RFC o
      // por correo) tiene un correo distinto al que se está enviando, hay
      // que asegurarse de que ese nuevo correo no le pertenezca ya a un
      // TERCER registro activo distinto, porque el correo también es único
      // en la base de datos (se revisa para ambos casos: reemplazo directo
      // y reactivación desde la papelera).
      if (registroAActualizar && registroAActualizar.email !== email) {
        const [filas] = await pool.query(
          'SELECT id FROM registros WHERE email = ? AND id != ? AND eliminado_en IS NULL',
          [email, registroAActualizar.id]
        );
        if (filas[0]) {
          return res.status(409).json({
            error: 'CONFLICTO_RFC_CORREO',
            mensaje:
              'El RFC que ingresaste ya está asociado a otro correo electrónico, y el correo que capturaste pertenece a un registro distinto. Verifica tus datos.',
          });
        }
      }

      if (existente && !confirmarReemplazo) {
        return res.status(409).json({
          error: 'DUPLICADO',
          mensaje: rfcRaw
            ? 'Ya existe un archivo registrado con este RFC. Confirma para reemplazarlo.'
            : 'Ya existe un archivo registrado con este correo. Confirma para reemplazarlo.',
        });
      }

      // Genera un nombre de archivo aleatorio y seguro (evita path traversal / colisiones)
      const safeExt = extensionForMime(realMime);
      const storedFilename = `${crypto.randomUUID()}${safeExt}`;
      const prefijoRegistro = storage.prefijoTenant(req);
      await storage.guardarArchivo(prefijoRegistro, null, storedFilename, req.file.buffer, realMime);

      const ahora = new Date();

      if (registroAActualizar) {
        // Elimina el archivo anterior antes de reemplazar el registro.
        // DeleteObject es idempotente (no falla si la key ya no existe),
        // así que no hace falta comprobar existencia primero.
        await storage.eliminarArchivo(prefijoRegistro, null, registroAActualizar.archivo_nombre_guardado);
        await pool.query(
          `UPDATE registros SET nombre = ?, tipo_persona = ?, rfc = ?, email = ?,
             archivo_nombre_original = ?, archivo_nombre_guardado = ?, archivo_mime = ?,
             archivo_tamano_bytes = ?, regimen_fiscal = ?, codigo_postal = ?,
             eliminado_en = NULL, actualizado_en = ?
           WHERE id = ?`,
          [
            nombre,
            tipoPersona,
            rfcRaw || null,
            email,
            req.file.originalname.slice(0, 255),
            storedFilename,
            realMime,
            req.file.size,
            regimenFiscalTexto,
            codigoPostal,
            ahora,
            registroAActualizar.id,
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO registros
            (nombre, tipo_persona, rfc, email,
             archivo_nombre_original, archivo_nombre_guardado, archivo_mime, archivo_tamano_bytes,
             regimen_fiscal, codigo_postal, creado_en, actualizado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nombre,
            tipoPersona,
            rfcRaw || null,
            email,
            req.file.originalname.slice(0, 255),
            storedFilename,
            realMime,
            req.file.size,
            regimenFiscalTexto,
            codigoPostal,
            ahora,
            ahora,
          ]
        );
      }

      return res.status(200).json({
        mensaje: registroAActualizar
          ? 'Tu archivo y datos fueron actualizados correctamente.'
          : 'Tu archivo y datos fueron registrados correctamente.',
      });
    } catch (innerErr) {
      console.error('Error al guardar registro:', innerErr);
      return res.status(500).json({ error: 'Ocurrio un error interno. Intenta de nuevo.' });
    }
  });
});

// ---------- Rutas de administracion ----------
// Protegidas con HTTP Basic Auth. Usuario/contrasena se configuran con la
// variable de entorno ADMIN_USERS en docker-compose.yml (ver .env.example).

// Verifica credenciales; el frontend la usa para validar el login.
app.get('/api/admin/login', adminLoginLimiter, tenantAggregateAuthLimiter, requireAdminAuth, (req, res) => {
  res.json({ ok: true, usuario: req.adminUser, perfil: req.adminPerfil });
});

// Obtiene la configuracion actual de campos obligatorios (misma info que la
// ruta publica, pero protegida, para prellenar el formulario de admin).
app.get(
  '/api/admin/config/campos-obligatorios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    res.json(await getCamposObligatorios());
  })
);

// Actualiza que campos son obligatorios en el formulario publico.
// Se guarda en la base de datos y se lee en vivo en cada peticion, por lo
// que el cambio aplica de inmediato sin reiniciar el servidor.
app.put(
  '/api/admin/config/campos-obligatorios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const cambios = {};

    for (const campo of CAMPOS_CONFIGURABLES) {
      if (Object.prototype.hasOwnProperty.call(body, campo)) {
        if (typeof body[campo] !== 'boolean') {
          return res.status(400).json({ error: `El campo "${campo}" debe ser verdadero o falso.` });
        }
        cambios[campo] = body[campo];
      }
    }

    const actualizado = await setCamposObligatorios(cambios);
    res.json(actualizado);
  })
);

// Consulta el catálogo actual de Uso de CFDI y cuándo/de dónde se
// sincronizó por última vez (o si sigue siendo el catálogo por defecto).
app.get(
  '/api/admin/catalogos/uso-cfdi',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const info = await getInfoSincronizacion();
    res.json({ usos: await getUsosCfdi(), ...info });
  })
);

// Sincroniza el catálogo de Uso de CFDI desde el origen configurado
// (USO_CFDI_SYNC_URL, ver .env.example). No acepta una URL desde la
// petición a propósito, para no exponer un punto de fetch a URLs
// arbitrarias: el origen se configura únicamente por variable de entorno.
// Si la sincronización falla o el formato recibido es irreconocible, el
// catálogo actual NO se modifica.
app.post(
  '/api/admin/catalogos/uso-cfdi/actualizar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  async (req, res) => {
  try {
    const catalogo = await sincronizarDesdeOrigen();
    const info = await getInfoSincronizacion();
    res.json({
      ok: true,
      mensaje: `Catálogo actualizado: ${catalogo.length} usos de CFDI.`,
      usos: catalogo,
      ...info,
    });
  } catch (err) {
    res.status(502).json({
      error: err.message || 'No se pudo sincronizar el catálogo. Intenta de nuevo más tarde.',
    });
  }
});

// ---------- Configuración de correo SMTP ----------
// Pensado principalmente para Gmail (smtp.gmail.com), pero funciona con
// cualquier proveedor SMTP estándar. La contraseña guardada nunca se
// devuelve al frontend; solo se informa si ya hay una configurada.

app.get(
  '/api/admin/config/smtp',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const config = await getConfigSmtp();
    res.json(configSmtpParaMostrar(config));
  })
);

app.put(
  '/api/admin/config/smtp',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const host = sanitizeText(body.host, 255);
    const usuario = sanitizeText(body.usuario, 255);
    const nombreRemitente = sanitizeText(body.nombre_remitente, 200);
    const correoRemitente = sanitizeText(body.correo_remitente, 200);
    const correoContador = sanitizeText(body.correo_contador, 200).toLowerCase();
    // El cuerpo del correo al cliente va dentro de un correo real, no de
    // nuestras propias páginas — se usa sanitizeTextoLibre (sin escape de
    // HTML) para no corromper el texto que verá el destinatario.
    const cuerpoCliente = sanitizeTextoLibre(body.cuerpo_cliente, 5000);
    const password = typeof body.password === 'string' ? body.password : '';
    const puerto = Number(body.puerto);
    const seguridad = body.seguridad;

    if (!host) {
      return res.status(400).json({ error: 'El host SMTP es obligatorio (ej. smtp.gmail.com).' });
    }
    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
      return res.status(400).json({ error: 'El puerto debe ser un número entre 1 y 65535.' });
    }
    if (seguridad !== 'starttls' && seguridad !== 'ssl') {
      return res.status(400).json({ error: 'Selecciona un tipo de seguridad válido (STARTTLS o SSL).' });
    }
    if (!usuario || !isValidEmail(usuario)) {
      return res.status(400).json({ error: 'El usuario SMTP debe ser un correo electrónico válido.' });
    }
    if (correoRemitente && !isValidEmail(correoRemitente)) {
      return res.status(400).json({ error: 'El correo del remitente no es válido.' });
    }
    if (correoContador && !isValidEmail(correoContador)) {
      return res.status(400).json({ error: 'El correo de quien va a facturar no es válido.' });
    }

    const nuevo = await setConfigSmtp({
      host,
      puerto,
      seguridad,
      usuario,
      password,
      nombre_remitente: nombreRemitente,
      correo_remitente: correoRemitente,
      correo_contador: correoContador,
      cuerpo_cliente: cuerpoCliente,
    });
    res.json(configSmtpParaMostrar(nuevo));
  })
);

// Envía un correo de prueba con el asunto y cuerpo que capture el
// administrador, usando la configuración SMTP ya guardada. Sirve para
// confirmar que las credenciales y el host/puerto son correctos antes de
// depender de esto en producción.
app.post(
  '/api/admin/config/smtp/prueba',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const destinatario = sanitizeText(body.destinatario, 200).toLowerCase();
    // El asunto nunca debe llevar saltos de línea (mitigación adicional
    // contra inyección de cabeceras SMTP), aunque nodemailer ya sanea esto.
    const asunto = sanitizeTextoLibre(body.asunto, 200).replace(/[\r\n]/g, ' ');
    const cuerpo = sanitizeTextoLibre(body.cuerpo, 5000);

    if (!isValidEmail(destinatario)) {
      return res.status(400).json({ error: 'Ingresa un correo destinatario válido.' });
    }
    if (!asunto) {
      return res.status(400).json({ error: 'El asunto es obligatorio.' });
    }
    if (!cuerpo) {
      return res.status(400).json({ error: 'El cuerpo del correo es obligatorio.' });
    }

    try {
      await enviarCorreo({ destinatario, asunto, cuerpo });
      res.json({ ok: true, mensaje: `Correo de prueba enviado a ${destinatario}.` });
    } catch (err) {
      res.status(502).json({ error: err.message || 'No se pudo enviar el correo de prueba.' });
    }
  })
);


// función siempre tienen eliminado_en = NULL, así que aparecen igual que
// antes en la vista de activos.
app.get(
  '/api/admin/registros',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const verPapelera = req.query.papelera === 'true';
    const condicion = verPapelera ? 'eliminado_en IS NOT NULL' : 'eliminado_en IS NULL';

    const [registros] = await pool.query(
      `SELECT id, nombre, tipo_persona, rfc, email,
              archivo_nombre_original, archivo_mime, archivo_tamano_bytes,
              regimen_fiscal, codigo_postal, eliminado_en,
              creado_en, actualizado_en
       FROM registros
       WHERE ${condicion}
       ORDER BY actualizado_en DESC`
    );
    res.json({ total: registros.length, registros });
  })
);

// Borrado lógico: marca el registro como eliminado (lo manda a la
// papelera) sin tocar el archivo en disco ni la fila en la base de datos.
// Se puede restaurar después. No afecta registros ya eliminados.
app.delete(
  '/api/admin/registros/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador invalido.' });
    }

    const ahora = new Date();
    const [resultado] = await pool.query(
      'UPDATE registros SET eliminado_en = ? WHERE id = ? AND eliminado_en IS NULL',
      [ahora, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro no encontrado o ya estaba eliminado.' });
    }
    res.json({ ok: true, mensaje: 'Registro movido a la papelera.' });
  })
);

// Restaura un registro que estaba en la papelera (deshace el borrado lógico).
app.post(
  '/api/admin/registros/:id/restaurar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador invalido.' });
    }

    const [resultado] = await pool.query(
      'UPDATE registros SET eliminado_en = NULL WHERE id = ? AND eliminado_en IS NOT NULL',
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro no encontrado en la papelera.' });
    }
    res.json({ ok: true, mensaje: 'Registro restaurado.' });
  })
);

// Borrado físico: elimina el archivo del disco y la fila de la base de
// datos de forma permanente. No se puede deshacer. Se espera que el
// registro ya esté en la papelera (el frontend solo expone este botón ahí),
// pero el backend no lo exige para no bloquear una limpieza manual directa.
app.delete(
  '/api/admin/registros/:id/permanente',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador invalido.' });
    }

    const [filas] = await pool.query('SELECT * FROM registros WHERE id = ?', [id]);
    const registro = filas[0];
    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }

    try {
      await storage.eliminarArchivo(storage.prefijoTenant(req), null, registro.archivo_nombre_guardado);
    } catch (e) {
      console.error('No se pudo borrar el archivo en el almacenamiento:', e);
      // Continua de todas formas para no dejar un registro huerfano
      // imposible de borrar solo porque el archivo ya no esta accesible.
    }

    await pool.query('DELETE FROM registros WHERE id = ?', [id]);
    res.json({ ok: true, mensaje: 'Registro y archivo eliminados permanentemente.' });
  })
);

// Sirve el archivo original de un registro para visualizarlo o descargarlo.
app.get(
  '/api/admin/archivo/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador invalido.' });
    }

    const [filas] = await pool.query('SELECT * FROM registros WHERE id = ?', [id]);
    const registro = filas[0];
    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }

    const prefijoArchivo = storage.prefijoTenant(req);
    if (!(await storage.existeArchivo(prefijoArchivo, null, registro.archivo_nombre_guardado))) {
      return res.status(404).json({ error: 'El archivo ya no existe en el servidor.' });
    }

    res.setHeader('Content-Type', registro.archivo_mime);
    const originalName = registro.archivo_nombre_original || 'archivo';
    const asciiFallback = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
    );
    await storage.enviarArchivoARespuesta(prefijoArchivo, null, registro.archivo_nombre_guardado, res);
  })
);

// ---------- Administración de usuarios (clientes, administradores y fiscales) ----------

// Lista todas las cuentas de usuario, sin exponer el hash de la
// contraseña. Sirve tanto para ubicar a un cliente y restablecer su
// contraseña, como para administrar las cuentas de administradores/fiscales
// creadas desde este mismo panel. Filtro opcional ?perfil=cliente|administrador|fiscal.
app.get(
  '/api/admin/usuarios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const perfil = sanitizeText(req.query.perfil, 20);
    const perfilesValidos = ['cliente', 'administrador', 'fiscal'];

    let sql = `SELECT id, rfc, telefono, email, debe_cambiar_password, perfil, creado_en, actualizado_en FROM usuarios`;
    const params = [];
    if (perfil && perfilesValidos.includes(perfil)) {
      sql += ' WHERE perfil = ?';
      params.push(perfil);
    }
    sql += ' ORDER BY creado_en DESC';

    const [usuarios] = await pool.query(sql, params);
    res.json({ total: usuarios.length, usuarios });
  })
);

// Crea una cuenta de usuario directamente desde el panel de administración
// (a diferencia del alta de "cliente" normal, que el propio usuario hace
// en login.html). Es la única forma de crear cuentas con perfil
// "administrador" o "fiscal" — no hay registro público para esos perfiles,
// a propósito, para que solo un administrador ya autenticado pueda otorgar
// ese nivel de acceso. Para "cliente", el campo se valida como un RFC real;
// para "administrador"/"fiscal", se trata como un nombre de usuario
// flexible (no todos tienen o quieren usar su RFC real para esto).
app.post(
  '/api/admin/usuarios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const perfil = sanitizeText(body.perfil, 20);
    const perfilesValidos = ['cliente', 'administrador', 'fiscal'];
    if (!perfilesValidos.includes(perfil)) {
      return res.status(400).json({ error: 'Selecciona un perfil válido (cliente, administrador o fiscal).' });
    }

    let rfc = sanitizeText(body.rfc, 50).toUpperCase();
    if (perfil === 'cliente') {
      if (!isValidRFCRequerido(rfc)) {
        return res.status(400).json({ error: 'Ingresa un RFC válido.' });
      }
    } else {
      if (!rfc || rfc.length < 3) {
        return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
      }
      if (!/^[A-Z0-9._-]+$/i.test(rfc)) {
        return res.status(400).json({ error: 'El nombre de usuario solo puede tener letras, números, puntos, guiones y guiones bajos.' });
      }
    }

    const telefono = sanitizeText(body.telefono, 20);
    if (telefono && !isValidTelefono(telefono)) {
      return res.status(400).json({ error: 'El teléfono no es válido.' });
    }
    if (perfil === 'cliente' && !telefono) {
      return res.status(400).json({ error: 'El teléfono es obligatorio para clientes.' });
    }

    // El correo es obligatorio para CUALQUIER perfil creado desde el panel
    // (no solo clientes) — es el único dato con el que se le puede avisar
    // a la persona que ya tiene una cuenta, así que sin él no habría forma
    // de invitarla al portal.
    const email = sanitizeText(body.email, 200).toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio y debe ser válido.' });
    }

    const password = typeof body.password === 'string' ? body.password : '';
    const errorPassword = validarPassword(password);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }
    const forzarCambio = body.forzar_cambio === true;

    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE rfc = ?', [rfc]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese RFC o nombre de usuario.' });
    }

    const passwordHash = hashPassword(password);
    const ahora = new Date();
    const [resultado] = await pool.query(
      `INSERT INTO usuarios (rfc, telefono, email, password_hash, debe_cambiar_password, perfil, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rfc, telefono || '', email, passwordHash, forzarCambio ? 1 : 0, perfil, ahora, ahora]
    );

    // La invitación es "fire-and-forget": si el correo no se pudo enviar
    // (SMTP sin configurar, credenciales incorrectas, etc.), la cuenta ya
    // se creó correctamente de todas formas — el administrador puede
    // darle las credenciales por otro medio. Nunca se bloquea la creación
    // de la cuenta por esto.
    // La URL del portal se detecta de la propia petición (protocolo +
    // host que el navegador del administrador usó para llegar aquí) en
    // vez de depender de una variable de entorno fija — así el enlace
    // funciona igual en localhost, una IP de red local, o un dominio real
    // con HTTPS, sin configurar nada aparte. Requiere `trust proxy`
    // habilitado arriba para que `req.protocol` refleje el protocolo real
    // detrás de nginx.
    const urlPortal = detectarUrlPortal(req);
    enviarInvitacionPortal({ email, rfc, password, perfil, urlPortal, marca: marcaDelTenant(req) }).catch((err) => {
      console.error('No se pudo enviar la invitación al portal:', err.message);
    });

    res.status(201).json({ ok: true, id: resultado.insertId, rfc, perfil, mensaje: 'Cuenta creada correctamente.' });
  })
);

// Restablece la contraseña de un usuario. El administrador captura la
// nueva contraseña directamente (con las mismas reglas que el registro
// público), ya que no hay un flujo de correo de recuperación en esta app.
app.put(
  '/api/admin/usuarios/:id/password',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const body = req.body || {};
    const password = typeof body.password === 'string' ? body.password : '';
    const forzarCambio = body.forzar_cambio === true;
    const errorPassword = validarPassword(password);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }

    const passwordHash = hashPassword(password);
    const [resultado] = await pool.query(
      'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = ?, actualizado_en = ? WHERE id = ?',
      [passwordHash, forzarCambio ? 1 : 0, new Date(), id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente.' });
  })
);

// Edita los datos de una cuenta existente (perfil, RFC/usuario, correo,
// teléfono) — reutiliza exactamente las mismas reglas de validación que
// POST /api/admin/usuarios. La contraseña NO se toca aquí: eso sigue
// siendo responsabilidad de PUT /api/admin/usuarios/:id/password (el
// botón "Restablecer contraseña" ya existente), para no mezclar dos
// flujos distintos en un mismo formulario.
app.put(
  '/api/admin/usuarios/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filasActuales] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    const usuarioActual = filasActuales[0];
    if (!usuarioActual) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const body = req.body || {};
    const perfil = sanitizeText(body.perfil, 20);
    const perfilesValidos = ['cliente', 'administrador', 'fiscal'];
    if (!perfilesValidos.includes(perfil)) {
      return res.status(400).json({ error: 'Selecciona un perfil válido (cliente, administrador o fiscal).' });
    }

    let rfc = sanitizeText(body.rfc, 50).toUpperCase();
    if (perfil === 'cliente') {
      if (!isValidRFCRequerido(rfc)) {
        return res.status(400).json({ error: 'Ingresa un RFC válido.' });
      }
    } else {
      if (!rfc || rfc.length < 3) {
        return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
      }
      if (!/^[A-Z0-9._-]+$/i.test(rfc)) {
        return res.status(400).json({ error: 'El nombre de usuario solo puede tener letras, números, puntos, guiones y guiones bajos.' });
      }
    }

    const telefono = sanitizeText(body.telefono, 20);
    if (telefono && !isValidTelefono(telefono)) {
      return res.status(400).json({ error: 'El teléfono no es válido.' });
    }
    if (perfil === 'cliente' && !telefono) {
      return res.status(400).json({ error: 'El teléfono es obligatorio para clientes.' });
    }

    const email = sanitizeText(body.email, 200).toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio y debe ser válido.' });
    }

    // Evita que un administrador se quite a sí mismo el acceso al panel
    // por accidente, cambiando su propio perfil de administrador/fiscal a
    // cliente mientras tiene la sesión iniciada con esa misma cuenta —
    // mismo espíritu que ya protege a DELETE /api/admin/usuarios/:id
    // contra la auto-eliminación.
    if (
      usuarioActual.rfc === req.adminUser &&
      ['administrador', 'fiscal'].includes(usuarioActual.perfil) &&
      perfil === 'cliente'
    ) {
      return res.status(400).json({
        error: 'No puedes cambiar tu propio perfil a "cliente" mientras tienes la sesión iniciada — perderías acceso al panel.',
      });
    }

    // Unicidad del RFC/usuario, excluyendo la propia fila que se está editando.
    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE rfc = ? AND id != ?', [rfc, id]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: 'Ya existe otra cuenta con ese RFC o nombre de usuario.' });
    }

    const ahora = new Date();
    await pool.query(
      `UPDATE usuarios SET rfc = ?, email = ?, telefono = ?, perfil = ?, actualizado_en = ? WHERE id = ?`,
      [rfc, email, telefono || '', perfil, ahora, id]
    );

    res.json({ ok: true, id, rfc, perfil, mensaje: 'Usuario actualizado correctamente.' });
  })
);

// Elimina una cuenta de usuario de forma permanente (no hay papelera para
// cuentas — a diferencia de constancias/tickets, no hay un archivo que
// preservar, y el administrador siempre puede volver a crear la cuenta si
// se equivocó). No afecta los registros/tickets que esa persona ya haya
// subido: esos se identifican por RFC, no por el id de esta tabla, así
// que quedan intactos aunque se borre la cuenta.
app.delete(
  '/api/admin/usuarios/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT rfc FROM usuarios WHERE id = ?', [id]);
    const usuario = filas[0];
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Evita que un administrador se elimine a sí mismo por accidente
    // mientras tiene la sesión iniciada con esa misma cuenta (req.adminUser
    // es el RFC/usuario con el que se autenticó, ver requireAdminAuth en
    // backend/utils/auth.js).
    if (usuario.rfc === req.adminUser) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta mientras tienes la sesión iniciada.' });
    }

    await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ ok: true, mensaje: 'Usuario eliminado correctamente.' });
  })
);

// ---------- Cuenta de respaldo "admin" ----------
// Es la única cuenta de administrador cuya contraseña vive en MySQL en vez
// de en ADMIN_USERS — ver la explicación completa en
// backend/utils/auth.js. Se siembra con "admin" al arrancar el backend
// (ensureSchema en db.js); estos endpoints permiten cambiarla desde la
// interfaz gráfica. No hay endpoint para "crear" esta cuenta — ya existe
// siempre, desde el primer arranque.

app.get(
  '/api/admin/config/admin-password',
  adminApiLimiter,
  requireAdminAuth,
  requireUsuarioAdminExacto,
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      "SELECT valor FROM configuracion WHERE clave = 'admin_fallback_password_hash'"
    );
    res.json({ configurada: filas.length > 0 });
  })
);

app.put(
  '/api/admin/config/admin-password',
  adminApiLimiter,
  requireAdminAuth,
  requireUsuarioAdminExacto,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const password = typeof body.password === 'string' ? body.password : '';
    const errorPassword = validarPassword(password);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }

    const passwordHash = hashPassword(password);
    await pool.query(
      `INSERT INTO configuracion (clave, valor) VALUES ('admin_fallback_password_hash', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [passwordHash]
    );
    res.json({ ok: true, mensaje: 'Contraseña de la cuenta "admin" actualizada correctamente.' });
  })
);

// ---------- Configuración global (IVA y zona horaria) ----------
// Usados al registrar una orden de compra (ver más abajo): el IVA se
// aplica al monto capturado, y la zona horaria determina cómo se
// auto-genera y se muestra la fecha/hora de la compra.

app.get(
  '/api/admin/config/global',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'fiscal'),
  asyncHandler(async (req, res) => {
    const config = await getConfiguracionGlobal();
    res.json(config);
  })
);

app.put(
  '/api/admin/config/global',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'fiscal'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    // Este endpoint guarda campos de VARIAS tarjetas/controles distintos,
    // con permisos distintos entre sí — "correo_reportes" pertenece a
    // "Configuración Reportes" (solo administrador), y
    // "ordenes_compra_habilitado" es el interruptor "Habilitar Orden de
    // compra" (movido a la vista "Usuarios", también exclusiva de
    // administrador) — ninguno de los dos lo puede tocar un perfil
    // fiscal, aunque sí tenga acceso al resto de los campos de esta
    // misma ruta (IVA, zona horaria, Clave SAT, link). Cada uno necesita
    // su propio chequeo aparte del área general ya aplicada arriba
    // (requireAdminArea solo cubre el caso común de los demás campos).
    if (body.correo_reportes !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a configurar el correo de reportes.' });
    }
    if (body.ordenes_compra_habilitado !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a habilitar o deshabilitar Orden de compra.' });
    }
    try {
      // rfc_compania / regimen_fiscal_compania / tipo_persona_compania
      // ya NO se mandan desde aquí — se quitó ese campo del formulario
      // general; ahora solo se escriben juntos desde
      // POST /api/admin/config/constancia-compania (más abajo), después
      // de leerlos de la constancia real subida.
      const actualizado = await setConfiguracionGlobal({
        iva_porcentaje: body.iva_porcentaje,
        zona_horaria: body.zona_horaria,
        ordenes_compra_habilitado: body.ordenes_compra_habilitado,
        clave_sat: body.clave_sat,
        link_codigos_sat: body.link_codigos_sat,
        correo_reportes: body.correo_reportes,
      });
      res.json(actualizado);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  })
);

// Sube la constancia de situación fiscal de la propia COMPAÑÍA (no la de
// un cliente) — reutiliza exactamente la misma extracción de PDF que ya
// usa POST /api/registro para la constancia de un cliente (mismo
// validador de contenido real, misma detección de "¿esto es en verdad
// una constancia del SAT?", mismas funciones de extracción), pero en vez
// de guardar un registro de cliente, escribe RFC + régimen(es) fiscal(es)
// + tipo de persona (calculado a partir del régimen) directamente en la
// configuración global — son los datos que se muestran en la barra de
// sesión del panel junto a "Administración".
app.post(
  '/api/admin/config/constancia-compania',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'fiscal'),
  (req, res) => {
  subirConTenant(upload, 'archivo', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `El archivo excede el tamaño máximo permitido de ${MAX_FILE_SIZE_MB} MB.`,
        });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({
          error: 'Solo se aceptan archivos en formato PDF (Constancia de Situación Fiscal emitida por el SAT).',
        });
      }
      console.error('Error de carga (constancia de la compañía):', err);
      return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Debes adjuntar la constancia de situación fiscal.' });
      }

      const realMime = detectRealMimeType(req.file.buffer);
      if (!realMime || !ALLOWED_MIME_TYPES.has(realMime)) {
        return res.status(400).json({ error: 'El contenido del archivo no coincide con un PDF válido.' });
      }

      const textoPdf = await extraerTextoPdf(req.file.buffer);
      if (textoPdf === null) {
        return res.status(400).json({
          error: 'El PDF no se pudo procesar. Verifica que sea un archivo PDF válido y no esté dañado.',
        });
      }
      if (!pareceConstanciaFiscal(textoPdf)) {
        return res.status(400).json({
          error:
            'El PDF no parece ser una Constancia de Situación Fiscal / Cédula de Identificación Fiscal del SAT. Verifica el archivo e intenta de nuevo.',
        });
      }

      // A diferencia de la constancia de un cliente (donde el RFC es
      // "de mejor esfuerzo" porque ya se captura aparte en el
      // formulario), aquí el RFC ES el dato que se está buscando — sin
      // él, no hay nada que mostrar en la barra de sesión, así que si no
      // se pudo identificar, se rechaza con un error claro en vez de
      // guardar una configuración a medias.
      const rfc = extraerRFC(textoPdf);
      if (!rfc) {
        return res.status(400).json({
          error: 'No se pudo identificar el RFC en la constancia. Verifica que el PDF sea legible e intenta de nuevo.',
        });
      }

      const regimenesFiscales = extraerRegimenesFiscales(textoPdf);
      const regimenFiscalTexto = regimenesFiscales.length ? regimenesFiscales.join('\n') : '';

      // Para determinar Física/Moral se combinan TRES señales, en orden
      // de confiabilidad (ver determinarTipoPersona() en pdfExtract.js
      // para el detalle completo de cada una): primero los CAMPOS que el
      // propio documento del SAT trae ("Primer/Segundo Apellido" solo
      // existen en una constancia de Física; "Régimen Capital"/"Nombre
      // Comercial" solo en una de Moral — la señal más directa, ya que
      // lee la estructura real del formulario en vez de adivinar);
      // después el régimen fiscal (autoritativo con un código EXCLUSIVO
      // de moral, como 601/603); y por último la razón social como
      // desempate para regímenes que aplican a ambos tipos de
      // contribuyente (el caso más común siendo 626 RESICO).
      const razonSocial = extraerNombreRazonSocial(textoPdf) || '';
      const tipoPersona = determinarTipoPersona(regimenesFiscales, razonSocial, textoPdf);

      const actualizado = await setConfiguracionGlobal({
        rfc_compania: rfc,
        razon_social_compania: razonSocial,
        regimen_fiscal_compania: regimenFiscalTexto,
        tipo_persona_compania: tipoPersona,
      });
      res.json({
        ...actualizado,
        regimenes_encontrados: regimenesFiscales,
      });
    } catch (errInterno) {
      console.error('Error al procesar la constancia de la compañía:', errInterno);
      res.status(400).json({ error: errInterno.message || 'No se pudo procesar la constancia.' });
    }
  });
});

// Lista de zonas horarias válidas en México, para el selector del panel
// — son identificadores fijos (no texto libre), así que este catálogo
// vive en el backend y el frontend solo lo consume.
app.get(
  '/api/admin/config/zonas-horarias',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'fiscal'),
  asyncHandler(async (req, res) => {
    res.json({ zonas: ZONAS_HORARIAS_MEXICO });
  })
);

// ---------- Administración de tickets ----------

// Consulta y actualiza cada cuántos días se eliminan automáticamente los
// tickets (imagen + factura + fila) — y, con la MISMA configuración, las
// órdenes de compra también. `dias: null` desactiva el borrado
// automático de ambas. También informa cuándo corrió la última limpieza
// de cada una y cuántos elementos eliminó, para que el administrador
// tenga visibilidad de que sí está funcionando.
app.get(
  '/api/admin/config/tickets-retencion',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const dias = await getRetencionTicketsDias();
    const ultimaLimpieza = await getInfoUltimaLimpieza(CLAVE_ULTIMA_LIMPIEZA_TICKETS);
    const ultimaLimpiezaOrdenes = await getInfoUltimaLimpieza(CLAVE_ULTIMA_LIMPIEZA_ORDENES);
    res.json({ dias, ultimaLimpieza, ultimaLimpiezaOrdenes });
  })
);

app.put(
  '/api/admin/config/tickets-retencion',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    // dias=0 o dias=null desactivan el borrado automático a propósito.
    const diasCrudo = body.dias;
    const dias = diasCrudo === null || diasCrudo === '' || diasCrudo === 0 ? null : Number(diasCrudo);

    if (dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 3650)) {
      return res.status(400).json({ error: 'Los días deben ser un número entero entre 1 y 3650 (o 0 para desactivar).' });
    }

    const guardado = await setRetencionTicketsDias(dias);
    res.json({ dias: guardado });
  })
);

// ---------- Reportes ----------

// Botón "Enviar reporte" (envío manual, bajo demanda) — a diferencia del
// reporte automático (que captura justo lo que está a punto de borrarse
// por retención), este captura los tickets y órdenes de compra ACTIVOS
// creados en lo que va del mes calendario actual — un "reporte del mes"
// que se puede pedir en cualquier momento, sin esperar a que algo esté
// por vencerse.
app.post(
  '/api/admin/reportes/enviar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const ahora = new Date();
    const inicioDelMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);

    const [ticketsDelMes] = await pool.query(
      'SELECT * FROM tickets WHERE eliminado_en IS NULL AND creado_en >= ? ORDER BY creado_en ASC',
      [inicioDelMes]
    );
    const [ordenesDelMes] = await pool.query(
      'SELECT * FROM ordenes_compra WHERE eliminado_en IS NULL AND creado_en >= ? ORDER BY creado_en ASC',
      [inicioDelMes]
    );

    const items = [
      ...ticketsDelMes.map((t) => ({
        tipo_registro: 'ticket',
        identificador: t.folio,
        rfc: t.rfc,
        estatus_o_concepto: t.estatus,
        monto: null,
        fecha_registro: t.creado_en,
        atendido_por: t.actualizado_por,
      })),
      ...ordenesDelMes.map((o) => ({
        tipo_registro: 'orden_compra',
        identificador: o.numero_compra,
        rfc: o.email,
        estatus_o_concepto: o.concepto,
        monto: o.total,
        fecha_registro: o.creado_en,
      })),
    ];

    const resultado = await generarYEnviarReporte({
      tipo: 'manual',
      items,
      rangoInicio: inicioDelMes,
      rangoFin: ahora,
    });

    // Importante: el reporte YA se generó y se guardó en este punto, sin
    // importar qué pase con el correo — así que "no hay correo
    // configurado" NO es un error HTTP (antes se devolvía como 400, lo
    // que hacía que el botón mostrara "no se envió nada" aunque el
    // reporte sí existiera y ya se pudiera consultar en "Leer MD"). Solo
    // se considera un error real cuando SÍ había un correo configurado
    // pero el envío en sí falló (ej. SMTP no configurado o rechazado).
    if (resultado.errorCorreo) {
      return res.status(502).json({
        error: `El reporte se generó y se guardó, pero no se pudo enviar por correo: ${resultado.errorCorreo}`,
        reporteId: resultado.reporteId,
        correoEnviado: false,
      });
    }

    res.json({
      reporteId: resultado.reporteId,
      correoEnviado: resultado.correoEnviado,
      correoDestino: resultado.correoDestino,
    });
  })
);

// Lista todos los reportes ya generados (solo metadatos, sin los items
// ni el Markdown completo) — para el selector de la vista "Lectura de
// reportes".
app.get(
  '/api/admin/reportes',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const [reportes] = await pool.query(
      `SELECT id, tipo, fecha_generacion, rango_inicio, rango_fin, correo_enviado_a, correo_enviado,
              total_tickets, total_ordenes, creado_en
       FROM reportes ORDER BY fecha_generacion DESC`
    );
    res.json({ reportes });
  })
);

// Contenido en Markdown de un reporte específico — para el botón "Leer MD".
app.get(
  '/api/admin/reportes/:id/md',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [filas] = await pool.query('SELECT id, fecha_generacion, md_contenido FROM reportes WHERE id = ?', [id]);
    if (filas.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado.' });
    }
    res.json({ id: filas[0].id, fechaGeneracion: filas[0].fecha_generacion, mdContenido: filas[0].md_contenido });
  })
);

// Items estructurados de un reporte, con filtros opcionales — para la
// tabla filtrable de "Lectura de reportes". Todos los filtros se pueden
// combinar entre sí.
app.get(
  '/api/admin/reportes/:id/items',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { tipo_registro: tipoRegistro, estatus, rfc, fecha_desde: fechaDesde, fecha_hasta: fechaHasta } = req.query;
    const estatusValidos = ['pendiente', 'en_curso', 'cancelado', 'listo'];

    let sql = 'SELECT * FROM reporte_items WHERE reporte_id = ?';
    const params = [id];
    if (tipoRegistro && ['ticket', 'orden_compra'].includes(tipoRegistro)) {
      sql += ' AND tipo_registro = ?';
      params.push(tipoRegistro);
    }
    // "estatus" filtra exactamente sobre la columna compartida
    // estatus_o_concepto — como esta columna guarda el estatus de un
    // ticket O el concepto de una orden, filtrar por un estatus válido
    // (ej. "listo") en la práctica solo empareja tickets, ya que el
    // concepto libre de una orden no coincidiría con ese valor exacto.
    if (estatus && estatusValidos.includes(estatus)) {
      sql += ' AND estatus_o_concepto = ?';
      params.push(estatus);
    }
    if (rfc) {
      sql += ' AND rfc LIKE ?';
      params.push(`%${sanitizeText(rfc, 100)}%`);
    }
    if (fechaDesde) {
      sql += ' AND fecha_registro >= ?';
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      sql += ' AND fecha_registro <= ?';
      params.push(fechaHasta);
    }
    sql += ' ORDER BY fecha_registro ASC';

    const [items] = await pool.query(sql, params);
    res.json({ total: items.length, items });
  })
);

// Exporta los items de un reporte (con los MISMOS filtros que ya soporta
// GET .../items, para exportar exactamente lo que se está viendo en
// pantalla) a CSV o a un .xlsx real.
app.get(
  '/api/admin/reportes/:id/exportar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const formato = req.query.formato === 'excel' ? 'excel' : 'csv';
    const { tipo_registro: tipoRegistro, estatus, rfc, fecha_desde: fechaDesde, fecha_hasta: fechaHasta } = req.query;
    const estatusValidosExportar = ['pendiente', 'en_curso', 'cancelado', 'listo'];

    let sql = 'SELECT * FROM reporte_items WHERE reporte_id = ?';
    const params = [id];
    if (tipoRegistro && ['ticket', 'orden_compra'].includes(tipoRegistro)) {
      sql += ' AND tipo_registro = ?';
      params.push(tipoRegistro);
    }
    if (estatus && estatusValidosExportar.includes(estatus)) {
      sql += ' AND estatus_o_concepto = ?';
      params.push(estatus);
    }
    if (rfc) {
      sql += ' AND rfc LIKE ?';
      params.push(`%${sanitizeText(rfc, 100)}%`);
    }
    if (fechaDesde) {
      sql += ' AND fecha_registro >= ?';
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      sql += ' AND fecha_registro <= ?';
      params.push(fechaHasta);
    }
    sql += ' ORDER BY fecha_registro ASC';

    const [items] = await pool.query(sql, params);
    const configGlobalExport = await getConfiguracionGlobal();

    if (formato === 'excel') {
      const buffer = await generarExcelBuffer(items, configGlobalExport.zona_horaria);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-${id}.xlsx"`);
      res.send(buffer);
    } else {
      const csv = generarCSV(items, configGlobalExport.zona_horaria);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-${id}.csv"`);
      res.send(csv);
    }
  })
);

// Elimina un reporte por completo — sus items en "reporte_items" se
// borran automáticamente por el ON DELETE CASCADE ya definido en la
// base de datos (ver db.js), así que basta con borrar la fila de
// "reportes". Es un borrado permanente (no hay papelera para reportes,
// a diferencia de constancias/tickets) — el Markdown ya se pudo haber
// descargado o enviado por correo antes de llegar aquí.
app.delete(
  '/api/admin/reportes/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [resultado] = await pool.query('DELETE FROM reportes WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado.' });
    }
    res.json({ eliminado: true });
  })
);

// Tickets en estatus "pendiente" que no pudieron notificarse
// automáticamente porque el administrador todavía no configuró el "correo
// de quien va a facturar" (dentro de la configuración SMTP). Como ese
// correo ahora es un solo valor global (no uno por RFC), la condición es
// simple: si está configurado, se asume que todos los tickets pendientes
// ya se notificaron (o se notificarán) ahí, y esta lista sale vacía. Se
// consulta en vivo (no es un aviso "ya visto/no visto"): en cuanto el
// administrador configura el correo, la lista se vacía sola la próxima
// vez que se consulte.
app.get(
  '/api/admin/tickets/pendientes-sin-contador',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const config = await getConfigSmtp();
    const correoContadorConfigurado = Boolean(config && config.correo_contador);

    if (correoContadorConfigurado) {
      return res.json({ total: 0, tickets: [] });
    }

    const [tickets] = await pool.query(
      `SELECT id, folio, rfc, creado_en FROM tickets
       WHERE estatus = 'pendiente' AND eliminado_en IS NULL
       ORDER BY creado_en DESC`
    );
    res.json({ total: tickets.length, tickets });
  })
);

// Lista todos los tickets de todos los usuarios, opcionalmente filtrados
// por estatus (?estatus=pendiente|en_curso|cancelado|listo), por quién
// hizo el último cambio (?actualizado_por=usuario) y por papelera
// (?papelera=true muestra los eliminados lógicamente; por defecto solo
// los activos). Los tres filtros se pueden combinar entre sí.
app.get(
  '/api/admin/tickets',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const estatus = sanitizeText(req.query.estatus, 20);
    const estatusValidos = ['pendiente', 'en_curso', 'cancelado', 'listo'];
    const actualizadoPor = sanitizeText(req.query.actualizado_por, 100);
    const verPapelera = req.query.papelera === 'true';

    let sql = `SELECT t.id, t.folio, t.rfc, t.uso_cfdi, t.tipo_pago, t.tipo_pago_otro, t.comentarios,
                      t.imagen_nombre_original, t.estatus, t.factura_nombre_original, t.notas_admin,
                      t.actualizado_por, t.eliminado_en, t.creado_en, t.actualizado_en,
                      oc.numero_compra AS orden_numero_compra,
                      oc.fecha_compra AS orden_fecha_compra,
                      oc.total AS orden_total
               FROM tickets t
               LEFT JOIN ordenes_compra oc ON t.orden_compra_id = oc.id AND oc.eliminado_en IS NULL
               WHERE ${verPapelera ? 't.eliminado_en IS NOT NULL' : 't.eliminado_en IS NULL'}`;
    const params = [];
    if (estatus && estatusValidos.includes(estatus)) {
      sql += ' AND t.estatus = ?';
      params.push(estatus);
    }
    if (actualizadoPor) {
      sql += ' AND t.actualizado_por = ?';
      params.push(actualizadoPor);
    }
    sql += ' ORDER BY t.creado_en DESC';

    const [ticketsCrudos] = await pool.query(sql, params);

    // Se le da formato a la fecha/hora de la orden vinculada (si tiene
    // una) con la MISMA zona horaria configurada actualmente — mismo
    // criterio que ya usa el listado de "Órdenes de compra" y el correo
    // de confirmación — para que el administrador vea EXACTAMENTE la
    // misma fecha/hora que el cliente capturó al subir el ticket, y
    // pueda compararla contra la foto del ticket.
    const configGlobalTickets = await getConfiguracionGlobal();
    const tickets = ticketsCrudos.map((t) => {
      const { orden_fecha_compra: ordenFechaCompra, ...resto } = t;
      if (!ordenFechaCompra) {
        return { ...resto, orden_fecha_compra_formateada: null };
      }
      return {
        ...resto,
        orden_fecha_compra_formateada: formatearFechaHoraMexico(
          new Date(`${String(ordenFechaCompra).replace(' ', 'T')}Z`),
          configGlobalTickets.zona_horaria
        ),
      };
    });

    res.json({ total: tickets.length, tickets });
  })
);

// Lista los usuarios distintos que han quedado registrados en
// "actualizado_por" (tickets activos, sin importar su estatus) — para
// llenar el filtro "Usuario" del panel con opciones que de verdad
// existen, en vez de mostrar cuentas que nunca han tocado un ticket, o
// dejar fuera a alguien que sí lo hizo pero cuya cuenta ya se borró
// después.
app.get(
  '/api/admin/tickets/usuarios-actualizado-por',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      `SELECT DISTINCT actualizado_por FROM tickets
       WHERE actualizado_por IS NOT NULL AND eliminado_en IS NULL
       ORDER BY actualizado_por ASC`
    );
    res.json({ usuarios: filas.map((f) => f.actualizado_por) });
  })
);

// Cambia el estatus de un ticket (y opcionalmente agrega notas internas).
// Para marcarlo "listo" normalmente se usa el endpoint de subir factura
// (abajo), que ya lo marca como listo automáticamente; este endpoint sirve
// para mover a "en_curso" o "cancelado", o para agregar/editar notas.
app.put(
  '/api/admin/tickets/:id/estatus',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const body = req.body || {};
    const estatus = sanitizeText(body.estatus, 20);
    const estatusValidos = ['pendiente', 'en_curso', 'cancelado', 'listo'];
    if (!estatusValidos.includes(estatus)) {
      return res.status(400).json({ error: 'Estatus inválido.' });
    }
    if (estatus === 'listo') {
      return res.status(400).json({
        error: 'Para marcar un ticket como "listo", sube la factura correspondiente (eso lo marca automáticamente).',
      });
    }

    const notasAdmin = sanitizeText(body.notas_admin, 1000);

    // Se guarda SIEMPRE el usuario de la sesión que hizo el cambio
    // (req.adminUser ya lo pone requireAdminAuth, sin importar por cuál
    // de los tres mecanismos de autenticación haya entrado — ADMIN_USERS,
    // la cuenta de respaldo "admin", o una cuenta administrador/fiscal
    // creada desde el panel) — así se sabe quién tiene asignado cada
    // ticket, sin depender de que el propio administrador lo anote a mano
    // en las notas.
    const [resultado] = await pool.query(
      'UPDATE tickets SET estatus = ?, notas_admin = ?, actualizado_por = ?, actualizado_en = ? WHERE id = ?',
      [estatus, notasAdmin || null, req.adminUser, new Date(), id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    res.json({ ok: true, mensaje: 'Estatus actualizado.' });
  })
);

// Borrado lógico: manda el ticket a la papelera (no toca los archivos en
// disco ni la fila en la base de datos). Se puede restaurar después. No
// afecta tickets que ya estaban eliminados.
app.delete(
  '/api/admin/tickets/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [resultado] = await pool.query(
      'UPDATE tickets SET eliminado_en = ? WHERE id = ? AND eliminado_en IS NULL',
      [new Date(), id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado o ya estaba eliminado.' });
    }
    res.json({ ok: true, mensaje: 'Ticket movido a la papelera.' });
  })
);

// Restaura un ticket que estaba en la papelera (deshace el borrado lógico).
app.post(
  '/api/admin/tickets/:id/restaurar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [resultado] = await pool.query(
      'UPDATE tickets SET eliminado_en = NULL WHERE id = ? AND eliminado_en IS NOT NULL',
      [id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado en la papelera.' });
    }
    res.json({ ok: true, mensaje: 'Ticket restaurado.' });
  })
);

// Borrado físico: elimina la imagen del ticket y la factura (si existe)
// del disco, y la fila de la base de datos, de forma permanente. No se
// puede deshacer. Se espera que el ticket ya esté en la papelera (el
// frontend solo expone este botón ahí), pero el backend no lo exige para
// no bloquear una limpieza manual directa.
app.delete(
  '/api/admin/tickets/:id/permanente',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
    const ticket = filas[0];
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    const prefijoTicket = storage.prefijoTenant(req);
    try {
      await storage.eliminarArchivo(prefijoTicket, 'tickets', ticket.imagen_nombre_guardado);
    } catch (e) {
      console.error('No se pudo borrar la imagen del ticket en el almacenamiento:', e);
      // Continua de todas formas para no dejar un ticket huerfano
      // imposible de borrar solo porque el archivo ya no esta accesible.
    }
    if (ticket.factura_nombre_guardado) {
      try {
        await storage.eliminarArchivo(prefijoTicket, 'facturas', ticket.factura_nombre_guardado);
      } catch (e) {
        console.error('No se pudo borrar la factura del ticket en el almacenamiento:', e);
      }
    }

    await pool.query('DELETE FROM tickets WHERE id = ?', [id]);
    res.json({ ok: true, mensaje: 'Ticket y sus archivos eliminados permanentemente.' });
  })
);

// Sube el archivo de la factura ya generada para un ticket, y lo marca
// como "listo" automáticamente.
app.post(
  '/api/admin/tickets/:id/factura',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  (req, res) => {
  subirConTenant(uploadFactura, 'factura', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `El archivo excede el tamaño máximo permitido de ${MAX_FILE_SIZE_MB} MB.`,
        });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({
          error: 'Solo se acepta un archivo ZIP (con el PDF y el XML de la factura dentro, comprimidos juntos).',
        });
      }
      console.error('Error al subir la factura:', err);
      return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
    }

    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Identificador inválido.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Debes adjuntar el archivo ZIP de la factura.' });
      }

      // Verifica el contenido real del archivo (firma binaria), no solo la
      // extensión/MIME que haya declarado el navegador — mismo patrón que
      // ya se usa para la constancia (PDF) y los tickets (imagen). Un
      // archivo renombrado a ".zip" pero que en realidad es otra cosa se
      // rechaza aquí, aunque haya pasado el filtro inicial del multer.
      if (!esZipValido(req.file.buffer)) {
        return res.status(400).json({
          error: 'El contenido del archivo no coincide con un ZIP válido.',
        });
      }

      // Un CFDI real siempre trae el PDF y el XML de la factura juntos —
      // se confirma que el ZIP realmente contenga al menos un archivo de
      // cada uno adentro (leyendo su directorio central, sin descomprimir
      // nada), no solo que el contenedor en sí sea un ZIP válido.
      const contenidoZip = zipContienePdfYXml(req.file.buffer);
      if (!contenidoZip.valido) {
        let detalle;
        if (!contenidoZip.tienePdf && !contenidoZip.tieneXml) {
          detalle = 'no se encontró ningún PDF ni XML dentro del ZIP.';
        } else if (!contenidoZip.tienePdf) {
          detalle = 'no se encontró ningún archivo PDF dentro del ZIP.';
        } else {
          detalle = 'no se encontró ningún archivo XML dentro del ZIP.';
        }
        return res.status(400).json({
          error: `El ZIP debe contener tanto el PDF como el XML de la factura — ${detalle}`,
        });
      }

      const [filas] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
      const ticket = filas[0];
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket no encontrado.' });
      }

      req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

      const prefijoFactura = storage.prefijoTenant(req);

      // Borra la factura anterior si se esta reemplazando. DeleteObject es
      // idempotente, no hace falta comprobar existencia primero.
      if (ticket.factura_nombre_guardado) {
        await storage.eliminarArchivo(prefijoFactura, 'facturas', ticket.factura_nombre_guardado);
      }

      // Extensión y MIME fijos (".zip" / "application/zip") ya que el
      // contenido se verificó arriba con esZipValido — no se confía en la
      // extensión del nombre de archivo original ni en el mimetype que
      // haya declarado el navegador para decidir cómo se guarda.
      const storedFilename = `${crypto.randomUUID()}.zip`;
      await storage.guardarArchivo(prefijoFactura, 'facturas', storedFilename, req.file.buffer, 'application/zip');

      await pool.query(
        `UPDATE tickets SET estatus = 'listo', factura_nombre_original = ?,
           factura_nombre_guardado = ?, factura_mime = ?, actualizado_por = ?, actualizado_en = ?
         WHERE id = ?`,
        [req.file.originalname.slice(0, 255), storedFilename, 'application/zip', req.adminUser, new Date(), id]
      );

      // Notifica al cliente (correo de "recibir facturas" asociado al RFC
      // del ticket, ver registros.email) que su factura ya está lista.
      // Igual que con la notificación al contador: no se espera (await)
      // ni se deja que una falla aquí afecte la respuesta al
      // administrador — la factura ya se guardó correctamente.
      notificarFacturaListaAlCliente(ticket.rfc, ticket.folio, marcaDelTenant(req)).catch((err) => {
        console.error('No se pudo notificar la factura lista al cliente:', err.message);
      });

      res.json({ ok: true, mensaje: 'Factura cargada. El ticket se marcó como "listo".' });
    } catch (innerErr) {
      console.error('Error al guardar la factura:', innerErr);
      res.status(500).json({ error: 'Ocurrió un error interno. Intenta de nuevo.' });
    }
  });
});

// Envía la notificación de "factura lista" al correo del cliente asociado
// al RFC del ticket (registros.email — el mismo correo que ya se usa para
// "recibir facturas" en el formulario de constancia). Si no hay un
// registro activo con ese RFC (el cliente aún no ha subido su constancia),
// simplemente no manda nada.
// Asunto fijo (no configurable) del correo de "factura lista" al cliente —
// a diferencia del cuerpo, que sí se puede personalizar desde el panel.
const ASUNTO_FACTURA_LISTA = 'Factura lista — Folio {folio}';

async function notificarFacturaListaAlCliente(rfc, folio, marca) {
  const [filas] = await pool.query(
    'SELECT email FROM registros WHERE rfc = ? AND eliminado_en IS NULL LIMIT 1',
    [rfc]
  );
  const correoCliente = filas[0] && filas[0].email;
  if (!correoCliente) return;

  // El cuerpo es configurable desde el panel de administración (tarjeta de
  // correo SMTP), con variables {folio} y {rfc} que se sustituyen aquí por
  // su valor real. Si el administrador nunca lo personalizó, se usa el
  // valor por defecto de esa misma configuración (ver DEFAULTS_SMTP en
  // backend/utils/email.js). El asunto siempre es el mensaje fijo de
  // arriba — no es configurable.
  const config = await getConfigSmtp();
  const variables = { folio, rfc, marca: marca || MARCA_DEFECTO };
  const asunto = aplicarPlantilla(ASUNTO_FACTURA_LISTA, variables);
  const cuerpo = aplicarPlantilla((config && config.cuerpo_cliente) || DEFAULTS_SMTP.cuerpo_cliente, variables);

  await enviarCorreo({
    destinatario: correoCliente,
    asunto,
    cuerpo,
  });
}

// Ve la imagen original de un ticket (protegido, para revisarlo antes de facturar).
app.get(
  '/api/admin/tickets/:id/imagen',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
    const ticket = filas[0];
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    const prefijoImagen = storage.prefijoTenant(req);
    if (!(await storage.existeArchivo(prefijoImagen, 'tickets', ticket.imagen_nombre_guardado))) {
      return res.status(404).json({ error: 'La imagen ya no existe en el servidor.' });
    }

    res.setHeader('Content-Type', ticket.imagen_mime);
    res.setHeader('Content-Disposition', 'inline');
    await storage.enviarArchivoARespuesta(prefijoImagen, 'tickets', ticket.imagen_nombre_guardado, res);
  })
);

// Descarga la factura (el ZIP con PDF+XML) ya subida a un ticket — para
// que el administrador pueda verificarla, o simplemente volver a
// descargarla, sin depender de tenerla todavía en su propia computadora.
app.get(
  '/api/admin/tickets/:id/factura',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
    const ticket = filas[0];
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!ticket.factura_nombre_guardado) {
      return res.status(409).json({ error: 'Este ticket todavía no tiene una factura subida.' });
    }

    const prefijoFacturaGet = storage.prefijoTenant(req);
    if (!(await storage.existeArchivo(prefijoFacturaGet, 'facturas', ticket.factura_nombre_guardado))) {
      return res.status(404).json({ error: 'El archivo de la factura ya no existe en el servidor.' });
    }

    res.setHeader('Content-Type', ticket.factura_mime || 'application/octet-stream');
    const originalName = ticket.factura_nombre_original || `factura-${ticket.folio}.zip`;
    const asciiFallback = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
    );
    await storage.enviarArchivoARespuesta(prefijoFacturaGet, 'facturas', ticket.factura_nombre_guardado, res);
  })
);

// ---------- Órdenes de compra ----------

// Lista los correos de constancias activas, para el desplegable de
// "correo electrónico" del formulario de orden de compra — solo se puede
// elegir un correo que ya tenga una constancia de situación fiscal
// subida, no capturar uno a mano. Junto con cada correo se manda el RFC
// y el nombre/razón social asociados (el correo es único por registro,
// ver UNIQUE KEY uq_registros_email en db.js, así que no hace falta
// DISTINCT) — el frontend los muestra de solo lectura en cuanto se
// selecciona un correo, como medida para confirmar que son los datos
// correctos antes de registrar la orden.
app.get(
  '/api/admin/correos-registrados',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      'SELECT email, rfc, nombre FROM registros WHERE eliminado_en IS NULL ORDER BY email ASC'
    );
    res.json({ correos: filas });
  })
);

// Crea una orden de compra. La fecha se auto-genera (no la manda el
// cliente) usando la zona horaria configurada en "Configuraciones
// globales"; el IVA también se toma de esa configuración — se guarda una
// "foto" del porcentaje vigente en ese momento, para que un cambio futuro
// del IVA global no altere el total de órdenes ya creadas.
app.post(
  '/api/admin/ordenes-compra',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    const concepto = sanitizeText(body.concepto, 255);
    if (!concepto) {
      return res.status(400).json({ error: 'El concepto de venta o servicio es obligatorio.' });
    }

    const cantidad = Number(body.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un número mayor a cero.' });
    }

    const email = sanitizeText(body.email, 200).toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Selecciona un correo electrónico válido.' });
    }

    // "Cliente nuevo" (sin constancia todavía, ver frontend): se salta la
    // exigencia de que el correo ya tenga una constancia activa — la orden
    // solo necesita un correo válido (ver ordenes_compra en db.js, no
    // guarda RFC/nombre, así que no hay ningún otro dato que depender de
    // un registro existente). "Cliente ya registrado" (el modo de
    // siempre) sigue exigiendo la constancia activa — el desplegable del
    // frontend solo ofrece esos correos, pero se revalida aquí del lado
    // del servidor por si acaso (nunca se confía solo en lo que mande el
    // navegador).
    if (!body.es_cliente_nuevo) {
      const [registrosCoincidentes] = await pool.query(
        'SELECT id FROM registros WHERE email = ? AND eliminado_en IS NULL LIMIT 1',
        [email]
      );
      if (registrosCoincidentes.length === 0) {
        return res.status(400).json({
          error: 'Ese correo no corresponde a ninguna constancia de situación fiscal activa.',
        });
      }
    }

    const configGlobal = await getConfiguracionGlobal();
    const ivaPorcentaje = configGlobal.iva_porcentaje;
    // Redondeo a 2 decimales (centavos), como cualquier monto en pesos.
    const total = Math.round(cantidad * (1 + ivaPorcentaje / 100) * 100) / 100;

    // `ahora` se normaliza a segundo exacto (sin milisegundos) para que la
    // BD (MySQL redondea DATETIME sin fracción), la respuesta a este
    // endpoint y el correo de confirmación muestren EXACTAMENTE el mismo
    // segundo. Sin esto, con milisegundos >= 500 MySQL redondea hacia
    // arriba y `Intl.DateTimeFormat` (que trunca) devuelve un segundo
    // distinto — la validación del ticket (comparación hora exacta)
    // fallaba con COMPRA_NO_ENCONTRADA aunque los datos fueran correctos.
    const ahora = new Date();
    ahora.setMilliseconds(0);
    const [resultado] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['TEMP', ahora, concepto, cantidad, ivaPorcentaje, total, email, ahora, ahora]
    );

    const numeroCompra = generarNumeroCompra(resultado.insertId);
    await pool.query('UPDATE ordenes_compra SET numero_compra = ? WHERE id = ?', [numeroCompra, resultado.insertId]);

    const fechaFormateada = formatearFechaHoraMexico(ahora, configGlobal.zona_horaria);

    // Correo de confirmación al cliente, con el diseño de "ticket" y el
    // enlace de acceso al portal — "fire-and-forget": si falla, la orden
    // ya se guardó correctamente de todas formas.
    const urlPortalOrden = detectarUrlPortal(req);
    const marcaTenant = marcaDelTenant(req);
    const marcaLogoUrl = req.tenant && req.tenant.marcaLogoUrl;
    enviarCorreoOrdenCompra({
      numeroCompra,
      fechaFormateada,
      concepto,
      cantidad,
      ivaPorcentaje,
      total,
      email,
      urlPortal: urlPortalOrden,
      // El logo de la MARCA del tenant (si lo definió en control, ver el
      // segmento "marca") tiene prioridad sobre el logo global del panel;
      // si no hay ninguno, logoTicketHtml genera un logo de texto con la
      // marca. La ruta guardada en control es relativa
      // ("/api/marca-logo/<slug>"), así que aquí se convierte a absoluta
      // con la URL detectada de la petición, para que el correo la pueda
      // mostrar.
      logoUrl: marcaLogoUrl ? `${urlPortalOrden}${marcaLoGoUrl}` : configGlobal.logo_url,
      marca: marcaTenant,
    }).catch((err) => {
      console.error('No se pudo enviar el correo de confirmación de la orden de compra:', err.message);
    });

    res.status(201).json({
      ok: true,
      id: resultado.insertId,
      numero_compra: numeroCompra,
      fecha_compra: fechaFormateada,
      concepto,
      cantidad,
      iva_porcentaje: ivaPorcentaje,
      total,
      email,
      mensaje: 'Orden de compra registrada correctamente.',
    });
  })
);

// Lista las órdenes de compra activas. La fecha se muestra siempre con la
// zona horaria ACTUALMENTE configurada (no la que estaba vigente cuando
// se creó cada orden) — la hora exacta en UTC nunca cambia en la base de
// datos, solo cambia con qué zona horaria se le da formato al mostrarla.
app.get(
  '/api/admin/ordenes-compra',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const [ordenes] = await pool.query(
      `SELECT o.id, o.numero_compra, o.fecha_compra, o.concepto, o.cantidad, o.iva_porcentaje, o.total, o.email, o.creado_en,
        EXISTS(
          SELECT 1 FROM tickets t
          WHERE t.orden_compra_id = o.id AND t.estatus = 'listo' AND t.eliminado_en IS NULL
        ) AS facturado
       FROM ordenes_compra o
       WHERE o.eliminado_en IS NULL
       ORDER BY o.creado_en DESC`
    );

    const configGlobal = await getConfiguracionGlobal();
    const ordenesFormateadas = ordenes.map((orden) => ({
      ...orden,
      facturado: Boolean(orden.facturado),
      fecha_compra_formateada: formatearFechaHoraMexico(
        new Date(`${orden.fecha_compra.replace(' ', 'T')}Z`),
        configGlobal.zona_horaria
      ),
    }));

    res.json({ total: ordenesFormateadas.length, ordenes: ordenesFormateadas });
  })
);

// Reenvía el correo de confirmación (el "ticket") de una orden de compra
// ya registrada, al mismo correo asociado. A diferencia del envío
// original (fire-and-forget al crear la orden, ver POST
// /api/admin/ordenes-compra), aquí SÍ se espera el resultado y se
// reporta de vuelta al admin — reenviar el correo es la razón de ser de
// esta acción, así que un fallo silencioso no tendría sentido aquí.
app.post(
  '/api/admin/ordenes-compra/:id/reenviar-correo',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM ordenes_compra WHERE id = ? AND eliminado_en IS NULL', [id]);
    const orden = filas[0];
    if (!orden) {
      return res.status(404).json({ error: 'Orden de compra no encontrada.' });
    }

    const configGlobal = await getConfiguracionGlobal();
    const fechaFormateada = formatearFechaHoraMexico(
      new Date(`${String(orden.fecha_compra).replace(' ', 'T')}Z`),
      configGlobal.zona_horaria
    );

    try {
      const marcaTenantReenvio = marcaDelTenant(req);
      const marcaLogoUrlReenvio = req.tenant && req.tenant.marcaLogoUrl;
      const urlPortalReenvio = detectarUrlPortal(req);
      await enviarCorreoOrdenCompra({
        numeroCompra: orden.numero_compra,
        fechaFormateada,
        concepto: orden.concepto,
        cantidad: Number(orden.cantidad),
        ivaPorcentaje: Number(orden.iva_porcentaje),
        total: Number(orden.total),
        email: orden.email,
        urlPortal: urlPortalReenvio,
        logoUrl: marcaLogoUrlReenvio ? `${urlPortalReenvio}${marcaLoGoUrlReenvio}` : configGlobal.logo_url,
        marca: marcaTenantReenvio,
      });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo reenviar el correo: ${err.message}` });
    }

    res.json({ ok: true, mensaje: `Correo reenviado a ${orden.email}.` });
  })
);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// El esquema de la base de datos se garantiza (crea tablas si no existen,
// espera a que MySQL este listo) ANTES de aceptar trafico, para no atender
// peticiones contra tablas que todavia no existen.
// Corre la limpieza de tickets Y de órdenes de compra vencidos (borrado
// automático según la MISMA retención configurada por el administrador).
// No hace nada si no hay una retención configurada. Antes de borrar
// nada, ejecutarLimpiezaConReporte() ya generó y (si hay correo
// configurado) envió un reporte combinado con todo lo que está a punto
// de eliminarse — ver utils/ticketsCleanup.js. Los errores se registran
// pero nunca tumban el proceso — es una tarea de mantenimiento, no
// crítica para servir tráfico.
async function ejecutarLimpiezaAutomatica() {
  try {
    const { eliminadosTickets, eliminadosOrdenes, retencionActiva, reporteId, correoEnviado, errorCorreo } =
      await ejecutarLimpiezaConReporte();
    if (retencionActiva && (eliminadosTickets > 0 || eliminadosOrdenes > 0)) {
      console.log(
        `Limpieza automática: ${eliminadosTickets} ticket(s) y ${eliminadosOrdenes} orden(es) de compra vencidos eliminados.` +
          (reporteId ? ` Reporte #${reporteId} generado${correoEnviado ? ' y enviado por correo' : ''}.` : '')
      );
      if (errorCorreo) {
        console.error(`El reporte #${reporteId} se generó, pero no se pudo enviar por correo:`, errorCorreo);
      }
    }
  } catch (err) {
    console.error('Error en la limpieza automática (tickets y órdenes de compra):', err);
  }
}

async function iniciar() {
  await ensureSchema();
  await storage.asegurarBucket();
  await asegurarTablaAuditoria();

  const server = app.listen(PORT, () => {
    console.log(`Backend escuchando en el puerto ${PORT}`);
    console.log(`Tamano maximo de archivo: ${MAX_FILE_SIZE_MB} MB`);
  });

  // La limpieza automática (que puede incluir GENERAR Y ENVIAR un correo
  // con el reporte, ver ejecutarLimpiezaConReporte) se dispara DESPUÉS de
  // que el servidor ya está escuchando, no antes — a propósito. Antes
  // corría entre ensureSchema() y app.listen(), lo que significaba que
  // CADA arranque o reinicio del backend (no solo el primero: cualquier
  // reinicio por un despliegue, o porque el límite de memoria del
  // contenedor lo tumbó) se quedaba sin aceptar tráfico durante todo ese
  // tiempo — y un correo SMTP lento o que no responde puede tardar
  // minutos en agotar su propio tiempo de espera (ver el ajuste de
  // timeouts explícitos en utils/email.js), alargando esa ventana de
  // "servicio no disponible" mucho más de lo necesario. Con esto en
  // segundo plano, el servidor ya está aceptando conexiones normales
  // mientras la limpieza corre — y si de verdad falla o se cuelga, ya no
  // se lleva de encuentro el arranque completo del backend.
  ejecutarLimpiezaAutomatica();
  // Se repite cada hora; con la retención medida en días, no hace falta
  // una frecuencia mayor, y así se evita sobrecargar la base de datos.
  const intervaloLimpieza = setInterval(ejecutarLimpiezaAutomatica, 60 * 60 * 1000);

  // ---------- Apagado ordenado (graceful shutdown) ----------
  // Sin esto, cuando Docker manda SIGTERM para detener o reiniciar el
  // contenedor (un despliegue, `docker-compose restart`, un límite de
  // memoria que lo tumba, etc.), Node no deja de aceptar conexiones ni
  // espera a que terminen las peticiones en curso — las corta de golpe.
  // Eso es exactamente el tipo de cosa que se percibe como
  // "intermitencia": alguien subiendo un archivo justo en ese momento
  // recibe un error random, sin relación aparente con nada que hizo mal.
  // Con esto: se deja de aceptar peticiones NUEVAS de inmediato, se
  // espera (con un límite de tiempo) a que las que ya estaban en curso
  // terminen normalmente, se cierra el pool de MySQL de forma limpia, y
  // solo entonces termina el proceso.
  let cerrando = false;
  async function apagarOrdenadamente(señal) {
    if (cerrando) return; // evita procesar la señal dos veces si llega repetida
    cerrando = true;
    console.log(`\nSeñal ${señal} recibida — cerrando ordenadamente...`);

    clearInterval(intervaloLimpieza);

    const cierreForzado = setTimeout(() => {
      console.error('El cierre ordenado tardó demasiado — forzando salida.');
      process.exit(1);
    }, 10000);
    cierreForzado.unref(); // no debe ser lo único que mantenga vivo el proceso

    server.close(async (err) => {
      if (err) {
        console.error('Error al cerrar el servidor HTTP:', err);
      } else {
        console.log('Servidor HTTP cerrado — ya no acepta peticiones nuevas.');
      }
      try {
        await pool.end();
        console.log('Conexiones a MySQL cerradas correctamente.');
      } catch (errPool) {
        console.error('Error al cerrar el pool de MySQL:', errPool);
      }
      try {
        await cerrarTodosLosPoolsTenant();
        console.log('Pools de tenant (si había alguno activo) cerrados correctamente.');
      } catch (errPoolsTenant) {
        console.error('Error al cerrar los pools de tenant:', errPoolsTenant);
      }
      clearTimeout(cierreForzado);
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => apagarOrdenadamente('SIGTERM'));
  process.on('SIGINT', () => apagarOrdenadamente('SIGINT'));
}

// Todo lo que sigue (conectar a MySQL real, escuchar en el puerto,
// registrar handlers de proceso que terminan el proceso) solo debe correr
// cuando este archivo se ejecuta directamente (`node server.js`, tal como
// hace el Dockerfile) — NO cuando otro módulo hace `require('./server')`
// para tomar `app` (ver module.exports al final), como hacen las pruebas
// de integración (ver backend/test/integration/) con Supertest: ahí no hay
// MySQL real disponible, no debe abrirse un puerto real, y un error dentro
// de un test nunca debe terminar el proceso de Jest.
if (require.main === module) {
  // ---------- Red de seguridad global ----------
  // Ningún error debería llegar hasta aquí (las rutas usan asyncHandler, y
  // los envíos "fire-and-forget" ya tienen su propio .catch()) — esto es
  // una red de seguridad para lo verdaderamente inesperado, no la primera
  // línea de manejo de errores. Sin estos manejadores, un error de este
  // tipo tumba el proceso de golpe con un mensaje ambiguo en la consola
  // (o, para una promesa rechazada sin atrapar, Node.js 15+ lo hace
  // crashear por default) — con esto, al menos queda un log claro de qué
  // pasó antes de cerrar. Se opta por cerrar (no seguir corriendo con un
  // estado posiblemente corrupto) y dejar que la política de reinicio de
  // Docker (`restart: unless-stopped`) levante una instancia nueva y
  // limpia — más seguro que intentar seguir sirviendo tráfico después de
  // un error de este tipo.
  process.on('uncaughtException', (err) => {
    console.error('Excepción no controlada — cerrando el proceso:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (razon) => {
    console.error('Promesa rechazada sin atrapar — cerrando el proceso:', razon);
    process.exit(1);
  });

  iniciar().catch((err) => {
    console.error('No se pudo iniciar el servidor:', err);
    process.exit(1);
  });
}

module.exports = app;
