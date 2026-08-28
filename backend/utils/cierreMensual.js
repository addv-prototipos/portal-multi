const { pool, ejecutarComoTenant, obtenerPoolControl } = require('../db');
const { getConfiguracionGlobal } = require('./config');
const { generarYEnviarReporte } = require('./reportes');

const CLAVE_ULTIMO_CIERRE = 'ultimo_cierre_mensual';

function periodoMesAnterior(zonaHoraria) {
  // Cálculo en UTC es suficiente porque el cron corre día 1 02:00 en la
  // zona configurada — a esa hora UTC sigue siendo día 1, mismo mes.
  const ahora = new Date();
  const base = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, 1));
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function rangoDelPeriodo(periodo) {
  const [y, m] = periodo.split('-').map(Number);
  const inicio = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const fin = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  return { inicio, fin };
}

function ordenAItemArchivado(orden) {
  return {
    tipo_registro: 'orden_compra',
    identificador: orden.numero_compra,
    rfc: orden.email || null,
    estatus_o_concepto: orden.concepto,
    monto: orden.total,
    fecha_registro: orden.fecha_compra,
    atendido_por: null,
    categoria: null,
    accion: 'archivado',
  };
}

function gastoAItemArchivado(gasto) {
  return {
    tipo_registro: 'gasto',
    identificador: `G-${String(gasto.id).padStart(6, '0')}`,
    rfc: gasto.proveedor || null,
    estatus_o_concepto: gasto.concepto,
    monto: gasto.monto,
    fecha_registro: gasto.fecha,
    atendido_por: null,
    categoria: gasto.categoria || null,
    accion: 'archivado',
  };
}

async function obtenerVentasParaArchivar(periodo) {
  const [filas] = await pool.query(
    `SELECT * FROM ordenes_compra
      WHERE eliminado_en IS NULL AND archivado_en IS NULL
        AND DATE_FORMAT(fecha_compra, '%Y-%m') = ?
      ORDER BY fecha_compra ASC`,
    [periodo]
  );
  return filas;
}

async function obtenerGastosParaArchivar(periodo) {
  const [filas] = await pool.query(
    `SELECT * FROM gastos
      WHERE eliminado_en IS NULL AND archivado_en IS NULL
        AND DATE_FORMAT(fecha, '%Y-%m') = ?
      ORDER BY fecha ASC`,
    [periodo]
  );
  return filas;
}

async function getUltimoCierre() {
  const [filas] = await pool.query('SELECT valor FROM configuracion WHERE clave = ?', [CLAVE_ULTIMO_CIERRE]);
  if (filas.length === 0) return null;
  return String(filas[0].valor);
}

async function setUltimoCierre(periodo) {
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_ULTIMO_CIERRE, periodo]
  );
}

/**
 * Ejecuta el cierre mensual para la DB actual (la que apunta `pool` en
 * este momento — vía `ejecutarComoTenant` si es un tenant).
 * Si `periodoForzado` viene (YYYY-MM), se usa ese en vez de "mes anterior".
 */
