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

const { swaggerSpec } = require('./utils/swagger');
const swaggerUi = require('swagger-ui-express');
const { pool, ensureSchema, cerrarTodosLosPoolsTenant, ejecutarComoTenant, obtenerPoolControl } = require('./db');
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
  ALLOWED_COMPROBANTE_MIME_TYPES,
  ALLOWED_COMPROBANTE_EXTENSIONS,
  ALLOWED_IMPORTACION_MIME_TYPES,
  ALLOWED_IMPORTACION_EXTENSIONS,
  esCSVValido,
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
  ordenAItemReporte,
  CLAVE_ULTIMA_LIMPIEZA_TICKETS,
  CLAVE_ULTIMA_LIMPIEZA_ORDENES,
} = require('./utils/ticketsCleanup');
const { generarYEnviarReporte, generarCSV, generarExcelBuffer } = require('./utils/reportes');
const {
  categoriaGastoExiste,
  listarCategoriasGastos,
  crearCategoriaGasto,
  renombrarCategoriaGasto,
  eliminarCategoriaGasto,
  reactivarCategoriaGasto,
} = require('./utils/gastos');
const {
  TIPOS_ENTRADA,
  TIPOS_SALIDA,
  registrarMovimiento,
  conciliarInventario,
  listarCategoriasInventario,
  crearCategoriaInventario,
  renombrarCategoriaInventario,
  eliminarCategoriaInventario,
  reactivarCategoriaInventario,
  obtenerProductoPorId,
  skuEnUso,
  codigoBarrasEnUso,
  unidadExisteId,
  productoTieneMovimientos,
  ALMACEN_DEFECTO_CODIGO,
} = require('./utils/inventario');
const { obtenerTipoCambioUSD } = require('./utils/tipoCambio');
const {
  obtenerConfigInventario,
  obtenerValorConfig,
  inventarioActivo,
  setValorConfig,
  CLAVES: CLAVES_CONFIG_INVENTARIO,
} = require('./utils/inventarioConfig');
const {
  sugerirMapeoCompleto,
  firmaCabeceras,
  parsearArchivoCSV,
  listarHojasXLSX,
  parsearArchivoXLSX,
  validarFilasImportacion,
  ejecutarFilasImportacion,
  listarPerfilesMapeo,
  crearPerfilMapeo,
  eliminarPerfilMapeo,
  buscarPerfilParaCabeceras,
  marcarPerfilUsado,
  generarPlantillaCSV,
  generarPlantillaXLSX,
  generarCSVErrores,
  TAMANO_CHUNK,
} = require('./utils/inventarioImportacion');
const { obtenerDiccionarioInventario } = require('./utils/inventarioCampos');

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
// cualquiera de los otros ~56 endpoints de /api/admin/*, que solo tienen
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

// Uploader del comprobante de un gasto (módulo "Gastos"): acepta PDF (la
// factura sola) o ZIP (el par PDF + XML de un CFDI, mismo criterio que el
// comprobante de tickets). El filtro aquí es de extensión/MIME declarados
// (rápido, buena UX); la verificación real de contenido (firma binaria)
// pasa después, dentro del handler — ver POST
// /api/admin/gastos/:id/comprobante.
const uploadComprobante = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_COMPROBANTE_MIME_TYPES.has(file.mimetype) || !ALLOWED_COMPROBANTE_EXTENSIONS.has(ext)) {
      cb(new Error('TIPO_NO_PERMITIDO'));
      return;
    }
    cb(null, true);
  },
});

