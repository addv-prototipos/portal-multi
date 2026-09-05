// Validación de correo compartida por tenantIntake.js (correo de
// contacto de la empresa). El resto de este módulo (validación de datos
// fiscales del intake/edición) se retiró junto con la sección "Datos
// fiscales (opcional)" de /control — esa captura ya no existe en la UI.

const validator = require('validator');

function isValidEmail(email) {
  return typeof email === 'string' && validator.isEmail(email);
}

module.exports = { isValidEmail };
