// Módulo "Gastos" (ver PROJECT_STATE.md): control administrativo de los
// gastos de la operación, con o sin factura/CFDI — no es un sistema
// contable, es una herramienta de control financiero operativo. Este
// archivo centraliza lo que comparten la tabla (backend/db.js), la
// validación del CRUD (backend/server.js) y los mensajes de error.
//
// Las categorías vivían como una lista CERRADA en código (CHECK de MySQL
// + este archivo) — a partir de este segmento son una tabla editable
// (`categorias_gastos`, ver ensureSchema en db.js), para que el admin
// pueda renombrar o agregar categorías desde el propio popup de
// "Registrar gasto" (ver PROJECT_STATE.md, segmento "Categorías
// editables"). CATEGORIAS_SEED es SOLO la semilla inicial que usa
// ensureSchema() para poblar la tabla la primera vez — después de eso,
// la tabla manda, este arreglo no se vuelve a leer.
const CATEGORIAS_SEED = [
  'renta',
  'nomina',
  'software',
  'hosting',
  'servicios',
  'papeleria',
  'combustible',
  'viaticos',
  'publicidad',
  'otro',
];

const ETIQUETAS_SEED = {
  renta: 'Renta',
  nomina: 'Nómina',
  software: 'Software',
  hosting: 'Hosting',
  servicios: 'Servicios',
  papeleria: 'Papelería',
  combustible: 'Combustible',
  viaticos: 'Viáticos',
  publicidad: 'Publicidad',
  otro: 'Otro',
};

// "otro" es el catálogo de respaldo de todo el sistema (color por defecto
// de la gráfica de dona en Resumen financiero cuando una categoría no
// tiene color propio) — la única que se marca `protegida` en la semilla,
// no se puede renombrar ni borrar.
const SLUG_CATEGORIA_PROTEGIDA = 'otro';

// Convierte una etiqueta capturada por el admin ("Material de oficina")
// en un slug estable para guardar en `gastos.categoria` — minúsculas,
// sin acentos, solo [a-z0-9_], recortado a 50 (mismo límite de columna).
// El slug NUNCA se vuelve a regenerar tras crearse (renombrar una
// categoría solo cambia `etiqueta`, nunca el slug) — así un gasto ya
// guardado con ese slug nunca queda huérfano.
function generarSlugCategoria(etiqueta) {
  const base = String(etiqueta || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (marcas diacríticas combinantes)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  return base || 'categoria';
}

// require() perezoso (dentro de cada función, no aquí arriba): db.js
// importa ESTE archivo para leer CATEGORIAS_SEED/ETIQUETAS_SEED antes de
// terminar de armar su module.exports — un `const { pool } = require('../db')`
// a nivel de módulo capturaría el `pool` de esa versión a medio construir
// (undefined) para siempre. Pidiendo '../db' hasta el momento de usarlo se
// obtiene siempre la versión ya completa desde la caché de require().
function obtenerPool() {
  return require('../db').pool;
}
const { sanitizeText } = require('./validate');

// Todas las categorías (activas e inactivas) — el panel de gestión del
// modal necesita ver ambas para poder mostrar el estado; el <select> de
// alta de un gasto nuevo filtra a solo `activa` del lado del frontend.
// `tiene_gastos` (boolean) le dice al frontend si puede ofrecer borrar de
// verdad o solo desactivar.
async function listarCategoriasGastos() {
  const [filas] = await obtenerPool().query(`
    SELECT c.id, c.slug, c.etiqueta, c.activa, c.protegida,
      EXISTS(SELECT 1 FROM gastos g WHERE g.categoria = c.slug) AS tiene_gastos
    FROM categorias_gastos c
    ORDER BY c.orden ASC, c.etiqueta ASC
  `);
  return filas.map((f) => ({
    id: f.id,
    slug: f.slug,
    etiqueta: f.etiqueta,
    activa: Boolean(f.activa),
    protegida: Boolean(f.protegida),
    tieneGastos: Boolean(f.tiene_gastos),
  }));
}

// Cualquier categoría que EXISTA (activa o no) es válida como valor de
// `gastos.categoria` — la restricción de "solo activas" es una decisión
// de UX del selector de alta, no de integridad de datos; así una edición
// de un gasto viejo que ya traía una categoría desactivada no se rompe.
async function categoriaGastoExiste(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9_]{1,50}$/.test(slug)) return false;
  const [filas] = await obtenerPool().query('SELECT id FROM categorias_gastos WHERE slug = ? LIMIT 1', [slug]);
  return filas.length > 0;
}