// Uploader del archivo de importación masiva de Inventarios (§34): CSV o
// XLSX. El límite de tamaño real es inv_import_max_mb (configurable por
// tenant, default 5) — se valida DENTRO del handler porque multer necesita
// un límite fijo en bytes antes de conocer la config del tenant; aquí se
// usa el máximo global del backend como techo duro, y el límite real más
// chico se aplica después de leer el archivo completo.
const uploadImportacion = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_IMPORTACION_MIME_TYPES.has(file.mimetype) || !ALLOWED_IMPORTACION_EXTENSIONS.has(ext)) {
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
// Swagger — UI y JSON (punto 137). No requiere auth para listar, probar sí pide credenciales según ruta.
// CSP para Swagger UI: sus <script> son src= externos servidos por el
// mismo origen (swagger-ui-bundle.js/standalone-preset.js/init.js), así
// que script-src 'self' ya los permite sin 'unsafe-inline'. El único
// new Function() del bundle es un fallback de globalThis para navegadores
// viejos (inalcanzable en la práctica) — no hace falta 'unsafe-eval'.
// style-src SÍ necesita 'unsafe-inline': el HTML de swagger-ui-express trae
// bloques <style> literales.
app.use('/api/docs', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob:; script-src 'self' https:; style-src 'self' https: 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https: data:");
  next();
});
app.use('/api/swagger', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob:; script-src 'self' https:; style-src 'self' https: 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https: data:");
  next();
});
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
// Alias legacy /api/swagger → /api/docs
app.use('/api/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

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

// Compara el secreto interno (X-Internal-Secret) mandado por el
// contenedor "control" contra INTERNAL_CACHE_SECRET en tiempo constante.
// Sin esto, `!==` sobre strings compara caracter a caracter y termina en
// cuanto encuentra la primera diferencia — una diferencia de tiempo
// medible en teoría (más pronunciada mientras más largo el secreto
// correcto) que un atacante en la misma red podría explotar para
// adivinar el secreto byte a byte, igual que ya se evita en
// requireAdminAuth (ver utils/auth.js:timingSafeEqualStrings). Nunca
// deja pasar si el secreto no está configurado o si las longitudes no
// coinciden (crypto.timingSafeEqual exige buffers del mismo tamaño).
function secretoInternoValido(req) {
  const secretoEsperado = process.env.INTERNAL_CACHE_SECRET;
  const recibido = req.get('X-Internal-Secret') || '';
  if (!secretoEsperado) return false;
  const bufEsperado = Buffer.from(secretoEsperado);
  const bufRecibido = Buffer.from(recibido);
  if (bufEsperado.length !== bufRecibido.length) {
    // Compara igual contra si mismo para mantener un tiempo constante,
    // evitando filtrar la longitud esperada mediante temporizacion.
    crypto.timingSafeEqual(bufEsperado, bufEsperado);
    return false;
  }
  return crypto.timingSafeEqual(bufEsperado, bufRecibido);
}

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
  if (!secretoInternoValido(req)) {
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
  if (!secretoInternoValido(req)) {
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
  if (!secretoInternoValido(req)) {
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
  if (!secretoInternoValido(req)) {
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
  if (!secretoInternoValido(req)) {
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
  if (!secretoInternoValido(req)) {
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

// Hash de relleno para cuando el RFC no existe (Seguridad, ver auditoría
// OWASP): sin esto, `!usuario || !verifyPassword(...)` hace corto-circuito
// y NUNCA llama a verifyPassword (que corre scrypt, el paso costoso) si el
// RFC no existe — una diferencia de tiempo medible entre "RFC no
// registrado" y "RFC registrado, contraseña incorrecta" que permitiría
// enumerar RFCs válidos sin usar el mensaje de error (que ya es genérico
// a propósito) para nada. Mismo principio que ya aplica
// costoArtificialComparable() en utils/tenantContext.js para slugs de
// tenant inexistentes. Se genera una sola vez al arrancar (no en cada
// intento fallido) porque el valor nunca necesita cambiar — solo sirve de
// "algo con pinta de hash real" contra lo que comparar.
const HASH_RELLENO_LOGIN = hashPassword(crypto.randomBytes(32).toString('hex'));

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
    // enumeracion de cuentas registradas. verifyPassword() SIEMPRE se
    // llama (con el hash real o con el de relleno) para que el tiempo de
    // respuesta no delate por sí solo si el RFC existe — ver
    // HASH_RELLENO_LOGIN arriba.
    const passwordValida = verifyPassword(password, usuario ? usuario.password_hash : HASH_RELLENO_LOGIN);
    if (!usuario || !passwordValida) {
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

// Límites del mes actual y del mes anterior en la zona horaria
// configurada, expresados como Date en UTC — usados por el resumen de
// KPIs del módulo "Gastos" ("¿cuánto gasté este mes?", "con/sin factura",
// "vs mes anterior"). Los gastos se guardan con su fecha de calendario
// (columna DATE), así que "este mes" se calcula con el año/mes vigente en
// la zona horaria de México (la configurada por el administrador), no con
// la del servidor MySQL.
function limitesMes(zonaHoraria) {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
  }).format(ahora);
  const [anio, mes] = partes.split('-').map(Number);
  return {
    inicio: new Date(Date.UTC(anio, mes - 1, 1)),
    fin: new Date(Date.UTC(anio, mes, 1)), // exclusivo (primer día del mes siguiente)
    inicioAnterior: new Date(Date.UTC(anio, mes - 2, 1)),
    finAnterior: new Date(Date.UTC(anio, mes - 1, 1)), // exclusivo
  };
}

// Etiqueta corta en español ("Ene", "Feb", …) para una llave "YYYY-MM" —
// usada por el resumen financiero para la serie mensual de la gráfica.
function etiquetaMes(llave) {
  const [anio, mes] = llave.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, 1));
  const corta = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(fecha).replace('.', '');
  return corta.charAt(0).toUpperCase() + corta.slice(1);
}

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
          return res.status(400).json({ error: 'El número de venta es obligatorio.' });
        }

        const matchFecha = fechaCompraCruda.match(/\d{2}\/[a-záéíóúñ]{3}\/\d{4}/i);
        if (!matchFecha) {
          return res.status(400).json({ error: 'La fecha de venta debe tener el formato dd/mmm/aaaa (ej. 24/jul/2026).' });
        }
        const fechaCompraTexto = matchFecha[0];

        const matchHora = horaCompraCruda.match(/([01]\d|2[0-3]):[0-5]\d:[0-5]\d/);
        if (!matchHora) {
          return res.status(400).json({ error: 'La hora de venta debe tener el formato HH:mm:ss (ej. 09:30:45).' });
        }
        const horaCompraTexto = matchHora[0];

        if (!Number.isFinite(totalCompra) || totalCompra <= 0) {
          return res.status(400).json({ error: 'El total de la venta debe ser un número mayor a cero.' });
        }

        // Un solo mensaje genérico para cualquier discrepancia (no se
        // encontró el número de compra, o sí se encontró pero la fecha/
        // hora/total no coinciden) — a propósito, para no revelar cuál
        // dato en particular está mal y facilitar que alguien adivine una
        // combinación válida por partes.
        const MENSAJE_COMPRA_NO_ENCONTRADA = 'No se encuentra registrada la venta para facturar.';

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
            error: 'Esa venta ya fue facturada.',
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

// Logo real de CLARVO para el correo, INCRUSTADO como adjunto CID en vez
// de una <img src="URL">: una URL absoluta depende de que el servidor sea
// alcanzable públicamente desde donde esté el cliente de correo — en
// desarrollo (localhost) o detrás de un proxy no expuesto, la imagen sale
// rota. Incrustado como CID viaja DENTRO del correo, funciona siempre
// (confirmado: se probó primero con URL absoluta y llegó rota en un
// correo real, ver PROJECT_STATE.md punto 133). Copia propia del archivo
// en backend/assets/ (mismo PNG que ya sirve el frontend en
// /assets/branding.png) — el backend no tiene acceso al filesystem del
// contenedor frontend, así que se duplica a propósito, mismo criterio ya
// usado para otro código pequeño compartido entre ambos.
const LOGO_CLARVO_CID = 'logo-clarvo-addv';
let logoClarvoBufferCache = null;
function obtenerLogoClarvoBuffer() {
  if (logoClarvoBufferCache === null) {
    try {
      logoClarvoBufferCache = fs.readFileSync(path.join(__dirname, 'assets', 'branding.png'));
    } catch (err) {
      logoClarvoBufferCache = undefined; // no se pudo leer: se cae al texto de respaldo, nunca truena el correo
    }
  }
  return logoClarvoBufferCache || null;
}

// Sin logo de tenant configurado: si la marca es la de por defecto
// (ningún tenant la sobreescribió), se usa el logo REAL de CLARVO en vez
// de una caja de texto genérica. Un tenant con su propio nombre de marca
// (pero sin logo todavía) sigue viendo su propio texto — nunca el logo de
// CLARVO, que no le pertenece. Devuelve también el adjunto CID que hay
// que mandar junto con el correo (null si no aplica).
function logoTicketHtml(logoUrl, marca) {
  if (logoUrl) {
    return {
      html: `<img src="${logoUrl}" alt="Portal de Facturación ${escapeHtmlCorreo(marca)}" style="max-width:180px; max-height:60px; display:block; margin:0 auto;" />`,
      adjunto: null,
    };
  }
  const bufferLogo = marca === MARCA_DEFECTO ? obtenerLogoClarvoBuffer() : null;
  if (bufferLogo) {
    return {
      html: `<img src="cid:${LOGO_CLARVO_CID}" alt="CLARVO — Portal de Facturación by ADDV" style="max-width:170px; height:auto; display:block; margin:0 auto;" />`,
      adjunto: { filename: 'clarvo-logo.png', content: bufferLogo, cid: LOGO_CLARVO_CID },
    };
  }
  return {
    html: `
    <div style="display:inline-block; background:#03285B; color:#ffffff; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-weight:bold; font-size:20px; letter-spacing:0.06em; padding:10px 18px; border-radius:6px;">
      ${escapeHtmlCorreo(marca)}
    </div>`,
    adjunto: null,
  };
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
  // Sin marca de tenant (caso de hoy — todavía no hay ningún tenant real
  // dado de alta), el pie de página usa el nombre completo de la marca en
  // vez del "ADDV" corto de MARCA_DEFECTO — mismo texto que ya se usa en
  // el atributo alt del logo en el resto del sitio. Un tenant con su
  // propia marca sigue viendo su propio nombre tal cual.
  const marcaMostrada = marca === MARCA_DEFECTO ? 'CLARVO by ADDV' : marca;
  const logo = logoTicketHtml(logoUrl, marca);

  const filaTicket = (etiqueta, valor, destacado) => `
    <tr>
      <td style="padding:${destacado ? '9px 10px' : '6px 0'}; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; color:${destacado ? '#03285B' : '#5B6472'}; ${destacado ? 'font-weight:bold; background:#E7ECF3; border-radius:8px 0 0 8px;' : ''}">${etiqueta}</td>
      <td style="padding:${destacado ? '9px 10px' : '6px 0'}; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:${destacado ? '15px' : '13px'}; color:${destacado ? '#03285B' : '#0B1320'}; text-align:right; ${destacado ? 'font-weight:bold; background:#E7ECF3; border-radius:0 8px 8px 0;' : ''}">${valor}</td>
    </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:24px 12px; background:#F4F6FA; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto;">
    <tr>
      <td style="text-align:center; padding-bottom:18px;">
        ${logo.html}
      </td>
    </tr>
    <tr>
      <td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px dashed #C7CDD9; border-radius:12px; box-shadow:0 2px 14px rgba(11,19,32,0.10);">
          <tr>
            <td style="height:4px; line-height:4px; font-size:0; background:#03285B; background:linear-gradient(90deg,#03285B 0%,#2F6FED 55%,#05DBF2 100%); border-radius:11px 11px 0 0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 28px 6px; text-align:center;">
              <p style="margin:0; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#5B6472;">Venta</p>
              <p style="margin:6px 0 0; font-size:22px; font-weight:bold; color:#0B1320; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtmlCorreo(numeroCompra)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px 0;">
              <div style="border-top:1px dashed #DCE2EC;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${filaTicket('Fecha', escapeHtmlCorreo(fechaFormateada.fecha))}
                ${filaTicket('Hora', escapeHtmlCorreo(fechaFormateada.hora))}
                ${filaTicket('Concepto', escapeHtmlCorreo(concepto))}
                ${filaTicket('Cantidad', `$${cantidad.toFixed(2)} MXN`)}
                ${filaTicket(`IVA (${ivaPorcentaje}%)`, `$${(total - cantidad).toFixed(2)} MXN`)}
              </table>
              <div style="border-top:1px dashed #DCE2EC; margin:10px 0;"></div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${filaTicket('TOTAL A FACTURAR', `$${total.toFixed(2)} MXN`, true)}
              </table>
              <div style="border-top:1px dashed #DCE2EC; margin:10px 0;"></div>
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
        <p style="margin:0 0 14px; font-size:14.5px; line-height:1.55; color:#2A3342;">¡Hola! Te confirmamos que registramos tu venta <strong>${escapeHtmlCorreo(numeroCompra)}</strong>. Con estos datos ya puedes solicitar tu factura desde el portal.</p>
        <p style="margin:0 0 14px; font-size:14.5px; line-height:1.55; color:#2A3342;"><strong>Guarda este correo</strong> — tómale una foto o captura de pantalla — porque, al solicitar tu factura en el portal, te pediremos que captures el <strong>No. Venta, Fecha, Hora y Total exactamente como aparecen arriba</strong> (cada uno en su propio campo), además de la imagen de tu ticket de venta.</p>
        ${enlaceLogin ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto;">
          <tr>
            <td style="border-radius:8px; background:#03285B;">
              <a href="${enlaceLogin}" style="display:inline-block; padding:12px 28px; font-size:14.5px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px;">Iniciar sesión y solicitar mi factura</a>
            </td>
          </tr>
        </table>` : ''}
        <p style="margin:18px 0 0; font-size:12.5px; line-height:1.5; color:#8A93A3; text-align:center;">Si no esperabas este correo, contacta a tu administrador. Portal de Facturación ${escapeHtmlCorreo(marcaMostrada)}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const texto =
    `VENTA — ${numeroCompra}\n\n` +
    `Fecha: ${fechaFormateada.fecha}\n` +
    `Hora: ${fechaFormateada.hora}\n` +
    `Concepto: ${concepto}\n` +
    `Cantidad: $${cantidad.toFixed(2)} MXN\n` +
    `IVA (${ivaPorcentaje}%): $${(total - cantidad).toFixed(2)} MXN\n` +
    `TOTAL A FACTURAR: $${total.toFixed(2)} MXN\n` +
    `Correo: ${email}\n\n` +
    `¡Hola! Te confirmamos que registramos tu venta ${numeroCompra}. Con estos datos ya puedes solicitar tu factura desde el portal.\n\n` +
    `Guarda este correo — tómale una foto o captura de pantalla — porque, además de estos datos, al solicitar tu factura en el portal también te pediremos la imagen de tu ticket de venta.\n\n` +
    (enlaceLogin ? `Inicia sesión aquí para solicitar tu factura: ${enlaceLogin}\n\n` : '') +
    `Si no esperabas este correo, contacta a tu administrador.`;

  return { html, texto, adjuntos: logo.adjunto ? [logo.adjunto] : [] };
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
  const { html, texto, adjuntos } = construirCorreoOrdenCompra(datos);
  await enviarCorreo({
    destinatario: datos.email,
    asunto: `Confirmación de venta — ${datos.numeroCompra}`,
    cuerpo: texto,
    html,
    adjuntos,
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
      `Se subió un nuevo ticket de venta para facturar.\n\n` +
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
// submitLimiter (Seguridad, ver auditoría OWASP): esta ruta es pública y
// devuelve datos completos del registro (nombre/razón social, RFC,
// indicaciones) para cualquier correo o RFC que se le mande, sin
// autenticación — necesario para que el formulario público detecte "ya
// existe una constancia con estos datos" antes de reemplazarla. Sin un
// límite de tasa, esto permitía enumerar en masa qué RFC/nombre
// corresponde a qué correo (o viceversa) con peticiones ilimitadas. El
// límite no cambia el comportamiento para el uso legítimo (una consulta
// puntual antes de subir un archivo), solo frena el raspado masivo.
app.get(
  '/api/registro/buscar',
  submitLimiter,
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
// submitLimiter (Seguridad, ver auditoría OWASP): mismo motivo que en
// GET /api/registro/buscar — es pública y devuelve datos completos del
// registro, así que sin límite de tasa permite enumeración masiva por
// correo.
app.get(
  '/api/registro/:email',
  submitLimiter,
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

// §58: sucursales asociadas al tenant actual (mismo grupo de sucursales,
// ver backend/utils/auth.js) — alimenta el switcher del sidebar en
// admin.js. Cualquier perfil autenticado puede verlo (no solo
// administrador): un usuario de sucursal compartida puede tener perfil
// "fiscal". Sin tenant resuelto o sin grupo, responde lista vacía sin
// tocar la BD de control.
app.get(
  '/api/admin/sucursales-hermanas',
  adminApiLimiter,
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    if (!req.tenant || !req.tenant.grupoSucursalId) {
      return res.json({ sucursales: [] });
    }
    const poolControl = obtenerPoolControl();
    const [filas] = await poolControl.query(
      `SELECT slug, nombre_empresa FROM tenants
        WHERE grupo_sucursal_id = ? AND estado = 'activo'
        ORDER BY nombre_empresa ASC`,
      [req.tenant.grupoSucursalId]
    );
    res.json({
      sucursales: filas.map((f) => ({
        slug: f.slug,
        nombre_empresa: f.nombre_empresa,
        actual: f.slug === req.tenant.slug,
      })),
    });
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
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a habilitar o deshabilitar Ventas.' });
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

// Quién generó el reporte (idea C de auditoría) — no hay una columna
// "generado_por" en `reportes` (no existía ese requisito cuando se
// diseñó la tabla), así que se infiere cruzando con `admin_auditoria`
// (control_tenants, segmento 7): el actor cuya mutación (POST
// /reportes/enviar o DELETE /ordenes-compra/:id) ocurrió más cerca en
// el tiempo de `fecha_generacion`, dentro de una ventana de 5 segundos
// (el reporte se guarda inmediatamente después de esa mutación, nunca
// con más retraso que eso). Un reporte "automático" (retención, cron
// sin sesión de ningún admin) nunca tiene actor por definición — ni
// siquiera se intenta el cruce. Mejor esfuerzo: si no hay match (ej.
// instalación previa al segmento 7, sin auditoría todavía), responde
// null sin bloquear ni inventar nada.
app.get(
  '/api/admin/reportes/:id/generado-por',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [filas] = await pool.query('SELECT tipo, fecha_generacion FROM reportes WHERE id = ?', [id]);
    if (filas.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado.' });
    }
    if (filas[0].tipo === 'automatico') {
      return res.json({ actor: null, motivo: 'automatico' });
    }

    const tenantSlug = req.tenant ? req.tenant.slug : null;
    const poolControl = obtenerPoolControl();
    const fechaGeneracion = filas[0].fecha_generacion;
    const [coincidencias] = await poolControl.query(
      `SELECT actor, perfil, ocurrido_en
         FROM admin_auditoria
        WHERE resultado_estatus < 400
          AND ${tenantSlug ? 'tenant_slug = ?' : 'tenant_slug IS NULL'}
          AND (
            (metodo = 'POST' AND ruta = '/api/admin/reportes/enviar')
            OR (metodo = 'DELETE' AND ruta LIKE '/api/admin/ordenes-compra/%')
          )
          AND ocurrido_en BETWEEN DATE_SUB(?, INTERVAL 5 SECOND) AND DATE_ADD(?, INTERVAL 5 SECOND)
        ORDER BY ABS(TIMESTAMPDIFF(SECOND, ocurrido_en, ?)) ASC
        LIMIT 1`,
      tenantSlug
        ? [tenantSlug, fechaGeneracion, fechaGeneracion, fechaGeneracion]
        : [fechaGeneracion, fechaGeneracion, fechaGeneracion]
    );

    if (coincidencias.length === 0) {
      return res.json({ actor: null, motivo: 'sin_coincidencia' });
    }
    res.json({ actor: coincidencias[0].actor, perfil: coincidencias[0].perfil, motivo: 'coincidencia' });
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
    const { tipo_registro: tipoRegistro, estatus, rfc, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, accion } = req.query;
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
    // "accion" separa los registros que de verdad se eliminaron
    // (retención automática o "Eliminar" venta) de los que solo son una
    // fotografía informativa de algo que sigue activo — usado para las
    // 2 tablas separadas ("Movimientos"/"Eliminados") de "Lectura de
    // reportes", y para que cada una exporte solo lo suyo.
    if (accion === 'eliminado') {
      sql += " AND accion = 'eliminado'";
    } else if (accion === 'activo') {
      sql += ' AND accion IS NULL';
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
    const { tipo_registro: tipoRegistro, estatus, rfc, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, accion } = req.query;
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
    // Mismo criterio que GET .../items — exporta solo "Eliminados" o solo
    // "Movimientos" según qué tabla haya disparado la exportación.
    if (accion === 'eliminado') {
      sql += " AND accion = 'eliminado'";
    } else if (accion === 'activo') {
      sql += ' AND accion IS NULL';
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

// KPIs de auditoría para la vista "Lectura de reportes": totales
// históricos de registros eliminados vs. solo capturados como fotografía
// activa, y una serie mensual de eliminados (últimos 6 meses CON
// actividad, mismo criterio de "no inventar meses vacíos" que
// resumen-financiero) — para la tarjeta de tendencia. Cruza TODOS los
// reportes, no uno seleccionado, a propósito: es la vista panorámica de
// auditoría, independiente de cuál reporte se esté leyendo en ese momento.
app.get(
  '/api/admin/reportes/estadisticas',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const [[totales]] = await pool.query(
      `SELECT
         SUM(CASE WHEN accion = 'eliminado' THEN 1 ELSE 0 END) AS total_eliminados,
         SUM(CASE WHEN accion IS NULL THEN 1 ELSE 0 END) AS total_activos
       FROM reporte_items`
    );
    const [filasSerie] = await pool.query(
      `SELECT DATE_FORMAT(creado_en, '%Y-%m') AS mes, COUNT(*) AS total
         FROM reporte_items
        WHERE accion = 'eliminado' AND creado_en >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(creado_en, '%Y-%m')
        ORDER BY mes ASC`
    );

    res.json({
      total_eliminados: Number(totales.total_eliminados) || 0,
      total_activos: Number(totales.total_activos) || 0,
      eliminados_por_mes: filasSerie.map((f) => ({ mes: etiquetaMes(f.mes), total: Number(f.total) })),
    });
  })
);

// Arma el WHERE compartido por el ledger cruzado de eliminados
// (GET /reportes/eliminados y su exportación) — mismos filtros que ya
// soporta GET /reportes/:id/items, sin el reporte_id (cruza TODOS).
function filtrosLedgerEliminados(req) {
  const { tipo_registro: tipoRegistro, estatus, rfc, fecha_desde: fechaDesde, fecha_hasta: fechaHasta } = req.query;
  const estatusValidos = ['pendiente', 'en_curso', 'cancelado', 'listo'];
  let sql = "WHERE ri.accion = 'eliminado'";
  const params = [];
  if (tipoRegistro && ['ticket', 'orden_compra'].includes(tipoRegistro)) {
    sql += ' AND ri.tipo_registro = ?';
    params.push(tipoRegistro);
  }
  if (estatus && estatusValidos.includes(estatus)) {
    sql += ' AND ri.estatus_o_concepto = ?';
    params.push(estatus);
  }
  if (rfc) {
    sql += ' AND ri.rfc LIKE ?';
    params.push(`%${sanitizeText(rfc, 100)}%`);
  }
  if (fechaDesde) {
    sql += ' AND ri.fecha_registro >= ?';
    params.push(fechaDesde);
  }
  if (fechaHasta) {
    sql += ' AND ri.fecha_registro <= ?';
    params.push(fechaHasta);
  }
  return { sql, params };
}

// Ledger cruzado: TODOS los registros eliminados de TODOS los reportes en
// un solo lugar filtrable — a diferencia de GET /reportes/:id/items (que
// solo ve un reporte a la vez), esta es la vista panorámica de auditoría
// completa. Trae también de qué reporte viene cada uno ("Reporte de
// origen"), vía JOIN — información que no aporta nada dentro de un solo
// reporte (ya lo sabes, es el que abriste) pero es central aquí.
app.get(
  '/api/admin/reportes/eliminados',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const { sql: where, params } = filtrosLedgerEliminados(req);
    const [items] = await pool.query(
      `SELECT ri.*, r.fecha_generacion AS reporte_fecha_generacion, r.tipo AS reporte_tipo
         FROM reporte_items ri
         JOIN reportes r ON r.id = ri.reporte_id
         ${where}
        ORDER BY ri.fecha_registro DESC`,
      params
    );
    res.json({ total: items.length, items });
  })
);

// Exportación del ledger cruzado — mismos filtros que GET .../eliminados,
// agrega la columna "Reporte de origen" (generarCSV/generarExcelBuffer
// la incluyen solo cuando se les pide explícitamente, para no alterar la
// exportación de un solo reporte, que no la necesita). Ruta con guión
// (no anidada bajo /reportes/:algo/exportar) a propósito, para no
// competir con la forma de GET /reportes/:id/exportar.
app.get(
  '/api/admin/reportes/eliminados-exportar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const formato = req.query.formato === 'excel' ? 'excel' : 'csv';
    const { sql: where, params } = filtrosLedgerEliminados(req);
    const [items] = await pool.query(
      `SELECT ri.*, r.fecha_generacion AS reporte_fecha_generacion, r.tipo AS reporte_tipo
         FROM reporte_items ri
         JOIN reportes r ON r.id = ri.reporte_id
         ${where}
        ORDER BY ri.fecha_registro DESC`,
      params
    );
    const configGlobalExport = await getConfiguracionGlobal();

    if (formato === 'excel') {
      const buffer = await generarExcelBuffer(items, configGlobalExport.zona_horaria, { incluirOrigen: true });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="eliminados-historico.xlsx"');
      res.send(buffer);
    } else {
      const csv = generarCSV(items, configGlobalExport.zona_horaria, { incluirOrigen: true });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="eliminados-historico.csv"');
      res.send(csv);
    }
  })
);

// Historial de un identificador (folio de ticket o No. de venta) a
// través de TODOS los reportes donde apareció (idea D de auditoría) —
// útil para ver, por ejemplo, que un mismo ticket salió "activo" en un
// reporte de hace 2 semanas y "eliminado" en el de ayer.
app.get(
  '/api/admin/reportes/timeline/:tipoRegistro/:identificador',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const { tipoRegistro, identificador } = req.params;
    if (!['ticket', 'orden_compra'].includes(tipoRegistro)) {
      return res.status(400).json({ error: 'Tipo de registro inválido.' });
    }
    const [entradas] = await pool.query(
      `SELECT ri.*, r.fecha_generacion AS reporte_fecha_generacion, r.tipo AS reporte_tipo
         FROM reporte_items ri
         JOIN reportes r ON r.id = ri.reporte_id
        WHERE ri.tipo_registro = ? AND ri.identificador = ?
        ORDER BY r.fecha_generacion ASC`,
      [tipoRegistro, identificador]
    );
    res.json({ tipoRegistro, identificador, entradas });
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

    // D8 (Inventarios, §22): producto opcional — SOLO se procesa si el
    // módulo está activo para este tenant; si está inactivo, cualquier
    // producto_id/productos_inventario que lleguen en el body se ignoran
    // por completo y la venta se registra manual como siempre (nunca un
    // error 403 aquí, esta ruta no está gateada por requireInventarioActivo
    // a propósito — Ventas debe seguir funcionando sin Inventarios).
    //
    // Segmento A ("Ventas con inventario activo v2"): admite el campo
    // NUEVO `productos_inventario` (array, varias líneas) además del
    // campo legacy `producto_id`/`producto_cantidad` (una sola línea). Si
    // llega el array, manda sobre los campos legacy — se mantienen intactos
    // sin tocar para no romper datos/integraciones existentes de una sola
    // línea (ver `ordenes_compra.producto_id`/`producto_cantidad`, ya no
    // se vuelven a escribir cuando se usa el array).
    let productoId = null;
    let productoCantidad = null;
    let productoSeleccionado = null;
    let lineasInventario = []; // [{ productoId, cantidad, producto }]
    const sePidioArrayInventario =
      Array.isArray(body.productos_inventario) && body.productos_inventario.length > 0;

    if (sePidioArrayInventario) {
      const inventarioEstaActivo = await inventarioActivo();
      if (inventarioEstaActivo) {
        if (body.productos_inventario.length > 50) {
          return res.status(400).json({ error: 'Demasiadas líneas de inventario en una sola venta.' });
        }
        const idsVistos = new Set();
        for (const linea of body.productos_inventario) {
          const idCandidato = Number(linea && linea.producto_id);
          if (!Number.isInteger(idCandidato)) {
            return res.status(400).json({ error: 'Uno de los productos de inventario es inválido.' });
          }
          if (idsVistos.has(idCandidato)) {
            return res.status(400).json({ error: 'El mismo producto aparece en más de una línea; súmalas en una sola.' });
          }
          idsVistos.add(idCandidato);
          const unidades = Number(linea && linea.cantidad);
          if (!Number.isFinite(unidades) || unidades <= 0) {
            return res.status(400).json({ error: 'Indica cuántas unidades se vendieron de cada producto de inventario.' });
          }
          // eslint-disable-next-line no-await-in-loop
          const producto = await obtenerProductoPorId(idCandidato);
          if (!producto) {
            return res.status(400).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Uno de los productos seleccionados ya no existe.' });
          }
          lineasInventario.push({ productoId: producto.id, cantidad: unidades, producto });
        }
      }
      // Si el módulo está inactivo, se ignora igual que el path legacy de
      // abajo: la venta se registra manual, `lineasInventario` se queda vacío.
    } else if (body.producto_id !== undefined && body.producto_id !== null && body.producto_id !== '') {
      // El chequeo de body.producto_id va PRIMERO, antes de tocar la BD:
      // la inmensa mayoría de ventas no llevan producto (D8 es opt-in por
      // tenant), así que inventarioActivo() —una consulta más— solo se
      // paga cuando de verdad hace falta decidir algo.
      const inventarioEstaActivo = await inventarioActivo();
      if (inventarioEstaActivo) {
        const idCandidato = Number(body.producto_id);
        if (!Number.isInteger(idCandidato)) {
          return res.status(400).json({ error: 'Producto inválido.' });
        }
        productoSeleccionado = await obtenerProductoPorId(idCandidato);
        if (!productoSeleccionado) {
          return res.status(400).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'El producto seleccionado no existe.' });
        }
        const unidades = Number(body.producto_cantidad);
        if (!Number.isFinite(unidades) || unidades <= 0) {
          return res.status(400).json({ error: 'Indica cuántas unidades de este producto se vendieron.' });
        }
        productoId = productoSeleccionado.id;
        productoCantidad = unidades;
      }
    }

    // Cuentas por cobrar (punto 138): por defecto pagada, opción pendiente con vencimiento/notas
    let estadoPago = String(body.estado_pago || 'pagada').toLowerCase();
    if (!['pagada', 'pendiente'].includes(estadoPago)) estadoPago = 'pagada';
    let fechaVencimiento = null;
    let notasCobro = sanitizeTextoLibre(body.notas_cobro, 500) || null;
    if (estadoPago === 'pendiente') {
      const rawVto = sanitizeText(body.fecha_vencimiento, 10);
      if (rawVto) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rawVto)) {
          return res.status(400).json({ error: 'La fecha de vencimiento debe ser YYYY-MM-DD.' });
        }
        const d = new Date(rawVto + 'T00:00:00Z');
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Fecha de vencimiento inválida.' });
        const hoyUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
        if (d < hoyUtc) {
          return res.status(400).json({ error: 'La fecha de vencimiento no puede ser anterior a hoy.' });
        }
        fechaVencimiento = rawVto;
      }
    } else {
      // Pagada: ignorar vencimiento/notas de cobro pendiente
      fechaVencimiento = null;
      notasCobro = null;
    }

    // El correo ahora es opcional — modalidad "Imprimir ticket" (ver
    // PROJECT_STATE.md): la venta se registra sin correo, sin correo de
    // confirmación, y se le asigna uno después desde "Reenviar correo" si
    // hace falta. Si SÍ se manda un correo, se valida igual que siempre.
    const emailCapturado = sanitizeText(body.email, 200).toLowerCase();
    let email = null;
    if (emailCapturado) {
      if (!isValidEmail(emailCapturado)) {
        return res.status(400).json({ error: 'Captura un correo electrónico válido.' });
      }
      email = emailCapturado;

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
    const montoCobradoInicial = estadoPago === 'pagada' ? total : 0;
    const fechaCobroInicial = estadoPago === 'pagada' ? ahora : null;
    const [resultado] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, estado_pago, fecha_vencimiento, monto_cobrado, fecha_cobro, notas_cobro, producto_id, producto_cantidad, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['TEMP', ahora, concepto, cantidad, ivaPorcentaje, total, email, estadoPago, fechaVencimiento, montoCobradoInicial, fechaCobroInicial, notasCobro, productoId, productoCantidad, ahora, ahora]
    );

    const numeroCompra = generarNumeroCompra(resultado.insertId);
    await pool.query('UPDATE ordenes_compra SET numero_compra = ? WHERE id = ?', [numeroCompra, resultado.insertId]);

    // D8: producto tipo "producto" (no "servicio", D11) genera su salida
    // automática — validando stock DENTRO de registrarMovimiento (D4).
    // La venta ya se insertó arriba (necesitábamos su id para el No.
    // Venta, que sirve de documento_origen del movimiento) — si el stock
    // no alcanza, se compensa borrando esa fila de verdad: nadie llegó a
    // verla, no hay nada que conservar en papelera (mismo criterio que
    // "Eliminar" en Ventas ya es borrado físico, no lógico).
    if (lineasInventario.length > 0) {
      // Segmento A: varias líneas de inventario. registrarMovimiento()
      // abre su propia transacción por línea (no hay una transacción
      // compartida entre productos distintos), así que "todo o nada" se
      // logra revirtiendo con un compensatorio (`devolucion_cliente`,
      // mismo patrón que "eliminar venta" más abajo) las líneas que sí
      // alcanzaron a descontarse antes de encontrar la que falló.
      const almacenIdVenta = await obtenerAlmacenDefectoId();
      const lineasAplicadas = [];
      let errorLinea = null;
      for (const linea of lineasInventario) {
        if (linea.producto.tipo !== 'producto') continue; // servicios no generan movimiento (D11)
        // eslint-disable-next-line no-await-in-loop
        const resultadoMovimiento = await registrarMovimiento({
          productoId: linea.productoId,
          almacenId: almacenIdVenta,
          tipo: 'venta',
          cantidad: linea.cantidad,
          documentoOrigen: numeroCompra,
          usuario: req.adminUser,
        });
        if (resultadoMovimiento.error) {
          errorLinea = resultadoMovimiento;
          break;
        }
        lineasAplicadas.push(linea);
      }

      if (errorLinea) {
        for (const aplicada of lineasAplicadas) {
          // eslint-disable-next-line no-await-in-loop
          const reingreso = await registrarMovimiento({
            productoId: aplicada.productoId,
            almacenId: almacenIdVenta,
            tipo: 'devolucion_cliente',
            cantidad: aplicada.cantidad,
            documentoOrigen: numeroCompra,
            motivo: 'Venta rechazada por falta de stock en otra línea — reingreso automático',
            usuario: req.adminUser,
          });
          if (reingreso.error) {
            console.error(
              `No se pudo revertir producto_id=${aplicada.productoId} tras rechazar la venta ${numeroCompra}:`,
              reingreso
            );
          }
        }
        await pool.query('DELETE FROM ordenes_compra WHERE id = ?', [resultado.insertId]);
        const mapaEstatusInv = {
          INV_STOCK_INSUFICIENTE: 409,
          INV_CONCURRENCIA: 409,
          INV_PRODUCTO_NO_ENCONTRADO: 400,
          INV_PRODUCTO_SERVICIO: 400,
        };
        return res.status(mapaEstatusInv[errorLinea.error] || 400).json(errorLinea);
      }

      for (const linea of lineasInventario) {
        // eslint-disable-next-line no-await-in-loop
        await pool.query(
          'INSERT INTO orden_productos (orden_id, producto_id, cantidad, creado_en) VALUES (?, ?, ?, ?)',
          [resultado.insertId, linea.productoId, linea.cantidad, ahora]
        );
      }
    } else if (productoId && productoSeleccionado.tipo === 'producto') {
      const almacenIdVenta = await obtenerAlmacenDefectoId();
      const idempotencyKeyVenta = req.get('Idempotency-Key') || null;
      const resultadoMovimiento = await registrarMovimiento({
        productoId,
        almacenId: almacenIdVenta,
        tipo: 'venta',
        cantidad: productoCantidad,
        documentoOrigen: numeroCompra,
        usuario: req.adminUser,
        idempotencyKey: idempotencyKeyVenta,
      });
      if (resultadoMovimiento.error) {
        await pool.query('DELETE FROM ordenes_compra WHERE id = ?', [resultado.insertId]);
        const mapaEstatusInv = {
          INV_STOCK_INSUFICIENTE: 409,
          INV_CONCURRENCIA: 409,
          INV_PRODUCTO_NO_ENCONTRADO: 400,
          INV_PRODUCTO_SERVICIO: 400,
        };
        return res.status(mapaEstatusInv[resultadoMovimiento.error] || 400).json(resultadoMovimiento);
      }
    }

    const fechaFormateada = formatearFechaHoraMexico(ahora, configGlobal.zona_horaria);

    // Correo de confirmación al cliente, con el diseño de "ticket" y el
    // enlace de acceso al portal — "fire-and-forget": si falla, la orden
    // ya se guardó correctamente de todas formas. Se salta por completo si
    // la venta se registró sin correo (modalidad "Imprimir ticket") — no
    // hay a quién mandarlo; se puede asignar uno después desde "Reenviar
    // correo".
    if (email) {
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
        logoUrl: marcaLogoUrl ? `${urlPortalOrden}${marcaLogoUrl}` : configGlobal.logo_url,
        marca: marcaTenant,
      }).catch((err) => {
        console.error('No se pudo enviar el correo de confirmación de la orden de compra:', err.message);
      });
    }

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
      estado_pago: estadoPago,
      fecha_vencimiento: fechaVencimiento,
      monto_cobrado: montoCobradoInicial,
      fecha_cobro: fechaCobroInicial,
      notas_cobro: notasCobro,
      producto_id: productoId,
      producto_cantidad: productoCantidad,
      productos_inventario: lineasInventario.map((l) => ({
        producto_id: l.productoId,
        cantidad: l.cantidad,
        sku: l.producto.sku,
        nombre: l.producto.nombre,
      })),
      mensaje: 'Venta registrada correctamente.',
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
      `SELECT o.id, o.numero_compra, o.fecha_compra, o.concepto, o.cantidad, o.iva_porcentaje, o.total, o.email, o.estado_pago, o.fecha_vencimiento, o.monto_cobrado, o.fecha_cobro, o.notas_cobro, o.creado_en,
        o.producto_id, o.producto_cantidad, p.sku AS producto_sku, p.nombre AS producto_nombre,
        EXISTS(
          SELECT 1 FROM tickets t
          WHERE t.orden_compra_id = o.id AND t.estatus = 'listo' AND t.eliminado_en IS NULL
        ) AS facturado
       FROM ordenes_compra o
       LEFT JOIN productos p ON p.id = o.producto_id
       WHERE o.eliminado_en IS NULL
       ORDER BY o.creado_en DESC`
    );

    // Segmento A: líneas de inventario (0, 1 o varias) por venta, en una
    // segunda consulta aparte — mismo criterio que el resto del proyecto
    // (SQL crudo simple, sin mezclar JSON_ARRAYAGG con el resto de la
    // fila principal).
    const idsOrdenes = ordenes.map((o) => o.id);
    const lineasPorOrden = new Map();
    if (idsOrdenes.length > 0) {
      const [lineas] = await pool.query(
        `SELECT op.orden_id, op.producto_id, op.cantidad, p.sku AS producto_sku, p.nombre AS producto_nombre
           FROM orden_productos op
           LEFT JOIN productos p ON p.id = op.producto_id
          WHERE op.orden_id IN (?)
          ORDER BY op.id ASC`,
        [idsOrdenes]
      );
      for (const l of lineas) {
        if (!lineasPorOrden.has(l.orden_id)) lineasPorOrden.set(l.orden_id, []);
        lineasPorOrden.get(l.orden_id).push({
          producto_id: l.producto_id,
          cantidad: Number(l.cantidad),
          sku: l.producto_sku,
          nombre: l.producto_nombre,
        });
      }
    }

    const configGlobal = await getConfiguracionGlobal();
    const ordenesFormateadas = ordenes.map((orden) => ({
      ...orden,
      facturado: Boolean(orden.facturado),
      productos_inventario: lineasPorOrden.get(orden.id) || [],
      fecha_compra_formateada: formatearFechaHoraMexico(
        new Date(`${orden.fecha_compra.replace(' ', 'T')}Z`),
        configGlobal.zona_horaria
      ),
    }));

    res.json({ total: ordenesFormateadas.length, ordenes: ordenesFormateadas });
  })
);

