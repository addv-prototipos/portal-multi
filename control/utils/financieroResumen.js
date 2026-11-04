// Resumen financiero de la PLATAFORMA (punto 467, vista "Financiero" de
// /control) — cross-tenant, solo visible aquí, nunca en /admin ni en el
// portal de clientes (mismo criterio de alcance que el resto de
// /control).
//
// Todo lo que este módulo calcula sale de datos REALES ya existentes en
// `tenants`/`planes`/`tenant_upscales_activos` — nada se inventa. Donde
// el dato real no existe todavía (historial mensual de MRR, embudo de
// cancelación instrumentado paso a paso), la función lo dice
// explícitamente en vez de simular un número — ver comentarios en cada
// bloque.
//
// Ingreso: SIEMPRE automático — Clarvo solo cobra por medios digitales
// (Stripe), nunca efectivo, así que el ingreso nunca se captura a mano.
// Hoy se aproxima con el MRR vigente (lo que los tenants activos deberían
// pagar este ciclo) porque todavía no existe el módulo de facturación;
// el día que exista, `upsertUtilidadMensual` cambia su fuente a
// 'facturacion_real' (ingreso de verdad facturado/cobrado) sin tocar el
// resto de esta vista — ver `fuente_ingreso` en
// control/scripts/ensureSchema.js:asegurarTablaFinanciero.

const { obtenerPool } = require('../db');
const { sumaGastosMes } = require('./gastosOperativos');

