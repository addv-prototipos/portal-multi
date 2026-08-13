#!/usr/bin/env node
/**
 * Engancha un nodo réplica de MySQL a su primario (segmento 8 del plan
 * multi-tenant, ver PROJECT_STATE.md) — crea/rota el usuario de
 * replicación en el primario y apunta la réplica a él usando GTID
 * (SOURCE_AUTO_POSITION=1, ver mysql/conf/primary.cnf para el porqué de
 * GTID en vez de coordenadas de binlog manuales).
 *
 * Idempotente: correrlo varias veces (ej. para rotar la contraseña de
 * replicación) es seguro — vuelve a crear/actualizar el usuario y
 * reconfigura la fuente de la réplica desde cero cada vez.
 *
 * NUNCA correr dentro del contenedor backend (igual que
 * provisionar-tenant.js/cutover-tenant-piloto.js) — requiere privilegios
 * de root de MySQL en AMBOS nodos, que el backend nunca tiene.
 *
 * Uso:
 *   MYSQL_ROOT_PASSWORD=... \
 *   DB_HOST=<host/IP del nodo primario> DB_PORT=3306 \
 *   REPLICA_DB_HOST=<host/IP del nodo réplica> REPLICA_DB_PORT=3306 \
 *   MYSQL_REPLICATION_USER=repl MYSQL_REPLICATION_PASSWORD=<contraseña larga y única> \
 *     node backend/scripts/configure-replica.js
 *
 * (Si primario y réplica comparten la misma MYSQL_ROOT_PASSWORD —el caso
 * normal en este proyecto, misma imagen/mismo .env desplegado en los dos
 * nodos— no hace falta ninguna variable aparte para la conexión root de
 * la réplica.)
 */

const mysql = require('mysql2/promise');
const { fail } = require('./lib/controlDb');

function leerConexionDesdeEnv() {
  const primario = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
  };
  const replica = {
    host: process.env.REPLICA_DB_HOST,
    port: Number(process.env.REPLICA_DB_PORT || 3306),
  };
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD;
  const replUser = process.env.MYSQL_REPLICATION_USER || 'repl';
  const replPassword = process.env.MYSQL_REPLICATION_PASSWORD;

  if (!primario.host) fail('Falta DB_HOST (host del nodo PRIMARIO) en el entorno.');
  if (!replica.host) fail('Falta REPLICA_DB_HOST (host del nodo RÉPLICA) en el entorno.');
  if (!rootPassword) fail('Falta MYSQL_ROOT_PASSWORD en el entorno.');
  if (!replPassword) {
    fail('Falta MYSQL_REPLICATION_PASSWORD en el entorno — define una contraseña larga y única para el usuario de replicación.');
  }

  return { primario, replica, rootPassword, replUser, replPassword };
}

// Crea (o rota la contraseña de) el usuario de replicación en el
// primario, con el único privilegio que necesita: REPLICATION SLAVE.
// Nunca acceso a datos de aplicación — si esta credencial se filtra, solo
// sirve para leer el flujo de replicación, no para consultar tablas.
async function asegurarUsuarioReplicacion(primario, { usuario, password }) {
  await primario.query(`CREATE USER IF NOT EXISTS \`${usuario}\`@'%' IDENTIFIED BY ?`, [password]);
  await primario.query(`ALTER USER \`${usuario}\`@'%' IDENTIFIED BY ?`, [password]);
  await primario.query(`GRANT REPLICATION SLAVE ON *.* TO \`${usuario}\`@'%'`);
  await primario.query('FLUSH PRIVILEGES');
}

// Confirma que el primario tiene GTID activado — sin esto,
// SOURCE_AUTO_POSITION=1 falla al arrancar la réplica con un error de
// MySQL poco claro para quien no conozca la causa exacta.
async function verificarGtidActivoEnPrimario(primario) {
  const [filas] = await primario.query("SHOW VARIABLES LIKE 'gtid_mode'");
  const valor = filas[0] && filas[0].Value;
  if (valor !== 'ON') {
    throw new Error(
      `gtid_mode del primario es "${valor}", se esperaba "ON". Revisa que mysql/conf/primary.cnf esté montado y que el contenedor se haya reiniciado después de montarlo.`
    );
  }
}

// Apunta la réplica al primario usando GTID y arranca los hilos de
// replicación. Detiene cualquier replicación previa primero (ignorando el
// error si no había ninguna configurada) para que correr este script dos
// veces seguidas — ej. tras rotar la contraseña— no falle por "ya está
// replicando".
async function configurarFuenteReplica(replica, { host, port, usuario, password }) {
  try {
    await replica.query('STOP REPLICA');
  } catch (err) {
    // Código 3084 de MySQL: "no había replicación configurada todavía"
    // -- normal en el primer enganche, no es un error real. Cualquier
    // otro código sí se re-lanza, no se silencia a ciegas.
    if (err && err.errno !== 3084) throw err;
  }

  await replica.query(
    `CHANGE REPLICATION SOURCE TO
       SOURCE_HOST = ?,
       SOURCE_PORT = ?,
       SOURCE_USER = ?,
       SOURCE_PASSWORD = ?,
       SOURCE_AUTO_POSITION = 1,
       GET_SOURCE_PUBLIC_KEY = 1`,
    [host, port, usuario, password]
  );
  await replica.query('START REPLICA');
}

