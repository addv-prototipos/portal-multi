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
  // Separación del flag de "Marca propia" (punto en curso, 2026-10-10):
  // el ticket de impresión (logo + plantilla del recibo) compartía bit
  // con marca_lookfeel_habilitado desde el punto 368 — ahora es su
  // propio módulo, togglable aparte desde /control (regla de dependencia
  // 13: requiere ventas_habilitado). DEFAULT 0 aquí a propósito: el
  // backfill real que preserva lo que cada tenant ya tenía vive en
  // asegurarColumnasCicloVidaTenant() de abajo (hereda el valor de
  // marca_lookfeel_habilitado SOLO en la corrida que agrega la columna),
  // mismo criterio que sucursales_habilitado.
  { nombre: 'ticket_impresion_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
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
  // Punto 375 (2026-10-06): pausa de autoservicio del PROPIO administrador
  // ("pendiente 269"), independiente del gate de plan de arriba —
  // portal_clientes_habilitado decide si el tenant TIENE el módulo (solo
  // /control lo prende/apaga); esta columna decide si el admin lo dejó
  // temporalmente en pausa él mismo (Mi Cuenta → "Portal de clientes"),
  // sin pasar por /control. El efectivo es el AND de las dos — ver
  // tenantContext.js. A propósito NO se copia al asignar un plan
  // (control/utils/planes.js no la toca): un cambio de plan nunca debe
  // reactivar en silencio algo que el admin pausó a propósito. DEFAULT 0
  // (no pausado) — agregar la columna no apaga nada el día de la migración.
  { nombre: 'portal_clientes_pausado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  // Punto 377 (2026-10-07): mismo patrón que portal_clientes_pausado justo
  // arriba, ahora para Facturación — facturacion_habilitada decide si el
  // tenant TIENE el módulo (solo /control lo prende/apaga por plan); esta
  // columna decide si el admin lo dejó temporalmente en pausa él mismo
  // (Configuraciones → "Facturación"), sin pasar por /control. El efectivo
  // es el AND de las dos — ver tenantContext.js:facturacionEfectiva(). A
  // propósito NO se copia al asignar un plan (mismo motivo que
  // portal_clientes_pausado). DEFAULT 0 (no pausado) — agregar la columna
  // no apaga nada el día de la migración.
  { nombre: 'facturacion_pausada', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
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
  // Upscale de almacenamiento (punto en curso): suma denormalizada de lo
  // que este tenant ya acumuló en tenant_upscales_activos — disco_cuota_mb
  // de arriba YA incluye este monto (se suma ahí al momento de la compra),
  // estas 2 columnas existen solo para no tener que hacer JOIN/SUM cada
  // vez que se pinta "tu cuota base + upscales" en Mi Cuenta o en el
  // desglose de /control. DEFAULT 0 — ningún tenant existente tiene
  // upscales comprados todavía.
  { nombre: 'disco_upscale_mb', definicion: 'INT NOT NULL DEFAULT 0' },
  { nombre: 'disco_upscale_monto', definicion: 'DECIMAL(10,2) NOT NULL DEFAULT 0' },
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
  // Campana de notificaciones del portal de cliente → Promociones (punto
  // en curso): a diferencia de las columnas de arriba, esta NO es un
  // mapeo retroactivo de algo que el tenant ya usaba — "enviar
  // promociones a clientes" nunca existió en el código. DEFAULT 0 a
  // propósito (ningún tenant real queda con una capacidad nueva
  // encendida sin haberla pedido) — distinto del criterio DEFAULT 1 de
  // arriba, que es solo para no apagarle algo a nadie el día de la
  // migración.
  { nombre: 'promociones_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  // Suscripción por tenant (punto en curso, propuesta 3 aprobada): modo
  // de prueba, ciclo de facturación, fecha de expiración y estatus de
  // cobro. Todas NULL/0 por default — a diferencia de los flags de
  // arriba (que "ya se usaba, nace encendido para no apagar nada"), esta
  // es información nueva que nadie ha capturado todavía; NULL significa
  // "sin configurar", nunca se asume prueba ni pagada por default. El
  // estatus de cobro se edita A MANO por ahora (sin integración real de
  // Stripe, confirmado con el usuario) — la columna queda lista para que
  // un futuro webhook la actualice sola.
  { nombre: 'suscripcion_en_prueba', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { nombre: 'suscripcion_dias_prueba', definicion: 'INT NULL' },
  { nombre: 'suscripcion_prueba_inicia_en', definicion: 'DATE NULL' },
  { nombre: 'suscripcion_ciclo', definicion: "ENUM('mensual','anual') NULL" },
  { nombre: 'suscripcion_expira_en', definicion: 'DATE NULL' },
  { nombre: 'suscripcion_estatus', definicion: "ENUM('prueba','pagada','pendiente','vencida','cancelada') NULL" },
  // Punto 416: quién creó la suscripción — determina si la fecha de
  // inicio del ciclo se protege (onboarding) o se puede volver a anclar
  // en el primer guardado manual desde /control (ver
  // tenantSuscripcion.js). NULL = tenant anterior a este punto, se
  // trata igual que 'manual' (nunca bloquea un guardado existente).
  { nombre: 'suscripcion_origen', definicion: "ENUM('onboarding','manual') NULL" },
  // Ancla de la suscripción DE PAGO (no-prueba) — mismo patrón que
  // suscripcion_prueba_inicia_en pero para el ciclo mensual/anual: se
  // fija sola la primera vez (NUNCA se mueve después, ni siquiera si el
  // ciclo cambia de mensual a anual — solo expira_en se recalcula desde
  // esta misma fecha). Ver tenantSuscripcion.js.
  { nombre: 'suscripcion_ciclo_inicia_en', definicion: 'DATE NULL' },
  // Punto 416: identificador de Stripe Customer — NUNCA se guarda un
  // número de tarjeta real aquí ni en ningún lado del repo (alcance
  // PCI, decisión explícita del usuario). Stripe aún no está integrado
  // de verdad (confirmado: "por ahora usa solo mocks, al final
  // integramos") — la columna queda lista para cuando sí lo esté.
  { nombre: 'stripe_customer_id', definicion: 'VARCHAR(255) NULL' },
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
  let ticketImpresionReciénAgregada = false;
  for (const { nombre, definicion } of COLUMNAS_NUEVAS) {
    if (!nombres.includes(nombre)) {
      await db.query(`ALTER TABLE tenants ADD COLUMN ${nombre} ${definicion}`);
      if (nombre === 'sucursales_habilitado') sucursalesHabilitadoReciénAgregada = true;
      if (nombre === 'ticket_impresion_habilitado') ticketImpresionReciénAgregada = true;
    }
  }
  if (sucursalesHabilitadoReciénAgregada) {
    await db.query(
      `UPDATE tenants SET sucursales_habilitado = 1
       WHERE grupo_sucursal_id IS NOT NULL AND sucursales_habilitado = 0`
    );
  }
  if (ticketImpresionReciénAgregada) {
    // Hereda el valor que cada tenant ya tenía en marca_lookfeel_habilitado
    // (único momento en que corre: la columna acaba de nacer en 0 para
    // todos). Nadie pierde el ticket de impresión que ya estaba usando.
    await db.query(
      `UPDATE tenants SET ticket_impresion_habilitado = marca_lookfeel_habilitado`
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
  { nombre: 'promociones_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  // Mismo criterio que en `tenants` arriba: columna propia, DEFAULT 0, con
  // backfill condicional desde marca_lookfeel_habilitado en
  // asegurarTablaPlanes() — ningún plan ya creado pierde el ticket de
  // impresión que ya traía incluido en "Marca propia".
  { nombre: 'ticket_impresion_habilitado', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  // Punto en curso (integración de pagos): gobierna si el plan se muestra
  // en el sitio público (clarvo.mx) — DEFAULT 0 a propósito, mismo
  // criterio que el resto de esta tabla: un plan nuevo (o ya existente,
  // incluidos los 3 registros de prueba E2E de este entorno) no se
  // publica solo porque exista la columna. El operador lo activa a
  // propósito desde /control.
  { nombre: 'publicado_sitio', definicion: 'TINYINT(1) NOT NULL DEFAULT 0' },
  // Punto en curso (2026-10-27): segundo soft-delete de esta tabla, ver
  // cabecera de control/utils/planes.js — NULL = vivo (filtrado por
  // listarPlanes/obtenerPlan), con fecha = eliminado para siempre. DEFAULT
  // NULL implícito — ningún plan existente queda eliminado por agregar la
  // columna.
  { nombre: 'eliminado_en', definicion: 'DATETIME NULL' },
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
      eliminado_en DATETIME NULL,
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
  let ticketImpresionPlanesReciénAgregada = false;
  for (const { nombre, definicion } of COLUMNAS_PLANES_NUEVAS) {
    if (!nombresPlanes.includes(nombre)) {
      await db.query(`ALTER TABLE planes ADD COLUMN ${nombre} ${definicion}`);
      if (nombre === 'ticket_impresion_habilitado') ticketImpresionPlanesReciénAgregada = true;
    }
  }
  if (ticketImpresionPlanesReciénAgregada) {
    await db.query('UPDATE planes SET ticket_impresion_habilitado = marca_lookfeel_habilitado');
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

  // Punto en curso (integración de pagos): el catálogo público REAL vive
  // en clarvo-Site/src/data/plans.ts (confirmado por el usuario,
  // 2026-10-09 — fuente CLARVO_Planes.md) y en
  // OnboardingModal.tsx (mismos 4 nombres/precios duplicados a
  // propósito, repos separados). resolverPlanIdPorClave() en
  // control/utils/onboardingConversion.js busca esos nombres exactos
  // ("CLARVO Solicita", etc.).
  //
  // Primera versión de esta migración (ya corregida aquí) heredaba
  // módulos de 3 filas de prueba viejas (Básico/Pro/Enterprise) con una
  // asignación placeholder que NO coincidía con la copia real — el caso
  // más notorio: dejaba facturacion_habilitada=0 en Solicita, cuando la
  // propuesta de valor completa de ese plan ES facturación/CFDI. Esta
  // versión mapea cada módulo directo desde los `items` reales de
  // plans.ts. Sigue siendo best-effort en 2 cosas que esa fuente NO
  // especifica y el esquema de `planes` no modela todavía: (1) máximo de
  // usuarios de Solicita/Controla (plans.ts solo marca el límite a partir
  // de Crece: "Hasta 5 usuarios") — se infiere una progresión ascendente
  // razonable (1 y 3); (2) cuota de disco (no aparece en plans.ts en
  // absoluto) y máximo de SUCURSALES por cantidad ("Hasta 2"/"Hasta 5" —
  // la columna actual `sucursales_habilitado` es un booleano, no soporta
  // un tope numérico) quedan fuera de alcance de esta migración; ambos
  // confirmarlos/resolverlos con el usuario antes de depender de ellos
  // en producción.
  //
  // Idempotente de una sola vez: solo corre si ninguno de los 4 nombres
  // reales existe todavía, para no pisar ajustes que el operador ya haya
  // hecho a mano desde /control.
  const [[{ totalReal }]] = await db.query(
    `SELECT COUNT(*) AS totalReal FROM planes WHERE nombre IN ('CLARVO Solicita','CLARVO Controla','CLARVO Crece','CLARVO Domina')`
  );
  if (totalReal === 0) {
    const ahora2 = new Date();
    const columnasComunes = `
      (nombre, descripcion, precio_mensual, precio_anual, max_usuarios, disco_cuota_mb,
       facturacion_habilitada, portal_clientes_habilitado,
       ventas_habilitado, gastos_habilitado, cxc_habilitado, resumen_financiero_habilitado,
       reportes_por_reporte_habilitado, reportes_cortes_habilitado, reportes_eliminados_habilitado,
       reportes_estado_inventario_habilitado, reportes_estado_tickets_habilitado,
       ticket_impresion_habilitado,
       inventarios_habilitado, sucursales_habilitado, auditoria_habilitado, marca_lookfeel_habilitado,
       promociones_habilitado,
       publicado_sitio, activo, orden, creado_en, actualizado_en)`;

    await db.query(
      `INSERT INTO planes ${columnasComunes} VALUES
         ('CLARVO Solicita', 'Deja de perseguir facturas por WhatsApp.', 199, 1990, 1, 500,
          1, 1,
          0, 0, 0, 0,
          0, 0, 0,
          0, 0,
          0,
          0, 0, 0, 0,
          0,
          1, 1, 1, ?, ?),
         ('CLARVO Controla', 'Deja de administrar tu negocio a ciegas.', 599, 5990, 3, 1024,
          1, 1,
          1, 1, 1, 1,
          1, 0, 0,
          0, 0,
          1,
          0, 0, 0, 0,
          0,
          1, 1, 2, ?, ?),
         ('CLARVO Crece', 'Controla tu operación mientras tu negocio crece.', 799, 7990, 5, 2048,
          1, 1,
          1, 1, 1, 1,
          1, 1, 0,
          1, 0,
          1,
          1, 1, 1, 1,
          0,
          1, 1, 3, ?, ?),
         ('CLARVO Domina', 'Ten una visión completa de tu negocio.', 999, 9990, 10, 5120,
          1, 1,
          1, 1, 1, 1,
          1, 1, 1,
          1, 1,
          1,
          1, 1, 1, 1,
          1,
          1, 1, 4, ?, ?)`,
      [ahora2, ahora2, ahora2, ahora2, ahora2, ahora2, ahora2, ahora2]
    );
  }
}

// Punto 370: ajustes globales de la plataforma (clave/valor) — mismo
// patrón exacto que la tabla `configuracion` de cada tenant
// (backend/utils/config.js), pero a nivel plataforma (una sola fila por
// clave, sin importar el tenant). Primer uso: `imagen_max_mb` — el
// tamaño máximo de imagen (producto, foto de ticket, logo de ticket,
// marca, favicon) en TODA la app, configurable desde /control en vez de
// vivir en variables de entorno (antes 2 env vars distintas y
// desincronizadas entre sí — ver control/utils/ajustesGlobales.js).
async function asegurarTablaAjustesGlobales(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ajustes_globales (
      clave VARCHAR(100) PRIMARY KEY,
      valor TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// Onboarding público (clarvo.mx → modal de alta, Segmento A, 2026-10-13):
// borrador especulativo de "empresa que está contratando el servicio",
// guardado ANTES de que exista ningún tenant real — ver
// control/utils/onboardingBorrador.js para toda la lógica de validación.
// Sin FK (mismo motivo que el resto de este archivo: control_app no tiene
// REFERENCES) y sin UNIQUE en slug/admin_email a propósito — un borrador
// especulativo puede chocar en teoría con otro, el candado real es contra
// `tenants.slug` en el momento de aprovisionar (Segmento B).
async function asegurarTablaOnboardingBorradores(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS onboarding_borradores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token VARCHAR(64) NOT NULL,
      plan_clave VARCHAR(30) NOT NULL,
      ciclo ENUM('mensual','anual') NOT NULL DEFAULT 'mensual',
      nombre_empresa VARCHAR(255) NULL,
      slug VARCHAR(50) NULL,
      contacto_email VARCHAR(200) NULL,
      nombre_comercial VARCHAR(255) NULL,
      zona_horaria VARCHAR(64) NOT NULL DEFAULT 'America/Mexico_City',
      admin_email VARCHAR(200) NULL,
      admin_password_hash VARCHAR(255) NULL,
      paso_actual VARCHAR(30) NOT NULL DEFAULT 'plan',
      estado ENUM('activo','convertido','abandonado') NOT NULL DEFAULT 'activo',
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_onboarding_borradores_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Punto en curso (cobrar primero): el pago se rastrea APARTE de
  // `estado` — `estado` sigue describiendo el ciclo de vida del borrador
  // (activo→convertido), nunca "ya pagó". `pago_estado` es NULL mientras
  // el prospecto no llega al paso Pago; 'pendiente' cubre tanto tarjeta en
  // vuelo como OXXO/SPEI esperando confirmación — el webhook es el único
  // que lo pasa a 'confirmado' (y dispara convertirBorrador()) o
  // 'fallido' (nunca aprovisiona). metodo_pago se guarda solo para mostrar
  // el mensaje correcto en el paso Completado (tarjeta vs OXXO/SPEI).
  const [columnasBorradores] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'onboarding_borradores'`
  );
  const nombresBorradores = columnasBorradores.map((c) => c.COLUMN_NAME);
  const COLUMNAS_BORRADOR_PAGO = [
    { nombre: 'stripe_checkout_session_id', definicion: 'VARCHAR(255) NULL' },
    { nombre: 'metodo_pago', definicion: "VARCHAR(20) NULL" },
    { nombre: 'pago_estado', definicion: "ENUM('pendiente','confirmado','fallido') NULL" },
    // Reporte de cupones (punto en curso): código de Stripe realmente
    // usado al pagar (si el prospecto escribió uno en la página de
    // Checkout — allow_promotion_codes, ver stripePagos.js) y el
    // utm_source con el que llegó a clarvo.mx, si clarvo-Site lo captura
    // y lo manda al crear el borrador. NULL es honesto: "no se sabe",
    // nunca un valor inventado.
    { nombre: 'stripe_promotion_code', definicion: 'VARCHAR(100) NULL' },
    { nombre: 'utm_source', definicion: 'VARCHAR(100) NULL' },
    // Recordatorios de activación (punto en curso): cuándo se mandó el
    // último, y cuántos van — el scheduler de control/utils/recordatorios.js
    // los usa para decidir si ya toca otro o si hay que archivar.
    { nombre: 'ultimo_recordatorio_en', definicion: 'DATETIME NULL' },
    { nombre: 'intentos_recordatorio', definicion: 'INT NOT NULL DEFAULT 0' },
  ];
  for (const { nombre, definicion } of COLUMNAS_BORRADOR_PAGO) {
    if (!nombresBorradores.includes(nombre)) {
      await db.query(`ALTER TABLE onboarding_borradores ADD COLUMN ${nombre} ${definicion}`);
    }
  }
}

// Punto en curso (Upscale): catálogo de funcionalidades vendibles por
// separado, encima del plan base de un tenant — su costo se suma a la
// mensualidad/anualidad de la suscripción bajo la misma regla de ciclo
// que el plan (tipo_cobro='recurrente'), o se cobra una sola vez
// (tipo_cobro='unico', solo usa precio_unico). Esta tabla es SOLO el
// catálogo (qué funcionalidades existen y cuánto cuestan) — asignar una
// funcionalidad a un tenant específico y facturarla de verdad es trabajo
// aparte, fuera de alcance de este punto.
async function asegurarTablaUpscale(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS funcionalidades_upscale (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      descripcion VARCHAR(255) NULL,
      tipo_cobro ENUM('recurrente','unico') NOT NULL DEFAULT 'recurrente',
      precio_mensual DECIMAL(10,2) NULL,
      precio_anual DECIMAL(10,2) NULL,
      precio_unico DECIMAL(10,2) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      orden INT NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Primer caso real de funcionalidad con un efecto concreto en el
  // sistema (punto en curso, "Almacenamiento +500 MB"): NULL para
  // cualquier funcionalidad que NO otorgue disco (ej. "Soporte
  // prioritario 24/7") — ver utils/tenantUpscaleCompra.js, que es el
  // único lugar que lee esta columna para decidir cuánta cuota sumar.
  const [columnasUpscale] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'funcionalidades_upscale'`
  );
  if (!columnasUpscale.map((c) => c.COLUMN_NAME).includes('disco_mb')) {
    await db.query('ALTER TABLE funcionalidades_upscale ADD COLUMN disco_mb INT NULL');
  }
}

// Asignación real de una funcionalidad_upscale a un tenant (el "trabajo
// aparte" que el comentario de arriba dejaba fuera de alcance a
// propósito) — un renglón por cada compra. tenant_id/funcionalidad_id sin
// FK (mismo motivo que plan_id en tenants: control_app no tiene privilegio
// REFERENCES). primer_cobro_estado describe SOLO el cobro del primer
// ciclo: 'cobrado_hoy' si se pagó de inmediato vía Stripe Checkout
// (faltaban más de 20 días para el corte), 'pendiente_corte' si se aplicó
// sin cobrar porque faltaban 20 días o menos — a partir de ahí, el monto
// ya vive en tenants.disco_upscale_monto y se cobra junto con el plan en
// cada corte futuro sin distinción (ver tenantUpscaleCompra.js).
async function asegurarTablaUpscaleActivos(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tenant_upscales_activos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      funcionalidad_id INT NOT NULL,
      cantidad INT NOT NULL DEFAULT 1,
      disco_mb_otorgado INT NULL,
      monto_recurrente DECIMAL(10,2) NOT NULL,
      ciclo ENUM('mensual','anual') NOT NULL,
      primer_cobro_estado ENUM('cobrado_hoy','pendiente_corte') NOT NULL,
      stripe_checkout_session_id VARCHAR(255) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      KEY idx_tenant_upscales_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// Idempotencia de webhooks de Stripe: un mismo evento puede reenviarse
// (reintentos de red, redelivery manual desde el Dashboard) — sin esto,
// un checkout.session.completed duplicado reintentaría
// convertirBorrador()/el correo de credenciales dos veces. Solo guarda el
// id del evento, nunca el payload completo (no hace falta, y evita
// guardar datos de pago innecesarios).
async function asegurarTablaStripeEventos(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS stripe_eventos_procesados (
      event_id VARCHAR(255) PRIMARY KEY,
      tipo VARCHAR(100) NOT NULL,
      procesado_en DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

module.exports = {
  asegurarColumnasCicloVidaTenant,
  asegurarTablaApiCredenciales,
  asegurarTablasSucursales,
  asegurarTablaPlanes,
  asegurarTablaAjustesGlobales,
  asegurarTablaOnboardingBorradores,
  asegurarTablaStripeEventos,
  asegurarTablaUpscale,
  asegurarTablaUpscaleActivos,
  // Exportadas solo para que test/unit/ensureSchema.test.js derive sus
  // fixtures y conteos esperados de la fuente real, en vez de mantener una
  // copia a mano que se desincroniza cada vez que se agrega una columna
  // (hallazgo N-02, sonar_1.1.html — 2 veces ya se rompió por esto).
  COLUMNAS_NUEVAS,
  COLUMNAS_PLANES_NUEVAS,
};
