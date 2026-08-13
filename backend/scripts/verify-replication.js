#!/usr/bin/env node
/**
 * Revisa el estado de salud de la replicación MySQL primario→réplica
 * (segmento 8 del plan multi-tenant, ver PROJECT_STATE.md). Solo lee
 * SHOW REPLICA STATUS -- no modifica nada, seguro de correr en cualquier
 * momento, incluida una revisión periódica desde fuera de la app (cron,
 * monitoreo externo, etc.).
 *
 * Uso:
 *   MYSQL_ROOT_PASSWORD=... REPLICA_DB_HOST=<host de la réplica> \
 *     node backend/scripts/verify-replication.js [--max-retraso-seg=60]
 *
 * Código de salida 0 si la replicación está sana, 1 si no -- pensado para
 * usarse directo en un chequeo automatizado (`&& echo ok || alerta`).
 */

const mysql = require('mysql2/promise');
const { fail } = require('./lib/controlDb');

const MAX_RETRASO_SEG_DEFAULT = 60;

function leerConexionDesdeEnv() {
  const replica = {
    host: process.env.REPLICA_DB_HOST,
    port: Number(process.env.REPLICA_DB_PORT || 3306),
  };
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD;
  if (!replica.host) fail('Falta REPLICA_DB_HOST (host del nodo RÉPLICA) en el entorno.');
  if (!rootPassword) fail('Falta MYSQL_ROOT_PASSWORD en el entorno.');
  return { replica, rootPassword };
}

function leerMaxRetrasoSeg(argv) {
  const flag = argv.find((a) => a.startsWith('--max-retraso-seg='));
  if (!flag) return MAX_RETRASO_SEG_DEFAULT;
  const valor = Number(flag.slice('--max-retraso-seg='.length));
  return Number.isFinite(valor) && valor >= 0 ? valor : MAX_RETRASO_SEG_DEFAULT;
}

// Lógica pura: interpreta una fila de SHOW REPLICA STATUS y devuelve la
// lista de problemas encontrados (vacía = todo sano). Separada de main()
// para poder probarla con filas armadas a mano, sin MySQL real.
function evaluarEstadoReplica(fila, { maxRetrasoSeg = MAX_RETRASO_SEG_DEFAULT } = {}) {
  if (!fila) {
    return { ok: false, problemas: ['SHOW REPLICA STATUS no devolvió ninguna fila -- este nodo no está configurado como réplica de nadie.'] };
  }

  const problemas = [];
  if (fila.Replica_IO_Running !== 'Yes') {
    problemas.push(`Hilo de I/O detenido (Replica_IO_Running=${fila.Replica_IO_Running}). Último error: ${fila.Last_IO_Error || '(ninguno)'}`);
  }
  if (fila.Replica_SQL_Running !== 'Yes') {
    problemas.push(`Hilo SQL detenido (Replica_SQL_Running=${fila.Replica_SQL_Running}). Último error: ${fila.Last_SQL_Error || '(ninguno)'}`);
  }
  const retraso = fila.Seconds_Behind_Source;
  if (retraso === null) {
    problemas.push('Seconds_Behind_Source es NULL -- el hilo de I/O no está corriendo, no se puede medir el retraso.');
  } else if (retraso > maxRetrasoSeg) {
    problemas.push(`Retraso de replicación de ${retraso}s, por encima del máximo aceptado (${maxRetrasoSeg}s).`);
  }

  return { ok: problemas.length === 0, problemas };
}

async function main() {
  const maxRetrasoSeg = leerMaxRetrasoSeg(process.argv);
  const { replica: replicaCfg, rootPassword } = leerConexionDesdeEnv();

  const replica = await mysql.createConnection({
    host: replicaCfg.host,
    port: replicaCfg.port,
    user: 'root',
    password: rootPassword,
  });

  try {
    const [filas] = await replica.query('SHOW REPLICA STATUS');
    const resultado = evaluarEstadoReplica(filas[0], { maxRetrasoSeg });

    if (resultado.ok) {
      console.log(`✔ Replicación sana (retraso: ${filas[0].Seconds_Behind_Source}s, máximo aceptado: ${maxRetrasoSeg}s).`);
      process.exit(0);
    } else {
      console.error('✘ Problemas de replicación detectados:');
      for (const problema of resultado.problemas) console.error(`  - ${problema}`);
      process.exit(1);
    }
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

module.exports = { leerConexionDesdeEnv, leerMaxRetrasoSeg, evaluarEstadoReplica, MAX_RETRASO_SEG_DEFAULT };
