// Integración de pagos "cobrar primero, activar después" (confirmado
// por el usuario): el borrador existe y se puede llenar por completo
// ANTES de que el pago se confirme — pero `convertirBorrador()` (el
// aprovisionamiento real) solo se dispara una vez que Stripe avisa que
// el dinero ya llegó, nunca al enviar el formulario. Dos caminos llegan
// a ese mismo punto:
//   1. Tarjeta exitosa al instante: checkout.session.completed llega con
//      payment_status 'paid' — se activa de inmediato.
//   2. OXXO/SPEI (métodos "delayed notification"): checkout.session.completed
//      llega con payment_status 'unpaid' (el cliente generó la ficha, no
//      pagó todavía) — NO activa nada. Activa hasta que llegue
//      checkout.session.async_payment_succeeded (o se cancela con
//      checkout.session.async_payment_failed).
//
// Precio SIEMPRE resuelto server-side desde `planes.precio_mensual`/
// `precio_anual` (vía resolverPlanPorClave) — nunca un monto que mande el
// cliente.

const Stripe = require('stripe');
const { obtenerPool } = require('../db');
const { obtenerBorradorInterno, ErrorOnboarding } = require('./onboardingBorrador');
const { resolverPlanPorClave, convertirBorrador } = require('./onboardingConversion');
const { getConfigMsi } = require('./stripeConfig');

const APP_BASE_URL = (process.env.PUBLIC_APP_BASE_URL || 'https://clarvo.mx').replace(/\/$/, '');

function obtenerStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new ErrorOnboarding('El cobro con Stripe no está configurado todavía.', 'aprovisionamiento');
  }
  return new Stripe(secretKey);
}

// Monto en centavos (MXN) — Stripe siempre espera la unidad mínima de la
// moneda, nunca el monto "humano" directo.
function montoCentavos(precio) {
  return Math.round(Number(precio) * 100);
}

async function crearCheckoutSession(token, { db = obtenerPool() } = {}) {
  const borrador = await obtenerBorradorInterno(token, db);
  const plan = await resolverPlanPorClave(borrador.plan_clave, db);
  if (!plan) {
    throw new ErrorOnboarding('No se pudo resolver el precio de tu plan. Contáctanos.', 'aprovisionamiento');
  }
  const precio = borrador.ciclo === 'anual' ? plan.precio_anual : plan.precio_mensual;
  if (precio === null || precio === undefined) {
    throw new ErrorOnboarding('Este plan todavía no tiene un precio configurado. Contáctanos.', 'validacion');
  }

  const stripe = obtenerStripe();
  const intervaloNombre = borrador.ciclo === 'anual' ? 'año' : 'mes';

  // Nota real (descubierto al probar en local, 2026-10-26): Stripe ya NO
  // acepta `payment_method_types` explícito al crear un Checkout Session
  // — los métodos disponibles ahora se gobiernan 100% desde el
  // Dashboard (Settings → Payment methods, ver DOCS/confStripe.html paso
  // 8). Mientras OXXO no esté activado ahí, Checkout solo ofrece
  // tarjeta — eso es correcto y esperado, no un bug de este código.
  // Meses sin intereses: solo si hay plazos configurados en /control Y el
  // monto alcanza el mínimo que ahí mismo se definió — Stripe exige
  // enabled=true explícito, nunca lo ofrece solo porque la tarjeta lo
  // soporte.
  const configMsi = await getConfigMsi(db);
  const paymentMethodOptions = {};
  if (configMsi.plazos.length > 0 && precio >= configMsi.montoMinimo) {
    paymentMethodOptions.card = { installments: { enabled: true } };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // Reporte de cupones (punto en curso): deja que el prospecto escriba
    // un código en la propia página de Stripe — sin esto, ningún código
    // de descuento de /control es alcanzable desde el onboarding real.
    allow_promotion_codes: true,
    ...(Object.keys(paymentMethodOptions).length ? { payment_method_options: paymentMethodOptions } : {}),
    line_items: [
      {
        price_data: {
          currency: 'mxn',
          unit_amount: montoCentavos(precio),
          product_data: { name: `Clarvo — ${plan.nombre || borrador.plan_clave} (${intervaloNombre})` },
        },
        quantity: 1,
      },
    ],
    metadata: { borradorToken: token },
    // Pago es el ÚLTIMO paso del wizard (punto 430) — al volver exitoso
    // no queda NADA por llenar, solo esperar el polling de activación
    // ("completado"). Si cancela/vuelve atrás desde Stripe, regresa al
    // mismo paso de pago (ya tiene todo lo demás guardado).
    success_url: `${APP_BASE_URL}/?onboarding=${token}&paso=completado&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_BASE_URL}/?onboarding=${token}&paso=pago`,
  });

  await db.query(
    `UPDATE onboarding_borradores
       SET stripe_checkout_session_id = ?, pago_estado = 'pendiente', actualizado_en = ?
     WHERE token = ?`,
    [session.id, new Date(), token]
  );

  return { checkoutUrl: session.url };
}

