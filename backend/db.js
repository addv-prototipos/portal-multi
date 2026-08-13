const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2/promise');
const { hashPassword } = require('./utils/authUsuario');

// Opciones de conexion compartidas por CUALQUIER pool que este modulo cree
// (el de siempre, y cualquier pool de tenant que se agregue mas adelante) —
// una sola definicion para no arriesgar que un pool nuevo se cree con
// timeouts/keepalive distintos por descuido.
//
// `dateStrings: true` hace que las columnas DATETIME se devuelvan como
// texto "YYYY-MM-DD HH:MM:SS" (igual que el formato que ya entendía el
// frontend cuando la base de datos era SQLite), y `timezone: 'Z'` fuerza
// que tanto la escritura como la lectura de fechas se traten como UTC, sin
// depender de la zona horaria del contenedor.
//
// `enableKeepAlive` + `keepAliveInitialDelay`: una conexión del pool que
// lleva un rato inactiva puede quedar "muerta" sin que el driver se entere
// (el otro lado — MySQL, un firewall, o el propio Docker — la cierra en
// silencio) hasta que se intenta usarla, y ESA consulta falla con un error
// de conexión que no tiene relación aparente con nada — exactamente el
// tipo de cosa que se percibe como intermitencia. El keepalive de TCP
// mantiene la conexión activa de verdad, para detectar (y que el pool
// reemplace) una conexión muerta antes de que un usuario real la use.
// `connectTimeout`: sin esto, un intento de conexión que no puede
// completarse (red lenta, MySQL sobrecargado) podría quedarse esperando
// mucho más de lo razonable en vez de fallar rápido y dejar que el
// llamador reintente.
const OPCIONES_POOL_BASE = {
  waitForConnections: true,
  queueLimit: 0,
  dateStrings: true,
  timezone: 'Z',
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
};

function crearPool(opciones) {
  return mysql.createPool({ ...OPCIONES_POOL_BASE, ...opciones });
}

// Pool "por defecto": una sola base fija tomada de las variables de entorno
// DB_*, exactamente el comportamiento de este módulo antes de volverse
// multi-tenant. Sigue existiendo tal cual porque es el pool que se usa
// automáticamente en CUALQUIER código que corra fuera de un contexto de
// tenant resuelto — que hoy es TODO el código del backend, hasta que el
// segmento 3 del plan multi-tenant agregue el middleware que establece ese
// contexto por request. Mientras eso no exista, este refactor no cambia
// ningún comportamiento observable.
const poolPorDefecto = crearPool({
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'portal_facturacion',
  connectionLimit: 10,
});

// Contexto de tenant por request. `almacenTenant.run({ pool }, fn)` hace
// que, dentro de `fn` (y de cualquier función async que llame, sin
// importar cuántos niveles de profundidad), `almacenTenant.getStore()`
// devuelva ese mismo `{ pool }` — así es como el middleware de resolución
// de tenant (segmento 3, todavía no escrito) podrá hacer que los 150+
// call sites existentes de `pool.query(...)` usen el pool del tenant
// correcto sin que ninguno de ellos sepa que existe multi-tenant.
const almacenTenant = new AsyncLocalStorage();

// `pool` deja de ser el objeto de mysql2 directamente y pasa a ser un
// proxy con la MISMA interfaz (`.query`, `.execute`, `.getConnection`,
// `.end`, etc.) — delega, en el momento de cada llamada, al pool del
// tenant activo en el contexto async actual, o al pool por defecto si no
// hay ninguno establecido. Esto es lo que evita reescribir los ~150 call
// sites de `pool.query(...)` en server.js y los 6 archivos utils/* que
// hoy hacen `const { pool } = require('../db')`: ese código sigue siendo
// válido literalmente sin cambios.
const pool = new Proxy(
  {},
  {
    get(_objetivo, propiedad) {
      const contexto = almacenTenant.getStore();
      const poolActivo = (contexto && contexto.pool) || poolPorDefecto;
      const valor = poolActivo[propiedad];
      return typeof valor === 'function' ? valor.bind(poolActivo) : valor;
    },
  }
);

