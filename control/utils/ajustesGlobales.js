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

module.exports = {
  CLAVE_IMAGEN_MAX_MB,
  IMAGEN_MAX_MB_DEFAULT,
  IMAGEN_MAX_MB_MIN,
  IMAGEN_MAX_MB_MAX,
  getImagenMaxMb,
  setImagenMaxMb,
};
