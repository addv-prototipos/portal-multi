// §58: agrupar tenants como sucursales del mismo negocio, con usuarios de
// acceso compartidos válidos en cualquier sucursal asociada. Decisiones
// cerradas (ver inventarios.md §58 y PROJECT_STATE.md): (1) lo único
// compartido es el LOGIN — cada tenant sigue con su propia BD/inventario/
// ventas 100% aislados; (2) un tenant vive en máximo UN grupo; (3) todos
// los usuarios de un grupo ven todas las sucursales asociadas, sin
// distinción por usuario; (4) solo /control (este servicio) asocia/
// desasocia sucursales y administra los usuarios compartidos; (5) la
// auditoría de cada acción sigue viviendo en la BD del tenant donde
// ocurrió, sin vista cruzada nueva; (6) la credencial vive SOLO en la BD
// de control — el backend la verifica en vivo (obtenerPoolControl(), la
// misma conexión que ya usa para resolver cualquier tenant por slug) en
// vez de replicarla en la tabla `usuarios` de cada tenant asociado.

const { obtenerPool } = require('../db');
const { validarSlug } = require('./tenant');
const { notificarInvalidacionCache } = require('./notificarBackend');
const { hashPasswordApi } = require('./apiCredenciales');

const PERFILES_VALIDOS = ['administrador', 'fiscal'];
const MAX_NOMBRE_GRUPO = 200;

// Error tipado para que la capa de rutas distinga 404/400/409 — mismo
// patrón que ErrorMarcaTenant/ErrorTemaTenant/ErrorEdicionTenant.
class ErrorSucursal extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorSucursal';
    this.codigo = codigo; // 'no_encontrado' | 'validacion' | 'conflicto'
  }
}