async function ejecutarCierreMensualParaDB(periodoForzado = null) {
  const configGlobal = await getConfiguracionGlobal();
  const periodo = periodoForzado || periodoMesAnterior(configGlobal.zona_horaria);

  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    throw new Error('Periodo inválido, debe ser YYYY-MM');
  }

  const ultimo = await getUltimoCierre();
  if (ultimo === periodo) {
    return { periodo, yaEjecutado: true, archivadasVentas: 0, archivadosGastos: 0, reporteId: null };
  }

  const ventas = await obtenerVentasParaArchivar(periodo);
  const gastos = await obtenerGastosParaArchivar(periodo);

  if (ventas.length === 0 && gastos.length === 0) {
    // Nada que archivar, pero marcamos el periodo como cerrado para no
    // reintentar cada hora el mismo mes vacío.
    await setUltimoCierre(periodo);
    return { periodo, nadaQueArchivar: true, archivadasVentas: 0, archivadosGastos: 0, reporteId: null };
  }

  const items = [...ventas.map(ordenAItemArchivado), ...gastos.map(gastoAItemArchivado)];
  const { inicio, fin } = rangoDelPeriodo(periodo);

  let reporteId = null;
  let correoEnviado = false;
  let errorCorreo = null;
  try {
    const resultado = await generarYEnviarReporte({ tipo: 'cierre_mensual', items, rangoInicio: inicio, rangoFin: fin });
    reporteId = resultado.reporteId;
    correoEnviado = resultado.correoEnviado;
    errorCorreo = resultado.errorCorreo;
  } catch (err) {
    console.error(`[cierreMensual] No se pudo generar reporte para periodo ${periodo}:`, err);
    // Sin snapshot no se archiva — evita perder datos sin evidencia.
    throw err;
  }

  // Solo después del reporte ya guardado se marca como archivado.
  const ahora = new Date();
  ahora.setMilliseconds(0);
  let archivadasVentas = 0;
  let archivadosGastos = 0;
  if (ventas.length > 0) {
    const ids = ventas.map((v) => v.id);
    const [res] = await pool.query(
      `UPDATE ordenes_compra SET archivado_en = ?, periodo_archivado = ? WHERE id IN (?) AND archivado_en IS NULL`,
      [ahora, periodo, ids]
    );
    archivadasVentas = res.affectedRows;
  }
  if (gastos.length > 0) {
    const ids = gastos.map((g) => g.id);
    const [res] = await pool.query(
      `UPDATE gastos SET archivado_en = ?, periodo_archivado = ? WHERE id IN (?) AND archivado_en IS NULL`,
      [ahora, periodo, ids]
    );
    archivadosGastos = res.affectedRows;
  }

  await setUltimoCierre(periodo);

  return { periodo, archivadasVentas, archivadosGastos, reporteId, correoEnviado, errorCorreo, yaEjecutado: false };
}

/**
 * Itera el cierre sobre base ADDV + todos los tenants activos.
 * Cada tenant se ejecuta con `ejecutarComoTenant(slug, ...)`.
 * Paginado 5 concurrentes para no saturar MySQL con N>1000.
 */
async function ejecutarCierresMensualesParaTodos(periodoForzado = null) {
  const resultados = [];

  // 1) Base ADDV (sin slug) — pool por defecto
  try {
    const r = await ejecutarCierreMensualParaDB(periodoForzado);
    resultados.push({ slug: null, base: true, ...r });
  } catch (err) {
    resultados.push({ slug: null, base: true, error: err.message, periodo: periodoForzado || 'auto' });
  }

  // 2) Tenants activos desde BD de control
  let tenants = [];
  try {
    const poolControl = obtenerPoolControl();
    const [filas] = await poolControl.query(`SELECT slug FROM tenants WHERE estado = 'activo' ORDER BY slug ASC`);
    tenants = filas.map((f) => f.slug);
  } catch (err) {
    console.error('[cierreMensual] No se pudo listar tenants de control:', err.message);
    return resultados;
  }

  // Paginado 5 a la vez
  for (let i = 0; i < tenants.length; i += 5) {
    const lote = tenants.slice(i, i + 5);
    const promesas = lote.map(async (slug) => {
      try {
        const r = await ejecutarComoTenant(slug, () => ejecutarCierreMensualParaDB(periodoForzado));
        return { slug, ...r };
      } catch (err) {
        return { slug, error: err.message, periodo: periodoForzado || 'auto' };
      }
    });
    const resLote = await Promise.all(promesas);
    resultados.push(...resLote);
  }

  return resultados;
}

module.exports = {
  ejecutarCierreMensualParaDB,
  ejecutarCierresMensualesParaTodos,
  periodoMesAnterior,
  rangoDelPeriodo,
  ordenAItemArchivado,
  gastoAItemArchivado,
  CLAVE_ULTIMO_CIERRE,
};
