// Cancelación de suscripción con retención (propuestas A2+A1 aprobadas,
// punto en curso) + encuesta de salida obligatoria (C1) + sincronización
// real con Stripe (requiere tenants.stripe_subscription_id — ver
// stripePagos.js, que desde este mismo punto crea Subscriptions reales,
// no cobros únicos).
//
// Regla de negocio confirmada por el usuario: la oferta de descuento
// (A2) se aplica SOLO UNA VEZ por tenant — en el siguiente intento de
// cancelar (suscripcion_descuento_retencion_usado ya en 1) solo se
// ofrece pausar (A1), nunca el descuento otra vez. Cancelar de verdad
// nunca se bloquea — solo se deja de "vender" la retención.
//
// La fuente de verdad del estatus de la Subscription es SIEMPRE Stripe —
// `tenants.suscripcion_cancelar_al_corte` es un espejo local (para pintar
// la UI sin llamar a la API en cada carga de Mi Cuenta) que se
// resincroniza desde el webhook `customer.subscription.updated`
// (ver webhooksSuscripcion.js).

const { obtenerPool } = require('../db');
const { obtenerStripe } = require('./stripePagos');
const { notificarInvalidacionCache, enviarCorreoBase } = require('./notificarBackend');
const { suspenderTenant } = require('./tenantLifecycle');

const DIAS_PAUSA = 30;
const PORCENTAJE_DESCUENTO_RETENCION = 50;

class ErrorCancelacion extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorCancelacion';
    this.codigo = codigo; // 'no_encontrado' | 'sin_suscripcion' | 'validacion'
  }
}

async function cargarTenantPorSlug(slug, db) {
  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  return filas[0] || null;
}

function exigirTenantConSuscripcion(tenant) {
  if (!tenant || tenant.estado === 'baja') {
    throw new ErrorCancelacion('Empresa no encontrada.', 'no_encontrado');
  }
  if (!tenant.stripe_subscription_id) {
    throw new ErrorCancelacion(
      'Esta empresa no tiene una suscripción real de Stripe — contacta a soporte.',
      'sin_suscripcion'
    );
  }
}

async function registrarEventoTenant(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en) VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

// Paso 1 del flujo (A2 si aplica, A1 si no): qué debe ofrecer la UI antes
// de pedir el motivo de salida. Nunca decide por el usuario — solo
// informa si la oferta de descuento sigue disponible.
async function obtenerEstadoCancelacion(slug, db = obtenerPool()) {
  const tenant = await cargarTenantPorSlug(slug, db);
  exigirTenantConSuscripcion(tenant);
  return {
    ofreceDescuento: !tenant.suscripcion_descuento_retencion_usado,
    cancelarAlCorte: !!tenant.suscripcion_cancelar_al_corte,
    fechaCorte: tenant.suscripcion_expira_en ? String(tenant.suscripcion_expira_en).slice(0, 10) : null,
    porcentajeDescuento: PORCENTAJE_DESCUENTO_RETENCION,
  };
}

// A2: aplica el descuento de un solo mes/año y marca el candado de "ya
// se usó" — nunca se puede volver a ofrecer a este tenant. El cupón se
// crea ad-hoc (duration:'once', mismo criterio que el resto del proyecto
// para precios de Stripe: nunca vive en un catálogo reusable) y se
// adjunta directo a la Subscription real.
async function aplicarDescuentoRetencion(slug, { actor } = {}, db = obtenerPool()) {
  const tenant = await cargarTenantPorSlug(slug, db);
  exigirTenantConSuscripcion(tenant);
  if (tenant.suscripcion_descuento_retencion_usado) {
    throw new ErrorCancelacion('Esta empresa ya usó su descuento de retención — no se puede aplicar otra vez.', 'validacion');
  }

  const stripe = obtenerStripe();
  const cupon = await stripe.coupons.create({
    duration: 'once',
    percent_off: PORCENTAJE_DESCUENTO_RETENCION,
    name: 'Oferta de retención (1 vez)',
  });
  await stripe.subscriptions.update(tenant.stripe_subscription_id, {
    discounts: [{ coupon: cupon.id }],
  });

  await db.query(
    `UPDATE tenants SET suscripcion_descuento_retencion_usado = 1 WHERE id = ?`,
    [tenant.id]
  );
  await registrarEventoTenant(db, tenant.id, 'descuento_retencion_aplicado', `${PORCENTAJE_DESCUENTO_RETENCION}% de descuento, 1 ciclo`, actor);

  return { ok: true, porcentaje: PORCENTAJE_DESCUENTO_RETENCION };
}

// A1: pausa real de cobro (Stripe `pause_collection`) — no genera
// facturas durante la pausa y se reanuda solo en `resumes_at`, sin
// intervención manual. Disponible siempre, incluso si ya se usó el
// descuento — es la alternativa que SIEMPRE se puede ofrecer.
async function pausarSuscripcion(slug, { actor } = {}, db = obtenerPool()) {
  const tenant = await cargarTenantPorSlug(slug, db);
  exigirTenantConSuscripcion(tenant);

  const stripe = obtenerStripe();
  const resumeAt = Math.floor(Date.now() / 1000) + DIAS_PAUSA * 24 * 60 * 60;
  await stripe.subscriptions.update(tenant.stripe_subscription_id, {
    pause_collection: { behavior: 'void', resumes_at: resumeAt },
  });
  await registrarEventoTenant(db, tenant.id, 'suscripcion_pausada', `${DIAS_PAUSA} días`, actor);

  return { ok: true, diasPausa: DIAS_PAUSA, reanudaEn: new Date(resumeAt * 1000) };
}

