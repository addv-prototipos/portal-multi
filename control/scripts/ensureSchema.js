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
  // Marca de la empresa (segmento "marca"): nombre con el que la empresa
  // quiere ser reconocida en los correos del portal (en vez del nombre
  // por defecto "ADDV"), y ruta pública del logo cargado (si se subió
  // uno) — si no hay logo, el correo genera un logo de texto con la marca.
  { nombre: 'marca', definicion: 'VARCHAR(255) NULL' },
  { nombre: 'marca_logo_url', definicion: 'VARCHAR(500) NULL' },
  // Identidad visual de la empresa (segmento "Look & Feel"): JSON
  // completo del tema (paleta de colores, tipografías, radio de esquinas,
  // favicon) validado por control/utils/tenantTema.js — NULL = identidad
  // base "ADDV" por defecto. TEXT (no JSON nativo) para que el esquema de
  // lectura del backend no dependa de la versión de MySQL.
  { nombre: 'tema_json', definicion: 'TEXT NULL' },
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

async function asegurarTablaApiCredenciales(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS api_credenciales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_slug VARCHAR(50) NOT NULL,
      api_usuario VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      api_key_hash VARCHAR(255) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_por VARCHAR(100) NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_api_credenciales_usuario (api_usuario),
      KEY idx_api_credenciales_tenant (tenant_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Migración: instalaciones que ya crearon la tabla antes de cookieAuth (clave API)
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_credenciales'`
  );
  const nombres = cols.map((c) => c.COLUMN_NAME);
  if (!nombres.includes('api_key_hash')) {
    await db.query('ALTER TABLE api_credenciales ADD COLUMN api_key_hash VARCHAR(255) NULL');
  }
  if (!nombres.includes('api_key')) {
    // columna legacy por si se usó nombre sin _hash en pruebas locales
    await db.query('ALTER TABLE api_credenciales ADD COLUMN api_key VARCHAR(255) NULL');
  }
}

module.exports = { asegurarColumnasCicloVidaTenant, asegurarTablaApiCredenciales };
