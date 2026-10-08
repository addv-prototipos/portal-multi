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
const bwipjs = require('bwip-js');

const { swaggerSpec } = require('./utils/swagger');
const swaggerUi = require('swagger-ui-express');
const { pool, ensureSchema, cerrarTodosLosPoolsTenant, ejecutarComoTenant, obtenerPoolControl, obtenerPoolTenant, cerrarPoolTenant, crearBaseDeDatosTenant, eliminarBaseDeDatosTenant } = require('./db');
const { ejecutarCierresMensualesParaTodos } = require('./utils/cierreMensual');
const { resolverTenantMiddleware, resolverTenantPorSlug, invalidarCacheTenant, portalClientesEfectivo } = require('./utils/tenantContext');
const { requiereFeature } = require('./utils/requiereFeature');
const { validarSlug, nombreDbTenant } = require('./utils/tenant');
const storage = require('./utils/storage');
const {
  parsearTemaDesdeFila,
  temaAVariables,
  fuentesAUrlGoogle,
  normalizarTema,
} = require('./utils/tenantTema');
const {
  MARCA_DEFECTO,
  escapeHtmlCorreo,
  formatearParrafosCuerpo,
  logoTicketHtml,
  filaCorreoTabla,
  construirCorreoBase,
} = require('./utils/correoMarca');
const { requireAdminAuth, requireAdminArea, recargarAdminUsers } = require('./utils/auth');
const { asegurarTablaAuditoria, registrarAccesoAdmin, listarAuditoria } = require('./utils/adminAuditoria');
const {
  hashPassword,
  verifyPassword,
  validarPassword,
  generarTokenRecuperacion,
  hashTokenRecuperacion,
  requireUserAuth,
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
  resetearPlantillaTicket,
  obtenerDiasMaximoAvisoExpiracion,
  formatearFechaHoraMexico,
  METODOS_PAGO_VENTA,
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
  extraerTotalFacturaDeZip,
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
const {
  sembrarCatalogoEjemploSiVacio: sembrarCatalogoClaveProdServSiVacio,
  buscarClaveProdServ,
  getInfoCatalogoClaveProdServ,
  sincronizarDesdeOrigen: sincronizarClaveProdServDesdeOrigen,
} = require('./utils/claveProdServ');
const {
  getConfigSmtp,
  setConfigSmtp,
  configSmtpParaMostrar,
  enviarCorreo,
  aplicarPlantilla,
  DEFAULTS_SMTP,
  marcarSmtpVerificado,
  verificarConexionSmtp,
} = require('./utils/email');
const {
  ejecutarLimpiezaParaTodos,
  getInfoUltimaLimpieza,
  ordenAItemReporte,
  CLAVE_ULTIMA_LIMPIEZA_TICKETS,
  CLAVE_ULTIMA_LIMPIEZA_ORDENES,
} = require('./utils/ticketsCleanup');
const { generarYEnviarReporte, generarContenidoMD, guardarReporte, generarCSV, generarExcelBuffer } = require('./utils/reportes');
const {
  categoriaGastoExiste,
  listarCategoriasGastos,
  crearCategoriaGasto,
  renombrarCategoriaGasto,
  eliminarCategoriaGasto,
  reactivarCategoriaGasto,
  mapaTipoPorCategoria,
  actualizarTipoCategoriaGasto,
} = require('./utils/gastos');
const {
  TIPOS_ENTRADA,
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
  obtenerUnidadServicioId,
  obtenerNombreUnidadPorId,
  UNIDADES_SERVICIO_VALIDAS,
  productoTieneMovimientos,
  ALMACEN_DEFECTO_CODIGO,
} = require('./utils/inventario');
const { obtenerTipoCambioUSD } = require('./utils/tipoCambio');
const { limitesDia, limitesMes, medianocheLocal, cadenaFecha } = require('./utils/limitesPeriodo');
const { obtenerImagenMaxMbCacheado, IMAGEN_MAX_MB_MAX } = require('./utils/ajustesGlobales');
const {
  obtenerConfigInventario,
  obtenerValorConfig,
  inventarioActivo,
  soloServiciosActivo,
  setValorConfig,
  CLAVES: CLAVES_CONFIG_INVENTARIO,
} = require('./utils/inventarioConfig');
const {
  sugerirMapeoCompleto,
  parsearArchivoCSV,
  listarHojasXLSX,
  parsearArchivoXLSX,
  validarFilasImportacion,
  ejecutarFilasImportacion,
  listarPerfilesMapeo,
  crearPerfilMapeo,
  eliminarPerfilMapeo,
  buscarPerfilParaCabeceras,
  generarPlantillaCSV,
  generarPlantillaXLSX,
  generarCSVErrores,
  TAMANO_CHUNK,
} = require('./utils/inventarioImportacion');
const { obtenerDiccionarioInventario } = require('./utils/inventarioCampos');
const {
  ErrorImagenProducto,
  guardarImagenProducto,
  eliminarImagenProducto,
} = require('./utils/inventarioImagen');

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
// Auditoría 2026-09-03 (hallazgo #9): el default anterior era '*', que
// combinado con `credentials: true` es una configuración que los
// navegadores ya rechazan por spec (no explotable hoy) pero es frágil —
// si alguna vez CORS_ORIGIN se define con un valor no estándar, deja de
// haber ningún respaldo. Sin CORS_ORIGIN, ahora el default es `false`
// (cors deshabilitado del todo), que es lo correcto para el despliegue
// normal: nginx sirve frontend y backend bajo el mismo origen, así que
// CORS no debería aplicar nunca salvo que se consuma la API desde un
// dominio externo a propósito.
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || false;

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
// El valor es un NÚMERO de saltos confiados (nunca `true`, que confía en
// TODA la cadena de proxies sin límite y le permite a cualquiera mandar su
// propio X-Forwarded-For falso y hacerse pasar por otra IP —
// express-rate-limit, ver adminApiLimiter/adminLoginLimiter/submitLimiter/
// authLimiter más abajo, todos limitan por IP, lo señala explícitamente
// como hueco real: con `true`, alguien evade el límite de fuerza bruta del
// login solo cambiando ese encabezado en cada intento). El número exacto
// depende de la topología real de cada despliegue, no es una constante
// universal — en docker-compose local el único salto es el nginx del
// propio stack (1), pero un VPS con un nginx del HOST por delante del
// stack (ver `unavailable/`) agrega un salto más (2): con el valor
// equivocado, tanto `req.protocol` como el `ip` que guarda la auditoría
// (`registrarAccesoAdmin`, ver más abajo) terminan resolviendo la IP de
// ese proxy intermedio en vez de la del navegador real. `TRUST_PROXY_HOPS`
// en `.env` fija el valor real por entorno; sin definir, cae al default
// seguro de este docker-compose (1 salto).
const TRUST_PROXY_HOPS = (() => {
  const crudo = process.env.TRUST_PROXY_HOPS;
  const n = crudo === undefined || crudo === '' ? 1 : Number(crudo);
  return Number.isInteger(n) && n >= 0 ? n : 1;
})();
app.set('trust proxy', TRUST_PROXY_HOPS);

app.use(helmet());
// `credentials: true` es necesario para que las cookies de sesión de
// usuario viajen en peticiones entre origenes distintos. En el despliegue
// normal (nginx sirviendo el frontend y reenviando /api al backend) el
// navegador ve todo como el mismo origen, así que esto no aplica; solo
// importa si consumes la API desde un dominio distinto — en ese caso,
// define CORS_ORIGIN con ese dominio exacto (no "*", que los navegadores
// rechazan combinado con credenciales).
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
// Límite de body amplio a propósito: el logo/favicon de marca del tenant
// llega aquí como base64 desde el contenedor "control" (Punto 370: el
// máximo configurable vía /control llega hasta IMAGEN_MAX_MB_MAX = 20 MB
// de archivo, ~27.4 MB de texto base64 — de ahí el margen) — ver
// POST /internal/marca-logo/:slug y /internal/favicon/:slug más abajo.
// Las rutas que reciben archivos usan multer con sus propios límites, y
// cada ruta valida el tamaño real de lo que recibe.
app.use(express.json({ limit: '30mb' }));
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
// (compartido entre registro/login/recuperar/restablecer, un solo cupo por
// IP). Subido de 20 a 30 al agregar la prueba de "cuenta suspendida" —
// test/integration/auth-usuario.test.js ya usaba las 20 completas entre
// sus ~24 peticiones a estas 4 rutas, sin margen para una prueba más;
// sigue siendo estricto para fuerza bruta real (2 intentos/min en promedio).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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
// Punto 370: el límite real y configurable (ajustesGlobales) se valida a
// mano dentro de cada handler (producto/foto de ticket/logo de ticket) —
// este `fileSize` es solo un techo de seguridad genérico para no
// desperdiciar memoria/ancho de banda con un archivo absurdamente grande
// antes de siquiera llegar a esa validación.
const uploadImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGEN_MAX_MB_MAX * 1024 * 1024, files: 1 },
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

// Punto 247 — recarga en caliente de ADMIN_USERS sin reiniciar el contenedor.
// Control escribe ADMIN_USERS en el .env del host y avisa a este proceso
// para que recargue su Map en memoria (evita el reinicio y mantiene la
// propiedad de "si falla la UI, el .env sigue siendo la fuente de verdad"
// en disco). Protegido con el mismo X-Internal-Secret que los demás
// /internal/*.
app.post('/internal/reload-admin-users', (req, res) => {
  if (!secretoInternoValido(req)) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  const nuevoValor = typeof req.body?.adminUsers === 'string' ? req.body.adminUsers : null;
  if (nuevoValor !== null) {
    recargarAdminUsers(nuevoValor);
  } else {
    recargarAdminUsers();
  }
  res.json({ ok: true });
});

// ---------- Logo de marca del tenant (segmento "marca") ----------
// El logo de la marca de cada empresa vive en MinIO (mismo bucket
// compartido, key "marca/<slug>/logo") y se referencia en
// control_tenants.tenants.marca_logo_url como ruta RELATIVA
// ("/api/marca-logo/<slug>") — el backend la convierte a absoluta con
// detectarUrlPortal(req) al armar los correos. El GET público sirve el
// archivo con cache largo (es un logo: va en correos, no es sensible).
// Punto 370: el límite real ya no es esta variable de entorno — viene de
// ajustesGlobales.obtenerImagenMaxMbCacheado() (tabla `ajustes_globales`,
// configurable desde /control). Se conserva el fallback de código con el
// mismo valor histórico (2) para cuando `control_tenants` es inalcanzable.

// Sube el logo de marca de un tenant. Solo el contenedor "control" lo usa
// (el administrador de control carga el logo y este servicio lo persiste
// en MinIO) — misma protección por secreto compartido que
// /internal/cache-tenant/invalidar, y NO se expone por nginx. El logo
// llega como base64 en el body (el contenedor control no tiene SDK S3 ni
// multer; ya depende de este endpoint interno para la caché). La key no
// lleva extensión: el Content-Type se guarda como metadata del objeto y
// el GET público lo devuelve tal cual.
app.post('/internal/marca-logo/:slug', asyncHandler(async (req, res) => {
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
  const imagenMaxMb = await obtenerImagenMaxMbCacheado();
  if (buffer.length > imagenMaxMb * 1024 * 1024) {
    return res.status(413).json({ error: `El logo excede el tamaño máximo permitido de ${imagenMaxMb} MB.` });
  }

  // Se valida el contenido real (firma binaria), no solo el MIME que manda
  // el cliente — mismo criterio que las imágenes de tickets.
  const mimeReal = detectRealImageMimeType(buffer);
  if (!mimeReal) {
    return res.status(400).json({ error: 'El archivo no es una imagen válida (JPG, PNG o WEBP).' });
  }

  try {
    await storage.guardarArchivo('marca', slug, 'logo', buffer, mimeReal);
    res.json({ ok: true, url: `/api/marca-logo/${slug}` });
  } catch (err) {
    console.error(`Error guardando el logo de marca del tenant "${slug}":`, err);
    res.status(500).json({ error: 'No se pudo guardar el logo.' });
  }
}));

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
app.post('/internal/favicon/:slug', asyncHandler(async (req, res) => {
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
  const imagenMaxMb = await obtenerImagenMaxMbCacheado();
  if (buffer.length > imagenMaxMb * 1024 * 1024) {
    return res.status(413).json({ error: `El favicon excede el tamaño máximo permitido de ${imagenMaxMb} MB.` });
  }

  const mimeReal = detectRealImageMimeType(buffer);
  if (!mimeReal) {
    return res.status(400).json({ error: 'El archivo no es una imagen válida (JPG, PNG o WEBP).' });
  }

  try {
    await storage.guardarArchivo('marca', slug, 'favicon', buffer, mimeReal);
    res.json({ ok: true, url: `/api/favicon/${slug}` });
  } catch (err) {
    console.error(`Error guardando el favicon del tenant "${slug}":`, err);
    res.status(500).json({ error: 'No se pudo guardar el favicon.' });
  }
}));

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

// Completa el aprovisionamiento FÍSICO de un tenant que quedó en
// "provisioning" (intake capturado desde /control, segmento 9c) — crea su
// base de datos (`tenant_<slug>`) y le aplica el esquema completo. Usa las
// mismas credenciales DB_* de aplicación que este contenedor ya tiene
// montadas — NUNCA root (a diferencia de backend/scripts/
// provisionar-tenant.js, el CLI tradicional). Solo funciona porque el
// usuario de aplicación ya tiene un GRANT amplio tipo comodín sobre
// `tenant_%` (otorgado una sola vez, con root, la primera vez que se
// corrió ese CLI — ver asegurarControlYPrivilegios en
// backend/scripts/lib/controlDb.js) — si ese privilegio faltara, esto
// falla con un error de permisos real de MySQL, degradando al camino de
// siempre (correr el CLI a mano). Deliberadamente NO toca
// control_tenants.tenants.estado — eso lo hace /control (con su propia
// credencial control_app) justo después de que este endpoint responde
// 200, mismo reparto de responsabilidades que /internal/renombrar-slug.
app.post('/internal/activar-tenant/:slug', async (req, res) => {
  if (!secretoInternoValido(req)) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  const dbName = nombreDbTenant(slug);
  try {
    await crearBaseDeDatosTenant(dbName);
    const poolTenant = obtenerPoolTenant({
      slug,
      host: process.env.DB_HOST || 'mysql',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'app',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
    });
    await ensureSchema(poolTenant);
    res.json({ ok: true, dbName });
  } catch (err) {
    console.error(`Error activando (aprovisionamiento físico de) el tenant "${slug}":`, err);
    res.status(502).json({
      error: 'No se pudo crear la base de datos del tenant. Revisa que el usuario de aplicación tenga privilegios sobre "tenant_%" (ver backend/scripts/provisionar-tenant.js) o complétalo con el CLI.',
    });
  }
});

// Punto 347 (gobierno de funcionalidades): suma los bytes reales en MinIO
// bajo el prefijo de un tenant — /control no tiene acceso directo a MinIO
// (las credenciales solo están montadas aquí), así que delega el cálculo
// y escribe el resultado en su propia fila de control_tenants con su
// propia credencial, mismo patrón que activar-tenant/eliminar-tenant de
// arriba. Nunca se llama en el camino de una request normal — solo desde
// el botón "Recalcular" de /control, bajo demanda del operador.
app.post('/internal/disco-uso/:slug', async (req, res) => {
  if (!secretoInternoValido(req)) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  try {
    const bytes = await storage.calcularBytesPrefijo(slug);
    res.json({ ok: true, bytes });
  } catch (err) {
    console.error(`Error calculando el uso de disco del tenant "${slug}":`, err);
    res.status(502).json({ error: 'No se pudo calcular el uso de disco en el almacenamiento.' });
  }
});

// Punto 349-350-351 (regla 9, ver stitch/gobierno-funcionalidades/
// NOTAS.md): al bajar el máximo de usuarios de un plan ya asignado (o
// reasignar un tenant a un plan con límite menor), la BD del tenant es
// quien tiene los datos reales de usuarios/perfiles — /control no tiene
// credenciales para ninguna tenant_* (angosto a propósito), así que
// delega aquí, mismo patrón que activar-tenant/disco-uso de arriba.
//
// Nunca suspende administradores — solo fiscal/ventas/inventario, los
// más recién creados primero (decisión explícita del usuario: se
// conserva activa la base original de cuentas de la empresa). Si el
// exceso es mayor a los candidatos disponibles (ej. más administradores
// solos que el límite), se suspende lo que se puede y se deja así — el
// límite puede seguir excedido, pero NUNCA se suspende un administrador
// por este mecanismo, sin excepción.
//
// `maxUsuarios` null/ausente = sin límite, no-op explícito (nunca
// suspende nada "por si acaso"). Idempotente: si ya está dentro del
// límite, responde `suspendidos: []` sin tocar ninguna fila.
app.post('/internal/aplicar-limite-usuarios/:slug', async (req, res) => {
  if (!secretoInternoValido(req)) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  const maxUsuarios = req.body ? req.body.maxUsuarios : undefined;
  if (maxUsuarios === null || maxUsuarios === undefined) {
    return res.json({ ok: true, suspendidos: [] });
  }
  if (!Number.isInteger(maxUsuarios) || maxUsuarios < 1) {
    return res.status(400).json({ error: 'maxUsuarios inválido.' });
  }

  const dbName = nombreDbTenant(slug);
  const poolTenant = obtenerPoolTenant({
    slug,
    host: process.env.DB_HOST || 'mysql',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });

  // Mismos 4 perfiles que cuentan para la cuota al CREAR un usuario (ver
  // PERFILES_CUOTA en POST/PUT /api/admin/usuarios) — "cliente" nunca
  // cuenta, ni aquí ni allá.
  const PERFILES_CUOTA = ['administrador', 'fiscal', 'ventas', 'inventario'];
  const PERFILES_SUSPENDIBLES = ['fiscal', 'ventas', 'inventario'];

  try {
    const [[{ total }]] = await poolTenant.query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE activo = 1 AND perfil IN (${PERFILES_CUOTA.map(() => '?').join(',')})`,
      PERFILES_CUOTA
    );
    const exceso = total - maxUsuarios;
    if (exceso <= 0) {
      return res.json({ ok: true, suspendidos: [] });
    }

    const [candidatos] = await poolTenant.query(
      `SELECT id, rfc FROM usuarios
       WHERE activo = 1 AND perfil IN (${PERFILES_SUSPENDIBLES.map(() => '?').join(',')})
       ORDER BY creado_en DESC
       LIMIT ?`,
      [...PERFILES_SUSPENDIBLES, exceso]
    );

    if (candidatos.length > 0) {
      const ids = candidatos.map((u) => u.id);
      await poolTenant.query(
        `UPDATE usuarios SET activo = 0, suspendido_motivo = 'limite_usuarios_plan', actualizado_en = ?
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        [new Date(), ...ids]
      );
    }

    res.json({ ok: true, suspendidos: candidatos.map((u) => ({ id: u.id, rfc: u.rfc })) });
  } catch (err) {
    console.error(`Error aplicando el límite de usuarios del tenant "${slug}":`, err);
    res.status(502).json({ error: 'No se pudo aplicar el nuevo límite de usuarios.' });
  }
});

// Punto 349-350-351 (regla 8 extendida, Fase 7): solo LECTURA, para que
// /control pueda avisar de forma PREVENTIVA (antes de guardar, no
// después) si bajar el plan/max_usuarios de una empresa específica va a
// disparar la suspensión automática de la regla 9 — mismo conteo que
// /internal/aplicar-limite-usuarios pero sin tocar ninguna fila.
app.get('/internal/uso-usuarios/:slug', async (req, res) => {
  if (!secretoInternoValido(req)) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  const dbName = nombreDbTenant(slug);
  const poolTenant = obtenerPoolTenant({
    slug,
    host: process.env.DB_HOST || 'mysql',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });

  const PERFILES_CUOTA = ['administrador', 'fiscal', 'ventas', 'inventario'];

  try {
    const [[{ total }]] = await poolTenant.query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE activo = 1 AND perfil IN (${PERFILES_CUOTA.map(() => '?').join(',')})`,
      PERFILES_CUOTA
    );
    res.json({ ok: true, total });
  } catch (err) {
    console.error(`Error calculando el uso de usuarios del tenant "${slug}":`, err);
    res.status(502).json({ error: 'No se pudo calcular el uso de usuarios.' });
  }
});

// Elimina FÍSICAMENTE un tenant (punto 345, "papelera" en /control) — DROP
// DATABASE + purga de MinIO (prefijo del tenant + logo/favicon de marca
// si los tiene) + borra sus filas en control_tenants (tenants/
// tenant_eventos/api_credenciales). `control_app` no tiene privilegio
// DELETE en absoluto (angosto a propósito, ver
// control/scripts/ensureSchema.js) — ni para lo físico ni para estas 3
// tablas — así que /control delega TODO el borrado aquí de una sola
// llamada, con las credenciales de aplicación que este contenedor ya
// tiene montadas (`DB_*` para la base física, `obtenerPoolControl()`
// para las filas — backend sí tiene ALL PRIVILEGES en `control_tenants`
// desde el segmento 1, ver el comentario en adminAuditoria.js).
// `admin_auditoria` NUNCA se toca — se conserva a propósito como rastro
// histórico, a petición explícita del usuario.
//
// Verificación atómica PROPIA de "sigue en baja" (no confía en que
// /control ya lo revisó momentos antes — mismo criterio que el resto de
// este archivo, guarda en el UPDATE/DELETE en vez de SELECT-luego-
// escribir) al final, justo antes del DELETE de `tenants`: si algo lo
// sacó de "baja" en el camino (control_app no puede, pero un operador
// con acceso directo a MySQL sí podría), se aborta ahí sin haber tocado
// las filas de control todavía — la base física y los archivos ya se
// habrían borrado en ese punto (son el paso más caro y el que de verdad
// no se puede deshacer), así que ese es el orden correcto: lo
// irreversible primero, la limpieza de registro al final.
app.post('/internal/eliminar-tenant/:slug', async (req, res) => {
  if (!secretoInternoValido(req)) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const slug = String(req.params.slug || '').toLowerCase();
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  const poolControl = obtenerPoolControl();
  let tenant;
  try {
    const [filasTenant] = await poolControl.query('SELECT id, estado FROM tenants WHERE slug = ?', [slug]);
    tenant = filasTenant[0];
  } catch (err) {
    console.error(`Error consultando el tenant "${slug}" en control_tenants:`, err);
    return res.status(500).json({ error: 'No se pudo consultar el tenant.' });
  }
  if (!tenant) {
    return res.status(404).json({ error: `El tenant "${slug}" no existe.` });
  }
  if (tenant.estado !== 'baja') {
    return res.status(409).json({
      error: `El tenant "${slug}" está en estado "${tenant.estado}", no se puede eliminar desde ahí (solo aplica a "Baja").`,
    });
  }

  cerrarPoolTenant(slug);
  const dbName = nombreDbTenant(slug);

  try {
    await eliminarBaseDeDatosTenant(dbName);
  } catch (err) {
    console.error(`Error eliminando la base de datos del tenant "${slug}":`, err);
    return res.status(502).json({ error: 'No se pudo borrar la base de datos del tenant.' });
  }

  try {
    await storage.eliminarPrefijo(slug);
    if (await storage.existeArchivo('marca', slug, 'logo')) {
      await storage.eliminarArchivo('marca', slug, 'logo');
    }
    if (await storage.existeArchivo('marca', slug, 'favicon')) {
      await storage.eliminarArchivo('marca', slug, 'favicon');
    }
  } catch (err) {
    console.error(`Error borrando archivos del tenant "${slug}" (la base de datos ya se borró):`, err);
    return res.status(502).json({
      error: `La base de datos ya se borró, pero no se pudieron borrar todos los archivos. Revisa MinIO manualmente para el prefijo "${slug}".`,
    });
  }

  // Bloque propio (nunca crashea el proceso completo): esta ruta NO pasa
  // por asyncHandler (mismo criterio que /internal/activar-tenant y
  // /internal/renombrar-slug, arriba) — un await sin try/catch aquí
  // sería una promesa rechazada sin atrapar, y eso tumba TODO el
  // backend (cero tenants, no solo esta petición), no solo la request
  // en curso. Bug real encontrado probando esto contra Docker real: al
  // fallar el primer DELETE (permiso denegado), el proceso completo se
  // cerró — corregido envolviendo este tramo.
  try {
    await poolControl.query('DELETE FROM tenant_eventos WHERE tenant_id = ?', [tenant.id]);
    await poolControl.query('DELETE FROM api_credenciales WHERE tenant_slug = ?', [slug]);
    const [resultado] = await poolControl.query('DELETE FROM tenants WHERE id = ? AND estado = ?', [tenant.id, 'baja']);
    if (resultado.affectedRows === 0) {
      // La base de datos y los archivos YA se borraron (irreversible) —
      // esto solo puede pasar si algo cambió el estado en el instante
      // exacto entre el SELECT de arriba y este DELETE. Se avisa distinto
      // a un error normal: la fila de control quedó huérfana a propósito
      // (apunta a una base que ya no existe) en vez de desaparecer sola,
      // para que quede rastro de que hay que revisarla a mano.
      console.error(`El tenant "${slug}" cambió de estado durante su eliminación física — la fila de control_tenants no se borró, requiere revisión manual.`);
      return res.status(409).json({
        error: 'La base de datos y los archivos ya se eliminaron, pero el registro no se pudo borrar porque el estado cambió durante el proceso. Revisa el tenant manualmente en control_tenants.',
      });
    }
  } catch (err) {
    console.error(`Error borrando las filas de control_tenants del tenant "${slug}" (la base de datos y los archivos ya se borraron):`, err);
    return res.status(502).json({
      error: `La base de datos y los archivos ya se eliminaron, pero no se pudo borrar el registro en control_tenants. Revisa manualmente el tenant "${slug}" ahí.`,
    });
  }

  res.json({ ok: true });
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
    // Punto 244: con el switch apagado desde /control, este endpoint
    // público se comporta como si el tenant nunca hubiera configurado
    // marca/tema — mismo criterio que marcaDelTenant()/coloresCorreoTenant()
    // en el resto del archivo.
    const marcaLookfeelHabilitado = !tenant || tenant.marca_lookfeel_habilitado !== 0;
    const tenantParaTema = marcaLookfeelHabilitado ? tenant : { ...tenant, tema_json: null };
    const tema = parsearTemaDesdeFila(tenantParaTema);
    // Punto 374/375: "Portal de clientes desactivado" — theme.js (único
    // consumidor de este endpoint en las 6 páginas del portal de
    // cliente) necesita saber si el portal está apagado para sustituir
    // toda la página por el aviso, y el correo real al que el cliente
    // puede escribir en ese caso. Efectivo = plan (/control) AND
    // !pausado (el propio admin, Mi Cuenta) — mismo cálculo que
    // req.tenant.portalClientesHabilitado, ver tenantContext.js.
    const portalClientesHabilitado = portalClientesEfectivo(tenant);
    // Punto 375 (corregido): esta respuesta NUNCA se cachea, ni siquiera
    // con el portal activo. Un max-age>0 aquí deja una ventana real de
    // bug — admin pausa (no-store, bien) → reactiva (vuelve a cachearse
    // 300s) → pausa de nuevo DENTRO de esos 300s en la misma pestaña →
    // el navegador sirve el fetch viejo "activo" sin volver a pedirlo,
    // el aviso nunca aparece aunque el backend ya esté pausado
    // (reproducido con Playwright real, 2026-10-07). El tema/marca del
    // tenant cambia con tan poca frecuencia que cachear client-side no
    // compensa el riesgo; tenantContext ya cachea en servidor (45s).
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      slug,
      marca: (marcaLookfeelHabilitado && tenant && tenant.marca) || null,
      marcaLoGoUrl: (marcaLookfeelHabilitado && tenant && tenant.marca_logo_url) || null,
      tema,
      variables: temaAVariables(tema),
      fuentesGoogle: fuentesAUrlGoogle(tema),
      // Punto 170: la burbuja "Solicitar aclaraciones" del portal solo se
      // pinta si el tenant tiene correo de contacto configurado — cero
      // dato sensible expuesto (booleano nomás), mismo endpoint público
      // que ya consume theme.js en las 3 páginas del portal de cliente.
      tieneAclaraciones: Boolean(tenant && tenant.contacto_email),
      portalClientesHabilitado,
      // El correo real SOLO se expone cuando el portal está apagado (el
      // único caso en que theme.js lo necesita, para la página de aviso)
      // — con el portal activo se mantiene el criterio de arriba, "cero
      // dato sensible expuesto, booleano nomás".
      contactoEmailPortalApagado: portalClientesHabilitado ? null : ((tenant && tenant.contacto_email) || null),
    });
  } catch (err) {
    console.error(`Error sirviendo el tema del tenant "${slug}":`, err);
    res.status(500).json({ error: 'No se pudo leer el tema.' });
  }
});

// Punto 375: equivalente de GET /api/tema/:slug para el SITIO BASE (sin
// tenant) — las páginas del portal de cliente servidas en la raíz
// (/login, /dashboard, etc., sin prefijo de slug) no tienen ningún
// X-Tenant-Slug que resolver, así que theme.js no puede usar la ruta de
// arriba ahí. El sitio base no personaliza marca/tema (decisión
// confirmada con el usuario al construir el punto 373 — "solo tenant"),
// así que esos campos siempre van vacíos; lo único real aquí es el aviso
// de "portal de clientes desactivado" cuando el propio admin lo pausó
// desde Mi Cuenta (sin ceiling de plan: el sitio base no es un tenant
// gobernado por /control).
app.get('/api/tema-base', async (req, res) => {
  try {
    const config = await getConfiguracionGlobal();
    const portalClientesHabilitado = !config.portal_clientes_pausado;
    // Mismo criterio que GET /api/tema/:slug — no-store siempre (ver
    // comentario ahí sobre el bug real de caché en el ciclo
    // pausar→activar→pausar).
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      slug: null,
      marca: null,
      marcaLoGoUrl: null,
      tema: null,
      variables: {},
      fuentesGoogle: [],
      tieneAclaraciones: Boolean(config.contacto_email_cliente),
      portalClientesHabilitado,
      contactoEmailPortalApagado: portalClientesHabilitado ? null : (config.contacto_email_cliente || null),
    });
  } catch (err) {
    console.error('Error sirviendo el tema del sitio base:', err);
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
    // Facturación apagada en este tenant: el RFC deja de pedirse (no
    // tiene para qué facturar) — se genera un identificador interno en
    // su lugar. Facturación prendida (o sitio base, sin tenant):
    // comportamiento idéntico a siempre, RFC obligatorio.
    const facturacionActiva = !req.tenant || req.tenant.facturacionHabilitada !== false;
    const rfcCapturado = sanitizeText(body.rfc, 13).toUpperCase();
    const email = sanitizeText(body.email, 200).toLowerCase();
    const telefono = sanitizeText(body.telefono, 20);
    const password = typeof body.password === 'string' ? body.password : '';

    if (facturacionActiva && !isValidRFCRequerido(rfcCapturado)) {
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

    const rfc = facturacionActiva ? rfcCapturado : await generarIdentificadorSinFiscalUnico();

    if (facturacionActiva) {
      const [existentes] = await pool.query('SELECT id FROM usuarios WHERE rfc = ?', [rfc]);
      if (existentes.length > 0) {
        return res.status(409).json({ error: 'Ya existe una cuenta registrada con este RFC. Inicia sesión.' });
      }
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

// 241 — Parseo de Constancia para precargar RFC/tipo persona en registro (reuso 100% de pdfExtract, sin INSERT)
// Pública, sin sesión, tenant-aware solo para respetar API_BASE. No crea registro ni usuario.
app.post('/api/auth/parse-csf', submitLimiter, (req, res) => {
  upload.single('archivo')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.` });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({ error: 'Solo se aceptan archivos en formato PDF.' });
      }
      return res.status(400).json({ error: 'No se pudo procesar el archivo.' });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Selecciona un archivo PDF.' });
    }
    try {
      const texto = await extraerTextoPdf(req.file.buffer);
      if (!texto || !pareceConstanciaFiscal(texto)) {
        return res.status(400).json({ error: 'El archivo no parece ser una Constancia de Situación Fiscal válida.' });
      }
      const rfc = extraerRFC(texto);
      const regimenes = extraerRegimenesFiscales(texto);
      const nombre = extraerNombreRazonSocial(texto);
      const tipo_persona = determinarTipoPersona(regimenes, nombre, texto);
      return res.json({ rfc: rfc || null, tipo_persona: tipo_persona || null, nombre: nombre || null });
    } catch (e) {
      return res.status(400).json({ error: 'No se pudo leer el contenido del PDF.' });
    }
  });
});

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

