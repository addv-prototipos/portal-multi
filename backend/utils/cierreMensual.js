const { pool, ejecutarComoTenant, obtenerPoolControl, obtenerPoolTenant } = require('../db');
const { getConfiguracionGlobal } = require('./config');
const { generarYEnviarReporte } = require('./reportes');

const CLAVE_ULTIMO_CIERRE = 'ultimo_cierre_mensual';

/** Año/mes/día actuales en `zonaHoraria` (IANA), sin depender de la hora UTC. */
function fechaLocal(zonaHoraria, fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const obtener = (tipo) => partes.find((p) => p.type === tipo).value;
  return { anio: Number(obtener('year')), mes: Number(obtener('month')), dia: Number(obtener('day')) };
}

/** true si "ahora" es día 1 del mes en `zonaHoraria` — gate real por DB/tenant. */
function esDia1EnZona(zonaHoraria, fecha = new Date()) {
  return fechaLocal(zonaHoraria, fecha).dia === 1;
}

function periodoMesAnterior(zonaHoraria, fecha = new Date()) {
  const { anio, mes } = fechaLocal(zonaHoraria, fecha);
  const base = new Date(Date.UTC(anio, mes - 1 - 1, 1));
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
    atendido_por: orden.creado_por || null, // punto 320: quién registró la venta
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

  // Gate real: día 1 en la zona horaria de ESTA DB (no la de quien llama).
  // El pre-filtro amplio de server.js solo ahorra consultas el resto del
  // mes — la decisión correcta de "es día 1" siempre se toma aquí, por
  // tenant, porque cada uno puede tener una zona distinta.
  if (!periodoForzado && !esDia1EnZona(configGlobal.zona_horaria)) {
    return { periodo: null, fueraDeVentana: true, archivadasVentas: 0, archivadosGastos: 0, reporteId: null };
  }

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

// Candado de traslape (punto 380) — el cierre se dispara cada hora desde
// server.js (setInterval); si una corrida anterior (de un cierre con
// muchos tenants) sigue viva cuando llega la siguiente, esta se omite en
// vez de correr en paralelo contra la misma BD. Vive en memoria del
// proceso: suficiente porque el propio setInterval vive en ese mismo
// proceso — no hace falta coordinarlo entre procesos/réplicas.
let corridaEnProgreso = false;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Pausa entre lotes de 5 tenants (punto 380) — no disparar las 5
// conexiones del siguiente lote en el mismo instante en que el anterior
// recién terminó.
const PAUSA_ENTRE_LOTES_MS = 500;

/**
 * Itera el cierre sobre base ADDV + todos los tenants activos.
 * Cada tenant se ejecuta con `ejecutarComoTenant(slug, ...)`, con su
 * error aislado dentro del propio `.map()` de abajo — un tenant que
 * truene nunca detiene ni afecta el cierre de los demás (ya existía,
 * verificado antes de agregar nada nuevo aquí).
 * Paginado 5 concurrentes para no saturar MySQL con N>1000, con una
 * pequeña pausa entre lotes (PAUSA_ENTRE_LOTES_MS) y un candado de
 * traslape (`corridaEnProgreso`) para que una corrida larga no se
 * empalme con la siguiente llamada horaria.
 */
async function ejecutarCierresMensualesParaTodos(periodoForzado = null) {
  if (corridaEnProgreso) {
    console.warn('[cierreMensual] Corrida anterior todavía en progreso — se omite esta llamada.');
    return [{ omitido: true, motivo: 'corrida_anterior_en_progreso', periodo: periodoForzado || 'auto' }];
  }
  corridaEnProgreso = true;
  try {
    const resultados = [];

    // 1) Base ADDV (sin slug) — pool por defecto
    try {
      const r = await ejecutarCierreMensualParaDB(periodoForzado);
      resultados.push({ slug: null, base: true, ...r });
    } catch (err) {
      resultados.push({ slug: null, base: true, error: err.message, periodo: periodoForzado || 'auto' });
    }

    // 2) Tenants activos desde BD de control — mismos campos que
    // `tenantContext.js:resolverTenantPorSlug()` para construir su pool real
    // con `obtenerPoolTenant()` (`ejecutarComoTenant` espera un OBJETO pool,
    // no el slug — pasar el slug crudo deja `pool.query` apuntando a un
    // string y revienta con "pool.query is not a function").
    let tenants = [];
    try {
      const poolControl = obtenerPoolControl();
      const [filas] = await poolControl.query(
        `SELECT slug, db_host, db_name, db_user FROM tenants WHERE estado = 'activo' ORDER BY slug ASC`
      );
      tenants = filas;
    } catch (err) {
      console.error('[cierreMensual] No se pudo listar tenants de control:', err.message);
      return resultados;
    }

    // Paginado 5 a la vez, con pausa entre lotes
    for (let i = 0; i < tenants.length; i += 5) {
      const lote = tenants.slice(i, i + 5);
      const promesas = lote.map(async (tenant) => {
        try {
          const tenantPool = obtenerPoolTenant({
            slug: tenant.slug,
            host: tenant.db_host,
            port: Number(process.env.DB_PORT || 3306),
            user: tenant.db_user,
            password: process.env.DB_PASSWORD || '',
            database: tenant.db_name,
          });
          const r = await ejecutarComoTenant(tenantPool, () => ejecutarCierreMensualParaDB(periodoForzado));
          return { slug: tenant.slug, ...r };
        } catch (err) {
          return { slug: tenant.slug, error: err.message, periodo: periodoForzado || 'auto' };
        }
      });
      const resLote = await Promise.all(promesas);
      resultados.push(...resLote);
      if (i + 5 < tenants.length) await esperar(PAUSA_ENTRE_LOTES_MS);
    }

    return resultados;
  } finally {
    corridaEnProgreso = false;
  }
}

module.exports = {
  ejecutarCierreMensualParaDB,
  ejecutarCierresMensualesParaTodos,
  periodoMesAnterior,
  rangoDelPeriodo,
  ordenAItemArchivado,
  gastoAItemArchivado,
  fechaLocal,
  esDia1EnZona,
  CLAVE_ULTIMO_CIERRE,
};
