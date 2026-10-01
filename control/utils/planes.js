// Gobierno de funcionalidades por tenant (ver PROJECT_STATE.md, punto
// 347): catálogo de planes, independiente de cualquier tenant — se crea
// y nombra sin ningún cliente en mente, se asigna después (ver
// utils/tenantFeatures.js para la asignación/excepciones por tenant).
//
// Mismo patrón que utils/sucursales.js: soft-delete siempre (`activo`),
// nunca DELETE físico — `control_app` no tiene privilegio DELETE ni
// REFERENCES (validado contra MySQL real, ver control/scripts/ensureSchema.js).
// "Archivar" un plan con tenants ya asignados no los toca — solo deja de
// ofrecerse para asignar a empresas nuevas.

const { obtenerPool } = require('../db');

const MAX_NOMBRE = 80;
const MAX_DESCRIPCION = 255;

class ErrorPlan extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorPlan';
    this.codigo = codigo; // 'no_encontrado' | 'validacion'
  }
}

function numeroOpcional(valor, { campo, entero = false, min = 0 }) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || (entero && !Number.isInteger(n))) {
    throw new ErrorPlan(`${campo} inválido.`, 'validacion');
  }
  return n;
}

function booleano(valor) {
  return valor === true || valor === 1 || valor === '1';
}

// Valida y normaliza el body de crear/editar — lanza ErrorPlan si algo no
// pasa. `parcial`: en edición, un campo ausente del body simplemente no
// se toca (no se fuerza a su default).
function normalizarDatosPlan(datos = {}, { parcial = false } = {}) {
  const resultado = {};

  if (!parcial || datos.nombre !== undefined) {
    const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
    if (!nombre) throw new ErrorPlan('El nombre del plan es obligatorio.', 'validacion');
    if (nombre.length > MAX_NOMBRE) {
      throw new ErrorPlan(`El nombre no puede superar los ${MAX_NOMBRE} caracteres.`, 'validacion');
    }
    resultado.nombre = nombre;
  }

  if (!parcial || datos.descripcion !== undefined) {
    const descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() : '';
    if (descripcion.length > MAX_DESCRIPCION) {
      throw new ErrorPlan(`La descripción no puede superar los ${MAX_DESCRIPCION} caracteres.`, 'validacion');
    }
    resultado.descripcion = descripcion || null;
  }

  if (!parcial || datos.precio_mensual !== undefined) {
    resultado.precio_mensual = numeroOpcional(datos.precio_mensual, { campo: 'El precio mensual' });
  }
  if (!parcial || datos.precio_anual !== undefined) {
    resultado.precio_anual = numeroOpcional(datos.precio_anual, { campo: 'El precio anual' });
  }
  if (!parcial || datos.max_usuarios !== undefined) {
    resultado.max_usuarios = numeroOpcional(datos.max_usuarios, { campo: 'El máximo de usuarios', entero: true, min: 1 });
  }
  if (!parcial || datos.disco_cuota_mb !== undefined) {
    resultado.disco_cuota_mb = numeroOpcional(datos.disco_cuota_mb, { campo: 'La cuota de disco', entero: true, min: 1 });
  }
  if (!parcial || datos.orden !== undefined) {
    resultado.orden = numeroOpcional(datos.orden, { campo: 'El orden', entero: true, min: 0 }) || 0;
  }

  for (const campo of ['sucursales_habilitado', 'facturacion_habilitada', 'portal_clientes_habilitado', 'marca_lookfeel_habilitado']) {
    if (!parcial || datos[campo] !== undefined) {
      resultado[campo] = booleano(datos[campo]) ? 1 : 0;
    }
  }

  return resultado;
}

function mapearFila(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    precio_mensual: fila.precio_mensual === null ? null : Number(fila.precio_mensual),
    precio_anual: fila.precio_anual === null ? null : Number(fila.precio_anual),
    max_usuarios: fila.max_usuarios === null ? null : Number(fila.max_usuarios),
    sucursales_habilitado: Boolean(fila.sucursales_habilitado),
    facturacion_habilitada: Boolean(fila.facturacion_habilitada),
    portal_clientes_habilitado: Boolean(fila.portal_clientes_habilitado),
    marca_lookfeel_habilitado: Boolean(fila.marca_lookfeel_habilitado),
    disco_cuota_mb: fila.disco_cuota_mb === null ? null : Number(fila.disco_cuota_mb),
    activo: Boolean(fila.activo),
    orden: fila.orden,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
    total_tenants: fila.total_tenants === undefined ? undefined : Number(fila.total_tenants),
  };
}

