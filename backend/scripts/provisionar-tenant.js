#!/usr/bin/env node
/**
 * Aprovisiona un tenant nuevo (empresa cliente) para el Portal de
 * Facturación multi-tenant: crea/asegura la base de datos de control
 * (`control_tenants`), registra el tenant, crea su base de datos física
 * dedicada (`tenant_<slug>`) y le aplica el esquema completo de la
 * aplicación.
 *
 * Ver el plan completo en PROJECT_STATE.md (migración a multi-tenant):
 * esta pieza toca la BD de control, pero server.js solo empieza a
 * resolver tenants por URL a partir del segmento 3/4. Correr este script
 * hoy prepara la base de datos de un tenant nuevo; si los segmentos 3-4
 * ya están desplegados, además queda alcanzable de inmediato en
 * "/<slug>" y "/<slug>/admin" (nginx no necesita tocarse — ver
 * frontend/nginx.conf).
 *
 * Requiere credenciales de ROOT de MySQL (para CREATE DATABASE/GRANT) —
 * a propósito NUNCA se corre dentro del contenedor `backend` (que nunca
 * tiene esa contraseña montada, ver docker-compose.yml). Se corre desde el
 * host, contra el puerto de MySQL ya expuesto por docker-compose:
 *
 *   MYSQL_ROOT_PASSWORD=<la_de_tu_.env> \
 *   DB_HOST=localhost DB_PORT=3306 \
 *   DB_USER=app DB_PASSWORD=<la_de_tu_.env> \
 *     node backend/scripts/provisionar-tenant.js cliente1 "Empresa Uno S.A. de C.V." \
 *     --contacto-email=contacto@empresauno.com
 *
 * DB_USER/DB_PASSWORD deben ser la credencial COMPARTIDA de aplicación que
 * usa el backend para todos los tenants (decisión de diseño ya tomada:
 * blast radius del leak de esa credencial es un riesgo aceptado a cambio
 * de que dar de alta un tenant nunca requiera redeploy del backend).
 *
 * Es seguro correr este script varias veces: la BD de control, sus tablas
 * y el GRANT amplio al usuario de aplicación se aseguran de forma
 * idempotente en cada corrida (CREATE ... IF NOT EXISTS / GRANT repetido
 * no falla). Dar de alta un slug que ya existe sí se rechaza explícitamente
 * (no se reintenta ni se sobreescribe).
 *
 * Segmento 9c (ver PROJECT_STATE.md): si el slug ya existe pero su fila
 * está en estado 'provisioning', quiere decir que la solicitud de alta se
 * capturó desde la app de control (/control, sin privilegios root) y este
 * script la COMPLETA en vez de rechazarla — reutiliza los valores de la
 * fila (incluida la infraestructura derivada por el intake). En ese caso
 * el nombre de la empresa es opcional en el CLI: si se pasa, actualiza
 * el de la fila; si no, se usa el capturado.
 */

const mysql = require('mysql2/promise');
const { validarSlug, nombreDbTenant } = require('../utils/tenant');
const {
  CONTROL_DB_NAME,
  fail,
  leerConexionDesdeEnv,
  asegurarControlYPrivilegios,
  registrarEvento,
  correrEsquemaEnProcesoHijo,
} = require('./lib/controlDb');

function leerArgumentos(argv) {
  const [, , slugArg, nombreEmpresaArg, ...resto] = argv;
  if (!slugArg) {
    fail('Uso: node provisionar-tenant.js <slug> ["<Nombre de la empresa>"] [--contacto-email=correo@empresa.com]');
  }
  const contactoEmailFlag = resto.find((a) => a.startsWith('--contacto-email='));
  return {
    slug: slugArg.toLowerCase(),
    // Nombre de la empresa es OPCIONAL solo cuando el slug ya tiene una
    // solicitud capturada desde /control (estado 'provisioning') — la
    // validación real de que hace falta se hace en main(), donde ya se
    // sabe si la fila existe.
    nombreEmpresa: nombreEmpresaArg,
    contactoEmail: contactoEmailFlag ? contactoEmailFlag.slice('--contacto-email='.length) : null,
  };
}