// Cuentas por cobrar (punto 138): registrar cobro (abono parcial o total) sobre una venta pendiente
app.put(
  '/api/admin/ordenes-compra/:id/cobro',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const body = req.body || {};
    const monto = Number(body.monto);
    if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'El monto a cobrar debe ser mayor a cero.' });
    const notas = body.notas_cobro != null ? sanitizeTextoLibre(body.notas_cobro, 500) : null;

    const [filas] = await pool.query('SELECT id, total, monto_cobrado, estado_pago FROM ordenes_compra WHERE id = ? AND eliminado_en IS NULL LIMIT 1', [id]);
    if (filas.length === 0) return res.status(404).json({ error: 'Venta no encontrada.' });
    const orden = filas[0];
    const saldo = Math.round((Number(orden.total) - Number(orden.monto_cobrado)) * 100) / 100;
    if (saldo <= 0) return res.status(400).json({ error: 'Esta venta ya está pagada.' });
    if (monto - saldo > 0.01) return res.status(400).json({ error: `El monto excede el saldo pendiente ($${saldo.toFixed(2)}).` });

    const nuevoCobrado = Math.round((Number(orden.monto_cobrado) + monto) * 100) / 100;
    const nuevoSaldo = Math.round((Number(orden.total) - nuevoCobrado) * 100) / 100;
    const pagada = nuevoSaldo <= 0.01;
    const ahora = new Date();
    ahora.setMilliseconds(0);

    await pool.query(
      `UPDATE ordenes_compra SET monto_cobrado = ?, estado_pago = ?, fecha_cobro = ?, notas_cobro = COALESCE(?, notas_cobro), actualizado_en = ? WHERE id = ?`,
      [nuevoCobrado, pagada ? 'pagada' : 'pendiente', pagada ? ahora : null, notas, ahora, id]
    );

    const [actualizada] = await pool.query('SELECT id, numero_compra, total, monto_cobrado, estado_pago, fecha_cobro FROM ordenes_compra WHERE id = ? LIMIT 1', [id]);
    res.json({ ok: true, orden: actualizada[0], saldo: nuevoSaldo });
  })
);

