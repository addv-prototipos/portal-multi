// Pool único hacia control_tenants — a diferencia de backend/db.js, este
// servicio NUNCA resuelve un tenant específico (no hay AsyncLocalStorage
// ni proxy por request), así que un solo pool fijo alcanza. Variables
// CONTROL_DB_* sin fallback a DB_*/MYSQL_* a propósito: este proceso no
// debe tener ninguna forma de terminar apuntando, ni por accidente, a la
// base de datos de un tenant — ver PROJECT_STATE.md, segmento 9b.

const mysql = require('mysql2/promise');

let pool = null;

function obtenerPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.CONTROL_DB_HOST || 'mysql',
      port: Number(process.env.CONTROL_DB_PORT || 3306),
      user: process.env.CONTROL_DB_USER || 'control_app',
      password: process.env.CONTROL_DB_PASSWORD || '',
      database: process.env.CONTROL_DB_NAME || 'control_tenants',
      connectionLimit: 5,
      dateStrings: true,
    });
  }
  return pool;
}

module.exports = { obtenerPool };
