// Ciclo de vida de tenants ya existentes (segmento 9, movido a este
// contenedor propio en el segmento 9b — ver PROJECT_STATE.md) —
// listar/suspender/reactivar/dar de baja empresas ya provisionadas.
// Deliberadamente NO incluye crear un tenant nuevo: eso requiere
// privilegios root de MySQL (CREATE DATABASE + GRANT) que este
// contenedor nunca tiene montados — sigue siendo el script CLI
// backend/scripts/provisionar-tenant.js, corrido a mano por un operador.

const { obtenerPool } = require('../db');
const { notificarInvalidacionCache } = require('./notificarBackend');

// Error tipado para que la capa de rutas distinga "el tenant no existe"
// (404) de "el tenant existe pero no está en un estado válido para esta
// transición" (409) sin tener que volver a consultar la fila.
class ErrorTransicionTenant extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorTransicionTenant';
    this.codigo = codigo; // 'no_encontrado' | 'estado_invalido'
  }
}

async function registrarEvento(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

async function listarTenants({ estado, q } = {}, db = obtenerPool()) {
  const condiciones = [];
  const parametros = [];
  if (estado) {
    condiciones.push('estado = ?');
    parametros.push(estado);
  }
  if (q) {
    condiciones.push('(slug LIKE ? OR nombre_empresa LIKE ?)');
    parametros.push(`%${q}%`, `%${q}%`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await db.query(
    `SELECT id, slug, nombre_empresa, estado, contacto_email, creado_en, activado_en, suspendido_en, baja_en,
            marca, marca_logo_url, tema_json
     FROM tenants ${where} ORDER BY creado_en DESC`,
    parametros
  );
  return filas;
}

async function obtenerTenantPorSlug(slug, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT id, slug, nombre_empresa, estado, contacto_email, creado_en, activado_en, suspendido_en, baja_en
     FROM tenants WHERE slug = ?`,
    [slug]
  );
  return filas[0] || null;
}

// Aplica una transición de estado con guarda atómica en el propio UPDATE
// (WHERE slug=? AND estado IN (...)) en vez de SELECT-luego-UPDATE, para
// que una condición de carrera entre dos acciones concurrentes sobre el
// mismo tenant no aplique una transición inválida. affectedRows === 0
// distingue "no existe" de "existe pero en el estado equivocado" con una
// consulta de más, solo cuando hace falta el mensaje de error exacto.
//
// notificarInvalidacionCache(slug) es fire-and-forget a propósito: si
// falla (backend no alcanzable), el estado en BD ya quedó correcto — en
// el peor caso, la caché de tenant del backend tarda su TTL normal
// (hasta 45s) en corregirse sola, degradando con gracia en vez de
// tumbar una transición que sí se aplicó.
async function aplicarTransicion(db, { slug, estadosOrigen, estadoDestino, columnaTimestamp, tipoEvento, actor }) {
  const [resultado] = await db.query(
    `UPDATE tenants SET estado = ?, ${columnaTimestamp} = NOW() WHERE slug = ? AND estado IN (${estadosOrigen.map(() => '?').join(',')})`,
    [estadoDestino, slug, ...estadosOrigen]
  );

  if (resultado.affectedRows === 0) {
    const tenant = await obtenerTenantPorSlug(slug, db);
    if (!tenant) {
      throw new ErrorTransicionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
    }
    throw new ErrorTransicionTenant(
      `El tenant "${slug}" está en estado "${tenant.estado}", no se puede pasar a "${estadoDestino}" desde ahí.`,
      'estado_invalido'
    );
  }

  const tenant = await obtenerTenantPorSlug(slug, db);
  await registrarEvento(db, tenant.id, tipoEvento, `estado -> ${estadoDestino}`, actor);
  notificarInvalidacionCache(slug).catch((err) =>
    console.error('No se pudo notificar al backend para invalidar la caché de tenant:', err.message)
  );
  return tenant;
}

async function suspenderTenant(slug, { actor } = {}, db = obtenerPool()) {
  return aplicarTransicion(db, {
    slug,
    estadosOrigen: ['activo'],
    estadoDestino: 'suspendido',
    columnaTimestamp: 'suspendido_en',
    tipoEvento: 'suspension',
    actor,
  });
}

async function reactivarTenant(slug, { actor } = {}, db = obtenerPool()) {
  return aplicarTransicion(db, {
    slug,
    estadosOrigen: ['suspendido', 'baja'],
    estadoDestino: 'activo',
    columnaTimestamp: 'activado_en',
    tipoEvento: 'reactivacion',
    actor,
  });
}

async function darDeBajaTenant(slug, { actor } = {}, db = obtenerPool()) {
  // No-destructivo por diseño: solo cambia "estado" — NUNCA borra la base
  // de datos tenant_<slug> ni su prefijo en MinIO. Mismo espíritu que
  // cutover-tenant-piloto.js, que tampoco toca nunca los datos origen.
  return aplicarTransicion(db, {
    slug,
    estadosOrigen: ['activo', 'suspendido'],
    estadoDestino: 'baja',
    columnaTimestamp: 'baja_en',
    tipoEvento: 'baja',
    actor,
  });
}

module.exports = {
  ErrorTransicionTenant,
  listarTenants,
  obtenerTenantPorSlug,
  suspenderTenant,
  reactivarTenant,
  darDeBajaTenant,
};