// Resumen financiero (Ventas, Facturado, Gastos) para la vista "Resumen
// financiero" del perfil administrador (ver PROJECT_STATE.md). Los KPIs
// del mes en curso (con tendencia vs el mes anterior) se calculan aparte
// de la gráfica: la gráfica cubre una ventana de ~6 meses hacia atrás
// (mes en curso + los 5 anteriores que tengan datos) — GROUP BY omite por
// sí solo cualquier mes sin ventas ni gastos, así que los meses previos a
// que el negocio empezara a usar el sistema nunca aparecen en cero. Todo
// agregado en
// SQL, nunca se manda una fila suelta de ordenes_compra ni de gastos al
// frontend. "Facturado" usa el mismo criterio que el ícono de la tabla de
// Ventas: existe un ticket vinculado en estatus 'listo'. "IVA Neto" no se
// puede calcular con el esquema actual (gastos no guarda desglose de IVA,
// solo el booleano iva_incluido) — el "balance" de aquí es Facturado -
// Gastos, sin pretender ser una cifra fiscal.
//
// La tarjeta "Utilidad neta del mes (ventas totales vs gastos)" (punto
// 118 de PROJECT_STATE.md) también vive aquí: subtotal_ventas suma
// o.cantidad de TODAS las ventas del mes (facturadas o no, sin join a
// tickets), iva_ventas = ventas - subtotal_ventas (dato real: total ya
// incluye el IVA por fila), y utilidad_neta = subtotal_ventas - gastos.
// Es "IVA cobrado en ventas", NO un IVA neto fiscal (los gastos no
// desglosan su propio IVA).
app.get(
  '/api/admin/resumen-financiero',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const configGlobal = await getConfiguracionGlobal();
    const { inicio, fin, inicioAnterior, finAnterior } = limitesMes(configGlobal.zona_horaria);
    // Ventana de la gráfica: primer día del mes hace 5 meses (6 meses de
    // historia contando el mes en curso). Los KPIs de arriba siguen
    // acotados al mes actual/anterior — solo la gráfica mira hacia atrás.
    const inicioSerie = new Date(
      Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() - 5, 1)
    );

    const [[kpiVentas]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? THEN o.total END), 0) AS ventas,
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? THEN o.cantidad END), 0) AS subtotal,
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? AND EXISTS(
           SELECT 1 FROM tickets t
           WHERE t.orden_compra_id = o.id AND t.estatus = 'listo' AND t.eliminado_en IS NULL
         ) THEN o.total END), 0) AS facturado,
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? AND EXISTS(
           SELECT 1 FROM tickets t
           WHERE t.orden_compra_id = o.id AND t.estatus = 'listo' AND t.eliminado_en IS NULL
         ) THEN o.total END), 0) AS facturado_anterior
       FROM ordenes_compra o
       WHERE o.eliminado_en IS NULL AND o.fecha_compra >= ?`,
      [inicio, fin, inicio, fin, inicio, fin, inicioAnterior, finAnterior, inicioAnterior]
    );
    const [[kpiGastos]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? THEN monto END), 0) AS gastos,
         COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? THEN monto END), 0) AS gastos_anterior
       FROM gastos
       WHERE eliminado_en IS NULL AND fecha >= ?`,
      [inicio, fin, inicioAnterior, finAnterior, inicioAnterior]
    );

    const ventas = Number(kpiVentas.ventas);
    const facturado = Number(kpiVentas.facturado);
    const facturadoAnterior = Number(kpiVentas.facturado_anterior);
    const subtotalVentas = Number(kpiVentas.subtotal);
    const gastos = Number(kpiGastos.gastos);
    const gastosAnterior = Number(kpiGastos.gastos_anterior);

    // Tarjeta "Utilidad neta del mes (ventas totales vs gastos)" (punto
    // 118): compara el neto SIN IVA de todas las ventas contra los gastos.
    // Se redondea a 2 decimales para evitar polvo de punto flotante en la
    // resta (mismo criterio que la proyección de abajo).
    const ivaVentas = Math.round((ventas - subtotalVentas) * 100) / 100;
    const utilidadNeta = Math.round((subtotalVentas - gastos) * 100) / 100;

    // Sin datos del mes anterior para comparar, no se inventa una
    // tendencia (mismo criterio que aplicarTendencia() en admin.js para
    // los KPIs de tickets de la vista "Inicio").
    const calcularTendencia = (actual, anterior) => {
      if (anterior === 0) return actual > 0 ? null : 0;
      return Math.round(((actual - anterior) / anterior) * 100);
    };

    // Gráfica: ventana de ~6 meses hacia atrás (inicioSerie) — GROUP BY
    // solo devuelve meses que sí tuvieron al menos una fila, así que un
    // mes vacío simplemente no aparece (sin necesidad de filtrarlo aparte).
    const [filasVentasSerie] = await pool.query(
      `SELECT DATE_FORMAT(o.fecha_compra, '%Y-%m') AS mes,
         SUM(o.total) AS ventas,
         SUM(o.cantidad) AS subtotal,
         SUM(CASE WHEN EXISTS(
           SELECT 1 FROM tickets t
           WHERE t.orden_compra_id = o.id AND t.estatus = 'listo' AND t.eliminado_en IS NULL
         ) THEN o.total ELSE 0 END) AS facturado
       FROM ordenes_compra o
       WHERE o.eliminado_en IS NULL AND o.fecha_compra >= ?
       GROUP BY DATE_FORMAT(o.fecha_compra, '%Y-%m')`,
      [inicioSerie]
    );
    const [filasGastosSerie] = await pool.query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, SUM(monto) AS gastos
       FROM gastos
       WHERE eliminado_en IS NULL AND fecha >= ?
       GROUP BY DATE_FORMAT(fecha, '%Y-%m')`,
      [inicioSerie]
    );

    const mapaVentasSerie = new Map(filasVentasSerie.map((f) => [f.mes, f]));
    const mapaGastosSerie = new Map(filasGastosSerie.map((f) => [f.mes, Number(f.gastos)]));
    const llavesMeses = [...new Set([...mapaVentasSerie.keys(), ...mapaGastosSerie.keys()])].sort();
    // utilidad_neta por mes usa la MISMA fórmula que la tarjeta "Utilidad
    // neta del mes" (punto 118): subtotal de ventas (todas, sin IVA) menos
    // gastos — así el último punto de "Utilidad neta mensual" siempre
    // coincide con el KPI grande de arriba, sin una segunda definición de
    // "utilidad" en la misma pantalla (antes esta gráfica era "Balance
    // acumulado" = suma corrida de Facturado-Gastos, ver PROJECT_STATE.md).
    const serie = llavesMeses.map((llave) => {
      const v = mapaVentasSerie.get(llave);
      const subtotal = v ? Number(v.subtotal) : 0;
      const gastosMes = mapaGastosSerie.get(llave) || 0;
      return {
        mes: etiquetaMes(llave),
        ventas: v ? Number(v.ventas) : 0,
        facturado: v ? Number(v.facturado) : 0,
        gastos: gastosMes,
        utilidad_neta: Math.round((subtotal - gastosMes) * 100) / 100,
      };
    });

    // Distribución de gastos por categoría del mes en curso (para la
    // dona de "Distribución de gastos" del segmento BI). Se manda el slug
    // crudo, no la etiqueta en español — el frontend ya tiene su propio
    // mapa de etiquetas (etiquetaCategoriaGasto en admin.js), mismo
    // criterio que la lista de gastos.
    const [filasGastosCategoria] = await pool.query(
      `SELECT categoria, SUM(monto) AS monto
         FROM gastos
        WHERE eliminado_en IS NULL AND fecha >= ? AND fecha < ?
        GROUP BY categoria
        ORDER BY monto DESC`,
      [inicio, fin]
    );

    // Top 5 proveedores de gasto del mes en curso — dato accionable real
    // (columna `proveedor`, texto libre capturado en el alta del gasto);
    // se excluyen los gastos sin proveedor capturado.
    const [filasTopProveedores] = await pool.query(
      `SELECT proveedor, SUM(monto) AS monto
         FROM gastos
        WHERE eliminado_en IS NULL AND fecha >= ? AND fecha < ?
          AND proveedor IS NOT NULL AND proveedor <> ''
        GROUP BY proveedor
        ORDER BY monto DESC
        LIMIT 5`,
      [inicio, fin]
    );

    // Proyección de ventas de los próximos 2 meses: estimación estadística
    // simple (promedio del cambio mes a mes de los últimos 3 meses CON
    // datos reales, extendido hacia adelante), NO un pronóstico
    // financiero — se etiqueta como tal en el frontend. Sin al menos 3
    // meses reales para calcular una tendencia, no se inventa nada (mismo
    // criterio que calcularTendencia() de arriba con el mes anterior).
    let proyeccionVentas = null;
    if (llavesMeses.length >= 3) {
      const ultimasLlaves = llavesMeses.slice(-3);
      const ultimosValores = ultimasLlaves.map((llave) => Number(mapaVentasSerie.get(llave)?.ventas || 0));
      const promedioDelta = ((ultimosValores[1] - ultimosValores[0]) + (ultimosValores[2] - ultimosValores[1])) / 2;
      const ultimaLlave = llavesMeses[llavesMeses.length - 1];
      const ultimoValor = ultimosValores[2];
      proyeccionVentas = [1, 2].map((n) => {
        const [anio, mesNum] = ultimaLlave.split('-').map(Number);
        const fechaProyectada = new Date(Date.UTC(anio, mesNum - 1 + n, 1));
        const llaveProyectada = `${fechaProyectada.getUTCFullYear()}-${String(fechaProyectada.getUTCMonth() + 1).padStart(2, '0')}`;
        return {
          mes: etiquetaMes(llaveProyectada),
          ventas: Math.max(0, Math.round((ultimoValor + promedioDelta * n) * 100) / 100),
        };
      });
    }

    res.json({
      mes_actual: {
        ventas,
        facturado,
        ventas_sin_facturar: ventas - facturado,
        gastos,
        balance: facturado - gastos,
        subtotal_ventas: subtotalVentas,
        iva_ventas: ivaVentas,
        utilidad_neta: utilidadNeta,
      },
      tendencia: {
        facturado: calcularTendencia(facturado, facturadoAnterior),
        gastos: calcularTendencia(gastos, gastosAnterior),
      },
      serie_mensual: serie,
      gastos_por_categoria: filasGastosCategoria.map((f) => ({ categoria: f.categoria, monto: Number(f.monto) })),
      top_proveedores: filasTopProveedores.map((f) => ({ proveedor: f.proveedor, monto: Number(f.monto) })),
      proyeccion_ventas: proyeccionVentas,
    });
  })
);

// ---------- Modo dashboard: preferencias de layout por usuario ----------
//
// Cada usuario administrador puede reorganizar y redimensionar las
// tarjetas de una vista ("Modo dashboard" en el frontend) y su layout se
// guarda en preferencias_dashboard, por usuario y por vista, para
// restaurarse en su próximo ingreso. El layout se valida SIEMPRE contra
// una whitelist cerrada de elementos conocidos por vista: nunca se confía
// en IDs ni coordenadas arbitrarias del cliente (máximo un elemento por
// id, span entero acotado). Sin FK a usuarios a propósito: las cuentas
// "super" que entran por ADMIN_USERS o la cuenta de respaldo "admin" no
// existen en la tabla usuarios y también deben poder guardar layout.
// La auditoría de estos PUT/DELETE ya queda cubierta por el middleware
// global de accesos administrativos (solo omite GET).
const VISTAS_DASHBOARD = {
  'resumen-financiero': {
    elementos: [
      'kpi-facturado',
      'kpi-gastos',
      'kpi-balance',
      'kpi-sin-facturar',
      'utilidad',
      'ventas-facturado-gastos',
      'gastos-categoria',
      'facturacion',
      'balance-acumulado',
      'proyeccion',
      'proveedores',
    ],
    spanMin: 3,
    spanMax: 12,
  },
};

// Normaliza/valida un layout del cliente contra la whitelist de la vista.
// Devuelve el arreglo limpio [{id, span}] o null si algo no cuadra —
// un layout parcialmente válido se rechaza completo para que el frontend
// nunca guarde a medias.
function validarLayoutDashboard(configVista, layout) {
  if (!Array.isArray(layout) || layout.length === 0 || layout.length > configVista.elementos.length) {
    return null;
  }
  const vistos = new Set();
  const limpio = [];
  for (const item of layout) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (!configVista.elementos.includes(item.id) || vistos.has(item.id)) return null;
    if (!Number.isInteger(item.span) || item.span < configVista.spanMin || item.span > configVista.spanMax) {
      return null;
    }
    vistos.add(item.id);
    limpio.push({ id: item.id, span: item.span });
  }
  return limpio;
}

app.get(
  '/api/admin/preferencias-dashboard/:vista',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const configVista = VISTAS_DASHBOARD[req.params.vista];
    if (!configVista) {
      return res.status(404).json({ error: 'Vista no encontrada.' });
    }
    const [filas] = await pool.query(
      'SELECT layout_json FROM preferencias_dashboard WHERE usuario = ? AND vista = ?',
      [req.adminUser, req.params.vista]
    );
    if (filas.length === 0) {
      return res.json({ layout: null });
    }
    let layout = filas[0].layout_json;
    if (typeof layout === 'string') {
      try {
        layout = JSON.parse(layout);
      } catch (err) {
        layout = null;
      }
    }
    if (!Array.isArray(layout)) {
      return res.json({ layout: null });
    }
    // Defensa en profundidad: aunque la fila venga de nuestra propia BD,
    // solo se devuelven elementos de la whitelist vigente — si una vista
    // cambió sus tarjetas, un layout viejo no debe romper al frontend.
    res.json({ layout: validarLayoutDashboard(configVista, layout) });
  })
);

app.put(
  '/api/admin/preferencias-dashboard/:vista',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const configVista = VISTAS_DASHBOARD[req.params.vista];
    if (!configVista) {
      return res.status(404).json({ error: 'Vista no encontrada.' });
    }
    const layout = validarLayoutDashboard(configVista, req.body ? req.body.layout : undefined);
    if (!layout) {
      return res.status(400).json({ error: 'Layout inválido.' });
    }
    await pool.query(
      `INSERT INTO preferencias_dashboard (usuario, vista, layout_json, actualizado_en)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE layout_json = VALUES(layout_json), actualizado_en = VALUES(actualizado_en)`,
      [req.adminUser, req.params.vista, JSON.stringify(layout), new Date()]
    );
    res.json({ ok: true, layout });
  })
);

app.delete(
  '/api/admin/preferencias-dashboard/:vista',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const configVista = VISTAS_DASHBOARD[req.params.vista];
    if (!configVista) {
      return res.status(404).json({ error: 'Vista no encontrada.' });
    }
    await pool.query('DELETE FROM preferencias_dashboard WHERE usuario = ? AND vista = ?', [
      req.adminUser,
      req.params.vista,
    ]);
    res.json({ ok: true });
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
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    // Ventas registradas sin correo (modalidad "Imprimir ticket") no
    // tienen a quién reenviar — aquí es donde se les asigna uno por
    // primera vez. El correo mandado en el body SOLO se usa/guarda si la
    // venta todavía no tiene uno; si ya tiene, se ignora y se reenvía al
    // que ya estaba (mismo comportamiento de siempre).
    let email = orden.email;
    let tieneConstancia = null;
    if (!email) {
      const emailCapturado = sanitizeText(req.body && req.body.email, 200).toLowerCase();
      if (!emailCapturado || !isValidEmail(emailCapturado)) {
        return res.status(400).json({ error: 'Captura un correo electrónico válido para esta venta.' });
      }
      email = emailCapturado;
      const [registrosCoincidentes] = await pool.query(
        'SELECT id FROM registros WHERE email = ? AND eliminado_en IS NULL LIMIT 1',
        [email]
      );
      tieneConstancia = registrosCoincidentes.length > 0;
      const ahoraAsignacion = new Date();
      ahoraAsignacion.setMilliseconds(0);
      await pool.query('UPDATE ordenes_compra SET email = ?, actualizado_en = ? WHERE id = ?', [
        email,
        ahoraAsignacion,
        id,
      ]);
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
        email,
        urlPortal: urlPortalReenvio,
        logoUrl: marcaLogoUrlReenvio ? `${urlPortalReenvio}${marcaLogoUrlReenvio}` : configGlobal.logo_url,
        marca: marcaTenantReenvio,
      });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo reenviar el correo: ${err.message}` });
    }

    res.json({
      ok: true,
      mensaje: `Correo reenviado a ${email}.`,
      email,
      tiene_constancia: tieneConstancia,
    });
  })
);

// Elimina una orden de compra (borrado físico, sin papelera — mismo
// criterio que ya usa la limpieza automática por retención, ver
// utils/ticketsCleanup.js: el reporte generado aquí abajo ES el respaldo
// permanente, no una fila que se pueda restaurar). Antes de borrar,
// genera y (si hay un correo de reportes configurado en "Configuraciones
// globales") envía un reporte con la información de esta orden — mismo
// mecanismo y mismo correo destino que ya usa el borrado automático, solo
// que aquí es un reporte de un solo item y tipo "manual". Si el reporte
// falla al generarse/guardarse, la orden NO se borra (a diferencia de la
// limpieza automática por lotes, aquí es una sola orden a propósito
// elegida por el administrador — perder su respaldo sin avisar sería
// peor que dejarla sin borrar).
app.delete(
  '/api/admin/ordenes-compra/:id',
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
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    let resultadoReporte;
    try {
      const item = ordenAItemReporte(orden);
      resultadoReporte = await generarYEnviarReporte({
        tipo: 'manual',
        items: [item],
        rangoInicio: orden.creado_en,
        rangoFin: orden.creado_en,
      });
    } catch (err) {
      return res.status(502).json({ error: `No se pudo generar el reporte antes de eliminar: ${err.message}` });
    }

    // D8: si la venta tenía un producto y ese producto sigue existiendo
    // (no está en la papelera de Inventarios), reingresa las unidades
    // antes de borrar — la venta ya no existe, pero el movimiento de
    // salida original nunca se borra (§14), así que esto es un
    // compensatorio nuevo (`devolucion_cliente`), no una corrección del
    // movimiento viejo. Si el producto ya no existe, no hay a dónde
    // reingresar — se omite en silencio y la venta se borra igual (el
    // dato ya es histórico y el producto fue un borrado consciente
    // aparte, no algo que esta ruta deba bloquear).
    if (orden.producto_id && orden.producto_cantidad) {
      const productoDeLaVenta = await obtenerProductoPorId(orden.producto_id);
      if (productoDeLaVenta && productoDeLaVenta.tipo === 'producto') {
        const almacenIdReingreso = await obtenerAlmacenDefectoId();
        const resultadoReingreso = await registrarMovimiento({
          productoId: orden.producto_id,
          almacenId: almacenIdReingreso,
          tipo: 'devolucion_cliente',
          cantidad: Number(orden.producto_cantidad),
          documentoOrigen: orden.numero_compra,
          motivo: 'Venta eliminada — reingreso automático',
          usuario: req.adminUser,
        });
        if (resultadoReingreso.error) {
          console.error(
            `No se pudo reingresar producto_id=${orden.producto_id} al eliminar la venta ${orden.numero_compra}:`,
            resultadoReingreso
          );
          return res.status(409).json({
            error: resultadoReingreso.error,
            mensaje: 'No se pudo reingresar el producto al inventario; la venta no se eliminó.',
          });
        }
      }
    }

    // Segmento A: mismo reingreso, pero por cada línea de orden_productos
    // (0, 1 o varias) en vez de una sola columna. Si alguna línea no se
    // puede reingresar, la venta no se elimina — igual que el caso de
    // arriba, para no perder trazabilidad de stock a medias.
    const [lineasDeLaVenta] = await pool.query(
      'SELECT producto_id, cantidad FROM orden_productos WHERE orden_id = ?',
      [id]
    );
    if (lineasDeLaVenta.length > 0) {
      const almacenIdReingreso = await obtenerAlmacenDefectoId();
      for (const linea of lineasDeLaVenta) {
        // eslint-disable-next-line no-await-in-loop
        const productoDeLaLinea = await obtenerProductoPorId(linea.producto_id);
        if (!productoDeLaLinea || productoDeLaLinea.tipo !== 'producto') continue;
        // eslint-disable-next-line no-await-in-loop
        const resultadoReingreso = await registrarMovimiento({
          productoId: linea.producto_id,
          almacenId: almacenIdReingreso,
          tipo: 'devolucion_cliente',
          cantidad: Number(linea.cantidad),
          documentoOrigen: orden.numero_compra,
          motivo: 'Venta eliminada — reingreso automático',
          usuario: req.adminUser,
        });
        if (resultadoReingreso.error) {
          console.error(
            `No se pudo reingresar producto_id=${linea.producto_id} al eliminar la venta ${orden.numero_compra}:`,
            resultadoReingreso
          );
          return res.status(409).json({
            error: resultadoReingreso.error,
            mensaje: 'No se pudo reingresar el producto al inventario; la venta no se eliminó.',
          });
        }
      }
    }

    await pool.query('DELETE FROM orden_productos WHERE orden_id = ?', [id]);
    await pool.query('DELETE FROM ordenes_compra WHERE id = ?', [id]);

    res.json({
      ok: true,
      mensaje: resultadoReporte.correoEnviado
        ? `Venta ${orden.numero_compra} eliminada. Reporte enviado a ${resultadoReporte.correoDestino}.`
        : `Venta ${orden.numero_compra} eliminada. El reporte se guardó, pero no hay un correo de reportes configurado — nada se envió.`,
      correoEnviado: resultadoReporte.correoEnviado,
      correoDestino: resultadoReporte.correoDestino,
    });
  })
);