// Idempotencia: Stripe reintenta/reenvía eventos — un mismo event.id
// nunca debe reprocesarse (evita duplicar el correo de credenciales o
// re-ejecutar convertirBorrador() dos veces). INSERT ... ya basta como
// candado: si el event.id ya existe, el INSERT truena con duplicado y se
// trata como "ya procesado", sin necesitar un SELECT previo (evita una
// condición de carrera entre el SELECT y el INSERT).
async function yaProcesado(eventId, tipo, db) {
  try {
    await db.query(
      'INSERT INTO stripe_eventos_procesados (event_id, tipo, procesado_en) VALUES (?, ?, ?)',
      [eventId, tipo, new Date()]
    );
    return false;
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return true;
    throw err;
  }
}

// Deriva el método de pago real usado en la sesión (tarjeta vs
// oxxo/spei) para que el paso Completado del wizard sepa qué mensaje
// mostrar — Stripe expone esto en session.payment_method_types (el tipo
// que el cliente eligió en su página de Checkout, no la lista completa
// que ofrecimos).
function metodoDeSession(session) {
  const tipos = Array.isArray(session.payment_method_types) ? session.payment_method_types : [];
  return tipos[0] || 'card';
}

// Reporte de cupones: `discounts` es un campo normal del Checkout Session
// (no necesita expand) — confirmado contra las definiciones reales del
// SDK instalado (node_modules/stripe/cjs/resources/Checkout/Sessions.d.ts).
// `promotion_code` aquí es el ID ("promo_...", nunca el código humano
// como "LANZAMIENTO20") — el reporte lo resuelve cruzando contra
// stripe.promotionCodes.list() al armarse, nunca se duplica el texto
// aquí para evitar que diverja si el código se edita después en Stripe.
function promotionCodeIdDeSession(session) {
  const discounts = Array.isArray(session.discounts) ? session.discounts : [];
  const conCodigo = discounts.find((d) => d.promotion_code);
  if (!conCodigo) return null;
  return typeof conCodigo.promotion_code === 'string' ? conCodigo.promotion_code : conCodigo.promotion_code.id;
}

async function manejarPagoConfirmado(session, db) {
  const token = session.metadata && session.metadata.borradorToken;
  if (!token) {
    console.error('checkout.session sin metadata.borradorToken — no se puede activar ningún tenant con esto.', session.id);
    return;
  }

  const metodo = metodoDeSession(session);
  const promotionCodeId = promotionCodeIdDeSession(session);
  await db.query(
    `UPDATE onboarding_borradores
       SET pago_estado = 'confirmado', metodo_pago = ?, stripe_promotion_code = ?, actualizado_en = ?
     WHERE token = ? AND estado = 'activo' AND pago_estado != 'confirmado'`,
    [metodo, promotionCodeId, new Date(), token]
  );

  try {
    const resultado = await convertirBorrador(token, { actor: 'stripe-webhook', db });
    console.log(`Tenant "${resultado.slug}" activado tras confirmar pago (Stripe, método ${metodo}).`);
  } catch (err) {
    // El dinero YA se cobró — un fallo aquí es un caso que requiere
    // intervención manual de un operador (ver /control), nunca se
    // silencia del todo. No se re-lanza: este handler corre dentro del
    // webhook, que debe responder 200 a Stripe para que no reintente
    // indefinidamente un evento que de todas formas ya quedó registrado
    // en stripe_eventos_procesados.
    console.error(`Pago confirmado pero no se pudo aprovisionar el tenant del borrador "${token}":`, err.message);
  }
}

async function manejarPagoFallido(session, db) {
  const token = session.metadata && session.metadata.borradorToken;
  if (!token) return;
  const metodo = metodoDeSession(session);
  // El borrador se queda 'activo' a propósito (no 'abandonado') — el
  // prospecto puede volver a intentar el pago desde el mismo token sin
  // perder nada de lo que ya llenó.
  await db.query(
    `UPDATE onboarding_borradores SET pago_estado = 'fallido', metodo_pago = ?, actualizado_en = ? WHERE token = ?`,
    [metodo, new Date(), token]
  );
}

async function procesarEventoWebhook(event, { db = obtenerPool() } = {}) {
  if (await yaProcesado(event.id, event.type, db)) return;

  const session = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
      // Para tarjeta, 'completed' ya trae payment_status 'paid' — para
      // OXXO/SPEI llega con 'unpaid' (el cliente solo generó la ficha, el
      // dinero no ha llegado) y el aviso real es
      // checkout.session.async_payment_succeeded más adelante.
      if (session.payment_status === 'paid') {
        await manejarPagoConfirmado(session, db);
      }
      break;
    case 'checkout.session.async_payment_succeeded':
      await manejarPagoConfirmado(session, db);
      break;
    case 'checkout.session.async_payment_failed':
      await manejarPagoFallido(session, db);
      break;
    default:
      // Otros eventos (subscription.updated, etc.) se suman cuando se
      // construya facturación recurrente — fuera de alcance de este pase
      // (hoy es un cobro único por periodo, no una Subscription real de
      // Stripe).
      break;
  }
}

module.exports = { crearCheckoutSession, procesarEventoWebhook };