// Corre `fn` (típicamente el resto del pipeline de middlewares/ruta de una
// request) con `tenantPool` como el pool activo para cualquier
// `pool.query(...)` que se ejecute mientras tanto, en cualquier profundidad
// de la pila de llamadas asíncronas.
function ejecutarComoTenant(tenantPool, fn) {
  return almacenTenant.run({ pool: tenantPool }, fn);
}

// ---------------------------------------------------------------------
// Registro de pools por tenant (Map<slug, { pool, lastUsedAt }>).
//
// Creación perezosa: el pool de un tenant se crea la primera vez que se
// pide (no hay uno precreado por cada fila de la tabla `tenants`). Con
// cientos de tenants no se puede mantener un pool abierto por cada uno de
// forma permanente (MySQL 8 trae `max_connections=151` por defecto) — por
// eso un reaper cierra pools inactivos por más de TENANT_POOL_TTL_MS, y un
// cap LRU (TENANT_POOL_MAX) evita que un pico de tráfico repartido entre
// muchos tenants a la vez agote las conexiones del servidor.
//
// Fórmula operativa a respetar al dimensionar estas variables de entorno
// frente a `max_connections` del servidor MySQL:
//   TENANT_POOL_MAX * TENANT_POOL_CONNECTION_LIMIT + margen (control DB,
//   pool por defecto, conexiones administrativas) < max_connections
// ---------------------------------------------------------------------

const REAPER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

function ttlPoolsTenantMs() {
  return Number(process.env.TENANT_POOL_TTL_MS || 45 * 60 * 1000); // 45 minutos
}

function maxPoolsTenant() {
  return Number(process.env.TENANT_POOL_MAX || 200);
}

function connectionLimitPoolTenant() {
  return Number(process.env.TENANT_POOL_CONNECTION_LIMIT || 5);
}

const registroPoolsTenant = new Map();
let temporizadorReaper = null;

function iniciarReaperSiHaceFalta() {
  if (temporizadorReaper) return;
  temporizadorReaper = setInterval(purgarPoolsInactivos, REAPER_INTERVAL_MS);
  // `unref()` para que este temporizador no sea, por sí solo, la razón de
  // que el proceso (o una corrida de tests) se quede vivo esperándolo.
  if (typeof temporizadorReaper.unref === 'function') temporizadorReaper.unref();
}

function detenerReaper() {
  if (temporizadorReaper) {
    clearInterval(temporizadorReaper);
    temporizadorReaper = null;
  }
}

// Cierra y quita del registro el pool de tenant menos usado recientemente
// — se llama solo cuando el registro ya está en el cap (TENANT_POOL_MAX)
// y hace falta espacio para uno nuevo.
function evictarMenosUsadoSiHaceFalta() {
  if (registroPoolsTenant.size < maxPoolsTenant()) return;
  let slugMasViejo = null;
  let peorTiempo = Infinity;
  for (const [slug, entrada] of registroPoolsTenant) {
    if (entrada.lastUsedAt < peorTiempo) {
      peorTiempo = entrada.lastUsedAt;
      slugMasViejo = slug;
    }
  }
  if (slugMasViejo) cerrarPoolTenant(slugMasViejo);
}

// Obtiene (o crea, si es la primera vez) el pool de conexiones del tenant
// identificado por `slug`. `host`/`port`/`user`/`password`/`database` solo
// se usan si hay que crear el pool — en llamadas subsecuentes con el mismo
// slug se reutiliza el pool existente sin volver a leerlos.
function obtenerPoolTenant({ slug, host, port, user, password, database }) {
  const existente = registroPoolsTenant.get(slug);
  if (existente) {
    existente.lastUsedAt = Date.now();
    return existente.pool;
  }

  evictarMenosUsadoSiHaceFalta();

  const poolNuevo = crearPool({
    host,
    port,
    user,
    password,
    database,
    connectionLimit: connectionLimitPoolTenant(),
  });
  registroPoolsTenant.set(slug, { pool: poolNuevo, lastUsedAt: Date.now() });
  iniciarReaperSiHaceFalta();
  return poolNuevo;
}

// Cierra el pool de un tenant y lo quita del registro. Segura de llamar
// aunque el slug no esté registrado (no-op). El cierre del pool de mysql2
// se deja correr en segundo plano — un cierre lento/fallido no debe
// bloquear al llamador (ej. el reaper procesando el siguiente tenant).
function cerrarPoolTenant(slug) {
  const entrada = registroPoolsTenant.get(slug);
  if (!entrada) return;
  registroPoolsTenant.delete(slug);
  entrada.pool.end().catch(() => {});
}