// ---------- Gastos de la operación (módulo "Gastos") ----------
// Control administrativo/financiero de los gastos, con o sin factura
// (ver PROJECT_STATE.md). Solo lo ve el perfil "administrador" (el
// perfil "fiscal" atiende constancias/tickets; los gastos son control
// del dueño de la operación). Papelera con borrado lógico
// (`eliminado_en`), mismo patrón que tickets y constancias.

// Normaliza un booleano enviado en el cuerpo de la petición: el
// formulario manda true/false, pero se aceptan también 1/0 y sus
// equivalentes en texto por si algún cliente HTTP distinto los manda.
function booleanoDe(body, campo) {
  const valor = body[campo];
  return valor === true || valor === 1 || valor === '1';
}

// Lista los gastos con filtros combinables y, además, el resumen de
// KPIs del mes en curso (solo en la vista de activos — en la papelera
// no aplica). Los filtros son opcionales y se van agregando al WHERE
// solo si vienen; `busqueda` hace un LIKE sin acentos sobre concepto y
// proveedor. `fecha_desde`/`fecha_hasta` son "YYYY-MM-DD".
app.get(
  '/api/admin/gastos',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const verPapelera = req.query.papelera === 'true';
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const porPagina = Math.min(100, Math.max(5, Number(req.query.por_pagina) || 25));

    const condiciones = ['1=1'];
    const params = [];
    if (req.query.fecha_desde && /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha_desde)) {
      condiciones.push('fecha >= ?');
      params.push(req.query.fecha_desde);
    }
    if (req.query.fecha_hasta && /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha_hasta)) {
      condiciones.push('fecha <= ?');
      params.push(req.query.fecha_hasta);
    }
    // Filtro de lectura: basta con la forma del slug (letras/números/
    // guion bajo), no hace falta confirmar que exista en la tabla —
    // filtrar por una categoría que ya no existe simplemente da 0 filas,
    // sin riesgo, y evita una consulta extra en cada listado.
    if (req.query.categoria && /^[a-z0-9_]{1,50}$/.test(req.query.categoria)) {
      condiciones.push('categoria = ?');
      params.push(req.query.categoria);
    }
    if (req.query.tiene_factura === '1' || req.query.tiene_factura === '0') {
      condiciones.push('tiene_factura = ?');
      params.push(req.query.tiene_factura);
    }
    if (req.query.recurrente === '1' || req.query.recurrente === '0') {
      condiciones.push('recurrente = ?');
      params.push(req.query.recurrente);
    }
    const busqueda = typeof req.query.busqueda === 'string' ? req.query.busqueda.trim() : '';
    if (busqueda) {
      const patron = `%${busqueda}%`;
      condiciones.push('(concepto LIKE ? OR proveedor LIKE ?)');
      params.push(patron, patron);
    }
    condiciones.push(verPapelera ? 'eliminado_en IS NOT NULL' : 'eliminado_en IS NULL');
    const where = condiciones.join(' AND ');

    const [contador] = await pool.query(`SELECT COUNT(*) AS total FROM gastos WHERE ${where}`, params);
    const total = Number(contador[0].total);

    const [filas] = await pool.query(
      `SELECT * FROM gastos WHERE ${where} ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, porPagina, (pagina - 1) * porPagina]
    );

    let resumen = null;
    if (!verPapelera) {
      const configGlobal = await getConfiguracionGlobal();
      const { inicio, fin, inicioAnterior, finAnterior } = limitesMes(configGlobal.zona_horaria);
      const [filasResumen] = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? THEN monto END), 0) AS mes_actual,
           COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? AND tiene_factura = 1 THEN monto END), 0) AS con_factura,
           COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? AND tiene_factura = 0 THEN monto END), 0) AS sin_factura,
           COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? THEN monto END), 0) AS mes_anterior,
           COUNT(CASE WHEN fecha >= ? AND fecha < ? THEN 1 END) AS cantidad
         FROM gastos WHERE eliminado_en IS NULL`,
        [inicio, fin, inicio, fin, inicio, fin, inicioAnterior, finAnterior, inicio, fin]
      );
      const r = filasResumen[0];
      resumen = {
        mes_actual: Number(r.mes_actual),
        con_factura: Number(r.con_factura),
        sin_factura: Number(r.sin_factura),
        mes_anterior: Number(r.mes_anterior),
        cantidad: Number(r.cantidad),
      };
    }

    res.json({
      total,
      pagina,
      por_pagina: porPagina,
      gastos: filas.map((g) => ({
        ...g,
        monto: Number(g.monto),
        iva_incluido: Boolean(g.iva_incluido),
        tiene_factura: Boolean(g.tiene_factura),
        recurrente: Boolean(g.recurrente),
      })),
      resumen,
    });
  })
);

// Valida los campos comunes de crear/actualizar un gasto y devuelve el
// objeto ya normalizado listo para el INSERT/UPDATE, o `null` tras
// responder con el error correspondiente.
async function validarCuerpoGasto(req, res) {
  const body = req.body || {};

  const fecha = String(body.fecha || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    res.status(400).json({ error: 'Selecciona la fecha del gasto.' });
    return null;
  }
  if (Number.isNaN(new Date(`${fecha}T00:00:00Z`).getTime())) {
    res.status(400).json({ error: 'La fecha del gasto no es válida.' });
    return null;
  }

  const concepto = sanitizeText(body.concepto, 200);
  if (!concepto) {
    res.status(400).json({ error: 'El concepto del gasto es obligatorio.' });
    return null;
  }

  const proveedor = sanitizeText(body.proveedor, 150) || null;
  const categoria = String(body.categoria || '');
  if (!(await categoriaGastoExiste(categoria))) {
    res.status(400).json({ error: 'Selecciona una categoría válida.' });
    return null;
  }

  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    res.status(400).json({ error: 'El monto debe ser un número mayor a cero.' });
    return null;
  }
  const montoRedondeado = Math.round(monto * 100) / 100;

  const notas = sanitizeText(body.notas, 2000) || null;

  return {
    fecha,
    concepto,
    proveedor,
    categoria,
    monto: montoRedondeado,
    iva_incluido: booleanoDe(body, 'iva_incluido') ? 1 : 0,
    tiene_factura: booleanoDe(body, 'tiene_factura') ? 1 : 0,
    recurrente: booleanoDe(body, 'recurrente') ? 1 : 0,
    notas,
  };
}

