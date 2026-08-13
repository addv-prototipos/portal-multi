#!/usr/bin/env node
/**
 * Cutover del tenant piloto (segmento 6 del plan multi-tenant, ver
 * PROJECT_STATE.md): convierte la base de datos de un solo tenant que ya
 * usa esta app (por defecto `portal_facturacion`, o la que tengas en
 * DB_NAME) en el PRIMER tenant real del modelo multi-tenant — copia sus
 * tablas a `tenant_<slug>` y sus archivos (en MinIO, bajo el prefijo
 * "_default") al prefijo del tenant nuevo.
 *
 * NO ES DESTRUCTIVO por diseño: la base de datos y los archivos ORIGEN
 * nunca se tocan (solo se leen) — el corte de tráfico real (apuntar el
 * backend al tenant nuevo en vez de al de siempre) es una decisión y un
 * paso APARTE, deliberadamente NO automatizado aquí (ver "Siguientes
 * pasos" al final de la corrida). Si algo sale mal a mitad de camino, la
 * base de datos/archivos originales siguen intactos y sirviendo tráfico
 * con normalidad.
 *
 * Requiere:
 *   - MYSQL_ROOT_PASSWORD, DB_HOST/DB_PORT/DB_USER/DB_PASSWORD (igual que
 *     provisionar-tenant.js — mismas reglas: nunca correr esto dentro del
 *     contenedor backend).
 *   - Acceso a MinIO igual que el backend (MINIO_ENDPOINT/MINIO_BUCKET/
 *     MINIO_ROOT_USER/MINIO_ROOT_PASSWORD) — usa backend/utils/storage.js
 *     tal cual, así que corre este script con las mismas variables de
 *     entorno con las que correría el backend real.
 *
 * Uso:
 *   MYSQL_ROOT_PASSWORD=... DB_HOST=localhost DB_PORT=3306 \
 *   DB_USER=app DB_PASSWORD=... \
 *   MINIO_ENDPOINT=http://localhost:9000 MINIO_ROOT_USER=... MINIO_ROOT_PASSWORD=... \
 *     node backend/scripts/cutover-tenant-piloto.js cliente1 "Empresa Uno S.A. de C.V." \
 *     [--origen-db=portal_facturacion] [--contacto-email=contacto@empresauno.com]
 *
 * Pasos (en este orden, cada uno verificado antes de seguir al próximo):
 *   1. Asegura BD de control + registra el tenant (estado "provisioning").
 *   2. Crea `tenant_<slug>` y le aplica el esquema canónico (ensureSchema()).
 *   3. Copia los DATOS de cada tabla de la BD origen a la BD del tenant
 *      (columna por columna, no "SELECT *" — ver comentario en
 *      copiarDatosTabla) y verifica que el conteo de filas coincida.
 *   4. Copia los archivos de MinIO del prefijo "_default" (donde vive
 *      hoy todo lo que se sube sin tenant resuelto) al prefijo del
 *      tenant, y verifica que el conteo de objetos coincida.
 *   5. Marca el tenant como "activo".
 */

const mysql = require('mysql2/promise');
const { validarSlug, nombreDbTenant } = require('../utils/tenant');
const storage = require('../utils/storage');
const {
  CONTROL_DB_NAME,
  fail,
  leerConexionDesdeEnv,
  asegurarControlYPrivilegios,
  registrarEvento,
  correrEsquemaEnProcesoHijo,
} = require('./lib/controlDb');

const ACTOR = 'cutover-tenant-piloto.js';

// Mismas tablas que crea ensureSchema() en backend/db.js — enumeradas
// aquí explícitamente (no vía INFORMATION_SCHEMA) para que el orden de
// copiado respete las dependencias de llave foránea (reporte_items
// depende de reportes; tickets no depende de nada que no se haya copiado
// antes). Si ensureSchema() alguna vez agrega una tabla nueva, agrégala
// aquí también.
const TABLAS_EN_ORDEN = [
  'registros',
  'configuracion',
  'usuarios',
  'ordenes_compra',
  'tickets',
  'reportes',
  'reporte_items',
];

