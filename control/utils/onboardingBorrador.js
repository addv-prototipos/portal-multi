// Segmento A del onboarding público (clarvo.mx → modal de alta, modelo 3
// "modal sobre precios", confirmado por el usuario 2026-10-13): guarda el
// progreso de una empresa que está contratando el servicio ANTES de que
// exista ningún tenant real — plan elegido, datos de empresa, config
// inicial del panel y credenciales del admin. Sin Stripe real todavía
// (Segmento C, pendiente): el paso de pago queda en estado "pendiente" a
// propósito, nunca se finge un cobro exitoso.
//
// plan_clave es un string libre ('solicita'|'controla'|'crece'|'domina'),
// NO un plan_id con FK al catálogo de control/utils/planes.js — decisión
// explícita del usuario (2026-10-13, documentada en pendientes.html v-391):
// clarvo.mx sigue mostrando sus precios desde su propio
// src/data/plans.ts, no desde este catálogo, hasta que se construya el
// CMS en vivo (fuera de alcance por ahora). Resolver plan_clave contra un
// plan real de /control es trabajo del Segmento B (aprovisionamiento).
//
// Límite conocido y aceptado para este segmento: el slug no se "reserva"
// al guardarlo en el borrador, solo se valida que no choque con un tenant
// YA existente — dos prospectos podrían escribir el mismo slug en
// paralelo y solo el primero que de verdad se convierta en tenant (
// Segmento B) se lo queda; el otro recibe el error de slug_tomado en ese
// momento. Aceptable para un borrador especulativo (ni siquiera ha
// pagado), mismo criterio de "no bloquear antes de que sea necesario" que
// ya usa tenantIntake.js.

const crypto = require('crypto');
const { obtenerPool } = require('../db');
const { validarSlug } = require('./tenant');
const { isValidEmail } = require('./validateFiscal');
const { hashPasswordAdmin, validarPasswordAdmin } = require('./credencialesAdmin');

class ErrorOnboarding extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorOnboarding';
    this.codigo = codigo; // 'no_encontrado' | 'validacion' | 'slug_tomado'
  }
}

// Mismo catálogo de claves que clarvo-Site/src/data/plans.ts — duplicado
// a propósito (repos separados, sin build step compartido). Si se agrega
// o renombra un plan ahí, actualizar aquí también.
const PLANES_PUBLICOS = new Set(['solicita', 'controla', 'crece', 'domina']);

const PASOS_VALIDOS = ['plan', 'pago', 'empresa', 'config', 'credenciales', 'completado'];

function generarToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Nunca incluye admin_password_hash — esta fila puede viajar en una
// respuesta pública sin auth, el hash de la contraseña jamás se expone.
function mapearFila(fila) {
  return {
    token: fila.token,
    planClave: fila.plan_clave,
    ciclo: fila.ciclo,
    nombreEmpresa: fila.nombre_empresa,
    slug: fila.slug,
    contactoEmail: fila.contacto_email,
    nombreComercial: fila.nombre_comercial,
    zonaHoraria: fila.zona_horaria,
    adminEmail: fila.admin_email,
    tieneContrasena: !!fila.admin_password_hash,
    pasoActual: fila.paso_actual,
    estado: fila.estado,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

async function crearBorrador({ planClave, ciclo } = {}, db = obtenerPool()) {
  if (!PLANES_PUBLICOS.has(planClave)) {
    throw new ErrorOnboarding('Plan no reconocido.', 'validacion');
  }
  const cicloFinal = ciclo === 'anual' ? 'anual' : 'mensual';
  const token = generarToken();
  const ahora = new Date();
  await db.query(
    `INSERT INTO onboarding_borradores
       (token, plan_clave, ciclo, zona_horaria, paso_actual, estado, creado_en, actualizado_en)
     VALUES (?, ?, ?, 'America/Mexico_City', 'plan', 'activo', ?, ?)`,
    [token, planClave, cicloFinal, ahora, ahora]
  );
  return { token, planClave, ciclo: cicloFinal };
}

// Fila cruda, CON admin_password_hash — nunca exponer esto a una
// respuesta pública. Uso exclusivo de onboardingConversion.js (Segmento
// B), que necesita reenviar el hash tal cual a backend/ para crear el
// usuario administrador real.
async function obtenerBorradorInterno(token, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT * FROM onboarding_borradores WHERE token = ? AND estado = 'activo'`,
    [token]
  );
  if (filas.length === 0) {
    throw new ErrorOnboarding('Borrador no encontrado o ya no está activo.', 'no_encontrado');
  }
  return filas[0];
}

async function obtenerBorrador(token, db = obtenerPool()) {
  const fila = await obtenerBorradorInterno(token, db);
  return mapearFila(fila);
}

async function verificarSlugDisponible(slug, db = obtenerPool()) {
  const errorFormato = validarSlug(slug);
  if (errorFormato) {
    throw new ErrorOnboarding(errorFormato, 'validacion');
  }
  const [filas] = await db.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
  return filas.length === 0;
}

async function actualizarBorrador(token, cambios = {}, db = obtenerPool()) {
  const [filasExistentes] = await db.query(
    `SELECT id FROM onboarding_borradores WHERE token = ? AND estado = 'activo'`,
    [token]
  );
  if (filasExistentes.length === 0) {
    throw new ErrorOnboarding('Borrador no encontrado o ya no está activo.', 'no_encontrado');
  }

  const sets = [];
  const valores = [];

  if (cambios.ciclo !== undefined) {
    sets.push('ciclo = ?');
    valores.push(cambios.ciclo === 'anual' ? 'anual' : 'mensual');
  }

  if (cambios.nombreEmpresa !== undefined) {
    const nombreEmpresa = typeof cambios.nombreEmpresa === 'string' ? cambios.nombreEmpresa.trim() : '';
    if (!nombreEmpresa) throw new ErrorOnboarding('El nombre de la empresa es obligatorio.', 'validacion');
    if (nombreEmpresa.length > 255) throw new ErrorOnboarding('El nombre de la empresa no puede superar 255 caracteres.', 'validacion');
    sets.push('nombre_empresa = ?');
    valores.push(nombreEmpresa);
  }

  if (cambios.slug !== undefined) {
    const slug = typeof cambios.slug === 'string' ? cambios.slug.trim().toLowerCase() : '';
    const errorSlug = validarSlug(slug);
    if (errorSlug) throw new ErrorOnboarding(errorSlug, 'validacion');
    const [existentes] = await db.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existentes.length > 0) {
      throw new ErrorOnboarding(`"${slug}" ya está en uso. Elige otro.`, 'slug_tomado');
    }
    sets.push('slug = ?');
    valores.push(slug);
  }

  if (cambios.contactoEmail !== undefined) {
    const contactoEmail = typeof cambios.contactoEmail === 'string' ? cambios.contactoEmail.trim().toLowerCase() : '';
    if (!contactoEmail) throw new ErrorOnboarding('El correo de contacto es obligatorio.', 'validacion');
    if (!isValidEmail(contactoEmail)) throw new ErrorOnboarding('El correo de contacto no tiene un formato válido.', 'validacion');
    sets.push('contacto_email = ?');
    valores.push(contactoEmail);
  }

  if (cambios.nombreComercial !== undefined) {
    const nombreComercial = typeof cambios.nombreComercial === 'string' ? cambios.nombreComercial.trim() : '';
    if (nombreComercial.length > 255) throw new ErrorOnboarding('El nombre comercial no puede superar 255 caracteres.', 'validacion');
    sets.push('nombre_comercial = ?');
    valores.push(nombreComercial || null);
  }

  if (cambios.zonaHoraria !== undefined) {
    const zonaHoraria = typeof cambios.zonaHoraria === 'string' ? cambios.zonaHoraria.trim() : '';
    if (!zonaHoraria) throw new ErrorOnboarding('La zona horaria es obligatoria.', 'validacion');
    sets.push('zona_horaria = ?');
    valores.push(zonaHoraria);
  }

  if (cambios.adminEmail !== undefined) {
    const adminEmail = typeof cambios.adminEmail === 'string' ? cambios.adminEmail.trim().toLowerCase() : '';
    if (!adminEmail) throw new ErrorOnboarding('El correo del administrador es obligatorio.', 'validacion');
    if (!isValidEmail(adminEmail)) throw new ErrorOnboarding('El correo del administrador no tiene un formato válido.', 'validacion');
    sets.push('admin_email = ?');
    valores.push(adminEmail);
  }

  if (cambios.adminPassword !== undefined) {
    const errorPassword = validarPasswordAdmin(cambios.adminPassword);
    if (errorPassword) throw new ErrorOnboarding(errorPassword, 'validacion');
    sets.push('admin_password_hash = ?');
    valores.push(hashPasswordAdmin(cambios.adminPassword));
  }

  if (cambios.pasoActual !== undefined) {
    if (!PASOS_VALIDOS.includes(cambios.pasoActual)) {
      throw new ErrorOnboarding('Paso no reconocido.', 'validacion');
    }
    sets.push('paso_actual = ?');
    valores.push(cambios.pasoActual);
  }

  if (sets.length === 0) {
    return obtenerBorrador(token, db);
  }

  sets.push('actualizado_en = ?');
  valores.push(new Date());
  valores.push(token);

  try {
    await db.query(`UPDATE onboarding_borradores SET ${sets.join(', ')} WHERE token = ?`, valores);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new ErrorOnboarding('Ese dato ya está en uso.', 'validacion');
    }
    throw err;
  }

  return obtenerBorrador(token, db);
}

module.exports = {
  ErrorOnboarding,
  PLANES_PUBLICOS,
  PASOS_VALIDOS,
  crearBorrador,
  obtenerBorrador,
  obtenerBorradorInterno,
  actualizarBorrador,
  verificarSlugDisponible,
  hashPasswordAdmin,
  validarPasswordAdmin,
};