// Registra un gasto. La fecha la manda el administrador (la del gasto,
// no la de captura — la captura siempre se guarda aparte en creado_en).
app.post(
  '/api/admin/gastos',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const datos = await validarCuerpoGasto(req, res);
    if (!datos) return;

    const ahora = new Date();
    ahora.setMilliseconds(0);
    const [resultado] = await pool.query(
      `INSERT INTO gastos
        (fecha, concepto, proveedor, categoria, monto, iva_incluido, tiene_factura, recurrente, notas, creado_por, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.fecha,
        datos.concepto,
        datos.proveedor,
        datos.categoria,
        datos.monto,
        datos.iva_incluido,
        datos.tiene_factura,
        datos.recurrente,
        datos.notas,
        req.adminUser,
        ahora,
        ahora,
      ]
    );

    res.status(201).json({
      ok: true,
      id: resultado.insertId,
      mensaje: 'Gasto registrado correctamente.',
    });
  })
);

// Actualiza un gasto (solo desde la vista de activos). Si se cambia
// "tiene_factura" a falso y el gasto tenía un comprobante adjunto, el
// archivo se elimina del almacenamiento y los campos del comprobante se
// limpian — un gasto "sin factura" no debe conservar un comprobante.
app.put(
  '/api/admin/gastos/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ? AND eliminado_en IS NULL', [id]);
    const gasto = filas[0];
    if (!gasto) {
      return res.status(404).json({ error: 'Gasto no encontrado.' });
    }

    const datos = await validarCuerpoGasto(req, res);
    if (!datos) return;

    let comprobanteNombreOriginal = gasto.comprobante_nombre_original;
    let comprobanteNombreGuardado = gasto.comprobante_nombre_guardado;
    let comprobanteMime = gasto.comprobante_mime;
    if (!datos.tiene_factura && gasto.comprobante_nombre_guardado) {
      try {
        await storage.eliminarArchivo(storage.prefijoTenant(req), 'comprobantes', gasto.comprobante_nombre_guardado);
      } catch (e) {
        console.error('No se pudo borrar el comprobante del gasto en el almacenamiento:', e);
      }
      comprobanteNombreOriginal = null;
      comprobanteNombreGuardado = null;
      comprobanteMime = null;
    }

    const ahora = new Date();
    ahora.setMilliseconds(0);
    await pool.query(
      `UPDATE gastos SET fecha = ?, concepto = ?, proveedor = ?, categoria = ?, monto = ?,
         iva_incluido = ?, tiene_factura = ?, recurrente = ?, notas = ?,
         comprobante_nombre_original = ?, comprobante_nombre_guardado = ?, comprobante_mime = ?,
         actualizado_en = ?
       WHERE id = ?`,
      [
        datos.fecha,
        datos.concepto,
        datos.proveedor,
        datos.categoria,
        datos.monto,
        datos.iva_incluido,
        datos.tiene_factura,
        datos.recurrente,
        datos.notas,
        comprobanteNombreOriginal,
        comprobanteNombreGuardado,
        comprobanteMime,
        ahora,
        id,
      ]
    );

    res.json({ ok: true, mensaje: 'Gasto actualizado correctamente.' });
  })
);

// Borrado lógico: manda el gasto a la papelera. No toca el comprobante
// en el almacenamiento ni la fila — se puede restaurar después.
app.delete(
  '/api/admin/gastos/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ? AND eliminado_en IS NULL', [id]);
    if (!filas[0]) {
      return res.status(404).json({ error: 'Gasto no encontrado.' });
    }

    const ahora = new Date();
    ahora.setMilliseconds(0);
    await pool.query('UPDATE gastos SET eliminado_en = ?, actualizado_en = ? WHERE id = ?', [ahora, ahora, id]);
    res.json({ ok: true, mensaje: 'Gasto movido a la papelera.' });
  })
);

// Restaura un gasto que estaba en la papelera (deshace el borrado lógico).
app.post(
  '/api/admin/gastos/:id/restaurar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ? AND eliminado_en IS NOT NULL', [id]);
    if (!filas[0]) {
      return res.status(404).json({ error: 'Gasto no encontrado en la papelera.' });
    }

    const ahora = new Date();
    ahora.setMilliseconds(0);
    await pool.query('UPDATE gastos SET eliminado_en = NULL, actualizado_en = ? WHERE id = ?', [ahora, id]);
    res.json({ ok: true, mensaje: 'Gasto restaurado.' });
  })
);

// Borrado físico: elimina la fila y su comprobante (si lo tiene) del
// almacenamiento, de forma permanente. No se puede deshacer. Se espera
// que el gasto ya esté en la papelera (el frontend solo expone este
// botón ahí).
app.delete(
  '/api/admin/gastos/:id/permanente',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ? AND eliminado_en IS NOT NULL', [id]);
    const gasto = filas[0];
    if (!gasto) {
      return res.status(404).json({ error: 'Gasto no encontrado en la papelera.' });
    }

    if (gasto.comprobante_nombre_guardado) {
      try {
        await storage.eliminarArchivo(storage.prefijoTenant(req), 'comprobantes', gasto.comprobante_nombre_guardado);
      } catch (e) {
        console.error('No se pudo borrar el comprobante del gasto en el almacenamiento:', e);
      }
    }

    await pool.query('DELETE FROM gastos WHERE id = ?', [id]);
    res.json({ ok: true, mensaje: 'Gasto y su comprobante eliminados permanentemente.' });
  })
);

// Sube (o reemplaza) el comprobante de un gasto — PDF (la factura sola)
// o ZIP (el par PDF + XML de un CFDI). Solo aplica a gastos marcados con
// "tiene_factura"; el filtro de extensión/MIME lo hace multer, y aquí se
// verifica la firma binaria real antes de guardar (mismo patrón que la
// constancia y los tickets).
app.post(
  '/api/admin/gastos/:id/comprobante',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  (req, res) => {
    subirConTenant(uploadComprobante, 'comprobante', req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: `El archivo excede el tamaño máximo permitido de ${MAX_FILE_SIZE_MB} MB.`,
          });
        }
        if (err.message === 'TIPO_NO_PERMITIDO') {
          return res.status(400).json({
            error: 'Solo se acepta un PDF (la factura) o un ZIP (con el PDF y el XML de la factura dentro).',
          });
        }
        console.error('Error al subir el comprobante del gasto:', err);
        return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
      }

      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
          return res.status(400).json({ error: 'Identificador inválido.' });
        }
        if (!req.file) {
          return res.status(400).json({ error: 'Debes adjuntar el comprobante.' });
        }

        const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ? AND eliminado_en IS NULL', [id]);
        const gasto = filas[0];
        if (!gasto) {
          return res.status(404).json({ error: 'Gasto no encontrado.' });
        }
        if (!gasto.tiene_factura) {
          return res.status(400).json({ error: 'Un gasto marcado sin factura no puede tener comprobante.' });
        }

        // Verificación real del contenido por firma binaria: PDF (%PDF) o
        // ZIP (PK). Un archivo renombrado a ".pdf"/".zip" pero que es otra
        // cosa se rechaza aquí, aunque haya pasado el filtro inicial.
        const mimePdf = detectRealMimeType(req.file.buffer);
        let extension;
        let mime;
        if (mimePdf) {
          extension = '.pdf';
          mime = 'application/pdf';
        } else if (esZipValido(req.file.buffer)) {
          extension = '.zip';
          mime = 'application/zip';
        } else {
          return res.status(400).json({ error: 'El contenido del archivo no es un PDF ni un ZIP válido.' });
        }

        req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        const prefijoComprobante = storage.prefijoTenant(req);

        // Borra el comprobante anterior si se está reemplazando. DeleteObject
        // es idempotente, no hace falta comprobar existencia primero.
        if (gasto.comprobante_nombre_guardado) {
          await storage.eliminarArchivo(prefijoComprobante, 'comprobantes', gasto.comprobante_nombre_guardado);
        }

        const storedFilename = `${crypto.randomUUID()}${extension}`;
        await storage.guardarArchivo(prefijoComprobante, 'comprobantes', storedFilename, req.file.buffer, mime);

        const ahora = new Date();
        ahora.setMilliseconds(0);
        await pool.query(
          `UPDATE gastos SET comprobante_nombre_original = ?, comprobante_nombre_guardado = ?,
             comprobante_mime = ?, actualizado_en = ? WHERE id = ?`,
          [req.file.originalname.slice(0, 255), storedFilename, mime, ahora, id]
        );

        res.json({ ok: true, mensaje: 'Comprobante cargado correctamente.' });
      } catch (innerErr) {
        console.error('Error al guardar el comprobante del gasto:', innerErr);
        res.status(500).json({ error: 'Ocurrió un error interno. Intenta de nuevo.' });
      }
    });
  }
);

// Quita el comprobante de un gasto (borra el archivo y limpia los campos).
app.delete(
  '/api/admin/gastos/:id/comprobante',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ? AND eliminado_en IS NULL', [id]);
    const gasto = filas[0];
    if (!gasto) {
      return res.status(404).json({ error: 'Gasto no encontrado.' });
    }
    if (!gasto.comprobante_nombre_guardado) {
      return res.status(409).json({ error: 'Este gasto no tiene un comprobante cargado.' });
    }

    await storage.eliminarArchivo(storage.prefijoTenant(req), 'comprobantes', gasto.comprobante_nombre_guardado);

    const ahora = new Date();
    ahora.setMilliseconds(0);
    await pool.query(
      `UPDATE gastos SET comprobante_nombre_original = NULL, comprobante_nombre_guardado = NULL,
         comprobante_mime = NULL, actualizado_en = ? WHERE id = ?`,
      [ahora, id]
    );

    res.json({ ok: true, mensaje: 'Comprobante eliminado.' });
  })
);

// Descarga el comprobante de un gasto (para verificarlo o volver a
// descargarlo sin depender de tenerlo en la computadora de quien lo subió).
app.get(
  '/api/admin/gastos/:id/comprobante',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }

    const [filas] = await pool.query('SELECT * FROM gastos WHERE id = ?', [id]);
    const gasto = filas[0];
    if (!gasto) {
      return res.status(404).json({ error: 'Gasto no encontrado.' });
    }
    if (!gasto.comprobante_nombre_guardado) {
      return res.status(409).json({ error: 'Este gasto no tiene un comprobante cargado.' });
    }

    const prefijoComprobanteGet = storage.prefijoTenant(req);
    if (!(await storage.existeArchivo(prefijoComprobanteGet, 'comprobantes', gasto.comprobante_nombre_guardado))) {
      return res.status(404).json({ error: 'El comprobante ya no existe en el servidor.' });
    }

    res.setHeader('Content-Type', gasto.comprobante_mime || 'application/octet-stream');
    const originalName = gasto.comprobante_nombre_original || `comprobante-${gasto.id}.pdf`;
    const asciiFallback = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
    );
    await storage.enviarArchivoARespuesta(prefijoComprobanteGet, 'comprobantes', gasto.comprobante_nombre_guardado, res);
  })
);

// Categorías de gastos, EDITABLES desde el popup de "Registrar gasto"
// (ver PROJECT_STATE.md, segmento "Categorías editables") — antes era
// una lista cerrada en código; ahora vive en la tabla categorias_gastos
// (ver ensureSchema en db.js). Mismo perfil que el resto de Gastos.
app.get(
  '/api/admin/gastos/categorias',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const categorias = await listarCategoriasGastos();
    res.json({ categorias });
  })
);

app.post(
  '/api/admin/gastos/categorias',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const resultado = await crearCategoriaGasto(req.body && req.body.etiqueta);
    if (resultado.error) {
      return res.status(400).json({ error: resultado.error });
    }
    res.status(201).json({ ok: true, categoria: resultado, mensaje: 'Categoría creada.' });
  })
);

// Renombra una categoría — el slug interno NUNCA cambia, así que los
// gastos que ya la usan simplemente ven la nueva etiqueta.
app.put(
  '/api/admin/gastos/categorias/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }
    const resultado = await renombrarCategoriaGasto(id, req.body && req.body.etiqueta);
    if (resultado.error) {
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    res.json({ ok: true, categoria: resultado, mensaje: 'Categoría actualizada.' });
  })
);

// Con gastos asociados, solo se desactiva (deja de ofrecerse para altas
// nuevas); sin gastos, se borra de verdad. Nunca aplica a la protegida
// ("otro" — respaldo de toda la gráfica de categorías).
app.delete(
  '/api/admin/gastos/categorias/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }
    const resultado = await eliminarCategoriaGasto(id);
    if (resultado.error) {
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    res.json({
      ok: true,
      mensaje: resultado.desactivada
        ? 'Categoría desactivada (tiene gastos asociados, ya no se ofrece para nuevas altas).'
        : 'Categoría eliminada.',
    });
  })
);

// Contraparte de la desactivación de arriba — vuelve a ofrecer la
// categoría en el <select> de alta sin tocar el slug ni los gastos
// que ya la usan (mismo criterio de papelera+restaurar del resto de la app).
app.post(
  '/api/admin/gastos/categorias/:id/reactivar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }
    const resultado = await reactivarCategoriaGasto(id);
    if (resultado.error) {
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    res.json({ ok: true, mensaje: 'Categoría reactivada.' });
  })
);

// ---------------------------------------------------------------------
// Inventarios — segmento 2: CRUD backend + kardex (ver inventarios.md).
// Motor de existencias/concurrencia ya vive en utils/inventario.js
// (segmento 1); este bloque solo valida entrada HTTP y arma respuestas,
// mismo patrón que Gastos arriba. Auditoría de POST/PUT/DELETE es
// automática (middleware global de /api/admin más arriba, segmento 7).
// ---------------------------------------------------------------------

// D8/§0.6: con el switch apagado, el módulo completo responde
// INV_MODULO_INACTIVO — NUNCA se aplica a /configuracion (si no, nadie
// podría prender el switch desde ahí mismo).
async function requireInventarioActivo(req, res, next) {
  try {
    if (await inventarioActivo()) return next();
    return res.status(403).json({ error: 'INV_MODULO_INACTIVO', mensaje: 'El módulo de Inventarios no está activo para esta empresa.' });
  } catch (err) {
    next(err);
  }
}

async function obtenerAlmacenDefectoId() {
  const [filas] = await pool.query('SELECT id FROM almacenes WHERE codigo = ? LIMIT 1', [ALMACEN_DEFECTO_CODIGO]);
  return filas.length > 0 ? filas[0].id : null;
}

// ---------- Importador masivo CSV/XLSX (§34, segmento 5) ----------

function streamABuffer(stream) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    stream.on('data', (trozo) => trozos.push(trozo));
    stream.on('end', () => resolve(Buffer.concat(trozos)));
    stream.on('error', reject);
  });
}

function carpetaImportacion(id) {
  return `inventarios/imports/${id}`;
}

function nombreArchivoImportacion(formato) {
  return formato === 'xlsx' ? 'original.xlsx' : 'original.csv';
}

async function obtenerImportacionOResponder(id, res) {
  const importacionId = Number(id);
  if (!Number.isInteger(importacionId)) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return null;
  }
  const [filas] = await pool.query('SELECT * FROM imp_importaciones WHERE id = ? LIMIT 1', [importacionId]);
  if (filas.length === 0) {
    res.status(404).json({ error: 'Importación no encontrada.' });
    return null;
  }
  return filas[0];
}

function serializarImportacion(fila) {
  return {
    id: fila.id,
    formato: fila.formato,
    nombre_original: fila.nombre_original,
    hoja: fila.hoja,
    fila_encabezados: fila.fila_encabezados,
    encoding_usado: fila.encoding_usado,
    cabeceras: fila.cabeceras_json ? (typeof fila.cabeceras_json === 'string' ? JSON.parse(fila.cabeceras_json) : fila.cabeceras_json) : [],
    mapeo: fila.mapeo_json ? (typeof fila.mapeo_json === 'string' ? JSON.parse(fila.mapeo_json) : fila.mapeo_json) : null,
    modo_errores: fila.modo_errores,
    sobrescribir_vacios: Boolean(fila.sobrescribir_vacios),
    conservar_extra: Boolean(fila.conservar_extra),
    estado: fila.estado,
    total_filas: fila.total_filas,
    filas_ok: fila.filas_ok,
    filas_error: fila.filas_error,
    progreso: fila.progreso,
    productos_creados: fila.productos_creados,
    productos_actualizados: fila.productos_actualizados,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  };
}

// Relee el archivo original desde MinIO y lo vuelve a parsear con los MISMOS
// parámetros guardados (hoja, fila de encabezados) — el archivo archivado en
// §34.9 existe justo para esto ("auditoría y reprocesamiento"): ni el mapeo
// confirmado ni las filas validadas se duplican en MySQL, se reconstruyen
// bajo demanda cada vez que hacen falta (PUT /mapeo y POST /ejecutar).
async function releerArchivoImportacion(req, importacion) {
  const prefijo = storage.prefijoTenant(req);
  const { stream } = await storage.obtenerArchivo(prefijo, carpetaImportacion(importacion.id), nombreArchivoImportacion(importacion.formato));
  const buffer = await streamABuffer(stream);
  if (importacion.formato === 'xlsx') {
    return parsearArchivoXLSX(buffer, importacion.hoja);
  }
  return parsearArchivoCSV(buffer);
}

// ---------- Configuración (D8/D10, §0.6) — SIN requireInventarioActivo ----------

app.get(
  '/api/admin/inventarios/configuracion',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    res.json({ configuracion: await obtenerConfigInventario() });
  })
);

app.put(
  '/api/admin/inventarios/configuracion/:clave',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const { clave } = req.params;
    if (!CLAVES_CONFIG_INVENTARIO[clave]) {
      return res.status(400).json({ error: `Clave de configuración no reconocida: ${clave}.` });
    }
    const valor = req.body && typeof req.body.valor !== 'undefined' ? String(req.body.valor) : '';
    const resultado = await setValorConfig(clave, valor);
    if (resultado.error) {
      return res.status(400).json({ error: resultado.error });
    }
    res.json({ ok: true, ...resultado });
  })
);

// ---------- Diccionario de datos (§56, página de ayuda) — SIN
// requireInventarioActivo: sirve para entender el módulo ANTES de
// activarlo. No depende del tenant (mismo diccionario para todos), así
// que el cliente puede cachearlo sin invalidación especial. ----------

app.get(
  '/api/admin/inventarios/diccionario',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    res.json({ diccionario: obtenerDiccionarioInventario() });
  })
);

// ---------- Categorías ----------

app.get(
  '/api/admin/inventarios/categorias',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    res.json({ categorias: await listarCategoriasInventario() });
  })
);

app.post(
  '/api/admin/inventarios/categorias',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const resultado = await crearCategoriaInventario(req.body && req.body.nombre);
    if (resultado.error) {
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    res.status(201).json({ ok: true, categoria: resultado, mensaje: 'Categoría creada.' });
  })
);

app.put(
  '/api/admin/inventarios/categorias/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const resultado = await renombrarCategoriaInventario(id, req.body && req.body.nombre);
    if (resultado.error) {
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    res.json({ ok: true, categoria: resultado, mensaje: 'Categoría actualizada.' });
  })
);

app.delete(
  '/api/admin/inventarios/categorias/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const resultado = await eliminarCategoriaInventario(id);
    if (resultado.error) {
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    res.json({
      ok: true,
      mensaje: resultado.desactivada
        ? 'Categoría desactivada (tiene productos asociados, ya no se ofrece para nuevas altas).'
        : 'Categoría eliminada.',
    });
  })
);

app.post(
  '/api/admin/inventarios/categorias/:id/reactivar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const resultado = await reactivarCategoriaInventario(id);
    if (resultado.error) {
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    res.json({ ok: true, mensaje: 'Categoría reactivada.' });
  })
);

// ---------- Unidades de medida (§9) ----------

app.get(
  '/api/admin/inventarios/unidades',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query('SELECT id, nombre, abreviatura FROM unidades_medida ORDER BY nombre ASC');
    res.json({ unidades: filas });
  })
);

app.post(
  '/api/admin/inventarios/unidades',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const nombre = sanitizeText(req.body && req.body.nombre, 50);
    const abreviatura = sanitizeText(req.body && req.body.abreviatura, 10);
    if (!nombre || !abreviatura) {
      return res.status(400).json({ error: 'Nombre y abreviatura son obligatorios.' });
    }
    const [existente] = await pool.query('SELECT id FROM unidades_medida WHERE nombre = ? LIMIT 1', [nombre]);
    if (existente.length > 0) {
      return res.status(400).json({ error: 'Ya existe una unidad con ese nombre.' });
    }
    const [resultado] = await pool.query(
      'INSERT INTO unidades_medida (nombre, abreviatura, creado_en) VALUES (?, ?, ?)',
      [nombre, abreviatura, new Date()]
    );
    res.status(201).json({ ok: true, id: resultado.insertId, nombre, abreviatura });
  })
);

// ---------- Productos ----------

function formatearProducto(p, existenciaDisponible) {
  return {
    id: p.id,
    sku: p.sku,
    codigo_barras: p.codigo_barras,
    nombre: p.nombre,
    categoria_id: p.categoria_id,
    unidad_id: p.unidad_id,
    tipo: p.tipo,
    moneda: p.moneda || 'MXN',
    costo: p.costo === null ? null : Number(p.costo),
    costo_promedio: Number(p.costo_promedio),
    ultimo_costo: p.ultimo_costo === null ? null : Number(p.ultimo_costo),
    precio: p.precio === null ? null : Number(p.precio),
    stock_minimo: p.stock_minimo === null ? null : Number(p.stock_minimo),
    stock_maximo: p.stock_maximo === null ? null : Number(p.stock_maximo),
    punto_reorden: p.punto_reorden === null ? null : Number(p.punto_reorden),
    estado: p.estado,
    proveedor_principal: p.proveedor_principal,
    notas: p.notas,
    // Datos migrados por el importador masivo (§34.4) que todavía no tienen
    // campo formal — nunca participa en lógica de negocio, solo consulta.
    extra: p.extra ? (typeof p.extra === 'string' ? JSON.parse(p.extra) : p.extra) : null,
    creado_en: p.creado_en,
    actualizado_en: p.actualizado_en,
    disponible: existenciaDisponible === undefined || existenciaDisponible === null ? null : Number(existenciaDisponible),
  };
}

// Valida el cuerpo de crear/editar un producto y devuelve el objeto ya
// normalizado, o `null` tras responder con el error correspondiente —
// mismo patrón que validarCuerpoGasto() de arriba.
async function validarCuerpoProducto(req, res, idExcluir = null) {
  const body = req.body || {};

  const nombre = sanitizeText(body.nombre, 200);
  if (!nombre) {
    res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
    return null;
  }

  const sku = sanitizeText(body.sku, 60);
  if (!sku) {
    res.status(400).json({ error: 'El SKU es obligatorio.' });
    return null;
  }
  if (await skuEnUso(sku, idExcluir)) {
    res.status(400).json({ error: 'INV_SKU_DUPLICADO', mensaje: 'Ya existe un producto con ese SKU.' });
    return null;
  }

  const codigoBarras = sanitizeText(body.codigo_barras, 60) || null;
  if (codigoBarras && (await codigoBarrasEnUso(codigoBarras, idExcluir))) {
    res.status(400).json({ error: 'Ya existe un producto con ese código de barras.' });
    return null;
  }

  const tipo = body.tipo === 'servicio' ? 'servicio' : 'producto';
  const moneda = body.moneda === 'USD' ? 'USD' : 'MXN';

  const unidadId = Number(body.unidad_id);
  if (!Number.isInteger(unidadId) || !(await unidadExisteId(unidadId))) {
    res.status(400).json({ error: 'INV_UNIDAD_INVALIDA', mensaje: 'Selecciona una unidad de medida válida.' });
    return null;
  }

  let categoriaId = null;
  if (body.categoria_id !== undefined && body.categoria_id !== null && body.categoria_id !== '') {
    categoriaId = Number(body.categoria_id);
    if (!Number.isInteger(categoriaId)) {
      res.status(400).json({ error: 'Categoría inválida.' });
      return null;
    }
  }

  function numeroOpcional(valor) {
    if (valor === undefined || valor === null || valor === '') return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : NaN;
  }

  const costo = numeroOpcional(body.costo);
  const precio = numeroOpcional(body.precio);
  const stockMinimo = numeroOpcional(body.stock_minimo);
  const stockMaximo = numeroOpcional(body.stock_maximo);
  const puntoReorden = numeroOpcional(body.punto_reorden);
  if ([costo, precio, stockMinimo, stockMaximo, puntoReorden].some((v) => Number.isNaN(v))) {
    res.status(400).json({ error: 'Alguno de los campos numéricos no es válido.' });
    return null;
  }
  if ((costo !== null && costo < 0) || (precio !== null && precio < 0)) {
    res.status(400).json({ error: 'Costo y precio deben ser mayores o iguales a cero.' });
    return null;
  }

  const estado = ['activo', 'inactivo', 'archivado'].includes(body.estado) ? body.estado : 'activo';
  const proveedorPrincipal = sanitizeText(body.proveedor_principal, 200) || null;
  const notas = sanitizeTextoLibre(body.notas, 2000) || null;

  return {
    nombre,
    sku,
    codigoBarras,
    categoriaId,
    unidadId,
    tipo,
    moneda,
    costo,
    precio,
    stockMinimo,
    stockMaximo,
    puntoReorden,
    estado,
    proveedorPrincipal,
    notas,
  };
}

app.get(
  '/api/admin/inventarios/productos',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const verPapelera = req.query.papelera === 'true';
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const porPagina = Math.min(200, Math.max(5, Number(req.query.por_pagina) || 50));

    const condiciones = ['1=1'];
    const params = [];
    if (req.query.categoria_id && Number.isInteger(Number(req.query.categoria_id))) {
      condiciones.push('p.categoria_id = ?');
      params.push(Number(req.query.categoria_id));
    }
    if (['activo', 'inactivo', 'archivado'].includes(req.query.estado)) {
      condiciones.push('p.estado = ?');
      params.push(req.query.estado);
    }
    if (['producto', 'servicio'].includes(req.query.tipo)) {
      condiciones.push('p.tipo = ?');
      params.push(req.query.tipo);
    }
    const busqueda = typeof req.query.busqueda === 'string' ? req.query.busqueda.trim() : '';
    if (busqueda) {
      const patron = `%${busqueda}%`;
      condiciones.push('(p.nombre LIKE ? OR p.sku LIKE ? OR p.codigo_barras LIKE ?)');
      params.push(patron, patron, patron);
    }
    condiciones.push(verPapelera ? 'p.eliminado_en IS NOT NULL' : 'p.eliminado_en IS NULL');
    const where = condiciones.join(' AND ');

    const [contador] = await pool.query(`SELECT COUNT(*) AS total FROM productos p WHERE ${where}`, params);
    const total = Number(contador[0].total);

    const [filas] = await pool.query(
      `SELECT p.*, e.disponible AS disponible
         FROM productos p
         LEFT JOIN existencias e ON e.producto_id = p.id AND e.almacen_id = (SELECT id FROM almacenes WHERE codigo = ? LIMIT 1)
        WHERE ${where}
        ORDER BY p.nombre ASC
        LIMIT ? OFFSET ?`,
      [ALMACEN_DEFECTO_CODIGO, ...params, porPagina, (pagina - 1) * porPagina]
    );

    res.json({
      total,
      pagina,
      por_pagina: porPagina,
      productos: filas.map((p) => formatearProducto(p, p.disponible)),
    });
  })
);

app.post(
  '/api/admin/inventarios/productos',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const datos = await validarCuerpoProducto(req, res);
    if (!datos) return;

    const ahora = new Date();
    ahora.setMilliseconds(0);
    const [resultado] = await pool.query(
      `INSERT INTO productos
        (sku, codigo_barras, nombre, categoria_id, unidad_id, tipo, moneda, costo, precio,
         stock_minimo, stock_maximo, punto_reorden, estado, proveedor_principal, notas,
         creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.sku, datos.codigoBarras, datos.nombre, datos.categoriaId, datos.unidadId, datos.tipo, datos.moneda,
        datos.costo, datos.precio, datos.stockMinimo, datos.stockMaximo, datos.puntoReorden,
        datos.estado, datos.proveedorPrincipal, datos.notas, ahora, ahora,
      ]
    );

    res.status(201).json({ ok: true, id: resultado.insertId, mensaje: 'Producto creado correctamente.' });
  })
);

