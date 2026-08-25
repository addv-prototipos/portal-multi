const validator = require('validator');

// Solo se aceptan PDF para la constancia fiscal: la Constancia de Situación
// Fiscal / Cédula de Identificación Fiscal del SAT siempre se emite en este
// formato, y restringir a PDF permite validar el contenido (ver
// utils/pdfExtract.js).
// Nota de retrocompatibilidad: archivos JPG/PNG subidos antes de esta
// restricción siguen almacenados y son visibles/descargables desde el
// panel de administración; esta regla solo aplica a cargas nuevas.
const ALLOWED_MIME_TYPES = new Set(['application/pdf']);
const ALLOWED_EXTENSIONS = new Set(['.pdf']);

// Para los tickets/comprobantes de compra sí se acepta imagen (es una foto
// del ticket, no un documento oficial del SAT).
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// La factura que sube el administrador para un ticket va comprimida en un
// solo ZIP (contiene el PDF y el XML del CFDI juntos — un <input type="file">
// no permite adjuntar dos archivos por separado). Se es permisivo con el
// MIME reportado por el navegador (varía entre sistemas operativos y
// navegadores para archivos .zip: "application/zip",
// "application/x-zip-compressed", o incluso el genérico
// "application/octet-stream" en algunos casos) porque el filtro real de
// seguridad es la firma binaria (ver esZipValido), no este valor, que el
// cliente puede declarar libremente.
const ALLOWED_ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/octet-stream',
]);
const ALLOWED_ZIP_EXTENSIONS = new Set(['.zip']);

// Comprobante de un gasto (módulo "Gastos"): acepta un PDF (la factura
// sola) o un ZIP (el par PDF + XML de un CFDI, mismo formato que el
// comprobante de tickets). El MIME reportado por el navegador para .zip
// varía entre sistemas (ver ALLOWED_ZIP_MIME_TYPES arriba) — el filtro
// real de seguridad es la firma binaria (PDF %PDF o ZIP PK), no estos
// valores declarados.
const ALLOWED_COMPROBANTE_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/octet-stream',
]);
const ALLOWED_COMPROBANTE_EXTENSIONS = new Set(['.pdf', '.zip']);

// Firma binaria (magic number) real de un PDF, para evitar que un archivo
// malicioso se disfrace con una extension/MIME falsos.
const MAGIC_SIGNATURES = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

const IMAGE_MAGIC_SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

// Un ZIP puede empezar con cualquiera de estas tres firmas: "PK\x03\x04"
// (archivo local, el caso normal de un ZIP con contenido), "PK\x05\x06"
// (archivo vacío) o "PK\x07\x08" (archivo dividido en varias partes/
// spanned). Se aceptan las tres para no rechazar un ZIP real y válido por
// una variante poco común del formato.
const ZIP_MAGIC_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
];

function esZipValido(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return ZIP_MAGIC_SIGNATURES.some((firma) => firma.every((byte, idx) => buffer[idx] === byte));
}

// ---------- Lectura del directorio central del ZIP (sin descomprimir) ----------
// No se agregó ninguna librería nueva de ZIP solo para esto — el formato
// del directorio central es sencillo de leer directamente con Buffer,
// igual que ya se hace con las firmas binarias de PDF/imagen más arriba.
// Esto NO descomprime ni valida el contenido de cada archivo dentro del
// ZIP, solo lista sus nombres — suficiente para confirmar que la factura
// trae un PDF y un XML adentro, sin necesitar procesar cada uno.

const FIRMA_EOCD = Buffer.from([0x50, 0x4b, 0x05, 0x06]); // "PK\x05\x06"
const FIRMA_CENTRAL = Buffer.from([0x50, 0x4b, 0x01, 0x02]); // "PK\x01\x02"

// El "End Of Central Directory" (EOCD) no está en un offset fijo desde el
// final del archivo, porque puede traer un comentario de longitud
// variable (hasta 65535 bytes) después de sus 22 bytes fijos — así que se
// busca su firma escaneando hacia atrás desde el final.
function encontrarEOCD(buffer) {
  const TAMANO_FIJO_EOCD = 22;
  const COMENTARIO_MAXIMO = 65535;
  const inicioBusqueda = Math.max(0, buffer.length - TAMANO_FIJO_EOCD - COMENTARIO_MAXIMO);
  for (let i = buffer.length - TAMANO_FIJO_EOCD; i >= inicioBusqueda; i--) {
    if (buffer.slice(i, i + 4).equals(FIRMA_EOCD)) {
      return i;
    }
  }
  return -1;
}

/**
 * Lista los nombres de archivo dentro de un ZIP, leyendo su directorio
 * central. Si el ZIP está corrupto, truncado, o no se pudo interpretar,
 * devuelve un arreglo vacío (nunca lanza error) — el llamador lo trata
 * igual que "no se encontró nada adentro".
 */
function listarArchivosEnZip(buffer) {
  try {
    const offsetEOCD = encontrarEOCD(buffer);
    if (offsetEOCD === -1) return [];

    const totalEntradas = buffer.readUInt16LE(offsetEOCD + 10);
    let offsetCD = buffer.readUInt32LE(offsetEOCD + 16);

    const nombres = [];
    for (let i = 0; i < totalEntradas; i++) {
      if (offsetCD + 46 > buffer.length) break;
      if (!buffer.slice(offsetCD, offsetCD + 4).equals(FIRMA_CENTRAL)) break;

      const longitudNombre = buffer.readUInt16LE(offsetCD + 28);
      const longitudExtra = buffer.readUInt16LE(offsetCD + 30);
      const longitudComentario = buffer.readUInt16LE(offsetCD + 32);

      const inicioNombre = offsetCD + 46;
      const finNombre = inicioNombre + longitudNombre;
      if (finNombre > buffer.length) break;

      nombres.push(buffer.slice(inicioNombre, finNombre).toString('utf8'));
      offsetCD = finNombre + longitudExtra + longitudComentario;
    }
    return nombres;
  } catch (e) {
    return [];
  }
}

