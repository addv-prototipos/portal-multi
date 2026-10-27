// Configuración de Stripe desde /control — 3 piezas con 3 niveles de
// realidad distintos, no tratarlas igual:
//
// 1. Meses sin intereses (MSI): SÍ es un parámetro real de la API de
//    Checkout (payment_method_options.card.installments) — se guarda
//    aquí (mismo patrón clave/valor que ajustesGlobales.js, punto 370) y
//    stripePagos.js lo aplica al crear cada Checkout Session.
// 2. Métodos de pago (OXXO/SPEI/tarjeta): confirmado al probar en local
//    (2026-10-26) que Stripe YA NO acepta controlarlos por API al crear
//    un Checkout Session — se gobiernan 100% desde el Dashboard
//    (Settings → Payment methods). No hay nada que leer/escribir aquí;
//    ver metodosPagoInfo() abajo, es solo texto + link, nunca un estado
//    real de la cuenta.
// 3. Códigos de descuento: Stripe Coupons + Promotion Codes SÍ son 100%
//    controlables por API — este archivo es un proxy delgado a esos 2
//    recursos, Stripe queda como única fuente de verdad (sin tabla local
//    que se pueda desincronizar).

const Stripe = require('stripe');
const { obtenerPool } = require('../db');

function obtenerStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const err = new Error('El cobro con Stripe no está configurado todavía.');
    err.codigo = 'no_configurado';
    throw err;
  }
  return new Stripe(secretKey);
}

const CLAVE_MSI_PLAZOS = 'stripe_msi_plazos';
const CLAVE_MSI_MONTO_MINIMO = 'stripe_msi_monto_minimo';
const PLAZOS_VALIDOS = [3, 6, 9, 12, 18];
const MSI_MONTO_MINIMO_DEFAULT = 0;

async function getConfigMsi(db = obtenerPool()) {
  const [filas] = await db.query(
    'SELECT clave, valor FROM ajustes_globales WHERE clave IN (?, ?)',
    [CLAVE_MSI_PLAZOS, CLAVE_MSI_MONTO_MINIMO]
  );
  const porClave = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  let plazos = [];
  try {
    plazos = JSON.parse(porClave[CLAVE_MSI_PLAZOS] || '[]').filter((p) => PLAZOS_VALIDOS.includes(p));
  } catch {
    plazos = [];
  }
  const montoMinimo = Number(porClave[CLAVE_MSI_MONTO_MINIMO]) || MSI_MONTO_MINIMO_DEFAULT;
  return { plazos, montoMinimo };
}

async function setConfigMsi({ plazos, montoMinimo }, db = obtenerPool()) {
  const plazosLimpios = Array.isArray(plazos) ? plazos.map(Number).filter((p) => PLAZOS_VALIDOS.includes(p)) : [];
  const montoLimpio = Number(montoMinimo);
  if (!Number.isFinite(montoLimpio) || montoLimpio < 0) {
    const err = new Error('El monto mínimo debe ser un número mayor o igual a 0.');
    err.codigo = 'validacion';
    throw err;
  }
  await db.query(
    `INSERT INTO ajustes_globales (clave, valor) VALUES (?, ?), (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_MSI_PLAZOS, JSON.stringify(plazosLimpios), CLAVE_MSI_MONTO_MINIMO, String(montoLimpio)]
  );
  return { plazos: plazosLimpios, montoMinimo: montoLimpio };
}

// Nunca un estado real de la CUENTA de Stripe (eso seguiría requiriendo
// una llamada a la API) — pero "modo" y "webhookConfigurado" sí son
// datos reales y gratis: se leen del propio proceso del servidor, nunca
// se inventan. Lista fija de los métodos relevantes para México, con el
// link real al Dashboard.
function metodosPagoInfo() {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  let modo = null;
  if (secretKey.startsWith('sk_test_')) modo = 'prueba';
  else if (secretKey.startsWith('sk_live_')) modo = 'produccion';
  return {
    nota: 'Stripe ya no permite controlar los métodos de pago habilitados por API al crear un Checkout Session — se activan/desactivan directo en el Dashboard de Stripe.',
    dashboardUrl: 'https://dashboard.stripe.com/settings/payment_methods',
    metodosRelevantesMexico: ['card', 'oxxo', 'spei', 'link'],
    modo,
    webhookConfigurado: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  };
}

async function listarCodigosDescuento() {
  const stripe = obtenerStripe();
  // El cupón ahora vive anidado bajo promotion.coupon (confirmado al
  // probar en local, 2026-10-26) — expand con la ruta anidada real.
  const promociones = await stripe.promotionCodes.list({ limit: 50, expand: ['data.promotion.coupon'] });
  return promociones.data.map((p) => {
    const coupon = p.promotion.coupon;
    return {
      id: p.id,
      codigo: p.code,
      activo: p.active,
      tipo: coupon.percent_off != null ? 'porcentaje' : 'monto',
      valor: coupon.percent_off != null ? coupon.percent_off : (coupon.amount_off || 0) / 100,
      duracion: coupon.duration,
      duracionMeses: coupon.duration_in_months || null,
      vigenciaHasta: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
      usosMaximos: p.max_redemptions || null,
      usosActuales: p.times_redeemed,
    };
  });
}

async function crearCodigoDescuento({ codigo, tipo, valor, duracion, duracionMeses, vigenciaHasta, usosMaximos }) {
  const stripe = obtenerStripe();

  const cuponParams = { duration: duracion };
  if (tipo === 'porcentaje') cuponParams.percent_off = Number(valor);
  else {
    cuponParams.amount_off = Math.round(Number(valor) * 100);
    cuponParams.currency = 'mxn';
  }
  if (duracion === 'repeating') {
    if (!duracionMeses) {
      const err = new Error('Una duración "repetida" necesita cuántos meses.');
      err.codigo = 'validacion';
      throw err;
    }
    cuponParams.duration_in_months = Number(duracionMeses);
  }

  const coupon = await stripe.coupons.create(cuponParams);

  // Confirmado al probar en local (2026-10-26, mismo hallazgo que
  // payment_method_types en stripePagos.js): esta versión de la API
  // anida el cupón bajo `promotion: {type:'coupon', coupon:<id>}`, ya no
  // acepta `coupon` como parámetro plano en la raíz — ver
  // node_modules/stripe/cjs/resources/PromotionCodes.d.ts.
  const promoParams = { promotion: { type: 'coupon', coupon: coupon.id }, code: codigo };
  if (vigenciaHasta) promoParams.expires_at = Math.floor(new Date(vigenciaHasta).getTime() / 1000);
  if (usosMaximos) promoParams.max_redemptions = Number(usosMaximos);

  const promo = await stripe.promotionCodes.create(promoParams);
  return { id: promo.id, codigo: promo.code };
}

async function desactivarCodigoDescuento(promotionCodeId) {
  const stripe = obtenerStripe();
  await stripe.promotionCodes.update(promotionCodeId, { active: false });
}

module.exports = {
  PLAZOS_VALIDOS,
  getConfigMsi,
  setConfigMsi,
  metodosPagoInfo,
  listarCodigosDescuento,
  crearCodigoDescuento,
  desactivarCodigoDescuento,
};
