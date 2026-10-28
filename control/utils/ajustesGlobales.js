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

// Tercer uso: capacidad de disco de infraestructura (punto en curso) —
// cuánto disco físico real del servidor se puede repartir entre las
// cuotas (disco_cuota_mb) de todos los tenants, y a dónde avisar cuando
// lo comprometido (suma de cuotas) llegue al umbral.
//
// disco_capacidad_total_mb YA NO es un valor que el operador escriba a
// mano (decisión del usuario, 2026-10-27, tras encontrar que el admin
// API de Garage expone el tamaño real de la partición donde vive el
// bucket) — getDiscoCapacidadTotalMb/setDiscoCapacidadTotalMb siguen
// existiendo, pero ahora son el CACHÉ de la última lectura real de
// Garage (ver control/utils/garageCapacidad.js y discoCapacidad.js,
// que escribe aquí en cada cálculo exitoso y lee de aquí solo si Garage
// no respondió). NULL = "nunca se logró leer Garage todavía", nunca un
// número inventado.
const CLAVE_DISCO_CAPACIDAD_TOTAL_MB = 'disco_capacidad_total_mb';
// Tope máximo de disco POR TENANT, indistinto de lo que diga su plan
// (punto en curso, 2026-10-27) — evita que una sola empresa se quede con
// todo el disco disponible. Se valida contra esto en
// tenantEdicion.js:resolverPlanYFunciones() (asignar plan O editar la
// excepción a mano, mismo punto de control para los 2 caminos) y en
// tenantUpscaleCompra.js (comprar un upscale que lo superaría se
// rechaza). NULL = sin tope — mismo criterio "nunca inventar un
// default" que el resto de este archivo.
const CLAVE_DISCO_TOPE_TENANT_MB = 'disco_tope_tenant_mb';
const CLAVE_DISCO_ALERTA_EMAIL = 'disco_alerta_email';
// Histeresis para no reenviar el correo en cada recálculo mientras se
// sigue por encima del umbral: 'alertado' se escribe al cruzar hacia
// arriba, y solo vuelve a 'ok' si el % comprometido baja de
// DISCO_ALERTA_HISTERESIS_PCT (no del umbral mismo, para no mandar
// correos de "ya pasó" y "ya volvió" en cada punto porcentual).
const CLAVE_DISCO_ALERTA_ESTADO = 'disco_alerta_estado';
const CLAVE_DISCO_ALERTA_ENVIADA_EN = 'disco_alerta_enviada_en';
const DISCO_ALERTA_UMBRAL_PCT = 80;
const DISCO_ALERTA_HISTERESIS_PCT = 70;

// `control_app` no tiene privilegio DELETE (mismo criterio documentado
// en CLAUDE.md para cualquier tabla de este proyecto: soft-delete, nunca
// DELETE físico) — "sin valor" se representa como cadena vacía en vez de
// borrar la fila, nunca un DELETE. Confirmado real: un DELETE aquí
// truena con "DELETE command denied to user 'control_app'".
async function getValorTexto(clave) {
  const [filas] = await obtenerPool().query(
    'SELECT valor FROM ajustes_globales WHERE clave = ?',
    [clave]
  );
  if (filas.length === 0 || filas[0].valor === '') return null;
  return filas[0].valor;
}

async function setValorTexto(clave, valor) {
  await obtenerPool().query(
    `INSERT INTO ajustes_globales (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [clave, valor === null ? '' : valor]
  );
}

async function getDiscoCapacidadTotalMb() {
  const valor = await getValorTexto(CLAVE_DISCO_CAPACIDAD_TOTAL_MB);
  if (valor === null) return null;
  const num = Number(valor);
  return Number.isInteger(num) && num > 0 ? num : null;
}

async function setDiscoCapacidadTotalMb(valor) {
  const num = Number(valor);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('La capacidad total de disco debe ser un número entero mayor a 0 (en MB).');
  }
  await setValorTexto(CLAVE_DISCO_CAPACIDAD_TOTAL_MB, String(num));
  return num;
}

async function getDiscoTopeTenantMb() {
  const valor = await getValorTexto(CLAVE_DISCO_TOPE_TENANT_MB);
  if (valor === null) return null;
  const num = Number(valor);
  return Number.isInteger(num) && num > 0 ? num : null;
}

async function setDiscoTopeTenantMb(valor) {
  if (valor === null || valor === undefined || valor === '') {
    await setValorTexto(CLAVE_DISCO_TOPE_TENANT_MB, null);
    return null;
  }
  const num = Number(valor);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('El tope de disco por empresa debe ser un número entero mayor a 0 (en MB), o vacío para no limitar.');
  }
  await setValorTexto(CLAVE_DISCO_TOPE_TENANT_MB, String(num));
  return num;
}

async function getDiscoAlertaEmail() {
  return getValorTexto(CLAVE_DISCO_ALERTA_EMAIL);
}

async function setDiscoAlertaEmail(valor) {
  const correo = typeof valor === 'string' ? valor.trim() : '';
  if (!correo) {
    await setValorTexto(CLAVE_DISCO_ALERTA_EMAIL, null);
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error('El correo de alerta no tiene un formato válido.');
  }
  await setValorTexto(CLAVE_DISCO_ALERTA_EMAIL, correo);
  return correo;
}

async function getDiscoAlertaEstado() {
  const valor = await getValorTexto(CLAVE_DISCO_ALERTA_ESTADO);
  return valor === 'alertado' ? 'alertado' : 'ok';
}

async function setDiscoAlertaEstado(estado, enviadaEn) {
  await setValorTexto(CLAVE_DISCO_ALERTA_ESTADO, estado === 'alertado' ? 'alertado' : 'ok');
  if (enviadaEn) {
    await setValorTexto(CLAVE_DISCO_ALERTA_ENVIADA_EN, enviadaEn.toISOString());
  }
}

async function getDiscoAlertaEnviadaEn() {
  return getValorTexto(CLAVE_DISCO_ALERTA_ENVIADA_EN);
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
  DISCO_ALERTA_UMBRAL_PCT,
  DISCO_ALERTA_HISTERESIS_PCT,
  getDiscoCapacidadTotalMb,
  setDiscoCapacidadTotalMb,
  getDiscoTopeTenantMb,
  setDiscoTopeTenantMb,
  getDiscoAlertaEmail,
  setDiscoAlertaEmail,
  getDiscoAlertaEstado,
  setDiscoAlertaEstado,
  getDiscoAlertaEnviadaEn,
};
