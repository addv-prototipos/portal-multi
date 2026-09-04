// Imagen principal de producto (punto 159, Segmento B — recorte de
// inventarios.md D10/US-INV-002: solo 1 imagen por producto en v1, sin
// galería ni el gate control+tenant de la spec completa — no hay
// tenants reales en producción todavía, se agrega cuando el costo de
// almacenamiento importe de verdad). El pipeline sí conserva las 2
// protecciones de seguridad que SÍ son necesarias siempre (hallazgo de
// la auditoría 2026-08-24, ver inventarios.md): límite de dimensión
// antes de decodificar y timeout duro por imagen.
const sharp = require('sharp');
const storage = require('./storage');
const { detectRealImageMimeType } = require('./validate');

const DIMENSION_MAXIMA_PX = 8000;
const TIMEOUT_PROCESO_MS = 10000;
const LADO_PRINCIPAL_PX = 1200;
const LADO_THUMB_PX = 300;
const CALIDAD_WEBP = 80;

class ErrorImagenProducto extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

function conTimeout(promesa, ms) {
  let temporizador;
  const timeout = new Promise((_, reject) => {
    temporizador = setTimeout(() => reject(new ErrorImagenProducto('INV_IMAGEN_PROCESO_FALLIDO', 'El procesamiento de la imagen tardó demasiado.')), ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(temporizador));
}

/**
 * Valida y procesa el buffer subido: firma binaria real (no solo
 * Content-Type), límite de dimensión ANTES de decodificar pixel a pixel
 * (defensa contra "bombas de descompresión"), redimensiona a 1200px +
 * miniatura 300×300, ambas WebP q80. Nunca conserva el original.
 */
async function procesarImagenProducto(buffer) {
  const mimeReal = detectRealImageMimeType(buffer);
  if (!mimeReal) {
    throw new ErrorImagenProducto('INV_IMAGEN_TIPO_INVALIDO', 'El archivo no es una imagen válida (JPG, PNG o WEBP).');
  }

  return conTimeout(
    (async () => {
      let metadata;
      try {
        metadata = await sharp(buffer, { limitInputPixels: DIMENSION_MAXIMA_PX * DIMENSION_MAXIMA_PX }).metadata();
      } catch (err) {
        throw new ErrorImagenProducto('INV_IMAGEN_PROCESO_FALLIDO', 'No se pudo leer la imagen.');
      }
      if (!metadata.width || !metadata.height) {
        throw new ErrorImagenProducto('INV_IMAGEN_PROCESO_FALLIDO', 'No se pudo leer la imagen.');
      }
      if (metadata.width > DIMENSION_MAXIMA_PX || metadata.height > DIMENSION_MAXIMA_PX) {
        throw new ErrorImagenProducto('INV_IMAGEN_DIMENSION_INVALIDA', `La imagen excede ${DIMENSION_MAXIMA_PX}×${DIMENSION_MAXIMA_PX} px.`);
      }

      try {
        const [principalBuffer, thumbBuffer] = await Promise.all([
          sharp(buffer, { limitInputPixels: DIMENSION_MAXIMA_PX * DIMENSION_MAXIMA_PX })
            .resize(LADO_PRINCIPAL_PX, LADO_PRINCIPAL_PX, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: CALIDAD_WEBP })
            .toBuffer(),
          sharp(buffer, { limitInputPixels: DIMENSION_MAXIMA_PX * DIMENSION_MAXIMA_PX })
            .resize(LADO_THUMB_PX, LADO_THUMB_PX, { fit: 'cover' })
            .webp({ quality: CALIDAD_WEBP })
            .toBuffer(),
        ]);
        return { principalBuffer, thumbBuffer, ancho: metadata.width, alto: metadata.height };
      } catch (err) {
        if (err instanceof ErrorImagenProducto) throw err;
        throw new ErrorImagenProducto('INV_IMAGEN_PROCESO_FALLIDO', 'No se pudo procesar la imagen.');
      }
    })(),
    TIMEOUT_PROCESO_MS
  );
}

function carpetaProducto(productoId) {
  return `productos/${productoId}`;
}

/** Procesa y guarda ambas variantes en MinIO. Devuelve las keys + metadata. */
async function guardarImagenProducto(prefijo, productoId, buffer) {
  const { principalBuffer, thumbBuffer, ancho, alto } = await procesarImagenProducto(buffer);
  const carpeta = carpetaProducto(productoId);
  const imagenKey = await storage.guardarArchivo(prefijo, carpeta, 'principal.webp', principalBuffer, 'image/webp');
  const thumbKey = await storage.guardarArchivo(prefijo, carpeta, 'thumb_principal.webp', thumbBuffer, 'image/webp');
  return { imagenKey, thumbKey, ancho, alto, pesoBytes: principalBuffer.length };
}

/** Borra ambas variantes de MinIO — idempotente (ver storage.eliminarArchivo). */
async function eliminarImagenProducto(prefijo, productoId) {
  const carpeta = carpetaProducto(productoId);
  await Promise.all([
    storage.eliminarArchivo(prefijo, carpeta, 'principal.webp'),
    storage.eliminarArchivo(prefijo, carpeta, 'thumb_principal.webp'),
  ]);
}

module.exports = {
  ErrorImagenProducto,
  procesarImagenProducto,
  guardarImagenProducto,
  eliminarImagenProducto,
  DIMENSION_MAXIMA_PX,
};
