#!/usr/bin/env node
/**
 * Migra los datos de una base de datos SQLite existente (de versiones
 * anteriores de este proyecto, antes del cambio a MySQL) hacia la nueva
 * base de datos MySQL. Es seguro correrlo más de una vez: usa
 * "INSERT ... ON DUPLICATE KEY UPDATE" por correo electrónico, así que no
 * duplica registros si ya migraste antes.
 *
 * Uso:
 *   1. Asegúrate de tener el archivo SQLite antiguo a la mano (normalmente
 *      en el volumen/carpeta que usabas como DATA_DIR en la versión
 *      anterior, con nombre "app.db").
 *   2. Instala better-sqlite3 temporalmente (ya no es una dependencia
 *      permanente del proyecto, solo se necesita para esta migración):
 *        cd backend && npm install better-sqlite3 --no-save
 *   3. Levanta MySQL (docker-compose up -d mysql) y asegúrate de tener las
 *      variables DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME apuntando a él
 *      (si corres esto desde tu máquina y no desde el contenedor, usa
 *      DB_HOST=localhost y el MYSQL_PORT que hayas configurado).
 *   4. Corre:
 *        node scripts/migrar-sqlite-a-mysql.js /ruta/a/tu/app.db
 *
 * Al terminar, puedes desinstalar better-sqlite3 si quieres
 * (npm uninstall better-sqlite3), ya que no lo usa el resto de la app.
 */

const path = require('path');
const { pool, ensureSchema } = require('../db');

const rutaSqlite = process.argv[2];

if (!rutaSqlite) {
  console.error('Uso: node scripts/migrar-sqlite-a-mysql.js /ruta/a/tu/app.db');
  process.exit(1);
}

let Database;
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  Database = require('better-sqlite3');
} catch (err) {
  console.error(
    'No se encontró el paquete "better-sqlite3". Este script lo necesita solo de forma ' +
      'temporal para leer la base de datos antigua. Instálalo con:\n\n' +
      '  npm install better-sqlite3 --no-save\n\n' +
      'y vuelve a correr este script.'
  );
  process.exit(1);
}

// Convierte un valor de fecha guardado por la version SQLite (que podia
// estar en formato "YYYY-MM-DD HH:MM:SS" o en ISO "YYYY-MM-DDTHH:MM:SS.sssZ")
// a un objeto Date valido para insertar en una columna DATETIME de MySQL.
function aFecha(valor) {
  if (!valor) return new Date();
  const texto = String(valor);
  const fecha = texto.endsWith('Z') ? new Date(texto) : new Date(texto.replace(' ', 'T') + 'Z');
  return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
}

async function main() {
  console.log(`Leyendo base de datos SQLite en: ${path.resolve(rutaSqlite)}`);
  const sqlite = new Database(rutaSqlite, { readonly: true, fileMustExist: true });

  const registros = sqlite.prepare('SELECT * FROM registros').all();
  const configuracion = sqlite.prepare('SELECT * FROM configuracion').all();
  sqlite.close();

  console.log(`Encontrados ${registros.length} registros y ${configuracion.length} claves de configuración.\n`);

  console.log('Preparando el esquema de MySQL (si no existe)...');
  await ensureSchema();

  let insertados = 0;
  let actualizados = 0;
  let conError = 0;

  for (const r of registros) {
    try {
      const [resultado] = await pool.query(
        `INSERT INTO registros
          (nombre, tipo_persona, rfc, email, indicaciones,
           archivo_nombre_original, archivo_nombre_guardado, archivo_mime, archivo_tamano_bytes,
           regimen_fiscal, codigo_postal, uso_cfdi, eliminado_en, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nombre = VALUES(nombre), tipo_persona = VALUES(tipo_persona), rfc = VALUES(rfc),
           indicaciones = VALUES(indicaciones), archivo_nombre_original = VALUES(archivo_nombre_original),
           archivo_nombre_guardado = VALUES(archivo_nombre_guardado), archivo_mime = VALUES(archivo_mime),
           archivo_tamano_bytes = VALUES(archivo_tamano_bytes), regimen_fiscal = VALUES(regimen_fiscal),
           codigo_postal = VALUES(codigo_postal), uso_cfdi = VALUES(uso_cfdi),
           eliminado_en = VALUES(eliminado_en), actualizado_en = VALUES(actualizado_en)`,
        [
          r.nombre || '',
          r.tipo_persona || '',
          r.rfc || null,
          r.email,
          r.indicaciones || null,
          r.archivo_nombre_original,
          r.archivo_nombre_guardado,
          r.archivo_mime,
          r.archivo_tamano_bytes,
          r.regimen_fiscal || null,
          r.codigo_postal || null,
          r.uso_cfdi || null,
          r.eliminado_en ? aFecha(r.eliminado_en) : null,
          aFecha(r.creado_en),
          aFecha(r.actualizado_en),
        ]
      );
      if (resultado.affectedRows === 1) insertados += 1;
      else actualizados += 1;
    } catch (err) {
      conError += 1;
      console.error(`  Error migrando el registro de "${r.email}": ${err.message}`);
    }
  }

  for (const c of configuracion) {
    try {
      await pool.query(
        `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [c.clave, c.valor]
      );
    } catch (err) {
      console.error(`  Error migrando la configuración "${c.clave}": ${err.message}`);
    }
  }

  await pool.end();

  console.log('\n--- Resumen ---');
  console.log(`Registros nuevos insertados: ${insertados}`);
  console.log(`Registros ya existentes actualizados: ${actualizados}`);
  console.log(`Registros con error: ${conError}`);
  console.log(`Claves de configuración migradas: ${configuracion.length}`);
  console.log(
    '\nLos ARCHIVOS (PDFs) no se mueven con este script — solo copian la carpeta "uploads" ' +
      'tal cual al nuevo servidor si aún no lo has hecho; los nombres guardados en disco no cambiaron.'
  );

  process.exit(conError > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nError inesperado durante la migración:', err);
  process.exit(1);
});
