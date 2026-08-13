#!/usr/bin/env node
/**
 * Promueve la réplica de MySQL a primario — failover MANUAL a propósito
 * (segmento 8 del plan multi-tenant, ver PROJECT_STATE.md; decisión
 * explícita del usuario: sin failover automático, para no agregar un
 * orquestador adicional al stack que no se puede probar contra
 * infraestructura real desde este entorno).
 *
 * Este script SOLO actúa sobre el nodo réplica (detiene la replicación y
 * la pone en modo lectura-escritura). NO reconfigura el backend ni el
 * nodo primario viejo — eso son pasos manuales deliberados, impresos al
 * final de la corrida, para que quien opera el failover decida
 * conscientemente el orden (sobre todo qué hacer con el primario viejo si
 * sigue vivo pero inalcanzable, para evitar un split-brain con dos nodos
 * aceptando escrituras a la vez).
 *
 * Uso normal (el primario ya está caído/inalcanzable):
 *   MYSQL_ROOT_PASSWORD=... REPLICA_DB_HOST=<host de la réplica> \
 *     node backend/scripts/promote-replica.js
 *
 * Por defecto, RECHAZA promover si la réplica todavía tiene retraso de
 * replicación pendiente (para no perder transacciones que sí llegaron al
 * primario pero no a la réplica). Si el primario está irrecuperable y se
 * acepta esa pérdida potencial de las últimas transacciones, forzar con:
 *   node backend/scripts/promote-replica.js --force
 */

const mysql = require('mysql2/promise');
const { fail } = require('./lib/controlDb');

function leerConexionDesdeEnv() {
  const replica = {
    host: process.env.REPLICA_DB_HOST,
    port: Number(process.env.REPLICA_DB_PORT || 3306),
  };
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD;
  if (!replica.host) fail('Falta REPLICA_DB_HOST (host del nodo RÉPLICA a promover) en el entorno.');
  if (!rootPassword) fail('Falta MYSQL_ROOT_PASSWORD en el entorno.');
  return { replica, rootPassword };
}

// Lógica pura: decide si es seguro promover esta réplica ahora mismo,
// a partir de una fila de SHOW REPLICA STATUS. Separada de main() para
// poder probarla con filas armadas a mano (sin MySQL real).
function verificarListaParaPromover(fila, { forzar = false } = {}) {
  if (!fila) {
    // Sin fila = esta instancia nunca fue configurada como réplica (o ya
    // fue promovida antes). No hay nada que "detener" ni retraso que
    // perder -- es seguro tratarla como ya promovida.
    return { ok: true, motivo: null };
  }
  if (fila.Last_IO_Error || fila.Last_SQL_Error) {
    if (!forzar) {
      return {
        ok: false,
        motivo: `La réplica tiene un error de replicación pendiente sin resolver (I/O: "${fila.Last_IO_Error || '(ninguno)'}", SQL: "${fila.Last_SQL_Error || '(ninguno)'}"). Usa --force si de todas formas quieres promoverla.`,
      };
    }
  }
  const retraso = fila.Seconds_Behind_Source;
  if (retraso !== null && retraso !== 0 && !forzar) {
    return {
      ok: false,
      motivo: `La réplica tiene ${retraso}s de retraso pendiente respecto al primario -- promoverla ahora podría perder las últimas transacciones que no alcanzaron a replicarse. Usa --force si el primario es irrecuperable y aceptas esa pérdida.`,
    };
  }
  return { ok: true, motivo: null };
}

async function main() {
  const forzar = process.argv.includes('--force');
  const { replica: replicaCfg, rootPassword } = leerConexionDesdeEnv();

  const replica = await mysql.createConnection({
    host: replicaCfg.host,
    port: replicaCfg.port,
    user: 'root',
    password: rootPassword,
  });

  try {
    console.log('Paso 1/3: verificando que la réplica esté al día antes de promover...');
    const [filas] = await replica.query('SHOW REPLICA STATUS');
    const resultado = verificarListaParaPromover(filas[0], { forzar });
    if (!resultado.ok) fail(resultado.motivo);

    console.log('Paso 2/3: deteniendo la replicación y limpiando la configuración de fuente...');
    try {
      await replica.query('STOP REPLICA');
      await replica.query('RESET REPLICA ALL');
    } catch (err) {
      if (err.errno !== 3084) throw err; // 3084 = no había replicación configurada, ignorable
    }

    console.log('Paso 3/3: habilitando escritura en este nodo...');
    // SET PERSIST (no SET GLOBAL): aplica de inmediato Y sobrevive un
    // reinicio del contenedor -- si se usara SET GLOBAL, un simple
    // reinicio de este nodo lo devolvería a la config de arranque (que ya
    // no trae read_only/super_read_only estáticos, ver mysql/conf/replica.cnf)
    // y en teoría quedaría escribible de todas formas, pero depender de
    // eso sería frágil; SET PERSIST dejarlo explícito en el datadir mismo.
    await replica.query('SET PERSIST super_read_only = OFF');
    await replica.query('SET PERSIST read_only = OFF');

    console.log('\n✔ Este nodo ya acepta escrituras -- es el nuevo primario.');
    console.log('\nSiguientes pasos (manuales, deliberadamente NO automatizados por este script):');
    console.log('  1. Actualiza DB_HOST del backend (docker-stack.yml o tu DNS/VIP de primario) para');
    console.log(`     que apunte a este nodo (${replicaCfg.host}) y redespliega el stack.`);
    console.log('  2. Si el primario viejo sigue vivo pero quedó aislado (split-brain), apágalo o');
    console.log('     ponlo en solo-lectura A MANO antes de reconectar la red -- nunca dejes que dos');
    console.log('     nodos acepten escrituras a la vez.');
    console.log('  3. Cuando el primario viejo esté disponible de nuevo, reconstrúyelo como réplica');
    console.log('     de este nodo nuevo con backend/scripts/configure-replica.js (invirtiendo los');
    console.log('     roles DB_HOST/REPLICA_DB_HOST respecto a la corrida original).');
    console.log('  4. Confirma con backend/scripts/verify-replication.js una vez que la topología');
    console.log('     quede reconstruida.');
  } finally {
    await replica.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { leerConexionDesdeEnv, verificarListaParaPromover };
