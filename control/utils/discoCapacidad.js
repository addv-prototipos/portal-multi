// Capacidad de disco de infraestructura (punto en curso, propuesta A5/B5
// + "Capacidad de disco" en Super Admins): cuánto disco físico real del
// servidor se puede repartir entre las cuotas (disco_cuota_mb) de todos
// los tenants activos. Distinto de disco_bytes_usados_cache (eso es "qué
// tanto ocupa CADA tenant de SU PROPIA cuota") — esto es "cuánto hemos
// prometido en total contra lo que el servidor de verdad tiene".
//
// Tenants con disco_cuota_mb = NULL ("ilimitado") no entran en la suma —
// no hay nada que sumar, y representan riesgo sin tope declarado: se
// reportan aparte (tenantsIlimitados) en vez de tratarse como 0.

const { obtenerPool } = require('../db');
const {
  getDiscoCapacidadTotalMb,
  setDiscoCapacidadTotalMb,
  getDiscoTopeTenantMb,
  getDiscoAlertaEmail,
  getDiscoAlertaEstado,
  getDiscoAlertaEnviadaEn,
  DISCO_ALERTA_UMBRAL_PCT,
} = require('./ajustesGlobales');
const { obtenerCapacidadRealGarage } = require('./garageCapacidad');
const { obtenerCapacidadRealHost } = require('./hostDiscoCapacidad');

// Capacidad total: SIEMPRE se intenta en vivo, NUNCA un valor capturado a
// mano. 2 fuentes reales, en orden (addendum 2, punto 433 — hallazgo del
// usuario): (1) el disco del HOST vía bind mount + fs.statfsSync() — el
// disco de verdad donde corre Docker, confirmado exacto contra Windows
// (295.9/45.3 GB reales vs lo que Garage decía, ~1007/945 GB, el
// filesystem interno de su propia VM); (2) Garage, solo si el bind mount
// no está configurado (entorno viejo, o un futuro servidor donde montar
// el host no aplique). Si NINGUNA de las 2 responde, se cae al último
// valor que sí se logró leer (cacheado en ajustes_globales) para que la
// tarjeta no se quede en blanco por un problema transitorio — `fuente`
// le dice al frontend cuál de los 3 casos está viendo.
async function resolverCapacidadTotal() {
  try {
    const real = obtenerCapacidadRealHost();
    await setDiscoCapacidadTotalMb(real.totalMb);
    return { capacidadTotalMb: real.totalMb, disponibleRealMb: real.disponibleMb, fuente: 'host' };
  } catch (errHost) {
    console.error('No se pudo leer la capacidad real de disco del host:', errHost.message);
  }
  try {
    const real = await obtenerCapacidadRealGarage();
    await setDiscoCapacidadTotalMb(real.totalMb);
    return { capacidadTotalMb: real.totalMb, disponibleRealMb: real.disponibleRealMb, fuente: 'garage' };
  } catch (errGarage) {
    console.error('No se pudo leer la capacidad real de disco desde Garage:', errGarage.message);
    const cache = await getDiscoCapacidadTotalMb();
    return { capacidadTotalMb: cache, disponibleRealMb: null, fuente: cache == null ? 'sin_datos' : 'cache' };
  }
}

function semaforoDe(porcentaje) {
  if (porcentaje === null) return 'sin_configurar';
  if (porcentaje >= DISCO_ALERTA_UMBRAL_PCT) return 'rojo';
  if (porcentaje >= 60) return 'ambar';
  return 'verde';
}