// Punto en curso (gating Facturación): con Facturación apagada, el RFC
// deja de pedirse al crear una cuenta cliente (auto-registro o desde
// /admin). La columna `usuarios.rfc` sigue NOT NULL+UNIQUE — decouplar la
// sesión de un RFC real habría significado tocar el token de sesión y
// las 19+ consultas `WHERE rfc = ?` que ya existen (tickets, folios,
// Mi Cuenta, aclaraciones...), con alto riesgo de romper el resto del
// ecosistema y la suite de pruebas existente. En vez de eso: se genera
// un identificador interno con formato que NUNCA coincide con un RFC
// real (`isValidRFCRequerido()` lo rechaza por diseño), así que toda la
// arquitectura existente sigue funcionando sin tocarla — el valor solo
// se usa como llave interna, nunca se muestra a un humano como "tu RFC"
// (ver tieneRfcReal() + los puntos donde se usa, más abajo).
function generarIdentificadorSinFiscal() {
  return `SINFISCAL-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

// Distingue un RFC real capturado por el usuario de un identificador
// interno generado por generarIdentificadorSinFiscal() — se usa en toda
// pantalla que hoy muestra "RFC: {valor}" a un humano, para no enseñarle
// un identificador interno sin sentido para él.
function tieneRfcReal(rfc) {
  return isValidRFCRequerido(rfc);
}

// Genera un identificador sin fiscal garantizado único contra `usuarios`
// — colisión prácticamente imposible (8 bytes de entropía) pero se
// reintenta igual, mismo criterio defensivo que folios/tokens en el
// resto del proyecto.
async function generarIdentificadorSinFiscalUnico() {
  for (let intento = 0; intento < 5; intento += 1) {
    const candidato = generarIdentificadorSinFiscal();
    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE rfc = ?', [candidato]);
    if (existentes.length === 0) return candidato;
  }
  throw new Error('No se pudo generar un identificador único.');
}

// Inicio de sesión: el backend acepta cualquier valor que coincida con
// `usuarios.rfc` O `usuarios.email`, sin filtrar por perfil (la tabla no
// distingue el campo de "usuario" entre RFC y nombre de usuario, es la
// misma columna) — así que técnicamente sirve tanto para clientes (RFC o
// correo) como para cuentas administrador/fiscal (nombre de usuario,
// sigue siendo solo contra `rfc`, esas cuentas no necesariamente tienen
// correo). Login por correo (no solo RFC): el correo ya es obligatorio
// para CUALQUIER cliente desde su creación (ver POST /api/auth/registro
// y POST /api/admin/usuarios, sin excepción por tenant/plan), así que
// esto no requiere ningún cambio de esquema ni de las reglas de alta —
// todo cliente que existe ya tiene ambos datos. Sirve sobre todo cuando
// el tenant tiene Facturación apagada (el RFC deja de tener relevancia
// como dato a mostrar/usar día a día, aunque sigue guardado). Mismo
// patrón OR ya probado en POST /api/auth/recuperar (abajo): el valor
// recibido se compara en mayúsculas contra `rfc` y en minúsculas contra
// `email`, nunca mezclado. La sesión SIEMPRE se abre con `usuario.rfc`
// (la columna real de la fila encontrada, nunca el valor que la persona
// tecleó) — así que todo lo que ya asume un RFC en la sesión (folio de
// tickets, el campo "RFC" en "Solicitar aclaraciones", el label del
// header, los correos de confirmación) sigue viendo un RFC real y válido
// sin ningún cambio, se haya logueado por RFC o por correo.
app.post(
  '/api/auth/login',
  authLimiter,
  tenantAggregateAuthLimiter,
  // Único punto donde nace una sesión de cliente — requireUserAuth gatea
  // todo lo que ya tiene sesión, pero el login en sí ocurre antes de que
  // exista una, así que necesita su propio candado (ver requiereFeature.js).
  requiereFeature('portalClientesHabilitado'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const identificador = sanitizeText(body.rfc, 200);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!identificador || !password) {
      return res.status(400).json({ error: 'Ingresa tu RFC o correo y tu contraseña.' });
    }

    // Login del PORTAL DE CLIENTES — perfil='cliente' siempre, nunca se
    // deja sin filtrar (punto 377): desde que un correo puede pertenecer a
    // la vez a una cuenta 'administrador' y a una cuenta 'cliente' (mismo
    // correo, roles distintos), un WHERE sin perfil podía traer las 2 filas
    // y quedarse con la que MySQL devolviera primero — si esa era la fila
    // admin, el cliente real recibía "RFC, correo o contraseña
    // incorrectos" aunque su contraseña fuera correcta, porque se
    // comparaba contra el hash equivocado.
    const [filas] = await pool.query("SELECT * FROM usuarios WHERE (rfc = ? OR email = ?) AND perfil = 'cliente'", [
      identificador.toUpperCase(),
      identificador.toLowerCase(),
    ]);
    const usuario = filas[0];

    // Mensaje generico (no revela si la cuenta existe o no) para no
    // facilitar enumeracion de cuentas registradas. verifyPassword()
    // SIEMPRE se llama (con el hash real o con el de relleno) para que
    // el tiempo de respuesta no delate por sí solo si la cuenta existe —
    // ver HASH_RELLENO_LOGIN arriba.
    const passwordValida = verifyPassword(password, usuario ? usuario.password_hash : HASH_RELLENO_LOGIN);
    if (!usuario || !passwordValida) {
      return res.status(401).json({ error: 'RFC, correo o contraseña incorrectos.' });
    }
    // Igual que en el login administrativo: solo se revela "suspendida"
    // DESPUÉS de validar la contraseña, nunca antes (no delata si el RFC
    // existe a quien no trae la contraseña correcta).
    if (usuario.activo === 0 || usuario.activo === false) {
      return res.status(403).json({ error: 'Tu cuenta está suspendida. Contacta a la empresa.', codigo: 'CUENTA_SUSPENDIDA' });
    }

    establecerCookieSesion(res, usuario.rfc, req.tenant ? req.tenant.slug : null);
    res.json({
      ok: true,
      rfc: usuario.rfc,
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
      'SELECT nombre, debe_cambiar_password, activo FROM usuarios WHERE rfc = ?',
      [req.userRfc]
    );
    const debeCambiarPassword = filas[0] ? Boolean(filas[0].debe_cambiar_password) : false;
    // Igual que debeCambiarPassword: se consulta en vivo (no se guarda en
    // el token de sesión) para que suspender a alguien corte su acceso
    // aunque ya tuviera una sesión abierta, sin esperar a que expire.
    const suspendido = filas[0] ? (filas[0].activo === 0 || filas[0].activo === false) : false;
    res.json({
      rfc: req.userRfc,
      // tieneRfc: false para un identificador interno (ver
      // generarIdentificadorSinFiscal) — el frontend nunca debe mostrar
      // ese valor como "tu RFC" (header, "Solicitar aclaraciones", etc.).
      tieneRfc: tieneRfcReal(req.userRfc),
      nombre: filas[0] ? filas[0].nombre || '' : '',
      // Punto en curso (gating Facturación en el portal de cliente): el
      // dashboard necesita saber si Facturación está activa para
      // ocultar "Subir constancia"/"Subir tickets"/"Mis solicitudes" —
      // sin tenant (sitio base), comportamiento de siempre (activo).
      facturacionHabilitada: !req.tenant || req.tenant.facturacionHabilitada !== false,
      debeCambiarPassword,
      suspendido,
    });
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

// ---------- Mi Cuenta (portal de cliente) ----------
// Autoservicio del propio cliente logueado — mismo patrón ya usado en
// GET/PUT /api/admin/mi-cuenta y PUT /api/admin/mi-cuenta/password, pero
// sin el chequeo de "mecanismo" (toda fila de perfil 'cliente' en
// `usuarios` es editable, no hay cuenta de respaldo tipo ADMIN_USERS en
// este lado). nombre/telefono/email, NUNCA rfc/perfil/password aquí.
app.get(
  '/api/mi-cuenta',
  requireUserAuth,
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      'SELECT nombre, telefono, email FROM usuarios WHERE rfc = ? LIMIT 1',
      [req.userRfc]
    );
    const fila = filas[0];
    if (!fila) {
      return res.status(404).json({ error: 'No se encontró tu cuenta.' });
    }
    res.json({
      rfc: req.userRfc,
      nombre: fila.nombre || '',
      telefono: fila.telefono || '',
      email: fila.email || '',
    });
  })
);

app.put(
  '/api/mi-cuenta',
  requireUserAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const nombre = sanitizeText(body.nombre, 200);
    const telefono = sanitizeText(body.telefono, 20);
    if (!telefono || !isValidTelefono(telefono)) {
      return res.status(400).json({ error: 'El teléfono no es válido.' });
    }
    const email = sanitizeText(body.email, 200).toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio y debe ser válido.' });
    }

    // El correo ya se usa para asociar movimientos de crédito y, a
    // futuro, como identificador alterno de login (ver punto en curso) —
    // debe ser único por tenant igual que el RFC, pero SOLO dentro de
    // perfil 'cliente' (decisión del usuario, punto 377): un mismo correo
    // puede pertenecer a la vez a una cuenta 'administrador' y a una
    // cuenta 'cliente' (el dueño del negocio es también su propio
    // cliente) — eso no es un duplicado real, son roles distintos de la
    // misma persona para el negocio. Sin el filtro de perfil, guardar el
    // nombre de la cuenta cliente chocaba contra la cuenta admin que
    // comparte el mismo correo. 409, mismo criterio que slug duplicado en
    // /control.
    const [dup] = await pool.query(
      "SELECT rfc FROM usuarios WHERE email = ? AND rfc <> ? AND perfil = 'cliente' LIMIT 1",
      [email, req.userRfc]
    );
    if (dup[0]) {
      return res.status(409).json({ error: 'Ese correo ya está en uso por otra cuenta.' });
    }

    const [resultado] = await pool.query(
      'UPDATE usuarios SET nombre = ?, telefono = ?, email = ?, actualizado_en = ? WHERE rfc = ?',
      [nombre, telefono, email, new Date(), req.userRfc]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'No se encontró tu cuenta.' });
    }
    res.json({ ok: true, mensaje: 'Tus datos se actualizaron correctamente.' });
  })
);

// A diferencia de PUT /api/auth/password (reseteo forzado/voluntario sin
// verificar nada porque la sesión ya es la prueba), este SÍ exige la
// contraseña actual — mismo criterio que PUT /api/admin/mi-cuenta/password.
app.put(
  '/api/mi-cuenta/password',
  requireUserAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const passwordActual = typeof body.password_actual === 'string' ? body.password_actual : '';
    const passwordNueva = typeof body.password_nueva === 'string' ? body.password_nueva : '';

    const [filas] = await pool.query('SELECT password_hash FROM usuarios WHERE rfc = ? LIMIT 1', [req.userRfc]);
    const fila = filas[0];
    if (!fila || !verifyPassword(passwordActual, fila.password_hash)) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    }

    const errorPassword = validarPassword(passwordNueva);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }

    const passwordHash = hashPassword(passwordNueva);
    await pool.query(
      'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, actualizado_en = ? WHERE rfc = ?',
      [passwordHash, new Date(), req.userRfc]
    );
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente.' });
  })
);

// Segmento 3 de "Mi Cuenta" (Gestión de crédito del cliente, ver
// PROJECT_STATE.md): visibilidad de SU Cuentas por cobrar + historial real
// de abonos — sin límite de crédito nuevo, solo lo que ya existe en
// ordenes_compra/abonos (lado admin), vinculado por correo (usuarios.email
// == ordenes_compra.email, ya único por tenant desde PUT /api/mi-cuenta).
// requiereFeature ANTES de requireUserAuth (mismo criterio que el resto
// del candado de módulos, ver backend/utils/requiereFeature.js): sin
// Ventas o sin CxC activos en el plan del tenant, 404 — nunca expone que
// el módulo existe. Un cliente sin correo capturado simplemente no tiene
// nada que vincular todavía (respuesta en ceros, sin consultar).
app.get(
  '/api/mi-cuenta/credito',
  requiereFeature('ventasHabilitado'),
  requiereFeature('cxcHabilitado'),
  requireUserAuth,
  asyncHandler(async (req, res) => {
    const [filasUsuario] = await pool.query('SELECT email FROM usuarios WHERE rfc = ? LIMIT 1', [req.userRfc]);
    const email = filasUsuario[0] ? filasUsuario[0].email : null;

    if (!email) {
      return res.json({ resumen: { totalFacturado: 0, totalPagado: 0, saldoPendiente: 0 }, ventasPendientes: [], abonos: [] });
    }

    const [ventas] = await pool.query(
      `SELECT id, numero_compra, concepto, total, monto_cobrado, estado_pago, fecha_compra
       FROM ordenes_compra WHERE email = ? AND eliminado_en IS NULL ORDER BY fecha_compra DESC`,
      [email]
    );

    const totalFacturado = ventas.reduce((acc, v) => acc + Number(v.total), 0);
    const totalPagado = ventas.reduce((acc, v) => acc + Number(v.monto_cobrado), 0);
    const saldoPendiente = Math.round((totalFacturado - totalPagado) * 100) / 100;

    const ventasPendientes = ventas
      .filter((v) => v.estado_pago !== 'pagada')
      .map((v) => ({
        id: v.id,
        numeroCompra: v.numero_compra,
        concepto: v.concepto,
        total: Number(v.total),
        saldo: Math.round((Number(v.total) - Number(v.monto_cobrado)) * 100) / 100,
        fechaCompra: v.fecha_compra,
      }));

    const [abonos] = await pool.query(
      `SELECT a.monto, a.notas, a.creado_en, o.numero_compra
       FROM abonos a JOIN ordenes_compra o ON o.id = a.orden_id
       WHERE o.email = ? AND o.eliminado_en IS NULL ORDER BY a.creado_en DESC LIMIT 50`,
      [email]
    );

    res.json({
      resumen: {
        totalFacturado: Math.round(totalFacturado * 100) / 100,
        totalPagado: Math.round(totalPagado * 100) / 100,
        saldoPendiente,
      },
      ventasPendientes,
      abonos: abonos.map((a) => ({
        monto: Number(a.monto),
        notas: a.notas || '',
        creadoEn: a.creado_en,
        numeroCompra: a.numero_compra,
      })),
    });
  })
);

// Mensaje SIEMPRE genérico, exista o no la cuenta — mismo principio
// anti-enumeración que ya usa /api/auth/login (ver HASH_RELLENO_LOGIN):
// revelar "esa cuenta no existe" le regala a un atacante una forma barata
// de enumerar RFCs/correos válidos.
const MENSAJE_RECUPERAR_GENERICO = 'Si el dato coincide con una cuenta, en unos minutos te llega un correo con instrucciones.';

// Solicita un enlace de recuperación de contraseña. Sirve tanto para
// clientes como para cuentas administrador/fiscal — es la MISMA tabla
// `usuarios`, la columna `rfc` ya se usa como "usuario" también para
// admin/fiscal (ver comentario en POST /api/auth/login). Fuera de
// alcance a propósito (no tienen forma de recuperación por este medio,
// documentado en PROJECT_STATE.md): la cuenta de respaldo "admin"
// (compartida, sin correo propio), ADMIN_USERS (variable de entorno),
// /control (mismo caso) y los usuarios de sucursal compartidos (sin
// columna de correo hoy).
app.post(
  '/api/auth/recuperar',
  authLimiter,
  tenantAggregateAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const identificador = sanitizeText(body.identificador, 200);
    if (!identificador) {
      return res.status(400).json({ error: 'Escribe tu correo o tu usuario.' });
    }

    const [filas] = await pool.query('SELECT * FROM usuarios WHERE rfc = ? OR email = ? LIMIT 1', [
      identificador.toUpperCase(),
      identificador.toLowerCase(),
    ]);
    const usuario = filas[0];

    // Costo artificial: SIEMPRE hace el mismo trabajo "caro" exista o no
    // la cuenta, para que el tiempo de respuesta no delate por sí solo si
    // el dato coincide con algo — mismo criterio que HASH_RELLENO_LOGIN.
    hashPassword('costo-artificial-anti-enumeracion');

    if (usuario && usuario.email) {
      const token = generarTokenRecuperacion();
      const tokenHash = hashTokenRecuperacion(token);
      const expira = new Date(Date.now() + DURACION_TOKEN_RECUPERACION_MS);
      await pool.query('UPDATE usuarios SET reset_token_hash = ?, reset_token_expira = ? WHERE id = ?', [
        tokenHash,
        expira,
        usuario.id,
      ]);

      const urlPortal = detectarUrlPortal(req);
      // El fetch de configGlobal (para el logo por defecto) se hace DENTRO
      // del fire-and-forget, nunca bloqueando la respuesta — mismo criterio
      // que el resto de estos correos: si algo aquí falla, el usuario ya
      // recibió su token guardado, solo el correo no salió.
      (async () => {
        const configGlobalRecuperar = await getConfiguracionGlobal();
        await enviarCorreoRecuperacion({
          email: usuario.email,
          urlPortal,
          marca: marcaDelTenant(req),
          token,
          logoUrl: logoUrlDelTenant(req, urlPortal, configGlobalRecuperar),
          colores: coloresCorreoTenant(req),
        });
      })().catch((err) => {
        console.error('No se pudo enviar el correo de recuperación:', err.message);
      });
    }

    res.json({ ok: true, mensaje: MENSAJE_RECUPERAR_GENERICO });
  })
);

// Consume el token del enlace de recuperación y fija la nueva contraseña.
// Público a propósito (el token ES la prueba de identidad) — no requiere
// sesión activa. Un solo uso: el UPDATE limpia el token en la misma
// operación que actualiza la contraseña.
app.post(
  '/api/auth/restablecer',
  authLimiter,
  tenantAggregateAuthLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const token = sanitizeText(body.token, 64);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!token) {
      return res.status(400).json({ error: 'Enlace inválido.', codigo: 'TOKEN_INVALIDO' });
    }
    const errorPassword = validarPassword(password);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }

    const tokenHash = hashTokenRecuperacion(token);
    const [filas] = await pool.query(
      'SELECT id, perfil FROM usuarios WHERE reset_token_hash = ? AND reset_token_expira > ? LIMIT 1',
      [tokenHash, new Date()]
    );
    const usuario = filas[0];
    if (!usuario) {
      return res.status(400).json({
        error: 'Este enlace ya no es válido o ya expiró. Solicita uno nuevo.',
        codigo: 'TOKEN_INVALIDO',
      });
    }

    const passwordHash = hashPassword(password);
    await pool.query(
      `UPDATE usuarios
          SET password_hash = ?, debe_cambiar_password = 0,
              reset_token_hash = NULL, reset_token_expira = NULL, actualizado_en = ?
        WHERE id = ?`,
      [passwordHash, new Date(), usuario.id]
    );

    res.json({ ok: true, perfil: usuario.perfil });
  })
);

// ---------- Aclaraciones (punto 170) ----------
// Burbuja "Solicitar aclaraciones" del portal de cliente: sin persistencia
// en BD (decisión explícita del usuario) — el correo ES el único registro
// de la solicitud. Por eso, a diferencia del resto de los correos de esta
// app (fire-and-forget con un `.catch()`, porque ya hay una fila en BD de
// respaldo si el envío falla), aquí SÍ se espera el envío y se le informa
// al cliente si falló, para que pueda reintentar en vez de creer que su
// solicitud se mandó cuando en realidad se perdió en silencio.
// Homologación con tenants (que usan GET /<slug>/api/tema/<slug> para
// esto): el sitio base no tiene slug ni fila en control_tenants, así que
// necesita su propio endpoint público y minúsculo para que
// frontend/aclaraciones.js sepa si pintar la burbuja — mismo criterio de
// exponer solo un booleano, cero dato sensible. No aplica con tenant
// resuelto (ese camino ya usa /api/tema/:slug, este solo cubre el hueco
// del sitio base).
app.get(
  '/api/aclaraciones/disponible',
  asyncHandler(async (req, res) => {
    if (req.tenant) {
      return res.json({ tieneAclaraciones: false });
    }
    const config = await getConfiguracionGlobal();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ tieneAclaraciones: Boolean(config.contacto_email_cliente) });
  })
);

app.post(
  '/api/aclaraciones',
  requireUserAuth,
  submitLimiter,
  asyncHandler(async (req, res) => {
    // Con tenant, el destino sale de req.tenant (ya resuelto por el
    // middleware, sin consulta extra); sin tenant (sitio base), hace falta
    // leer la config local — se guarda en la misma variable que más abajo
    // ya necesita logoUrlDelTenant(), para no consultarla dos veces.
    let configGlobalAclaracion = null;
    let contactoDestino = null;
    if (req.tenant) {
      contactoDestino = req.tenant.contactoEmail || null;
    } else {
      configGlobalAclaracion = await getConfiguracionGlobal();
      contactoDestino = configGlobalAclaracion.contacto_email_cliente || null;
    }
    if (!contactoDestino) {
      return res.status(404).json({ error: 'Esta empresa no tiene un correo de contacto configurado todavía.' });
    }

    const body = req.body || {};
    const nombre = sanitizeText(body.nombre, 150);
    const telefono = sanitizeText(body.telefono, 30);
    const detalle = sanitizeTextoLibre(body.detalle, 2000);

    if (!nombre) return res.status(400).json({ error: 'Escribe tu nombre.' });
    if (!telefono) return res.status(400).json({ error: 'Escribe un teléfono de contacto.' });
    if (!detalle) return res.status(400).json({ error: 'Describe tu situación o duda.' });

    // "número = ID + RFC" (requerimiento textual): sin fila de BD que dé un
    // id autoincremental, se arma uno corto a partir del timestamp — único
    // en la práctica (a la resolución de milisegundos) y suficiente para
    // que el cliente lo cite si necesita dar seguimiento por correo.
    const numero = `${Date.now().toString(36).toUpperCase()}-${req.userRfc}`;
    const urlPortal = detectarUrlPortal(req);
    if (!configGlobalAclaracion) {
      configGlobalAclaracion = await getConfiguracionGlobal();
    }
    const colores = coloresCorreoTenant(req);

    const { html, texto, adjuntos } = construirCorreoBase({
      marca: marcaDelTenant(req),
      logoUrl: logoUrlDelTenant(req, urlPortal, configGlobalAclaracion),
      colorPrimario: colores.primario,
      colorAccent: colores.acento,
      eyebrow: 'Solicitud de aclaración',
      titulo: `Folio ${numero}`,
      filas: [
        { etiqueta: 'RFC', valor: escapeHtmlCorreo(req.userRfc) },
        { etiqueta: 'Nombre', valor: escapeHtmlCorreo(nombre) },
        { etiqueta: 'Teléfono', valor: escapeHtmlCorreo(telefono) },
      ],
      parrafos: detalle
        .split('\n')
        .map((linea) => linea.trim())
        .filter(Boolean)
        .map((linea) => escapeHtmlCorreo(linea)),
    });

    try {
      await enviarCorreo({
        destinatario: contactoDestino,
        asunto: `Solicitud de aclaración ${numero}`,
        cuerpo: texto,
        html,
        adjuntos,
      });
    } catch (err) {
      console.error('No se pudo enviar la solicitud de aclaración:', err.message);
      // 500, NO 502/503/504: nginx (frontend/nginx.conf.template) intercepta
      // esos tres códigos y los reemplaza por la página de mantenimiento
      // estática — un fallo real de este endpoint (SMTP mal configurado, no
      // una caída del backend) quedaría disfrazado de 'sitio caído'.
      return res.status(500).json({ error: 'No se pudo enviar tu solicitud. Intenta de nuevo en unos minutos.' });
    }

    res.json({ ok: true, numero });
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

// Punto 342: folio corto de conciliación de transferencias — mismo
// patrón que generarFolio/generarNumeroCompra (AUTO_INCREMENT + relleno
// con ceros), pero SIN guion y con el prefijo configurable de 2 letras
// (folio_conciliacion_prefijo), en vez de un prefijo fijo — ej. "CV0047".
function generarFolioConciliacion(prefijo, id) {
  return `${prefijo}${String(id).padStart(4, '0')}`;
}

// Quién registró una venta (punto 320) — para reportes/aclaraciones, NUNCA
// se muestra en la sección de Ventas. Prioridad explícita para cuentas
// administrador/fiscal/ventas (mecanismo "perfil_bd"): nombre real (Mi
// Cuenta) primero, correo si no lo capturó — JAMÁS su "rfc" (que para
// estos 3 perfiles es solo un nombre de usuario de login, no una
// identidad fiscal, ver server.js donde se crea el usuario). Para
// ADMIN_USERS/usuario compartido de sucursal/credencial API, ya es un
// identificador propio (no hay "rfc" que ocultar), se usa tal cual.
function resolverCreadoPorVenta(req) {
  if (req.adminMecanismo === 'perfil_bd') {
    const nombre = (req.adminNombre || '').trim();
    if (nombre) return nombre;
    return req.adminEmail || null;
  }
  return req.adminUser || null;
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
// Multi-tenant: si la petición ya resolvió un tenant (req.tenant, puesto
// por resolverTenantMiddleware), la URL pública real de ese tenant es
// SIEMPRE .../<slug>, no la raíz — las rutas del frontend para un tenant
// viven ahí (nginx + resolverTenantMiddleware ya sirven /<slug>/login,
// /<slug>/admin, etc. de punta a punta, ver PROJECT_STATE.md segmento 4).
// Antes de este fix, todo enlace armado con esta función (invitación,
// notificación de ticket nuevo, correo de venta) llegaba SIN el slug en
// instalaciones con tenant — un bug real, no solo de recuperación de
// contraseña (corregido aquí una sola vez para los 5 llamadores).
function detectarUrlPortal(req) {
  const base = req.get('host') ? `${req.protocol}://${req.get('host')}` : '';
  if (!base) return '';
  const slug = req.tenant && req.tenant.slug;
  return slug ? `${base}/${slug}` : base;
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

// Límites de período por zona horaria: `limitesDia()` (punto 362, tarjetas
// de Inicio) y `limitesMes()` (resumen de KPIs de Gastos y resumen
// financiero) viven en utils/limitesPeriodo.js y devuelven DOS familias de
// valores — `instantes` (Date en UTC para columnas DATETIME) y `fechas`
// ("YYYY-MM-DD" locales para columnas DATE como gastos.fecha). Usar la
// equivocada corre la ventana 6 h y saca de "hoy" todo lo de after de 18:00.

// Etiqueta corta en español ("Ene", "Feb", …) para una llave "YYYY-MM" —
// usada por el resumen financiero para la serie mensual de la gráfica.
function etiquetaMes(llave) {
  const [anio, mes] = llave.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, 1));
  const corta = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(fecha).replace('.', '');
  return corta.charAt(0).toUpperCase() + corta.slice(1);
}