// Encuesta de salida (C1) — SIEMPRE se guarda antes de confirmar la
// cancelación, para las 2 variantes aprobadas (motivo + comentario
// opcional). `slug` denormalizado a propósito (ver ensureSchema.js) para
// que el reporte de /control (Sección E) sobreviva aunque el tenant se
// dé de baja después.
async function registrarEncuestaSalida(slug, { motivo, comentario } = {}, db = obtenerPool()) {
  const tenant = await cargarTenantPorSlug(slug, db);
  if (!tenant) throw new ErrorCancelacion('Empresa no encontrada.', 'no_encontrado');
  if (!motivo || typeof motivo !== 'string' || !motivo.trim()) {
    throw new ErrorCancelacion('El motivo de la encuesta es obligatorio.', 'validacion');
  }
  await db.query(
    `INSERT INTO cancelaciones_encuesta (tenant_id, slug, motivo, comentario, creado_en) VALUES (?, ?, ?, ?, ?)`,
    [tenant.id, slug, motivo.trim().slice(0, 60), (comentario || '').trim().slice(0, 2000) || null, new Date()]
  );
  return { ok: true };
}

// Confirma la cancelación real: `cancel_at_period_end: true` — el
// tenant SIGUE con acceso completo hasta que termine el periodo ya
// pagado (mismo criterio ya mostrado en la propuesta visual, timeline de
// corte). La suspensión real (bloquea admin Y portal) llega después,
// disparada por el webhook `customer.subscription.deleted` cuando Stripe
// avisa que el periodo de verdad terminó — ver webhooksSuscripcion.js.
async function confirmarCancelacion(slug, { actor } = {}, db = obtenerPool()) {
  const tenant = await cargarTenantPorSlug(slug, db);
  exigirTenantConSuscripcion(tenant);

  const stripe = obtenerStripe();
  const suscripcion = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
    cancel_at_period_end: true,
  });
  await db.query(`UPDATE tenants SET suscripcion_cancelar_al_corte = 1 WHERE id = ?`, [tenant.id]);
  await registrarEventoTenant(db, tenant.id, 'suscripcion_cancelada_al_corte', null, actor);
  notificarInvalidacionCache(slug).catch((err) => {
    console.error(`No se pudo invalidar la caché del backend tras cancelar "${slug}":`, err.message);
  });

  return {
    ok: true,
    cancelarAlCorte: true,
    fechaCorte: tenant.suscripcion_expira_en ? String(tenant.suscripcion_expira_en).slice(0, 10) : null,
    estatusStripe: suscripcion.status,
  };
}

// Propuesta de retención por correo (reemplaza "Subir de plan" en el
// reporte de Control — ese botón no tenía sentido para un tenant que ya
// cancela, ver discusión real con el usuario). SOLO disponible si nunca
// usó el descuento de retención (A2) — si ya lo usó, no hay nada nuevo
// que ofrecerle por esta vía. Nunca aplica el descuento ni reactiva
// nada por sí solo: es un disparador manual del operador, sin
// operadores de llamada todavía — el contenido real de la campaña se
// programa después, esto solo deja la mecánica (envío + marca de
// "ya se le propuso") lista.
async function enviarPropuestaRetencion(slug, { actor } = {}, db = obtenerPool()) {
  const tenant = await cargarTenantPorSlug(slug, db);
  if (!tenant) throw new ErrorCancelacion('Empresa no encontrada.', 'no_encontrado');
  if (tenant.suscripcion_descuento_retencion_usado) {
    throw new ErrorCancelacion('Esta empresa ya usó su descuento de retención — no hay una propuesta nueva que ofrecerle.', 'validacion');
  }
  if (!tenant.contacto_email) {
    throw new ErrorCancelacion('Esta empresa no tiene correo de contacto capturado.', 'validacion');
  }

  await enviarCorreoBase({
    destinatario: tenant.contacto_email,
    asunto: 'Antes de que te vayas — tenemos una propuesta para ti',
    cuerpo: `Hola,\n\nVimos que cancelaste tu suscripción a Clarvo. Nos encantaría que te quedaras — contáctanos respondiendo este correo y platicamos una propuesta hecha para "${tenant.nombre_empresa}".\n\n— Clarvo`,
  });

  await db.query(
    `UPDATE cancelaciones_encuesta SET propuesta_enviada_en = ? WHERE tenant_id = ? ORDER BY creado_en DESC LIMIT 1`,
    [new Date(), tenant.id]
  );
  await registrarEventoTenant(db, tenant.id, 'propuesta_retencion_enviada', null, actor);

  return { ok: true };
}

module.exports = {
  ErrorCancelacion,
  enviarPropuestaRetencion,
  DIAS_PAUSA,
  PORCENTAJE_DESCUENTO_RETENCION,
  obtenerEstadoCancelacion,
  aplicarDescuentoRetencion,
  pausarSuscripcion,
  registrarEncuestaSalida,
  confirmarCancelacion,
};
