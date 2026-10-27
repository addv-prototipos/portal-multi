// Catálogo de funcionalidades "upscale" — se venden por separado, encima
// del plan base de un tenant (punto en curso). Mismo patrón que
// utils/planes.js: soft-delete siempre (`activo`), nunca DELETE físico
// (control_app sin privilegio DELETE). Solo el catálogo — asignar una
// funcionalidad a un tenant específico y facturarla de verdad es trabajo
// aparte, no incluido aquí.

const { obtenerPool } = require('../db');

const MAX_NOMBRE = 120;
const MAX_DESCRIPCION = 255;
const TIPOS_VALIDOS = ['recurrente', 'unico'];

class ErrorUpscale extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorUpscale';
    this.codigo = codigo; // 'no_encontrado' | 'validacion'
  }
}

function numeroOpcional(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) {
    throw new ErrorUpscale(`${campo} inválido.`, 'validacion');
  }
  return n;
}

function normalizarDatos(datos = {}, { parcial = false } = {}) {
  const resultado = {};

  if (!parcial || datos.nombre !== undefined) {
    const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
    if (!nombre) throw new ErrorUpscale('El nombre es obligatorio.', 'validacion');
    if (nombre.length > MAX_NOMBRE) throw new ErrorUpscale(`El nombre no puede superar los ${MAX_NOMBRE} caracteres.`, 'validacion');
    resultado.nombre = nombre;
  }

  if (!parcial || datos.descripcion !== undefined) {
    const descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() : '';
    if (descripcion.length > MAX_DESCRIPCION) throw new ErrorUpscale(`La descripción no puede superar los ${MAX_DESCRIPCION} caracteres.`, 'validacion');
    resultado.descripcion = descripcion || null;
  }

  if (!parcial || datos.tipo_cobro !== undefined) {
    const tipo = datos.tipo_cobro;
    if (!TIPOS_VALIDOS.includes(tipo)) throw new ErrorUpscale('Tipo de cobro inválido — debe ser "recurrente" o "unico".', 'validacion');
    resultado.tipo_cobro = tipo;
  }

  const tipoFinal = resultado.tipo_cobro || datos._tipoActual;
  if (!parcial || datos.precio_mensual !== undefined) resultado.precio_mensual = numeroOpcional(datos.precio_mensual, 'El precio mensual');
  if (!parcial || datos.precio_anual !== undefined) resultado.precio_anual = numeroOpcional(datos.precio_anual, 'El precio anual');
  if (!parcial || datos.precio_unico !== undefined) resultado.precio_unico = numeroOpcional(datos.precio_unico, 'El precio único');

  if (!parcial && tipoFinal === 'recurrente' && resultado.precio_mensual === null && resultado.precio_anual === null) {
    throw new ErrorUpscale('Una funcionalidad recurrente necesita precio mensual o anual.', 'validacion');
  }
  if (!parcial && tipoFinal === 'unico' && resultado.precio_unico === null) {
    throw new ErrorUpscale('Una funcionalidad de pago único necesita su precio.', 'validacion');
  }

  if (!parcial || datos.orden !== undefined) {
    const orden = numeroOpcional(datos.orden, 'El orden');
    resultado.orden = orden === null ? 0 : orden;
  }

  return resultado;
}

async function listarUpscale({ soloActivos = false } = {}, db = obtenerPool()) {
  const where = soloActivos ? 'WHERE activo = 1' : '';
  const [filas] = await db.query(`SELECT * FROM funcionalidades_upscale ${where} ORDER BY orden, id`);
  return filas;
}

async function obtenerUpscalePorId(id, db = obtenerPool()) {
  const [filas] = await db.query('SELECT * FROM funcionalidades_upscale WHERE id = ?', [id]);
  if (filas.length === 0) throw new ErrorUpscale('Funcionalidad no encontrada.', 'no_encontrado');
  return filas[0];
}

async function crearUpscale(datos, db = obtenerPool()) {
  const limpio = normalizarDatos(datos, { parcial: false });
  const ahora = new Date();
  const [res] = await db.query(
    `INSERT INTO funcionalidades_upscale
       (nombre, descripcion, tipo_cobro, precio_mensual, precio_anual, precio_unico, orden, activo, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [limpio.nombre, limpio.descripcion, limpio.tipo_cobro, limpio.precio_mensual, limpio.precio_anual, limpio.precio_unico, limpio.orden, ahora, ahora]
  );
  return obtenerUpscalePorId(res.insertId, db);
}

async function editarUpscale(id, datos, db = obtenerPool()) {
  const actual = await obtenerUpscalePorId(id, db);
  const limpio = normalizarDatos({ ...datos, _tipoActual: actual.tipo_cobro }, { parcial: true });
  if (Object.keys(limpio).length === 0) return actual;

  const sets = Object.keys(limpio).map((campo) => `${campo} = ?`);
  const valores = Object.values(limpio);
  await db.query(
    `UPDATE funcionalidades_upscale SET ${sets.join(', ')}, actualizado_en = ? WHERE id = ?`,
    [...valores, new Date(), id]
  );
  return obtenerUpscalePorId(id, db);
}

async function archivarUpscale(id, db = obtenerPool()) {
  await obtenerUpscalePorId(id, db);
  await db.query('UPDATE funcionalidades_upscale SET activo = 0, actualizado_en = ? WHERE id = ?', [new Date(), id]);
}

async function reactivarUpscale(id, db = obtenerPool()) {
  await obtenerUpscalePorId(id, db);
  await db.query('UPDATE funcionalidades_upscale SET activo = 1, actualizado_en = ? WHERE id = ?', [new Date(), id]);
}

module.exports = {
  ErrorUpscale,
  listarUpscale,
  obtenerUpscalePorId,
  crearUpscale,
  editarUpscale,
  archivarUpscale,
  reactivarUpscale,
};