app.post('/api/tickets', requireUserAuth, requiereFeature('facturacionHabilitada'), submitLimiter, (req, res) => {
  subirConTenant(uploadImagen, 'imagen', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `La imagen excede el tamaño máximo permitido de ${IMAGEN_MAX_MB_MAX} MB.`,
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

      // Punto 370: uploadImagen acepta hasta el techo de seguridad
      // genérico (IMAGEN_MAX_MB_MAX); el máximo REAL configurable desde
      // /control se valida aquí a mano, igual que marca-logo/favicon.
      const imagenMaxMbTicket = await obtenerImagenMaxMbCacheado();
      if (req.file.size > imagenMaxMbTicket * 1024 * 1024) {
        return res.status(413).json({
          error: `La imagen excede el tamaño máximo permitido de ${imagenMaxMbTicket} MB.`,
        });
      }

      // Punto 347: cuota de disco impuesta desde /control — mismo criterio
      // que la imagen de producto de Inventarios y la constancia de
      // /api/registro (usa SIEMPRE el caché, nunca mide en vivo; sin cuota
      // o sin caché todavía nunca bloquea).
      if (
        req.tenant &&
        req.tenant.discoCuotaMb != null &&
        req.tenant.discoBytesUsadosCache != null &&
        req.tenant.discoBytesUsadosCache >= req.tenant.discoCuotaMb * 1024 * 1024
      ) {
        return res.status(413).json({
          error: 'DISCO_CUOTA_EXCEDIDA',
          mensaje: 'Esta empresa ya alcanzó su cuota de espacio — contacta a soporte para ampliarla.',
        });
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

        // Cuentas por cobrar (§ regla de negocio, ver PROJECT_STATE.md): una
        // venta con saldo pendiente no se puede facturar todavía. estado_pago
        // solo avanza pendiente -> pagada (ver PUT /:id/cobro), nunca al
        // revés, así que no hace falta revalidar esto de nuevo más adelante
        // (ej. al subir la factura desde /admin) — si el ticket llegó a
        // crearse es porque en ese momento la venta ya estaba pagada, y no
        // hay forma de que deje de estarlo después.
        if (ordenCompra.estado_pago === 'pendiente') {
          return res.status(400).json({
            error: 'Esta venta tiene saldo pendiente por cobrar. No se puede facturar hasta liquidar el pago completo.',
            codigo: 'PAGO_PENDIENTE',
          });
        }

        // No se puede volver a facturar la misma orden de compra. Se
        // considera "ya facturada" leyendo `facturado_en` (hecho
        // histórico permanente en la propia orden, ver bug corregido
        // 2026-09-02) — antes se buscaba un ticket 'listo' en vivo, que
        // dejaba de encontrarse en cuanto la retención lo purgaba,
        // permitiendo re-facturar una orden que sí ya se había facturado.
        if (ordenCompra.facturado_en) {
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
      (async () => {
        const configGlobalContador = await getConfiguracionGlobal();
        await notificarNuevoTicketAlContador(
          req.userRfc,
          folio,
          urlPortalTicket,
          marcaDelTenant(req),
          logoUrlDelTenant(req, urlPortalTicket, configGlobalContador),
          coloresCorreoTenant(req)
        );
      })().catch((err) => {
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
// Punto 244 (mapeo con CLARVO_Planes.md): "marcaLookfeelHabilitado"
// (apagable desde /control) es el gate real de marca+Look & Feel — con
// el switch apagado, se cae a la identidad CLARVO por defecto aunque el
// tenant tenga marca/tema_json capturados en la fila.
function marcaLookfeelHabilitadoDelTenant(req) {
  return !req || !req.tenant || req.tenant.marcaLookfeelHabilitado !== false;
}

function marcaDelTenant(req) {
  if (!marcaLookfeelHabilitadoDelTenant(req)) return MARCA_DEFECTO;
  return (req && req.tenant && req.tenant.marca) || MARCA_DEFECTO;
}

// Color de marca para los correos homologados (ver construirCorreoBase):
// reutiliza el mismo Look & Feel que ya edita cada tenant desde /control
// (segmento 105, tema_json.colores.accentDark/accent, ya validado contra
// contraste WCAG AA para texto blanco sobre ellos) — cero UI nueva, cero
// columna nueva. Sin tema personalizado (o si el JSON guardado no trae
// esos dos colores), cae al navy/cyan de CLARVO, igual que ya hace el
// ticket de venta.
function coloresCorreoTenant(req) {
  let tema = null;
  try {
    if (marcaLookfeelHabilitadoDelTenant(req) && req && req.tenant && req.tenant.temaJson) {
      tema = parsearTemaDesdeFila({ tema_json: req.tenant.temaJson, slug: req.tenant.slug });
    }
  } catch (err) {
    tema = null; // tema_json corrupto: se degrada al color por defecto, nunca rompe el correo
  }
  const colores = (tema && tema.colores) || {};
  return {
    primario: colores.accentDark || '#03285B',
    acento: colores.accent || '#05DBF2',
  };
}

// Misma resolución de logo que ya usa la confirmación de venta (logo del
// tenant si configuró uno en "Marca"; si no, el logo global de la
// configuración fiscal) — extraída aquí para no repetirla en cada correo
// nuevo que se homologa al mismo diseño.
function logoUrlDelTenant(req, urlPortal, configGlobal) {
  const marcaLogoUrl = marcaLookfeelHabilitadoDelTenant(req) && req && req.tenant && req.tenant.marcaLogoUrl;
  if (marcaLogoUrl && urlPortal) return `${urlPortal}${marcaLogoUrl}`;
  return (configGlobal && configGlobal.logo_url) || null;
}

// Arma el correo de confirmación de una orden de compra, con diseño
// tipo "ticket" (recibo) — pensado para que el cliente lo identifique de
// un vistazo como comprobante, guarde el No. Compra, y sepa exactamente
// qué sigue: entrar al portal y subir su ticket para pedir la factura.
// Devuelve tanto la versión HTML (el ticket en sí) como una versión de
// texto plano equivalente (ver la nota en utils/email.js sobre por qué
// siempre se manda ambas).
function construirCorreoOrdenCompra({ numeroCompra, fechaFormateada, concepto, cantidad, ivaPorcentaje, total, descuentoPorcentaje, descuentoMonto, email, urlPortal, logoUrl, marca, cuerpoVenta, metodoPago, folioConciliacion }) {
  const enlaceLogin = urlPortal ? `${urlPortal}/login` : '';
  const logo = logoTicketHtml(logoUrl, marca);
  const filaTicket = filaCorreoTabla;
  // Punto 227: "Cantidad" en este correo YA es el subtotal neto (con el
  // descuento aplicado, si hubo uno) — la fila de descuento es solo
  // informativa, no cambia el cálculo del Total que el cliente debe
  // capturar al pedir su factura.
  const filaDescuentoHtml = descuentoPorcentaje
    ? filaTicket(`Descuento (${descuentoPorcentaje}%)`, `-$${descuentoMonto.toFixed(2)} MXN`)
    : '';
  const filaDescuentoTexto = descuentoPorcentaje
    ? `Descuento (${descuentoPorcentaje}%): -$${descuentoMonto.toFixed(2)} MXN\n`
    : '';

  // Punto 342: bloque destacado del folio de conciliación — solo cuando
  // el método de pago fue "transferencia" y ya se generó un folio real
  // (ver POST /admin/folios-conciliacion). Mismo tono cian que ya usa el
  // resto del correo (degradado del encabezado), para que se note sin
  // competir con el TOTAL.
  const bloqueConceptoHtml = metodoPago === 'transferencia' && folioConciliacion
    ? `
      <tr>
        <td style="padding:0 28px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E6F1F8; border-radius:10px;">
            <tr>
              <td style="padding:14px 16px; text-align:center;">
                <p style="margin:0 0 3px; font-size:11.5px; color:#5B6472;">Concepto para tu transferencia</p>
                <p style="margin:0; font-size:19px; font-weight:bold; letter-spacing:0.04em; color:#0B1320; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtmlCorreo(folioConciliacion)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';
  const bloqueConceptoTexto = metodoPago === 'transferencia' && folioConciliacion
    ? `Concepto para tu transferencia: ${folioConciliacion}\n\n`
    : '';

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
                ${filaDescuentoHtml}
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
          ${bloqueConceptoHtml}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 10px 0;">
        ${formatearParrafosCuerpo(aplicarPlantilla(cuerpoVenta, { numero_venta: numeroCompra }))
          .map((p) => `<p style="margin:0 0 14px; font-size:14.5px; line-height:1.55; color:#2A3342;">${p}</p>`)
          .join('')}
        ${enlaceLogin ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto;">
          <tr>
            <td style="border-radius:8px; background:#03285B;">
              <a href="${enlaceLogin}" style="display:inline-block; padding:12px 28px; font-size:14.5px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px;">Iniciar sesión y solicitar mi factura</a>
            </td>
          </tr>
        </table>` : ''}
        <p style="margin:18px 0 0; font-size:12.5px; line-height:1.5; color:#8A93A3; text-align:center;">Si no esperabas este correo, contacta a tu administrador. Portal Clarvo tu negocio en orden.</p>
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
    filaDescuentoTexto +
    `IVA (${ivaPorcentaje}%): $${(total - cantidad).toFixed(2)} MXN\n` +
    `TOTAL A FACTURAR: $${total.toFixed(2)} MXN\n` +
    `Correo: ${email}\n\n` +
    bloqueConceptoTexto +
    `${String(aplicarPlantilla(cuerpoVenta, { numero_venta: numeroCompra }) ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n\n')}\n\n` +
    (enlaceLogin ? `Inicia sesión aquí para solicitar tu factura: ${enlaceLogin}\n\n` : '') +
    `Si no esperabas este correo, contacta a tu administrador.`;

  return { html, texto, adjuntos: logo.adjunto ? [logo.adjunto] : [] };
}

// Envía el correo de confirmación al cliente cuando se registra una orden
// de compra. "Fire-and-forget", mismo criterio que el resto de los
// correos de esta app: si falla (SMTP sin configurar, etc.), la orden ya
// se guardó correctamente de todas formas.
async function enviarCorreoOrdenCompra(datos) {
  // Punto 335: mismo mecanismo de plantilla editable que el resto de
  // PLANTILLAS_CORREO (cuerpo_venta), aplicado a los 2 párrafos de este
  // correo — el diseño de recibo (tabla de datos, borde punteado) sigue
  // fijo, ver construirCorreoOrdenCompra.
  const configSmtpVenta = await getConfigSmtp();
  const cuerpoVenta = (configSmtpVenta && configSmtpVenta.cuerpo_venta) || DEFAULTS_SMTP.cuerpo_venta;
  const { html, texto, adjuntos } = construirCorreoOrdenCompra({ ...datos, cuerpoVenta });
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

async function enviarInvitacionPortal({ email, rfc, password, perfil, urlPortal, marca, logoUrl, colores }) {
  const perfilTexto = PERFIL_TEXTO[perfil] || perfil;
  const marcaCorreo = marca || MARCA_DEFECTO;
  // Punto 214: texto personalizable por el administrador (super), mismo
  // mecanismo que cuerpo_cliente — cae al default si no se configuró.
  const configSmtpCorreo = await getConfigSmtp();
  const cuerpoInvitacion = aplicarPlantilla(
    (configSmtpCorreo && configSmtpCorreo.cuerpo_invitacion) || DEFAULTS_SMTP.cuerpo_invitacion,
    { perfil: perfilTexto, usuario: rfc }
  );

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

  // Homologado al diseño del ticket de venta (auditoría de correos de
  // salida): mismo cascarón, logo y color de marca del tenant. Si por
  // alguna razón no se pudo detectar el host de la petición, se omite el
  // botón en vez de mandar una URL rota — el usuario/contraseña siguen
  // siendo suficientes para entrar manualmente.
  const { html, texto, adjuntos } = construirCorreoBase({
    marca: marcaCorreo,
    logoUrl,
    colorPrimario: colores && colores.primario,
    colorAccent: colores && colores.acento,
    eyebrow: 'Bienvenido',
    titulo: 'Tu cuenta ya está lista',
    filas: [
      { etiqueta: 'Perfil', valor: escapeHtmlCorreo(perfilTexto) },
      { etiqueta: 'Usuario', valor: escapeHtmlCorreo(rfc) },
      { etiqueta: 'Contraseña temporal', valor: escapeHtmlCorreo(password), destacado: true },
    ],
    parrafos: formatearParrafosCuerpo(cuerpoInvitacion),
    cta: enlacePortal ? { href: enlacePortal, texto: `Entrar al ${etiquetaAcceso}` } : null,
    // Punto 211: la invitación al portal DEL CLIENTE mantiene el logo
    // viejo — es la misma marca que va a ver en cuanto entre a
    // login.html/dashboard.html, sin ese cambio de logo se sentiría
    // como una marca distinta a mitad del camino. administrador/fiscal
    // sí ven el logo nuevo (entran al panel /admin, que ya lo usa).
    usarLogoLegacy: perfil === 'cliente',
  });

  await enviarCorreo({
    destinatario: email,
    asunto: 'Te invitamos a Portal Clarvo tu negocio en orden',
    cuerpo: texto,
    html,
    adjuntos,
  });
}

// Duración del token del enlace de recuperación de contraseña — 30
// minutos, mismo criterio estándar que usan la mayoría de los flujos de
// "olvidé mi contraseña" (suficiente para revisar el correo sin dejar la
// ventana de ataque abierta mucho tiempo).
const DURACION_TOKEN_RECUPERACION_MS = 30 * 60 * 1000;

// Correo de "recupera tu acceso" — sirve TANTO a clientes como a cuentas
// administrador/fiscal (misma tabla `usuarios`, mismo token), el enlace
// de destino es siempre /restablecer?token=... (una sola página nueva que
// no distingue perfil todavía); el perfil solo decide a dónde mandar al
// usuario DESPUÉS de que ya puso su nueva contraseña (ver
// POST /api/auth/restablecer, que sí devuelve el perfil). Mismo patrón de
// URL con slug que enviarInvitacionPortal.
async function enviarCorreoRecuperacion({ email, urlPortal, marca, token, logoUrl, colores }) {
  const marcaCorreo = marca || MARCA_DEFECTO;
  const enlaceRestablecer = urlPortal ? `${urlPortal}/restablecer?token=${token}` : '';
  // Sin host detectable no hay forma de armar un enlace usable — mejor no
  // mandar un correo roto que el usuario no pueda seguir.
  if (!enlaceRestablecer) return;

  // Punto 214: texto personalizable por el administrador (super).
  const configSmtpCorreo = await getConfigSmtp();
  const cuerpoRecuperacion = aplicarPlantilla(
    (configSmtpCorreo && configSmtpCorreo.cuerpo_recuperacion) || DEFAULTS_SMTP.cuerpo_recuperacion,
    {}
  );

  // Homologado al diseño del ticket de venta (auditoría de correos de
  // salida) — antes era HTML mínimo en Arial genérico, sin logo real ni
  // color de marca.
  const { html, texto, adjuntos } = construirCorreoBase({
    marca: marcaCorreo,
    logoUrl,
    colorPrimario: colores && colores.primario,
    colorAccent: colores && colores.acento,
    eyebrow: 'Seguridad',
    titulo: 'Recupera tu acceso',
    parrafos: formatearParrafosCuerpo(cuerpoRecuperacion),
    cta: { href: enlaceRestablecer, texto: 'Elegir nueva contraseña' },
    piePersonalizado: `Este enlace expira en 30 minutos y solo se puede usar una vez. Si el botón no funciona, copia y pega: ${enlaceRestablecer}`,
  });

  await enviarCorreo({
    destinatario: email,
    asunto: 'Recupera tu acceso — Portal Clarvo tu negocio en orden',
    cuerpo: texto,
    html,
    adjuntos,
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
async function notificarNuevoTicketAlContador(rfc, folio, urlPortal, marca, logoUrl, colores) {
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

  // Homologado al diseño del ticket de venta (auditoría de correos de
  // salida): lo ve el contador del tenant, un tercero externo — primera
  // impresión de marca frente a alguien fuera de la empresa.
  // Punto 214: texto personalizable por el administrador (super) — `config`
  // ya está en scope (se leyó arriba para `correo_contador`), no hace
  // falta una segunda consulta.
  const cuerpoAvisoContador = aplicarPlantilla(
    (config && config.cuerpo_aviso_contador) || DEFAULTS_SMTP.cuerpo_aviso_contador,
    { rfc, folio }
  );

  const { html, texto, adjuntos } = construirCorreoBase({
    marca: marcaCorreo,
    logoUrl,
    colorPrimario: colores && colores.primario,
    colorAccent: colores && colores.acento,
    eyebrow: 'Facturación',
    titulo: 'Nuevo ticket para facturar',
    filas: [
      { etiqueta: 'RFC', valor: escapeHtmlCorreo(rfc) },
      { etiqueta: 'Folio', valor: escapeHtmlCorreo(folio), destacado: true },
    ],
    parrafos: formatearParrafosCuerpo(cuerpoAvisoContador),
    cta: enlacePanel ? { href: enlacePanel, texto: 'Ir al panel' } : null,
  });

  await enviarCorreo({
    destinatario: correoContador,
    asunto: `Nuevo ticket para facturar — Folio ${folio}`,
    cuerpo: texto,
    html,
    adjuntos,
  });
}

// Lista los tickets del RFC de la sesion actual (nunca los de otro RFC).
app.get(
  '/api/tickets',
  requireUserAuth,
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
  asyncHandler(async (req, res) => {
    const dias = await getRetencionTicketsDias();
    res.json({ dias });
  })
);

// Pública (sin autenticación, sin requiereFeature a propósito — este
// endpoint es precisamente lo que le dice al formulario de registro si
// Facturación está activa, así que no puede depender de esa misma
// bandera): informa al panel de registro de login.html si debe pedir
// RFC/CSF o solo correo+teléfono. Sin datos sensibles — un solo booleano
// que ya es público indirectamente (el usuario lo deduce intentando
// entrar a /tickets o /csf de todas formas).
app.get(
  '/api/config/registro',
  asyncHandler(async (req, res) => {
    res.json({ facturacionHabilitada: !req.tenant || req.tenant.facturacionHabilitada !== false });
  })
);

// Busca un registro existente por RFC (llave de identificación principal,
// ya que es un identificador único del contribuyente) y, si no hay RFC o no
// coincide, cae de vuelta al correo (retrocompatibilidad con registros
// creados cuando el RFC era opcional o no se capturaba). Usado por el
// formulario público para mostrar la vista previa antes de reemplazar.
// IMPORTANTE: esta ruta debe declararse ANTES que "/api/registro/:email",
// o Express interpretaría "buscar" como el valor del parámetro :email.
// submitLimiter (Seguridad, ver auditoría OWASP) + PII acotada (auditoría
// 2026-09-03, hallazgo #3): esta ruta sigue siendo pública y sin sesión
// —es necesaria para que el formulario público muestre "ya existe una
// constancia con estos datos" ANTES de que exista una cuenta/sesión con la
// que proteger el endpoint— pero ya no devuelve TODO el registro. Antes
// exponía también `email`/`indicaciones`/`archivo_mime`, ninguno de los
// 3 usado por el frontend (`app.js:mostrarModalConDatosPrevios` solo lee
// nombre/tipo_persona/rfc/archivo_nombre_original/actualizado_en) — se
// recortó a exactamente esos 5 campos. `indicaciones` en particular es
// texto libre que podría contener notas internas, sin ninguna razón de
// negocio para exponerlo aquí. El límite de tasa (30 req/15min) sigue
// siendo la defensa principal contra raspado masivo — reducir a un
// booleano puro (como sí se hizo en la ruta legacy de abajo) rompería la
// vista previa de "esto es lo que se va a reemplazar" que el formulario
// necesita mostrarle al usuario ANTES de confirmar.
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

    const columnas = `nombre, tipo_persona, rfc, archivo_nombre_original, actualizado_en`;
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
// Sin llamador real en el frontend actual (verificado, auditoría
// 2026-09-03 hallazgo #3) — a diferencia de /api/registro/buscar, esta sí
// se reduce a un booleano puro sin PII, porque nada depende de que
// devuelva el detalle.
app.get(
  '/api/registro/:email',
  submitLimiter,
  asyncHandler(async (req, res) => {
    const email = String(req.params.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Correo electronico invalido.' });
    }
    const [filas] = await pool.query(
      'SELECT id FROM registros WHERE email = ? AND eliminado_en IS NULL LIMIT 1',
      [email]
    );
    return res.json({ existe: filas.length > 0 });
  })
);

app.post('/api/registro', requireUserAuth, submitLimiter, (req, res) => {
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

      // Auditoría UX 2026-09-29 / petición explícita del usuario: esta
      // ruta YA NO es pública — requireUserAuth (arriba) exige sesión
      // válida antes de llegar aquí. req.userRfc es la referencia
      // autoritativa para la validación de más abajo (el RFC de la
      // constancia debe corresponder a la cuenta con sesión); rfcRaw
      // (capturado en el formulario) queda solo como dato informativo si
      // se sigue pidiendo, nunca como sustituto de la sesión.
      const rfcReferencia = req.userRfc;

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

      // Punto 347: cuota de disco impuesta desde /control — mismo criterio
      // que la imagen de producto de Inventarios (usa SIEMPRE el caché,
      // nunca mide en vivo; sin cuota o sin caché todavía nunca bloquea).
      // Se revisa ANTES de extraer el texto del PDF (trabajo caro) para no
      // gastarlo en un archivo que de todas formas no se va a guardar.
      if (
        req.tenant &&
        req.tenant.discoCuotaMb != null &&
        req.tenant.discoBytesUsadosCache != null &&
        req.tenant.discoBytesUsadosCache >= req.tenant.discoCuotaMb * 1024 * 1024
      ) {
        return res.status(413).json({
          error: 'DISCO_CUOTA_EXCEDIDA',
          mensaje: 'Esta empresa ya alcanzó su cuota de espacio — contacta a soporte para ampliarla.',
        });
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
app.get('/api/admin/login', adminLoginLimiter, tenantAggregateAuthLimiter, requireAdminAuth, asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    usuario: req.adminUser,
    perfil: req.adminPerfil,
    debeCambiarPassword: Boolean(req.adminDebeCambiarPassword),
    // Punto 370: máximo de imagen configurable desde /control, para los
    // hints "máx. X MB" de Inventarios/Configuraciones (ver admin.js) —
    // se expone aquí, no en una ruta aparte, por el mismo motivo que
    // `funciones` de abajo: esta ruta ya corre en cada carga de página.
    imagenMaxMb: await obtenerImagenMaxMbCacheado(),
    // Punto 349-350-351 (Fase 5, ver stitch/gobierno-funcionalidades/
    // NOTAS.md): el frontend de /admin necesita saber qué funciones trae
    // el plan del tenant para OCULTAR menú/tarjetas que de todas formas
    // el backend ya bloquea con requiereFeature() (404) — sin esto, el
    // admin ve un botón que simplemente no hace nada al hacer clic. Esta
    // ruta es el único punto que YA corre en cada carga de página (login
    // Y refresh de sesión), así que es el lugar natural para exponerlo —
    // null si no hay contexto multi-tenant (sitio base/sin X-Tenant-Slug),
    // nunca bloquea nada por sí mismo (eso lo sigue haciendo el backend).
    funciones: req.tenant
      ? {
          facturacionHabilitada: req.tenant.facturacionHabilitada,
          portalClientesHabilitado: req.tenant.portalClientesHabilitado,
          sucursalesHabilitado: req.tenant.sucursalesHabilitado,
          marcaLookfeelHabilitado: req.tenant.marcaLookfeelHabilitado,
          ventasHabilitado: req.tenant.ventasHabilitado,
          gastosHabilitado: req.tenant.gastosHabilitado,
          inventariosHabilitado: req.tenant.inventariosHabilitado,
          auditoriaHabilitado: req.tenant.auditoriaHabilitado,
          cxcHabilitado: req.tenant.cxcHabilitado,
          resumenFinancieroHabilitado: req.tenant.resumenFinancieroHabilitado,
          reportesPorReporteHabilitado: req.tenant.reportesPorReporteHabilitado,
          reportesCortesHabilitado: req.tenant.reportesCortesHabilitado,
          reportesEliminadosHabilitado: req.tenant.reportesEliminadosHabilitado,
          reportesEstadoInventarioHabilitado: req.tenant.reportesEstadoInventarioHabilitado,
          reportesEstadoTicketsHabilitado: req.tenant.reportesEstadoTicketsHabilitado,
        }
      : null,
  });
}));

// Punto 362 (Inicio con datos reales, ver PROJECT_STATE.md): reemplaza el
// resumen de tickets que vivía aquí antes del punto 360/361 — ahora un
// resumen de "hoy" de cada módulo activo (Tickets/Ventas/Gastos/
// Inventario), cada uno con su propia tendencia contra el promedio de los
// 7 días anteriores (no "vs ayer": un solo día tiene demasiado ruido).
// No usa requiereFeature() a nivel de ruta (no hay UN solo módulo dueño de
// esta ruta) — cada sección se calcula o se omite por separado según el
// perfil + el flag del tenant, mismo criterio que ya usa el bloque
// "funciones" de arriba. No es una exposición de datos nueva: cada
// sección ya era visible para ese mismo perfil en su propia vista
// (Ventas/Gastos/Inventarios/Tickets) — esto solo la resume en un único
// viaje de red para la página de aterrizaje.
app.get(
  '/api/admin/inicio/resumen',
  adminApiLimiter,
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const perfil = req.adminPerfil;
    const esSuper = perfil === 'super';
    const configGlobalInicio = await getConfiguracionGlobal();
    // DOS familias de límites (ver utils/limitesPeriodo.js): `instantes`
    // para columnas DATETIME en UTC (tickets.creado_en,
    // ordenes_compra.fecha_compra, movimientos_inventario.creado_en) y
    // `fechas` ("YYYY-MM-DD" local) para gastos.fecha, que es DATE con el
    // calendario que eligió el administrador. Usar un `Date` de medianoche
    // UTC en gastos "funcionaba" por accidente y al revés: al arreglar los
    // instantes, los gastos dejaban de contar.
    const { instantes: hoyInstantes, fechas: hoyFechas } = limitesDia(configGlobalInicio.zona_horaria);
    const { inicioHoy, finHoy, inicio7d } = hoyInstantes;

    function tendencia(hoyValor, suma7dAnteriores) {
      const promedio7d = suma7dAnteriores / 7;
      if (promedio7d <= 0) {
        return hoyValor > 0 ? { texto: 'Nuevo hoy, sin historial de 7 días', direccion: 'pos' } : null;
      }
      const pct = Math.round(((hoyValor - promedio7d) / promedio7d) * 100);
      return {
        texto: `${pct > 0 ? '+' : ''}${pct}% vs prom. 7d`,
        direccion: pct > 0 ? 'pos' : pct < 0 ? 'neg' : null,
      };
    }

    const resultado = {};

    // ---------- Tickets (Facturación) ----------
    if ((esSuper || ['administrador', 'fiscal'].includes(perfil)) && (!req.tenant || req.tenant.facturacionHabilitada !== false)) {
      const [[hoyTickets]] = await pool.query(
        `SELECT COUNT(*) AS total FROM tickets WHERE eliminado_en IS NULL AND creado_en >= ? AND creado_en < ?`,
        [inicioHoy, finHoy]
      );
      const [[pendientesTickets]] = await pool.query(
        `SELECT COUNT(*) AS total FROM tickets WHERE eliminado_en IS NULL AND estatus IN ('pendiente', 'en_curso')`
      );
      const [[semana7dTickets]] = await pool.query(
        `SELECT COUNT(*) AS total FROM tickets WHERE eliminado_en IS NULL AND creado_en >= ? AND creado_en < ?`,
        [inicio7d, inicioHoy]
      );
      resultado.tickets = {
        hoy: Number(hoyTickets.total),
        pendientes: Number(pendientesTickets.total),
        tendencia: tendencia(Number(hoyTickets.total), Number(semana7dTickets.total)),
      };
    }

    // ---------- Ventas ----------
    if (
      (esSuper || ['administrador', 'ventas'].includes(perfil)) &&
      (!req.tenant || req.tenant.ventasHabilitado !== false)
    ) {
      const [[hoyVentas]] = await pool.query(
        `SELECT COUNT(*) AS total, COALESCE(SUM(total), 0) AS suma FROM ordenes_compra
         WHERE eliminado_en IS NULL AND fecha_compra >= ? AND fecha_compra < ?`,
        [inicioHoy, finHoy]
      );
      const [[semana7dVentas]] = await pool.query(
        `SELECT COALESCE(SUM(total), 0) AS suma FROM ordenes_compra
         WHERE eliminado_en IS NULL AND fecha_compra >= ? AND fecha_compra < ?`,
        [inicio7d, inicioHoy]
      );
      const [recientesVentas] = await pool.query(
        `SELECT numero_compra, email, total, fecha_compra FROM ordenes_compra
         WHERE eliminado_en IS NULL ORDER BY fecha_compra DESC LIMIT 3`
      );
      resultado.ventas = {
        hoy: { total: Number(hoyVentas.suma), count: Number(hoyVentas.total) },
        tendencia: tendencia(Number(hoyVentas.suma), Number(semana7dVentas.suma)),
        recientes: recientesVentas.map((v) => ({
          numeroCompra: v.numero_compra,
          email: v.email || null,
          total: Number(v.total),
          fechaCompra: v.fecha_compra,
        })),
      };
    }

    // ---------- Gastos ----------
    if (
      (esSuper || ['administrador', 'ventas'].includes(perfil)) &&
      (!req.tenant || req.tenant.gastosHabilitado !== false)
    ) {
      const [[hoyGastos]] = await pool.query(
        `SELECT COUNT(*) AS total, COALESCE(SUM(monto), 0) AS suma,
                SUM(CASE WHEN tiene_factura = 1 THEN 1 ELSE 0 END) AS con_factura
         FROM gastos WHERE eliminado_en IS NULL AND fecha >= ? AND fecha < ?`,
        [hoyFechas.hoy, hoyFechas.manana]
      );
      const [[semana7dGastos]] = await pool.query(
        `SELECT COALESCE(SUM(monto), 0) AS suma FROM gastos
         WHERE eliminado_en IS NULL AND fecha >= ? AND fecha < ?`,
        [hoyFechas.hace7d, hoyFechas.hoy]
      );
      const [recientesGastos] = await pool.query(
        `SELECT concepto, proveedor, monto, fecha FROM gastos
         WHERE eliminado_en IS NULL ORDER BY fecha DESC, creado_en DESC LIMIT 3`
      );
      resultado.gastos = {
        hoy: { total: Number(hoyGastos.suma), count: Number(hoyGastos.total), conFactura: Number(hoyGastos.con_factura || 0) },
        tendencia: tendencia(Number(hoyGastos.suma), Number(semana7dGastos.suma)),
        recientes: recientesGastos.map((g) => ({
          concepto: g.concepto,
          proveedor: g.proveedor || null,
          monto: Number(g.monto),
          fecha: g.fecha,
        })),
      };
    }

    // ---------- Inventario ----------
    // inventarioActivo() además del flag del plan — sin inventario activo
    // a nivel de negocio, no hay nada real que resumir (mismo criterio ya
    // usado en la campana de notificaciones, punto 356).
    const inventarioPlanPermite = !req.tenant || req.tenant.inventariosHabilitado !== false;
    if ((esSuper || ['administrador', 'inventario'].includes(perfil)) && inventarioPlanPermite && (await inventarioActivo())) {
      const [[hoyInventario]] = await pool.query(
        `SELECT
           SUM(CASE WHEN tipo IN ('compra','devolucion_cliente','inventario_inicial','ajuste_positivo') THEN 1 ELSE 0 END) AS entradas,
           SUM(CASE WHEN tipo IN ('venta','consumo_interno','merma','ajuste_negativo') THEN 1 ELSE 0 END) AS salidas,
           COUNT(*) AS total
         FROM movimientos_inventario WHERE creado_en >= ? AND creado_en < ?`,
        [inicioHoy, finHoy]
      );
      const [[semana7dInventario]] = await pool.query(
        `SELECT COUNT(*) AS total FROM movimientos_inventario WHERE creado_en >= ? AND creado_en < ?`,
        [inicio7d, inicioHoy]
      );
      const [recientesInventario] = await pool.query(
        `SELECT m.tipo, m.cantidad, m.existencia_posterior, m.creado_en, p.nombre AS producto_nombre, p.sku
         FROM movimientos_inventario m JOIN productos p ON p.id = m.producto_id
         ORDER BY m.creado_en DESC LIMIT 3`
      );
      resultado.inventario = {
        hoy: { total: Number(hoyInventario.total || 0), entradas: Number(hoyInventario.entradas || 0), salidas: Number(hoyInventario.salidas || 0) },
        tendencia: tendencia(Number(hoyInventario.total || 0), Number(semana7dInventario.total)),
        recientes: recientesInventario.map((m) => ({
          producto: m.producto_nombre,
          sku: m.sku,
          tipo: m.tipo,
          cantidad: Number(m.cantidad),
          existenciaPosterior: Number(m.existencia_posterior),
          creadoEn: m.creado_en,
        })),
      };
    }

    res.json(resultado);
  })
);

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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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

// Búsqueda en el catálogo "Clave de Producto o Servicio" (c_ClaveProdServ)
// para el autocompletar del campo "Clave SAT" en Configuraciones fiscales.
// Mismos perfiles que pueden editar ese campo (PUT /api/admin/config/global)
// — administrador y fiscal, ver ese endpoint para el porqué. Catálogo de
// EJEMPLO hasta que se confirme una fuente oficial gratuita (ver
// utils/claveProdServ.js) — `esEjemplo` en la respuesta le avisa al
// frontend para mostrar el aviso correspondiente, nunca en silencio.
app.get(
  '/api/admin/catalogo-clave-sat/buscar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'fiscal'),
  asyncHandler(async (req, res) => {
    const termino = sanitizeText(req.query.q, 200);
    const resultados = await buscarClaveProdServ(termino);
    res.json({ resultados });
  })
);

app.get(
  '/api/admin/catalogo-clave-sat/info',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'fiscal'),
  asyncHandler(async (req, res) => {
    res.json(await getInfoCatalogoClaveProdServ());
  })
);

// Sincroniza el catálogo desde CLAVE_PROD_SERV_SYNC_URL — NUNCA acepta una
// URL desde la petición, mismo criterio de seguridad que
// /catalogos/uso-cfdi/actualizar (evita exponer un punto de fetch a URLs
// arbitrarias). Sin esa variable configurada, responde 502 con un mensaje
// claro; el catálogo de ejemplo sigue funcionando mientras tanto.
app.post(
  '/api/admin/catalogo-clave-sat/actualizar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'fiscal'),
  async (req, res) => {
    try {
      const catalogo = await sincronizarClaveProdServDesdeOrigen();
      const info = await getInfoCatalogoClaveProdServ();
      res.json({
        ok: true,
        mensaje: `Catálogo actualizado: ${catalogo.length} claves de producto/servicio.`,
        ...info,
      });
    } catch (err) {
      res.status(502).json({
        error: err.message || 'No se pudo sincronizar el catálogo. Intenta de nuevo más tarde.',
      });
    }
  }
);

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
    // El cuerpo de estos correos va dentro de un correo real, no de
    // nuestras propias páginas — se usa sanitizeTextoLibre (sin escape de
    // HTML) para no corromper el texto que verá el destinatario. Punto 214:
    // mismo criterio que cuerpo_cliente, extendido a los otros 4 correos
    // que comparten el cascarón de marca.
    const cuerpoCliente = sanitizeTextoLibre(body.cuerpo_cliente, 5000);
    const cuerpoInvitacion = sanitizeTextoLibre(body.cuerpo_invitacion, 5000);
    const cuerpoRecuperacion = sanitizeTextoLibre(body.cuerpo_recuperacion, 5000);
    const cuerpoAvisoContador = sanitizeTextoLibre(body.cuerpo_aviso_contador, 5000);
    const cuerpoReporte = sanitizeTextoLibre(body.cuerpo_reporte, 5000);
    const cuerpoVenta = sanitizeTextoLibre(body.cuerpo_venta, 5000);
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
      cuerpo_invitacion: cuerpoInvitacion,
      cuerpo_recuperacion: cuerpoRecuperacion,
      cuerpo_aviso_contador: cuerpoAvisoContador,
      cuerpo_reporte: cuerpoReporte,
      cuerpo_venta: cuerpoVenta,
    });
    res.json(configSmtpParaMostrar(nuevo));
  })
);

// Punto 214: vista previa REAL de una plantilla — arma el HTML con la
// MISMA función que usa el envío real (construirCorreoBase), con datos de
// ejemplo en vez de los de un ticket/usuario real. El administrador nunca
// ve ni controla el logo/colores/estructura como código: solo manda el
// texto del párrafo, el servidor decide todo lo demás — el branding queda
// garantizado por construcción, no por convención de la UI.
const PLANTILLAS_CORREO_PREVIEW = {
  invitacion: () => ({
    eyebrow: 'Bienvenido',
    titulo: 'Tu cuenta ya está lista',
    filas: [
      { etiqueta: 'Perfil', valor: 'Administrador' },
      { etiqueta: 'Usuario', valor: 'EJEMPLO001' },
      { etiqueta: 'Contraseña temporal', valor: 'Ab3xY9zQ', destacado: true },
    ],
    cta: { href: '#', texto: 'Entrar al Panel de administración' },
    variables: { perfil: 'Administrador', usuario: 'EJEMPLO001' },
  }),
  recuperacion: () => ({
    eyebrow: 'Seguridad',
    titulo: 'Recupera tu acceso',
    filas: [],
    cta: { href: '#', texto: 'Elegir nueva contraseña' },
    variables: {},
  }),
  aviso_contador: () => ({
    eyebrow: 'Facturación',
    titulo: 'Nuevo ticket para facturar',
    filas: [
      { etiqueta: 'RFC', valor: 'XAXX010101000' },
      { etiqueta: 'Folio', valor: 'TK-000123', destacado: true },
    ],
    cta: { href: '#', texto: 'Ir al panel' },
    variables: { rfc: 'XAXX010101000', folio: 'TK-000123' },
  }),
  cliente: () => ({
    eyebrow: 'Facturación',
    titulo: 'Factura lista',
    filas: [],
    cta: { href: '#', texto: 'Entrar al Portal' },
    variables: { folio: 'TK-000123', rfc: 'XAXX010101000', marca: 'CLARVO by ADDV' },
  }),
  reporte: () => ({
    eyebrow: 'Reportes',
    titulo: 'Reporte de tickets y ventas',
    filas: [
      { etiqueta: 'Tickets', valor: '12' },
      { etiqueta: 'Ventas', valor: '8' },
      { etiqueta: 'Gastos', valor: '5' },
    ],
    cta: null,
    variables: { fecha: '05/sep/2026', hora: '18:30:00' },
  }),
};

app.post(
  '/api/admin/config/smtp/preview',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const tipo = sanitizeText(body.tipo, 30);
    const texto = sanitizeTextoLibre(body.texto, 5000);

    // Punto 335: "venta" no pasa por el cascarón genérico construirCorreoBase
    // (tiene su propio diseño de recibo, ver construirCorreoOrdenCompra) —
    // la vista previa llama a la función real con datos de ejemplo, para
    // que se vea EXACTAMENTE como el correo que de verdad recibe el
    // cliente, no la tarjeta genérica de los otros 5.
    if (tipo === 'venta') {
      const { html } = construirCorreoOrdenCompra({
        numeroCompra: 'OC-000123',
        fechaFormateada: { fecha: '05/sep/2026', hora: '18:30' },
        concepto: 'Colegiatura mensual',
        cantidad: 3400,
        ivaPorcentaje: 16,
        total: 3944,
        descuentoPorcentaje: null,
        descuentoMonto: null,
        email: 'ejemplo@correo.com',
        urlPortal: '#',
        logoUrl: null,
        marca: MARCA_DEFECTO,
        cuerpoVenta: texto,
      });
      return res.json({ html });
    }

    const generador = PLANTILLAS_CORREO_PREVIEW[tipo];
    if (!generador) {
      return res.status(400).json({ error: 'Tipo de plantilla no reconocido.' });
    }
    const { eyebrow, titulo, filas, cta, variables } = generador();
    const cuerpoConVariables = aplicarPlantilla(texto, variables);
    const { html } = construirCorreoBase({
      marca: MARCA_DEFECTO,
      eyebrow,
      titulo,
      filas,
      cta,
      parrafos: formatearParrafosCuerpo(cuerpoConVariables),
    });
    res.json({ html });
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
      // Un envío real exitoso es al menos tan buena señal como el handshake
      // de "Verificar conexión ahora" — se registra el mismo timestamp.
      const verificadoEn = await marcarSmtpVerificado();
      res.json({ ok: true, mensaje: `Correo de prueba enviado a ${destinatario}.`, verificadoEn });
    } catch (err) {
      // 500, no 502 — un 502 aquí lo intercepta el error_page global de
      // nginx (proxy_intercept_errors, ver frontend/nginx.conf.template) y
      // lo disfraza de "sitio caído" (mismo bug ya corregido en
      // /api/aclaraciones, PROJECT_STATE.md punto 170). Esto es un fallo de
      // negocio (credenciales/host malos), no de infraestructura.
      res.status(500).json({ error: err.message || 'No se pudo enviar el correo de prueba.' });
    }
  })
);

