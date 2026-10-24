// Onboarding público, Segmento B (13 oct 2026): convierte un borrador
// COMPLETO (ver onboardingBorrador.js) en un tenant real, de punta a
// punta y sin intervención de un operador — decisión explícita del
// usuario ("el sistema debe funcionar como selfservice"). Encadena los
// mismos pasos que hoy hace un operador a mano desde /control (intake →
// activar físico → asignar plan), más uno nuevo (crear el usuario
// administrador con las credenciales que el prospecto ya eligió en el
// wizard) — nunca reinventa esos pasos, los reusa tal cual.
//
// Idempotente a propósito: cada paso revisa el estado real antes de
// repetir trabajo, para que un reintento tras un timeout de red (el
// frontend sí reintenta) nunca duplique una fila ni reenvíe el alta dos
// veces por error.

const { obtenerPool } = require('../db');
const { obtenerBorradorInterno, ErrorOnboarding } = require('./onboardingBorrador');
const { crearTenantIntake, ErrorIntakeTenant } = require('./tenantIntake');
const { obtenerTenantPorSlug, activarTenant, ErrorTransicionTenant } = require('./tenantLifecycle');
const { actualizarDatosTenant } = require('./tenantEdicion');
const { crearAdminInicialFisico, ErrorActivacionFisica } = require('./notificarBackend');
const { derivarNombreUsuario } = require('./credencialesAdmin');
const { actualizarSuscripcionTenant } = require('./tenantSuscripcion');

// Mismo catálogo de claves que clarvo-Site/src/data/plans.ts y
// onboardingBorrador.js:PLANES_PUBLICOS — el nombre exacto con el que
// cada plan se creó en el catálogo real de /control (punto 391). Si se
// renombra un plan ahí, actualizar aquí también.
const NOMBRE_PLAN_POR_CLAVE = {
  solicita: 'CLARVO Solicita',
  controla: 'CLARVO Controla',
  crece: 'CLARVO Crece',
  domina: 'CLARVO Domina',
};

const APP_BASE_URL = (process.env.PUBLIC_APP_BASE_URL || 'https://clarvo.mx').replace(/\/$/, '');

// No bloquea la conversión si el plan no se encuentra (catálogo editado,
// plan archivado, etc.) — la cuenta igual debe quedar activa; el operador
// puede asignar el plan manualmente después desde /control.
async function resolverPlanIdPorClave(planClave, db) {
  const nombre = NOMBRE_PLAN_POR_CLAVE[planClave];
  if (!nombre) return null;
  try {
    const [filas] = await db.query('SELECT id FROM planes WHERE nombre = ? AND activo = 1 LIMIT 1', [nombre]);
    return filas.length > 0 ? filas[0].id : null;
  } catch (err) {
    console.error(`No se pudo resolver el plan "${planClave}" (${nombre}):`, err.message);
    return null;
  }
}

