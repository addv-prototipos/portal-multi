// Gate de Términos y Condiciones al final del onboarding (solo cuenta
// raíz) — ver tablas `terminos_versiones`/`terminos_aceptaciones` en
// control/scripts/ensureSchema.js. `control/` es dueño del dato: publica
// versiones y registra aceptaciones; `backend/` solo lee/escribe vía los
// endpoints internos de control/server.js (mismo patrón ya usado para
// ajustes_globales — "control escribe, backend consulta").

const { obtenerPool } = require('../db');

const SLUG_SITIO_BASE = '__base__';

async function listarVersiones() {
  const [filas] = await obtenerPool().query(
    'SELECT id, version, resumen_cambios, activo, publicado_por, creado_en FROM terminos_versiones ORDER BY creado_en DESC'
  );
  return filas;
}

async function obtenerVersionVigente() {
  const [filas] = await obtenerPool().query(
    'SELECT id, version, contenido, resumen_cambios, creado_en FROM terminos_versiones WHERE activo = 1 LIMIT 1'
  );
  return filas[0] || null;
}

async function obtenerVersionPorId(id) {
  const [filas] = await obtenerPool().query(
    'SELECT id, version, contenido, resumen_cambios, creado_en FROM terminos_versiones WHERE id = ? LIMIT 1',
    [id]
  );
  return filas[0] || null;
}

// Publicar una versión nueva SIEMPRE desactiva la anterior — solo una
// fila puede estar vigente a la vez (ver nota en ensureSchema.js). No hay
// UPDATE de contenido ya publicado: cada cambio es una fila nueva, nunca
// se edita una versión existente (eso rompería el historial de "qué
// aceptó cada cliente exactamente").
async function publicarVersion({ version, contenido, resumenCambios, publicadoPor }) {
  const versionLimpia = String(version || '').trim();
  const contenidoLimpio = String(contenido || '').trim();
  if (!versionLimpia) throw new Error('La versión es obligatoria.');
  if (!contenidoLimpio) throw new Error('El contenido no puede estar vacío.');
  const pool = obtenerPool();
  await pool.query('UPDATE terminos_versiones SET activo = 0 WHERE activo = 1');
  const [resultado] = await pool.query(
    'INSERT INTO terminos_versiones (version, contenido, resumen_cambios, activo, publicado_por, creado_en) VALUES (?, ?, ?, 1, ?, ?)',
    [versionLimpia, contenidoLimpio, resumenCambios ? String(resumenCambios).trim() : null, publicadoPor || null, new Date()]
  );
  return resultado.insertId;
}

async function registrarAceptacion({ tenantSlug, usuario, versionId, ip }) {
  await obtenerPool().query(
    'INSERT INTO terminos_aceptaciones (tenant_slug, usuario, version_id, aceptado_en, ip) VALUES (?, ?, ?, ?, ?)',
    [tenantSlug || SLUG_SITIO_BASE, String(usuario || '').trim(), versionId, new Date(), ip || null]
  );
}

// Punto clave para el gate: ¿la cuenta raíz de este tenant (o del sitio
// base) ya aceptó la versión VIGENTE? Si no hay versión vigente publicada
// todavía, nunca hay nada que aceptar (pendiente=false) — el gate no
// bloquea a nadie hasta que /control publique la primera versión.
async function obtenerEstadoParaTenant({ tenantSlug, usuario }) {
  const vigente = await obtenerVersionVigente();
  if (!vigente) return { pendiente: false, version: null };
  const slug = tenantSlug || SLUG_SITIO_BASE;
  const [filas] = await obtenerPool().query(
    'SELECT id FROM terminos_aceptaciones WHERE tenant_slug = ? AND usuario = ? AND version_id = ? LIMIT 1',
    [slug, String(usuario || '').trim(), vigente.id]
  );
  if (filas.length > 0) return { pendiente: false, version: null };
  return {
    pendiente: true,
    version: {
      id: vigente.id,
      version: vigente.version,
      contenido: vigente.contenido,
      resumenCambios: vigente.resumen_cambios,
    },
  };
}

async function listarHistorialTenant(tenantSlug) {
  const slug = tenantSlug || SLUG_SITIO_BASE;
  const [filas] = await obtenerPool().query(
    `SELECT a.usuario, a.aceptado_en, a.ip, v.version, v.resumen_cambios
     FROM terminos_aceptaciones a
     JOIN terminos_versiones v ON v.id = a.version_id
     WHERE a.tenant_slug = ?
     ORDER BY a.aceptado_en DESC`,
    [slug]
  );
  return filas;
}

module.exports = {
  SLUG_SITIO_BASE,
  listarVersiones,
  obtenerVersionVigente,
  obtenerVersionPorId,
  publicarVersion,
  registrarAceptacion,
  obtenerEstadoParaTenant,
  listarHistorialTenant,
};