// Recorre el registro y cierra cualquier pool de tenant inactivo por más
// de TENANT_POOL_TTL_MS. Se expone (no solo como callback interno del
// reaper) porque también es útil dispararlo a mano — ej. en un apagado
// ordenado, o desde una prueba.
function purgarPoolsInactivos() {
  const ahora = Date.now();
  const ttlMs = ttlPoolsTenantMs();
  for (const [slug, entrada] of registroPoolsTenant) {
    if (ahora - entrada.lastUsedAt > ttlMs) {
      cerrarPoolTenant(slug);
    }
  }
}

// Cierra TODOS los pools de tenant activos y detiene el reaper — pensado
// para el apagado ordenado del backend (SIGTERM/SIGINT en server.js).
async function cerrarTodosLosPoolsTenant() {
  detenerReaper();
  const cierres = [...registroPoolsTenant.keys()].map((slug) => cerrarPoolTenant(slug));
  await Promise.allSettled(cierres);
}

// ---------------------------------------------------------------------
// Pool de la base de datos de control (catálogo de tenants — tablas
// `tenants`/`tenant_eventos`, ver backend/scripts/provisionar-tenant.js).
// Siempre vivo (no perezoso como los de tenant) pero con un límite de
// conexiones bajo — se consulta con poca frecuencia (solo para resolver
// un slug o, más adelante, desde la futura app de control).
// ---------------------------------------------------------------------
let poolControl = null;
function obtenerPoolControl() {
  if (!poolControl) {
    poolControl = crearPool({
      host: process.env.CONTROL_DB_HOST || process.env.DB_HOST || 'mysql',
      port: Number(process.env.CONTROL_DB_PORT || process.env.DB_PORT || 3306),
      user: process.env.CONTROL_DB_USER || process.env.DB_USER || 'app',
      password: process.env.CONTROL_DB_PASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.CONTROL_DB_NAME || 'control_tenants',
      connectionLimit: 5,
    });
  }
  return poolControl;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// MySQL puede tardar unos segundos en aceptar conexiones despues de que su
// contenedor arranca (incluso con el healthcheck de docker-compose, puede
// haber una ventana breve). Se reintenta con espera creciente en vez de
// tronar de inmediato, para que el backend no quede en crash-loop.
async function esperarConexion(db = pool, intentosMax = 20, esperaMs = 1500) {
  let ultimoError = null;
  for (let intento = 1; intento <= intentosMax; intento += 1) {
    try {
      const conexion = await db.getConnection();
      conexion.release();
      return;
    } catch (err) {
      ultimoError = err;
      console.log(
        `Esperando a MySQL (intento ${intento}/${intentosMax})... ${err.code || err.message}`
      );
      await esperar(esperaMs);
    }
  }
  throw new Error(`No se pudo conectar a MySQL despues de ${intentosMax} intentos: ${ultimoError && ultimoError.message}`);
}

// Crea las tablas si no existen. Como este es el primer y unico motor de
// base de datos soportado desde esta version (antes era SQLite), el
// esquema se crea completo desde el inicio; no hay migraciones historicas
// de MySQL que arrastrar. Si en el futuro se agregan columnas nuevas,
// seguir el patron de comprobar INFORMATION_SCHEMA.COLUMNS antes de un
// ALTER TABLE, igual que se hacia con PRAGMA table_info en SQLite.
//
// `db` es el pool contra el que se crea/migra el esquema — por defecto el
// pool "activo" de este módulo (ver el proxy `pool` arriba), que hoy
// siempre resuelve al pool por defecto porque nada establece todavía un
// contexto de tenant. Recibirlo como parámetro es lo que permite que
// `backend/scripts/provisionar-tenant.js` (y, más adelante, la propia app)
// puedan aplicar este mismo esquema contra la base de datos de un tenant
// distinto sin duplicar ni una sola de las sentencias de abajo.
async function ensureSchema(db = pool) {
  await esperarConexion(db);

  await db.query(`
    CREATE TABLE IF NOT EXISTS registros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(500) NOT NULL DEFAULT '',
      tipo_persona VARCHAR(10) NOT NULL DEFAULT '',
      rfc VARCHAR(13) NULL,
      email VARCHAR(200) NOT NULL,
      correo_contador VARCHAR(200) NULL,
      indicaciones TEXT NULL,
      archivo_nombre_original VARCHAR(255) NOT NULL,
      archivo_nombre_guardado VARCHAR(255) NOT NULL,
      archivo_mime VARCHAR(100) NOT NULL,
      archivo_tamano_bytes BIGINT UNSIGNED NOT NULL,
      regimen_fiscal TEXT NULL,
      codigo_postal VARCHAR(10) NULL,
      uso_cfdi VARCHAR(10) NULL,
      eliminado_en DATETIME NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_registros_email (email),
      KEY idx_registros_rfc (rfc),
      KEY idx_registros_eliminado_en (eliminado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migracion: instalaciones que ya tenian la tabla "registros" de antes de
  // que existiera la columna "correo_contador" no tendrian esta columna.
  // NOTA: este campo quedó OBSOLETO como columna por registro/cliente —
  // "correo de quien va a facturar" ahora es un solo valor global que
  // configura el administrador dentro de la configuración SMTP (ver
  // backend/utils/email.js). Se conserva la columna únicamente para no
  // perder datos de registros creados antes de ese cambio; ya no se lee ni
  // se escribe desde el formulario público ni desde el panel de administración.
  const [columnasRegistros] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'registros'`
  );
  const nombresColumnasRegistros = columnasRegistros.map((c) => c.COLUMN_NAME);
  if (!nombresColumnasRegistros.includes('correo_contador')) {
    await db.query('ALTER TABLE registros ADD COLUMN correo_contador VARCHAR(200) NULL');
  }

  // El CHECK se agrega aparte porque no todos los flujos garantizan que
  // CREATE TABLE IF NOT EXISTS lo haya incluido (ej. una tabla creada por
  // una version intermedia de este archivo durante desarrollo); se valida
  // su existencia primero para que reiniciar el contenedor no falle
  // intentando agregarlo dos veces.
  const [checks] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'registros'
       AND CONSTRAINT_NAME = 'chk_tipo_persona'`
  );
  if (checks.length === 0) {
    await db.query(
      `ALTER TABLE registros ADD CONSTRAINT chk_tipo_persona
       CHECK (tipo_persona IN ('fisica', 'moral', ''))`
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave VARCHAR(100) PRIMARY KEY,
      valor TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Cuentas de usuario para el portal (login por RFC + contraseña). Son
  // independientes de los administradores (que usan HTTP Basic Auth por
  // separado) y de los registros de constancia fiscal: un usuario puede
  // existir sin haber subido todavía su constancia, y viceversa (los
  // registros de constancia de antes de esta función no tienen cuenta).
  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rfc VARCHAR(50) NOT NULL,
      telefono VARCHAR(20) NOT NULL,
      email VARCHAR(200) NULL,
      password_hash VARCHAR(255) NOT NULL,
      debe_cambiar_password TINYINT(1) NOT NULL DEFAULT 0,
      perfil VARCHAR(20) NOT NULL DEFAULT 'cliente',
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_usuarios_rfc (rfc)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migracion: instalaciones que ya tenian la tabla "usuarios" de antes de
  // que existiera "forzar cambio de contraseña", "perfil" o "email" no
  // tendrian estas columnas.
  const [columnasUsuarios] = await db.query(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'`
  );
  const nombresColumnasUsuarios = columnasUsuarios.map((c) => c.COLUMN_NAME);
  if (!nombresColumnasUsuarios.includes('debe_cambiar_password')) {
    await db.query('ALTER TABLE usuarios ADD COLUMN debe_cambiar_password TINYINT(1) NOT NULL DEFAULT 0');
  }
  // Todos los usuarios creados antes de que existiera "perfil" son
  // clientes (es lo único que existía hasta ahora) — DEFAULT 'cliente' ya
  // cubre esto automáticamente al agregar la columna.
  if (!nombresColumnasUsuarios.includes('perfil')) {
    await db.query("ALTER TABLE usuarios ADD COLUMN perfil VARCHAR(20) NOT NULL DEFAULT 'cliente'");
  }
  if (!nombresColumnasUsuarios.includes('email')) {
    await db.query('ALTER TABLE usuarios ADD COLUMN email VARCHAR(200) NULL');
  }
  // El campo "rfc" se usa como nombre de usuario también para perfiles
  // administrador/fiscal, que no necesariamente tienen un RFC real — se
  // ensancha por si la instalación existente todavía tiene la columna en
  // su tamaño original (13 caracteres, el máximo de un RFC de persona moral).
  const columnaRfc = columnasUsuarios.find((c) => c.COLUMN_NAME === 'rfc');
  if (columnaRfc && Number(columnaRfc.CHARACTER_MAXIMUM_LENGTH) < 50) {
    await db.query('ALTER TABLE usuarios MODIFY COLUMN rfc VARCHAR(50) NOT NULL');
  }

  const [checkPerfil] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'
       AND CONSTRAINT_NAME = 'chk_usuarios_perfil'`
  );
  if (checkPerfil.length === 0) {
    await db.query(
      `ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_perfil
       CHECK (perfil IN ('cliente', 'administrador', 'fiscal'))`
    );
  }

  // Solicitudes de facturación de tickets/comprobantes de compra. Cada
  // ticket pertenece al RFC de la sesión que lo subió (no a un id de
  // usuario directamente, para poder listarlos igual de simple que los
  // registros de constancia, que también se identifican por RFC).
  await db.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      folio VARCHAR(20) NOT NULL,
      rfc VARCHAR(13) NOT NULL,
      uso_cfdi VARCHAR(10) NULL,
      tipo_pago VARCHAR(30) NULL,
      tipo_pago_otro VARCHAR(100) NULL,
      comentarios TEXT NULL,
      orden_compra_id INT NULL,
      imagen_nombre_original VARCHAR(255) NOT NULL,
      imagen_nombre_guardado VARCHAR(255) NOT NULL,
      imagen_mime VARCHAR(100) NOT NULL,
      imagen_tamano_bytes BIGINT UNSIGNED NOT NULL,
      estatus VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      factura_nombre_original VARCHAR(255) NULL,
      factura_nombre_guardado VARCHAR(255) NULL,
      factura_mime VARCHAR(100) NULL,
      notas_admin TEXT NULL,
      actualizado_por VARCHAR(100) NULL,
      eliminado_en DATETIME NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_tickets_folio (folio),
      KEY idx_tickets_rfc (rfc),
      KEY idx_tickets_estatus (estatus),
      KEY idx_tickets_eliminado_en (eliminado_en),
      KEY idx_tickets_orden_compra_id (orden_compra_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migracion: instalaciones que ya tenian la tabla "tickets" de antes de
  // que se agregaran Uso de CFDI / tipo de pago / comentarios no tendrian
  // estas columnas.
  const [columnasTickets] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'`
  );
  const nombresColumnasTickets = columnasTickets.map((c) => c.COLUMN_NAME);
  if (!nombresColumnasTickets.includes('uso_cfdi')) {
    await db.query('ALTER TABLE tickets ADD COLUMN uso_cfdi VARCHAR(10) NULL');
  }
  if (!nombresColumnasTickets.includes('tipo_pago')) {
    await db.query('ALTER TABLE tickets ADD COLUMN tipo_pago VARCHAR(30) NULL');
  }
  if (!nombresColumnasTickets.includes('tipo_pago_otro')) {
    await db.query('ALTER TABLE tickets ADD COLUMN tipo_pago_otro VARCHAR(100) NULL');
  }
  if (!nombresColumnasTickets.includes('comentarios')) {
    await db.query('ALTER TABLE tickets ADD COLUMN comentarios TEXT NULL');
  }
  if (!nombresColumnasTickets.includes('eliminado_en')) {
    await db.query('ALTER TABLE tickets ADD COLUMN eliminado_en DATETIME NULL');
    await db.query('ALTER TABLE tickets ADD KEY idx_tickets_eliminado_en (eliminado_en)');
  }
  if (!nombresColumnasTickets.includes('orden_compra_id')) {
    await db.query('ALTER TABLE tickets ADD COLUMN orden_compra_id INT NULL');
    await db.query('ALTER TABLE tickets ADD KEY idx_tickets_orden_compra_id (orden_compra_id)');
  }
  if (!nombresColumnasTickets.includes('actualizado_por')) {
    await db.query('ALTER TABLE tickets ADD COLUMN actualizado_por VARCHAR(100) NULL');
  }

  const [checksTicket] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'
       AND CONSTRAINT_NAME = 'chk_tickets_estatus'`
  );
  if (checksTicket.length === 0) {
    await db.query(
      `ALTER TABLE tickets ADD CONSTRAINT chk_tickets_estatus
       CHECK (estatus IN ('pendiente', 'en_curso', 'cancelado', 'listo'))`
    );
  }

  // El tipo de pago es opcional (puede quedar NULL), pero si se manda debe
  // ser una de las 5 opciones del dropdown (incluyendo "otro", agregada
  // después de que la app ya tenía instalaciones en producción — ver más
  // abajo la migración que actualiza una restricción vieja) — se guarda
  // como "slug" corto en la base de datos; las etiquetas en español
  // ("Pago en efectivo", etc.) viven en el frontend y en el mapeo de
  // backend/server.js.
  const [checksTipoPago] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'
       AND CONSTRAINT_NAME = 'chk_tickets_tipo_pago'`
  );
  if (checksTipoPago.length === 0) {
    // Instalación nueva: se crea directamente con "otro" ya incluido.
    await db.query(
      `ALTER TABLE tickets ADD CONSTRAINT chk_tickets_tipo_pago
       CHECK (tipo_pago IS NULL OR tipo_pago IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito', 'otro'))`
    );
  } else {
    // La restricción ya existe, pero puede ser la versión VIEJA (de antes
    // de agregar "otro") — se revisa su definición real, y si no incluye
    // "otro" todavía, se reemplaza. Sin este paso, una instalación ya
    // desplegada se quedaría para siempre con la restricción vieja (el
    // chequeo de arriba solo agrega la restricción si NO existe, nunca la
    // actualiza), y cualquier ticket con tipo_pago="otro" fallaría con un
    // error de restricción CHECK sin explicación aparente.
    const [definicionActual] = await db.query(
      `SELECT CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_tickets_tipo_pago'`
    );
    const clausulaActual = definicionActual[0] ? definicionActual[0].CHECK_CLAUSE : '';
    if (!clausulaActual.includes('otro')) {
      await db.query('ALTER TABLE tickets DROP CHECK chk_tickets_tipo_pago');
      await db.query(
        `ALTER TABLE tickets ADD CONSTRAINT chk_tickets_tipo_pago
         CHECK (tipo_pago IS NULL OR tipo_pago IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito', 'otro'))`
      );
    }
  }

  // Ordenes de compra: registra una compra/servicio para generar su
  // factura, con el monto, el IVA aplicado (guardado como "foto" del
  // valor configurado al momento de crear la orden — si el IVA global
  // cambia despues, las ordenes ya creadas NO deben cambiar
  // retroactivamente) y el correo del cliente al que corresponde (tomado
  // de una constancia ya subida, ver registros.email).
  await db.query(`
    CREATE TABLE IF NOT EXISTS ordenes_compra (
      id INT AUTO_INCREMENT PRIMARY KEY,
      numero_compra VARCHAR(20) NOT NULL,
      fecha_compra DATETIME NOT NULL,
      concepto VARCHAR(255) NOT NULL,
      cantidad DECIMAL(12,2) NOT NULL,
      iva_porcentaje DECIMAL(5,2) NOT NULL,
      total DECIMAL(12,2) NOT NULL,
      email VARCHAR(200) NOT NULL,
      eliminado_en DATETIME NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_ordenes_compra_numero (numero_compra),
      KEY idx_ordenes_compra_email (email),
      KEY idx_ordenes_compra_eliminado_en (eliminado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migracion: instalaciones que ya tenian "ordenes_compra" de antes de
  // que existiera "No. Compra" (numero_compra) no tendrian esta columna.
  // Se agrega nullable primero, se rellenan las filas existentes con un
  // valor generado a partir de su propio id (mismo formato "OC-000001"
  // que usa el codigo para las nuevas), y luego se vuelve NOT NULL + UNIQUE
  // — en ese orden, para no dejar nunca una columna NOT NULL sin valor en
  // una fila ya existente a mitad de la migracion.
  const [columnasOrdenesCompra] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra'`
  );
  const nombresColumnasOrdenesCompra = columnasOrdenesCompra.map((c) => c.COLUMN_NAME);
  if (!nombresColumnasOrdenesCompra.includes('numero_compra')) {
    await db.query('ALTER TABLE ordenes_compra ADD COLUMN numero_compra VARCHAR(20) NULL');
    await db.query(
      `UPDATE ordenes_compra SET numero_compra = CONCAT('OC-', LPAD(id, 6, '0')) WHERE numero_compra IS NULL`
    );
    await db.query('ALTER TABLE ordenes_compra MODIFY COLUMN numero_compra VARCHAR(20) NOT NULL');
    const [indicesOrdenesCompra] = await db.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra' AND INDEX_NAME = 'uq_ordenes_compra_numero'`
    );
    if (indicesOrdenesCompra.length === 0) {
      await db.query('ALTER TABLE ordenes_compra ADD UNIQUE KEY uq_ordenes_compra_numero (numero_compra)');
    }
  }

  const [checksOrdenCantidad] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra'
       AND CONSTRAINT_NAME = 'chk_ordenes_compra_cantidad'`
  );
  if (checksOrdenCantidad.length === 0) {
    await db.query(
      `ALTER TABLE ordenes_compra ADD CONSTRAINT chk_ordenes_compra_cantidad CHECK (cantidad > 0)`
    );
  }

  const [checksOrdenIva] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra'
       AND CONSTRAINT_NAME = 'chk_ordenes_compra_iva'`
  );
  if (checksOrdenIva.length === 0) {
    await db.query(
      `ALTER TABLE ordenes_compra ADD CONSTRAINT chk_ordenes_compra_iva
       CHECK (iva_porcentaje >= 0 AND iva_porcentaje <= 100)`
    );
  }

  // Reportes: cada fila es UNA corrida de generación de reporte (ya sea
  // "automatico" —justo antes de que el borrado por retención elimine
  // tickets/órdenes vencidos, para no perder esa información para
  // siempre— o "manual" —disparado a mano desde el botón "Enviar
  // reporte"). `md_contenido` guarda el reporte completo ya armado en
  // Markdown (lo que se manda por correo), para poder reenviarlo o
  // descargarlo después sin tener que reconstruirlo. Los datos
  // ESTRUCTURADOS de cada ticket/orden capturado viven aparte, en
  // `reporte_items`, para poder filtrarlos y exportarlos en la vista
  // "Lectura de reportes" del panel.
  await db.query(`
    CREATE TABLE IF NOT EXISTS reportes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL,
      fecha_generacion DATETIME NOT NULL,
      rango_inicio DATETIME NULL,
      rango_fin DATETIME NULL,
      correo_enviado_a VARCHAR(200) NULL,
      correo_enviado TINYINT(1) NOT NULL DEFAULT 0,
      total_tickets INT NOT NULL DEFAULT 0,
      total_ordenes INT NOT NULL DEFAULT 0,
      md_contenido LONGTEXT NOT NULL,
      creado_en DATETIME NOT NULL,
      KEY idx_reportes_fecha_generacion (fecha_generacion),
      CONSTRAINT chk_reportes_tipo CHECK (tipo IN ('automatico', 'manual'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Un registro por cada ticket/orden de compra capturado en un reporte
  // — "identificador" es el folio (tickets) o el No. Compra (órdenes);
  // "estatus_o_concepto" es el estatus para un ticket o el concepto para
  // una orden (campos distintos según el tipo, guardados en una sola
  // columna de texto en vez de tener columnas separadas casi siempre
  // vacías); "monto" queda NULL para un ticket (no tiene un monto propio
  // — el monto real vive en la orden de compra a la que esté vinculado,
  // si tiene alguna) y es el total para una orden.
  // "rfc" en realidad guarda dos cosas distintas según tipo_registro: el
  // RFC de un ticket (máximo 13 caracteres), o el CORREO de una orden de
  // compra (una orden no guarda su propio RFC, solo el correo del
  // cliente) — por eso el tamaño de columna acomoda un correo completo
  // (200 caracteres, mismo tamaño que ya usa ordenes_compra.email), no
  // solo un RFC.
  // "atendido_por": quién atendió el ticket (mismo valor que
  // tickets.actualizado_por — el usuario de la sesión que hizo el
  // último cambio de estatus/notas). Se queda NULL para una orden de
  // compra, ya que ese concepto no aplica ahí.
  await db.query(`
    CREATE TABLE IF NOT EXISTS reporte_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporte_id INT NOT NULL,
      tipo_registro VARCHAR(20) NOT NULL,
      identificador VARCHAR(20) NOT NULL,
      rfc VARCHAR(200) NULL,
      estatus_o_concepto VARCHAR(255) NULL,
      monto DECIMAL(12,2) NULL,
      fecha_registro DATETIME NULL,
      atendido_por VARCHAR(100) NULL,
      creado_en DATETIME NOT NULL,
      CONSTRAINT fk_reporte_items_reporte FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE,
      KEY idx_reporte_items_reporte_id (reporte_id),
      KEY idx_reporte_items_tipo_registro (tipo_registro),
      KEY idx_reporte_items_rfc (rfc),
      CONSTRAINT chk_reporte_items_tipo_registro CHECK (tipo_registro IN ('ticket', 'orden_compra'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migración: la tabla "reporte_items" pudo haberse creado ya en una
  // instalación existente con "rfc" del tamaño VIEJO e insuficiente
  // (VARCHAR(13), pensado solo para un RFC) — para una orden de compra
  // ahí se guarda el CORREO del cliente, que fácilmente excede eso y
  // hacía fallar el guardado del reporte con un error de "dato
  // demasiado largo". Se ensancha la columna si todavía tiene el
  // tamaño viejo.
  const [columnasRfcReporteItems] = await db.query(
    `SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_items' AND COLUMN_NAME = 'rfc'`
  );
  if (columnasRfcReporteItems.length > 0 && columnasRfcReporteItems[0].CHARACTER_MAXIMUM_LENGTH < 200) {
    await db.query('ALTER TABLE reporte_items MODIFY COLUMN rfc VARCHAR(200) NULL');
  }

  // Migración: instalaciones que ya tenían "reporte_items" creada antes
  // de que existiera "atendido_por" (quién atendió el ticket).
  const [columnasReporteItems] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reporte_items'`
  );
  const nombresColumnasReporteItems = columnasReporteItems.map((c) => c.COLUMN_NAME);
  if (!nombresColumnasReporteItems.includes('atendido_por')) {
    await db.query('ALTER TABLE reporte_items ADD COLUMN atendido_por VARCHAR(100) NULL');
  }


  // contraseña vive fuera de ADMIN_USERS (el archivo/variable de entorno
  // que ya existía) — sirve como medida de seguridad para no quedar fuera
  // del panel si se pierde el acceso a ese archivo o se te olvida esa
  // contraseña. Se siembra con la contraseña "admin" la primera vez que
  // arranca el backend; después se puede cambiar desde la interfaz gráfica
  // (ver PUT /api/admin/config/admin-password en server.js). Esta regla es
  // exclusiva de esta cuenta — cualquier otro administrador que se cree
  // después (perfil "administrador" o "fiscal" en la tabla usuarios) NO
  // tiene este respaldo: si pierde su contraseña, otro administrador tiene
  // que restablecérsela como a cualquier usuario.
  const [filaAdminFallback] = await db.query(
    "SELECT valor FROM configuracion WHERE clave = 'admin_fallback_password_hash'"
  );
  if (filaAdminFallback.length === 0) {
    await db.query(
      `INSERT INTO configuracion (clave, valor) VALUES ('admin_fallback_password_hash', ?)`,
      [hashPassword('admin')]
    );
    console.log('Cuenta de respaldo "admin" creada con la contraseña por defecto ("admin"). Cámbiala desde el panel de administración.');
  }

  console.log('Esquema de MySQL listo.');
}

module.exports = {
  pool,
  ensureSchema,
  almacenTenant,
  ejecutarComoTenant,
  obtenerPoolTenant,
  cerrarPoolTenant,
  purgarPoolsInactivos,
  cerrarTodosLosPoolsTenant,
  obtenerPoolControl,
};
