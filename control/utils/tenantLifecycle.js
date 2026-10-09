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
const { notificarInvalidacionCache, activarTenantFisico, eliminarTenantFisico, calcularUsoDiscoFisico, ErrorCalculoDisco } = require('./notificarBackend');

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
    condiciones.push('t.estado = ?');
    parametros.push(estado);
  }
  if (q) {
    condiciones.push('(t.slug LIKE ? OR t.nombre_empresa LIKE ?)');
    parametros.push(`%${q}%`, `%${q}%`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await db.query(
    `SELECT t.id, t.slug, t.nombre_empresa, t.estado, t.contacto_email, t.creado_en, t.activado_en, t.suspendido_en, t.baja_en,
            t.marca, t.marca_logo_url, t.tema_json,
            t.marca_lookfeel_habilitado, t.max_usuarios,
            t.plan_id, t.plan_actualizado_en, p.nombre AS plan_nombre,
            t.facturacion_habilitada, t.portal_clientes_habilitado, t.sucursales_habilitado,
            t.disco_cuota_mb, t.disco_bytes_usados_cache, t.disco_cache_actualizado_en,
            t.suscripcion_en_prueba, t.suscripcion_dias_prueba, t.suscripcion_prueba_inicia_en,
            t.suscripcion_ciclo, t.suscripcion_expira_en, t.suscripcion_estatus
     FROM tenants t LEFT JOIN planes p ON p.id = t.plan_id
     ${where}
     ORDER BY t.creado_en DESC`,
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

// Elimina un tenant PARA SIEMPRE (punto 345, "papelera") — DROP DATABASE
// + purga de MinIO + borrado de sus filas en control_tenants
// (tenants/tenant_eventos/api_credenciales). Candado de seguridad:
// SOLO se puede eliminar desde "baja" (fin de la relación comercial ya
// confirmado antes) — nunca directo desde "activo"/"suspendido", 2
// pasos deliberados para algo irreversible.
//
// `control_app` no tiene privilegio DELETE (angosto a propósito, ver
// control/scripts/ensureSchema.js) — ni para las filas de aquí ni para
// nada físico, así que TODO el borrado (base de datos + archivos + las
// 3 tablas de control) se delega al backend en una sola llamada
// (eliminarTenantFisico → POST /internal/eliminar-tenant/:slug, que
// hace su propia verificación atómica de "sigue en baja" antes de
// borrar nada — nunca confía ciegamente en lo que ya revisó control).
// admin_auditoria NUNCA se toca — se conserva como rastro histórico, a
// petición explícita del usuario.
async function eliminarTenantDefinitivo(slug, { actor } = {}, db = obtenerPool()) {
  const tenant = await obtenerTenantPorSlug(slug, db);
  if (!tenant) {
    throw new ErrorTransicionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }
  if (tenant.estado !== 'baja') {
    throw new ErrorTransicionTenant(
      `El tenant "${slug}" está en estado "${tenant.estado}", no se puede eliminar desde ahí (solo aplica a "Baja").`,
      'estado_invalido'
    );
  }

  try {
    await eliminarTenantFisico(slug);
  } catch (err) {
    throw new ErrorTransicionTenant(
      err.message || 'No se pudo eliminar la base de datos del tenant.',
      'error_fisico'
    );
  }

  return tenant;
}

// Vacía TODA la papelera de una sentada — llama a eliminarTenantDefinitivo
// una vez por cada tenant en "baja", secuencial (nunca en paralelo: N
// DROP DATABASE simultáneos son innecesariamente pesados para MySQL). Un
// tenant que falla NO detiene a los demás — se acumula en `fallidos` y
// se sigue con el resto, para que un solo error no deje la papelera a
// medio vaciar sin ninguna explicación de qué sí y qué no.
async function vaciarPapelera({ actor } = {}, db = obtenerPool()) {
  const enBaja = await listarTenants({ estado: 'baja' }, db);
  const eliminados = [];
  const fallidos = [];
  for (const t of enBaja) {
    try {
      await eliminarTenantDefinitivo(t.slug, { actor }, db);
      eliminados.push(t.slug);
    } catch (err) {
      fallidos.push({ slug: t.slug, error: err.message });
    }
  }
  return { eliminados, fallidos };
}

// Punto 347 (gobierno de funcionalidades): recalcula el uso real de disco
// de un tenant — le pide al backend que sume los bytes en MinIO (única
// credencial que los tiene, ver notificarBackend.js) y guarda el
// resultado en caché. Nunca se llama en el camino de una request normal
// de otra ruta — solo bajo demanda del botón "Recalcular" en /control.
async function recalcularUsoDisco(slug, { actor } = {}, db = obtenerPool()) {
  const tenant = await obtenerTenantPorSlug(slug, db);
  if (!tenant) {
    throw new ErrorTransicionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  const bytes = await calcularUsoDiscoFisico(slug); // propaga ErrorCalculoDisco si falla — nunca escribe 0 a ciegas

  const ahora = new Date();
  await db.query('UPDATE tenants SET disco_bytes_usados_cache = ?, disco_cache_actualizado_en = ? WHERE id = ?', [
    bytes,
    ahora,
    tenant.id,
  ]);
  await registrarEvento(db, tenant.id, 'disco_recalculado', `disco_bytes_usados_cache: ${bytes}`, actor || null);

  return { ...tenant, disco_bytes_usados_cache: bytes, disco_cache_actualizado_en: ahora };
}

module.exports = {
  ErrorTransicionTenant,
  listarTenants,
  obtenerTenantPorSlug,
  activarTenant,
  suspenderTenant,
  reactivarTenant,
  darDeBajaTenant,
  eliminarTenantDefinitivo,
  vaciarPapelera,
  recalcularUsoDisco,
  ErrorCalculoDisco,
};
