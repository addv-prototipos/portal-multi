// Reporte de cupones — SOLO datos reales, nunca inventados. Redenciones
// reales desde onboarding_borradores.stripe_promotion_code (se llena
// únicamente cuando Stripe confirma un pago con ese código — ver
// stripePagos.js:manejarPagoConfirmado). El nombre humano del código
// ("LANZAMIENTO20") se resuelve cruzando contra Stripe (fuente de verdad
// real de cupones, nunca se duplica aquí). Fuente de tráfico: utm_source
// capturado en el momento de crear el borrador — si esa captura no
// existía todavía cuando se creó un borrador viejo, queda `null` y el
// reporte lo muestra como "Sin datos", nunca lo adivina.

const { obtenerPool } = require('../db');
const { listarCodigosDescuento } = require('./stripeConfig');
const { resolverPlanPorClave } = require('./onboardingConversion');

async function listarReporteCupones(db = obtenerPool()) {
  const [borradores] = await db.query(
    `SELECT plan_clave, ciclo, estado, stripe_promotion_code, utm_source
       FROM onboarding_borradores
      WHERE stripe_promotion_code IS NOT NULL`
  );

  let codigosStripe = [];
  try {
    codigosStripe = await listarCodigosDescuento();
  } catch (err) {
    // Sin Stripe configurado (entorno sin llave, por ejemplo) — el
    // reporte sigue siendo útil mostrando el ID crudo en vez del código
    // humano, nunca debe tronar por esto.
    console.error('No se pudo resolver nombres de cupones desde Stripe para el reporte:', err.message);
  }
  const nombrePorId = Object.fromEntries(codigosStripe.map((c) => [c.id, c.codigo]));

  const planPrecioCache = {};
  async function precioDePlan(planClave, ciclo) {
    const clave = `${planClave}:${ciclo}`;
    if (planPrecioCache[clave] !== undefined) return planPrecioCache[clave];
    const plan = await resolverPlanPorClave(planClave, db);
    const precio = plan ? Number(ciclo === 'anual' ? plan.precio_anual : plan.precio_mensual) || 0 : 0;
    planPrecioCache[clave] = precio;
    return precio;
  }

  const porCodigo = {};
  for (const b of borradores) {
    const id = b.stripe_promotion_code;
    if (!porCodigo[id]) {
      porCodigo[id] = { codigo: nombrePorId[id] || id, redenciones: 0, compradas: 0, ingreso: 0, fuentes: {} };
    }
    const entrada = porCodigo[id];
    entrada.redenciones++;
    if (b.estado === 'convertido') {
      entrada.compradas++;
      entrada.ingreso += await precioDePlan(b.plan_clave, b.ciclo);
    }
    const fuente = b.utm_source || 'Sin datos';
    entrada.fuentes[fuente] = (entrada.fuentes[fuente] || 0) + 1;
  }

  return Object.values(porCodigo).map((e) => {
    const fuenteTop = Object.entries(e.fuentes).sort((a, b) => b[1] - a[1])[0];
    return {
      codigo: e.codigo,
      redenciones: e.redenciones,
      compradas: e.compradas,
      ingreso: Math.round(e.ingreso * 100) / 100,
      fuenteTop: fuenteTop ? fuenteTop[0] : 'Sin datos',
    };
  });
}

module.exports = { listarReporteCupones };