// Handshake de solo-verificación (sin enviar correo) contra la
// configuración YA GUARDADA — acción ligera para confirmar host/puerto/
// credenciales sin depender de tener un destinatario a la mano.
app.post(
  '/api/admin/config/smtp/verificar',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea(),
  asyncHandler(async (req, res) => {
    try {
      const verificadoEn = await verificarConexionSmtp();
      res.json({ ok: true, verificadoEn });
    } catch (err) {
      // 500, no 502 — mismo motivo que /prueba arriba.
      res.status(500).json({ error: err.message || 'No se pudo verificar la conexión SMTP.' });
    }
  })
);


// función siempre tienen eliminado_en = NULL, así que aparecen igual que
// antes en la vista de activos.
app.get(
  '/api/admin/registros',
  adminApiLimiter,
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
// creadas desde este mismo panel. Filtro opcional ?perfil=cliente|administrador|fiscal|ventas.
app.get(
  '/api/admin/usuarios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const perfil = sanitizeText(req.query.perfil, 20);
    const perfilesValidos = ['cliente', 'administrador', 'fiscal', 'ventas', 'inventario'];

    let sql = `SELECT id, rfc, telefono, email, debe_cambiar_password, perfil, activo, suspendido_motivo, creado_en, actualizado_en FROM usuarios`;
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
// "administrador", "fiscal" o "ventas" — no hay registro público para esos
// perfiles, a propósito, para que solo un administrador ya autenticado
// pueda otorgar ese nivel de acceso. Para "cliente", el campo se valida
// como un RFC real; para los otros 3, se trata como un nombre de usuario
// flexible (no todos tienen o quieren usar su RFC real para esto).
app.post(
  '/api/admin/usuarios',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const perfil = sanitizeText(body.perfil, 20);
    const perfilesValidos = ['cliente', 'administrador', 'fiscal', 'ventas', 'inventario'];
    if (!perfilesValidos.includes(perfil)) {
      return res.status(400).json({ error: 'Selecciona un perfil válido (cliente, administrador, fiscal o ventas).' });
    }

    // Facturación apagada en este tenant: el RFC deja de pedirse para
    // perfil "cliente" (no tiene para qué facturar) — se genera un
    // identificador interno en su lugar. No aplica a administrador/
    // fiscal/ventas/inventario: para esos perfiles el campo es un
    // nombre de usuario, nunca un RFC real, sin relación con Facturación.
    const facturacionActiva = !req.tenant || req.tenant.facturacionHabilitada !== false;
    let rfc = sanitizeText(body.rfc, 50).toUpperCase();
    if (perfil === 'cliente') {
      if (facturacionActiva && !isValidRFCRequerido(rfc)) {
        return res.status(400).json({ error: 'Ingresa un RFC válido.' });
      }
      if (!facturacionActiva) {
        rfc = await generarIdentificadorSinFiscalUnico();
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

    // Punto 244 (mapeo con CLARVO_Planes.md): cuota de cuentas de panel
    // (administrador/fiscal/ventas/inventario) por tenant, configurada
    // desde /control. Nunca aplica a "cliente" (esas cuentas son la base
    // de clientes del negocio, no "asientos" del plan) ni al sitio base
    // (sin req.tenant, sin cuota — comportamiento de siempre).
    const PERFILES_CUOTA = ['administrador', 'fiscal', 'ventas', 'inventario'];
    if (req.tenant && req.tenant.maxUsuarios != null && PERFILES_CUOTA.includes(perfil)) {
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM usuarios WHERE perfil IN (${PERFILES_CUOTA.map(() => '?').join(',')})`,
        PERFILES_CUOTA
      );
      if (total >= req.tenant.maxUsuarios) {
        return res.status(400).json({
          error: `Llegaste al máximo de ${req.tenant.maxUsuarios} usuarios de panel permitidos para esta empresa. Contacta a soporte para ampliar tu cuota.`,
          codigo: 'CUOTA_USUARIOS_EXCEDIDA',
        });
      }
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
    (async () => {
      const configGlobalInvitacion = await getConfiguracionGlobal();
      await enviarInvitacionPortal({
        email,
        rfc,
        password,
        perfil,
        urlPortal,
        marca: marcaDelTenant(req),
        logoUrl: logoUrlDelTenant(req, urlPortal, configGlobalInvitacion),
        colores: coloresCorreoTenant(req),
      });
    })().catch((err) => {
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
    const perfilesValidos = ['cliente', 'administrador', 'fiscal', 'ventas', 'inventario'];
    if (!perfilesValidos.includes(perfil)) {
      return res.status(400).json({ error: 'Selecciona un perfil válido (cliente, administrador, fiscal o ventas).' });
    }

    // Facturación apagada: el RFC de un cliente no se toca en la edición
    // — ni se exige uno nuevo ni se regenera el identificador interno que
    // ya tenga, se conserva tal cual estaba (si en algún momento tuvo un
    // RFC real capturado con Facturación activa, editarlo ahora con
    // Facturación apagada NO debe borrarlo).
    const facturacionActiva = !req.tenant || req.tenant.facturacionHabilitada !== false;
    let rfc = sanitizeText(body.rfc, 50).toUpperCase();
    if (perfil === 'cliente') {
      if (!facturacionActiva) {
        rfc = usuarioActual.rfc;
      } else if (!isValidRFCRequerido(rfc)) {
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
    // por accidente, cambiando su propio perfil de administrador/fiscal/
    // ventas a cliente mientras tiene la sesión iniciada con esa misma
    // cuenta — mismo espíritu que ya protege a DELETE /api/admin/usuarios/:id
    // contra la auto-eliminación.
    if (
      usuarioActual.rfc === req.adminUser &&
      ['administrador', 'fiscal', 'ventas'].includes(usuarioActual.perfil) &&
      perfil === 'cliente'
    ) {
      return res.status(400).json({
        error: 'No puedes cambiar tu propio perfil a "cliente" mientras tienes la sesión iniciada — perderías acceso al panel.',
      });
    }

    // Punto 244: mismo cierre de cuota que POST /api/admin/usuarios —
    // sin esto, editar una cuenta "cliente" ya existente a
    // administrador/fiscal/ventas sería una forma de saltarse el límite
    // configurado en /control. Solo aplica cuando este PUT agrega una
    // cuenta NUEVA a la cuota (el perfil anterior no contaba, el nuevo sí).
    const PERFILES_CUOTA_EDIT = ['administrador', 'fiscal', 'ventas'];
    if (
      req.tenant &&
      req.tenant.maxUsuarios != null &&
      PERFILES_CUOTA_EDIT.includes(perfil) &&
      !PERFILES_CUOTA_EDIT.includes(usuarioActual.perfil)
    ) {
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM usuarios WHERE perfil IN (${PERFILES_CUOTA_EDIT.map(() => '?').join(',')})`,
        PERFILES_CUOTA_EDIT
      );
      if (total >= req.tenant.maxUsuarios) {
        return res.status(400).json({
          error: `Llegaste al máximo de ${req.tenant.maxUsuarios} usuarios de panel permitidos para esta empresa. Contacta a soporte para ampliar tu cuota.`,
          codigo: 'CUOTA_USUARIOS_EXCEDIDA',
        });
      }
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

// Suspende/reactiva una cuenta sin borrarla — aplica a los 4 perfiles
// (cliente, ventas, fiscal, administrador). Una cuenta suspendida sigue
// contando contra la cuota de usuarios de panel del tenant (no libera el
// "asiento", igual que un empleado suspendido no libera su licencia hasta
// darlo de baja de verdad) — decisión explícita, ver PROJECT_STATE.md.
app.put(
  '/api/admin/usuarios/:id/estado',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }
    const activo = req.body && req.body.activo === true;
    if (req.body && typeof req.body.activo !== 'boolean') {
      return res.status(400).json({ error: 'Falta indicar el nuevo estado (activo).' });
    }

    const [filas] = await pool.query('SELECT rfc FROM usuarios WHERE id = ?', [id]);
    const usuario = filas[0];
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Mismo candado que ya existe para "no te puedes eliminar a ti mismo"
    // — nadie se corta su propio acceso por accidente desde la sesión con
    // la que está trabajando.
    if (!activo && usuario.rfc === req.adminUser) {
      return res.status(400).json({ error: 'No puedes suspender tu propia cuenta mientras tienes la sesión iniciada.' });
    }

    // Reactivar siempre limpia `suspendido_motivo` (punto 349-350-351,
    // regla 9) — si la cuenta había sido suspendida automáticamente por
    // el límite de usuarios del plan, un administrador reactivándola a
    // mano es una decisión nueva y explícita, no debe seguir leyéndose
    // como "suspendida por el sistema". Suspender a mano SIEMPRE deja
    // motivo en NULL (nunca pisa un motivo con un valor que no sea este
    // mecanismo automático).
    if (activo) {
      await pool.query('UPDATE usuarios SET activo = 1, suspendido_motivo = NULL, actualizado_en = ? WHERE id = ?', [new Date(), id]);
    } else {
      await pool.query('UPDATE usuarios SET activo = 0, actualizado_en = ? WHERE id = ?', [new Date(), id]);
    }
    res.json({
      ok: true,
      activo,
      mensaje: activo ? 'Usuario reactivado correctamente.' : 'Usuario suspendido correctamente.',
    });
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

// ---------- Mi Cuenta (autoservicio de la sesión actual) ----------
// A diferencia de "Usuarios" (administra CUALQUIER cuenta, solo perfil
// administrador), esto es lo que la propia sesión autenticada puede ver/
// editar de sí misma — disponible para cualquier perfil (administrador/
// fiscal/ventas/super). Solo expone datos 100% reales: no hay 2FA,
// bitácora de sesiones ni suscripción/Market implementados todavía (ver
// PROJECT_STATE.md puntos 272/274) — se omiten aquí a propósito, en vez
// de fabricarlos, hasta que esos pendientes se resuelvan aparte.
//
// Solo el mecanismo 'perfil_bd' (ver requireAdminAuth en utils/auth.js)
// tiene una fila real en `usuarios` que editar — ADMIN_USERS (env var,
// perfil 'super'), las credenciales API y el usuario de sucursal
// compartido (BD de control) no tienen fila aquí, así que sus datos
// personales no son editables desde esta ruta.
app.get(
  '/api/admin/mi-cuenta',
  adminApiLimiter,
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const editable = req.adminMecanismo === 'perfil_bd';
    let datos = null;
    if (editable) {
      const [filas] = await pool.query(
        'SELECT nombre, telefono, email FROM usuarios WHERE rfc = ? LIMIT 1',
        [req.adminUser]
      );
      const fila = filas[0];
      datos = fila
        ? { nombre: fila.nombre || '', telefono: fila.telefono || '', email: fila.email || '' }
        : null;
    }

    const respuesta = {
      usuario: req.adminUser,
      perfil: req.adminPerfil,
      mecanismo: req.adminMecanismo,
      editable: editable && !!datos,
      datos,
    };

    // Identidad de la empresa/tenant + conteo de operadores: solo
    // administrador/super (info de negocio, no de un operador cualquiera
    // — mismo criterio de alcance que "Perfiles y roles de acceso").
    if (req.adminPerfil === 'administrador' || req.adminPerfil === 'super') {
      const config = await getConfiguracionGlobal();
      const zona = ZONAS_HORARIAS_MEXICO.find((z) => z.id === config.zona_horaria);
      const [[{ total_operadores: totalOperadores }]] = await pool.query(
        "SELECT COUNT(*) AS total_operadores FROM usuarios WHERE perfil IN ('administrador', 'fiscal', 'ventas')"
      );
      respuesta.empresa = {
        razonSocial: config.razon_social_compania || '',
        rfc: config.rfc_compania || '',
        regimenFiscal: config.regimen_fiscal_compania || '',
        claveSat: config.clave_sat || '',
        zonaHorariaId: config.zona_horaria,
        zonaHorariaEtiqueta: zona ? zona.etiqueta : config.zona_horaria,
        tenantSlug: req.tenant ? req.tenant.slug : null,
        nombreEmpresaTenant: req.tenant ? req.tenant.nombreEmpresa : null,
        urlPortal: detectarUrlPortal(req),
        totalOperadores,
        // Punto 375: switch real "Portal de clientes" (antes decorativo,
        // "pendiente 269") — portalClientesActivo es la pausa propia del
        // admin (lo que este switch prende/apaga); portalClientesPlanHabilitado
        // es el ceiling de /control (si está apagado ahí, el switch se
        // bloquea en la UI — "solo desde control se puede habilitar").
        // Sin tenant (sitio base) no hay ceiling de plan, siempre true.
        portalClientesActivo: req.tenant ? !req.tenant.portalClientesPausado : !config.portal_clientes_pausado,
        portalClientesPlanHabilitado: req.tenant ? req.tenant.portalClientesHabilitadoPlan : true,
      };
    }

    res.json(respuesta);
  })
);

// Edita SOLO nombre/teléfono/correo de la propia cuenta (mecanismo
// 'perfil_bd'). Perfil, RFC/usuario y contraseña NO se tocan aquí —
// perfil/RFC siguen siendo privilegio de "administrador" vía
// PUT /api/admin/usuarios/:id, y la contraseña tiene su propio endpoint
// abajo (con verificación de la contraseña actual, a diferencia de
// PUT /api/admin/usuarios/:id/password que es un reseteo con privilegio).
app.put(
  '/api/admin/mi-cuenta',
  adminApiLimiter,
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    if (req.adminMecanismo !== 'perfil_bd') {
      return res.status(403).json({ error: 'Esta cuenta no tiene datos de perfil editables desde aquí.' });
    }

    const body = req.body || {};
    const nombre = sanitizeText(body.nombre, 200);
    const telefono = sanitizeText(body.telefono, 20);
    if (telefono && !isValidTelefono(telefono)) {
      return res.status(400).json({ error: 'El teléfono no es válido.' });
    }
    const email = sanitizeText(body.email, 200).toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio y debe ser válido.' });
    }

    const [resultado] = await pool.query(
      'UPDATE usuarios SET nombre = ?, telefono = ?, email = ?, actualizado_en = ? WHERE rfc = ?',
      [nombre, telefono || '', email, new Date(), req.adminUser]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'No se encontró tu cuenta.' });
    }
    res.json({ ok: true, mensaje: 'Tus datos se actualizaron correctamente.' });
  })
);

// Punto 375: pausa/reanuda el "Portal de clientes" desde Mi Cuenta —
// autoservicio del propio admin, independiente del ceiling de plan que
// sigue gobernando SOLO /control (ver tenantContext.portalClientesEfectivo).
// Mismo alcance de perfil que el resto de "Identidad de la empresa"
// (administrador/super, nunca fiscal/ventas — es una decisión de negocio,
// no de datos propios de la sesión).
app.put(
  '/api/admin/mi-cuenta/portal-clientes',
  adminApiLimiter,
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    if (req.adminPerfil !== 'administrador' && req.adminPerfil !== 'super') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a esta opción.' });
    }
    const activo = Boolean((req.body || {}).activo);

    if (req.tenant) {
      if (!activo && !req.tenant.portalClientesHabilitadoPlan) {
        // Ya está apagado por el plan — no tiene caso "pausarlo" de nuevo,
        // y re-ENCENDERLO desde aquí sin que el plan lo incluya no haría
        // nada (el efectivo seguiría en false) — mejor explicar por qué.
        return res.json({ ok: true, activo: false });
      }
      if (activo && !req.tenant.portalClientesHabilitadoPlan) {
        return res.status(400).json({ error: 'Tu plan no incluye el portal de clientes — contacta a soporte para activarlo.' });
      }
      await obtenerPoolControl().query(
        'UPDATE tenants SET portal_clientes_pausado = ? WHERE slug = ?',
        [activo ? 0 : 1, req.tenant.slug]
      );
      invalidarCacheTenant(req.tenant.slug);
    } else {
      await setConfiguracionGlobal({ portal_clientes_pausado: !activo });
    }

    res.json({ ok: true, activo });
  })
);

// Cambio de contraseña propio — a diferencia de
// PUT /api/admin/usuarios/:id/password (un administrador reseteando la
// de CUALQUIER cuenta sin conocerla), esto exige la contraseña actual
// correcta antes de aceptar la nueva, mismo criterio de autoservicio que
// el resto del sitio ya usa en flujos parecidos.
app.put(
  '/api/admin/mi-cuenta/password',
  adminApiLimiter,
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    if (req.adminMecanismo !== 'perfil_bd') {
      return res.status(403).json({ error: 'Esta cuenta no cambia su contraseña desde aquí.' });
    }

    const body = req.body || {};
    const passwordActual = typeof body.password_actual === 'string' ? body.password_actual : '';
    const passwordNueva = typeof body.password_nueva === 'string' ? body.password_nueva : '';

    const [filas] = await pool.query('SELECT password_hash FROM usuarios WHERE rfc = ? LIMIT 1', [req.adminUser]);
    const fila = filas[0];
    if (!fila || !verifyPassword(passwordActual, fila.password_hash)) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    }

    const errorPassword = validarPassword(passwordNueva);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }

    const passwordHash = hashPassword(passwordNueva);
    await pool.query(
      'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, actualizado_en = ? WHERE rfc = ?',
      [passwordHash, new Date(), req.adminUser]
    );
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente.' });
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
  requireAdminArea('administrador', 'fiscal', 'ventas'),
  asyncHandler(async (req, res) => {
    const config = await getConfiguracionGlobal();
    // Punto 186: "Correo de contacto de la empresa" es un campo aparte de
    // "correo_reportes" (ese es interno, este es el que ve /control y usa
    // la burbuja "Solicitar aclaraciones" del portal). Con tenant, vive en
    // control_tenants.tenants (se sobreescribe aquí, de solo lectura desde
    // esta ruta); sin tenant (sitio base), vive en la config local de esta
    // misma tabla — `config.contacto_email_cliente` ya trae ese valor tal
    // cual de `getConfiguracionGlobal()`, no hace falta tocarlo.
    // `tenant_activo` le dice al frontend cuál de los dos casos es este.
    config.tenant_activo = !!req.tenant;
    if (req.tenant) {
      config.contacto_email_cliente = req.tenant.contactoEmail || null;
    }
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
    // misma ruta (IVA, zona horaria, Clave SAT). Cada uno necesita
    // su propio chequeo aparte del área general ya aplicada arriba
    // (requireAdminArea solo cubre el caso común de los demás campos).
    if (body.correo_reportes !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a configurar el correo de reportes.' });
    }
    if (body.ordenes_compra_habilitado !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a habilitar o deshabilitar Ventas.' });
    }
    // "entrega_venta_default" vive en la misma tarjeta "Ventas" que
    // "Habilitar Ventas" (ambas exclusivas de administrador/super en el
    // frontend, ver RESTRICCIONES_PERFIL) — mismo candado aquí, para que
    // un perfil fiscal no pueda tocarlo pegándole directo a la API.
    if (body.entrega_venta_default !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a configurar el método de entrega por defecto.' });
    }
    // "metodo_pago_venta_default"/"folio_conciliacion_prefijo" (punto 342)
    // — misma tarjeta "Ventas" que entrega_venta_default, mismo candado.
    if (body.metodo_pago_venta_default !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a configurar el método de pago por defecto.' });
    }
    if (body.folio_conciliacion_prefijo !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a configurar el prefijo del folio de conciliación.' });
    }
    // "auditoria_habilitada" (punto 244): mismo candado — solo
    // administrador/super deciden si el menú "Auditoría" se muestra.
    if (body.auditoria_habilitada !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a habilitar o deshabilitar la Auditoría.' });
    }
    // "notif_tickets_permite_ocultar" — mismo candado: solo
    // administrador/super deciden si un super admin puede silenciar el
    // popup de tickets sin contador.
    if (body.notif_tickets_permite_ocultar !== undefined && req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a configurar las notificaciones.' });
    }
    // "notif_reglas_expiracion_productos" (Punto 339) — misma tarjeta
    // "Notificaciones" que notif_tickets_permite_ocultar, mismo candado.
    if (
      body.notif_reglas_expiracion_productos !== undefined &&
      req.adminPerfil !== 'super' &&
      req.adminPerfil !== 'administrador'
    ) {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a configurar las notificaciones.' });
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
        entrega_venta_default: body.entrega_venta_default,
        metodo_pago_venta_default: body.metodo_pago_venta_default,
        folio_conciliacion_prefijo: body.folio_conciliacion_prefijo,
        auditoria_habilitada: body.auditoria_habilitada,
        notif_tickets_permite_ocultar: body.notif_tickets_permite_ocultar,
        notif_reglas_expiracion_productos: body.notif_reglas_expiracion_productos,
        clave_sat: body.clave_sat,
        correo_reportes: body.correo_reportes,
      });
      res.json(actualizado);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  })
);