// `incluirArchivados`: el catálogo que se ofrece para ASIGNAR a un tenant
// nuevo nunca debe incluir planes archivados (activo=0) — pero la
// pantalla de administración de planes sí necesita verlos para poder
// reactivarlos, así que se pide explícito con un parámetro, nunca por
// default.
async function listarPlanes({ incluirArchivados = false } = {}, db = obtenerPool()) {
  const [planes] = await db.query(
    `SELECT p.*, (SELECT COUNT(*) FROM tenants t WHERE t.plan_id = p.id) AS total_tenants
     FROM planes p
     ${incluirArchivados ? '' : 'WHERE p.activo = 1'}
     ORDER BY p.orden ASC, p.nombre ASC`
  );
  return planes.map(mapearFila);
}

async function obtenerPlan(id, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT p.*, (SELECT COUNT(*) FROM tenants t WHERE t.plan_id = p.id) AS total_tenants
     FROM planes p WHERE p.id = ?`,
    [id]
  );
  const plan = filas[0];
  if (!plan) throw new ErrorPlan('El plan no existe.', 'no_encontrado');
  return mapearFila(plan);
}

async function crearPlan(datos = {}, db = obtenerPool()) {
  const normalizado = normalizarDatosPlan(datos, { parcial: false });
  const ahora = new Date();
  const [resultado] = await db.query(
    `INSERT INTO planes
       (nombre, descripcion, precio_mensual, precio_anual, max_usuarios,
        sucursales_habilitado, facturacion_habilitada, portal_clientes_habilitado,
        marca_lookfeel_habilitado, disco_cuota_mb, activo, orden, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      normalizado.nombre,
      normalizado.descripcion,
      normalizado.precio_mensual,
      normalizado.precio_anual,
      normalizado.max_usuarios,
      normalizado.sucursales_habilitado,
      normalizado.facturacion_habilitada,
      normalizado.portal_clientes_habilitado,
      normalizado.marca_lookfeel_habilitado,
      normalizado.disco_cuota_mb,
      normalizado.orden,
      ahora,
      ahora,
    ]
  );
  return obtenerPlan(resultado.insertId, db);
}

async function actualizarPlan(id, datos = {}, db = obtenerPool()) {
  const [existentes] = await db.query('SELECT id FROM planes WHERE id = ?', [id]);
  if (existentes.length === 0) throw new ErrorPlan('El plan no existe.', 'no_encontrado');

  const normalizado = normalizarDatosPlan(datos, { parcial: true });
  const campos = Object.keys(normalizado);
  if (campos.length === 0) throw new ErrorPlan('No hay cambios que aplicar.', 'validacion');

  const asignaciones = campos.map((c) => `${c} = ?`);
  const valores = campos.map((c) => normalizado[c]);
  asignaciones.push('actualizado_en = ?');
  valores.push(new Date());
  valores.push(id);

  await db.query(`UPDATE planes SET ${asignaciones.join(', ')} WHERE id = ?`, valores);
  return obtenerPlan(id, db);
}

// Archivar/reactivar: nunca DELETE — ver nota de cabecera. Archivar un
// plan con tenants asignados es válido a propósito (deja de ofrecerse
// para asignaciones NUEVAS, los tenants ya asignados no se tocan).
async function archivarPlan(id, db = obtenerPool()) {
  const [existentes] = await db.query('SELECT id FROM planes WHERE id = ?', [id]);
  if (existentes.length === 0) throw new ErrorPlan('El plan no existe.', 'no_encontrado');
  await db.query('UPDATE planes SET activo = 0, actualizado_en = ? WHERE id = ?', [new Date(), id]);
  return obtenerPlan(id, db);
}

async function reactivarPlan(id, db = obtenerPool()) {
  const [existentes] = await db.query('SELECT id FROM planes WHERE id = ?', [id]);
  if (existentes.length === 0) throw new ErrorPlan('El plan no existe.', 'no_encontrado');
  await db.query('UPDATE planes SET activo = 1, actualizado_en = ? WHERE id = ?', [new Date(), id]);
  return obtenerPlan(id, db);
}

module.exports = {
  ErrorPlan,
  listarPlanes,
  obtenerPlan,
  crearPlan,
  actualizarPlan,
  archivarPlan,
  reactivarPlan,
};