async function registrarEvento(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

async function invalidarCacheSlug(slug) {
  try {
    await notificarInvalidacionCache(slug);
  } catch (err) {
    console.error(`No se pudo invalidar la caché del backend para "${slug}":`, err.message);
  }
}

function validarNombreGrupo(nombre) {
  const limpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (!limpio) return { error: 'El nombre del grupo es obligatorio.' };
  if (limpio.length > MAX_NOMBRE_GRUPO) {
    return { error: `El nombre no puede superar los ${MAX_NOMBRE_GRUPO} caracteres.` };
  }
  return { nombre: limpio };
}

function limpiarSlugs(slugs) {
  return [...new Set((Array.isArray(slugs) ? slugs : []).map((s) => String(s || '').trim().toLowerCase()))].filter(Boolean);
}

async function listarGruposSucursal(db = obtenerPool()) {
  const [grupos] = await db.query(
    'SELECT id, nombre, creado_en, actualizado_en FROM grupos_sucursal WHERE activo = 1 ORDER BY nombre ASC'
  );
  const [tenantsFilas] = await db.query(
    'SELECT slug, nombre_empresa, grupo_sucursal_id FROM tenants WHERE grupo_sucursal_id IS NOT NULL'
  );
  const [usuariosConteo] = await db.query(
    'SELECT grupo_sucursal_id, COUNT(*) AS total FROM usuarios_sucursal GROUP BY grupo_sucursal_id'
  );
  const conteoPorGrupo = new Map(usuariosConteo.map((f) => [f.grupo_sucursal_id, Number(f.total)]));
  return grupos.map((g) => ({
    ...g,
    tenants: tenantsFilas
      .filter((t) => t.grupo_sucursal_id === g.id)
      .map((t) => ({ slug: t.slug, nombre_empresa: t.nombre_empresa })),
    total_usuarios: conteoPorGrupo.get(g.id) || 0,
  }));
}

async function obtenerGrupoSucursal(id, db = obtenerPool()) {
  const [grupos] = await db.query(
    'SELECT id, nombre, creado_en, actualizado_en FROM grupos_sucursal WHERE id = ? AND activo = 1',
    [id]
  );
  const grupo = grupos[0];
  if (!grupo) throw new ErrorSucursal('El grupo de sucursales no existe.', 'no_encontrado');
  const [tenantsFilas] = await db.query(
    'SELECT slug, nombre_empresa FROM tenants WHERE grupo_sucursal_id = ? ORDER BY nombre_empresa ASC',
    [id]
  );
  const [usuarios] = await db.query(
    'SELECT id, usuario, perfil, activo, creado_en FROM usuarios_sucursal WHERE grupo_sucursal_id = ? ORDER BY usuario ASC',
    [id]
  );
  return { ...grupo, tenants: tenantsFilas, usuarios: usuarios.map((u) => ({ ...u, activo: Boolean(u.activo) })) };
}

// Asocia una lista de slugs a un grupo ya existente — todo o nada: si
// cualquier slug no existe o ya pertenece a OTRO grupo, no se asocia
// ninguno de la lista (un tenant vive en máximo un grupo, decisión
// cerrada del segmento).
async function asociarTenantsAGrupo(grupoId, slugs, { actor, db = obtenerPool() } = {}) {
  if (slugs.length === 0) return;
  for (const slug of slugs) {
    const errorSlug = validarSlug(slug);
    if (errorSlug) throw new ErrorSucursal(`Slug inválido: ${slug}`, 'validacion');
  }

  const [filasTenants] = await db.query(
    `SELECT id, slug, grupo_sucursal_id FROM tenants WHERE slug IN (${slugs.map(() => '?').join(',')})`,
    slugs
  );
  const encontrados = new Map(filasTenants.map((t) => [t.slug, t]));
  for (const slug of slugs) {
    const tenant = encontrados.get(slug);
    if (!tenant) throw new ErrorSucursal(`El tenant "${slug}" no existe.`, 'no_encontrado');
    if (tenant.grupo_sucursal_id && tenant.grupo_sucursal_id !== grupoId) {
      throw new ErrorSucursal(`El tenant "${slug}" ya pertenece a otro grupo de sucursales.`, 'conflicto');
    }
  }

  for (const slug of slugs) {
    const tenant = encontrados.get(slug);
    if (tenant.grupo_sucursal_id === grupoId) continue; // ya asociado, no-op
    await db.query('UPDATE tenants SET grupo_sucursal_id = ? WHERE slug = ?', [grupoId, slug]);
    await registrarEvento(db, tenant.id, 'sucursal_asociada', `grupo_sucursal_id=${grupoId}`, actor || null);
    await invalidarCacheSlug(slug);
  }
}

async function desasociarTenantDeGrupo(grupoId, slug, { actor, db = obtenerPool() } = {}) {
  const errorSlug = validarSlug(slug);
  if (errorSlug) throw new ErrorSucursal('Slug inválido.', 'validacion');
  const [filas] = await db.query('SELECT id, grupo_sucursal_id FROM tenants WHERE slug = ?', [slug]);
  const tenant = filas[0];
  if (!tenant || tenant.grupo_sucursal_id !== grupoId) {
    throw new ErrorSucursal(`El tenant "${slug}" no pertenece a este grupo.`, 'no_encontrado');
  }
  await db.query('UPDATE tenants SET grupo_sucursal_id = NULL WHERE slug = ?', [slug]);
  await registrarEvento(db, tenant.id, 'sucursal_desasociada', `grupo_sucursal_id=${grupoId}`, actor || null);
  await invalidarCacheSlug(slug);
}

async function crearGrupoSucursal({ nombre, slugs = [] } = {}, { actor, db = obtenerPool() } = {}) {
  const validacionNombre = validarNombreGrupo(nombre);
  if (validacionNombre.error) throw new ErrorSucursal(validacionNombre.error, 'validacion');

  const slugsLimpios = limpiarSlugs(slugs);

  const ahora = new Date();
  const [resultado] = await db.query(
    'INSERT INTO grupos_sucursal (nombre, creado_en, actualizado_en) VALUES (?, ?, ?)',
    [validacionNombre.nombre, ahora, ahora]
  );
  const grupoId = resultado.insertId;

  if (slugsLimpios.length > 0) {
    await asociarTenantsAGrupo(grupoId, slugsLimpios, { actor, db });
  }

  return obtenerGrupoSucursal(grupoId, db);
}

async function actualizarGrupoSucursal(
  id,
  { nombre, agregarSlugs = [], quitarSlugs = [] } = {},
  { actor, db = obtenerPool() } = {}
) {
  const [grupos] = await db.query('SELECT id FROM grupos_sucursal WHERE id = ? AND activo = 1', [id]);
  if (grupos.length === 0) throw new ErrorSucursal('El grupo de sucursales no existe.', 'no_encontrado');

  if (typeof nombre === 'string') {
    const validacion = validarNombreGrupo(nombre);
    if (validacion.error) throw new ErrorSucursal(validacion.error, 'validacion');
    await db.query('UPDATE grupos_sucursal SET nombre = ?, actualizado_en = ? WHERE id = ?', [
      validacion.nombre,
      new Date(),
      id,
    ]);
  }

  const slugsAgregar = limpiarSlugs(agregarSlugs);
  if (slugsAgregar.length > 0) {
    await asociarTenantsAGrupo(id, slugsAgregar, { actor, db });
  }

  const slugsQuitar = limpiarSlugs(quitarSlugs);
  for (const slug of slugsQuitar) {
    await desasociarTenantDeGrupo(id, slug, { actor, db });
  }

  return obtenerGrupoSucursal(id, db);
}

// Disolver el grupo: SOFT-DELETE (activo = 0), nunca DELETE — el usuario
// `control_app` no tiene privilegio DELETE ni REFERENCES (validado contra
// MySQL real, mismo motivo que la ausencia de FK en el esquema), así que
// ni un DELETE ni un ON DELETE CASCADE funcionarían aquí. Los tenants
// asociados se sueltan (grupo_sucursal_id = NULL) y los usuarios
// compartidos se desactivan a mano, en su lugar.
async function eliminarGrupoSucursal(id, { actor, db = obtenerPool() } = {}) {
  const [grupos] = await db.query('SELECT id FROM grupos_sucursal WHERE id = ? AND activo = 1', [id]);
  if (grupos.length === 0) throw new ErrorSucursal('El grupo de sucursales no existe.', 'no_encontrado');

  const [tenantsFilas] = await db.query('SELECT id, slug FROM tenants WHERE grupo_sucursal_id = ?', [id]);
  for (const tenant of tenantsFilas) {
    await registrarEvento(db, tenant.id, 'sucursal_desasociada', `grupo_sucursal_id=${id} (grupo eliminado)`, actor || null);
  }
  await db.query('UPDATE tenants SET grupo_sucursal_id = NULL WHERE grupo_sucursal_id = ?', [id]);
  await db.query('UPDATE usuarios_sucursal SET activo = 0, actualizado_en = ? WHERE grupo_sucursal_id = ?', [
    new Date(),
    id,
  ]);
  await db.query('UPDATE grupos_sucursal SET activo = 0, actualizado_en = ? WHERE id = ?', [new Date(), id]);
  for (const tenant of tenantsFilas) {
    await invalidarCacheSlug(tenant.slug);
  }
  return { eliminado: true };
}

// ---------- Usuarios compartidos ----------

function validarUsuarioSucursal({ usuario, password, perfil }) {
  const usuarioLimpio = typeof usuario === 'string' ? usuario.trim() : '';
  if (!usuarioLimpio) return { error: 'El usuario es obligatorio.' };
  if (usuarioLimpio.length > 100) return { error: 'El usuario no puede superar los 100 caracteres.' };
  if (!PERFILES_VALIDOS.includes(perfil)) {
    return { error: 'Perfil inválido — debe ser "administrador" o "fiscal".' };
  }
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  return { usuario: usuarioLimpio, perfil };
}

async function crearUsuarioSucursal(grupoId, datos = {}, { actor, db = obtenerPool() } = {}) {
  const [grupos] = await db.query('SELECT id FROM grupos_sucursal WHERE id = ? AND activo = 1', [grupoId]);
  if (grupos.length === 0) throw new ErrorSucursal('El grupo de sucursales no existe.', 'no_encontrado');

  const validacion = validarUsuarioSucursal(datos);
  if (validacion.error) throw new ErrorSucursal(validacion.error, 'validacion');

  const [existentes] = await db.query(
    'SELECT id FROM usuarios_sucursal WHERE grupo_sucursal_id = ? AND usuario = ?',
    [grupoId, validacion.usuario]
  );
  if (existentes.length > 0) {
    throw new ErrorSucursal('Ya existe un usuario con ese nombre en este grupo.', 'conflicto');
  }

  const ahora = new Date();
  const passwordHash = hashPasswordApi(datos.password);
  const [resultado] = await db.query(
    `INSERT INTO usuarios_sucursal (grupo_sucursal_id, usuario, password_hash, perfil, activo, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [grupoId, validacion.usuario, passwordHash, validacion.perfil, ahora, ahora]
  );
  return { id: resultado.insertId, usuario: validacion.usuario, perfil: validacion.perfil, activo: true };
}

async function actualizarUsuarioSucursal(grupoId, usuarioId, datos = {}, { db = obtenerPool() } = {}) {
  const [filas] = await db.query('SELECT id FROM usuarios_sucursal WHERE id = ? AND grupo_sucursal_id = ?', [
    usuarioId,
    grupoId,
  ]);
  if (filas.length === 0) throw new ErrorSucursal('El usuario no existe en este grupo.', 'no_encontrado');

  const campos = [];
  const valores = [];
  if (typeof datos.password === 'string' && datos.password) {
    if (datos.password.length < 8) throw new ErrorSucursal('La contraseña debe tener al menos 8 caracteres.', 'validacion');
    campos.push('password_hash = ?');
    valores.push(hashPasswordApi(datos.password));
  }
  if (typeof datos.perfil === 'string') {
    if (!PERFILES_VALIDOS.includes(datos.perfil)) throw new ErrorSucursal('Perfil inválido.', 'validacion');
    campos.push('perfil = ?');
    valores.push(datos.perfil);
  }
  if (typeof datos.activo === 'boolean') {
    campos.push('activo = ?');
    valores.push(datos.activo ? 1 : 0);
  }
  if (campos.length === 0) throw new ErrorSucursal('No hay cambios que aplicar.', 'validacion');

  campos.push('actualizado_en = ?');
  valores.push(new Date());
  valores.push(usuarioId);
  await db.query(`UPDATE usuarios_sucursal SET ${campos.join(', ')} WHERE id = ?`, valores);
  return { actualizado: true };
}

module.exports = {
  ErrorSucursal,
  listarGruposSucursal,
  obtenerGrupoSucursal,
  crearGrupoSucursal,
  actualizarGrupoSucursal,
  eliminarGrupoSucursal,
  desasociarTenantDeGrupo,
  crearUsuarioSucursal,
  actualizarUsuarioSucursal,
};