async function convertirBorrador(token, { actor = 'onboarding-publico', db = obtenerPool() } = {}) {
  const borrador = await obtenerBorradorInterno(token, db);

  const faltantes = [];
  if (!borrador.nombre_empresa) faltantes.push('nombre de la empresa');
  if (!borrador.slug) faltantes.push('tu URL en Clarvo');
  if (!borrador.contacto_email) faltantes.push('correo de contacto');
  if (!borrador.admin_email) faltantes.push('correo del administrador');
  if (!borrador.admin_password_hash) faltantes.push('contraseña del administrador');
  if (faltantes.length > 0) {
    throw new ErrorOnboarding(`Faltan datos para activar tu cuenta: ${faltantes.join(', ')}.`, 'validacion');
  }

  // ----- Paso 1: intake (idempotente) -----
  let tenant = await obtenerTenantPorSlug(borrador.slug, db);
  if (!tenant) {
    try {
      tenant = await crearTenantIntake(
        {
          nombreEmpresa: borrador.nombre_empresa,
          slug: borrador.slug,
          contactoEmail: borrador.contacto_email,
          notas: `Alta self-service desde clarvo.mx (borrador ${token}).`,
        },
        { actor, db }
      );
    } catch (err) {
      if (err instanceof ErrorIntakeTenant && err.codigo === 'slug_existe') {
        // Condición de carrera (otro alta tomó el slug justo ahora, o un
        // reintento nuestro se cruzó con el intake anterior) — releer en
        // vez de fallar.
        tenant = await obtenerTenantPorSlug(borrador.slug, db);
        if (!tenant) {
          throw new ErrorOnboarding('No se pudo crear tu cuenta. Intenta de nuevo.', 'aprovisionamiento');
        }
      } else {
        throw err;
      }
    }
  }

  // ----- Paso 2: aprovisionamiento físico + activación (idempotente) -----
  if (tenant.estado === 'provisioning') {
    try {
      tenant = await activarTenant(borrador.slug, { actor }, db);
    } catch (err) {
      const motivo =
        err instanceof ErrorTransicionTenant
          ? err.message
          : 'No se pudo activar tu cuenta. Intenta de nuevo en unos minutos.';
      throw new ErrorOnboarding(motivo, 'aprovisionamiento');
    }
  } else if (tenant.estado !== 'activo') {
    throw new ErrorOnboarding(
      'Tu cuenta quedó en un estado inesperado — contáctanos para resolverlo.',
      'estado_invalido'
    );
  }

  // ----- Paso 3: asignar el plan elegido (best-effort, nunca bloquea) -----
  // Siempre se reaplica si se resolvió un planId (idempotente — un UPDATE
  // con el mismo valor no cambia nada) en vez de comparar contra
  // tenant.plan_id: obtenerTenantPorSlug() no trae esa columna en su
  // SELECT, así que compararla aquí compararía contra `undefined` y
  // reaplicaría de todas formas — más simple y correcto no comparar.
  const planId = await resolverPlanIdPorClave(borrador.plan_clave, db);
  if (planId) {
    try {
      tenant = await actualizarDatosTenant(
        borrador.slug,
        { nombreEmpresa: tenant.nombre_empresa, contactoEmail: tenant.contacto_email, planId },
        { actor, db }
      );
    } catch (err) {
      console.error(`No se pudo asignar el plan "${borrador.plan_clave}" al tenant "${borrador.slug}":`, err.message);
    }
  }

  // ----- Paso 3b: inicializar la suscripción (punto 416, idempotente) -----
  // origenForzado='onboarding' protege la fecha de inicio del ciclo —
  // ningún guardado manual posterior desde /control podrá moverla (ver
  // tenantSuscripcion.js). estatus='pendiente', nunca 'pagada': Stripe
  // todavía no está integrado de verdad (confirmado con el usuario,
  // "por ahora usa solo mocks, al final integramos") — marcar "pagada"
  // aquí sería mentir sobre un cobro que nunca ocurrió. Un operador
  // puede cambiarlo a mano por ahora; el webhook real de Stripe lo hará
  // solo cuando esa integración exista.
  try {
    await actualizarSuscripcionTenant(
      borrador.slug,
      { enPrueba: false, ciclo: borrador.ciclo || 'mensual', estatus: 'pendiente' },
      { actor, db, origenForzado: 'onboarding' }
    );
  } catch (err) {
    console.error(`No se pudo inicializar la suscripción del tenant "${borrador.slug}":`, err.message);
  }

  // ----- Paso 4: usuario administrador inicial (idempotente en backend/) -----
  try {
    await crearAdminInicialFisico(borrador.slug, {
      email: borrador.admin_email,
      passwordHash: borrador.admin_password_hash,
      nombreUsuario: derivarNombreUsuario(borrador.admin_email),
    });
  } catch (err) {
    const motivo =
      err instanceof ErrorActivacionFisica
        ? err.message
        : 'Tu cuenta se creó, pero no pudimos configurar tu acceso de administrador. Contáctanos.';
    throw new ErrorOnboarding(motivo, 'aprovisionamiento');
  }

  // ----- Paso 5: marcar el borrador como convertido -----
  await db.query(
    `UPDATE onboarding_borradores SET estado = 'convertido', actualizado_en = ? WHERE token = ?`,
    [new Date(), token]
  );

  return {
    slug: borrador.slug,
    urlAdmin: `${APP_BASE_URL}/${borrador.slug}/admin`,
    urlPortal: `${APP_BASE_URL}/${borrador.slug}`,
  };
}

module.exports = { convertirBorrador };