// Activa read_only/super_read_only en la réplica con SET PERSIST (no SET
// GLOBAL): aplica de inmediato Y sobrevive un reinicio del contenedor
// (queda escrito en el datadir, mysqld-auto.cnf). A propósito NO se fija
// esto en mysql/conf/replica.cnf de forma estática — la imagen oficial de
// MySQL necesita poder escribir durante su bootstrap inicial (crear la
// BD/usuario de MYSQL_DATABASE/MYSQL_USER) la primera vez que arranca con
// un datadir vacío, y si super_read_only ya estuviera activo en ese
// momento ese bootstrap falla y el contenedor nunca llega a arrancar —
// confirmado corriendo esto contra un contenedor MySQL real. Por eso este
// paso corre DESPUÉS de que la réplica ya esté arriba y replicando, nunca
// antes.
async function activarSoloLecturaPersistente(replica) {
  await replica.query('SET PERSIST read_only = ON');
  await replica.query('SET PERSIST super_read_only = ON');
}

// Lógica pura (sin conexión): interpreta una fila de SHOW REPLICA STATUS
// y decide si la replicación quedó corriendo correctamente. Separada de
// main() para poder probarla con un objeto fila armado a mano, sin MySQL
// real — mismo patrón que el resto de scripts/lib de este proyecto.
function verificarReplicaCorriendo(fila) {
  if (!fila) {
    return { ok: false, motivo: 'SHOW REPLICA STATUS no devolvió ninguna fila — ¿CHANGE REPLICATION SOURCE TO se ejecutó?' };
  }
  if (fila.Replica_IO_Running !== 'Yes') {
    return {
      ok: false,
      motivo: `El hilo de I/O no está corriendo (Replica_IO_Running=${fila.Replica_IO_Running}). Último error: ${fila.Last_IO_Error || '(ninguno)'}`,
    };
  }
  if (fila.Replica_SQL_Running !== 'Yes') {
    return {
      ok: false,
      motivo: `El hilo SQL no está corriendo (Replica_SQL_Running=${fila.Replica_SQL_Running}). Último error: ${fila.Last_SQL_Error || '(ninguno)'}`,
    };
  }
  return { ok: true, motivo: null };
}

async function main() {
  const { primario: primarioCfg, replica: replicaCfg, rootPassword, replUser, replPassword } = leerConexionDesdeEnv();

  const primario = await mysql.createConnection({
    host: primarioCfg.host,
    port: primarioCfg.port,
    user: 'root',
    password: rootPassword,
  });
  const replica = await mysql.createConnection({
    host: replicaCfg.host,
    port: replicaCfg.port,
    user: 'root',
    password: rootPassword,
  });

  try {
    console.log('Paso 1/5: verificando que el primario tenga GTID activado...');
    await verificarGtidActivoEnPrimario(primario);

    console.log(`Paso 2/5: asegurando el usuario de replicación "${replUser}" en el primario...`);
    await asegurarUsuarioReplicacion(primario, { usuario: replUser, password: replPassword });

    console.log(`Paso 3/5: apuntando la réplica a ${primarioCfg.host}:${primarioCfg.port}...`);
    await configurarFuenteReplica(replica, {
      host: primarioCfg.host,
      port: primarioCfg.port,
      usuario: replUser,
      password: replPassword,
    });

    console.log('Paso 4/5: verificando que los hilos de replicación arrancaron...');
    // Da un margen breve para que los hilos terminen de arrancar antes de
    // verificar — inmediatamente después de START REPLICA a veces todavía
    // no reportan "Yes".
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const [filas] = await replica.query('SHOW REPLICA STATUS');
    const resultado = verificarReplicaCorriendo(filas[0]);
    if (!resultado.ok) {
      throw new Error(`La replicación no quedó corriendo: ${resultado.motivo}`);
    }

    console.log('Paso 5/5: activando solo-lectura en la réplica (persistente, sobrevive un reinicio)...');
    await activarSoloLecturaPersistente(replica);

    console.log('\n✔ Réplica enganchada, replicando correctamente y protegida contra escrituras.');
    console.log('  Verifica el estado en cualquier momento con: node backend/scripts/verify-replication.js');
  } finally {
    await primario.end();
    await replica.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  leerConexionDesdeEnv,
  asegurarUsuarioReplicacion,
  verificarGtidActivoEnPrimario,
  configurarFuenteReplica,
  activarSoloLecturaPersistente,
  verificarReplicaCorriendo,
};