// D8/§22: autocompletado de producto en Ventas (nombre/SKU al escribir) +
// lectura por código de barras (escáner HID, coincidencia exacta). Debe
// registrarse ANTES de GET /productos/:id — si no, Express interpretaría
// "buscar" como si fuera un :id.
app.get(
  '/api/admin/inventarios/productos/buscar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const termino = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!termino || termino.length > 100) {
      return res.json({ productos: [] });
    }
    const almacenId = await obtenerAlmacenDefectoId();
    const patron = `%${termino}%`;
    const [filas] = await pool.query(
      `SELECT p.id, p.sku, p.nombre, p.codigo_barras, p.precio, p.tipo, e.disponible
         FROM productos p
         LEFT JOIN existencias e ON e.producto_id = p.id AND e.almacen_id = ?
        WHERE p.eliminado_en IS NULL AND p.estado = 'activo'
          AND (p.nombre LIKE ? OR p.sku LIKE ? OR p.codigo_barras = ?)
        ORDER BY p.nombre ASC
        LIMIT 15`,
      [almacenId, patron, patron, termino]
    );
    res.json({
      productos: filas.map((p) => ({
        id: p.id,
        sku: p.sku,
        nombre: p.nombre,
        codigo_barras: p.codigo_barras,
        precio: p.precio === null ? null : Number(p.precio),
        tipo: p.tipo,
        disponible: p.disponible === null ? 0 : Number(p.disponible),
      })),
    });
  })
);

app.get(
  '/api/admin/inventarios/productos/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const producto = await obtenerProductoPorId(id);
    if (!producto) return res.status(404).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado.' });
    const almacenId = await obtenerAlmacenDefectoId();
    const [[existencia]] = await pool.query('SELECT disponible FROM existencias WHERE producto_id = ? AND almacen_id = ?', [
      id,
      almacenId,
    ]);
    res.json({ producto: formatearProducto(producto, existencia ? existencia.disponible : 0) });
  })
);

app.put(
  '/api/admin/inventarios/productos/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const existente = await obtenerProductoPorId(id);
    if (!existente) return res.status(404).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado.' });

    const datos = await validarCuerpoProducto(req, res, id);
    if (!datos) return;

    // costo_promedio / ultimo_costo NUNCA se editan desde este endpoint
    // (D5) — solo registrarMovimiento() los mantiene, al procesar una
    // entrada real.
    const ahora = new Date();
    ahora.setMilliseconds(0);
    await pool.query(
      `UPDATE productos SET sku = ?, codigo_barras = ?, nombre = ?, categoria_id = ?, unidad_id = ?, tipo = ?, moneda = ?,
         costo = ?, precio = ?, stock_minimo = ?, stock_maximo = ?, punto_reorden = ?, estado = ?,
         proveedor_principal = ?, notas = ?, actualizado_en = ?
       WHERE id = ?`,
      [
        datos.sku, datos.codigoBarras, datos.nombre, datos.categoriaId, datos.unidadId, datos.tipo, datos.moneda,
        datos.costo, datos.precio, datos.stockMinimo, datos.stockMaximo, datos.puntoReorden,
        datos.estado, datos.proveedorPrincipal, datos.notas, ahora, id,
      ]
    );

    res.json({ ok: true, mensaje: 'Producto actualizado correctamente.' });
  })
);

// Borrado lógico: manda el producto a la papelera. No toca existencias
// ni movimientos — se puede restaurar después (§38).
app.delete(
  '/api/admin/inventarios/productos/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const existente = await obtenerProductoPorId(id);
    if (!existente) return res.status(404).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado.' });

    const ahora = new Date();
    ahora.setMilliseconds(0);
    await pool.query('UPDATE productos SET eliminado_en = ?, actualizado_en = ? WHERE id = ?', [ahora, ahora, id]);
    res.json({ ok: true, mensaje: 'Producto movido a la papelera.' });
  })
);

app.post(
  '/api/admin/inventarios/productos/:id/restaurar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const [filas] = await pool.query('SELECT id FROM productos WHERE id = ? AND eliminado_en IS NOT NULL', [id]);
    if (!filas[0]) return res.status(404).json({ error: 'Producto no encontrado en la papelera.' });

    const ahora = new Date();
    ahora.setMilliseconds(0);
    await pool.query('UPDATE productos SET eliminado_en = NULL, actualizado_en = ? WHERE id = ?', [ahora, id]);
    res.json({ ok: true, mensaje: 'Producto restaurado.' });
  })
);

// §38: solo se permite el borrado físico si el producto NUNCA tuvo
// movimientos — con historial, se queda en papelera para siempre.
app.delete(
  '/api/admin/inventarios/productos/:id/permanente',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const [filas] = await pool.query('SELECT id FROM productos WHERE id = ? AND eliminado_en IS NOT NULL', [id]);
    if (!filas[0]) return res.status(404).json({ error: 'Producto no encontrado en la papelera.' });

    if (await productoTieneMovimientos(id)) {
      return res.status(400).json({
        error: 'INV_PRODUCTO_CON_HISTORIAL',
        mensaje: 'Este producto tiene movimientos registrados y no puede eliminarse de forma permanente (§38).',
      });
    }

    await pool.query('DELETE FROM existencias WHERE producto_id = ?', [id]);
    await pool.query('DELETE FROM productos WHERE id = ?', [id]);
    res.json({ ok: true, mensaje: 'Producto eliminado permanentemente.' });
  })
);

// §57: tipo de cambio USD/MXN del día, para precargar (editable) el campo
// de conversión al registrar un producto o una entrada en USD. Nunca
// falla con 5xx por el proveedor externo caído — degrada a
// `fuente: 'manual_requerido'`/`'banxico_caducado'` y el frontend pide
// captura manual.
app.get(
  '/api/admin/tipo-cambio/usd',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const resultado = await obtenerTipoCambioUSD();
    res.json(resultado);
  })
);

// ---------- Movimientos: entradas / salidas ----------

async function manejarMovimiento(req, res, tiposPermitidos) {
  const body = req.body || {};
  const productoId = Number(body.producto_id);
  const tipo = String(body.tipo || '');
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({ error: 'INV_TIPO_INVALIDO', mensaje: `Tipo de movimiento no permitido en esta ruta: ${tipo}.` });
  }
  const almacenId = await obtenerAlmacenDefectoId();
  const idempotencyKey = req.get('Idempotency-Key') || null;

  const resultado = await registrarMovimiento({
    productoId,
    almacenId,
    tipo,
    cantidad: body.cantidad,
    costoUnitario: body.costo_unitario,
    // §57: entrada de un producto en USD — costo en la moneda original +
    // tipo de cambio aplicado, ambos opcionales (solo aplican si el
    // producto está marcado en USD y esto es una entrada con costo).
    costoOriginal: body.costo_original,
    tipoCambio: body.tipo_cambio,
    motivo: body.motivo,
    notas: body.notas,
    ubicacionNota: body.ubicacion_nota,
    usuario: req.adminUser,
    idempotencyKey,
  });

  if (resultado.error) {
    const mapaEstatus = {
      INV_TIPO_INVALIDO: 400,
      INV_CANTIDAD_INVALIDA: 400,
      INV_PRODUCTO_NO_ENCONTRADO: 404,
      INV_PRODUCTO_SERVICIO: 400,
      INV_ALMACEN_NO_ENCONTRADO: 404,
      INV_STOCK_INSUFICIENTE: 409,
      INV_CONCURRENCIA: 409,
      INV_TIPO_CAMBIO_INVALIDO: 400,
    };
    return res.status(mapaEstatus[resultado.error] || 400).json(resultado);
  }

  res.status(201).json({ ok: true, ...resultado });
}

// Entradas manuales: compra, devolución de cliente, inventario inicial,
// ajuste positivo (P4 cerrada). §0.3:5.
app.post(
  '/api/admin/inventarios/entradas',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    await manejarMovimiento(req, res, TIPOS_ENTRADA);
  })
);

// Salidas manuales: consumo interno, merma, ajuste negativo. "venta" NO
// se acepta aquí — esa salida la genera el flujo de Ventas con
// inventario activo (D8, segmento 4), nunca a mano, para no romper la
// trazabilidad con la orden de compra origen.
app.post(
  '/api/admin/inventarios/salidas',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    await manejarMovimiento(req, res, ['consumo_interno', 'merma', 'ajuste_negativo']);
  })
);

// ---------- Kardex y existencias ----------