// ---------- Ticket de impresión: logo + plantilla (Punto 368) ----------
// Ruta DEDICADA (no agregada a /api/admin/config/global) a propósito —
// gobierno de funcionalidades: esta pantalla completa vive detrás de
// `marcaLookfeelHabilitado` ("Marca propia / Look & Feel", el mismo flag
// que ya gobierna marca_logo_url/tema_json desde /control, punto 244),
// y /config/global sirve campos de MUCHOS módulos sin ese flag (IVA,
// zona horaria, etc.) — gatearla completa rompería esos campos para
// cualquier tenant sin "Marca propia". requiereFeature() SIEMPRE antes
// de requireAdminAuth (404, nunca 403, mismo criterio que el resto del
// archivo).
const TICKET_CONFIG_CAMPOS = [
  'logo_url',
  'ticket_ancho_papel',
  'ticket_mostrar_cliente',
  'ticket_mostrar_agradecimiento',
  'ticket_texto_agradecimiento',
  'ticket_texto_pie',
];
function extraerConfigTicket(config) {
  const resultado = {};
  TICKET_CONFIG_CAMPOS.forEach((campo) => { resultado[campo] = config[campo]; });
  return resultado;
}

app.get(
  '/api/admin/configuraciones/ticket',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const config = await getConfiguracionGlobal();
    res.json(extraerConfigTicket(config));
  })
);

app.put(
  '/api/admin/configuraciones/ticket',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    try {
      const actualizado = await setConfiguracionGlobal({
        ticket_ancho_papel: body.ticket_ancho_papel,
        ticket_mostrar_cliente: body.ticket_mostrar_cliente,
        ticket_mostrar_agradecimiento: body.ticket_mostrar_agradecimiento,
        ticket_texto_agradecimiento: body.ticket_texto_agradecimiento,
        ticket_texto_pie: body.ticket_texto_pie,
      });
      res.json(extraerConfigTicket(actualizado));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  })
);

app.post(
  '/api/admin/configuraciones/ticket/restablecer',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const prefijo = storage.prefijoTenant(req);
    await storage.eliminarArchivo('ticket', prefijo, 'logo').catch(() => {});
    const actualizado = await resetearPlantillaTicket();
    res.json(extraerConfigTicket(actualizado));
  })
);

app.post('/api/admin/configuraciones/ticket-logo', adminApiLimiter, requiereFeature('marcaLookfeelHabilitado'), requireAdminAuth, requireAdminArea('administrador'), (req, res) => {
  subirConTenant(uploadImagen, 'logo', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `El logo excede el tamaño máximo permitido de ${IMAGEN_MAX_MB_MAX} MB.` });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({ error: 'Solo se aceptan imágenes en formato JPG, PNG o WEBP.' });
      }
      console.error('Error al subir el logo del ticket:', err);
      return res.status(400).json({ error: 'No se pudo procesar la imagen.' });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'Debes adjuntar una imagen.' });
      // Punto 370: máximo real y configurable desde /control (antes usaba
      // MAX_FILE_SIZE_MB por error de consistencia, ver punto 369).
      const imagenMaxMbTicketLogo = await obtenerImagenMaxMbCacheado();
      if (req.file.size > imagenMaxMbTicketLogo * 1024 * 1024) {
        return res.status(413).json({
          error: `El logo excede el tamaño máximo permitido de ${imagenMaxMbTicketLogo} MB.`,
        });
      }
      const mimeReal = detectRealImageMimeType(req.file.buffer);
      if (!mimeReal) {
        return res.status(400).json({ error: 'El archivo no es una imagen válida (JPG, PNG o WEBP).' });
      }
      const prefijo = storage.prefijoTenant(req);
      await storage.guardarArchivo('ticket', prefijo, 'logo', req.file.buffer, mimeReal);
      const actualizado = await setConfiguracionGlobal({ logo_url: `/api/ticket-logo/${prefijo}` });
      res.json(extraerConfigTicket(actualizado));
    } catch (errGeneral) {
      console.error('Error guardando el logo del ticket:', errGeneral);
      res.status(500).json({ error: 'No se pudo guardar el logo.' });
    }
  });
});

app.delete(
  '/api/admin/configuraciones/ticket-logo',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const prefijo = storage.prefijoTenant(req);
    await storage.eliminarArchivo('ticket', prefijo, 'logo');
    const actualizado = await setConfiguracionGlobal({ logo_url: null });
    res.json(extraerConfigTicket(actualizado));
  })
);

// Sirve el logo del ticket (Punto 368) — público a propósito, mismo
// criterio que /api/marca-logo/:slug (es un logo, no un dato sensible;
// lo consume tanto la vista previa en vivo de Configuraciones como el
// <img> del ticket impreso). NO usa validarSlug() de utils/tenant.js —
// ese validador exige minúsculas/números/guiones (rechaza "_default",
// el prefijo real del sitio base sin tenant, ver storage.PREFIJO_DEFECTO)
// y además rechaza slugs reservados que aquí no aplican (esto es una key
// de almacenamiento, no una ruta enrutable de tenant) — validación propia,
// más simple, que solo evita path traversal en la key de MinIO.
const SLUG_O_DEFAULT_REGEX = /^[a-z0-9_-]{1,50}$/;
app.get('/api/ticket-logo/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!SLUG_O_DEFAULT_REGEX.test(slug)) {
    return res.status(404).json({ error: 'Logo no encontrado.' });
  }
  try {
    if (!(await storage.existeArchivo('ticket', slug, 'logo'))) {
      return res.status(404).json({ error: 'Logo no encontrado.' });
    }
    const { stream, contentType } = await storage.obtenerArchivo('ticket', slug, 'logo');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  } catch (err) {
    console.error(`Error sirviendo el logo del ticket "${slug}":`, err);
    res.status(500).json({ error: 'No se pudo leer el logo.' });
  }
});

// Punto 186: "Correo de contacto de la empresa" — a propósito un endpoint
// aparte de PUT /api/admin/config/global (con tenant, esta escritura va a
// control_tenants.tenants, no a la config del tenant). Mismo campo que
// edita /control (segmento 170, tenantEdicion.js/normalizarDatosBase):
// obligatorio, formato de correo válido, nunca vacío. Solo
// administrador/super, igual que "correo_reportes".
// Homologación con el sitio base (sin tenant, sin fila en
// control_tenants): mismo endpoint, misma UI, pero guarda en la config
// local (`contacto_email_cliente`, ver utils/config.js) y es OPCIONAL —
// hoy ninguna otra empresa lo ve, así que exigirlo sería solo fricción
// sin beneficio; mientras esté vacío, la burbuja "Solicitar
// aclaraciones" del portal simplemente no aparece (igual que un tenant
// sin este dato).
app.put(
  '/api/admin/config/contacto-cliente',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'fiscal'),
  asyncHandler(async (req, res) => {
    if (req.adminPerfil !== 'super' && req.adminPerfil !== 'administrador') {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a configurar el correo de contacto.' });
    }
    const contactoEmail = typeof req.body.contacto_email === 'string'
      ? req.body.contacto_email.trim().toLowerCase()
      : '';

    if (req.tenant) {
      if (!contactoEmail) {
        return res.status(400).json({ error: 'El correo de contacto de la empresa es obligatorio.' });
      }
      if (!isValidEmail(contactoEmail)) {
        return res.status(400).json({ error: 'El correo de contacto no tiene un formato válido.' });
      }
      await obtenerPoolControl().query(
        'UPDATE tenants SET contacto_email = ? WHERE slug = ?',
        [contactoEmail, req.tenant.slug]
      );
      invalidarCacheTenant(req.tenant.slug);
      return res.json({ ok: true, contacto_email: contactoEmail });
    }

    if (contactoEmail && !isValidEmail(contactoEmail)) {
      return res.status(400).json({ error: 'El correo de contacto no tiene un formato válido.' });
    }
    await setConfiguracionGlobal({ contacto_email_cliente: contactoEmail });
    res.json({ ok: true, contacto_email: contactoEmail || null });
  })
);

// ---------- Marca e identidad visual: self-servicio desde /admin ----------
// El administrador del propio tenant edita lo mismo que hoy solo editaba
// un super desde /control (PUT /api/control/tenants/:slug/marca y /tema,
// ver control/server.js + control/utils/tenantMarca.js|tenantTema.js) —
// misma escritura directa a control_tenants.tenants, mismo namespace de
// MinIO ("marca/<slug>/logo" y "marca/<slug>/favicon", ver
// /internal/marca-logo|favicon/:slug arriba), para que un tenant editado
// desde cualquiera de las dos superficies caiga en el mismo dato.
// SOLO TENANT a propósito (confirmado con el usuario, 2026-10-06): el
// sitio base no tiene hoy ningún mecanismo público para aplicar un tema
// propio (GET /api/tema/:slug exige un tenant real) — construir eso sería
// una pieza aparte, no solo exponer este editor. requiereFeature() SIEMPRE
// antes de requireAdminAuth (404, nunca 403), mismo criterio que el resto
// del archivo; dentro del handler, !req.tenant también es 404 (ruta que no
// aplica al sitio base, no un caso de "no autorizado").
app.get(
  '/api/admin/marca-tema',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    if (!req.tenant) return res.status(404).end();
    res.json({
      marca: req.tenant.marca || null,
      marcaLogoUrl: req.tenant.marcaLogoUrl || null,
      tema: parsearTemaDesdeFila({ tema_json: req.tenant.temaJson }),
    });
  })
);

app.put(
  '/api/admin/marca',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    if (!req.tenant) return res.status(404).end();
    const body = req.body || {};
    const marca = typeof body.marca === 'string' ? body.marca.trim() : '';
    if (marca.length > 255) {
      return res.status(400).json({ error: 'La marca no puede superar los 255 caracteres.' });
    }
    await obtenerPoolControl().query('UPDATE tenants SET marca = ? WHERE slug = ?', [marca || null, req.tenant.slug]);
    invalidarCacheTenant(req.tenant.slug);
    res.json({ ok: true, marca: marca || null });
  })
);

app.post('/api/admin/marca-logo', adminApiLimiter, requiereFeature('marcaLookfeelHabilitado'), requireAdminAuth, requireAdminArea('administrador'), (req, res) => {
  if (!req.tenant) return res.status(404).end();
  subirConTenant(uploadImagen, 'logo', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `El logo excede el tamaño máximo permitido de ${IMAGEN_MAX_MB_MAX} MB.` });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({ error: 'Solo se aceptan imágenes en formato JPG, PNG o WEBP.' });
      }
      console.error('Error al subir el logo de marca:', err);
      return res.status(400).json({ error: 'No se pudo procesar la imagen.' });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'Debes adjuntar una imagen.' });
      const imagenMaxMb = await obtenerImagenMaxMbCacheado();
      if (req.file.size > imagenMaxMb * 1024 * 1024) {
        return res.status(413).json({ error: `El logo excede el tamaño máximo permitido de ${imagenMaxMb} MB.` });
      }
      const mimeReal = detectRealImageMimeType(req.file.buffer);
      if (!mimeReal) {
        return res.status(400).json({ error: 'El archivo no es una imagen válida (JPG, PNG o WEBP).' });
      }
      await storage.guardarArchivo('marca', req.tenant.slug, 'logo', req.file.buffer, mimeReal);
      const marcaLogoUrl = `/api/marca-logo/${req.tenant.slug}`;
      await obtenerPoolControl().query('UPDATE tenants SET marca_logo_url = ? WHERE slug = ?', [marcaLogoUrl, req.tenant.slug]);
      invalidarCacheTenant(req.tenant.slug);
      res.json({ ok: true, marcaLogoUrl });
    } catch (errGeneral) {
      console.error('Error guardando el logo de marca:', errGeneral);
      res.status(500).json({ error: 'No se pudo guardar el logo.' });
    }
  });
});

app.delete(
  '/api/admin/marca-logo',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    if (!req.tenant) return res.status(404).end();
    await storage.eliminarArchivo('marca', req.tenant.slug, 'logo');
    await obtenerPoolControl().query('UPDATE tenants SET marca_logo_url = NULL WHERE slug = ?', [req.tenant.slug]);
    invalidarCacheTenant(req.tenant.slug);
    res.json({ ok: true });
  })
);

app.put(
  '/api/admin/tema',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    if (!req.tenant) return res.status(404).end();
    const body = req.body || {};
    let tema;
    try {
      tema = normalizarTema(body.tema || {});
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    // Este endpoint solo guarda colores/radio; el favicon se sube/quita
    // por su propio endpoint — se conserva el que ya tenía el tenant.
    const temaActual = parsearTemaDesdeFila({ tema_json: req.tenant.temaJson });
    if (temaActual && temaActual.faviconUrl) {
      tema.faviconUrl = temaActual.faviconUrl;
    }
    const temaJson = Object.keys(tema).length > 0 ? JSON.stringify(tema) : null;
    await obtenerPoolControl().query('UPDATE tenants SET tema_json = ? WHERE slug = ?', [temaJson, req.tenant.slug]);
    invalidarCacheTenant(req.tenant.slug);
    res.json({ ok: true, tema });
  })
);

app.post(
  '/api/admin/tema/restablecer',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    if (!req.tenant) return res.status(404).end();
    const temaActual = parsearTemaDesdeFila({ tema_json: req.tenant.temaJson });
    if (temaActual && temaActual.faviconUrl) {
      await storage.eliminarArchivo('marca', req.tenant.slug, 'favicon').catch(() => {});
    }
    await obtenerPoolControl().query('UPDATE tenants SET tema_json = NULL WHERE slug = ?', [req.tenant.slug]);
    invalidarCacheTenant(req.tenant.slug);
    res.json({ ok: true });
  })
);

app.post('/api/admin/favicon', adminApiLimiter, requiereFeature('marcaLookfeelHabilitado'), requireAdminAuth, requireAdminArea('administrador'), (req, res) => {
  if (!req.tenant) return res.status(404).end();
  subirConTenant(uploadImagen, 'favicon', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `El favicon excede el tamaño máximo permitido de ${IMAGEN_MAX_MB_MAX} MB.` });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({ error: 'Solo se aceptan imágenes en formato JPG, PNG o WEBP.' });
      }
      console.error('Error al subir el favicon:', err);
      return res.status(400).json({ error: 'No se pudo procesar la imagen.' });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'Debes adjuntar una imagen.' });
      const imagenMaxMb = await obtenerImagenMaxMbCacheado();
      if (req.file.size > imagenMaxMb * 1024 * 1024) {
        return res.status(413).json({ error: `El favicon excede el tamaño máximo permitido de ${imagenMaxMb} MB.` });
      }
      const mimeReal = detectRealImageMimeType(req.file.buffer);
      if (!mimeReal) {
        return res.status(400).json({ error: 'El archivo no es una imagen válida (JPG, PNG o WEBP).' });
      }
      await storage.guardarArchivo('marca', req.tenant.slug, 'favicon', req.file.buffer, mimeReal);
      const faviconUrl = `/api/favicon/${req.tenant.slug}`;
      const temaActual = parsearTemaDesdeFila({ tema_json: req.tenant.temaJson }) || {};
      temaActual.faviconUrl = faviconUrl;
      await obtenerPoolControl().query('UPDATE tenants SET tema_json = ? WHERE slug = ?', [JSON.stringify(temaActual), req.tenant.slug]);
      invalidarCacheTenant(req.tenant.slug);
      res.json({ ok: true, faviconUrl });
    } catch (errGeneral) {
      console.error('Error guardando el favicon:', errGeneral);
      res.status(500).json({ error: 'No se pudo guardar el favicon.' });
    }
  });
});

app.delete(
  '/api/admin/favicon',
  adminApiLimiter,
  requiereFeature('marcaLookfeelHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    if (!req.tenant) return res.status(404).end();
    await storage.eliminarArchivo('marca', req.tenant.slug, 'favicon').catch(() => {});
    const temaActual = parsearTemaDesdeFila({ tema_json: req.tenant.temaJson }) || {};
    delete temaActual.faviconUrl;
    const temaJson = Object.keys(temaActual).length > 0 ? JSON.stringify(temaActual) : null;
    await obtenerPoolControl().query('UPDATE tenants SET tema_json = ? WHERE slug = ?', [temaJson, req.tenant.slug]);
    invalidarCacheTenant(req.tenant.slug);
    res.json({ ok: true });
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
  requireAdminArea('administrador', 'fiscal', 'ventas'),
  asyncHandler(async (req, res) => {
    res.json({ zonas: ZONAS_HORARIAS_MEXICO });
  })
);

// ---------- Administración de tickets ----------

// Consulta y actualiza cada cuántos días se eliminan automáticamente los
// tickets (imagen + factura + fila). Desde punto 158 ya NO borra órdenes
// ni gastos — esos se archivan al cierre mensual. `dias: null` desactiva
// el borrado. `ultimaLimpiezaOrdenes` se conserva por compatibilidad
// (ya no se actualiza).
app.get(
  '/api/admin/config/tickets-retencion',
  adminApiLimiter,
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('reportesPorReporteHabilitado'),
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
        atendido_por: o.creado_por,
      })),
    ];

    const coloresReporte = coloresCorreoTenant(req);
    const resultado = await generarYEnviarReporte({
      tipo: 'manual',
      items,
      rangoInicio: inicioDelMes,
      rangoFin: ahora,
      marca: marcaDelTenant(req),
      urlPortal: detectarUrlPortal(req),
      marcaLogoUrlTenant: req.tenant && req.tenant.marcaLogoUrl,
      colorPrimario: coloresReporte.primario,
      colorAccent: coloresReporte.acento,
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

// "Corte del día" (Ventas, PROJECT_STATE.md punto 168): a diferencia de
// /reportes/enviar (fijo a "desde inicio de mes", mezcla tickets+ventas y
// siempre intenta correo), este es bajo demanda con rango de fechas libre,
// SOLO ventas, sin correo — pantalla + imprimir. Opción A de la propuesta:
// reporte de consulta repetible, no marca nada ni es exclusivo (dos cortes
// sobre fechas encimadas pueden repetir la misma venta a propósito).
// Incluye ventas archivadas por el cierre mensual (mismo criterio que
// /resumen-financiero: es un reporte histórico de lo vendido, no una lista
// de pendientes por gestionar).
app.post(
  '/api/admin/reportes/corte',
  adminApiLimiter,
  requiereFeature('ventasHabilitado'),
  requiereFeature('reportesCortesHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
  asyncHandler(async (req, res) => {
    const desdeTexto = typeof req.body.desde === 'string' ? req.body.desde.trim() : '';
    const hastaTexto = typeof req.body.hasta === 'string' ? req.body.hasta.trim() : '';
    const patronFecha = /^(\d{4})-(\d{2})-(\d{2})$/;
    const desdeMatch = patronFecha.exec(desdeTexto);
    const hastaMatch = patronFecha.exec(hastaTexto);
    if (!desdeMatch || !hastaMatch) {
      return res.status(400).json({ error: 'Indica un rango de fechas válido (desde y hasta).' });
    }

    const inicio = new Date(Date.UTC(+desdeMatch[1], +desdeMatch[2] - 1, +desdeMatch[3]));
    // Límite superior EXCLUSIVO: el día siguiente a "hasta", para incluir
    // el día completo sin depender de la hora exacta guardada.
    const finExclusivo = new Date(Date.UTC(+hastaMatch[1], +hastaMatch[2] - 1, +hastaMatch[3] + 1));
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(finExclusivo.getTime()) || inicio >= finExclusivo) {
      return res.status(400).json({ error: 'La fecha "desde" debe ser anterior o igual a "hasta".' });
    }

    const [ordenes] = await pool.query(
      `SELECT o.id, o.numero_compra, o.fecha_compra, o.concepto, o.cantidad, o.total, o.email,
              o.estado_pago, o.monto_cobrado, o.creado_por,
              (o.facturado_en IS NOT NULL) AS facturado
         FROM ordenes_compra o
        WHERE o.eliminado_en IS NULL AND o.fecha_compra >= ? AND o.fecha_compra < ?
        ORDER BY o.fecha_compra ASC`,
      [inicio, finExclusivo]
    );

    const configGlobal = await getConfiguracionGlobal();
    let subtotal = 0;
    let total = 0;
    let facturadoMonto = 0;
    let cobrado = 0;
    const ordenesFormateadas = ordenes.map((orden) => {
      const totalOrden = Number(orden.total);
      const facturadoOrden = Boolean(orden.facturado);
      subtotal += Number(orden.cantidad);
      total += totalOrden;
      if (facturadoOrden) facturadoMonto += totalOrden;
      cobrado += Number(orden.monto_cobrado || 0);
      return {
        id: orden.id,
        numero_compra: orden.numero_compra,
        email: orden.email,
        total: totalOrden,
        estado_pago: orden.estado_pago,
        facturado: facturadoOrden,
        fecha_compra_formateada: formatearFechaHoraMexico(
          new Date(`${orden.fecha_compra.replace(' ', 'T')}Z`),
          configGlobal.zona_horaria
        ),
      };
    });
    subtotal = Math.round(subtotal * 100) / 100;
    total = Math.round(total * 100) / 100;
    facturadoMonto = Math.round(facturadoMonto * 100) / 100;
    cobrado = Math.round(cobrado * 100) / 100;
    const resumen = {
      ventas: ordenes.length,
      subtotal,
      iva: Math.round((total - subtotal) * 100) / 100,
      total,
      facturado: facturadoMonto,
      sin_facturar: Math.round((total - facturadoMonto) * 100) / 100,
      cobrado,
      pendiente_cobro: Math.round((total - cobrado) * 100) / 100,
    };

    const items = ordenes.map((orden) => ({
      tipo_registro: 'orden_compra',
      identificador: orden.numero_compra,
      rfc: orden.email,
      estatus_o_concepto: orden.concepto,
      monto: Number(orden.total),
      fecha_registro: orden.fecha_compra,
      atendido_por: orden.creado_por,
    }));
    const fechaGeneracion = new Date();
    // "finExclusivo" es el límite REAL de la consulta (el día siguiente a
    // "hasta", para incluirlo completo) — pero guardar ESE valor como
    // rango_fin del reporte lo mostraría como si cubriera un día de más
    // (un corte de un solo día se vería "01 sep – 02 sep"). Se guarda 1
    // segundo antes (23:59:59 de "hasta") solo para que el rango se
    // muestre correctamente — la consulta de arriba ya corrió con el
    // límite exclusivo real, esto no la afecta.
    const finParaMostrar = new Date(finExclusivo.getTime() - 1000);
    const mdContenido = generarContenidoMD({
      tipo: 'corte',
      fechaGeneracion,
      rangoInicio: inicio,
      rangoFin: finParaMostrar,
      items,
      zonaHoraria: configGlobal.zona_horaria,
    });
    const reporteId = await guardarReporte({
      tipo: 'corte',
      fechaGeneracion,
      rangoInicio: inicio,
      rangoFin: finParaMostrar,
      items,
      mdContenido,
      correoEnviadoA: null,
      correoEnviado: false,
      totalMonto: resumen.total,
    });

    res.json({ reporteId, desde: desdeTexto, hasta: hastaTexto, resumen, ordenes: ordenesFormateadas });
  })
);

// Lista todos los reportes ya generados (solo metadatos, sin los items
// ni el Markdown completo) — para el selector de la vista "Lectura de
// reportes".
app.get(
  '/api/admin/reportes',
  adminApiLimiter,
  requiereFeature('reportesPorReporteHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const [reportes] = await pool.query(
      `SELECT id, tipo, fecha_generacion, rango_inicio, rango_fin, correo_enviado_a, correo_enviado,
              total_tickets, total_ordenes, total_gastos, total_monto, creado_en
       FROM reportes ORDER BY fecha_generacion DESC`
    );
    res.json({ reportes });
  })
);

