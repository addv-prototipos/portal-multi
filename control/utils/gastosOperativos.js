// Gasto operativo de la PLATAFORMA (punto 467) — lo que a Clarvo le
// cuesta operar Clarvo (VPS, Garage/S3, comisión Stripe, licencias),
// nunca el gasto de un tenant (eso ya existe aparte, por tenant, en
// `gastos` dentro de cada BD tenant_*, gestionado desde /admin →
// Gastos). Se captura a mano porque viene de otras plataformas sin API
// propia que lo reporte — decisión explícita del usuario, 2026-11-04.
//
// Mismo patrón de módulo que ajustesGlobales.js: funciones planas sobre
// `obtenerPool()`, sin clase ni capa extra.

const { obtenerPool } = require('../db');

// Categorías por defecto — se le ofrecen al operador como punto de
// partida, pero el catálogo real es dinámico: cualquier categoría usada
// en una fila de `control_gastos_operativos` cuenta como "existente"
// (ver listarCategorias). No hay tabla de catálogo aparte a propósito —
// una categoría nueva nace con el primer gasto que la usa, igual que el
// usuario puede escribir una en el formulario de /admin → Gastos.
const CATEGORIAS_DEFAULT = [
  'Infraestructura (Vultr)',
  'Almacenamiento (Garage/S3)',
  'Comisión Stripe',
  'Licencias y SaaS internos',
  'Soporte y otros',
];

class ErrorGastoOperativo extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.name = 'ErrorGastoOperativo';
    this.codigo = codigo || 'gasto_invalido';
  }
}

function validarYNormalizar(datos) {
  const fecha = String(datos.fecha || '').trim();
  const concepto = String(datos.concepto || '').trim();
  const categoria = String(datos.categoria || '').trim();
  const monto = Number(datos.monto);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new ErrorGastoOperativo('Falta una fecha válida (YYYY-MM-DD).', 'fecha_invalida');
  }
  if (!concepto || concepto.length > 200) {
    throw new ErrorGastoOperativo('El concepto es obligatorio (máximo 200 caracteres).', 'concepto_invalido');
  }
  if (!categoria || categoria.length > 100) {
    throw new ErrorGastoOperativo('La categoría es obligatoria (máximo 100 caracteres).', 'categoria_invalida');
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new ErrorGastoOperativo('Captura un monto válido, mayor a cero.', 'monto_invalido');
  }

  return {
    fecha,
    concepto,
    proveedor: datos.proveedor ? String(datos.proveedor).trim().slice(0, 150) : null,
    categoria,
    monto: Math.round(monto * 100) / 100,
    ivaIncluido: datos.ivaIncluido ? 1 : 0,
    tieneFactura: datos.tieneFactura === false ? 0 : 1,
    recurrente: datos.recurrente ? 1 : 0,
    notas: datos.notas ? String(datos.notas).trim().slice(0, 2000) : null,
  };
}

async function crearGasto(datos, creadoPor, db = obtenerPool()) {
  const g = validarYNormalizar(datos);
  const [resultado] = await db.query(
    `INSERT INTO control_gastos_operativos
       (fecha, concepto, proveedor, categoria, monto, iva_incluido, tiene_factura, recurrente, notas, creado_por, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [g.fecha, g.concepto, g.proveedor, g.categoria, g.monto, g.ivaIncluido, g.tieneFactura, g.recurrente, g.notas, creadoPor || null]
  );
  return { id: resultado.insertId, ...g, periodo: g.fecha.slice(0, 7) };
}

// periodo: 'YYYY-MM'. Devuelve las filas del mes, más recientes primero.
async function listarGastosMes(periodo, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT id, fecha, concepto, proveedor, categoria, monto, iva_incluido, tiene_factura, recurrente, notas, creado_en
     FROM control_gastos_operativos
     WHERE eliminado_en IS NULL AND DATE_FORMAT(fecha, '%Y-%m') = ?
     ORDER BY fecha DESC, id DESC`,
    [periodo]
  );
  return filas;
}

// Suma total del mes — usada por financieroResumen.js para calcular
// utilidad. Nunca cuenta filas con soft-delete (eliminado_en).
async function sumaGastosMes(periodo, db = obtenerPool()) {
  const [[fila]] = await db.query(
    `SELECT COALESCE(SUM(monto), 0) AS total
     FROM control_gastos_operativos
     WHERE eliminado_en IS NULL AND DATE_FORMAT(fecha, '%Y-%m') = ?`,
    [periodo]
  );
  return Number(fila.total);
}

// Desglose por categoría del mes — alimenta la dona de participación.
async function desgloseCategoriasMes(periodo, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT categoria, COALESCE(SUM(monto), 0) AS total
     FROM control_gastos_operativos
     WHERE eliminado_en IS NULL AND DATE_FORMAT(fecha, '%Y-%m') = ?
     GROUP BY categoria
     ORDER BY total DESC`,
    [periodo]
  );
  return filas.map((f) => ({ categoria: f.categoria, total: Number(f.total) }));
}

// Serie mensual de gasto por categoría — hasta 12 meses reales
// (nunca fabricados: solo aparecen los meses que de verdad tienen al
// menos un gasto capturado).
async function serieGastoPorCategoria(db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT DATE_FORMAT(fecha, '%Y-%m') AS periodo, categoria, COALESCE(SUM(monto), 0) AS total
     FROM control_gastos_operativos
     WHERE eliminado_en IS NULL AND fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY periodo, categoria
     ORDER BY periodo ASC`
  );
  return filas.map((f) => ({ periodo: f.periodo, categoria: f.categoria, total: Number(f.total) }));
}

async function listarCategorias(db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT DISTINCT categoria FROM control_gastos_operativos WHERE eliminado_en IS NULL ORDER BY categoria ASC`
  );
  const usadas = filas.map((f) => f.categoria);
  const todas = new Set([...CATEGORIAS_DEFAULT, ...usadas]);
  return Array.from(todas).sort((a, b) => a.localeCompare(b, 'es'));
}

module.exports = {
  ErrorGastoOperativo,
  CATEGORIAS_DEFAULT,
  crearGasto,
  listarGastosMes,
  sumaGastosMes,
  desgloseCategoriasMes,
  serieGastoPorCategoria,
  listarCategorias,
};