function leerArgumentos(argv) {
  const [, , slugArg, nombreEmpresaArg, ...resto] = argv;
  if (!slugArg || !nombreEmpresaArg) {
    fail(
      'Uso: node cutover-tenant-piloto.js <slug> "<Nombre de la empresa>" [--origen-db=portal_facturacion] [--contacto-email=correo@empresa.com]'
    );
  }
  const origenFlag = resto.find((a) => a.startsWith('--origen-db='));
  const contactoEmailFlag = resto.find((a) => a.startsWith('--contacto-email='));
  return {
    slug: slugArg.toLowerCase(),
    nombreEmpresa: nombreEmpresaArg,
    origenDb: origenFlag ? origenFlag.slice('--origen-db='.length) : (process.env.DB_NAME || 'portal_facturacion'),
    contactoEmail: contactoEmailFlag ? contactoEmailFlag.slice('--contacto-email='.length) : null,
  };
}

// Copia los datos de UNA tabla de `origenDb` a `destinoDb`, listando las
// columnas explícitamente (nunca "INSERT ... SELECT *") — así, si el
// origen tuviera una columna de más (dato histórico de una migración
// vieja) o de menos que el esquema canónico recién creado en el destino,
// la discrepancia produce un error SQL claro en vez de una copia
// silenciosamente desalineada por posición de columna.
async function copiarDatosTabla(root, origenDb, destinoDb, tabla) {
  const [columnas] = await root.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [destinoDb, tabla]
  );
  if (columnas.length === 0) {
    throw new Error(`La tabla "${tabla}" no existe en la base de datos destino "${destinoDb}" — ¿ensureSchema() corrió correctamente?`);
  }
  const listaColumnas = columnas.map((c) => `\`${c.COLUMN_NAME}\``).join(', ');

  await root.query(
    `INSERT INTO \`${destinoDb}\`.\`${tabla}\` (${listaColumnas})
     SELECT ${listaColumnas} FROM \`${origenDb}\`.\`${tabla}\``
  );

  const [[{ total: totalOrigen }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${origenDb}\`.\`${tabla}\``);
  const [[{ total: totalDestino }]] = await root.query(`SELECT COUNT(*) AS total FROM \`${destinoDb}\`.\`${tabla}\``);
  if (totalOrigen !== totalDestino) {
    throw new Error(
      `Discrepancia copiando "${tabla}": origen tiene ${totalOrigen} filas, destino quedó con ${totalDestino}.`
    );
  }
  return totalDestino;
}

