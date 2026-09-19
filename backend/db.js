const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2/promise');
const { CATEGORIAS_SEED, ETIQUETAS_SEED, SLUG_CATEGORIA_PROTEGIDA } = require('./utils/gastos');
const {
  UNIDADES_SEED,
  ALMACEN_DEFECTO_CODIGO,
  ALMACEN_DEFECTO_NOMBRE,
} = require('./utils/inventario');

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

// Crea (si no existe) la base de datos física de un tenant nuevo, usando
// las MISMAS credenciales DB_* de aplicación que ya vive montadas en este
// contenedor — nunca root. Solo funciona porque el usuario de aplicación
// ya tiene un GRANT amplio tipo comodín sobre `tenant_%` (otorgado una
// sola vez, con root, por backend/scripts/lib/controlDb.js —
// asegurarControlYPrivilegios — la primera vez que se corrió el CLI de
// aprovisionamiento). Si ese privilegio llegara a faltar (nunca se corrió
// el CLI ni una sola vez, o se revocó a mano), esto falla con un error de
// permisos real de MySQL — degradación esperada, hay que volver al CLI.
// Conexión SUELTA (no un pool): se usa una sola vez y se cierra, la base
// de datos destino todavía no existe así que no se le puede pasar
// `database` a `crearPool()` como al resto de los pools de este módulo.
async function crearBaseDeDatosTenant(dbName) {
  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || 'mysql',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || '',
  });
  try {
    await conexion.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conexion.end();
  }
}

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

  // Catálogo "Clave de Producto o Servicio" (c_ClaveProdServ del SAT) —
  // tabla propia (no la clave-valor genérica de "configuracion") porque el
  // catálogo real tiene ~52,000 filas y necesita buscarse por texto, no
  // guardarse como un solo JSON. Arranca sembrada con un catálogo de
  // EJEMPLO (10 claves reales, ver utils/claveProdServ.js) mientras se
  // confirma una fuente oficial gratuita verificada — mismo criterio de
  // "nunca adivinar un origen externo" que ya usa USO_CFDI_SYNC_URL.
  await db.query(`
    CREATE TABLE IF NOT EXISTS catalogo_clave_prod_serv (
      id INT AUTO_INCREMENT PRIMARY KEY,
      clave VARCHAR(10) NOT NULL,
      descripcion VARCHAR(500) NOT NULL,
      UNIQUE KEY uq_catalogo_clave_prod_serv (clave)
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
  // "Mi Cuenta" (autoservicio de perfil): nombre completo, opcional —
  // ninguna cuenta creada antes de este punto lo tenía, así que empieza
  // NULL/vacío y se completa cuando el propio usuario lo edita.
  if (!nombresColumnasUsuarios.includes('nombre')) {
    await db.query('ALTER TABLE usuarios ADD COLUMN nombre VARCHAR(200) NULL');
  }
  // Recuperación de contraseña: token de un solo uso, se guarda HASHEADO
  // (sha256, ver hashTokenRecuperacion en utils/authUsuario.js) — nunca el
  // token en claro, mismo principio que password_hash. NULL en reposo;
  // se llenan al solicitar recuperación y se limpian al usarse (o al
  // generarse uno nuevo, que sobreescribe el anterior).
  if (!nombresColumnasUsuarios.includes('reset_token_hash')) {
    await db.query('ALTER TABLE usuarios ADD COLUMN reset_token_hash VARCHAR(64) NULL');
  }
  if (!nombresColumnasUsuarios.includes('reset_token_expira')) {
    await db.query('ALTER TABLE usuarios ADD COLUMN reset_token_expira DATETIME NULL');
  }
  // Suspender/activar cuenta (sin borrarla) — aplica a los 4 perfiles.
  // DEFAULT 1: ninguna cuenta ya existente queda suspendida por accidente
  // al agregar esta columna.
  if (!nombresColumnasUsuarios.includes('activo')) {
    await db.query('ALTER TABLE usuarios ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1');
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
       CHECK (perfil IN ('cliente', 'administrador', 'fiscal', 'ventas', 'inventario'))`
    );
  } else {
    // Puntos 190/323 — perfiles "Ventas"/"Inventario": instalaciones que
    // ya tenían el CHECK sin alguno de los dos todavía (mismo patrón que
    // chk_reportes_tipo/chk_gastos_categoria — MySQL no permite
    // "ALTER CHECK", hay que tirarlo y volver a crearlo con la lista
    // completa).
    const [clausulaPerfil] = await db.query(
      `SELECT CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_usuarios_perfil'`
    );
    if (
      clausulaPerfil.length > 0 &&
      (!clausulaPerfil[0].CHECK_CLAUSE.includes('ventas') || !clausulaPerfil[0].CHECK_CLAUSE.includes('inventario'))
    ) {
      await db.query('ALTER TABLE usuarios DROP CHECK chk_usuarios_perfil');
      await db.query(
        `ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_perfil
         CHECK (perfil IN ('cliente', 'administrador', 'fiscal', 'ventas', 'inventario'))`
      );
    }
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
  // Monto de la factura para negocios "solo facturas" (Ventas apagado, sin
  // venta que verificar): al subir el ZIP se intenta leer el Total real
  // del XML del CFDI (ver utils/validate.js:extraerTotalFacturaDeZip); si
  // no se pudo leer, se exige captura manual — nunca queda vacío.
  // "origen" distingue uno de otro porque un valor leído del XML (CFDI ya
  // timbrado) no debe poder corregirse a mano después, a diferencia de uno
  // capturado manualmente.
  if (!nombresColumnasTickets.includes('monto_factura')) {
    await db.query('ALTER TABLE tickets ADD COLUMN monto_factura DECIMAL(12,2) NULL');
  }
  if (!nombresColumnasTickets.includes('monto_factura_origen')) {
    await db.query('ALTER TABLE tickets ADD COLUMN monto_factura_origen VARCHAR(10) NULL');
  }

  const [checksMontoFacturaOrigen] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'
       AND CONSTRAINT_NAME = 'chk_tickets_monto_factura_origen'`
  );
  if (checksMontoFacturaOrigen.length === 0) {
    await db.query(
      `ALTER TABLE tickets ADD CONSTRAINT chk_tickets_monto_factura_origen
       CHECK (monto_factura_origen IS NULL OR monto_factura_origen IN ('xml', 'manual'))`
    );
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
      descuento_porcentaje DECIMAL(5,2) NULL,
      descuento_monto DECIMAL(12,2) NULL,
      email VARCHAR(200) NULL,
      estado_pago ENUM('pagada','pendiente') NOT NULL DEFAULT 'pagada',
      fecha_vencimiento DATE NULL,
      monto_cobrado DECIMAL(12,2) NOT NULL DEFAULT 0,
      fecha_cobro DATETIME NULL,
      notas_cobro TEXT NULL,
      eliminado_en DATETIME NULL,
      archivado_en DATETIME NULL,
      periodo_archivado CHAR(7) NULL,
      creado_por VARCHAR(200) NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_ordenes_compra_numero (numero_compra),
      KEY idx_ordenes_compra_email (email),
      KEY idx_ordenes_compra_eliminado_en (eliminado_en),
      KEY idx_ordenes_compra_archivado_en (archivado_en),
      KEY idx_ordenes_compra_periodo (periodo_archivado),
      KEY idx_ordenes_compra_estado_pago (estado_pago),
      KEY idx_ordenes_compra_vencimiento (fecha_vencimiento),
      CONSTRAINT chk_ordenes_monto_cobrado CHECK (monto_cobrado >= 0)
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

  // Migracion: "email" pasa de NOT NULL a NULL — ahora una venta se puede
  // registrar sin correo (modalidad "Imprimir ticket", ver
  // PROJECT_STATE.md). Ventas ya existentes conservan su correo tal cual,
  // solo se relaja la restriccion para las nuevas filas.
  const [columnaEmailOrdenesCompra] = await db.query(
    `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra' AND COLUMN_NAME = 'email'`
  );
  if (columnaEmailOrdenesCompra.length > 0 && columnaEmailOrdenesCompra[0].IS_NULLABLE === 'NO') {
    await db.query('ALTER TABLE ordenes_compra MODIFY COLUMN email VARCHAR(200) NULL');
  }

  // Migracion: "creado_por" (punto 320) — quién registró la venta, para
  // reportes/aclaraciones (nunca se muestra en Ventas). Instalaciones
  // previas a este punto no tenían la columna. Sin backfill posible: el
  // dato no existía antes, las ventas ya registradas se quedan en NULL.
  if (!nombresColumnasOrdenesCompra.includes('creado_por')) {
    await db.query('ALTER TABLE ordenes_compra ADD COLUMN creado_por VARCHAR(200) NULL');
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

  // Cuentas por cobrar (punto 138): por defecto pagada, opción pendiente
  // con vencimiento/notas y abonos parciales (monto_cobrado). Saldo es
  // derivado total - monto_cobrado, no columna.
  const [colsOrdenCxc] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra'`
  );
  const nombresCxc = colsOrdenCxc.map((c) => c.COLUMN_NAME);
  if (!nombresCxc.includes('estado_pago')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN estado_pago ENUM('pagada','pendiente') NOT NULL DEFAULT 'pagada'`);
    await db.query(`ALTER TABLE ordenes_compra ADD KEY idx_ordenes_compra_estado_pago (estado_pago)`);
  }
  if (!nombresCxc.includes('fecha_vencimiento')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN fecha_vencimiento DATE NULL`);
    await db.query(`ALTER TABLE ordenes_compra ADD KEY idx_ordenes_compra_vencimiento (fecha_vencimiento)`);
  }
  if (!nombresCxc.includes('monto_cobrado')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN monto_cobrado DECIMAL(12,2) NOT NULL DEFAULT 0`);
  }
  if (!nombresCxc.includes('fecha_cobro')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN fecha_cobro DATETIME NULL`);
  }
  if (!nombresCxc.includes('notas_cobro')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN notas_cobro TEXT NULL`);
  }
  const [chkMontoCobrado] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra' AND CONSTRAINT_NAME = 'chk_ordenes_monto_cobrado'`
  );
  if (chkMontoCobrado.length === 0) {
    await db.query(`ALTER TABLE ordenes_compra ADD CONSTRAINT chk_ordenes_monto_cobrado CHECK (monto_cobrado >= 0)`);
  }
  // Backfill: toda venta registrada ANTES de este segmento quedó con
  // estado_pago='pagada' (default correcto) pero monto_cobrado=0
  // (default de la columna nueva, nunca reflejaba lo ya cobrado bajo el
  // modelo viejo de una sola etapa). Sin este backfill, "Cuentas por
  // cobrar" mostraría $0 cobrado en todo el historial. No va dentro del
  // `if (!nombresCxc.includes(...))` de arriba porque esa rama solo
  // corre la primera vez que se crea la columna — en una BD donde la
  // columna ya existía (como esta) nunca se habría ejecutado. Es
  // self-limiting y segura de re-correr: after el primer backfill
  // ninguna fila vuelve a cumplir la condición (una venta 'pagada' con
  // total>0 real nunca queda con monto_cobrado=0 por el flujo normal de
  // POST /ordenes-compra).
  await db.query(
    `UPDATE ordenes_compra
        SET monto_cobrado = total, fecha_cobro = COALESCE(fecha_cobro, creado_en)
      WHERE estado_pago = 'pagada' AND monto_cobrado = 0`
  );

  // Punto 158 — Cierre mensual archivado: ventas y gastos se archivan (no
  // se borran) hacia Reportes. Migración segura para instalaciones ya
  // existentes: agrega archivado_en/periodo_archivado si no existen.
  const [colsArchivadoOrdenes] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra'`
  );
  const nombresArchivadoOrdenes = colsArchivadoOrdenes.map((c) => c.COLUMN_NAME);
  if (!nombresArchivadoOrdenes.includes('archivado_en')) {
    await db.query('ALTER TABLE ordenes_compra ADD COLUMN archivado_en DATETIME NULL');
    await db.query('ALTER TABLE ordenes_compra ADD KEY idx_ordenes_compra_archivado_en (archivado_en)');
  }
  if (!nombresArchivadoOrdenes.includes('periodo_archivado')) {
    await db.query('ALTER TABLE ordenes_compra ADD COLUMN periodo_archivado CHAR(7) NULL');
    await db.query('ALTER TABLE ordenes_compra ADD KEY idx_ordenes_compra_periodo (periodo_archivado)');
  }

  // Bug real corregido (2026-09-02, reportado por el usuario — ver
  // PROJECT_STATE.md): "facturado" se calculaba en vivo con un EXISTS
  // contra `tickets` (estatus='listo') — en cuanto la limpieza automática
  // por retención BORRA el ticket (es efímero a propósito), la venta
  // "perdía" su factura para siempre en Resumen financiero, la insignia
  // de Ventas y el Corte del día, aunque de verdad sí se facturó.
  // `facturado_en` es un hecho histórico PERMANENTE — se fija una sola
  // vez cuando se sube el ZIP de la factura (POST /tickets/:id/factura),
  // nunca se borra ni se toca de nuevo (ni la retención de tickets ni el
  // cierre mensual lo tocan).
  const [colsFacturadoOrdenes] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra'`
  );
  if (!colsFacturadoOrdenes.map((c) => c.COLUMN_NAME).includes('facturado_en')) {
    await db.query('ALTER TABLE ordenes_compra ADD COLUMN facturado_en DATETIME NULL');
    await db.query('ALTER TABLE ordenes_compra ADD KEY idx_ordenes_compra_facturado_en (facturado_en)');
  }
  // Backfill idempotente: recupera lo que todavía se pueda recuperar —
  // solo alcanza a las órdenes cuyo ticket 'listo' SIGUE existiendo hoy
  // (no purgado por la retención). Lo ya purgado antes de este fix quedó
  // perdido para siempre (el archivo de auditoría de tickets purgados no
  // guarda el id de la orden de compra, solo el folio del ticket — sin
  // vínculo posible). El WHERE evita re-tocar filas ya marcadas, seguro
  // de re-correr.
  await db.query(
    `UPDATE ordenes_compra o
       JOIN tickets t ON t.orden_compra_id = o.id AND t.estatus = 'listo' AND t.eliminado_en IS NULL
        SET o.facturado_en = COALESCE(o.facturado_en, t.actualizado_en, t.creado_en)
      WHERE o.facturado_en IS NULL`
  );

  // D8 (Inventarios, inventarios.md §22, segmento 4): venta con producto
  // opcional. `producto_id` referencia `productos.id` PERO SIN
  // `CONSTRAINT FOREIGN KEY` a propósito — la tabla `productos` se crea
  // más abajo en este mismo ensureSchema() (bloque de Inventarios), así
  // que un FK aquí fallaría en una base de datos nueva por orden de
  // creación; la pertenencia al tenant y la existencia del producto ya
  // se validan en la aplicación (mismo criterio que
  // `preferencias_dashboard`, que tampoco usa FK). `producto_cantidad`
  // es la cantidad de UNIDADES del producto vendidas — un campo
  // completamente distinto de `cantidad` (que es el monto en MXN de la
  // venta, columna preexistente, nunca se renombra).
  const [colsOrdenProducto] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes_compra'`
  );
  const nombresOrdenProducto = colsOrdenProducto.map((c) => c.COLUMN_NAME);
  if (!nombresOrdenProducto.includes('producto_id')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN producto_id INT NULL`);
    await db.query(`ALTER TABLE ordenes_compra ADD KEY idx_ordenes_compra_producto (producto_id)`);
  }
  if (!nombresOrdenProducto.includes('producto_cantidad')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN producto_cantidad DECIMAL(12,3) NULL`);
  }

  // Punto 227: descuento opcional por porcentaje, aplicado sobre el
  // subtotal ANTES del IVA (mismo criterio que el nodo "Descuento" de un
  // CFDI). `cantidad` sigue siendo el subtotal NETO ya con el descuento
  // aplicado — se preserva el invariante `total = cantidad*(1+iva%)` que
  // ya usan Resumen financiero/Cuentas por cobrar/Corte del día/
  // facturación, así que ninguno de ellos necesita cambios. Las 2
  // columnas son solo para reconstruir la línea "Descuento" en el
  // ticket/correo/detalle sin tener que derivarla (evita el caso límite
  // de dividir entre cero con un descuento del 100%). Ambas NULL = sin
  // descuento, retrocompatible con toda venta ya existente.
  if (!nombresOrdenProducto.includes('descuento_porcentaje')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN descuento_porcentaje DECIMAL(5,2) NULL`);
  }
  if (!nombresOrdenProducto.includes('descuento_monto')) {
    await db.query(`ALTER TABLE ordenes_compra ADD COLUMN descuento_monto DECIMAL(12,2) NULL`);
  }

  // orden_productos (Segmento A, "Ventas con inventario activo" —
  // permite varias líneas de inventario por venta). producto_id/
  // producto_cantidad de arriba quedan congeladas para el historial de
  // ventas de una sola línea y ya no se vuelven a escribir; esta tabla es
  // la que soporta 1 o más líneas desde este segmento en adelante. Las
  // líneas MANUALES (sin producto de catálogo) siguen sin guardarse
  // estructuradas, igual que siempre — solo viven en el texto de
  // `concepto`. Sin `CONSTRAINT FOREIGN KEY`, mismo motivo que arriba
  // (orden de creación de tablas en una base nueva: `productos` se crea
  // más abajo en este mismo ensureSchema()).
  await db.query(`
    CREATE TABLE IF NOT EXISTS orden_productos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orden_id INT NOT NULL,
      producto_id INT NOT NULL,
      cantidad DECIMAL(12,3) NOT NULL,
      creado_en DATETIME NOT NULL,
      KEY idx_orden_productos_orden (orden_id),
      KEY idx_orden_productos_producto (producto_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Gastos de la operación (módulo "Gastos", ver PROJECT_STATE.md):
  // control administrativo/financiero de egresos, con o sin factura/CFDI.
  // NO es un sistema contable — se guarda el monto tal cual se pagó y un
  // indicador de si vino con factura, pero no se desglosa IVA ni se hace
  // ninguna contabilidad. `fecha` es la fecha del gasto (DATE, sin hora,
  // la hora no aporta nada a este control). `categoria` es un slug de la
  // lista cerrada de backend/utils/gastos.js (Renta, Nómina, Software,
  // Hosting, Servicios, Papelería, Combustible, Viáticos, Publicidad,
  // Otro). `tiene_factura` distingue desde el origen un gasto con factura
  // de uno sin ella; si es true, opcionalmente se puede adjuntar el
  // comprobante (PDF o ZIP con PDF+XML, ver POST
  // /api/admin/gastos/:id/comprobante en server.js). `recurrente` es una
  // simple etiqueta sí/no (no hay programación de pagos). Borrado
  // lógico con `eliminado_en` (papelera), mismo patrón que tickets y
  // constancias.
  await db.query(`
    CREATE TABLE IF NOT EXISTS gastos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fecha DATE NOT NULL,
      concepto VARCHAR(200) NOT NULL,
      proveedor VARCHAR(150) NULL,
      categoria VARCHAR(50) NOT NULL,
      monto DECIMAL(12,2) NOT NULL,
      iva_incluido TINYINT(1) NOT NULL DEFAULT 0,
      tiene_factura TINYINT(1) NOT NULL DEFAULT 0,
      comprobante_nombre_original VARCHAR(255) NULL,
      comprobante_nombre_guardado VARCHAR(255) NULL,
      comprobante_mime VARCHAR(100) NULL,
      recurrente TINYINT(1) NOT NULL DEFAULT 0,
      notas TEXT NULL,
      creado_por VARCHAR(100) NULL,
      eliminado_en DATETIME NULL,
      archivado_en DATETIME NULL,
      periodo_archivado CHAR(7) NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      KEY idx_gastos_fecha (fecha),
      KEY idx_gastos_categoria (categoria),
      KEY idx_gastos_tiene_factura (tiene_factura),
      KEY idx_gastos_eliminado_en (eliminado_en),
      KEY idx_gastos_archivado_en (archivado_en),
      KEY idx_gastos_periodo (periodo_archivado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Punto 158 — Cierre mensual: gastos también se archivan. Migración para
  // instalaciones ya existentes.
  const [colsArchivadoGastos] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gastos'`
  );
  const nombresArchivadoGastos = colsArchivadoGastos.map((c) => c.COLUMN_NAME);
  if (!nombresArchivadoGastos.includes('archivado_en')) {
    await db.query('ALTER TABLE gastos ADD COLUMN archivado_en DATETIME NULL');
    await db.query('ALTER TABLE gastos ADD KEY idx_gastos_archivado_en (archivado_en)');
  }
  if (!nombresArchivadoGastos.includes('periodo_archivado')) {
    await db.query('ALTER TABLE gastos ADD COLUMN periodo_archivado CHAR(7) NULL');
    await db.query('ALTER TABLE gastos ADD KEY idx_gastos_periodo (periodo_archivado)');
  }

  // El CHECK de categoría se agrega aparte (mismo patrón que los demás
  // CHECK de este esquema) y se mantiene al día con la lista actual de
  // backend/utils/gastos.js. Migración: instalaciones de antes de este
  // segmento tienen un CHECK `chk_gastos_categoria` fijando la lista —
  // se quita si sigue existiendo, ya que la validación ahora vive en la
  // tabla `categorias_gastos` de abajo, no en un CHECK estático.
  const [checkViejoGastos] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'gastos'
       AND CONSTRAINT_NAME = 'chk_gastos_categoria'`
  );
  if (checkViejoGastos.length > 0) {
    await db.query('ALTER TABLE gastos DROP CHECK chk_gastos_categoria');
  }

  // Categorías de gastos — EDITABLES desde el panel (ver PROJECT_STATE.md,
  // segmento "Categorías editables"): antes era una lista cerrada en
  // código + un CHECK de MySQL, ahora es esta tabla. `slug` es lo que
  // sigue viviendo en `gastos.categoria` y NUNCA cambia una vez creado
  // (renombrar una categoría solo actualiza `etiqueta`) — así un gasto ya
  // guardado nunca queda huérfano de su categoría. `activa=0` es un
  // borrado lógico ligero: la categoría deja de ofrecerse para altas
  // NUEVAS pero los gastos que ya la usan la conservan tal cual (no hay
  // papelera propia, a diferencia de gastos/tickets/constancias, porque
  // no hay nada que "restaurar": solo se desactiva cuando ya tiene gastos
  // asociados, nunca se borra de verdad en ese caso — ver
  // POST/PUT/DELETE /api/admin/gastos/categorias en server.js).
  // `protegida=1` (solo "otro") no se puede renombrar ni desactivar/
  // borrar: es el color/etiqueta de respaldo de toda la gráfica de
  // "Distribución de gastos por categoría" en Resumen financiero.
  await db.query(`
    CREATE TABLE IF NOT EXISTS categorias_gastos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(50) NOT NULL,
      etiqueta VARCHAR(100) NOT NULL,
      activa TINYINT(1) NOT NULL DEFAULT 1,
      protegida TINYINT(1) NOT NULL DEFAULT 0,
      orden INT NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_categorias_gastos_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migración: `tipo` (fijo/variable) — pedido del usuario para la tarjeta
  // "Distribución de gastos por categoría" (KPI "Gastos Variables/
  // Flexibles" del modal ampliado, homologado con
  // stitch/distribución_de_gastos_por_categoría_ux_redesign). Default
  // 'variable' — más categorías reales (publicidad/combustible/software/
  // viáticos/hosting/servicios/papeleria/otro) son variables que fijas
  // (solo nómina/renta), así que el default no deja "fijo" mal clasificado
  // por accidente en categorías nuevas que el admin no haya tocado.
  const [columnasCategoriasGastos] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_gastos'`
  );
  const nombresColumnasCategoriasGastos = columnasCategoriasGastos.map((c) => c.COLUMN_NAME);
  if (!nombresColumnasCategoriasGastos.includes('tipo')) {
    await db.query(
      "ALTER TABLE categorias_gastos ADD COLUMN tipo ENUM('fijo','variable') NOT NULL DEFAULT 'variable'"
    );
    // Backfill honesto de las 2 categorías sembradas que sí son
    // predecibles como fijas (nómina/renta) — el resto se queda en el
    // default 'variable', el admin puede corregir desde el editor.
    await db.query("UPDATE categorias_gastos SET tipo = 'fijo' WHERE slug IN ('nomina', 'renta')");
  }

  // Semilla idempotente: solo inserta los slugs que todavía no existan
  // (una instalación ya usada puede tener gastos con estos 10 slugs, así
  // que se siembran SIEMPRE con el mismo slug de antes — nunca se
  // regeneran ni se tocan si ya existen).
  const [slugsExistentes] = await db.query('SELECT slug FROM categorias_gastos');
  const slugsYaSembrados = new Set(slugsExistentes.map((f) => f.slug));
  const faltantes = CATEGORIAS_SEED.filter((slug) => !slugsYaSembrados.has(slug));
  if (faltantes.length > 0) {
    const ahoraSemilla = new Date();
    const valores = faltantes.map((slug, indice) => [
      slug,
      ETIQUETAS_SEED[slug] || slug,
      1,
      slug === SLUG_CATEGORIA_PROTEGIDA ? 1 : 0,
      CATEGORIAS_SEED.indexOf(slug),
      ahoraSemilla,
      ahoraSemilla,
    ]);
    await db.query(
      'INSERT INTO categorias_gastos (slug, etiqueta, activa, protegida, orden, creado_en, actualizado_en) VALUES ?',
      [valores]
    );
  }

  // ---------------------------------------------------------------------
  // Inventarios — motor de existencias v1 (ver inventarios.md §0.2-§0.7).
  // Solo el núcleo mínimo: catálogo simple (D1), un almacén auto-
  // provisionado (D2), existencias derivadas de un libro append-only
  // (D6), costeo por promedio ponderado (D5). El detalle de concurrencia
  // (bloqueo de fila, lock de costo_promedio, idempotencia) vive en
  // backend/utils/inventario.js — este bloque solo crea el esquema.
  // ---------------------------------------------------------------------

  await db.query(`
    CREATE TABLE IF NOT EXISTS unidades_medida (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL,
      abreviatura VARCHAR(10) NOT NULL,
      permite_decimales TINYINT(1) NOT NULL DEFAULT 1,
      creado_en DATETIME NOT NULL,
      UNIQUE KEY uq_unidades_medida_nombre (nombre)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Migración: instalaciones que ya tenían "unidades_medida" creada antes
  // de "permite_decimales" (punto 175 — cantidad entera vs. decimal según
  // la unidad al vender/mover inventario).
  const [colsUnidadesMedida] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unidades_medida'`
  );
  if (!colsUnidadesMedida.map((c) => c.COLUMN_NAME).includes('permite_decimales')) {
    await db.query('ALTER TABLE unidades_medida ADD COLUMN permite_decimales TINYINT(1) NOT NULL DEFAULT 1');
  }

  // Semilla idempotente de las 16 unidades de §9 (pieza, volumen, peso —
  // cubren líquidos y gramaje sin campos adicionales, decisión D11).
  const [unidadesExistentes] = await db.query('SELECT nombre FROM unidades_medida');
  const nombresUnidadesExistentes = new Set(unidadesExistentes.map((f) => f.nombre));
  const unidadesFaltantes = UNIDADES_SEED.filter(([nombre]) => !nombresUnidadesExistentes.has(nombre));
  if (unidadesFaltantes.length > 0) {
    const ahoraUnidades = new Date();
    await db.query('INSERT INTO unidades_medida (nombre, abreviatura, permite_decimales, creado_en) VALUES ?', [
      unidadesFaltantes.map(([nombre, abreviatura, permiteDecimales]) => [nombre, abreviatura, permiteDecimales, ahoraUnidades]),
    ]);
  }
  // Backfill idempotente: instalaciones que ya tenían las 16 unidades
  // sembradas ANTES de esta columna las tienen todas en el default 1
  // (permite decimales) — se corrige a la clasificación real de
  // UNIDADES_SEED, por nombre, sin tocar unidades personalizadas que el
  // usuario haya agregado a mano (esas se quedan en el default).
  for (const [nombre, , permiteDecimales] of UNIDADES_SEED) {
    // eslint-disable-next-line no-await-in-loop
    await db.query('UPDATE unidades_medida SET permite_decimales = ? WHERE nombre = ? AND permite_decimales <> ?', [
      permiteDecimales,
      nombre,
      permiteDecimales,
    ]);
  }

  // Conversiones configurables entre unidades (§9) — datos puros en v1,
  // no consumidas todavía por el motor de movimientos (que siempre
  // registra en la unidad propia del producto); preparado para cuando
  // una fase futura decida usarlas en captura de compra/venta.
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversiones_unidad (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unidad_origen_id INT NOT NULL,
      unidad_destino_id INT NOT NULL,
      factor DECIMAL(14,6) NOT NULL,
      creado_en DATETIME NOT NULL,
      UNIQUE KEY uq_conversion_par (unidad_origen_id, unidad_destino_id),
      CONSTRAINT fk_conversion_origen FOREIGN KEY (unidad_origen_id) REFERENCES unidades_medida(id),
      CONSTRAINT fk_conversion_destino FOREIGN KEY (unidad_destino_id) REFERENCES unidades_medida(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Categorías de Inventarios — plano, sin jerarquía ni imagen en v1
  // (§10, P8 cerrada). Empieza vacía (a diferencia de categorias_gastos,
  // que sí trae una semilla fija): el catálogo de categorías de un
  // negocio es demasiado variable para adivinar una lista de fábrica.
  await db.query(`
    CREATE TABLE IF NOT EXISTS categorias_inventario (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(60) NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      activa TINYINT(1) NOT NULL DEFAULT 1,
      orden INT NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_categorias_inventario_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Almacenes — v1 solo opera ALM-1 (D2): multi-almacén preparado en el
  // esquema (almacen_id NOT NULL en existencias/movimientos) pero sin
  // ABML ni UI de selección todavía (Fase 2, §11).
  await db.query(`
    CREATE TABLE IF NOT EXISTS almacenes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(20) NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      creado_en DATETIME NOT NULL,
      UNIQUE KEY uq_almacenes_codigo (codigo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [almacenDefecto] = await db.query('SELECT id FROM almacenes WHERE codigo = ? LIMIT 1', [
    ALMACEN_DEFECTO_CODIGO,
  ]);
  if (almacenDefecto.length === 0) {
    await db.query('INSERT INTO almacenes (codigo, nombre, creado_en) VALUES (?, ?, ?)', [
      ALMACEN_DEFECTO_CODIGO,
      ALMACEN_DEFECTO_NOMBRE,
      new Date(),
    ]);
  }

  // Catálogo (D1: producto simple, sin variantes/lote/serie/caducidad).
  // `tipo` distingue producto físico de servicio (D11: un servicio no
  // genera existencias/movimientos/kardex). `costo_promedio`/
  // `ultimo_costo` los mantiene ÚNICAMENTE registrarMovimiento() al
  // procesar una entrada (D5) — nunca se editan a mano desde un CRUD.
  // `extra` (JSON) es el campo de aterrizaje del importador masivo (D9,
  // §34.4) para columnas migradas que todavía no tienen campo formal.
  await db.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sku VARCHAR(60) NOT NULL,
      codigo_barras VARCHAR(60) NULL,
      nombre VARCHAR(200) NOT NULL,
      categoria_id INT NULL,
      unidad_id INT NOT NULL,
      tipo VARCHAR(20) NOT NULL DEFAULT 'producto',
      costo DECIMAL(12,2) NULL,
      costo_promedio DECIMAL(12,2) NOT NULL DEFAULT 0,
      ultimo_costo DECIMAL(12,2) NULL,
      precio DECIMAL(12,2) NULL,
      stock_minimo DECIMAL(12,3) NULL,
      stock_maximo DECIMAL(12,3) NULL,
      punto_reorden DECIMAL(12,3) NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'activo',
      proveedor_principal VARCHAR(200) NULL,
      fecha_expiracion DATE NULL,
      notas TEXT NULL,
      extra JSON NULL,
      imagen_key VARCHAR(255) NULL,
      imagen_thumb_key VARCHAR(255) NULL,
      imagen_actualizada_en DATETIME NULL,
      eliminado_en DATETIME NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_productos_sku (sku),
      UNIQUE KEY uq_productos_codigo_barras (codigo_barras),
      KEY idx_productos_estado (estado),
      KEY idx_productos_categoria (categoria_id),
      CONSTRAINT fk_productos_unidad FOREIGN KEY (unidad_id) REFERENCES unidades_medida(id),
      CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_inventario(id),
      CONSTRAINT chk_productos_tipo CHECK (tipo IN ('producto', 'servicio')),
      CONSTRAINT chk_productos_estado CHECK (estado IN ('activo', 'inactivo', 'archivado'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Punto 179: backfill idempotente — cualquier servicio que ya exista
  // (nunca en producción real hoy, solo posible en tenants de prueba)
  // queda sin código de barras/stock mínimo/stock máximo/punto de
  // reorden, igual que exige ahora validarCuerpoProducto() para altas y
  // ediciones nuevas. El WHERE evita tocar filas que ya cumplen, para
  // que sea seguro re-correr — CORRE EN CADA ensureSchema() (cada
  // restart/deploy), no solo una vez.
  //
  // [Servicio en paquete]: la unidad solo se fuerza a "Hora" si la
  // unidad actual NO es una de las 2 válidas para servicio ("Hora" o
  // "Paquete", ver UNIDADES_SERVICIO_VALIDAS en utils/inventario.js).
  // Antes este UPDATE forzaba "Hora" sin condición — con una 2da unidad
  // de servicio válida, eso habría revertido a "Hora" cualquier
  // servicio guardado como "Paquete" en el siguiente restart, en
  // silencio, sin error visible.
  await db.query(
    `UPDATE productos p
       LEFT JOIN unidades_medida up ON up.id = p.unidad_id
       JOIN unidades_medida uh ON uh.nombre = 'Hora'
        SET p.codigo_barras = NULL, p.stock_minimo = NULL, p.stock_maximo = NULL,
            p.punto_reorden = NULL,
            p.unidad_id = IF(up.nombre IN ('Hora', 'Paquete'), p.unidad_id, uh.id)
      WHERE p.tipo = 'servicio'
        AND (p.codigo_barras IS NOT NULL OR p.stock_minimo IS NOT NULL OR p.stock_maximo IS NOT NULL
             OR p.punto_reorden IS NOT NULL OR up.nombre IS NULL OR up.nombre NOT IN ('Hora', 'Paquete'))`
  );

  // Punto 213: fecha de expiración opcional, POR PRODUCTO (no por lote —
  // decisión explícita del usuario, este esquema no tiene concepto de
  // lotes/remesas). Nunca aplica a servicios (mismo criterio que stock
  // mínimo/máximo/punto de reorden arriba).
  const [colsFechaExpiracion] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos'`
  );
  if (!colsFechaExpiracion.map((c) => c.COLUMN_NAME).includes('fecha_expiracion')) {
    await db.query('ALTER TABLE productos ADD COLUMN fecha_expiracion DATE NULL');
    await db.query('ALTER TABLE productos ADD KEY idx_productos_fecha_expiracion (fecha_expiracion)');
  }
  await db.query(
    `UPDATE productos SET fecha_expiracion = NULL WHERE tipo = 'servicio' AND fecha_expiracion IS NOT NULL`
  );

  // Existencias — D6: granularidad producto×almacén, saldo DERIVADO del
  // libro de movimientos (nunca editable a mano). `eliminado_en` existe
  // por simetría con el resto del esquema y para que el bloqueo de fila
  // de registrarMovimiento() pueda filtrar por él (§0.5.B) — en v1 nunca
  // se escribe (no hay flujo que borre una existencia).
  await db.query(`
    CREATE TABLE IF NOT EXISTS existencias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      producto_id INT NOT NULL,
      almacen_id INT NOT NULL,
      disponible DECIMAL(12,3) NOT NULL DEFAULT 0,
      eliminado_en DATETIME NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_existencias_producto_almacen (producto_id, almacen_id),
      CONSTRAINT fk_existencias_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
      CONSTRAINT fk_existencias_almacen FOREIGN KEY (almacen_id) REFERENCES almacenes(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Kardex — libro append-only (§14, §48 regla 2): ningún flujo debe
  // hacer UPDATE/DELETE sobre una fila ya confirmada, únicamente
  // registrarMovimiento() en utils/inventario.js inserta aquí. `folio`
  // es NULL brevemente entre el INSERT y el UPDATE que lo fija (mismo
  // patrón insertar→generar→actualizar que ya usa OC-/TK-).
  // `documento_origen` referencia, por ejemplo, el "No. Venta" (OC-...)
  // cuando el movimiento viene de una venta con inventario activo (D8).
  await db.query(`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INT AUTO_INCREMENT PRIMARY KEY,
      folio VARCHAR(20) NULL,
      producto_id INT NOT NULL,
      almacen_id INT NOT NULL,
      tipo VARCHAR(30) NOT NULL,
      cantidad DECIMAL(12,3) NOT NULL,
      costo_unitario DECIMAL(12,2) NULL,
      existencia_anterior DECIMAL(12,3) NOT NULL,
      existencia_posterior DECIMAL(12,3) NOT NULL,
      motivo VARCHAR(255) NULL,
      notas TEXT NULL,
      ubicacion_nota VARCHAR(255) NULL,
      documento_origen VARCHAR(50) NULL,
      usuario VARCHAR(100) NULL,
      creado_en DATETIME NOT NULL,
      UNIQUE KEY uq_movimientos_folio (folio),
      KEY idx_movimientos_producto_almacen (producto_id, almacen_id),
      KEY idx_movimientos_tipo (tipo),
      KEY idx_movimientos_documento_origen (documento_origen),
      CONSTRAINT fk_movimientos_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
      CONSTRAINT fk_movimientos_almacen FOREIGN KEY (almacen_id) REFERENCES almacenes(id),
      CONSTRAINT chk_movimientos_tipo CHECK (tipo IN (
        'compra', 'devolucion_cliente', 'inventario_inicial', 'ajuste_positivo',
        'venta', 'consumo_interno', 'merma', 'ajuste_negativo'
      ))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // §57: tipo de cambio para productos en moneda extranjera. `moneda` vive
  // en el producto (alcance por producto, decisión cerrada 2026-08-26);
  // `moneda_original`/`tipo_cambio`/`costo_original` en el movimiento
  // (histórico "gratis" dentro del libro append-only ya existente, D6) —
  // solo las entradas de un producto en USD los llenan, `costo_unitario`
  // (ya en pesos) sigue siendo la única fuente que usa el costeo
  // promedio ponderado (D5), sin cambios en esa lógica.
  const [columnasProductos] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos'`
  );
  const nombresColumnasProductos = columnasProductos.map((c) => c.COLUMN_NAME);
  if (!nombresColumnasProductos.includes('moneda')) {
    await db.query("ALTER TABLE productos ADD COLUMN moneda VARCHAR(3) NOT NULL DEFAULT 'MXN'");
  }
  const [checkMonedaProducto] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'productos'
       AND CONSTRAINT_NAME = 'chk_productos_moneda'`
  );
  if (checkMonedaProducto.length === 0) {
    await db.query(
      `ALTER TABLE productos ADD CONSTRAINT chk_productos_moneda CHECK (moneda IN ('MXN', 'USD'))`
    );
  }

  // Punto 159, Segmento B: imagen principal de producto (recorte de
  // inventarios.md D10/US-INV-002 — solo 1 imagen por producto en v1,
  // galería multi-imagen queda para un segmento posterior). Las 2 keys
  // apuntan a MinIO (`inventarios/<slug>/productos/<id>/principal.webp`
  // y `.../thumb_principal.webp`); nunca el archivo original.
  if (!nombresColumnasProductos.includes('imagen_key')) {
    await db.query('ALTER TABLE productos ADD COLUMN imagen_key VARCHAR(255) NULL');
  }
  if (!nombresColumnasProductos.includes('imagen_thumb_key')) {
    await db.query('ALTER TABLE productos ADD COLUMN imagen_thumb_key VARCHAR(255) NULL');
  }
  if (!nombresColumnasProductos.includes('imagen_actualizada_en')) {
    await db.query('ALTER TABLE productos ADD COLUMN imagen_actualizada_en DATETIME NULL');
  }

  const [columnasMovimientos] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'movimientos_inventario'`
  );
  const nombresColumnasMovimientos = columnasMovimientos.map((c) => c.COLUMN_NAME);
  if (!nombresColumnasMovimientos.includes('moneda_original')) {
    await db.query('ALTER TABLE movimientos_inventario ADD COLUMN moneda_original VARCHAR(3) NULL');
  }
  if (!nombresColumnasMovimientos.includes('tipo_cambio')) {
    await db.query('ALTER TABLE movimientos_inventario ADD COLUMN tipo_cambio DECIMAL(10,4) NULL');
  }
  if (!nombresColumnasMovimientos.includes('costo_original')) {
    await db.query('ALTER TABLE movimientos_inventario ADD COLUMN costo_original DECIMAL(12,4) NULL');
  }
  const [checkMonedaMovimiento] = await db.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'movimientos_inventario'
       AND CONSTRAINT_NAME = 'chk_movimientos_moneda_original'`
  );
  if (checkMonedaMovimiento.length === 0) {
    await db.query(
      `ALTER TABLE movimientos_inventario ADD CONSTRAINT chk_movimientos_moneda_original
       CHECK (moneda_original IS NULL OR moneda_original IN ('MXN', 'USD'))`
    );
  }

  // Idempotencia (§0.5.E): una fila por Idempotency-Key recibida en una
  // mutación de stock. `respuesta_json` queda NULL mientras la operación
  // está en vuelo (placeholder reclamado por el INSERT único dentro de
  // la misma transacción del movimiento) y se llena justo antes del
  // COMMIT — ver registrarMovimiento(). TTL 24h, purgado por
  // purgarIdempotenciaVencida().
  await db.query(`
    CREATE TABLE IF NOT EXISTS inv_idempotencia (
      id INT AUTO_INCREMENT PRIMARY KEY,
      idempotency_key VARCHAR(64) NOT NULL,
      respuesta_json JSON NULL,
      creado_en DATETIME NOT NULL,
      UNIQUE KEY uq_inv_idempotencia_key (idempotency_key),
      KEY idx_inv_idempotencia_creado_en (creado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Importador masivo CSV/XLSX (§34, decisión D9, segmento 5). Una fila por
  // corrida de importación; el archivo original vive en MinIO
  // (storage_key) para auditoría/reprocesamiento — 34.9 fija su retención
  // en 365 días, esta fila de metadatos permanece como registro histórico
  // aunque el archivo original ya se haya purgado.
  await db.query(`
    CREATE TABLE IF NOT EXISTS imp_importaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      formato VARCHAR(10) NOT NULL,
      nombre_original VARCHAR(255) NOT NULL,
      storage_key VARCHAR(500) NULL,
      hoja VARCHAR(100) NULL,
      fila_encabezados INT NOT NULL DEFAULT 1,
      encoding_usado VARCHAR(20) NULL,
      delimitador VARCHAR(5) NULL,
      cabeceras_json JSON NULL,
      mapeo_json JSON NULL,
      modo_errores VARCHAR(20) NOT NULL DEFAULT 'tolerante',
      sobrescribir_vacios TINYINT(1) NOT NULL DEFAULT 0,
      conservar_extra TINYINT(1) NOT NULL DEFAULT 1,
      estado VARCHAR(30) NOT NULL DEFAULT 'validando',
      total_filas INT NOT NULL DEFAULT 0,
      filas_ok INT NOT NULL DEFAULT 0,
      filas_error INT NOT NULL DEFAULT 0,
      progreso INT NOT NULL DEFAULT 0,
      productos_creados INT NOT NULL DEFAULT 0,
      productos_actualizados INT NOT NULL DEFAULT 0,
      idempotency_key VARCHAR(64) NULL,
      usuario VARCHAR(100) NULL,
      ip VARCHAR(64) NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      UNIQUE KEY uq_imp_importaciones_idempotency (idempotency_key),
      KEY idx_imp_importaciones_estado (estado),
      CONSTRAINT chk_imp_importaciones_formato CHECK (formato IN ('csv', 'xlsx')),
      CONSTRAINT chk_imp_importaciones_modo CHECK (modo_errores IN ('tolerante', 'estricto')),
      CONSTRAINT chk_imp_importaciones_estado CHECK (estado IN (
        'validando', 'validado', 'error_validacion', 'ejecutando', 'completada', 'error'
      ))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Detalle de cada rechazo — respalda la tabla en pantalla y el
  // errores-importacion.csv descargable (§34.5).
  await db.query(`
    CREATE TABLE IF NOT EXISTS imp_importacion_errores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      importacion_id INT NOT NULL,
      fila INT NOT NULL,
      columna VARCHAR(150) NULL,
      valor TEXT NULL,
      motivo VARCHAR(500) NOT NULL,
      creado_en DATETIME NOT NULL,
      KEY idx_imp_errores_importacion (importacion_id),
      CONSTRAINT fk_imp_errores_importacion FOREIGN KEY (importacion_id) REFERENCES imp_importaciones(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Perfiles de mapeo guardados por tenant (§34.3.2) — reexportaciones
  // periódicas del mismo formato llegan pre-mapeadas al paso 3 sin
  // remapear a mano cada vez. `firma_cabeceras` es un hash del set
  // ORDENADO de cabeceras normalizadas (ver firmaCabeceras() en
  // utils/inventarioImportacion.js).
  await db.query(`
    CREATE TABLE IF NOT EXISTS inv_perfiles_mapeo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      firma_cabeceras VARCHAR(64) NOT NULL,
      mapeo_json JSON NOT NULL,
      creado_por VARCHAR(100) NULL,
      creado_en DATETIME NOT NULL,
      usado_ultima_vez DATETIME NULL,
      KEY idx_inv_perfiles_firma (firma_cabeceras)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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
      total_gastos INT NOT NULL DEFAULT 0,
      total_monto DECIMAL(12,2) NULL,
      md_contenido LONGTEXT NOT NULL,
      creado_en DATETIME NOT NULL,
      KEY idx_reportes_fecha_generacion (fecha_generacion),
      CONSTRAINT chk_reportes_tipo CHECK (tipo IN ('automatico', 'manual', 'cierre_mensual', 'corte'))
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
      categoria VARCHAR(50) NULL,
      accion VARCHAR(20) NULL,
      creado_en DATETIME NOT NULL,
      CONSTRAINT fk_reporte_items_reporte FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE,
      KEY idx_reporte_items_reporte_id (reporte_id),
      KEY idx_reporte_items_tipo_registro (tipo_registro),
      KEY idx_reporte_items_rfc (rfc),
      CONSTRAINT chk_reporte_items_tipo_registro CHECK (tipo_registro IN ('ticket', 'orden_compra', 'gasto'))
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
  // Migración: instalaciones que ya tenían "reporte_items" antes de
  // "accion" — distingue un registro que de verdad se eliminó (retención
  // automática, o "Eliminar" una orden de compra) de uno que solo
  // aparece en una fotografía manual ("Enviar reporte", que no borra
  // nada) — ver "Lectura de reportes" en el frontend, badge "Eliminado".
  if (!nombresColumnasReporteItems.includes('accion')) {
    await db.query('ALTER TABLE reporte_items ADD COLUMN accion VARCHAR(20) NULL');
  }
  // Punto 158 — Cierre mensual: gastos necesita su categoría en el snapshot.
  // Se guarda en una columna propia `categoria` (nullable) para no mezclar
  // semántica con `atendido_por` (que en gastos no aplica).
  if (!nombresColumnasReporteItems.includes('categoria')) {
    await db.query('ALTER TABLE reporte_items ADD COLUMN categoria VARCHAR(50) NULL');
  }

  // Punto 158 — Cierre mensual: reportes 'cierre_mensual' y tipo 'gasto'.
  // Migraciones para instalaciones que ya tienen las tablas con CHECK viejo.
  const [chkReportesTipo] = await db.query(
    `SELECT CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_reportes_tipo'`
  );
  if (chkReportesTipo.length > 0 && !chkReportesTipo[0].CHECK_CLAUSE.includes('cierre_mensual')) {
    await db.query('ALTER TABLE reportes DROP CHECK chk_reportes_tipo');
    await db.query(`ALTER TABLE reportes ADD CONSTRAINT chk_reportes_tipo CHECK (tipo IN ('automatico', 'manual', 'cierre_mensual', 'corte'))`);
  } else if (chkReportesTipo.length > 0 && !chkReportesTipo[0].CHECK_CLAUSE.includes('corte')) {
    // Punto 168 — "Corte del día" en Ventas: instalaciones que ya tenían
    // el CHECK con 'cierre_mensual' pero sin 'corte' todavía.
    await db.query('ALTER TABLE reportes DROP CHECK chk_reportes_tipo');
    await db.query(`ALTER TABLE reportes ADD CONSTRAINT chk_reportes_tipo CHECK (tipo IN ('automatico', 'manual', 'cierre_mensual', 'corte'))`);
  }
  const [chkReporteItemsTipo] = await db.query(
    `SELECT CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_reporte_items_tipo_registro'`
  );
  if (chkReporteItemsTipo.length > 0 && !chkReporteItemsTipo[0].CHECK_CLAUSE.includes('gasto')) {
    await db.query('ALTER TABLE reporte_items DROP CHECK chk_reporte_items_tipo_registro');
    await db.query(`ALTER TABLE reporte_items ADD CONSTRAINT chk_reporte_items_tipo_registro CHECK (tipo_registro IN ('ticket', 'orden_compra', 'gasto'))`);
  }
  // Migración: reportes con instalaciones viejas no tienen total_gastos.
  const [colsReportes] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reportes'`
  );
  const nombresReportes = colsReportes.map((c) => c.COLUMN_NAME);
  if (!nombresReportes.includes('total_gastos')) {
    await db.query('ALTER TABLE reportes ADD COLUMN total_gastos INT NOT NULL DEFAULT 0');
  }
  // Punto 169 — pestaña "Cortes": total $ del corte, para mostrarlo en la
  // lista sin abrir cada uno. NULL para todo lo que no sea un corte.
  if (!nombresReportes.includes('total_monto')) {
    await db.query('ALTER TABLE reportes ADD COLUMN total_monto DECIMAL(12,2) NULL');
  }

  // Preferencias de dashboard por usuario administrador ("Modo dashboard",
  // punto 119 de PROJECT_STATE.md): una fila por (usuario, vista) con el
  // layout personalizado — orden y ancho de cada tarjeta — en JSON, para
  // restaurarse cada vez que el usuario entra a la vista. Sin FK a
  // usuarios A PROPÓSITO: las cuentas "super" que entran por ADMIN_USERS
  // o por la cuenta de respaldo "admin" no existen en la tabla usuarios,
  // y sus preferencias también deben poder guardarse (mismo criterio que
  // admin_auditoria usa VARCHAR para su actor).
  await db.query(`
    CREATE TABLE IF NOT EXISTS preferencias_dashboard (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario VARCHAR(100) NOT NULL,
      vista VARCHAR(50) NOT NULL,
      layout_json JSON NOT NULL,
      actualizado_en DATETIME NOT NULL,
      CONSTRAINT uq_preferencias_dashboard UNIQUE (usuario, vista)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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
  crearBaseDeDatosTenant,
};