// Contenido en Markdown de un reporte específico — para el botón "Leer MD".
app.get(
  '/api/admin/reportes/:id/md',
  adminApiLimiter,
  requiereFeature('reportesPorReporteHabilitado'),
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

// ---------- Auditoría consultable (punto 244, mapeo con
// CLARVO_Planes.md — "Auditoría consultable", Crece/Domina) ----------
// La tabla `admin_auditoria` (segmento 7) ya registraba TODO acceso
// administrativo desde entonces — esta es la primera pantalla que deja
// consultarla. Alcance deliberado, nunca cross-tenant: solo lo que
// ocurrió en ESTE tenant (o en el sitio base, sin tenant) — un acceso
// "super" (ADMIN_USERS) contra este tenant SÍ aparece (tenant_slug
// coincide), pero nada de lo que pasó en otros tenants.
app.get(
  '/api/admin/auditoria',
  adminApiLimiter,
  requiereFeature('auditoriaHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    // Aunque el perfil tenga acceso al área, el switch "Auditoría"
    // (punto 244, Configuraciones globales) puede estar apagado — se
    // revisa aquí también, no solo en el frontend, para que la API
    // directa respete el mismo apagado que el menú.
    const configGlobalAuditoria = await getConfiguracionGlobal();
    if (configGlobalAuditoria.auditoria_habilitada === false) {
      return res.status(403).json({ error: 'La Auditoría está desactivada en Configuraciones globales.' });
    }
    const actor = sanitizeText(req.query.actor, 100) || undefined;
    const desde = sanitizeText(req.query.desde, 20) || undefined;
    const hasta = sanitizeText(req.query.hasta, 20) || undefined;
    const limite = req.query.limite ? Number(req.query.limite) : 100;

    const filas = await listarAuditoria({
      actor,
      tenantSlug: req.tenant ? req.tenant.slug : undefined,
      sinTenant: !req.tenant,
      desde,
      hasta,
      limite,
    });

    res.json({
      total: filas.length,
      registros: filas.map((f) => ({
        id: f.id,
        ocurridoEn: f.ocurrido_en,
        actor: f.actor,
        mecanismo: f.mecanismo,
        perfil: f.perfil,
        metodo: f.metodo,
        ruta: f.ruta,
        estatus: f.resultado_estatus,
        ip: f.ip,
      })),
    });
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
  requiereFeature('reportesPorReporteHabilitado'),
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
  requiereFeature('reportesPorReporteHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { tipo_registro: tipoRegistro, estatus, rfc, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, accion } = req.query;
    const estatusValidos = ['pendiente', 'en_curso', 'cancelado', 'listo'];

    let sql = 'SELECT * FROM reporte_items WHERE reporte_id = ?';
    const params = [id];
    if (tipoRegistro && ['ticket', 'orden_compra', 'gasto'].includes(tipoRegistro)) {
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
  requiereFeature('reportesPorReporteHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const formato = req.query.formato === 'excel' ? 'excel' : 'csv';
    const { tipo_registro: tipoRegistro, estatus, rfc, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, accion } = req.query;
    const estatusValidosExportar = ['pendiente', 'en_curso', 'cancelado', 'listo'];

    let sql = 'SELECT * FROM reporte_items WHERE reporte_id = ?';
    const params = [id];
    if (tipoRegistro && ['ticket', 'orden_compra', 'gasto'].includes(tipoRegistro)) {
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
  requiereFeature('reportesEliminadosHabilitado'),
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
  if (tipoRegistro && ['ticket', 'orden_compra', 'gasto'].includes(tipoRegistro)) {
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
  requiereFeature('reportesEliminadosHabilitado'),
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
  requiereFeature('reportesEliminadosHabilitado'),
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
  requiereFeature('reportesEliminadosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const { tipoRegistro, identificador } = req.params;
    if (!['ticket', 'orden_compra', 'gasto'].includes(tipoRegistro)) {
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
  requiereFeature('reportesPorReporteHabilitado'),
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
  requiereFeature('facturacionHabilitada'),
  requireAdminAuth,
  requireAdminArea('fiscal'),
  asyncHandler(async (req, res) => {
    const config = await getConfigSmtp();
    const correoContadorConfigurado = Boolean(config && config.correo_contador);
    // Se manda junto con la lista (en vez de que el frontend lo lea por
    // separado de GET /config/global) para que no haya una carrera entre
    // ambas peticiones al iniciar sesión — el checkbox "No volver a
    // mostrar" (solo super) necesita saber esto en el mismo instante en
    // que decide si pintar el popup.
    const configGlobal = await getConfiguracionGlobal();
    const permiteOcultar = configGlobal.notif_tickets_permite_ocultar !== false;

    if (correoContadorConfigurado) {
      return res.json({ total: 0, tickets: [], permiteOcultar });
    }

    const [tickets] = await pool.query(
      `SELECT id, folio, rfc, creado_en FROM tickets
       WHERE estatus = 'pendiente' AND eliminado_en IS NULL
       ORDER BY creado_en DESC`
    );
    res.json({ total: tickets.length, tickets, permiteOcultar });
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
  requiereFeature('facturacionHabilitada'),
  requireAdminAuth,
  requireAdminArea('fiscal', 'administrador'),
  asyncHandler(async (req, res) => {
    const estatus = sanitizeText(req.query.estatus, 20);
    const estatusValidos = ['pendiente', 'en_curso', 'cancelado', 'listo'];
    const actualizadoPor = sanitizeText(req.query.actualizado_por, 100);
    const verPapelera = req.query.papelera === 'true';

    let sql = `SELECT t.id, t.folio, t.rfc, t.uso_cfdi, t.tipo_pago, t.tipo_pago_otro, t.comentarios,
                      t.imagen_nombre_original, t.estatus, t.factura_nombre_original, t.notas_admin,
                      t.monto_factura, t.monto_factura_origen,
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

// Reportes → "Estado de tickets" (punto 360): el resumen de tickets que
// antes vivía en "Inicio" (KPIs/dona/recientes) — ruta DEDICADA en vez de
// reutilizar GET /api/admin/tickets directamente, a propósito: esa otra
// ruta también sirve la vista "Tickets" y solo exige facturacionHabilitada
// — si se le agregara también requiereFeature('reportesEstadoTicketsHabilitado')
// ahí, apagar esta pestaña de Reportes rompería la vista Tickets completa
// (mismo acoplamiento que ya tiene, sin querer, /api/admin/reportes/corte
// con el botón "Corte del día" de Ventas). Mismo criterio de datos que
// Tickets (todos los activos, sin filtro), el cliente calcula el resumen.
app.get(
  '/api/admin/reportes/estado-tickets',
  adminApiLimiter,
  requiereFeature('facturacionHabilitada'),
  requiereFeature('reportesEstadoTicketsHabilitado'),
  requireAdminAuth,
  requireAdminArea('fiscal', 'administrador'),
  asyncHandler(async (req, res) => {
    const [ticketsCrudos] = await pool.query(
      `SELECT t.id, t.folio, t.rfc, t.estatus, t.creado_en
         FROM tickets t
        WHERE t.eliminado_en IS NULL
        ORDER BY t.creado_en DESC`
    );
    res.json({ total: ticketsCrudos.length, tickets: ticketsCrudos });
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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

      // Monto de la factura: negocios "solo facturas" (Ventas apagado, sin
      // inventario/servicios) no tienen ninguna venta contra la cual
      // verificar el ticket — no hay otro lugar que registre cuánto costó.
      // Se intenta leer el Total real del CFDI (XML dentro del ZIP, ver
      // extraerTotalFacturaDeZip); si no se pudo leer, se exige captura
      // manual — el monto NUNCA queda vacío. Un valor leído del XML nunca
      // se deja pisar por uno manual (es un CFDI ya timbrado, no es
      // "corregible" a mano).
      const totalExtraido = extraerTotalFacturaDeZip(req.file.buffer);
      let montoFactura;
      let montoFacturaOrigen;
      if (totalExtraido !== null) {
        montoFactura = totalExtraido;
        montoFacturaOrigen = 'xml';
      } else {
        const montoManual = Number(req.body.montoFacturaManual);
        if (!req.body.montoFacturaManual || !Number.isFinite(montoManual) || montoManual <= 0) {
          return res.status(400).json({
            error: 'No se pudo leer el monto de la factura desde el XML. Captúralo manualmente para continuar.',
            codigo: 'FACTURA_MONTO_REQUERIDO',
          });
        }
        montoFactura = Math.round(montoManual * 100) / 100;
        montoFacturaOrigen = 'manual';
      }

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
           factura_nombre_guardado = ?, factura_mime = ?, monto_factura = ?,
           monto_factura_origen = ?, actualizado_por = ?, actualizado_en = ?
         WHERE id = ?`,
        [req.file.originalname.slice(0, 255), storedFilename, 'application/zip', montoFactura,
          montoFacturaOrigen, req.adminUser, new Date(), id]
      );

      // Bug real corregido (2026-09-02): "facturado" se leía en vivo del
      // ticket — en cuanto la retención lo borra, la venta perdía su
      // factura para siempre. `facturado_en` es el hecho histórico
      // PERMANENTE, se fija aquí UNA SOLA VEZ (COALESCE no lo pisa si ya
      // tenía fecha de una factura anterior reemplazada).
      if (ticket.orden_compra_id) {
        await pool.query(
          'UPDATE ordenes_compra SET facturado_en = COALESCE(facturado_en, ?) WHERE id = ?',
          [new Date(), ticket.orden_compra_id]
        );
      }

      // Notifica al cliente (correo de "recibir facturas" asociado al RFC
      // del ticket, ver registros.email) que su factura ya está lista.
      // Igual que con la notificación al contador: no se espera (await)
      // ni se deja que una falla aquí afecte la respuesta al
      // administrador — la factura ya se guardó correctamente.
      const urlPortalFactura = detectarUrlPortal(req);
      (async () => {
        const configGlobalFactura = await getConfiguracionGlobal();
        await notificarFacturaListaAlCliente(
          ticket.rfc,
          ticket.folio,
          marcaDelTenant(req),
          urlPortalFactura,
          logoUrlDelTenant(req, urlPortalFactura, configGlobalFactura),
          coloresCorreoTenant(req)
        );
      })().catch((err) => {
        console.error('No se pudo notificar la factura lista al cliente:', err.message);
      });

      res.json({
        ok: true,
        mensaje: 'Factura cargada. El ticket se marcó como "listo".',
        monto_factura: montoFactura,
        monto_factura_origen: montoFacturaOrigen,
      });
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

async function notificarFacturaListaAlCliente(rfc, folio, marca, urlPortal, logoUrl, colores) {
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
  const marcaCorreo = marca || MARCA_DEFECTO;
  const variables = { folio, rfc, marca: marcaCorreo };
  const asunto = aplicarPlantilla(ASUNTO_FACTURA_LISTA, variables);
  const cuerpoPersonalizado = aplicarPlantilla((config && config.cuerpo_cliente) || DEFAULTS_SMTP.cuerpo_cliente, variables);

  // Homologado al diseño del ticket de venta (auditoría de correos de
  // salida): el marco (logo, franja, botón) se comparte con los demás
  // correos, pero el texto del admin (`cuerpo_cliente`) se envuelve TAL
  // CUAL — cada línea que capturó se muestra como su propio párrafo,
  // nunca se reescribe. El botón hacia el portal es nuevo (antes este
  // correo no tenía ningún enlace).
  const enlacePortal = urlPortal ? `${urlPortal}/login` : '';
  const { html, texto, adjuntos } = construirCorreoBase({
    marca: marcaCorreo,
    logoUrl,
    colorPrimario: colores && colores.primario,
    colorAccent: colores && colores.acento,
    eyebrow: 'Facturación',
    titulo: 'Factura lista',
    parrafos: formatearParrafosCuerpo(cuerpoPersonalizado),
    cta: enlacePortal ? { href: enlacePortal, texto: 'Entrar al Portal' } : null,
  });

  await enviarCorreo({
    destinatario: correoCliente,
    asunto,
    cuerpo: texto,
    html,
    adjuntos,
  });
}

// Ve la imagen original de un ticket (protegido, para revisarlo antes de facturar).
app.get(
  '/api/admin/tickets/:id/imagen',
  adminApiLimiter,
  requiereFeature('facturacionHabilitada'),
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
  requiereFeature('facturacionHabilitada'),
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

// Lista cualquier cliente con cuenta en el portal (perfil 'cliente' en
// `usuarios`), para el desplegable de "correo electrónico" del formulario
// de orden de compra — decisión del usuario, punto 377: antes solo listaba
// correos con constancia de situación fiscal ya subida (tabla `registros`),
// lo que dejaba el desplegable vacío para cualquier cliente que ya tuviera
// cuenta pero no hubiera subido su CSF todavía. El RFC/nombre de solo
// lectura que ve el admin siguen viniendo de `registros` cuando existe
// (dato validado contra la CSF real); si el cliente aún no la sube, se cae
// al nombre que el propio cliente capturó en "Mi cuenta" y el RFC queda en
// blanco — eso no bloquea registrar la venta, solo informa de menos.
app.get(
  '/api/admin/correos-registrados',
  adminApiLimiter,
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      `SELECT u.email AS email,
              CASE WHEN r.rfc IS NOT NULL THEN r.rfc ELSE NULL END AS rfc,
              r.regimen_fiscal AS regimen_fiscal,
              COALESCE(r.nombre, u.nombre) AS nombre
       FROM usuarios u
       LEFT JOIN registros r ON r.email = u.email AND r.eliminado_en IS NULL
       WHERE u.perfil = 'cliente'
       ORDER BY u.email ASC`
    );
    res.json({ correos: filas });
  })
);

// Punto 342: genera y persiste un folio de conciliación de transferencia
// EN CUANTO el cajero hace clic en "Transferencia" en el modal "Registrar
// venta" — antes de que la venta exista. Se guarda siempre (incluso si la
// venta nunca se termina de registrar), porque sirve para conciliar
// contra el estado de cuenta bancario, no solo contra ventas completadas.
// Mismo patrón que generarFolio/generarNumeroCompra: INSERT con 'TEMP',
// se lee insertId, se arma el folio real, UPDATE.
app.post(
  '/api/admin/folios-conciliacion',
  adminApiLimiter,
  requiereFeature('ventasHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
  asyncHandler(async (req, res) => {
    const config = await getConfiguracionGlobal();
    const ahora = new Date();
    const creadoPor = resolverCreadoPorVenta(req);
    const [resultado] = await pool.query(
      'INSERT INTO folios_conciliacion (folio, orden_compra_id, creado_por, creado_en) VALUES (?, ?, ?, ?)',
      ['TEMP', null, creadoPor, ahora]
    );
    const folio = generarFolioConciliacion(config.folio_conciliacion_prefijo, resultado.insertId);
    await pool.query('UPDATE folios_conciliacion SET folio = ? WHERE id = ?', [folio, resultado.insertId]);
    res.status(201).json({ folio });
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
  requiereFeature('ventasHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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

    // Punto 227: descuento opcional por porcentaje, sobre el subtotal
    // ANTES del IVA. `descuentoPorcentaje`/`descuentoMonto` se guardan
    // tal cual solo para reconstruir la línea "Descuento" en
    // ticket/correo/detalle; el subtotal ya neto (`cantidadNeta`) es el
    // que alimenta `total` — mismo invariante `total = cantidad*(1+iva%)`
    // de siempre, así que Resumen financiero/Cuentas por
    // cobrar/facturación no necesitan tocarse.
    let descuentoPorcentaje = null;
    let descuentoMonto = null;
    let cantidadNeta = cantidad;
    if (body.descuento_porcentaje !== undefined && body.descuento_porcentaje !== null && body.descuento_porcentaje !== '') {
      const pct = Number(body.descuento_porcentaje);
      // Estrictamente menor a 100: un descuento del 100% dejaría el
      // subtotal neto en $0, violando el CHECK real de MySQL
      // `chk_ordenes_compra_cantidad (cantidad > 0)` que ya protege
      // cualquier venta (con o sin descuento) — encontrado validando
      // contra MySQL real, ningún mock lo hubiera detectado.
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
        return res.status(400).json({ error: 'El descuento debe ser un porcentaje mayor a 0 y menor a 100.' });
      }
      descuentoPorcentaje = pct;
      descuentoMonto = Math.round(cantidad * (pct / 100) * 100) / 100;
      cantidadNeta = Math.round((cantidad - descuentoMonto) * 100) / 100;
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

    // Punto 342: "Método de pago" — 'efectivo' si no se manda (compras
    // registradas antes de este punto o clientes que no la exigen),
    // validado contra la misma lista que usa Configuraciones (única
    // fuente de verdad, METODOS_PAGO_VENTA). Solo con "transferencia" se
    // exige un folio de conciliación YA generado (ver
    // POST /admin/folios-conciliacion) — nunca se genera uno aquí mismo,
    // para que el cajero pueda dárselo al cliente ANTES de terminar de
    // registrar la venta.
    let metodoPago = String(body.metodo_pago || 'efectivo').toLowerCase();
    if (!METODOS_PAGO_VENTA.includes(metodoPago)) {
      return res.status(400).json({ error: 'Selecciona un método de pago válido.' });
    }
    let folioConciliacionFila = null;
    if (metodoPago === 'transferencia') {
      const folioCapturado = sanitizeText(body.folio_conciliacion, 10).toUpperCase();
      if (!folioCapturado) {
        return res.status(400).json({ error: 'Falta el folio de conciliación — vuelve a elegir "Transferencia" para generarlo.' });
      }
      const [foliosCoincidentes] = await pool.query(
        'SELECT id, folio, orden_compra_id FROM folios_conciliacion WHERE folio = ? LIMIT 1',
        [folioCapturado]
      );
      folioConciliacionFila = foliosCoincidentes[0] || null;
      if (!folioConciliacionFila) {
        return res.status(400).json({ error: 'El folio de conciliación no es válido. Vuelve a elegir "Transferencia" para generar uno nuevo.' });
      }
      if (folioConciliacionFila.orden_compra_id !== null) {
        return res.status(409).json({ error: 'Ese folio de conciliación ya está usado por otra venta.' });
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

      // "Cliente nuevo" (sin cuenta todavía, ver frontend): se salta
      // cualquier exigencia — la orden solo necesita un correo válido (ver
      // ordenes_compra en db.js, no guarda RFC/nombre, así que no hay
      // ningún otro dato que depender de una cuenta existente). "Cliente ya
      // registrado" exige que el correo pertenezca a una cuenta real del
      // portal (perfil 'cliente' en `usuarios`) — ya NO exige constancia de
      // situación fiscal subida (decisión del usuario, punto 377: el
      // desplegable ahora ofrece cualquier cliente del portal, con o sin
      // CSF, así que la validación del servidor tiene que coincidir con lo
      // que el desplegable realmente ofrece). Se revalida aquí del lado del
      // servidor por si acaso (nunca se confía solo en lo que mande el
      // navegador).
      if (!body.es_cliente_nuevo) {
        const [usuariosCoincidentes] = await pool.query(
          "SELECT rfc FROM usuarios WHERE email = ? AND perfil = 'cliente' LIMIT 1",
          [email]
        );
        if (usuariosCoincidentes.length === 0) {
          return res.status(400).json({
            error: 'Ese correo no corresponde a ningún cliente registrado en el portal.',
          });
        }
      }
    }

    const configGlobal = await getConfiguracionGlobal();
    const ivaPorcentaje = configGlobal.iva_porcentaje;
    // Redondeo a 2 decimales (centavos), como cualquier monto en pesos.
    const total = Math.round(cantidadNeta * (1 + ivaPorcentaje / 100) * 100) / 100;

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
    // Punto 322: quién registró la venta — solo para reportes/
    // aclaraciones, nunca expuesto por GET /ordenes-compra (esa consulta
    // usa columnas explícitas, sin "creado_por" en la lista).
    const creadoPor = resolverCreadoPorVenta(req);
    const [resultado] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, descuento_porcentaje, descuento_monto, email, estado_pago, fecha_vencimiento, monto_cobrado, fecha_cobro, notas_cobro, producto_id, producto_cantidad, metodo_pago, folio_conciliacion, creado_por, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['TEMP', ahora, concepto, cantidadNeta, ivaPorcentaje, total, descuentoPorcentaje, descuentoMonto, email, estadoPago, fechaVencimiento, montoCobradoInicial, fechaCobroInicial, notasCobro, productoId, productoCantidad, metodoPago, folioConciliacionFila ? folioConciliacionFila.folio : null, creadoPor, ahora, ahora]
    );

    const numeroCompra = generarNumeroCompra(resultado.insertId);
    await pool.query('UPDATE ordenes_compra SET numero_compra = ? WHERE id = ?', [numeroCompra, resultado.insertId]);
    // Vincula el folio de conciliación (ya generado al hacer clic en
    // "Transferencia", ver POST /admin/folios-conciliacion) a esta venta —
    // solo AHORA se sabe el id real de la venta.
    if (folioConciliacionFila) {
      await pool.query('UPDATE folios_conciliacion SET orden_compra_id = ? WHERE id = ?', [resultado.insertId, folioConciliacionFila.id]);
    }

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
          // Punto 261: el modal de "Existencia insuficiente" del frontend
          // necesita el nombre del producto y la cantidad solicitada para
          // mostrar la comparación — registrarMovimiento() no los conoce
          // (solo recibe productoId/cantidad), pero aquí sí están a mano.
          if (resultadoMovimiento.error === 'INV_STOCK_INSUFICIENTE') {
            resultadoMovimiento.producto_nombre = linea.producto.nombre;
            resultadoMovimiento.solicitado = linea.cantidad;
          }
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
          INV_CANTIDAD_DEBE_SER_ENTERA: 400,
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
        if (resultadoMovimiento.error === 'INV_STOCK_INSUFICIENTE') {
          resultadoMovimiento.producto_nombre = productoSeleccionado.nombre;
          resultadoMovimiento.solicitado = productoCantidad;
        }
        await pool.query('DELETE FROM ordenes_compra WHERE id = ?', [resultado.insertId]);
        const mapaEstatusInv = {
          INV_STOCK_INSUFICIENTE: 409,
          INV_CONCURRENCIA: 409,
          INV_PRODUCTO_NO_ENCONTRADO: 400,
          INV_PRODUCTO_SERVICIO: 400,
          INV_CANTIDAD_DEBE_SER_ENTERA: 400,
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
        cantidad: cantidadNeta,
        ivaPorcentaje,
        total,
        descuentoPorcentaje,
        descuentoMonto,
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
        metodoPago,
        folioConciliacion: folioConciliacionFila ? folioConciliacionFila.folio : null,
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
      cantidad: cantidadNeta,
      iva_porcentaje: ivaPorcentaje,
      total,
      descuento_porcentaje: descuentoPorcentaje,
      descuento_monto: descuentoMonto,
      email,
      estado_pago: estadoPago,
      fecha_vencimiento: fechaVencimiento,
      monto_cobrado: montoCobradoInicial,
      fecha_cobro: fechaCobroInicial,
      notas_cobro: notasCobro,
      producto_id: productoId,
      producto_cantidad: productoCantidad,
      metodo_pago: metodoPago,
      folio_conciliacion: folioConciliacionFila ? folioConciliacionFila.folio : null,
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

// Lista las órdenes de compra activas. Por defecto solo el mes operativo
// (`archivado_en IS NULL`); con `?periodo=YYYY-MM` muestra el cierre
// archivado de ese periodo, con `?incluirArchivadas=true` muestra todo.
// La fecha se muestra con la zona horaria ACTUALMENTE configurada.
app.get(
  '/api/admin/ordenes-compra',
  adminApiLimiter,
  requiereFeature('ventasHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
  asyncHandler(async (req, res) => {
    const periodo = typeof req.query.periodo === 'string' ? req.query.periodo.trim() : '';
    const incluirArchivadas = req.query.incluirArchivadas === 'true';
    const esPeriodoValido = /^\d{4}-\d{2}$/.test(periodo);
    let whereArchivado = 'o.archivado_en IS NULL';
    const paramsArchivado = [];
    if (esPeriodoValido) {
      whereArchivado = 'o.periodo_archivado = ?';
      paramsArchivado.push(periodo);
    } else if (incluirArchivadas) {
      whereArchivado = '1=1';
    }
    const [ordenes] = await pool.query(
      `SELECT o.id, o.numero_compra, o.fecha_compra, o.concepto, o.cantidad, o.iva_porcentaje, o.total, o.descuento_porcentaje, o.descuento_monto, o.email, o.estado_pago, o.fecha_vencimiento, o.monto_cobrado, o.fecha_cobro, o.notas_cobro, o.creado_en,
        o.metodo_pago, o.folio_conciliacion,
        o.producto_id, o.producto_cantidad, p.sku AS producto_sku, p.nombre AS producto_nombre,
        o.archivado_en, o.periodo_archivado,
        (o.facturado_en IS NOT NULL) AS facturado,
        r.nombre AS cliente_nombre, r.rfc AS cliente_rfc
       FROM ordenes_compra o
       LEFT JOIN productos p ON p.id = o.producto_id
       LEFT JOIN registros r ON r.email = o.email AND r.eliminado_en IS NULL
       WHERE o.eliminado_en IS NULL AND ${whereArchivado}
       ORDER BY o.creado_en DESC`,
      paramsArchivado
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
    const ordenesFormateadas = ordenes.map((orden) => {
      // Punto 322: "creado_por" (quién registró la venta) NUNCA debe
      // llegar aquí — el SELECT de arriba ya lo excluye, pero se quita
      // explícitamente también aquí (defensa en profundidad: si algún
      // día ese SELECT cambia a "*" por accidente, este spread no lo
      // filtraría solo).
      const { creado_por, ...ordenSinCreadoPor } = orden;
      return {
        ...ordenSinCreadoPor,
        facturado: Boolean(orden.facturado),
        productos_inventario: lineasPorOrden.get(orden.id) || [],
        fecha_compra_formateada: formatearFechaHoraMexico(
          new Date(`${orden.fecha_compra.replace(' ', 'T')}Z`),
          configGlobal.zona_horaria
        ),
      };
    });

    res.json({ total: ordenesFormateadas.length, ordenes: ordenesFormateadas });
  })
);

// Cuentas por cobrar (punto 138): registrar cobro (abono parcial o total) sobre una venta pendiente
app.put(
  '/api/admin/ordenes-compra/:id/cobro',
  adminApiLimiter,
  requiereFeature('ventasHabilitado'),
  requiereFeature('cxcHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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

    // Segmento 3 de "Mi Cuenta" (Gestión de crédito del cliente, ver
    // PROJECT_STATE.md): bitácora real del abono individual, aparte del
    // acumulado de arriba — sin esto el cliente no tendría forma de ver
    // "qué pagó y cuándo" en su historial.
    await pool.query('INSERT INTO abonos (orden_id, monto, notas, creado_por, creado_en) VALUES (?, ?, ?, ?, ?)', [
      id,
      monto,
      notas,
      req.adminUser || null,
      ahora,
    ]);

    const [actualizada] = await pool.query('SELECT id, numero_compra, total, monto_cobrado, estado_pago, fecha_cobro FROM ordenes_compra WHERE id = ? LIMIT 1', [id]);
    res.json({ ok: true, orden: actualizada[0], saldo: nuevoSaldo });
  })
);

// Recordatorio de pago por correo (Cuentas por cobrar, homologación con
// stitch/) — a diferencia de "Copiar recordatorio" (solo arma un texto
// para pegar a mano en WhatsApp), esto envía un correo real al cliente,
// con el mismo cascarón de marca que el resto de correos de salida
// (construirCorreoBase). Solo tiene sentido sobre una venta pendiente con
// correo — 400 explícito en los otros casos, nunca 404 genérico.
app.post(
  '/api/admin/ordenes-compra/:id/recordatorio',
  adminApiLimiter,
  requiereFeature('ventasHabilitado'),
  requiereFeature('cxcHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const [filas] = await pool.query(
      'SELECT id, numero_compra, email, total, monto_cobrado, estado_pago, fecha_vencimiento FROM ordenes_compra WHERE id = ? AND eliminado_en IS NULL LIMIT 1',
      [id]
    );
    if (filas.length === 0) return res.status(404).json({ error: 'Venta no encontrada.' });
    const orden = filas[0];
    if (orden.estado_pago !== 'pendiente') return res.status(400).json({ error: 'Esta venta ya está pagada.' });
    if (!orden.email) return res.status(400).json({ error: 'Esta venta no tiene correo registrado.' });

    const saldo = Math.round((Number(orden.total) - Number(orden.monto_cobrado || 0)) * 100) / 100;
    const urlPortal = detectarUrlPortal(req);
    const configGlobal = await getConfiguracionGlobal();
    const colores = coloresCorreoTenant(req);

    const { html, texto, adjuntos } = construirCorreoBase({
      marca: marcaDelTenant(req),
      logoUrl: logoUrlDelTenant(req, urlPortal, configGlobal),
      colorPrimario: colores.primario,
      colorAccent: colores.acento,
      eyebrow: 'Recordatorio de pago',
      titulo: `Venta ${orden.numero_compra}`,
      filas: [
        { etiqueta: 'Total de la venta', valor: `$${Number(orden.total).toFixed(2)} MXN` },
        { etiqueta: 'Saldo pendiente', valor: `$${saldo.toFixed(2)} MXN`, destacado: true },
        ...(orden.fecha_vencimiento ? [{ etiqueta: 'Vencimiento', valor: escapeHtmlCorreo(orden.fecha_vencimiento) }] : []),
      ],
      parrafos: ['Este es un recordatorio de que tienes un saldo pendiente por esta compra. Si ya realizaste el pago, ignora este mensaje.'],
      cta: urlPortal ? { href: `${urlPortal}/login`, texto: 'Entrar al Portal' } : null,
    });

    try {
      await enviarCorreo({
        destinatario: orden.email,
        asunto: `Recordatorio de pago — Venta ${orden.numero_compra}`,
        cuerpo: texto,
        html,
        adjuntos,
      });
    } catch (err) {
      return res.status(502).json({ error: 'No se pudo enviar el recordatorio. Intenta de nuevo más tarde.' });
    }

    res.json({ ok: true });
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
  requiereFeature('resumenFinancieroHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador'),
  asyncHandler(async (req, res) => {
    const configGlobal = await getConfiguracionGlobal();
    // DOS familias de límites (ver utils/limitesPeriodo.js): `instantes`
    // para ordenes_compra.fecha_compra (DATETIME en UTC — antes se usaba
    // aquí la medianoche UTC del mes, con lo que una venta del último día
    // a partir de las 18:00 hora local se contaba en el mes siguiente) y
    // `fechas` para gastos.fecha (DATE con el calendario local).
    const { instantes, fechas } = limitesMes(configGlobal.zona_horaria);
    const { inicio, fin, inicioAnterior, finAnterior } = instantes;
    // Ventana de la gráfica: primer día del mes hace 5 meses (6 meses de
    // historia contando el mes en curso). Los KPIs de arriba siguen
    // acotados al mes actual/anterior — solo la gráfica mira hacia atrás.
    const [serieAnio, serieMes] = [Number(fechas.inicio.slice(0, 4)), Number(fechas.inicio.slice(5, 7))];
    const inicioSerieInstante = medianocheLocal(serieAnio, serieMes - 5, 1, configGlobal.zona_horaria);
    const inicioSerieFecha = cadenaFecha(serieAnio, serieMes - 5, 1);

    const [[kpiVentas]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? THEN o.total END), 0) AS ventas,
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? THEN o.cantidad END), 0) AS subtotal,
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? AND o.facturado_en IS NOT NULL THEN o.total END), 0) AS facturado,
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? AND o.facturado_en IS NOT NULL THEN o.total END), 0) AS facturado_anterior,
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? THEN 1 END), 0) AS ops_totales,
         COALESCE(SUM(CASE WHEN o.fecha_compra >= ? AND o.fecha_compra < ? AND o.facturado_en IS NOT NULL THEN 1 END), 0) AS ops_facturadas
       FROM ordenes_compra o
       WHERE o.eliminado_en IS NULL AND o.fecha_compra >= ?`,
      [inicio, fin, inicio, fin, inicio, fin, inicioAnterior, finAnterior, inicio, fin, inicio, fin, inicioAnterior]
    );
    const [[kpiGastos]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? THEN monto END), 0) AS gastos,
         COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? THEN monto END), 0) AS gastos_anterior
       FROM gastos
       WHERE eliminado_en IS NULL AND fecha >= ?`,
      [fechas.inicio, fechas.fin, fechas.inicioAnterior, fechas.finAnterior, fechas.inicioAnterior]
    );

    const ventas = Number(kpiVentas.ventas);
    const facturado = Number(kpiVentas.facturado);
    const facturadoAnterior = Number(kpiVentas.facturado_anterior);
    const subtotalVentas = Number(kpiVentas.subtotal);
    const opsTotales = Number(kpiVentas.ops_totales);
    const opsFacturadas = Number(kpiVentas.ops_facturadas);
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
         SUM(CASE WHEN o.facturado_en IS NOT NULL THEN o.total ELSE 0 END) AS facturado
       FROM ordenes_compra o
       WHERE o.eliminado_en IS NULL AND o.fecha_compra >= ?
       GROUP BY DATE_FORMAT(o.fecha_compra, '%Y-%m')`,
      [inicioSerieInstante]
    );
    const [filasGastosSerie] = await pool.query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, SUM(monto) AS gastos
       FROM gastos
       WHERE eliminado_en IS NULL AND fecha >= ?
       GROUP BY DATE_FORMAT(fecha, '%Y-%m')`,
      [inicioSerieFecha]
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
        subtotal,
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
      `SELECT categoria, SUM(monto) AS monto, COUNT(*) AS cantidad,
              SUM(CASE WHEN tiene_factura = 1 THEN 1 ELSE 0 END) AS con_comprobante
         FROM gastos
        WHERE eliminado_en IS NULL AND fecha >= ? AND fecha < ?
        GROUP BY categoria
        ORDER BY monto DESC`,
      [fechas.inicio, fechas.fin]
    );
    // Mes anterior por categoría, para la Variación MoM real del modal
    // ampliado (homologado con stitch/..._ux_redesign, columna "Variación
    // MoM" de la tabla — antes era un % fijo inventado en el mockup).
    const [filasGastosCategoriaAnterior] = await pool.query(
      `SELECT categoria, SUM(monto) AS monto
         FROM gastos
        WHERE eliminado_en IS NULL AND fecha >= ? AND fecha < ?
        GROUP BY categoria`,
      [fechas.inicioAnterior, fechas.finAnterior]
    );
    const mapaGastosCategoriaAnterior = new Map(filasGastosCategoriaAnterior.map((f) => [f.categoria, Number(f.monto)]));
    const mapaTipoCategoria = await mapaTipoPorCategoria();

    // Gastos sin comprobante fiscal del mes — mismo campo real
    // `tiene_factura` que ya usa la vista Gastos (filtro "Comprobante"),
    // reutilizado aquí para la caja de sugerencia honesta del modal
    // ampliado (equivalente a "ventas sin facturar" pero del lado de
    // Gastos).
    const [[kpiGastosSinComprobante]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN tiene_factura = 0 THEN monto END), 0) AS monto,
              COALESCE(SUM(CASE WHEN tiene_factura = 0 THEN 1 END), 0) AS cantidad
         FROM gastos
        WHERE eliminado_en IS NULL AND fecha >= ? AND fecha < ?`,
      [fechas.inicio, fechas.fin]
    );

    // Top 5 proveedores de gasto del mes en curso — dato accionable real
    // (columna `proveedor`, texto libre capturado en el alta del gasto);
    // se excluyen los gastos sin proveedor capturado. `categoria_top` es
    // la categoría más frecuente de ESE proveedor en el mes (un proveedor
    // real puede tener gastos en más de una categoría — se muestra la
    // dominante, no todas, mismo criterio que "Mayor egreso").
    const [filasTopProveedores] = await pool.query(
      `SELECT proveedor, SUM(monto) AS monto,
         (SELECT g2.categoria FROM gastos g2
           WHERE g2.eliminado_en IS NULL AND g2.fecha >= ? AND g2.fecha < ?
             AND g2.proveedor = g.proveedor
           GROUP BY g2.categoria ORDER BY COUNT(*) DESC, SUM(g2.monto) DESC LIMIT 1) AS categoria_top
         FROM gastos g
        WHERE eliminado_en IS NULL AND fecha >= ? AND fecha < ?
          AND proveedor IS NOT NULL AND proveedor <> ''
        GROUP BY proveedor
        ORDER BY monto DESC
        LIMIT 5`,
      [fechas.inicio, fechas.fin, fechas.inicio, fechas.fin]
    );

    // Proyección de ventas de los próximos 2 meses: estimación estadística
    // simple (promedio del cambio mes a mes de los últimos 3 meses
    // CERRADOS, extendido hacia adelante), NO un pronóstico financiero —
    // se etiqueta como tal en el frontend. Sin al menos 3 meses cerrados
    // para calcular una tendencia, no se inventa nada (mismo criterio que
    // calcularTendencia() de arriba con el mes anterior).
    //
    // Bug real corregido (2026-09-02, reportado por el usuario tras un
    // cierre mensual): el mes EN CURSO (parcial — recién empieza) se
    // trataba como un mes cerrado más al calcular la tendencia. Los
    // primeros días de cualquier mes, eso compara "2 días de ventas" con
    // meses completos anteriores y hunde la proyección a $0 de forma
    // artificial — el bug se nota más justo después de un cierre porque
    // es cuando el mes en curso está más incompleto. La gráfica de barras
    // (serie_mensual) SIGUE mostrando el mes en curso con su dato real
    // parcial — eso es correcto, solo la tendencia lo excluye.
    let proyeccionVentas = null;
    // "YYYY-MM" del mes en curso — sale del calendario local (fechas.inicio),
    // no de getUTCMonth() sobre un instante: cerca del cambio de horario la
    // medianoche local del día 1 puede caer en el mes UTC anterior.
    const mesActualLlave = fechas.inicio.slice(0, 7);
    const mesesCerrados = llavesMeses.filter((llave) => llave !== mesActualLlave);
    if (mesesCerrados.length >= 3) {
      const ultimasLlaves = mesesCerrados.slice(-3);
      const ultimosValores = ultimasLlaves.map((llave) => Number(mapaVentasSerie.get(llave)?.ventas || 0));
      const promedioDelta = ((ultimosValores[1] - ultimosValores[0]) + (ultimosValores[2] - ultimosValores[1])) / 2;
      const ultimoValor = ultimosValores[2];
      // Ancla de las ETIQUETAS: el último mes con CUALQUIER dato (mismo
      // criterio de siempre, `llavesMeses`, no `mesesCerrados`) — puede
      // ser el mes en curso (caso normal: hay actividad hoy) o uno
      // anterior (caso raro: cero actividad todavía este mes). Solo el
      // NÚMERO sale de la tendencia de meses cerrados; el desfase entre
      // el ancla de etiqueta y el último mes cerrado usado en la
      // tendencia se compensa abajo (normalmente 1 salto más).
      const ultimaLlave = llavesMeses[llavesMeses.length - 1];
      const [anioAncla, mesAncla] = ultimaLlave.split('-').map(Number);
      const [anioUltimoCerrado, mesUltimoCerrado] = ultimasLlaves[2].split('-').map(Number);
      proyeccionVentas = [1, 2].map((n) => {
        const fechaProyectada = new Date(Date.UTC(anioAncla, mesAncla - 1 + n, 1));
        const llaveProyectada = `${fechaProyectada.getUTCFullYear()}-${String(fechaProyectada.getUTCMonth() + 1).padStart(2, '0')}`;
        const mesesDesdeUltimoCerrado =
          (fechaProyectada.getUTCFullYear() * 12 + fechaProyectada.getUTCMonth()) -
          (anioUltimoCerrado * 12 + (mesUltimoCerrado - 1));
        return {
          mes: etiquetaMes(llaveProyectada),
          ventas: Math.max(0, Math.round((ultimoValor + promedioDelta * mesesDesdeUltimoCerrado) * 100) / 100),
        };
      });
    }

    // "Gastos Variables/Flexibles" (KPI del modal ampliado): suma de las
    // categorías con tipo='variable' (categorias_gastos.tipo, editable
    // desde el panel "✏️ Categorías") — categorías sin fila en el mapa
    // (no debería pasar, pero por seguridad) cuentan como variable, mismo
    // default que la columna en MySQL.
    let gastosVariables = 0;
    for (const f of filasGastosCategoria) {
      if ((mapaTipoCategoria.get(f.categoria) || 'variable') === 'variable') {
        gastosVariables += Number(f.monto);
      }
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
        ops_totales: opsTotales,
        ops_facturadas: opsFacturadas,
        ops_sin_facturar: opsTotales - opsFacturadas,
        gastos_variables: Math.round(gastosVariables * 100) / 100,
        gastos_sin_comprobante: Number(kpiGastosSinComprobante.monto),
        gastos_sin_comprobante_cantidad: Number(kpiGastosSinComprobante.cantidad),
      },
      tendencia: {
        facturado: calcularTendencia(facturado, facturadoAnterior),
        gastos: calcularTendencia(gastos, gastosAnterior),
      },
      serie_mensual: serie,
      gastos_por_categoria: filasGastosCategoria.map((f) => {
        const montoAnterior = mapaGastosCategoriaAnterior.get(f.categoria) || 0;
        return {
          categoria: f.categoria,
          monto: Number(f.monto),
          cantidad: Number(f.cantidad),
          con_comprobante: Number(f.con_comprobante),
          tipo: mapaTipoCategoria.get(f.categoria) || 'variable',
          variacion_mom: montoAnterior > 0 ? Math.round(((Number(f.monto) - montoAnterior) / montoAnterior) * 1000) / 10 : null,
        };
      }),
      top_proveedores: filasTopProveedores.map((f) => ({ proveedor: f.proveedor, monto: Number(f.monto), categoria: f.categoria_top || null })),
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
      'cobranza',
    ],
    spanMin: 3,
    spanMax: 12,
    // Alto libre en píxeles (resize vertical, pedido por el usuario junto
    // al resize de ancho ya existente) — rango generoso para que una
    // tarjeta chica (KPI) y una con tabla larga (modal aparte, esto es
    // solo la vista embebida) quepan ambas; sin `height` en el item se
    // queda en alto automático (comportamiento de siempre).
    heightMin: 160,
    heightMax: 900,
  },
};

// Normaliza/valida un layout del cliente contra la whitelist de la vista.
// Devuelve el arreglo limpio [{id, span, height?}] o null si algo no
// cuadra — un layout parcialmente válido se rechaza completo para que el
// frontend nunca guarde a medias. `height` es opcional (ausente = alto
// automático); si viene, debe ser un entero dentro del rango de la vista.
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
    if (item.height !== undefined && item.height !== null) {
      if (!Number.isInteger(item.height) || item.height < configVista.heightMin || item.height > configVista.heightMax) {
        return null;
      }
    }
    vistos.add(item.id);
    const limpioItem = { id: item.id, span: item.span };
    if (item.height !== undefined && item.height !== null) limpioItem.height = item.height;
    limpio.push(limpioItem);
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
  requiereFeature('ventasHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('ventasHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
      const coloresReporte = coloresCorreoTenant(req);
      resultadoReporte = await generarYEnviarReporte({
        tipo: 'manual',
        items: [item],
        rangoInicio: orden.creado_en,
        rangoFin: orden.creado_en,
        marca: marcaDelTenant(req),
        urlPortal: detectarUrlPortal(req),
        marcaLogoUrlTenant: req.tenant && req.tenant.marcaLogoUrl,
        colorPrimario: coloresReporte.primario,
        colorAccent: coloresReporte.acento,
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
    // Punto 158 — Cierre mensual archivado: por defecto oculta archivados;
    // ?periodo=YYYY-MM muestra ese cierre; ?incluirArchivadas=true muestra todo.
    const periodoGasto = typeof req.query.periodo === 'string' ? req.query.periodo.trim() : '';
    const incluirArchivadasGasto = req.query.incluirArchivadas === 'true';
    if (!verPapelera) {
      if (/^\d{4}-\d{2}$/.test(periodoGasto)) {
        condiciones.push('periodo_archivado = ?');
        params.push(periodoGasto);
      } else if (!incluirArchivadasGasto) {
        condiciones.push('archivado_en IS NULL');
      }
    }
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
      // gastos.fecha es DATE con el calendario local -> familia `fechas`
      // (los `instantes` de aquí serían 06:00Z y dejarían fuera el día 1
      // completo de cada mes). Ver utils/limitesPeriodo.js.
      const { fechas } = limitesMes(configGlobal.zona_horaria);
      const [filasResumen] = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? THEN monto END), 0) AS mes_actual,
           COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? AND tiene_factura = 1 THEN monto END), 0) AS con_factura,
           COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? AND tiene_factura = 0 THEN monto END), 0) AS sin_factura,
           COALESCE(SUM(CASE WHEN fecha >= ? AND fecha < ? THEN monto END), 0) AS mes_anterior,
           COUNT(CASE WHEN fecha >= ? AND fecha < ? THEN 1 END) AS cantidad
         FROM gastos WHERE eliminado_en IS NULL`,
        [
          fechas.inicio,
          fechas.fin,
          fechas.inicio,
          fechas.fin,
          fechas.inicio,
          fechas.fin,
          fechas.inicioAnterior,
          fechas.finAnterior,
          fechas.inicio,
          fechas.fin,
        ]
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
  asyncHandler(async (req, res) => {
    const categorias = await listarCategoriasGastos();
    res.json({ categorias });
  })
);

app.post(
  '/api/admin/gastos/categorias',
  adminApiLimiter,
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
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

// Clasificación fijo/variable (ver PROJECT_STATE.md, KPI "Gastos
// Variables/Flexibles" del modal ampliado de "Distribución de gastos por
// categoría") — no afecta el CHECK de negocio de `gastos`, es solo
// metadata de la categoría para agrupar en Resumen financiero.
app.put(
  '/api/admin/gastos/categorias/:id/tipo',
  adminApiLimiter,
  requiereFeature('gastosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador inválido.' });
    }
    const resultado = await actualizarTipoCategoriaGasto(id, req.body && req.body.tipo);
    if (resultado.error) {
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    res.json({ ok: true, categoria: resultado, mensaje: 'Tipo actualizado.' });
  })
);

// ---------------------------------------------------------------------
// Inventarios — segmento 2: CRUD backend + kardex (ver inventarios.md).
// Motor de existencias/concurrencia ya vive en utils/inventario.js
// (segmento 1); este bloque solo valida entrada HTTP y arma respuestas,
// mismo patrón que Gastos arriba. Auditoría de POST/PUT/DELETE es
// automática (middleware global de /api/admin más arriba, segmento 7).
// ---------------------------------------------------------------------

// Punto 158 — Periodos archivados (Ventas+Gastos) para poblar el
// selector de "Mes actual / periodo" en el frontend. Devuelve los
// YYYY-MM distintos que ya tienen al menos una fila archivada.
app.get(
  '/api/admin/periodos-archivados',
  adminApiLimiter,
  requiereFeature(['ventasHabilitado', 'gastosHabilitado']),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas'),
  asyncHandler(async (req, res) => {
    const [vRows] = await pool.query(
      "SELECT DISTINCT periodo_archivado AS periodo FROM ordenes_compra WHERE periodo_archivado IS NOT NULL ORDER BY periodo DESC"
    );
    const [gRows] = await pool.query(
      "SELECT DISTINCT periodo_archivado AS periodo FROM gastos WHERE periodo_archivado IS NOT NULL ORDER BY periodo DESC"
    );
    const set = new Set([...vRows.map((r) => r.periodo), ...gRows.map((r) => r.periodo)]);
    const periodos = [...set].sort().reverse();
    res.json({ periodos, ventas: vRows.map((r) => r.periodo), gastos: gRows.map((r) => r.periodo) });
  })
);

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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  asyncHandler(async (req, res) => {
    res.json({ configuracion: await obtenerConfigInventario() });
  })
);

app.put(
  '/api/admin/inventarios/configuracion/:clave',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  asyncHandler(async (req, res) => {
    const { clave } = req.params;
    if (!CLAVES_CONFIG_INVENTARIO[clave]) {
      return res.status(400).json({ error: `Clave de configuración no reconocida: ${clave}.` });
    }
    const valor = req.body && typeof req.body.valor !== 'undefined' ? String(req.body.valor) : '';

    // "Solamente servicios": no se puede encender con productos físicos
    // ya activos en el catálogo — se sentiría como que el inventario
    // "desapareció" aunque los datos sigan intactos. Dar de baja/archivar
    // esos productos primero (mismo criterio ya aprobado en la propuesta).
    if (clave === 'inv_solo_servicios' && valor === '1') {
      if (!(await inventarioActivo())) {
        return res.status(400).json({
          error: 'INV_MODULO_INACTIVO',
          mensaje: 'Activa primero "Inventario activo" antes de encender "Solamente servicios".',
        });
      }
      const [[fila]] = await pool.query(
        "SELECT COUNT(*) AS total FROM productos WHERE eliminado_en IS NULL AND estado = 'activo' AND tipo = 'producto'"
      );
      if (Number(fila.total) > 0) {
        return res.status(400).json({
          error: 'INV_HAY_PRODUCTOS_ACTIVOS',
          mensaje: `No puedes activar "Solamente servicios" con ${fila.total} producto${Number(fila.total) === 1 ? '' : 's'} activo${Number(fila.total) === 1 ? '' : 's'} en el catálogo. Da de baja o archiva esos productos primero.`,
        });
      }
    }

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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  asyncHandler(async (req, res) => {
    res.json({ diccionario: obtenerDiccionarioInventario() });
  })
);

// ---------- Categorías ----------

app.get(
  '/api/admin/inventarios/categorias',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    res.json({ categorias: await listarCategoriasInventario() });
  })
);

app.post(
  '/api/admin/inventarios/categorias',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query('SELECT id, nombre, abreviatura, permite_decimales FROM unidades_medida ORDER BY nombre ASC');
    res.json({
      unidades: filas.map((u) => ({ id: u.id, nombre: u.nombre, abreviatura: u.abreviatura, permite_decimales: Boolean(u.permite_decimales) })),
    });
  })
);

app.post(
  '/api/admin/inventarios/unidades',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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

// Punto 213/339: ventana del indicador "Por vencer" — cuenta juntos
// productos YA vencidos y los que vencen dentro de esta cantidad de días.
// Antes era una constante fija (30); ahora es el mayor valor entre las
// reglas escalonadas configurables en Configuraciones → Notificaciones
// (obtenerDiasMaximoAvisoExpiracion(), backend/utils/config.js) — mismo
// criterio compartido entre el filtro de la lista (ventana emergente) y
// el conteo del dashboard, para que nunca puedan desincronizarse entre sí
// (mismo criterio que utilidad_neta en /resumen-financiero).

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
    fecha_expiracion: p.fecha_expiracion || null,
    notas: p.notas,
    // Datos migrados por el importador masivo (§34.4) que todavía no tienen
    // campo formal — nunca participa en lógica de negocio, solo consulta.
    extra: p.extra ? (typeof p.extra === 'string' ? JSON.parse(p.extra) : p.extra) : null,
    creado_en: p.creado_en,
    actualizado_en: p.actualizado_en,
    disponible: existenciaDisponible === undefined || existenciaDisponible === null ? null : Number(existenciaDisponible),
    // Punto 159 (Segmento B): solo la URL, nunca la key de MinIO —
    // mismo criterio que marca_logo_url. null si el producto no tiene
    // imagen todavía (evita una petición al backend que solo daría 404).
    // "?t=" es cache-busting: reemplazar la imagen sobreescribe la MISMA
    // key en MinIO (nombre de archivo fijo, no uuid), así que sin esto
    // el navegador seguiría mostrando la versión vieja hasta agotar
    // Cache-Control.
    imagen_url: p.imagen_key ? `/api/admin/inventarios/productos/${p.id}/imagen?t=${new Date(p.imagen_actualizada_en).getTime()}` : null,
    imagen_thumb_url: p.imagen_thumb_key ? `/api/admin/inventarios/productos/${p.id}/imagen?v=thumb&t=${new Date(p.imagen_actualizada_en).getTime()}` : null,
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

  const tipo = body.tipo === 'servicio' ? 'servicio' : 'producto';
  const moneda = body.moneda === 'USD' ? 'USD' : 'MXN';

  // "Solamente servicios": bloquea la ALTA de un producto físico nuevo
  // por completo (sin importar el estado que traiga). La edición de uno
  // que ya existiera de antes del switch (inactivo/archivado) sigue
  // permitida para corregir datos — el segundo guard, más abajo una vez
  // calculado `estado`, cierra el hueco real de REACTIVARLO mientras el
  // switch sigue encendido (editar y mandar estado:'activo' se saltaba
  // este primer guard por completo, idExcluir !== null).
  const soloServicios = await soloServiciosActivo();
  if (tipo === 'producto' && idExcluir === null && soloServicios) {
    res.status(400).json({
      error: 'INV_SOLO_SERVICIOS_ACTIVO',
      mensaje: 'Con "Solamente servicios" activo solo puedes dar de alta servicios.',
    });
    return null;
  }

  // Punto 179: un servicio no tiene código de barras (nunca se escanea) —
  // se ignora lo que mande el body sin siquiera validar duplicidad.
  const codigoBarras = tipo === 'servicio' ? null : sanitizeText(body.codigo_barras, 60) || null;
  if (codigoBarras && (await codigoBarrasEnUso(codigoBarras, idExcluir))) {
    res.status(400).json({ error: 'Ya existe un producto con ese código de barras.' });
    return null;
  }

  // Punto 179 + [Servicio en paquete]: un servicio solo admite un
  // subconjunto pequeño de unidades — "Hora" (cobro por tiempo, horas
  // enteras) o "Paquete" (precio fijo por todo el servicio, sin importar
  // el tiempo) — NUNCA el catálogo completo (Litro/Kilogramo no aplican
  // a un servicio). Se valida del lado del servidor lo que mande el
  // body, no solo lo que el modal del frontend ya restrinja visualmente.
  // Sin `unidad_id` en el body (compatibilidad con integraciones viejas
  // de antes de esta unidad nueva), cae al default histórico: "Hora".
  let unidadId;
  if (tipo === 'servicio') {
    const unidadSolicitadaId = Number(body.unidad_id);
    if (Number.isInteger(unidadSolicitadaId)) {
      const nombreUnidadSolicitada = await obtenerNombreUnidadPorId(unidadSolicitadaId);
      if (!nombreUnidadSolicitada || !UNIDADES_SERVICIO_VALIDAS.includes(nombreUnidadSolicitada)) {
        res.status(400).json({
          error: 'INV_UNIDAD_SERVICIO_INVALIDA',
          mensaje: `Un servicio solo admite la unidad ${UNIDADES_SERVICIO_VALIDAS.map((n) => `"${n}"`).join(' o ')}.`,
        });
        return null;
      }
      unidadId = unidadSolicitadaId;
    } else {
      unidadId = await obtenerUnidadServicioId();
      if (!unidadId) {
        res.status(400).json({ error: 'INV_UNIDAD_SERVICIO_NO_CONFIGURADA', mensaje: 'La unidad "Hora" no está configurada en el catálogo.' });
        return null;
      }
    }
  } else {
    unidadId = Number(body.unidad_id);
    if (!Number.isInteger(unidadId) || !(await unidadExisteId(unidadId))) {
      res.status(400).json({ error: 'INV_UNIDAD_INVALIDA', mensaje: 'Selecciona una unidad de medida válida.' });
      return null;
    }
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
  let stockMinimo = numeroOpcional(body.stock_minimo);
  let stockMaximo = numeroOpcional(body.stock_maximo);
  let puntoReorden = numeroOpcional(body.punto_reorden);
  if ([costo, precio, stockMinimo, stockMaximo, puntoReorden].some((v) => Number.isNaN(v))) {
    res.status(400).json({ error: 'Alguno de los campos numéricos no es válido.' });
    return null;
  }
  if ((costo !== null && costo < 0) || (precio !== null && precio < 0)) {
    res.status(400).json({ error: 'Costo y precio deben ser mayores o iguales a cero.' });
    return null;
  }

  const estado = ['activo', 'inactivo', 'archivado'].includes(body.estado) ? body.estado : 'activo';

  // Cierra el hueco del guard de arriba: reactivar (editar → estado
  // 'activo') un producto físico archivado/inactivo mientras "Solamente
  // servicios" sigue encendido reintroduce exactamente el estado que el
  // switch de configuración impide encender en primer lugar. Editar OTROS
  // campos de ese mismo producto sin tocar su estado (o dejándolo
  // inactivo/archivado) sigue permitido.
  if (tipo === 'producto' && estado === 'activo' && idExcluir !== null && soloServicios) {
    res.status(400).json({
      error: 'INV_SOLO_SERVICIOS_ACTIVO',
      mensaje: 'Con "Solamente servicios" activo no puedes reactivar un producto — solo los servicios pueden estar activos.',
    });
    return null;
  }

  const proveedorPrincipal = sanitizeText(body.proveedor_principal, 200) || null;
  const notas = sanitizeTextoLibre(body.notas, 2000) || null;

  // Punto 213: fecha de expiración opcional, POR PRODUCTO — nunca aplica
  // a servicios (mismo criterio que stock mínimo/máximo/punto de
  // reorden, forzado más abajo junto con esos 3). Sin restricción de
  // "no en el pasado": se puede capturar stock ya vencido a propósito.
  let fechaExpiracion = null;
  const fechaExpiracionTexto = sanitizeText(body.fecha_expiracion, 10);
  if (fechaExpiracionTexto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaExpiracionTexto) || Number.isNaN(new Date(`${fechaExpiracionTexto}T00:00:00Z`).getTime())) {
      res.status(400).json({ error: 'La fecha de expiración debe ser YYYY-MM-DD.' });
      return null;
    }
    fechaExpiracion = fechaExpiracionTexto;
  }

  // Punto 179: un servicio no tiene mínimos/máximos/punto de reorden de
  // existencia (nunca genera movimientos, D11) — se ignora cualquier
  // valor que mande el body y queda NA en la base de datos.
  if (tipo === 'servicio') {
    stockMinimo = null;
    stockMaximo = null;
    puntoReorden = null;
    fechaExpiracion = null;
  }

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
    fechaExpiracion,
    notas,
  };
}

app.get(
  '/api/admin/inventarios/productos',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
    // Punto 213: alimenta la ventana emergente del indicador "Por vencer"
    // del dashboard — mismo umbral (UMBRAL_POR_VENCER_DIAS) y mismas
    // restricciones (solo producto físico, activo) que ese conteo, para
    // que la lista siempre coincida exactamente con el número mostrado.
    if (req.query.vencimiento === 'por_vencer') {
      condiciones.push(
        "p.tipo = 'producto' AND p.estado = 'activo' AND p.fecha_expiracion IS NOT NULL AND p.fecha_expiracion <= DATE_ADD(CURDATE(), INTERVAL ? DAY)"
      );
      params.push(await obtenerDiasMaximoAvisoExpiracion());
    }
    // Punto: chips rápidos de la tabla — mismas 3 condiciones exactas que
    // ya usa GET /dashboard para sus tarjetas "Bajo mínimo"/"Sin
    // existencia", para que el chip y el KPI nunca puedan desincronizarse.
    if (req.query.stock === 'bajo_minimo') {
      condiciones.push("p.tipo = 'producto' AND p.stock_minimo IS NOT NULL AND COALESCE(e.disponible, 0) < p.stock_minimo");
    } else if (req.query.stock === 'sin_existencia') {
      condiciones.push("p.tipo = 'producto' AND COALESCE(e.disponible, 0) = 0");
    } else if (req.query.stock === 'optimo') {
      condiciones.push(
        "p.tipo = 'producto' AND COALESCE(e.disponible, 0) > 0 AND (p.stock_minimo IS NULL OR COALESCE(e.disponible, 0) >= p.stock_minimo)"
      );
    }
    condiciones.push(verPapelera ? 'p.eliminado_en IS NOT NULL' : 'p.eliminado_en IS NULL');
    const where = condiciones.join(' AND ');
    // Los filtros de stock leen e.disponible, así que el JOIN a
    // existencias tiene que existir también en el COUNT, no solo en la
    // consulta paginada.
    const fromConExistencias = `FROM productos p
         LEFT JOIN existencias e ON e.producto_id = p.id AND e.almacen_id = (SELECT id FROM almacenes WHERE codigo = ? LIMIT 1)`;

    const [contador] = await pool.query(`SELECT COUNT(*) AS total ${fromConExistencias} WHERE ${where}`, [
      ALMACEN_DEFECTO_CODIGO,
      ...params,
    ]);
    const total = Number(contador[0].total);

    // "Por vencer": lo más urgente primero (el que vence antes, arriba)
    // en vez del orden alfabético de siempre.
    const orden = req.query.vencimiento === 'por_vencer' ? 'p.fecha_expiracion ASC' : 'p.nombre ASC';
    const [filas] = await pool.query(
      `SELECT p.*, e.disponible AS disponible
         ${fromConExistencias}
        WHERE ${where}
        ORDER BY ${orden}
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const datos = await validarCuerpoProducto(req, res);
    if (!datos) return;

    const ahora = new Date();
    ahora.setMilliseconds(0);
    const [resultado] = await pool.query(
      `INSERT INTO productos
        (sku, codigo_barras, nombre, categoria_id, unidad_id, tipo, moneda, costo, precio,
         stock_minimo, stock_maximo, punto_reorden, estado, proveedor_principal, fecha_expiracion, notas,
         creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.sku, datos.codigoBarras, datos.nombre, datos.categoriaId, datos.unidadId, datos.tipo, datos.moneda,
        datos.costo, datos.precio, datos.stockMinimo, datos.stockMaximo, datos.puntoReorden,
        datos.estado, datos.proveedorPrincipal, datos.fechaExpiracion, datos.notas, ahora, ahora,
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'ventas', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const termino = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!termino || termino.length > 100) {
      return res.json({ productos: [] });
    }
    const almacenId = await obtenerAlmacenDefectoId();
    const patron = `%${termino}%`;
    const [filas] = await pool.query(
      `SELECT p.id, p.sku, p.nombre, p.codigo_barras, p.precio, p.tipo, p.imagen_thumb_key, p.imagen_actualizada_en, e.disponible,
              um.nombre AS unidad_nombre, um.abreviatura AS unidad_abreviatura, um.permite_decimales
         FROM productos p
         LEFT JOIN existencias e ON e.producto_id = p.id AND e.almacen_id = ?
         JOIN unidades_medida um ON um.id = p.unidad_id
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
        // Punto 175: la unidad de medida del producto decide si la
        // cantidad en Ventas admite decimales o exige entero.
        unidad_nombre: p.unidad_nombre,
        unidad_abreviatura: p.unidad_abreviatura,
        permite_decimales: Boolean(p.permite_decimales),
        imagen_thumb_url: p.imagen_thumb_key
          ? `/api/admin/inventarios/productos/${p.id}/imagen?v=thumb&t=${new Date(p.imagen_actualizada_en).getTime()}`
          : null,
      })),
    });
  })
);

app.get(
  '/api/admin/inventarios/productos/:id',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
         proveedor_principal = ?, fecha_expiracion = ?, notas = ?, actualizado_en = ?
       WHERE id = ?`,
      [
        datos.sku, datos.codigoBarras, datos.nombre, datos.categoriaId, datos.unidadId, datos.tipo, datos.moneda,
        datos.costo, datos.precio, datos.stockMinimo, datos.stockMaximo, datos.puntoReorden,
        datos.estado, datos.proveedorPrincipal, datos.fechaExpiracion, datos.notas, ahora, id,
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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

// Imagen principal de producto (punto 159, Segmento B). Solo después de
// que el producto ya existe — mismo criterio que el comprobante de
// Gastos: crear es JSON, el archivo es una petición aparte una vez que
// hay un :id al que asociarlo.
app.post('/api/admin/inventarios/productos/:id/imagen', adminApiLimiter, requiereFeature('inventariosHabilitado'), requireAdminAuth, requireAdminArea('administrador', 'inventario'), requireInventarioActivo, (req, res) => {
  subirConTenant(uploadImagen, 'imagen', req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `La imagen excede el tamaño máximo permitido de ${IMAGEN_MAX_MB_MAX} MB.` });
      }
      if (err.message === 'TIPO_NO_PERMITIDO') {
        return res.status(400).json({ error: 'Solo se aceptan imágenes en formato JPG, PNG o WEBP.' });
      }
      console.error('Error al subir la imagen de producto:', err);
      return res.status(400).json({ error: 'No se pudo procesar la imagen.' });
    }
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
      if (!req.file) return res.status(400).json({ error: 'Debes adjuntar una imagen.' });

      // Punto 370: máximo real y configurable desde /control.
      const imagenMaxMbProducto = await obtenerImagenMaxMbCacheado();
      if (req.file.size > imagenMaxMbProducto * 1024 * 1024) {
        return res.status(413).json({
          error: `La imagen excede el tamaño máximo permitido de ${imagenMaxMbProducto} MB.`,
        });
      }

      const producto = await obtenerProductoPorId(id);
      if (!producto) return res.status(404).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado.' });

      // Punto 347: cuota de disco impuesta desde /control — usa SIEMPRE el
      // caché (disco_bytes_usados_cache, se actualiza con "Recalcular" en
      // /control), nunca se mide en vivo aquí. Sin cuota (null) o sin
      // caché todavía (null, nunca se recalculó) nunca bloquea — solo
      // rechaza cuando SÍ hay ambos números y el caché ya la superó.
      if (
        req.tenant &&
        req.tenant.discoCuotaMb != null &&
        req.tenant.discoBytesUsadosCache != null &&
        req.tenant.discoBytesUsadosCache >= req.tenant.discoCuotaMb * 1024 * 1024
      ) {
        return res.status(413).json({
          error: 'DISCO_CUOTA_EXCEDIDA',
          mensaje: 'Esta empresa ya alcanzó su cuota de espacio para imágenes — contacta a soporte para ampliarla.',
        });
      }

      const prefijo = storage.prefijoTenant(req);
      let resultado;
      try {
        resultado = await guardarImagenProducto(prefijo, id, req.file.buffer);
      } catch (errImagen) {
        if (errImagen instanceof ErrorImagenProducto) {
          return res.status(400).json({ error: errImagen.codigo, mensaje: errImagen.message });
        }
        throw errImagen;
      }

      const ahora = new Date();
      ahora.setMilliseconds(0);
      await pool.query(
        'UPDATE productos SET imagen_key = ?, imagen_thumb_key = ?, imagen_actualizada_en = ?, actualizado_en = ? WHERE id = ?',
        [resultado.imagenKey, resultado.thumbKey, ahora, ahora, id]
      );

      res.json({
        ok: true,
        imagen_url: `/api/admin/inventarios/productos/${id}/imagen`,
        imagen_thumb_url: `/api/admin/inventarios/productos/${id}/imagen?v=thumb`,
      });
    } catch (errGeneral) {
      console.error('Error guardando la imagen de producto:', errGeneral);
      res.status(500).json({ error: 'No se pudo guardar la imagen.' });
    }
  });
});