async function main() {
  const { slug, nombreEmpresa, origenDb, contactoEmail } = leerArgumentos(process.argv);

  const errorSlug = validarSlug(slug);
  if (errorSlug) fail(errorSlug);

  const { dbHost, dbPort, rootPassword, appUser, appPassword, controlAppPassword } = leerConexionDesdeEnv();
  const destinoDb = nombreDbTenant(slug);

  const root = await mysql.createConnection({ host: dbHost, port: dbPort, user: 'root', password: rootPassword });

  let tenantId = null;
  try {
    const [origenExiste] = await root.query(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [origenDb]
    );
    if (origenExiste.length === 0) {
      fail(`La base de datos origen "${origenDb}" no existe. Pásala con --origen-db=<nombre> si no es "portal_facturacion".`);
    }

    console.log(`Paso 1/5: asegurando BD de control y registrando "${slug}"...`);
    await asegurarControlYPrivilegios(root, appUser, controlAppPassword);

    const [existentes] = await root.query(`SELECT id, estado FROM \`${CONTROL_DB_NAME}\`.tenants WHERE slug = ?`, [slug]);
    if (existentes.length > 0) {
      fail(`El slug "${slug}" ya está registrado (estado actual: ${existentes[0].estado}). Elige otro o revisa el registro existente.`);
    }

    const [insertResult] = await root.query(
      `INSERT INTO \`${CONTROL_DB_NAME}\`.tenants
        (slug, nombre_empresa, estado, db_host, db_name, db_user, storage_prefix, contacto_email, creado_en)
       VALUES (?, ?, 'provisioning', ?, ?, ?, ?, ?, ?)`,
      [slug, nombreEmpresa, dbHost, destinoDb, appUser, slug, contactoEmail, new Date()]
    );
    tenantId = insertResult.insertId;
    await registrarEvento(root, tenantId, 'cutover_iniciado', `origen=${origenDb} destino=${destinoDb}`, ACTOR);

    console.log(`Paso 2/5: creando "${destinoDb}" y aplicando el esquema canónico...`);
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${destinoDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    correrEsquemaEnProcesoHijo({ dbHost, dbPort, appUser, appPassword, dbName: destinoDb });

    console.log('Paso 3/5: copiando datos tabla por tabla (verificando conteo de filas en cada una)...');
    const resumenTablas = {};
    for (const tabla of TABLAS_EN_ORDEN) {
      resumenTablas[tabla] = await copiarDatosTabla(root, origenDb, destinoDb, tabla);
      console.log(`  ${tabla}: ${resumenTablas[tabla]} fila(s) copiada(s) y verificada(s).`);
    }

    console.log('Paso 4/5: copiando archivos en MinIO (prefijo "_default" -> prefijo del tenant)...');
    const objetosOrigen = await storage.contarObjetosPrefijo(storage.PREFIJO_DEFECTO);
    const copiados = await storage.copiarPrefijo(storage.PREFIJO_DEFECTO, slug);
    const objetosDestino = await storage.contarObjetosPrefijo(slug);
    if (objetosDestino !== objetosOrigen) {
      throw new Error(
        `Discrepancia copiando archivos en MinIO: prefijo "_default" tiene ${objetosOrigen} objeto(s), prefijo "${slug}" quedó con ${objetosDestino}.`
      );
    }
    console.log(`  ${copiados} archivo(s) copiado(s) y verificado(s) en MinIO.`);

    console.log('Paso 5/5: marcando el tenant como activo...');
    await root.query(`UPDATE \`${CONTROL_DB_NAME}\`.tenants SET estado = 'activo', activado_en = ? WHERE id = ?`, [
      new Date(),
      tenantId,
    ]);
    await registrarEvento(root, tenantId, 'cutover_completado', JSON.stringify(resumenTablas), ACTOR);

    console.log('\n✔ Cutover completado. La base de datos y los archivos ORIGEN no se modificaron — siguen intactos.');
    console.log(`\nSiguientes pasos (manuales, deliberadamente NO automatizados por este script):`);
    console.log(`  1. Smoke test en /${slug}/login, /${slug}/dashboard, /${slug}/admin antes de anunciar la URL.`);
    console.log(`  2. Si vas a redirigir las rutas sin prefijo (/login, /admin, etc.) hacia este tenant durante`);
    console.log(`     la transición, agrega a frontend/nginx.conf (dentro del mismo bloque "server {}"):`);
    console.log(`\n       location = /login    { return 301 /${slug}/login; }`);
    console.log(`       location = /dashboard { return 301 /${slug}/dashboard; }`);
    console.log(`       location = /tickets   { return 301 /${slug}/tickets; }`);
    console.log(`       location = /csf       { return 301 /${slug}/csf; }`);
    console.log(`       location = /admin     { return 301 /${slug}/admin; }`);
    console.log(`\n     (colócalas ANTES de las location "= /login" etc. que ya existen, o quítalas — son`);
    console.log(`     mutuamente excluyentes: no pueden convivir dos "location = /login" en el mismo server.)`);
    console.log(`  3. Recarga nginx (\`docker compose restart frontend\` o \`nginx -s reload\` dentro del contenedor).`);
    console.log(`  4. Solo cuando confirmes que todo funciona, decide si archivar/eliminar "${origenDb}" y el`);
    console.log(`     prefijo "_default" en MinIO — este script nunca los toca ni los borra.`);
  } catch (err) {
    if (tenantId) {
      await registrarEvento(root, tenantId, 'cutover_fallido', String((err && err.message) || err), ACTOR);
    }
    throw err;
  } finally {
    await root.end();
  }
}

// Igual que backend/server.js: `main()` solo corre si este archivo se
// ejecuta directamente (`node cutover-tenant-piloto.js`), no cuando un
// test hace `require(...)` para probar `copiarDatosTabla`/`leerArgumentos`
// en aislamiento.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { TABLAS_EN_ORDEN, leerArgumentos, copiarDatosTabla };
