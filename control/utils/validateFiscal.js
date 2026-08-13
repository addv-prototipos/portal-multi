// Validación de los datos fiscales capturados en el intake de empresa
// nueva (segmento 9c, ver PROJECT_STATE.md) — duplicado de las mismas
// reglas que ya usa backend/utils/config.js:setConfiguracionGlobal() /
// backend/utils/validate.js, para que un dato capturado aquí y luego
// pre-llenado en la BD del tenant nuevo (ver
// backend/scripts/lib/controlDb.js:aplicarConfiguracionFiscalEnProcesoHijo)
// nunca sea rechazado ahí por una regla más estricta que la de acá.
// control/ es un contexto de build de Docker aparte de backend/, así que
// se duplica en vez de importarse (mismo motivo que control/utils/tenant.js).

const validator = require('validator');

function isValidEmail(email) {
  return typeof email === 'string' && validator.isEmail(email);
}

// Validación laxa de RFC mexicano (12-13 caracteres alfanuméricos) —
// vacío es válido, el RFC es opcional en este intake.
function isValidRFC(rfc) {
  if (!rfc) return true;
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc.trim());
}

// Recibe el objeto crudo de datos fiscales del formulario (todas las
// claves opcionales) y devuelve los valores normalizados listos para
// guardar, o lanza un Error con el mensaje exacto del campo que falló —
// mismo criterio que setConfiguracionGlobal(), campo por campo.
function normalizarYValidarDatosFiscales(datos = {}) {
  const normalizado = {};

  const rfc = typeof datos.rfcCompania === 'string' ? datos.rfcCompania.trim().toUpperCase() : '';
  if (!isValidRFC(rfc)) {
    throw new Error('El RFC de la compañía no tiene un formato válido.');
  }
  normalizado.rfcCompania = rfc || null;

  normalizado.razonSocialCompania =
    typeof datos.razonSocialCompania === 'string' ? datos.razonSocialCompania.trim() || null : null;

  normalizado.regimenFiscalCompania =
    typeof datos.regimenFiscalCompania === 'string' ? datos.regimenFiscalCompania.trim() || null : null;

  normalizado.tipoPersonaCompania =
    datos.tipoPersonaCompania === 'fisica' || datos.tipoPersonaCompania === 'moral'
      ? datos.tipoPersonaCompania
      : null;

  const claveSat = typeof datos.claveSat === 'string' ? datos.claveSat.trim() : '';
  if (claveSat && !/^\d{8}$/.test(claveSat)) {
    throw new Error('La Clave SAT debe ser exactamente 8 dígitos.');
  }
  normalizado.claveSat = claveSat || null;

  const linkCodigosSat = typeof datos.linkCodigosSat === 'string' ? datos.linkCodigosSat.trim() : '';
  if (linkCodigosSat) {
    try {
      const url = new URL(linkCodigosSat);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('protocolo inválido');
      }
    } catch (e) {
      throw new Error('El link de códigos SAT debe ser una URL válida (http:// o https://).');
    }
  }
  normalizado.linkCodigosSat = linkCodigosSat || null;

  const correoReportes = typeof datos.correoReportes === 'string' ? datos.correoReportes.trim().toLowerCase() : '';
  if (correoReportes && !isValidEmail(correoReportes)) {
    throw new Error('El correo de reportes no tiene un formato válido.');
  }
  normalizado.correoReportes = correoReportes || null;

  return normalizado;
}

// Verdadero si al menos un campo fiscal trae un valor real — usado para
// decidir si vale la pena correr el paso de pre-llenado al aprovisionar
// (backend/scripts/lib/controlDb.js).
function tieneAlgunDatoFiscal(datosNormalizados) {
  return Object.values(datosNormalizados).some((v) => v !== null);
}

module.exports = { isValidEmail, isValidRFC, normalizarYValidarDatosFiscales, tieneAlgunDatoFiscal };