async function calcularResumenCapacidad(db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT t.id, t.nombre_empresa, t.slug, t.disco_cuota_mb, p.nombre AS plan_nombre
       FROM tenants t
       LEFT JOIN planes p ON p.id = t.plan_id
      WHERE t.estado != 'baja'`
  );

  let comprometidoMb = 0;
  let tenantsIlimitados = 0;
  const porPlanMapa = new Map();
  const porEmpresa = [];

  for (const fila of filas) {
    const planNombre = fila.plan_nombre || 'Sin plan asignado';
    if (fila.disco_cuota_mb == null) {
      tenantsIlimitados += 1;
      continue;
    }
    const cuotaMb = Number(fila.disco_cuota_mb);
    comprometidoMb += cuotaMb;
    porEmpresa.push({ nombreEmpresa: fila.nombre_empresa, slug: fila.slug, planNombre, cuotaMb });

    const acumuladoPlan = porPlanMapa.get(planNombre) || { planNombre, tenants: 0, totalMb: 0 };
    acumuladoPlan.tenants += 1;
    acumuladoPlan.totalMb += cuotaMb;
    porPlanMapa.set(planNombre, acumuladoPlan);
  }

  porEmpresa.sort((a, b) => b.cuotaMb - a.cuotaMb);
  const porPlan = Array.from(porPlanMapa.values()).sort((a, b) => b.totalMb - a.totalMb);

  const { capacidadTotalMb, disponibleRealMb, fuente } = await resolverCapacidadTotal();
  // "Disponible" es el libre REAL del disco (lo que Garage acaba de medir
  // ahora mismo), NUNCA "capacidad total menos lo prometido a tenants" —
  // esos son 2 números distintos y confundirlos fue un bug real (punto
  // 433, addendum): "comprometido" solo cuenta lo que /control le
  // prometió a cada tenant vía su cuota, nunca lo que el host ya trae
  // ocupado por fuera de esas cuotas (overhead de Docker/WSL2, otros
  // buckets, lo que sea) — con Garage respondiendo, ese real SIEMPRE es
  // la fuente de verdad. Sin Garage (fuente 'cache'/'sin_datos'), no hay
  // forma de medir lo real, así que se cae al estimado por promesas como
  // mejor aproximación disponible, nunca como el valor normal.
  const disponibleParaAsignarMb = capacidadTotalMb === null ? null : Math.max(0, capacidadTotalMb - comprometidoMb);
  const disponibleMb = (fuente === 'host' || fuente === 'garage') ? disponibleRealMb : disponibleParaAsignarMb;
  // Mismo criterio para el %/semáforo: el objetivo es "que no se agote el
  // disco real", así que el % usado se calcula contra el uso REAL del
  // host cuando se tiene (no contra lo prometido) — un disco puede estar
  // casi lleno de verdad con muy poco "comprometido" todavía.
  const porcentaje = (capacidadTotalMb === null || disponibleMb === null)
    ? null
    : Math.min(100, Math.round(((capacidadTotalMb - disponibleMb) / capacidadTotalMb) * 100));
  const topeTenantMb = await getDiscoTopeTenantMb();

  return {
    capacidadTotalMb,
    capacidadFuente: fuente, // 'garage' | 'cache' | 'sin_datos'
    comprometidoMb,
    disponibleMb, // libre REAL (Garage) si fuente==='garage'; estimado por promesas si no
    disponibleRealMb, // el dato crudo de Garage, solo si fuente==='garage' (igual a disponibleMb en ese caso)
    disponibleParaAsignarMb, // capacidadTotal - comprometido, siempre el estimado por promesas (referencia aparte)
    porcentaje,
    semaforo: semaforoDe(porcentaje),
    tenantsIlimitados,
    topeTenantMb,
    porPlan,
    porEmpresa: porEmpresa.slice(0, 10),
  };
}

async function obtenerEstadoAlerta() {
  const [alertaEmail, alertaEstado, alertaEnviadaEn] = await Promise.all([
    getDiscoAlertaEmail(),
    getDiscoAlertaEstado(),
    getDiscoAlertaEnviadaEn(),
  ]);
  return { alertaEmail, alertaEstado, alertaEnviadaEn };
}

module.exports = { calcularResumenCapacidad, obtenerEstadoAlerta, semaforoDe };
