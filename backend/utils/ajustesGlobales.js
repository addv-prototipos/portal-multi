// Ajustes globales de la plataforma (Punto 370) — lectura desde el backend
// de la tabla clave/valor `ajustes_globales` en `control_tenants` (la crea
// y escribe `control/`, ver control/utils/ajustesGlobales.js). El backend
// solo LEE, vía el mismo pool que tenantContext.js ya usa para resolver
// tenants (obtenerPoolControl()) — cero llamada HTTP nueva entre
// servicios, cero dependencia nueva de que `control` esté vivo.
//
// Primer uso: `imagen_max_mb` — reemplaza MAX_FILE_SIZE_MB/MAX_MARCA_LOGO_MB
// (env, desincronizadas) para los 5 puntos de subida de IMAGEN (producto,
// foto de ticket, logo de ticket, marca, favicon). MAX_FILE_SIZE_MB sigue
// viva para subidas NO imagen (CSF PDF, comprobante, factura ZIP, CSV/XLSX)
// — fuera de alcance de este módulo.
const { obtenerPoolControl } = require('../db');

const CLAVE_IMAGEN_MAX_MB = 'imagen_max_mb';
const IMAGEN_MAX_MB_DEFAULT = 2;
const IMAGEN_MAX_MB_MIN = 1;
const IMAGEN_MAX_MB_MAX = 20;
const CACHE_TTL_MS = Number(process.env.AJUSTES_GLOBALES_CACHE_TTL_MS || 45 * 1000);

let cache = null; // { valor: number, resueltoEn: number }

async function obtenerImagenMaxMbCacheado() {
  if (cache && Date.now() - cache.resueltoEn < CACHE_TTL_MS) {
    return cache.valor;
  }
  let valor = IMAGEN_MAX_MB_DEFAULT;
  try {
    const [filas] = await obtenerPoolControl().query(
      'SELECT valor FROM ajustes_globales WHERE clave = ?',
      [CLAVE_IMAGEN_MAX_MB]
    );
    if (filas.length > 0) {
      const guardado = Number(filas[0].valor);
      if (Number.isInteger(guardado) && guardado >= IMAGEN_MAX_MB_MIN && guardado <= IMAGEN_MAX_MB_MAX) {
        valor = guardado;
      }
    }
  } catch (err) {
    // control_tenants inalcanzable: seguir con el default en vez de romper
    // la subida de imagen por una dependencia que no es crítica para ella.
    valor = cache ? cache.valor : IMAGEN_MAX_MB_DEFAULT;
  }
  cache = { valor, resueltoEn: Date.now() };
  return valor;
}

module.exports = { obtenerImagenMaxMbCacheado, IMAGEN_MAX_MB_DEFAULT, IMAGEN_MAX_MB_MAX };