async function crearCategoriaGasto(etiquetaCruda) {
  const etiqueta = sanitizeText(etiquetaCruda, 100);
  if (!etiqueta) {
    return { error: 'El nombre de la categoría es obligatorio.' };
  }
  let slug = generarSlugCategoria(etiqueta);
  // Colisión de slug (dos etiquetas distintas que normalizan igual, ej.
  // "Café" y "cafe"): se le agrega un sufijo numérico hasta que sea único
  // — nunca se rechaza la creación por esto, es un detalle interno.
  let sufijo = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await categoriaGastoExiste(slug)) {
    slug = `${generarSlugCategoria(etiqueta).slice(0, 46)}_${sufijo}`;
    sufijo += 1;
  }
  const ahora = new Date();
  const [resultado] = await obtenerPool().query(
    `INSERT INTO categorias_gastos (slug, etiqueta, activa, protegida, orden, creado_en, actualizado_en)
     VALUES (?, ?, 1, 0, 999, ?, ?)`,
    [slug, etiqueta, ahora, ahora]
  );
  return { id: resultado.insertId, slug, etiqueta };
}

async function renombrarCategoriaGasto(id, etiquetaCruda) {
  const etiqueta = sanitizeText(etiquetaCruda, 100);
  if (!etiqueta) {
    return { error: 'El nombre de la categoría es obligatorio.' };
  }
  const [filas] = await obtenerPool().query('SELECT id, protegida FROM categorias_gastos WHERE id = ? LIMIT 1', [id]);
  if (filas.length === 0) {
    return { error: 'Categoría no encontrada.', status: 404 };
  }
  if (filas[0].protegida) {
    return { error: 'Esta categoría es de respaldo del sistema y no se puede renombrar.' };
  }
  await obtenerPool().query('UPDATE categorias_gastos SET etiqueta = ?, actualizado_en = ? WHERE id = ?', [
    etiqueta,
    new Date(),
    id,
  ]);
  return { id, etiqueta };
}

// Con gastos asociados: solo se desactiva (deja de ofrecerse para altas
// nuevas, los gastos que ya la usan la conservan). Sin gastos: se borra
// de verdad. Nunca aplica a la protegida.
async function eliminarCategoriaGasto(id) {
  const [filas] = await obtenerPool().query(
    `SELECT c.id, c.protegida,
       EXISTS(SELECT 1 FROM gastos g WHERE g.categoria = c.slug) AS tiene_gastos
     FROM categorias_gastos c WHERE c.id = ? LIMIT 1`,
    [id]
  );
  if (filas.length === 0) {
    return { error: 'Categoría no encontrada.', status: 404 };
  }
  if (filas[0].protegida) {
    return { error: 'Esta categoría es de respaldo del sistema y no se puede eliminar.' };
  }
  if (filas[0].tiene_gastos) {
    await obtenerPool().query('UPDATE categorias_gastos SET activa = 0, actualizado_en = ? WHERE id = ?', [new Date(), id]);
    return { desactivada: true };
  }
  await obtenerPool().query('DELETE FROM categorias_gastos WHERE id = ?', [id]);
  return { eliminada: true };
}

// Contraparte de la desactivación de arriba — sin esto, desactivar una
// categoría con gastos sería una puerta de un solo sentido (rompería el
// mismo criterio de papelera+restaurar que ya usan tickets/gastos/reportes).
async function reactivarCategoriaGasto(id) {
  const [filas] = await obtenerPool().query('SELECT id, protegida FROM categorias_gastos WHERE id = ? LIMIT 1', [id]);
  if (filas.length === 0) {
    return { error: 'Categoría no encontrada.', status: 404 };
  }
  await obtenerPool().query('UPDATE categorias_gastos SET activa = 1, actualizado_en = ? WHERE id = ?', [new Date(), id]);
  return { reactivada: true };
}

module.exports = {
  CATEGORIAS_SEED,
  ETIQUETAS_SEED,
  SLUG_CATEGORIA_PROTEGIDA,
  generarSlugCategoria,
  listarCategoriasGastos,
  categoriaGastoExiste,
  crearCategoriaGasto,
  renombrarCategoriaGasto,
  eliminarCategoriaGasto,
  reactivarCategoriaGasto,
};