async function main() {
  const { slug, nombreEmpresa, contactoEmail } = leerArgumentos(process.argv);

  const errorSlug = validarSlug(slug);
  if (errorSlug) fail(errorSlug);

  const { dbHost, dbPort, rootPassword, appUser, appPassword, controlAppPassword } = leerConexionDesdeEnv();
  const dbName = nombreDbTenant(slug);

  const root = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: 'root',
    password: rootPassword,
  });

  let tenantId = null;
  try {
    await asegurarControlYPrivilegios(root, appUser, controlAppPassword);

    const [existentes] = await root.query(
      `SELECT * FROM \`${CONTROL_DB_NAME}\`.tenants WHERE slug = ?`,
      [slug]
    );

    // ----- Rama 9c: la solicitud ya fue capturada desde /control -----
    // La fila existe en estado 'provisioning': este script la completa.
    // Reutiliza los valores que ya dejó el intake (incluida la infra de
    // la BD del tenant) — el CLI solo puede afinar nombre/contacto.
    let fila = existentes[0] || null;
    let nombreEmpresaFinal = nombreEmpresa ? nombreEmpresa.trim() : null;
    if (fila && fila.estado === 'provisioning') {
      nombreEmpresaFinal = nombreEmpresaFinal || fila.nombre_empresa;
      if (!nombreEmpresaFinal) {
        fail(
          `La solicitud capturada en /control para "${slug}" no trae nombre de empresa y no se pasó uno en el CLI — pásalo como segundo argumento.`
        );
      }
      if (nombreEmpresa || contactoEmail) {
        await root.query(
          `UPDATE \`${CONTROL_DB_NAME}\`.tenants SET nombre_empresa = ?, contacto_email = ? WHERE id = ?`,
          [nombreEmpresaFinal, contactoEmail !== null && contactoEmail !== undefined ? contactoEmail : fila.contacto_email, fila.id]
        );
      }
      tenantId = fila.id;
      console.log(
        `Solicitud capturada desde /control encontrada (${slug}) — completando su aprovisionamiento físico.`
      );
    } else if (fila) {
      // Existe pero NO es una solicitud pendiente: sigue siendo un error.
      fail(
        `El slug "${slug}" ya está registrado (estado actual: ${fila.estado}). Elige otro o revisa el registro existente.`
      );
    } else {
      // ----- Rama CLI tradicional: no hay fila, se crea desde cero -----
      if (!nombreEmpresa) {
        fail(
          `No existe una solicitud capturada en /control para "${slug}" y no se pasó el nombre de la empresa — el nombre es obligatorio en el CLI.`
        );
      }
      nombreEmpresaFinal = nombreEmpresa.trim();
      await root.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );

      const [insertResult] = await root.query(
        `INSERT INTO \`${CONTROL_DB_NAME}\`.tenants
          (slug, nombre_empresa, estado, db_host, db_name, db_user, storage_prefix, contacto_email, creado_en)
         VALUES (?, ?, 'provisioning', ?, ?, ?, ?, ?, ?)`,
        [slug, nombreEmpresaFinal, dbHost, dbName, appUser, slug, contactoEmail, new Date()]
      );
      tenantId = insertResult.insertId;
      await registrarEvento(root, tenantId, 'alta_iniciada', `slug=${slug} db=${dbName}`, 'provisionar-tenant.js');
    }

    // En la rama 9c la BD física pudo no existir todavía (el intake nunca
    // crea bases) — IF NOT EXISTS cubre ambos casos sin importar quién
    // llegó primero a crear la base.
    const nombreDbFinal = fila ? fila.db_name : dbName;
    await root.query(
      `CREATE DATABASE IF NOT EXISTS \`${nombreDbFinal}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    console.log(`Aplicando esquema en ${nombreDbFinal}...`);
    correrEsquemaEnProcesoHijo({
      // El proceso hijo corre desde el HOST (igual que este script, que
      // nunca corre dentro de un contenedor) — se conecta a la MISMA
      // instancia a la que root se conectó arriba (dbHost/dbPort del env).
      // fila.db_host/fila.db_user describen cómo los CONTENEDORES alcanzan
      // la BD ('mysql', nombre de servicio Docker) y desde el host no
      // resuelven — usar esos valores aquí es el bug del segmento 9c que
      // se corrigió en validación (ver PROJECT_STATE.md punto 101).
      dbHost,
      dbPort,
      appUser,
      appPassword,
      dbName: nombreDbFinal,
    });

    await root.query(
      `UPDATE \`${CONTROL_DB_NAME}\`.tenants SET estado = 'activo', activado_en = ? WHERE id = ?`,
      [new Date(), tenantId]
    );
    await registrarEvento(root, tenantId, 'alta_completada', null, 'provisionar-tenant.js');

    console.log(`Tenant "${slug}" (${nombreEmpresaFinal}) aprovisionado correctamente.`);
    console.log(`  Base de datos: ${nombreDbFinal}`);
    console.log(`  Ruta prevista: /${slug} y /${slug}/admin`);
  } catch (err) {
    if (tenantId) {
      await registrarEvento(root, tenantId, 'alta_fallida', String((err && err.message) || err), 'provisionar-tenant.js');
    }
    throw err;
  } finally {
    await root.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});