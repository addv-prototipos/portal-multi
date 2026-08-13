const nodemailer = require('nodemailer');
const { pool } = require('../db');

const CLAVE_SMTP = 'smtp_config';

// Valores por defecto pensados para Gmail (smtp.gmail.com, puerto 587 con
// STARTTLS). El administrador puede cambiarlos si usa otro proveedor SMTP.
const DEFAULTS_SMTP = {
  host: 'smtp.gmail.com',
  puerto: 587,
  seguridad: 'starttls', // 'starttls' (587) o 'ssl' (465)
  usuario: '',
  password: '',
  nombre_remitente: '',
  correo_remitente: '',
  // Correo de quien va a facturar (el contador): a diferencia de los demás
  // campos de esta configuración, este no se usa para conectarse al
  // servidor SMTP — es el destinatario fijo de la notificación de "nuevo
  // ticket para facturar". Es un solo valor global (lo captura el
  // administrador aquí), no uno por cada cliente/RFC.
  correo_contador: '',
  // Plantilla del CUERPO del correo que recibe el CLIENTE cuando su
  // factura ya está lista (ver notificarFacturaListaAlCliente en
  // server.js). Admite las variables {folio} y {rfc}, que se sustituyen
  // por su valor real al enviar (ver aplicarPlantilla más abajo). El
  // asunto de ese correo NO es configurable a propósito: siempre es un
  // mensaje fijo de "factura lista" (ver ASUNTO_FACTURA_LISTA en server.js).
  cuerpo_cliente:
    'Tu factura para el ticket con folio {folio} ya está disponible.\n\n' +
    'Ingresa al Portal de Facturación ADDV y descárgala desde tu tablero de solicitudes.',
};

async function getConfigSmtp() {
  const [filas] = await pool.query('SELECT valor FROM configuracion WHERE clave = ?', [CLAVE_SMTP]);
  if (filas.length === 0) return null;
  try {
    const parsed = JSON.parse(filas[0].valor);
    return { ...DEFAULTS_SMTP, ...parsed };
  } catch (e) {
    return null;
  }
}

// Guarda cambios parciales sobre la configuración existente. La contraseña
// SOLO se sobreescribe si se manda una nueva no vacía — así el
// administrador puede ajustar el host o el remitente sin tener que volver
// a capturar la contraseña cada vez (y el frontend nunca recibe la
// contraseña guardada de vuelta, ver configSmtpParaMostrar).
async function setConfigSmtp(cambios) {
  const actual = (await getConfigSmtp()) || { ...DEFAULTS_SMTP };
  const nuevo = { ...actual };

  ['host', 'usuario', 'nombre_remitente', 'correo_remitente', 'correo_contador', 'cuerpo_cliente'].forEach((campo) => {
    if (typeof cambios[campo] === 'string') nuevo[campo] = cambios[campo].trim();
  });
  if (Number.isInteger(cambios.puerto)) nuevo.puerto = cambios.puerto;
  if (cambios.seguridad === 'starttls' || cambios.seguridad === 'ssl') nuevo.seguridad = cambios.seguridad;
  if (typeof cambios.password === 'string' && cambios.password.length > 0) {
    nuevo.password = cambios.password;
  }

  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_SMTP, JSON.stringify(nuevo)]
  );
  return nuevo;
}

// Nunca se devuelve la contraseña guardada al frontend — solo si hay una
// configurada o no (para poder mostrar "•••••• (guardada)" en la interfaz
// sin exponer el valor real).
function configSmtpParaMostrar(config) {
  if (!config) {
    return { configurado: false, ...DEFAULTS_SMTP, password: undefined, passwordConfigurada: false };
  }
  const { password, ...resto } = config;
  return {
    configurado: Boolean(config.host && config.usuario && config.password),
    ...resto,
    passwordConfigurada: Boolean(password),
  };
}