app.get(
  '/api/admin/inventarios/productos/:id/imagen',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const producto = await obtenerProductoPorId(id);
    if (!producto) return res.status(404).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado.' });

    const esThumb = req.query.v === 'thumb';
    const key = esThumb ? producto.imagen_thumb_key : producto.imagen_key;
    if (!key) return res.status(404).json({ error: 'Este producto no tiene imagen.' });

    const prefijo = storage.prefijoTenant(req);
    const carpeta = `productos/${id}`;
    const nombreArchivo = esThumb ? 'thumb_principal.webp' : 'principal.webp';
    try {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      await storage.enviarArchivoARespuesta(prefijo, carpeta, nombreArchivo, res);
    } catch (err) {
      console.error(`Error sirviendo la imagen del producto ${id}:`, err);
      res.status(500).json({ error: 'No se pudo leer la imagen.' });
    }
  })
);

app.delete(
  '/api/admin/inventarios/productos/:id/imagen',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const producto = await obtenerProductoPorId(id);
    if (!producto) return res.status(404).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado.' });

    const prefijo = storage.prefijoTenant(req);
    await eliminarImagenProducto(prefijo, id);

    const ahora = new Date();
    ahora.setMilliseconds(0);
    await pool.query(
      'UPDATE productos SET imagen_key = NULL, imagen_thumb_key = NULL, imagen_actualizada_en = NULL, actualizado_en = ? WHERE id = ?',
      [ahora, id]
    );
    res.json({ ok: true, mensaje: 'Imagen eliminada.' });
  })
);

