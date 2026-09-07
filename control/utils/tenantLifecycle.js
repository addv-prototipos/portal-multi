// Ciclo de vida de tenants ya existentes (segmento 9, movido a este
// contenedor propio en el segmento 9b — ver PROJECT_STATE.md) —
// listar/suspender/reactivar/dar de baja/activar empresas.
// "Activar" (completar el aprovisionamiento físico de una fila en
// "provisioning") es la única transición que este contenedor no puede
// hacer con su propia credencial (`control_app`, sin acceso a
// `tenant_*`) — delega esa parte al backend vía
// notificarBackend.js:activarTenantFisico() (secreto compartido, mismo
// patrón que la invalidación de caché), que la ejecuta con las
// credenciales de aplicación que YA tiene montadas (nunca root — ver el
// endpoint interno en backend/server.js para el detalle completo). El
// CLI `backend/scripts/provisionar-tenant.js` sigue existiendo como
// respaldo manual si ese privilegio llegara a faltar.

const { obtenerPool } = require('../db');
const { notificarInvalidacionCache, activarTenantFisico } = require('./notificarBackend');

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

// A diferencia de aplicarTransicion() (guarda atómica en un solo UPDATE),
// "activar" necesita un paso intermedio que SÍ puede fallar (crear la
// base de datos física en el backend) — por eso se verifica el estado
// ANTES de intentarlo, en vez de confiar solo en el UPDATE con guarda:
// si el paso físico falla, no debe quedar ninguna escritura a medias en
// `tenants`. Sigue siendo seguro ante 2 clics concurrentes: si ambos
// pasan la verificación y ambos llaman a activarTenantFisico() (CREATE
// DATABASE IF NOT EXISTS es idempotente, inofensivo repetirlo), solo uno
// gana la carrera del UPDATE atómico de aplicarTransicion() — el otro
// recibe 409 "ya no está en provisioning", nunca una doble aplicación.
async function activarTenant(slug, { actor } = {}, db = obtenerPool()) {
  const tenant = await obtenerTenantPorSlug(slug, db);
  if (!tenant) {
    throw new ErrorTransicionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }
  if (tenant.estado !== 'provisioning') {
    throw new ErrorTransicionTenant(
      `El tenant "${slug}" está en estado "${tenant.estado}", no se puede activar desde ahí (solo aplica a "Provisionando").`,
      'estado_invalido'
    );
  }

  try {
    await activarTenantFisico(slug);
  } catch (err) {
    throw new ErrorTransicionTenant(
      err.message || 'No se pudo crear la base de datos del tenant.',
      'error_fisico'
    );
  }

  return aplicarTransicion(db, {
    slug,
    estadosOrigen: ['provisioning'],
    estadoDestino: 'activo',
    columnaTimestamp: 'activado_en',
    tipoEvento: 'alta_completada',
    actor,
  });
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
  activarTenant,
  suspenderTenant,
  reactivarTenant,
  darDeBajaTenant,
};