function crearTransportador(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.puerto,
    secure: config.seguridad === 'ssl', // true para 465 (SSL directo); false para 587 (STARTTLS, nodemailer hace el upgrade solo)
    auth: {
      user: config.usuario,
      pass: config.password,
    },
    // Sin esto, nodemailer usa sus tiempos de espera por defecto (varios
    // minutos en total entre los tres) — si el host SMTP configurado no
    // responde (credenciales viejas, el proveedor bloqueó la IP, un
    // problema de red), un envío se queda colgado mucho más tiempo del
    // razonable antes de fallar. Con límites más cortos, el error llega
    // rápido — importante sobre todo porque el reporte automático (ver
    // utils/reportes.js) puede disparar un envío en segundo plano justo
    // al arrancar el backend, y no debe demorar la disponibilidad del
    // resto de la app si el correo está fallando.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

// Sustituye variables tipo {folio} / {rfc} dentro de una plantilla de
// asunto/cuerpo por su valor real. Si una variable no viene en `valores`,
// se deja el marcador tal cual (mejor eso que borrar contenido a medias).
function aplicarPlantilla(texto, valores) {
  if (typeof texto !== 'string') return '';
  return texto.replace(/\{(\w+)\}/g, (coincidencia, clave) => {
    return Object.prototype.hasOwnProperty.call(valores, clave) ? String(valores[clave]) : coincidencia;
  });
}

// Envía un correo usando la configuración SMTP guardada. Lanza un error
// con un mensaje claro si no hay configuración completa o si el envío
// falla (credenciales incorrectas, host inalcanzable, etc.) — el llamador
// decide cómo mostrarlo.
// `html` es opcional: la mayoría de los correos de esta app son de solo
// texto plano. Cuando sí se manda, se incluye JUNTO con `cuerpo` (texto
// plano) — nunca solo HTML — porque algunos clientes de correo no
// renderizan HTML (o el usuario los tiene desactivados), y tener siempre
// una versión de texto plano de respaldo es una práctica estándar tanto
// de accesibilidad como de entregabilidad (evita que el correo se
// marque como spam por no tener parte de texto).
async function enviarCorreo({ destinatario, asunto, cuerpo, html, adjuntos }) {
  const config = await getConfigSmtp();
  if (!config || !config.host || !config.usuario || !config.password) {
    throw new Error(
      'El correo SMTP no está configurado todavía. Configúralo en el panel de administración antes de enviar correos.'
    );
  }

  const transportador = crearTransportador(config);
  const nombreRemitente = config.nombre_remitente || '';
  const correoRemitente = config.correo_remitente || config.usuario;
  const from = nombreRemitente ? `"${nombreRemitente}" <${correoRemitente}>` : correoRemitente;

  try {
    await transportador.sendMail({
      from,
      to: destinatario,
      subject: asunto,
      text: cuerpo,
      ...(html ? { html } : {}),
      // "adjuntos" sigue el mismo formato que ya usa nodemailer
      // (`attachments`) — un arreglo de { filename, content, contentType }
      // — se pasa tal cual, sin transformarlo, para no reinventar ese
      // formato. Se usa para el reporte en Markdown (ver utils/reportes.js).
      ...(adjuntos && adjuntos.length ? { attachments: adjuntos } : {}),
    });
  } catch (err) {
    // Traduce los errores mas comunes de nodemailer/Gmail a mensajes
    // entendibles, en vez de dejar pasar el mensaje tecnico crudo.
    if (err.code === 'EAUTH') {
      throw new Error(
        'El servidor SMTP rechazó las credenciales. Si usas Gmail, verifica que estés usando una "Contraseña de aplicación" (no la contraseña normal de la cuenta) — se genera en la configuración de seguridad de Google con la verificación en dos pasos activada.'
      );
    }
    if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'ESOCKET') {
      throw new Error(
        `No se pudo conectar con "${config.host}:${config.puerto}". Verifica el host, el puerto y que el servidor tenga salida a internet.`
      );
    }
    throw new Error(err.message || 'No se pudo enviar el correo.');
  }
}

module.exports = { getConfigSmtp, setConfigSmtp, configSmtpParaMostrar, enviarCorreo, aplicarPlantilla, DEFAULTS_SMTP };
