// Ajustes globales de la plataforma (Punto 370) — tabla clave/valor
// `ajustes_globales` (ver control/scripts/ensureSchema.js), mismo patrón
// que backend/utils/config.js pero a nivel plataforma, no por tenant.
//
// Primer uso: `imagen_max_mb` — reemplaza las 2 variables de entorno que
// antes gobernaban el tamaño máximo de imagen (MAX_FILE_SIZE_MB para
// producto/foto de ticket/logo de ticket en backend, MAX_MARCA_LOGO_MB
// para marca/favicon en backend Y control, declarada independientemente
// en cada uno) — ahora es un solo valor, configurable desde /control,
// que ambos servicios leen de la misma tabla.

const { obtenerPool } = require('../db');

const CLAVE_IMAGEN_MAX_MB = 'imagen_max_mb';
const IMAGEN_MAX_MB_DEFAULT = 2;
const IMAGEN_MAX_MB_MIN = 1;
const IMAGEN_MAX_MB_MAX = 20;

// Segundo uso: `import_max_filas` — límite de filas del importador masivo
// de Inventarios (CSV/XLSX/XLS). Antes vivía como `inv_import_max_filas`
// per-tenant en backend/utils/inventarioConfig.js sin ninguna UI que lo
// expusiera — se mueve aquí para que sea un solo valor de plataforma,
// configurable desde /control, mismo criterio que imagen_max_mb.
const CLAVE_IMPORT_MAX_FILAS = 'import_max_filas';
const IMPORT_MAX_FILAS_DEFAULT = 10000;
const IMPORT_MAX_FILAS_MIN = 100;
const IMPORT_MAX_FILAS_MAX = 100000;

async function getImagenMaxMb() {
  const [filas] = await obtenerPool().query(
    'SELECT valor FROM ajustes_globales WHERE clave = ?',
    [CLAVE_IMAGEN_MAX_MB]
  );
  if (filas.length === 0) return IMAGEN_MAX_MB_DEFAULT;
  const valor = Number(filas[0].valor);
  return Number.isInteger(valor) && valor >= IMAGEN_MAX_MB_MIN && valor <= IMAGEN_MAX_MB_MAX
    ? valor
    : IMAGEN_MAX_MB_DEFAULT;
}

async function setImagenMaxMb(valor) {
  const num = Number(valor);
  if (!Number.isInteger(num) || num < IMAGEN_MAX_MB_MIN || num > IMAGEN_MAX_MB_MAX) {
    throw new Error(`El máximo de imagen debe ser un número entero entre ${IMAGEN_MAX_MB_MIN} y ${IMAGEN_MAX_MB_MAX} MB.`);
  }
  await obtenerPool().query(
    `INSERT INTO ajustes_globales (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_IMAGEN_MAX_MB, String(num)]
  );
  return num;
}

async function getImportMaxFilas() {
  const [filas] = await obtenerPool().query(
    'SELECT valor FROM ajustes_globales WHERE clave = ?',
    [CLAVE_IMPORT_MAX_FILAS]
  );
  if (filas.length === 0) return IMPORT_MAX_FILAS_DEFAULT;
  const valor = Number(filas[0].valor);
  return Number.isInteger(valor) && valor >= IMPORT_MAX_FILAS_MIN && valor <= IMPORT_MAX_FILAS_MAX
    ? valor
    : IMPORT_MAX_FILAS_DEFAULT;
}

async function setImportMaxFilas(valor) {
  const num = Number(valor);
  if (!Number.isInteger(num) || num < IMPORT_MAX_FILAS_MIN || num > IMPORT_MAX_FILAS_MAX) {
    throw new Error(`El límite de filas debe ser un número entero entre ${IMPORT_MAX_FILAS_MIN} y ${IMPORT_MAX_FILAS_MAX}.`);
  }
  await obtenerPool().query(
    `INSERT INTO ajustes_globales (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_IMPORT_MAX_FILAS, String(num)]
  );
  return num;
}

module.exports = {
  CLAVE_IMAGEN_MAX_MB,
  IMAGEN_MAX_MB_DEFAULT,
  IMAGEN_MAX_MB_MIN,
  IMAGEN_MAX_MB_MAX,
  getImagenMaxMb,
  setImagenMaxMb,
  CLAVE_IMPORT_MAX_FILAS,
  IMPORT_MAX_FILAS_DEFAULT,
  IMPORT_MAX_FILAS_MIN,
  IMPORT_MAX_FILAS_MAX,
  getImportMaxFilas,
  setImportMaxFilas,
};
