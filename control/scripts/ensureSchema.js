// Agrega la(s) columna(s) que todavía no existan en `tenants` (segmento
// 9 y 9c, duplicado aquí en el segmento 9b — ver PROJECT_STATE.md). Se
// duplica desde backend/scripts/lib/controlDb.js porque control/ es un
// contexto de build de Docker completamente aparte y no puede importar
// código de backend/ en producción (mismo principio ya usado en este
// proyecto: páginas del frontend duplican lógica pequeña porque no hay
// build step/bundler compartido).
//
// Asume que las tablas `tenants`/`tenant_eventos` YA existen — las crea
// backend/scripts/lib/controlDb.js (asegurarControlYPrivilegios, corrido
// con privilegios root vía provisionar-tenant.js), no este servicio, que
// nunca tiene ni necesita CREATE DATABASE.

// Segmento 9c: datos fiscales capturados en el intake de empresa nueva
// (ver control/utils/tenantIntake.js) — todas nullable, el intake es
// especulativo (la empresa ni siquiera tiene su propia BD todavía).
// Mismos nombres/tipos que sus equivalentes en la BD de cada tenant
// (backend/utils/config.js), para que el pre-llenado al aprovisionar
// (backend/scripts/lib/controlDb.js) sea una copia directa sin mapear
// nombres de columna distintos.
const COLUMNAS_NUEVAS = [
  { nombre: 'baja_en', definicion: 'DATETIME NULL' },
  { nombre: 'rfc_compania', definicion: 'VARCHAR(13) NULL' },
  { nombre: 'razon_social_compania', definicion: 'VARCHAR(255) NULL' },
  { nombre: 'regimen_fiscal_compania', definicion: 'VARCHAR(255) NULL' },
  { nombre: 'tipo_persona_compania', definicion: "ENUM('fisica','moral') NULL" },
  { nombre: 'clave_sat', definicion: 'VARCHAR(8) NULL' },
  { nombre: 'link_codigos_sat', definicion: 'VARCHAR(500) NULL' },
  { nombre: 'correo_reportes', definicion: 'VARCHAR(200) NULL' },
];

async function asegurarColumnasCicloVidaTenant(db) {
  const [columnas] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'`
  );
  const nombres = columnas.map((c) => c.COLUMN_NAME);
  for (const { nombre, definicion } of COLUMNAS_NUEVAS) {
    if (!nombres.includes(nombre)) {
      await db.query(`ALTER TABLE tenants ADD COLUMN ${nombre} ${definicion}`);
    }
  }
}

module.exports = { asegurarColumnasCicloVidaTenant };
