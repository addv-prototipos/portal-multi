#!/usr/bin/env node
// Backfill: sincroniza el catálogo real "Clave de Producto o Servicio" del
// SAT (~52,500 claves, CLAVE_PROD_SERV_SYNC_URL) en CADA tenant activo que
// ya existía antes de que /internal/activar-tenant/:slug empezara a
// hacerlo solo (ver backend/server.js). Sin esto, los tenants viejos se
// quedan con el catálogo vacío (nunca se sembró ni los 10 de ejemplo —
// ensureSchema() solo crea la tabla) hasta que un admin entra a mano a
// Configuraciones fiscales y da clic en "Actualizar".
//
// Idempotente: sembrarCatalogoEjemploSiVacio() no hace nada si la tabla ya
// tiene filas; sincronizarDesdeOrigen() siempre DELETE+INSERT dentro de
// una transacción (ver claveProdServ.js:guardarCatalogo) — correrlo varias
// veces nunca duplica filas ni dejas la tabla a medias si falla a la mitad.
//
// Uso (desde el HOST, igual que verificar-mysql.js/provisionar-tenant.js —
// backend/.dockerignore excluye scripts/ de la imagen, así que no corre
// con `docker compose exec`):
//   DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=app DB_PASSWORD=<...> \
//   CONTROL_DB_HOST=127.0.0.1 CONTROL_DB_PORT=3307 CONTROL_DB_USER=control_app CONTROL_DB_PASSWORD=<...> \
//   node backend/scripts/sincronizar-catalogo-sat-tenants.js
//
// (ver CLAUDE.md para cómo exponer mysql-control al host con un
// docker-compose.override.yml temporal si hace falta — no publica puerto
// por defecto).

const {
  ejecutarComoTenant,
  obtenerPoolTenant,
  obtenerPoolControl,
  cerrarTodosLosPoolsTenant,
} = require('../db');
const {
  sembrarCatalogoEjemploSiVacio: sembrarCatalogoClaveProdServSiVacio,
  sincronizarDesdeOrigen: sincronizarClaveProdServDesdeOrigen,
  contarClaveProdServ,
} = require('../utils/claveProdServ');

async function main() {
  const poolControl = obtenerPoolControl();
  const [tenants] = await poolControl.query("SELECT slug, db_name FROM tenants WHERE estado = 'activo' ORDER BY slug");

  if (tenants.length === 0) {
    console.log('No hay tenants activos — nada que sincronizar.');
    return;
  }

  console.log(`Sincronizando catálogo de Clave SAT en ${tenants.length} tenant(s) activo(s)...\n`);

  const resultados = [];
  for (const { slug, db_name: dbName } of tenants) {
    const poolTenant = obtenerPoolTenant({
      slug,
      host: process.env.DB_HOST || 'mysql',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'app',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
    });
    try {
      await ejecutarComoTenant(poolTenant, sembrarCatalogoClaveProdServSiVacio);
      await ejecutarComoTenant(poolTenant, sincronizarClaveProdServDesdeOrigen);
      const total = await ejecutarComoTenant(poolTenant, contarClaveProdServ);
      console.log(`✓ ${slug}: ${total} claves`);
      resultados.push({ slug, ok: true, total });
    } catch (err) {
      console.error(`✗ ${slug}: ${err.message}`);
      resultados.push({ slug, ok: false, error: err.message });
    }
  }

  const exitosos = resultados.filter((r) => r.ok).length;
  console.log(`\nListo: ${exitosos}/${tenants.length} tenant(s) sincronizados.`);
  if (exitosos < tenants.length) {
    console.log('Tenants con error (revisar arriba):', resultados.filter((r) => !r.ok).map((r) => r.slug).join(', '));
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('Error fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarTodosLosPoolsTenant();
    process.exit(process.exitCode || 0);
  });
