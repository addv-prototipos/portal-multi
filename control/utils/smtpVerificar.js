// Handshake de solo-verificación (nodemailer .verify(), sin enviar
// correo) contra el SMTP default de control/ (accesoSmtp.js) — mismo
// criterio y mismos mensajes de error que
// backend/utils/email.js:verificarConexionSmtp/traducirErrorSmtp,
// duplicado aquí a propósito (control/ y backend/ son builds de Docker
// separados, no comparten código en producción).
const nodemailer = require('nodemailer');
const { getAccesoSmtp, marcarAccesoSmtpVerificado } = require('./accesoSmtp');

function crearTransportador(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.puerto,
    secure: config.seguridad === 'ssl',
    auth: {
      user: config.usuario,
      pass: config.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

function traducirErrorSmtp(err, config) {
  if (err.code === 'EAUTH') {
    return new Error(
      'El servidor SMTP rechazó las credenciales. Si usas Gmail, verifica que estés usando una "Contraseña de aplicación" (no la contraseña normal de la cuenta) — se genera en la configuración de seguridad de Google con la verificación en dos pasos activada.'
    );
  }
  if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
    return new Error(
      `No se pudo conectar con "${config.host}:${config.puerto}". Verifica el host, el puerto y que el servidor tenga salida a internet.`
    );
  }
  return new Error(err.message || 'No se pudo completar la operación SMTP.');
}

async function verificarAccesoSmtp(db) {
  const config = await getAccesoSmtp(db);
  if (!config || !config.host || !config.usuario || !config.password) {
    throw new Error(
      'El correo SMTP no está configurado todavía. Guarda host, usuario y contraseña antes de verificar la conexión.'
    );
  }
  const transportador = crearTransportador(config);
  try {
    await transportador.verify();
  } catch (err) {
    throw traducirErrorSmtp(err, config);
  }
  return marcarAccesoSmtpVerificado(db);
}

module.exports = { verificarAccesoSmtp, crearTransportador, traducirErrorSmtp };
