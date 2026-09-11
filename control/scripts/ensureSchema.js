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
  // Punto 244 (mapeo con CLARVO_Planes.md, 2026-09-10): gate de "marca" +
  // "Look & Feel" — hasta ahora cualquier tenant podía usarlos sin
  // restricción; con este switch, el backend cae al diseño/marca por
  // defecto de CLARVO aunque la fila tenga marca/tema_json capturados.
  // DEFAULT 1 (encendido) a propósito: ningún tenant ya configurado
  // pierde su identidad visual solo por agregar esta columna.
  { nombre: 'marca_lookfeel_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  // Cuota de cuentas de panel (administrador/fiscal/ventas) por tenant —
  // NULL = sin límite (comportamiento de siempre). Enforcement real en
  // backend/server.js POST /api/admin/usuarios.
  { nombre: 'max_usuarios', definicion: 'INT NULL' },
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

// §58: agrupar tenants como sucursales del mismo negocio + usuarios
// compartidos válidos en cualquier sucursal del grupo. Un tenant
// pertenece a lo más un grupo (`tenants.grupo_sucursal_id`, NULL si no
// está asociado). La credencial vive SOLO aquí (BD de control) — el
// backend la verifica en vivo contra esta misma tabla (vía
// obtenerPoolControl(), la conexión que ya usa para resolver cualquier
// tenant por slug) en vez de replicarla en la tabla `usuarios` de cada
// tenant: una sola fuente de verdad, sin fan-out ni riesgo de
// inconsistencia entre sucursales.
//
// SIN FOREIGN KEY y SIN DELETE real, a propósito — validado contra MySQL
// real (2026-08-26): el usuario `control_app` solo tiene
// SELECT/INSERT/UPDATE/CREATE/ALTER (ver backend/scripts/lib/controlDb.js,
// decisión de seguridad del segmento 9b: credencial angosta) — le falta
// REFERENCES para crear un FK y DELETE para borrar filas. Mismo patrón ya
// usado en `orden_productos` (sin FK "porque productos se crea después")
// y en `api_credenciales.revocarCredencialApi()` (baja lógica con
// `activo = 0`, nunca DELETE). "Eliminar" un grupo aquí es soft-delete:
// se desactiva, se sueltan sus tenants y se desactivan sus usuarios —
// ver eliminarGrupoSucursal() en utils/sucursales.js.
async function asegurarTablasSucursales(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS grupos_sucursal (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Migración: una instalación que ya tenía `grupos_sucursal` de un
  // intento anterior de este mismo segmento (antes de que `activo`
  // existiera) no tendría esta columna — CREATE TABLE IF NOT EXISTS es
  // no-op si la tabla ya existe.
  const [columnasGrupos] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grupos_sucursal'`
  );
  if (!columnasGrupos.map((c) => c.COLUMN_NAME).includes('activo')) {
    await db.query('ALTER TABLE grupos_sucursal ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1');
  }

  const [columnasTenants] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'`
  );
  const nombresTenants = columnasTenants.map((c) => c.COLUMN_NAME);
  if (!nombresTenants.includes('grupo_sucursal_id')) {
    await db.query('ALTER TABLE tenants ADD COLUMN grupo_sucursal_id INT NULL');
    await db.query('ALTER TABLE tenants ADD KEY idx_tenants_grupo_sucursal (grupo_sucursal_id)');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios_sucursal (
      id INT AUTO_INCREMENT PRIMARY KEY,
      grupo_sucursal_id INT NOT NULL,
      usuario VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      perfil VARCHAR(20) NOT NULL DEFAULT 'administrador',
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_usuarios_sucursal_grupo_usuario (grupo_sucursal_id, usuario),
      KEY idx_usuarios_sucursal_grupo (grupo_sucursal_id),
      CONSTRAINT chk_usuarios_sucursal_perfil CHECK (perfil IN ('administrador', 'fiscal'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

module.exports = { asegurarColumnasCicloVidaTenant, asegurarTablaApiCredenciales, asegurarTablasSucursales };
