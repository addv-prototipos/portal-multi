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
  // Gobierno de funcionalidades por plan (ver PROJECT_STATE.md — "Gobierno
  // de funcionalidades por tenant desde /control"): plan_id sin FK a
  // propósito — control_app no tiene privilegio REFERENCES (mismo motivo
  // que grupo_sucursal_id abajo, ya documentado en asegurarTablasSucursales).
  // Al asignar un plan, sus valores se COPIAN a las columnas de abajo (no
  // es una referencia viva) — editar un plan después nunca pisa en
  // silencio un tenant ya asignado; para eso existe "Reaplicar valores del
  // plan" en /control, una acción explícita.
  { nombre: 'plan_id', definicion: 'INT NULL' },
  { nombre: 'plan_actualizado_en', definicion: 'DATETIME NULL' },
  // DEFAULT 1 en estas dos: todo tenant existente YA usa Facturación y el
  // portal de clientes hoy sin ninguna restricción — el flag nace
  // encendido para que agregar la columna no apague nada el día de la
  // migración (mismo criterio que marca_lookfeel_habilitado arriba).
  { nombre: 'facturacion_habilitada', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  { nombre: 'portal_clientes_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  // DEFAULT 0: feature nueva, nadie la tenía antes de esta columna salvo
  // quien ya esté en un grupo real — ver el backfill condicional abajo.
  { nombre: 'sucursales_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  // Cuota de disco en MB para imágenes (gobernada desde /control, top-down
  // — distinta de inv_imagen_cuota_mb, que el propio tenant se configura a
  // sí mismo en sus Configuraciones). NULL = sin límite impuesto desde
  // /control. El uso real se mide async, nunca en vivo por request — ver
  // disco_bytes_usados_cache.
  { nombre: 'disco_cuota_mb', definicion: 'INT NULL' },
  { nombre: 'disco_bytes_usados_cache', definicion: 'BIGINT NULL' },
  { nombre: 'disco_cache_actualizado_en', definicion: 'DATETIME NULL' },
  // Ampliación del gobierno de funcionalidades (punto 349-350, ver
  // stitch/gobierno-funcionalidades/NOTAS.md — 12 reglas de dependencia):
  // Ventas, Gastos, Inventarios, Auditoría (de /admin, por tenant — no
  // confundir con la auditoría cross-tenant de /control, que no tiene
  // toggle y nunca se apaga), Cuentas por cobrar, Resumen financiero y
  // las 4 pestañas de Reportes. DEFAULT 1 en las 10 — mismo criterio que
  // facturacion_habilitada/portal_clientes_habilitado/
  // marca_lookfeel_habilitado arriba: son funcionalidades que todo tenant
  // existente YA usa hoy sin restricción, el flag nace encendido para que
  // agregar la columna no le apague nada a nadie el día de la migración.
  { nombre: 'ventas_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  { nombre: 'gastos_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  { nombre: 'inventarios_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  { nombre: 'auditoria_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  // Cuentas por cobrar depende de Ventas (regla de dependencia, no de
  // esquema) — columna propia de todos modos porque es "opcional, no se
  // activa sola aunque Ventas esté encendido" (decisión del usuario).
  { nombre: 'cxc_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  // Se auto-activa en /control cuando Ventas o Gastos se enciende por
  // primera vez (regla 2) — la columna en sí es un simple TINYINT, la
  // regla de auto-activación/bloqueo vive en control/utils/planes.js.
  { nombre: 'resumen_financiero_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  // Las 4 pestañas reales de "Reportes" (frontend/admin.js,
  // PESTANAS_REPORTES) — independientes entre sí y de
  // resumen_financiero_habilitado (regla confirmada explícitamente por el
  // usuario, 2026-10-01).
  { nombre: 'reportes_por_reporte_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  { nombre: 'reportes_cortes_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  { nombre: 'reportes_eliminados_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  { nombre: 'reportes_estado_inventario_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
  // 5ta pestaña de Reportes (punto 360, ver PROJECT_STATE.md): el
  // contenido que antes vivía en "Inicio" (KPIs/dona/recientes de
  // tickets) se movió aquí — mismo criterio DEFAULT 1 que las otras 4,
  // ya era visible para todo tenant existente, la columna nace encendida.
  { nombre: 'reportes_estado_tickets_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 1' },
];

async function asegurarColumnasCicloVidaTenant(db) {
  const [columnas] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'`
  );
  const nombres = columnas.map((c) => c.COLUMN_NAME);
  // Se recuerda si ESTA corrida fue la que agregó sucursales_habilitado —
  // el backfill de abajo solo debe disparar esa única vez (el momento en
  // que la columna nace), nunca en cada restart, o revertiría en silencio
  // una excepción que un operador haya apagado a mano para un tenant que
  // sigue en un grupo (la misma lección ya aprendida con ensureSchema()
  // del backend: un backfill debe ser condicional a un estado viejo
  // conocido, nunca incondicional).
  let sucursalesHabilitadoReciénAgregada = false;
  for (const { nombre, definicion } of COLUMNAS_NUEVAS) {
    if (!nombres.includes(nombre)) {
      await db.query(`ALTER TABLE tenants ADD COLUMN ${nombre} ${definicion}`);
      if (nombre === 'sucursales_habilitado') sucursalesHabilitadoReciénAgregada = true;
    }
  }
  if (sucursalesHabilitadoReciénAgregada) {
    await db.query(
      `UPDATE tenants SET sucursales_habilitado = 1
       WHERE grupo_sucursal_id IS NOT NULL AND sucursales_habilitado = 0`
    );
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

// Catálogo de planes (gobierno de funcionalidades por tenant, ver
// PROJECT_STATE.md). Vive solo — sin referencia a ningún tenant — un plan
// se crea y nombra ANTES de tener ningún cliente en mente; se asigna
// después desde la ficha de empresa (sección "Plan y funciones"), que
// copia estas columnas a `tenants` en ese momento. Editar el plan después
// no toca tenants ya asignados (ver nota de plan_id en COLUMNAS_NUEVAS).
//
// Sin DELETE físico una vez que algún tenant lo tiene asignado — se
// archiva con `activo = 0` (deja de ofrecerse para asignar a empresas
// nuevas, pero los tenants que ya lo tienen siguen funcionando igual).
// Mismo criterio soft-delete que el resto de este archivo.
// Columnas del catálogo de planes para los 10 flags nuevos (punto
// 349-350, ver stitch/gobierno-funcionalidades/NOTAS.md). DEFAULT 0 aquí
// (a diferencia de DEFAULT 1 en `tenants`) — mismo criterio que
// facturacion_habilitada/sucursales_habilitado/marca_lookfeel_habilitado
// ya existentes en esta tabla: un plan NUEVO que se crea desde /control
// no incluye nada por default, el operador lo elige a propósito. Las
// columnas de `tenants` son distintas a propósito (DEFAULT 1, para no
// romper tenants ya en producción) — un plan nuevo no tiene ese problema.
const COLUMNAS_PLANES_NUEVAS = [
  { nombre: 'ventas_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'gastos_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'inventarios_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'auditoria_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'cxc_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'resumen_financiero_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'reportes_por_reporte_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'reportes_cortes_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'reportes_eliminados_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'reportes_estado_inventario_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'reportes_estado_tickets_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
];

async function asegurarTablaPlanes(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS planes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(80) NOT NULL,
      descripcion VARCHAR(255) NULL,
      precio_mensual DECIMAL(10,2) NULL,
      precio_anual DECIMAL(10,2) NULL,
      max_usuarios INT NULL,
      sucursales_habilitado TINYINT(1) NOT NULL DEFAULT 0,
      facturacion_habilitada TINYINT(1) NOT NULL DEFAULT 0,
      portal_clientes_habilitado TINYINT(1) NOT NULL DEFAULT 1,
      marca_lookfeel_habilitado TINYINT(1) NOT NULL DEFAULT 0,
      disco_cuota_mb INT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      orden INT NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migración: instalaciones que ya crearon `planes` antes del punto
  // 349-350 no tienen estas 10 columnas — mismo patrón de migración que
  // api_credenciales/api_key_hash más abajo en este archivo.
  const [columnasPlanes] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'planes'`
  );
  const nombresPlanes = columnasPlanes.map((c) => c.COLUMN_NAME);
  for (const { nombre, definicion } of COLUMNAS_PLANES_NUEVAS) {
    if (!nombresPlanes.includes(nombre)) {
      await db.query(`ALTER TABLE planes ADD COLUMN ${nombre} ${definicion}`);
    }
  }

  // Semilla de arranque — solo si el catálogo está vacío (primera
  // instalación de este segmento). Nunca se reinserta ni se corrige
  // después: una vez que existe un solo plan, el operador es dueño del
  // catálogo desde /control.
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM planes');
  if (total === 0) {
    const ahora = new Date();
    await db.query(
      `INSERT INTO planes
         (nombre, descripcion, precio_mensual, precio_anual, max_usuarios,
          sucursales_habilitado, facturacion_habilitada, portal_clientes_habilitado,
          marca_lookfeel_habilitado, disco_cuota_mb,
          ventas_habilitado, gastos_habilitado, inventarios_habilitado,
          auditoria_habilitado, cxc_habilitado, resumen_financiero_habilitado,
          reportes_por_reporte_habilitado, reportes_cortes_habilitado,
          reportes_eliminados_habilitado, reportes_estado_inventario_habilitado,
          reportes_estado_tickets_habilitado,
          activo, orden, creado_en, actualizado_en)
       VALUES ?`,
      [
        [
          ['Básico', 'Plan de entrada — sin sucursales ni Facturación.', 490, 4900, 5, 0, 0, 1, 0, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, ahora, ahora],
          ['Pro', 'Incluye sucursales, Facturación, Ventas y Gastos.', 1490, 14900, 15, 1, 1, 1, 0, 2048, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 2, ahora, ahora],
          ['Enterprise', 'Sin límite de usuarios, marca propia y todos los módulos incluidos.', null, null, null, 1, 1, 1, 1, 10240, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, ahora, ahora],
        ],
      ]
    );
  }
}

module.exports = {
  asegurarColumnasCicloVidaTenant,
  asegurarTablaApiCredenciales,
  asegurarTablasSucursales,
  asegurarTablaPlanes,
};