function periodoActual(fecha = new Date()) {
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// MRR real: planes.precio_mensual (o precio_anual/12 si el ciclo del
// tenant es anual) + los 2 upscales recurrentes denormalizados en
// `tenants` (disco_upscale_monto/usuarios_upscale_monto). No incluye
// "extras" de tenant_upscales_activos con recurso_tipo='ninguno' —
// limitación conocida, documentada aquí a propósito: ese ingreso sí
// existe pero no está denormalizado en `tenants`, sumarlo requeriría un
// JOIN+SUM adicional por tenant en cada carga de esta vista.
async function calcularMrr(db = obtenerPool()) {
  const [[fila]] = await db.query(`
    SELECT
      COUNT(*) AS tenants_activos,
      COALESCE(SUM(
        CASE WHEN t.suscripcion_ciclo = 'anual' AND p.precio_anual IS NOT NULL
             THEN p.precio_anual / 12
             ELSE p.precio_mensual
        END
      ), 0) AS mrr_base,
      COALESCE(SUM(t.disco_upscale_monto), 0) AS mrr_upscale_disco,
      COALESCE(SUM(t.usuarios_upscale_monto), 0) AS mrr_upscale_usuarios
    FROM tenants t
    LEFT JOIN planes p ON p.id = t.plan_id
    WHERE t.estado = 'activo'
      AND (t.suscripcion_estatus IS NULL OR t.suscripcion_estatus != 'prueba')
  `);
  const mrrUpscale = Number(fila.mrr_upscale_disco) + Number(fila.mrr_upscale_usuarios);
  const mrrBase = Number(fila.mrr_base);
  return {
    tenantsActivos: Number(fila.tenants_activos),
    mrrBase,
    mrrUpscale,
    mrr: mrrBase + mrrUpscale,
  };
}

async function calcularKpis(db = obtenerPool()) {
  const periodo = periodoActual();
  const { tenantsActivos, mrr, mrrUpscale } = await calcularMrr(db);

  const [[altasFila]] = await db.query(
    `SELECT COUNT(*) AS n FROM tenants WHERE DATE_FORMAT(creado_en, '%Y-%m') = ?`,
    [periodo]
  );
  const [[bajasFila]] = await db.query(
    `SELECT COUNT(*) AS n FROM tenants WHERE baja_en IS NOT NULL AND DATE_FORMAT(baja_en, '%Y-%m') = ?`,
    [periodo]
  );
  const altasEsteMes = Number(altasFila.n);
  const bajasEsteMes = Number(bajasFila.n);

  // Churn aproximado: no existe un snapshot del tenant count al INICIO
  // del mes, así que se aproxima el denominador como "activos ahora +
  // los que se dieron de baja este mes" — razonable, pero no exacto si
  // también hubo altas a mitad de mes. Documentado en el KPI del
  // frontend con una nota, nunca presentado como un número cerrado.
  const denominadorAprox = tenantsActivos + bajasEsteMes;
  const churnPct = denominadorAprox > 0 ? (bajasEsteMes / denominadorAprox) * 100 : 0;

  const ltv = tenantsActivos > 0 && churnPct > 0
    ? (mrr / tenantsActivos) / (churnPct / 100)
    : null;

  return {
    mrr,
    arr: mrr * 12,
    tenantsActivos,
    altasEsteMes,
    bajasEsteMes,
    churnPct,
    ltv,
    mrrUpscale,
  };
}

// Altas y bajas reales por mes, últimos `meses` meses — de
// tenants.creado_en/baja_en directo, sin fabricar nada.
async function altasBajasPorMes(meses = 24, db = obtenerPool()) {
  const [altasFilas] = await db.query(
    `SELECT DATE_FORMAT(creado_en, '%Y-%m') AS periodo, COUNT(*) AS n
     FROM tenants
     WHERE creado_en >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY periodo ORDER BY periodo ASC`,
    [meses]
  );
  const [bajasFilas] = await db.query(
    `SELECT DATE_FORMAT(baja_en, '%Y-%m') AS periodo, COUNT(*) AS n
     FROM tenants
     WHERE baja_en IS NOT NULL AND baja_en >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY periodo ORDER BY periodo ASC`,
    [meses]
  );
  const mapa = new Map();
  altasFilas.forEach((f) => mapa.set(f.periodo, { periodo: f.periodo, altas: Number(f.n), bajas: 0 }));
  bajasFilas.forEach((f) => {
    const existente = mapa.get(f.periodo) || { periodo: f.periodo, altas: 0, bajas: 0 };
    existente.bajas = Number(f.n);
    mapa.set(f.periodo, existente);
  });
  return Array.from(mapa.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
}

// Reconstrucción real del tenant count activo al cierre de cada mes, a
// partir de creado_en/baja_en — no es un snapshot guardado, es contar
// "¿este tenant ya existía y no se había dado de baja todavía?" para cada
// corte de mes. 100% real, sin inventar ningún punto.
async function crecimientoTenantsHistorico(meses = 24, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT creado_en, baja_en FROM tenants WHERE creado_en IS NOT NULL`
  );
  const ahora = new Date();
  const puntos = [];
  for (let i = meses - 1; i >= 0; i--) {
    const corte = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i + 1, 0, 23, 59, 59));
    const periodo = `${corte.getUTCFullYear()}-${String(corte.getUTCMonth() + 1).padStart(2, '0')}`;
    const activos = filas.filter((f) => {
      const creado = new Date(f.creado_en);
      if (creado > corte) return false;
      if (!f.baja_en) return true;
      return new Date(f.baja_en) > corte;
    }).length;
    puntos.push({ periodo, tenants: activos });
  }
  return puntos;
}

// Ciclo de vida — 5 estados 100% reales (tenants.estado +
// suscripcion_cancelar_al_corte/suscripcion_expira_en). Reemplaza el
// mockup inicial, que tenía una 5ta columna especulativa
// ("Resuelto, 30 días") que habría necesitado un log de eventos que no
// existe — "Suspendido" sí es un estado real y se muestra en su lugar.
async function cicloVidaKanban(db = obtenerPool()) {
  const [filas] = await db.query(`
    SELECT t.slug, t.nombre_empresa, t.estado, t.suscripcion_cancelar_al_corte, t.suscripcion_expira_en,
           p.precio_mensual, t.disco_upscale_monto, t.usuarios_upscale_monto
    FROM tenants t
    LEFT JOIN planes p ON p.id = t.plan_id
    WHERE t.estado != 'baja'
    ORDER BY t.creado_en DESC
  `);
  const hoy = new Date();
  const columnas = { onboarding: [], activa: [], enRiesgo: [], cancelacionProceso: [], suspendido: [] };
  filas.forEach((t) => {
    const mrrTenant = Number(t.precio_mensual || 0) + Number(t.disco_upscale_monto || 0) + Number(t.usuarios_upscale_monto || 0);
    const item = { slug: t.slug, nombre: t.nombre_empresa, mrr: mrrTenant };
    if (t.estado === 'provisioning') { columnas.onboarding.push(item); return; }
    if (t.estado === 'suspendido') { columnas.suspendido.push(item); return; }
    if (t.estado !== 'activo') return;
    if (t.suscripcion_cancelar_al_corte) { columnas.cancelacionProceso.push(item); return; }
    if (t.suscripcion_expira_en) {
      const dias = Math.ceil((new Date(t.suscripcion_expira_en) - hoy) / 86400000);
      if (dias >= 0 && dias <= 7) { columnas.enRiesgo.push({ ...item, diasParaVencer: dias }); return; }
    }
    columnas.activa.push(item);
  });
  const LIMITE = 10;
  Object.keys(columnas).forEach((k) => { columnas[k] = columnas[k].slice(0, LIMITE); });
  return columnas;
}

// Últimas compras de upscale (disco/usuarios/extras) — real, de
// tenant_upscales_activos.
async function comprasUpscaleRecientes(limite = 30, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT t.nombre_empresa, f.nombre AS funcionalidad, u.cantidad, u.disco_mb_otorgado,
            u.usuarios_otorgados, u.monto_recurrente, u.ciclo, u.creado_en
     FROM tenant_upscales_activos u
     JOIN tenants t ON t.id = u.tenant_id
     JOIN funcionalidades_upscale f ON f.id = u.funcionalidad_id
     WHERE u.activo = 1
     ORDER BY u.creado_en DESC
     LIMIT ?`,
    [limite]
  );
  return filas.map((f) => ({
    tenant: f.nombre_empresa,
    funcionalidad: f.funcionalidad,
    detalle: f.disco_mb_otorgado ? `+${(f.disco_mb_otorgado / 1024).toFixed(1)} GB`
      : f.usuarios_otorgados ? `+${f.usuarios_otorgados} cuenta(s)`
      : `x${f.cantidad}`,
    monto: Number(f.monto_recurrente),
    ciclo: f.ciclo,
    fecha: f.creado_en,
  }));
}

// Retención y cancelaciones — real, basado en baja_motivo (captura del
// modal de cancelación, punto 449) y
// suscripcion_descuento_retencion_usado (si la fricción de 2 pasos
// llegó a ofrecer el descuento de retención). NO es el embudo completo
// de 5 etapas del mockup inicial (solicitud→fricción→propuesta vista→
// aceptó→canceló) — ese embudo necesita instrumentar cada paso del modal
// de cancelación, que hoy no registra eventos intermedios, solo el
// resultado final. Esta versión usa únicamente lo que sí se guarda hoy.
async function retencionCancelaciones(db = obtenerPool()) {
  const periodo = periodoActual();
  const [[canceladasFila]] = await db.query(
    `SELECT COUNT(*) AS n FROM tenants WHERE baja_en IS NOT NULL AND DATE_FORMAT(baja_en, '%Y-%m') = ?`,
    [periodo]
  );
  const [[enProcesoFila]] = await db.query(
    `SELECT COUNT(*) AS n FROM tenants WHERE estado = 'activo' AND suscripcion_cancelar_al_corte = 1`
  );
  const [[retuvoFila]] = await db.query(
    `SELECT COUNT(*) AS n FROM tenants WHERE suscripcion_descuento_retencion_usado = 1 AND estado = 'activo' AND suscripcion_cancelar_al_corte = 0`
  );
  const [[noRetuvoFila]] = await db.query(
    `SELECT COUNT(*) AS n FROM tenants WHERE suscripcion_descuento_retencion_usado = 1 AND estado = 'baja'`
  );
  const [motivosFilas] = await db.query(
    `SELECT baja_motivo, COUNT(*) AS n FROM tenants
     WHERE baja_en IS NOT NULL AND DATE_FORMAT(baja_en, '%Y-%m') = ? AND baja_motivo IS NOT NULL
     GROUP BY baja_motivo ORDER BY n DESC`,
    [periodo]
  );
  return {
    canceladasEsteMes: Number(canceladasFila.n),
    enProcesoAhora: Number(enProcesoFila.n),
    retuvoConDescuento: Number(retuvoFila.n),
    noRetuvoConDescuento: Number(noRetuvoFila.n),
    motivos: motivosFilas.map((f) => ({ motivo: f.baja_motivo, n: Number(f.n) })),
  };
}

// Escribe (UPSERT) el snapshot del mes EN CURSO — nunca reescribe un mes
// ya cerrado (la llave es el periodo; en cuanto cambia el mes calendario,
// esta fila deja de recibir upserts y queda congelada como historial
// real). Se llama cada vez que se carga el resumen financiero.
async function upsertUtilidadMensual(db = obtenerPool()) {
  const periodo = periodoActual();
  const { mrr } = await calcularMrr(db);
  const gasto = await sumaGastosMes(periodo, db);
  await db.query(
    `INSERT INTO control_utilidad_mensual (periodo, ingreso, gasto, fuente_ingreso, actualizado_en)
     VALUES (?, ?, ?, 'mrr_estimado', NOW())
     ON DUPLICATE KEY UPDATE ingreso = VALUES(ingreso), gasto = VALUES(gasto), actualizado_en = NOW()`,
    [periodo, mrr, gasto]
  );
  return { periodo, ingreso: mrr, gasto, utilidad: mrr - gasto };
}

async function historialUtilidad(db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT periodo, ingreso, gasto, fuente_ingreso FROM control_utilidad_mensual ORDER BY periodo ASC`
  );
  return filas.map((f) => ({
    periodo: f.periodo,
    ingreso: Number(f.ingreso),
    gasto: Number(f.gasto),
    utilidad: Number(f.ingreso) - Number(f.gasto),
    fuenteIngreso: f.fuente_ingreso,
  }));
}

async function utilidadAcumulada(db = obtenerPool()) {
  const [[fila]] = await db.query(
    `SELECT COALESCE(SUM(ingreso - gasto), 0) AS acumulado FROM control_utilidad_mensual`
  );
  return Number(fila.acumulado);
}

module.exports = {
  periodoActual,
  calcularMrr,
  calcularKpis,
  altasBajasPorMes,
  crecimientoTenantsHistorico,
  cicloVidaKanban,
  comprasUpscaleRecientes,
  retencionCancelaciones,
  upsertUtilidadMensual,
  historialUtilidad,
  utilidadAcumulada,
};
