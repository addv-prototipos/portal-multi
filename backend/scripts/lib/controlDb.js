// Helpers compartidos entre los scripts de administración de tenants
// (backend/scripts/provisionar-tenant.js, backend/scripts/cutover-tenant-piloto.js)
// — extraído del primero al escribir el segundo, para no duplicar la
// lógica de conexión root / bootstrap de la BD de control / registro de
// eventos entre ambos. Ver PROJECT_STATE.md, segmentos 1 y 6 del plan
// multi-tenant.

const path = require('path');
const { execFileSync } = require('child_process');

const CONTROL_DB_NAME = 'control_tenants';
const NOMBRE_USUARIO_APP_REGEX = /^[A-Za-z0-9_]{1,32}$/;

function fail(mensaje) {
  console.error(`Error: ${mensaje}`);
  process.exit(1);
}

function leerConexionDesdeEnv() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = Number(process.env.DB_PORT || 3306);
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD;
  if (!rootPassword) {
    fail(
      'Falta MYSQL_ROOT_PASSWORD en el entorno — este script necesita privilegios de administrador de MySQL.'
    );
  }
  const appUser = process.env.DB_USER || process.env.MYSQL_USER || 'app';
  const appPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  if (!appPassword) {
    fail(
      'Falta DB_PASSWORD (o MYSQL_PASSWORD) en el entorno — es la credencial compartida de aplicación que usará el tenant.'
    );
  }
  if (!NOMBRE_USUARIO_APP_REGEX.test(appUser)) {
    fail(`Nombre de usuario de aplicación inválido: "${appUser}".`);
  }
  // Segmento 9b: credencial angosta del contenedor "control" (ver
  // PROJECT_STATE.md) — a propósito OPCIONAL aquí (a diferencia de
  // appPassword): quien todavía no desplegó el servicio "control" no debe
  // ver romperse provisionar-tenant.js/cutover-tenant-piloto.js por una
  // variable que no le corresponde todavía. Si falta, se omite ese paso
  // (ver asegurarControlYPrivilegios) en vez de fallar.
  const controlAppPassword = process.env.CONTROL_APP_PASSWORD || null;
  return { dbHost, dbPort, rootPassword, appUser, appPassword, controlAppPassword };
}

// Asegura la BD/tablas de control y el GRANT amplio del usuario de
// aplicación sobre `control_tenants` y cualquier BD `tenant_*` (existente
// o futura). Idempotente a propósito: segura de correr en cada alta, no
// solo la primera vez. `controlAppPassword` es opcional: si se define,
// también crea/rota una credencial angosta separada para el contenedor
// "control" (segmento 9b, ver PROJECT_STATE.md) — con acceso SOLO a
// control_tenants (ni SELECT/DELETE, ni ningún privilegio sobre
// tenant_*), a diferencia del usuario de aplicación compartido de
// arriba. Si se omite, no se toca ese usuario (para no romper una
// instalación que todavía no desplegó ese servicio).
async function asegurarControlYPrivilegios(root, appUser, controlAppPassword = null) {
  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${CONTROL_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );

  await root.query(`
    CREATE TABLE IF NOT EXISTS \`${CONTROL_DB_NAME}\`.tenants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(50) NOT NULL,
      nombre_empresa VARCHAR(255) NOT NULL,
      estado ENUM('provisioning','activo','suspendido','baja') NOT NULL DEFAULT 'provisioning',
      db_host VARCHAR(255) NOT NULL,
      db_name VARCHAR(64) NOT NULL,
      db_user VARCHAR(64) NOT NULL,
      storage_prefix VARCHAR(64) NOT NULL,
      contacto_email VARCHAR(200) NULL,
      creado_en DATETIME NOT NULL,
      activado_en DATETIME NULL,
      suspendido_en DATETIME NULL,
      notas TEXT NULL,
      UNIQUE KEY uq_tenants_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await root.query(`
    CREATE TABLE IF NOT EXISTS \`${CONTROL_DB_NAME}\`.tenant_eventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      tipo VARCHAR(30) NOT NULL,
      detalle TEXT NULL,
      actor VARCHAR(100) NULL,
      ip VARCHAR(45) NULL,
      creado_en DATETIME NOT NULL,
      KEY idx_tenant_eventos_tenant (tenant_id),
      CONSTRAINT fk_tenant_eventos_tenant FOREIGN KEY (tenant_id)
        REFERENCES \`${CONTROL_DB_NAME}\`.tenants(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // El guion bajo es comodín en el patrón de BD de un GRANT (igual que en
  // LIKE) — se escapa como "\_" para que "tenant\_%" solo matchee bases
  // que empiezan EXACTAMENTE con "tenant_", no cualquier "tenantX...".
  await root.query(`GRANT ALL PRIVILEGES ON \`${CONTROL_DB_NAME}\`.* TO \`${appUser}\`@'%'`);
  await root.query(`GRANT ALL PRIVILEGES ON \`tenant\\_%\`.* TO \`${appUser}\`@'%'`);

  // Segmento 9b: credencial angosta para el contenedor "control" (ver
  // PROJECT_STATE.md) — deliberadamente SIN DELETE (ninguna operación de
  // /control borra filas) y SIN ningún privilegio sobre `tenant_*`: ese
  // es exactamente el aislamiento que se buscaba al separar /control en
  // su propio contenedor. CREATE/ALTER incluidos para que ese servicio
  // pueda auto-provisionar su propio esquema (asegurarTablaAuditoria/
  // ensureSchema) sin depender de que el backend haya corrido primero.
  if (controlAppPassword) {
    await root.query(`CREATE USER IF NOT EXISTS 'control_app'@'%' IDENTIFIED BY ?`, [controlAppPassword]);
    await root.query(`ALTER USER 'control_app'@'%' IDENTIFIED BY ?`, [controlAppPassword]);
    await root.query(`GRANT SELECT, INSERT, UPDATE, CREATE, ALTER ON \`${CONTROL_DB_NAME}\`.* TO 'control_app'@'%'`);
  }

  await root.query('FLUSH PRIVILEGES');
}

async function registrarEvento(root, tenantId, tipo, detalle, actor) {
  await root.query(
    `INSERT INTO \`${CONTROL_DB_NAME}\`.tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

// Corre el esquema completo de la aplicación (ensureSchema() de
// backend/db.js, SIN modificarlo) contra la base de datos indicada,
// invocado en un proceso hijo con DB_NAME apuntando a esa base — ese
// módulo fija su pool a un solo DB_NAME al cargarse (ver backend/db.js).
function correrEsquemaEnProcesoHijo({ dbHost, dbPort, appUser, appPassword, dbName }) {
  const backendDir = path.join(__dirname, '..', '..');
  execFileSync(
    process.execPath,
    [
      '-e',
      "require('./db').ensureSchema().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })",
    ],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        DB_HOST: dbHost,
        DB_PORT: String(dbPort),
        DB_USER: appUser,
        DB_PASSWORD: appPassword,
        DB_NAME: dbName,
      },
      stdio: 'inherit',
    }
  );
}

module.exports = {
  CONTROL_DB_NAME,
  NOMBRE_USUARIO_APP_REGEX,
  fail,
  leerConexionDesdeEnv,
  asegurarControlYPrivilegios,
  registrarEvento,
  correrEsquemaEnProcesoHijo,
};