app.post(
  '/api/admin/inventarios/productos/:id/restaurar',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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

// Código de barras imprimible (punto 167) — Code128, el único formato del
// set que ya lee scanner.js (punto 159) capaz de codificar TEXTO libre, no
// solo dígitos: `codigo_barras` es VARCHAR(60) sin formato forzado (puede
// traer letras/guiones si el cliente lo capturó así), y a falta de uno se
// usa el `sku` (también único y obligatorio, siempre hay algo que
// codificar). Generado en el servidor con bwip-js (MIT, sin dependencias,
// sin `canvas`/compilación nativa) para no vendorizar en el frontend una
// librería con lógica de checksum/character-set no trivial de auditar a
// mano.
app.get(
  '/api/admin/inventarios/productos/:id/codigo-barras.svg',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador inválido.' });
    const producto = await obtenerProductoPorId(id);
    if (!producto) return res.status(404).json({ error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto no encontrado.' });

    const valor = ((producto.codigo_barras || producto.sku || '').trim());
    if (!valor) {
      return res.status(400).json({ error: 'Este producto no tiene código de barras ni SKU para generar la etiqueta.' });
    }
    try {
      const svg = bwipjs.toSVG({ bcid: 'code128', text: valor, scale: 3, height: 12, includetext: false });
      res.set('Content-Type', 'image/svg+xml');
      res.set('Cache-Control', 'no-store');
      res.send(svg);
    } catch (err) {
      console.error('No se pudo generar el código de barras:', err.message);
      res.status(500).json({ error: 'No se pudo generar el código de barras para este producto.' });
    }
  })
);

// §38: solo se permite el borrado físico si el producto NUNCA tuvo
// movimientos — con historial, se queda en papelera para siempre.
app.delete(
  '/api/admin/inventarios/productos/:id/permanente',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
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
      INV_CANTIDAD_DEBE_SER_ENTERA: 400,
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    await manejarMovimiento(req, res, ['consumo_interno', 'merma', 'ajuste_negativo']);
  })
);

// ---------- Kardex y existencias ----------

app.get(
  '/api/admin/inventarios/kardex',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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

// Punto: "Exportar Kardex" del toolbar — a diferencia del Kardex de
// arriba (un producto a la vez), este junta TODOS los movimientos
// reales de TODO el catálogo activo (no eliminado) en un solo CSV. El
// backend arma el CSV directo (puede ser una lista larga) en vez de
// mandar JSON y construirlo en el navegador.
app.get(
  '/api/admin/inventarios/kardex-exportar',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const [filas] = await pool.query(
      `SELECT m.folio, m.tipo, m.cantidad, m.costo_unitario, m.existencia_anterior, m.existencia_posterior,
              m.motivo, m.documento_origen, m.usuario, m.creado_en, p.sku, p.nombre
         FROM movimientos_inventario m
         JOIN productos p ON p.id = m.producto_id
        WHERE p.eliminado_en IS NULL
        ORDER BY m.creado_en DESC, m.id DESC`
    );
    const csvCelda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const encabezado = ['Fecha', 'SKU', 'Producto', 'Tipo', 'Folio', 'Cantidad', 'Costo unitario', 'Existencia antes', 'Existencia después', 'Motivo', 'Documento origen', 'Usuario'];
    const lineas = filas.map((m) =>
      [
        m.creado_en, m.sku, m.nombre, m.tipo, m.folio || '',
        Number(m.cantidad), m.costo_unitario === null ? '' : Number(m.costo_unitario),
        Number(m.existencia_anterior), Number(m.existencia_posterior),
        m.motivo || '', m.documento_origen || '', m.usuario || '',
      ]
        .map(csvCelda)
        .join(',')
    );
    const csv = [encabezado.map(csvCelda).join(','), ...lineas].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kardex-inventarios.csv"');
    res.send(`﻿${csv}`);
  })
);

app.get(
  '/api/admin/inventarios/existencias',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const [[valorInventario]] = await pool.query(`
      SELECT COALESCE(SUM(e.disponible * p.costo_promedio), 0) AS valor
        FROM existencias e
        JOIN productos p ON p.id = e.producto_id
       WHERE p.eliminado_en IS NULL AND p.tipo = 'producto'
    `);
    // Punto 179: "Productos activos" es un medidor de INVENTARIO — un
    // servicio nunca genera existencias/movimientos (D11), así que no
    // debe contarse aquí (bug real: antes de esta línea sí se contaba,
    // esta consulta era la única de las 7 sin el filtro `tipo='producto'`
    // que ya tenían las otras 6, vía JOIN a existencias/movimientos que
    // un servicio nunca puebla). "Servicios activos" es su propio
    // contador, independiente, abajo.
    const [[productosActivos]] = await pool.query(
      "SELECT COUNT(*) AS total FROM productos WHERE eliminado_en IS NULL AND estado = 'activo' AND tipo = 'producto'"
    );
    const [[serviciosActivos]] = await pool.query(
      "SELECT COUNT(*) AS total FROM productos WHERE eliminado_en IS NULL AND estado = 'activo' AND tipo = 'servicio'"
    );
    // Punto 182 ("Solamente servicios"): mismo cálculo que el bloque
    // `servicios.kpis.servicios_sin_ventas_90d` de
    // GET /inventarios/reportes/estado — un servicio sin ninguna línea en
    // `orden_productos` en los últimos 90 días. Se duplica aquí (consulta
    // barata, un solo COUNT) en vez de llamar a ese otro endpoint interno,
    // para que el dashboard de "Inicio" no dependa de él.
    const [[serviciosSinVentas]] = await pool.query(`
      SELECT COUNT(*) AS total FROM productos p
       WHERE p.eliminado_en IS NULL AND p.estado = 'activo' AND p.tipo = 'servicio'
         AND NOT EXISTS (
           SELECT 1 FROM orden_productos op
            WHERE op.producto_id = p.id AND op.creado_en >= DATE_SUB(NOW(), INTERVAL 90 DAY)
         )
    `);
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
    // Punto 213/339: cuenta juntos vencidos + por vencer dentro de la
    // mayor regla escalonada configurada — mismas condiciones exactas que
    // el filtro `?vencimiento=por_vencer` de GET /productos, para que el
    // número de esta tarjeta y la lista de su ventana emergente siempre
    // coincidan.
    const [[porVencer]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM productos p
        WHERE p.eliminado_en IS NULL AND p.tipo = 'producto' AND p.estado = 'activo'
          AND p.fecha_expiracion IS NOT NULL AND p.fecha_expiracion <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
      [await obtenerDiasMaximoAvisoExpiracion()]
    );

    const unidadesDisponiblesNum = Number(unidadesDisponibles.total);
    const valorTotalInventarioNum = Number(valorInventario.valor);
    // Punto 278: mismo cálculo que "Estado del inventario"
    // (kpis.costo_promedio_ponderado) — pie de la tarjeta "Valor del
    // inventario", sin duplicar la fórmula del lado del frontend.
    const costoPromedioPonderado = unidadesDisponiblesNum > 0
      ? Math.round((valorTotalInventarioNum / unidadesDisponiblesNum) * 100) / 100
      : 0;

    res.json({
      valor_total_inventario: valorTotalInventarioNum,
      costo_promedio_ponderado: costoPromedioPonderado,
      productos_activos: Number(productosActivos.total),
      servicios_activos: Number(serviciosActivos.total),
      servicios_sin_ventas_90d: Number(serviciosSinVentas.total),
      unidades_disponibles: unidadesDisponiblesNum,
      productos_bajo_minimo: Number(bajoMinimo.total),
      productos_sin_existencia: Number(sinExistencia.total),
      productos_sin_movimiento: Number(sinMovimiento.total),
      productos_por_vencer: Number(porVencer.total),
      mermas_periodo_valor: Number(mermasPeriodo.valor),
      mermas_periodo_cantidad: Number(mermasPeriodo.cantidad),
    });
  })
);

// ---------- Reportes de estado ("Estado del inventario", 3ra pestaña de
// Reportes en admin.html) — 4 gráficas + 3 KPIs, todo de solo lectura.
// Ventana fija de 90 días desde NOW(). Vive bajo /inventarios/* (no
// /reportes/*) porque lee exclusivamente tablas del dominio de
// Inventarios y necesita el mismo gate requireInventarioActivo que
// /dashboard arriba, aunque el frontend la muestre dentro de la vista
// "Reportes" — la URL sigue el dominio de datos, no la superficie de UI.
app.get(
  '/api/admin/inventarios/reportes/estado',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requiereFeature('reportesEstadoInventarioHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    const almacenId = await obtenerAlmacenDefectoId();

    const [[valorInventario]] = await pool.query(
      `SELECT COALESCE(SUM(e.disponible * p.costo_promedio), 0) AS valor
         FROM existencias e
         JOIN productos p ON p.id = e.producto_id
        WHERE e.almacen_id = ?
          AND p.eliminado_en IS NULL AND p.estado = 'activo' AND p.tipo = 'producto'`,
      [almacenId]
    );

    // Punto 271: filas completas (no solo el conteo) para poder sumar el
    // monto inmovilizado real y señalar el producto con más $ atorado en
    // el banner de alerta — mismo criterio "sin movimiento" de siempre.
    const [filasSinMovimiento90d] = await pool.query(
      `SELECT p.id, p.nombre, p.costo_promedio, COALESCE(e.disponible, 0) AS existencia_actual
         FROM productos p
         LEFT JOIN existencias e ON e.producto_id = p.id AND e.almacen_id = ?
        WHERE p.eliminado_en IS NULL AND p.estado = 'activo' AND p.tipo = 'producto'
          AND NOT EXISTS (
            SELECT 1 FROM movimientos_inventario m
             WHERE m.producto_id = p.id AND m.almacen_id = ?
               AND m.creado_en >= DATE_SUB(NOW(), INTERVAL 90 DAY)
          )`,
      [almacenId, almacenId]
    );
    const sinMovimientoConMonto = filasSinMovimiento90d.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      monto: Math.round(Number(f.existencia_actual) * Number(f.costo_promedio || 0) * 100) / 100,
    }));
    const montoInmovilizado = Math.round(sinMovimientoConMonto.reduce((acc, f) => acc + f.monto, 0) * 100) / 100;
    const productoMasInmovilizado = sinMovimientoConMonto.reduce(
      (mejor, f) => (!mejor || f.monto > mejor.monto ? f : mejor),
      null
    );

    // Query base compartida por el KPI de rotación y las 4 gráficas — una
    // sola fuente de verdad, para que nunca puedan desincronizarse entre
    // sí (mismo criterio que /resumen-financiero con utilidad_neta).
    const [filasProductos] = await pool.query(
      `SELECT p.id, p.nombre, p.sku, p.costo_promedio, c.nombre AS categoria_nombre,
              COALESCE(e.disponible, 0) AS existencia_actual,
              COALESCE(SUM(CASE WHEN m.tipo = 'venta'
                                 AND m.creado_en >= DATE_SUB(NOW(), INTERVAL 90 DAY)
                            THEN m.cantidad ELSE 0 END), 0) AS unidades_vendidas_90d
         FROM productos p
         LEFT JOIN existencias e ON e.producto_id = p.id AND e.almacen_id = ?
         LEFT JOIN movimientos_inventario m ON m.producto_id = p.id AND m.almacen_id = ?
         LEFT JOIN categorias_inventario c ON c.id = p.categoria_id
        WHERE p.eliminado_en IS NULL AND p.estado = 'activo' AND p.tipo = 'producto'
        GROUP BY p.id, p.nombre, p.sku, p.costo_promedio, c.nombre, e.disponible`,
      [almacenId, almacenId]
    );

    const [filasCategoria] = await pool.query(
      `SELECT c.id AS categoria_id, c.nombre AS categoria_nombre,
              COALESCE(SUM(e.disponible * p.costo_promedio), 0) AS valor
         FROM categorias_inventario c
         JOIN productos p ON p.categoria_id = c.id
           AND p.eliminado_en IS NULL AND p.estado = 'activo' AND p.tipo = 'producto'
         JOIN existencias e ON e.producto_id = p.id AND e.almacen_id = ?
        GROUP BY c.id, c.nombre
       HAVING valor > 0
        ORDER BY c.id ASC`,
      [almacenId]
    );

    const productosConNumeros = filasProductos.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      sku: f.sku,
      categoria_nombre: f.categoria_nombre || null,
      costo_promedio: Number(f.costo_promedio || 0),
      existencia_actual: Number(f.existencia_actual),
      unidades_vendidas_90d: Number(f.unidades_vendidas_90d),
      valor: Math.round(Number(f.existencia_actual) * Number(f.costo_promedio || 0) * 100) / 100,
    }));

    const totalUnidades90d = productosConNumeros.reduce((acc, f) => acc + f.unidades_vendidas_90d, 0);
    const totalExistencia = productosConNumeros.reduce((acc, f) => acc + f.existencia_actual, 0);
    // Ratio de sumas (promedio PONDERADO), no promedio aritmético de
    // rotaciones individuales — un producto con existencia≈0 no puede
    // disparar un outlier absurdo que arrastre el promedio del catálogo.
    const rotacionPromedioCatalogo = totalUnidades90d / Math.max(totalExistencia, 1);

    const ordenadoPorVentas = [...productosConNumeros].sort((a, b) => b.unidades_vendidas_90d - a.unidades_vendidas_90d);
    const topVentas = ordenadoPorVentas.slice(0, 5);
    const bottomVentas = [...ordenadoPorVentas].reverse().slice(0, 5);

    const conRotacion = productosConNumeros.map((f) => ({
      ...f,
      // Aproximación honesta: unidades vendidas en 90 días ÷ existencia
      // actual — NO es rotación de inventario contable real (que usaría
      // existencia PROMEDIO del periodo, dato que este esquema no
      // guarda). Documentado también en el frontend junto a la gráfica.
      rotacion: f.unidades_vendidas_90d / Math.max(f.existencia_actual, 1),
    }));
    const rotacionTop8 = [...conRotacion].sort((a, b) => b.rotacion - a.rotacion).slice(0, 8);

    // Punto 271: clasificación por producto (no solo el conteo) — la
    // misma regla de siempre, reusada por la tabla "Matriz de riesgo" y
    // el export CSV, para que nunca puedan desincronizarse entre sí.
    const productosClasificados = productosConNumeros.map((f) => {
      if (f.unidades_vendidas_90d === 0) {
        return { ...f, dias_cobertura: null, clasificacion: 'sobrestock' };
      }
      const diasCobertura = f.existencia_actual / (f.unidades_vendidas_90d / 90);
      let clasificacion;
      if (diasCobertura < 7) clasificacion = 'riesgo';
      else if (diasCobertura <= 60) clasificacion = 'saludable';
      else clasificacion = 'sobrestock';
      return { ...f, dias_cobertura: Math.round(diasCobertura * 10) / 10, clasificacion };
    });
    let riesgo = 0;
    let saludable = 0;
    let sobrestock = 0;
    productosClasificados.forEach((f) => {
      if (f.clasificacion === 'riesgo') riesgo += 1;
      else if (f.clasificacion === 'saludable') saludable += 1;
      else sobrestock += 1;
    });
    const totalProductos = productosConNumeros.length;
    const pct = (n) => (totalProductos > 0 ? Math.round((n / totalProductos) * 1000) / 10 : 0);

    // "Solamente servicios" (propuesta aprobada, ver PROJECT_STATE.md
    // punto 182): un servicio nunca genera movimientos_inventario (D11),
    // así que "más/menos vendido" sale de orden_productos (líneas de
    // Ventas) en vez de movimientos — única fuente real disponible.
    // cantidad es un dato exacto; el ingreso es una APROXIMACIÓN con el
    // precio ACTUAL del servicio (orden_productos no guarda el precio de
    // esa venta en particular), documentado también en el frontend.
    const [filasServicios] = await pool.query(
      `SELECT p.id, p.nombre, p.precio,
              COALESCE(SUM(op.cantidad), 0) AS cantidad_vendida_90d
         FROM productos p
         LEFT JOIN orden_productos op ON op.producto_id = p.id
           AND op.creado_en >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        WHERE p.eliminado_en IS NULL AND p.estado = 'activo' AND p.tipo = 'servicio'
        GROUP BY p.id, p.nombre, p.precio`
    );
    const serviciosConNumeros = filasServicios.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      cantidad_vendida_90d: Number(f.cantidad_vendida_90d),
      ingreso_estimado_90d: Math.round(Number(f.cantidad_vendida_90d) * Number(f.precio || 0) * 100) / 100,
    }));
    const serviciosOrdenados = [...serviciosConNumeros].sort((a, b) => b.cantidad_vendida_90d - a.cantidad_vendida_90d);
    const serviciosSinVentas90d = serviciosConNumeros.filter((f) => f.cantidad_vendida_90d === 0).length;

    res.json({
      kpis: {
        valor_total_existencia: Math.round(Number(valorInventario.valor) * 100) / 100,
        rotacion_promedio_catalogo: Math.round(rotacionPromedioCatalogo * 100) / 100,
        productos_sin_movimiento_90d: filasSinMovimiento90d.length,
        unidades_totales: totalExistencia,
        costo_promedio_ponderado:
          totalExistencia > 0 ? Math.round((Number(valorInventario.valor) / totalExistencia) * 100) / 100 : 0,
        monto_inmovilizado: montoInmovilizado,
        // Honesto en vez del "Health Score" de marketing del mockup: % de
        // SKUs con alguna venta real en 90 días (saludable+riesgo) — es
        // el inverso exacto de cobertura.sobrestock.porcentaje.
        salud_catalogo_pct: totalProductos > 0 ? Math.round(((saludable + riesgo) / totalProductos) * 1000) / 10 : 0,
      },
      alerta_inmovilizado:
        productoMasInmovilizado && productoMasInmovilizado.monto > 0
          ? { producto_id: productoMasInmovilizado.id, nombre: productoMasInmovilizado.nombre, monto: productoMasInmovilizado.monto }
          : null,
      top_ventas_90d: topVentas.map((f) => ({ producto_id: f.id, nombre: f.nombre, unidades_vendidas_90d: f.unidades_vendidas_90d })),
      bottom_ventas_90d: bottomVentas.map((f) => ({ producto_id: f.id, nombre: f.nombre, unidades_vendidas_90d: f.unidades_vendidas_90d })),
      rotacion: rotacionTop8.map((f) => ({
        producto_id: f.id,
        nombre: f.nombre,
        rotacion: Math.round(f.rotacion * 100) / 100,
        unidades_vendidas_90d: f.unidades_vendidas_90d,
        existencia_actual: f.existencia_actual,
      })),
      valor_por_categoria: filasCategoria.map((c) => ({
        categoria_id: c.categoria_id,
        categoria_nombre: c.categoria_nombre,
        valor: Math.round(Number(c.valor) * 100) / 100,
      })),
      cobertura: {
        riesgo: { productos: riesgo, porcentaje: pct(riesgo) },
        saludable: { productos: saludable, porcentaje: pct(saludable) },
        sobrestock: { productos: sobrestock, porcentaje: pct(sobrestock) },
        total_productos: totalProductos,
      },
      // Punto 271: catálogo completo valorizado — alimenta la tabla
      // "Matriz de riesgo" (primeras N filas) Y el export CSV de esta
      // pestaña, ambos leyendo del mismo arreglo para no desincronizarse.
      valuacion_detalle: [...productosClasificados]
        .sort((a, b) => b.valor - a.valor)
        .map((f) => ({
          producto_id: f.id,
          nombre: f.nombre,
          sku: f.sku,
          categoria_nombre: f.categoria_nombre,
          existencia_actual: f.existencia_actual,
          costo_promedio: f.costo_promedio,
          valor: f.valor,
          unidades_vendidas_90d: f.unidades_vendidas_90d,
          dias_cobertura: f.dias_cobertura,
          clasificacion: f.clasificacion,
        })),
      servicios: {
        kpis: {
          total_servicios: serviciosConNumeros.length,
          servicios_sin_ventas_90d: serviciosSinVentas90d,
        },
        top_ventas_90d: serviciosOrdenados.slice(0, 5).map((f) => ({
          servicio_id: f.id, nombre: f.nombre, cantidad_vendida_90d: f.cantidad_vendida_90d, ingreso_estimado_90d: f.ingreso_estimado_90d,
        })),
        bottom_ventas_90d: [...serviciosOrdenados].reverse().slice(0, 5).map((f) => ({
          servicio_id: f.id, nombre: f.nombre, cantidad_vendida_90d: f.cantidad_vendida_90d, ingreso_estimado_90d: f.ingreso_estimado_90d,
        })),
      },
    });
  })
);

// ---------- Importador masivo — plantilla y perfiles de mapeo (§34.3.2/34.3.4) ----------

app.get(
  '/api/admin/inventarios/importaciones/plantilla.csv',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res) => {
    res.json({ perfiles: await listarPerfilesMapeo() });
  })
);

app.delete(
  '/api/admin/inventarios/perfiles-mapeo/:id',
  adminApiLimiter,
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
  requireInventarioActivo,
  asyncHandler(async (req, res, next) => {
    // "Solamente servicios": la carga masiva es exclusivamente para
    // productos (ya rechazaba filas tipo=servicio, punto 179) — con el
    // switch encendido no hay NADA que importar, así que se cierra el
    // flujo completo desde el primer paso, antes de subir el archivo.
    if (await soloServiciosActivo()) {
      return res.status(400).json({
        error: 'INV_SOLO_SERVICIOS_ACTIVO',
        mensaje: 'La carga masiva es solo para productos — con "Solamente servicios" activo no hay nada que importar.',
      });
    }
    next();
  }),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
  requiereFeature('inventariosHabilitado'),
  requireAdminAuth,
  requireAdminArea('administrador', 'inventario'),
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
// Corre la limpieza de tickets vencidos (borrado automático según la
// retención configurada por el administrador de CADA base — base ADDV y
// todos los tenants activos, auditoría 2026-09-03 hallazgo #8: antes solo
// corría contra el pool por defecto, los tickets de tenants reales nunca
// se purgaban). No hace nada donde no haya retención configurada. Antes de
// borrar nada en cada base, ya se generó y (si hay correo configurado)
// envió un reporte combinado con todo lo que está a punto de eliminarse —
// ver utils/ticketsCleanup.js. Los errores por base no detienen a las
// demás ni tumban el proceso — es una tarea de mantenimiento, no crítica
// para servir tráfico.
async function ejecutarLimpiezaAutomatica() {
  try {
    const resultados = await ejecutarLimpiezaParaTodos();
    resultados.forEach((r) => {
      const etiqueta = r.slug || 'base';
      if (r.error) {
        console.error(`Error en la limpieza automática (tickets) — ${etiqueta}:`, r.error);
        return;
      }
      if (r.retencionActiva && r.eliminadosTickets > 0) {
        console.log(
          `Limpieza automática (${etiqueta}): ${r.eliminadosTickets} ticket(s) vencidos eliminados.` +
            (r.reporteId ? ` Reporte #${r.reporteId} generado${r.correoEnviado ? ' y enviado por correo' : ''}.` : '')
        );
        if (r.errorCorreo) {
          console.error(`El reporte #${r.reporteId} (${etiqueta}) se generó, pero no se pudo enviar por correo:`, r.errorCorreo);
        }
      }
    });
  } catch (err) {
    console.error('Error en la limpieza automática (tickets):', err);
  }
}

// Punto 158 — Cierre mensual archivado (Ventas + Gastos, día 1 en la zona
// horaria de cada DB — ver `configuracion_global.zona_horaria`).
async function ejecutarCierreMensualAutomatico() {
  const ahora = new Date();
  // Pre-filtro amplio en UTC: solo ahorra consultas a N tenants el resto
  // del mes. Las zonas horarias válidas (`ZONAS_HORARIAS_MEXICO`, ver
  // utils/config.js) van de UTC-6 a UTC-8, así que el día 1 local cae
  // siempre dentro de UTC 1 o UTC 2 — nunca se restringe más que eso.
  // La decisión real y precisa de "es día 1 en SU zona" la toma cada DB
  // por separado dentro de `ejecutarCierreMensualParaDB()`.
  const diaUtc = ahora.getUTCDate();
  if (diaUtc !== 1 && diaUtc !== 2) return;
  try {
    const resultados = await ejecutarCierresMensualesParaTodos();
    const archivadas = resultados.filter((r) => (r.archivadasVentas || 0) > 0 || (r.archivadosGastos || 0) > 0);
    if (archivadas.length > 0) {
      console.log(`[cierreMensual] Cierre ${archivadas[0].periodo}: ${JSON.stringify(archivadas.map((r) => ({ slug: r.slug || 'base', periodo: r.periodo, ventas: r.archivadasVentas, gastos: r.archivadosGastos })))}`);
    }
  } catch (err) {
    console.error('[cierreMensual] Error en cierre mensual automático:', err);
  }
}

async function iniciar() {
  await ensureSchema();
  await storage.asegurarBucket();
  await asegurarTablaAuditoria();
  await sembrarCatalogoClaveProdServSiVacio();

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
  // Cierre mensual: se chequea cada hora pero solo actúa día 1 02:00 zona.
  ejecutarCierreMensualAutomatico();
  // Se repite cada hora; con la retención medida en días, no hace falta
  // una frecuencia mayor, y así se evita sobrecargar la base de datos.
  const intervaloLimpieza = setInterval(ejecutarLimpiezaAutomatica, 60 * 60 * 1000);
  const intervaloCierreMensual = setInterval(ejecutarCierreMensualAutomatico, 60 * 60 * 1000);

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
    clearInterval(intervaloCierreMensual);

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