/**
 * Confirma que un ZIP (ya validado con esZipValido) traiga adentro al
 * menos un archivo ".pdf" y al menos un archivo ".xml" — un CFDI real
 * siempre se entrega como ese par de archivos. Devuelve qué faltó, para
 * poder dar un mensaje de error específico en vez de uno genérico.
 */
function zipContienePdfYXml(buffer) {
  const nombres = listarArchivosEnZip(buffer);
  const tienePdf = nombres.some((nombre) => nombre.toLowerCase().endsWith('.pdf'));
  const tieneXml = nombres.some((nombre) => nombre.toLowerCase().endsWith('.xml'));
  return { tienePdf, tieneXml, valido: tienePdf && tieneXml };
}

function detectRealMimeType(buffer) {
  for (const sig of MAGIC_SIGNATURES) {
    if (buffer.length >= sig.bytes.length) {
      const matches = sig.bytes.every((byte, idx) => buffer[idx] === byte);
      if (matches) return sig.mime;
    }
  }
  return null;
}

// WEBP no tiene una firma de bytes contiguos simple: son los primeros 4
// bytes "RIFF", seguidos del tamaño (4 bytes que varían), y luego "WEBP".
function esWebpValido(buffer) {
  if (buffer.length < 12) return false;
  const inicio = buffer.slice(0, 4).toString('ascii');
  const tipo = buffer.slice(8, 12).toString('ascii');
  return inicio === 'RIFF' && tipo === 'WEBP';
}

function detectRealImageMimeType(buffer) {
  for (const sig of IMAGE_MAGIC_SIGNATURES) {
    if (buffer.length >= sig.bytes.length) {
      const matches = sig.bytes.every((byte, idx) => buffer[idx] === byte);
      if (matches) return sig.mime;
    }
  }
  if (esWebpValido(buffer)) return 'image/webp';
  return null;
}

function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().slice(0, maxLength);
  // Elimina cualquier etiqueta HTML/script y caracteres de control
  const noTags = trimmed.replace(/<[^>]*>/g, '');
  // eslint-disable-next-line no-control-regex
  const noControl = noTags.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  // Se guarda CRUDO (sin validator.escape()) a propósito: el escape para
  // HTML lo hace escapeHtml() del lado del frontend al pintarlo, igual
  // que con cualquier otro campo de texto (RFC, nombre, folio...) — pre-
  // escaparlo aquí también producía un doble escape visible en pantalla
  // (ej. "/" guardado como "&#x2F;", que al re-escaparse se veía como
  // "&amp;#x2F;" y el navegador solo decodificaba un nivel).
  return noControl;
}

// Para texto que va DENTRO de un correo enviado (asunto/cuerpo), no dentro
// de nuestras propias páginas HTML: aquí NO se debe usar validator.escape(),
// porque convertiría "&" en "&amp;" y el destinatario vería ese texto
// escapado literal en su bandeja de entrada. Solo se recortan longitud y
// caracteres de control (para evitar inyección de cabeceras SMTP via
// saltos de línea maliciosos en el asunto, por ejemplo).
function sanitizeTextoLibre(input, maxLength = 2000) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().slice(0, maxLength);
  // eslint-disable-next-line no-control-regex
  return trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function isValidEmail(email) {
  return typeof email === 'string' && validator.isEmail(email);
}

// Validacion laxa de RFC mexicano (12-13 caracteres alfanumericos)
function isValidRFC(rfc) {
  if (!rfc) return true; // opcional (constancia fiscal)
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim());
}

// A diferencia de isValidRFC (usada en la constancia, donde el RFC es
// opcional), en el login/registro de usuario el RFC ES el nombre de
// usuario: aquí es obligatorio y debe tener formato válido.
function isValidRFCRequerido(rfc) {
  return typeof rfc === 'string' && rfc.trim().length > 0 && isValidRFC(rfc.trim());
}

// Telefono mexicano: 10 digitos, se permite capturarlo con espacios o
// guiones y se limpia antes de validar.
function isValidTelefono(telefono) {
  if (typeof telefono !== 'string') return false;
  const limpio = telefono.replace(/[\s\-()]/g, '');
  return /^\d{10}$/.test(limpio);
}

function isValidTipoPersona(tipo) {
  return tipo === 'fisica' || tipo === 'moral';
}

// Importador masivo de Inventarios (inventarios.md §34): CSV o XLSX. El MIME
// que reporta el navegador para .csv varía mucho entre sistemas (a veces
// "text/plain", a veces "application/vnd.ms-excel" en Windows/Excel) — el
// filtro real de seguridad es la firma binaria (ver esCSVValido/esZipValido
// en utils/inventarioImportacion.js y server.js), no este valor declarado.
const ALLOWED_IMPORTACION_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);
const ALLOWED_IMPORTACION_EXTENSIONS = new Set(['.csv', '.xlsx']);

// Firma binaria de un CSV (§34.9): "nunca confiar en la extensión". Un CSV
// real es texto — la señal fiable de que en realidad es otra cosa (binario
// disfrazado) es la presencia de bytes NUL, que jamás aparecen en texto
// UTF-8/Latin-1 genuino.
function esCSVValido(buffer) {
  if (!buffer || buffer.length === 0) return false;
  return !buffer.includes(0x00);
}

module.exports = {
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
};