app.get(
  '/api/admin/inventarios/kardex',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const productoId = Number(req.query.producto_id);
    if (!Number.isInteger(productoId)) {
      return res.status(400).json({ error: 'Indica producto_id.' });
    }
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const porPagina = Math.min(200, Math.max(10, Number(req.query.por_pagina) || 50));

    const condiciones = ['producto_id = ?'];
    const params = [productoId];
    if (typeof req.query.tipo === 'string' && req.query.tipo) {
      condiciones.push('tipo = ?');
      params.push(req.query.tipo);
    }
    const where = condiciones.join(' AND ');

    const [contador] = await pool.query(`SELECT COUNT(*) AS total FROM movimientos_inventario WHERE ${where}`, params);
    const [filas] = await pool.query(
      `SELECT * FROM movimientos_inventario WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, porPagina, (pagina - 1) * porPagina]
    );

    res.json({
      total: Number(contador[0].total),
      pagina,
      por_pagina: porPagina,
      movimientos: filas.map((m) => ({
        ...m,
        cantidad: Number(m.cantidad),
        costo_unitario: m.costo_unitario === null ? null : Number(m.costo_unitario),
        existencia_anterior: Number(m.existencia_anterior),
        existencia_posterior: Number(m.existencia_posterior),
        tipo_cambio: m.tipo_cambio === null ? null : Number(m.tipo_cambio),
        costo_original: m.costo_original === null ? null : Number(m.costo_original),
      })),
    });
  })
);

app.get(
  '/api/admin/inventarios/existencias',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      `SELECT e.producto_id, e.almacen_id, e.disponible, p.sku, p.nombre, a.codigo AS almacen_codigo
         FROM existencias e
         JOIN productos p ON p.id = e.producto_id AND p.eliminado_en IS NULL
         JOIN almacenes a ON a.id = e.almacen_id
        WHERE e.eliminado_en IS NULL
        ORDER BY p.nombre ASC`
    );
    res.json({ existencias: filas.map((f) => ({ ...f, disponible: Number(f.disponible) })) });
  })
);

app.get(
  '/api/admin/inventarios/verificar-integridad',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const divergencias = await conciliarInventario();
    res.json({ ok: divergencias.length === 0, divergencias });
  })
);

// ---------- Dashboard (§4/§0.3:10 — solo KPIs respaldados por datos v1) ----------

app.get(
  '/api/admin/inventarios/dashboard',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const [[valorInventario]] = await pool.query(`
      SELECT COALESCE(SUM(e.disponible * p.costo_promedio), 0) AS valor
        FROM existencias e
        JOIN productos p ON p.id = e.producto_id
       WHERE p.eliminado_en IS NULL AND p.tipo = 'producto'
    `);
    const [[productosActivos]] = await pool.query(
      "SELECT COUNT(*) AS total FROM productos WHERE eliminado_en IS NULL AND estado = 'activo'"
    );
    const [[unidadesDisponibles]] = await pool.query(`
      SELECT COALESCE(SUM(e.disponible), 0) AS total
        FROM existencias e
        JOIN productos p ON p.id = e.producto_id
       WHERE p.eliminado_en IS NULL AND p.tipo = 'producto'
    `);
    const [[bajoMinimo]] = await pool.query(`
      SELECT COUNT(*) AS total
        FROM productos p
        JOIN existencias e ON e.producto_id = p.id
       WHERE p.eliminado_en IS NULL AND p.tipo = 'producto' AND p.stock_minimo IS NOT NULL
         AND e.disponible < p.stock_minimo
    `);
    const [[sinExistencia]] = await pool.query(`
      SELECT COUNT(*) AS total
        FROM productos p
        JOIN existencias e ON e.producto_id = p.id
       WHERE p.eliminado_en IS NULL AND p.tipo = 'producto' AND e.disponible = 0
    `);
    const [[sinMovimiento]] = await pool.query(`
      SELECT COUNT(*) AS total
        FROM productos p
       WHERE p.eliminado_en IS NULL AND p.tipo = 'producto'
         AND NOT EXISTS (SELECT 1 FROM movimientos_inventario m WHERE m.producto_id = p.id)
    `);
    const [[mermasPeriodo]] = await pool.query(`
      SELECT COALESCE(SUM(m.cantidad * COALESCE(m.costo_unitario, p.costo_promedio)), 0) AS valor,
             COUNT(*) AS cantidad
        FROM movimientos_inventario m
        JOIN productos p ON p.id = m.producto_id
       WHERE m.tipo = 'merma' AND m.creado_en >= DATE_FORMAT(NOW(), '%Y-%m-01')
    `);

    res.json({
      valor_total_inventario: Number(valorInventario.valor),
      productos_activos: Number(productosActivos.total),
      unidades_disponibles: Number(unidadesDisponibles.total),
      productos_bajo_minimo: Number(bajoMinimo.total),
      productos_sin_existencia: Number(sinExistencia.total),
      productos_sin_movimiento: Number(sinMovimiento.total),
      mermas_periodo_valor: Number(mermasPeriodo.valor),
      mermas_periodo_cantidad: Number(mermasPeriodo.cantidad),
    });
  })
);

// ---------- Importador masivo — plantilla y perfiles de mapeo (§34.3.2/34.3.4) ----------

app.get(
  '/api/admin/inventarios/importaciones/plantilla.csv',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-inventarios.csv"');
    res.send(generarPlantillaCSV());
  })
);

app.get(
  '/api/admin/inventarios/importaciones/plantilla.xlsx',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const buffer = await generarPlantillaXLSX();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-inventarios.xlsx"');
    res.send(Buffer.from(buffer));
  })
);

app.get(
  '/api/admin/inventarios/perfiles-mapeo',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    res.json({ perfiles: await listarPerfilesMapeo() });
  })
);

app.delete(
  '/api/admin/inventarios/perfiles-mapeo/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const eliminado = await eliminarPerfilMapeo(id);
    if (!eliminado) return res.status(404).json({ error: 'Perfil no encontrado.' });
    res.json({ ok: true, mensaje: 'Perfil de mapeo eliminado.' });
  })
);

// ---------- Importador masivo — subir, mapear, validar, ejecutar (§34) ----------

// Sube el archivo, lo parsea y sugiere el mapeo (34.3.1: perfil guardado →
// preset → exacto → sinónimo → difuso). No importa nada todavía — el
// resultado es solo la vista previa del paso 3 del wizard.
app.post(
  '/api/admin/inventarios/importaciones',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  (req, res) => {
    subirConTenant(uploadImportacion, 'archivo', req, res, async (err) => {
      try {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `El archivo excede el tamaño máximo permitido de ${MAX_FILE_SIZE_MB} MB.` });
          }
          if (err.message === 'TIPO_NO_PERMITIDO') {
            return res.status(400).json({ error: 'Solo se acepta un archivo CSV o XLSX.' });
          }
          console.error('Error al subir el archivo de importación:', err);
          return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
        }
        if (!req.file) return res.status(400).json({ error: 'Debes adjuntar un archivo.' });

        // Solo una importación EJECUTÁNDOSE a la vez por tenant (§34.9) — el
        // riesgo real de concurrencia está en la fase de escritura masiva,
        // no en subir/previsualizar un archivo nuevo mientras otro sigue en
        // borrador sin ejecutar.
        const [enCurso] = await pool.query("SELECT id FROM imp_importaciones WHERE estado = 'ejecutando' LIMIT 1");
        if (enCurso.length > 0) {
          return res.status(409).json({ error: 'INV_IMPORTACION_EN_CURSO', mensaje: 'Ya hay una importación ejecutándose; espera a que termine antes de iniciar otra.' });
        }

        const maxMb = Number(await obtenerValorConfig('inv_import_max_mb'));
        if (req.file.buffer.length > maxMb * 1024 * 1024) {
          return res.status(413).json({ error: `El archivo excede el límite configurado de ${maxMb} MB.` });
        }

        const ext = path.extname(req.file.originalname || '').toLowerCase();
        let formato;
        if (ext === '.xlsx') {
          if (!esZipValido(req.file.buffer)) {
            return res.status(400).json({ error: 'El contenido del archivo no es un XLSX válido.' });
          }
          formato = 'xlsx';
        } else if (ext === '.csv') {
          if (!esCSVValido(req.file.buffer)) {
            return res.status(400).json({ error: 'El contenido del archivo no es un CSV de texto válido.' });
          }
          formato = 'csv';
        } else {
          return res.status(400).json({ error: 'Solo se acepta un archivo CSV o XLSX.' });
        }

        let hojas = null;
        let hojaElegida = req.body && req.body.hoja ? String(req.body.hoja) : null;
        let parseado;
        if (formato === 'xlsx') {
          hojas = await listarHojasXLSX(req.file.buffer);
          if (!hojaElegida || !hojas.includes(hojaElegida)) hojaElegida = hojas[0] || null;
          parseado = await parsearArchivoXLSX(req.file.buffer, hojaElegida);
        } else {
          parseado = parsearArchivoCSV(req.file.buffer);
        }

        if (!parseado.cabeceras || parseado.cabeceras.length === 0) {
          return res.status(400).json({ error: 'El archivo no tiene cabeceras reconocibles.' });
        }

        const maxFilas = Number(await obtenerValorConfig('inv_import_max_filas'));
        if (parseado.filas.length > maxFilas) {
          return res.status(413).json({ error: `El archivo trae ${parseado.filas.length} filas, más del límite configurado de ${maxFilas}.` });
        }

        const cabecerasLimpias = parseado.cabeceras.map((c) => sanitizeText(String(c || ''), 150));
        const presetSistema = req.body && req.body.preset_sistema ? String(req.body.preset_sistema) : 'otro';
        const perfilEncontrado = await buscarPerfilParaCabeceras(cabecerasLimpias);
        const { mapeo, columnasSinMapear } = sugerirMapeoCompleto(cabecerasLimpias, {
          presetSistema,
          perfilMapeo: perfilEncontrado ? perfilEncontrado.mapeoAplicable : null,
        });

        const ahora = new Date();
        const [insercion] = await pool.query(
          `INSERT INTO imp_importaciones
            (formato, nombre_original, hoja, fila_encabezados, encoding_usado, delimitador, cabeceras_json,
             estado, total_filas, usuario, ip, creado_en, actualizado_en)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            formato, sanitizeText(req.file.originalname || 'archivo', 255), hojaElegida, parseado.filaEncabezados,
            parseado.encoding || null, parseado.delimitador || null, JSON.stringify(cabecerasLimpias),
            'validando', parseado.filas.length, req.adminUser || null, req.ip || null, ahora, ahora,
          ]
        );
        const importacionId = insercion.insertId;

        const storageKey = await storage.guardarArchivo(
          storage.prefijoTenant(req),
          carpetaImportacion(importacionId),
          nombreArchivoImportacion(formato),
          req.file.buffer,
          formato === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
        );
        await pool.query('UPDATE imp_importaciones SET storage_key = ? WHERE id = ?', [storageKey, importacionId]);

        res.status(201).json({
          ok: true,
          importacionId,
          formato,
          hojas,
          hojaSeleccionada: hojaElegida,
          cabeceras: cabecerasLimpias,
          vistaPrevia: parseado.filas.slice(0, 5),
          totalFilas: parseado.filas.length,
          presetSistema,
          perfilAplicado: perfilEncontrado ? { perfilId: perfilEncontrado.perfilId, nombre: perfilEncontrado.nombre, coincidenciaCompleta: perfilEncontrado.coincidenciaCompleta } : null,
          mapeoSugerido: mapeo,
          columnasSinMapear,
        });
      } catch (errInterno) {
        console.error('Error al procesar la importación:', errInterno);
        res.status(500).json({ error: 'No se pudo procesar el archivo de importación.' });
      }
    });
  }
);

app.get(
  '/api/admin/inventarios/importaciones/:id',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const importacion = await obtenerImportacionOResponder(req.params.id, res);
    if (!importacion) return;
    res.json(serializarImportacion(importacion));
  })
);

// Paso 3→4 del wizard: recibe el mapeo final confirmado por el usuario y
// corre la validación completa (§34.5) ANTES de importar nada. Puede
// llamarse varias veces mientras la importación siga en 'validando'/
// 'validado'/'error_validacion' (el usuario ajusta el mapeo y revalida).
app.put(
  '/api/admin/inventarios/importaciones/:id/mapeo',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const importacion = await obtenerImportacionOResponder(req.params.id, res);
    if (!importacion) return;
    if (importacion.estado === 'ejecutando' || importacion.estado === 'completada') {
      return res.status(409).json({ error: 'Esta importación ya se ejecutó y no admite remapeo.' });
    }

    const body = req.body || {};
    const mapeoFinal = body.mapeo && typeof body.mapeo === 'object' ? body.mapeo : {};
    if (mapeoFinal.sku === undefined || mapeoFinal.sku === null || mapeoFinal.nombre === undefined || mapeoFinal.nombre === null) {
      return res.status(400).json({ error: 'Debes mapear al menos las columnas "sku" y "nombre".' });
    }
    const modo = body.modo === 'estricto' ? 'estricto' : 'tolerante';
    const sobrescribirVacios = Boolean(body.sobrescribirVacios);
    const conservarExtra = body.conservarExtra !== false;

    const cabecerasOriginales = importacion.cabeceras_json
      ? (typeof importacion.cabeceras_json === 'string' ? JSON.parse(importacion.cabeceras_json) : importacion.cabeceras_json)
      : [];
    const { filas: filasCrudas } = await releerArchivoImportacion(req, importacion);

    const resultado = await validarFilasImportacion(cabecerasOriginales, filasCrudas, { mapeoFinal, modo, conservarExtra });

    await pool.query('DELETE FROM imp_importacion_errores WHERE importacion_id = ?', [importacion.id]);
    if (resultado.errores.length > 0) {
      const ahora = new Date();
      await pool.query(
        'INSERT INTO imp_importacion_errores (importacion_id, fila, columna, valor, motivo, creado_en) VALUES ?',
        [resultado.errores.slice(0, 5000).map((e) => [importacion.id, e.fila, e.columna || null, e.valor === undefined ? null : String(e.valor).slice(0, 500), e.motivo, ahora])]
      );
    }

    const nuevoEstado = resultado.abortado ? 'error_validacion' : 'validado';
    await pool.query(
      `UPDATE imp_importaciones SET mapeo_json = ?, modo_errores = ?, sobrescribir_vacios = ?, conservar_extra = ?,
         estado = ?, filas_ok = ?, filas_error = ?, actualizado_en = ? WHERE id = ?`,
      [JSON.stringify(mapeoFinal), modo, sobrescribirVacios ? 1 : 0, conservarExtra ? 1 : 0, nuevoEstado, resultado.filasOk, resultado.filasError, new Date(), importacion.id]
    );

    if (body.guardarPerfil) {
      const perfil = await crearPerfilMapeo({
        nombre: body.nombrePerfil || importacion.nombre_original,
        cabecerasOriginales,
        mapeoFinal,
        creadoPor: req.adminUser,
      });
      res.locals.perfilGuardado = perfil;
    }

    // Confirmación explícita antes de ejecutar (§34.2: "Se importarán X
    // productos nuevos y se actualizarán Y existentes") — estimado contra
    // el catálogo actual; puede desactualizarse si otra sesión da de alta
    // el mismo SKU entre este cálculo y el ejecutar real, sin consecuencia
    // real porque el upsert de ejecutarFilasImportacion() decide de nuevo
    // en ese momento, esto es solo texto informativo para el usuario.
    let productosNuevosEstimado = resultado.filasValidas.length;
    let productosActualizarEstimado = 0;
    if (resultado.filasValidas.length > 0) {
      const skus = resultado.filasValidas.map((f) => f.sku);
      const [existentes] = await pool.query('SELECT COUNT(*) AS total FROM productos WHERE sku IN (?)', [skus]);
      productosActualizarEstimado = existentes[0].total;
      productosNuevosEstimado = resultado.filasValidas.length - productosActualizarEstimado;
    }

    res.json({
      ok: !resultado.abortado,
      estado: nuevoEstado,
      totalFilas: resultado.totalFilas,
      filasOk: resultado.filasOk,
      filasError: resultado.filasError,
      abortado: resultado.abortado,
      motivoAborto: resultado.motivoAborto,
      erroresPreview: resultado.errores.slice(0, 50),
      perfilGuardado: res.locals.perfilGuardado || null,
      productosNuevosEstimado,
      productosActualizarEstimado,
    });
  })
);

app.get(
  '/api/admin/inventarios/importaciones/:id/errores.csv',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const importacion = await obtenerImportacionOResponder(req.params.id, res);
    if (!importacion) return;
    const [errores] = await pool.query(
      'SELECT fila, columna, valor, motivo FROM imp_importacion_errores WHERE importacion_id = ? ORDER BY fila ASC',
      [importacion.id]
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="errores-importacion-${importacion.id}.csv"`);
    res.send(generarCSVErrores(errores));
  })
);

// Paso 5 del wizard: importa de verdad. ≤500 filas corre síncrono dentro de
// esta petición (§34.8); más de eso responde 202 de inmediato y sigue en
// segundo plano — el cliente hace polling de GET /importaciones/:id cada
// 2s. Reintentar sobre una importación 'completada' es no-op (§34.9).
app.post(
  '/api/admin/inventarios/importaciones/:id/ejecutar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const importacion = await obtenerImportacionOResponder(req.params.id, res);
    if (!importacion) return;

    if (importacion.estado === 'completada') {
      return res.json({
        ok: true,
        estado: 'completada',
        mensaje: 'Esta importación ya se ejecutó — no se vuelve a correr (idempotencia).',
        productos_creados: importacion.productos_creados,
        productos_actualizados: importacion.productos_actualizados,
      });
    }
    if (importacion.estado === 'ejecutando') {
      return res.status(202).json({ ok: true, estado: 'ejecutando', progreso: importacion.progreso });
    }
    if (importacion.estado !== 'validado') {
      return res.status(400).json({ error: 'Debes completar el mapeo y la validación (sin abortar) antes de ejecutar.' });
    }

    const idempotencyKey = req.get('Idempotency-Key') || null;
    const mapeoFinal = typeof importacion.mapeo_json === 'string' ? JSON.parse(importacion.mapeo_json) : importacion.mapeo_json;
    const cabecerasOriginales = typeof importacion.cabeceras_json === 'string' ? JSON.parse(importacion.cabeceras_json) : importacion.cabeceras_json;
    const { filas: filasCrudas } = await releerArchivoImportacion(req, importacion);
    const resultadoValidacion = await validarFilasImportacion(cabecerasOriginales, filasCrudas, {
      mapeoFinal,
      modo: importacion.modo_errores,
      conservarExtra: Boolean(importacion.conservar_extra),
    });

    const almacenId = await obtenerAlmacenDefectoId();
    const opcionesEjecucion = { almacenId, usuario: req.adminUser, sobrescribirVacios: Boolean(importacion.sobrescribir_vacios) };

    if (resultadoValidacion.filasValidas.length <= TAMANO_CHUNK) {
      await pool.query("UPDATE imp_importaciones SET estado = 'ejecutando', idempotency_key = ?, actualizado_en = ? WHERE id = ?", [idempotencyKey, new Date(), importacion.id]);
      const resultadoEjecucion = await ejecutarFilasImportacion(importacion.id, resultadoValidacion.filasValidas, opcionesEjecucion);
      if (resultadoEjecucion.erroresEjecucion.length > 0) {
        const ahora = new Date();
        await pool.query(
          'INSERT INTO imp_importacion_errores (importacion_id, fila, columna, valor, motivo, creado_en) VALUES ?',
          [resultadoEjecucion.erroresEjecucion.map((e) => [importacion.id, e.fila, e.columna, e.valor, e.motivo, ahora])]
        );
      }
      await pool.query(
        "UPDATE imp_importaciones SET estado = 'completada', progreso = 100, productos_creados = ?, productos_actualizados = ?, actualizado_en = ? WHERE id = ?",
        [resultadoEjecucion.creados, resultadoEjecucion.actualizados, new Date(), importacion.id]
      );
      return res.json({
        ok: true,
        estado: 'completada',
        productos_creados: resultadoEjecucion.creados,
        productos_actualizados: resultadoEjecucion.actualizados,
        existencias_iniciales_ignoradas: resultadoEjecucion.ignorados,
        errores_ejecucion: resultadoEjecucion.erroresEjecucion.length,
      });
    }

    // > 500 filas: job en segundo plano (§34.8) — se responde de inmediato y
    // se procesa fuera del ciclo request/response, re-entrando al contexto
    // del tenant a mano (mismo motivo que subirConTenant: el ALS no se
    // propaga de forma confiable fuera del callback original de la request).
    await pool.query("UPDATE imp_importaciones SET estado = 'ejecutando', idempotency_key = ?, progreso = 0, actualizado_en = ? WHERE id = ?", [idempotencyKey, new Date(), importacion.id]);
    res.status(202).json({ ok: true, estado: 'ejecutando', totalFilas: resultadoValidacion.filasValidas.length });

    const idImportacion = importacion.id;
    const filasParaProcesar = resultadoValidacion.filasValidas;
    reanudarContextoTenant(req, async () => {
      try {
        const resultadoEjecucion = await ejecutarFilasImportacion(idImportacion, filasParaProcesar, opcionesEjecucion);
        if (resultadoEjecucion.erroresEjecucion.length > 0) {
          const ahora = new Date();
          await pool.query(
            'INSERT INTO imp_importacion_errores (importacion_id, fila, columna, valor, motivo, creado_en) VALUES ?',
            [resultadoEjecucion.erroresEjecucion.map((e) => [idImportacion, e.fila, e.columna, e.valor, e.motivo, ahora])]
          );
        }
        await pool.query(
          "UPDATE imp_importaciones SET estado = 'completada', progreso = 100, productos_creados = ?, productos_actualizados = ?, actualizado_en = ? WHERE id = ?",
          [resultadoEjecucion.creados, resultadoEjecucion.actualizados, new Date(), idImportacion]
        );
      } catch (errFondo) {
        console.error(`Error ejecutando importación #${idImportacion} en segundo plano:`, errFondo);
        await pool.query("UPDATE imp_importaciones SET estado = 'error', actualizado_en = ? WHERE id = ?", [new Date(), idImportacion]).catch(() => {});
      }
    }).catch((errFondo) => {
      console.error(`Error inesperado al reanudar el contexto de tenant para la importación #${idImportacion}:`, errFondo);
    });
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
