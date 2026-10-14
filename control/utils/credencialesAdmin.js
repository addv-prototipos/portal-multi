// Helpers compartidos para capturar la contraseña del PRIMER
// administrador de un tenant — usados por dos flujos distintos que
// convergen en el mismo backend/ (POST /internal/crear-admin-inicial):
// el wizard público de onboarding (control/utils/onboardingBorrador.js,
// onboardingConversion.js) y el alta manual de un operador desde
// /control (control/server.js, POST /api/control/tenants/:slug/activar).
// Extraído a su propio archivo para que ninguno de los dos flujos tenga
// que reimplementarlo ni importar del otro.

const crypto = require('crypto');

// Hash irreversible — MISMO formato exacto (salt:hash, scrypt keylen=64)
// que backend/utils/authUsuario.js, para que lo que se guarda aquí sea
// compatible tal cual con verifyPassword() de ese archivo. Duplicado a
// propósito: control/ y backend/ no comparten código en producción.
function hashPasswordAdmin(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Mismas reglas que backend/utils/authUsuario.js:validarPassword().
function validarPasswordAdmin(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número.';
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir al menos una letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una letra mayúscula.';
  return null;
}

// El nombre de usuario (columna `rfc` de `usuarios`, ver backend/server.js
// POST /api/admin/usuarios) nunca es el correo completo — el formato de
// nombre de usuario válido no admite "@". Se deriva del local-part del
// correo, sanitizado; "admin@miempresa.com" -> "ADMIN".
function derivarNombreUsuario(email) {
  const local = String(email || '').split('@')[0] || 'admin';
  const limpio = local.toUpperCase().replace(/[^A-Z0-9._-]/g, '');
  return (limpio || 'ADMIN').slice(0, 50);
}

module.exports = { hashPasswordAdmin, validarPasswordAdmin, derivarNombreUsuario };
