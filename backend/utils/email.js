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
  // server.js). Admite las variables {folio}, {rfc} y {marca} (esta
  // última es el nombre de marca del tenant, ver el segmento "marca" —
  // cae al valor por defecto "ADDV" si el tenant no definió la suya), que
  // se sustituyen por su valor real al enviar (ver aplicarPlantilla más
  // abajo). El asunto de ese correo NO es configurable a propósito:
  // siempre es un mensaje fijo de "factura lista" (ver
  // ASUNTO_FACTURA_LISTA en server.js).
  cuerpo_cliente:
    'Tu factura para el ticket con folio {folio} ya está disponible.\n\n' +
    'Ingresa al Portal de Facturación {marca} y descárgala desde tu tablero de solicitudes.',
  // Punto 214: mismo mecanismo que cuerpo_cliente, extendido a los otros 4
  // correos que comparten el cascarón de marca (construirCorreoBase) —
  // aclaraciones queda FUERA a propósito (es el mensaje que escribe el
  // CLIENTE, no hay plantilla del admin que personalizar ahí). Los
  // asuntos de estos correos siguen sin ser configurables, mismo criterio
  // que cuerpo_cliente.
  cuerpo_invitacion: 'Ingresa con estos datos y cambia tu contraseña en cuanto puedas.',
  cuerpo_recuperacion:
    'Recibimos una solicitud para restablecer tu contraseña en Portal Clarvo tu negocio en orden. ' +
    'Si no fuiste tú, ignora este correo — tu contraseña actual sigue funcionando.',
  cuerpo_aviso_contador: 'Revísalo y genera la factura correspondiente desde el panel de administración.',
  cuerpo_reporte: 'Se adjunta el reporte generado el {fecha} a las {hora}.',
  // Punto 335: el correo de "confirmación de venta" (construirCorreoOrdenCompra
  // en server.js) tiene su PROPIO diseño de recibo (borde punteado,
  // degradado navy→cyan — no pasa por construirCorreoBase) — a propósito
  // NO se abre a edición ese diseño ni la tabla de datos (folio/fecha/
  // total/etc). Solo estos 2 párrafos de abajo son editables; el segundo
  // es una instrucción FUNCIONAL real (le dice al cliente qué campos
  // capturar para pedir su factura en el portal) — el admin puede
  // reescribirla o borrarla bajo su propio riesgo, mismo nivel de
  // confianza que ya existe para los otros 5 correos de esta lista.
  cuerpo_venta:
    '¡Hola! Te confirmamos que registramos tu venta {numero_venta}. Con estos datos ya puedes solicitar tu factura desde el portal.\n' +
    '**Guarda este correo** — tómale una foto o captura de pantalla — porque, al solicitar tu factura en el portal, te pediremos que captures el No. Venta, Fecha, Hora y Total exactamente como aparecen arriba (cada uno en su propio campo), además de la imagen de tu ticket de venta.',
  // Punto "confGlo": timestamp (ISO) de la última vez que se confirmó que
  // esta configuración SÍ funciona — por un handshake exitoso (verify(),
  // sin enviar correo) o por un envío real exitoso ("Enviar prueba"). Se
  // limpia cada vez que se guarda la sección "Correo electrónico (SMTP)"
  // (ver setConfigSmtp) para no mostrar un check viejo tras cambiar
  // host/usuario/password sin haber vuelto a probar la conexión.
  ultima_verificacion_en: null,
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

  [
    'host', 'usuario', 'nombre_remitente', 'correo_remitente', 'correo_contador',
    'cuerpo_cliente', 'cuerpo_invitacion', 'cuerpo_recuperacion', 'cuerpo_aviso_contador', 'cuerpo_reporte',
    'cuerpo_venta',
  ].forEach((campo) => {
    if (typeof cambios[campo] === 'string') nuevo[campo] = cambios[campo].trim();
  });
  if (Number.isInteger(cambios.puerto)) nuevo.puerto = cambios.puerto;
  if (cambios.seguridad === 'starttls' || cambios.seguridad === 'ssl') nuevo.seguridad = cambios.seguridad;
  if (typeof cambios.password === 'string' && cambios.password.length > 0) {
    nuevo.password = cambios.password;
  }
  // Cualquier guardado de esta sección invalida la última verificación —
  // los datos de conexión pudieron cambiar, hay que volver a probar.
  nuevo.ultima_verificacion_en = null;

  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_SMTP, JSON.stringify(nuevo)]
  );
  return nuevo;
}

// Registra que la configuración SMTP guardada SÍ funciona ahora mismo —
// llamado tras un handshake exitoso (verificarConexionSmtp) o un envío de
// prueba exitoso (ver POST /api/admin/config/smtp/prueba en server.js).
// No pasa por setConfigSmtp a propósito: ese está atado al body saneado
// del PUT público, esto es un campo de solo-servidor.
async function marcarSmtpVerificado() {
  const actual = (await getConfigSmtp()) || { ...DEFAULTS_SMTP };
  const nuevo = { ...actual, ultima_verificacion_en: new Date().toISOString() };
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_SMTP, JSON.stringify(nuevo)]
  );
  return nuevo.ultima_verificacion_en;
}

// Nunca se devuelve la contraseña guardada al frontend — solo si hay una
// configurada o no (para poder mostrar "•••••• (guardada)" en la interfaz
// sin exponer el valor real).
// Textos por defecto de los 6 correos con plantilla editable (punto 214,
// +venta en el punto 335) — expuestos aparte (sin credenciales) para que
// el botón "Restablecer" de cada plantilla en el frontend sepa a qué
// texto volver, sin duplicar estas cadenas en el JS del panel.
const DEFAULTS_PLANTILLAS = {
  cuerpo_cliente: DEFAULTS_SMTP.cuerpo_cliente,
  cuerpo_invitacion: DEFAULTS_SMTP.cuerpo_invitacion,
  cuerpo_recuperacion: DEFAULTS_SMTP.cuerpo_recuperacion,
  cuerpo_aviso_contador: DEFAULTS_SMTP.cuerpo_aviso_contador,
  cuerpo_reporte: DEFAULTS_SMTP.cuerpo_reporte,
  cuerpo_venta: DEFAULTS_SMTP.cuerpo_venta,
};

function configSmtpParaMostrar(config) {
  if (!config) {
    return {
      configurado: false,
      ...DEFAULTS_SMTP,
      password: undefined,
      passwordConfigurada: false,
      defaultsPlantillas: DEFAULTS_PLANTILLAS,
    };
  }
  const { password, ...resto } = config;
  return {
    configurado: Boolean(config.host && config.usuario && config.password),
    ...resto,
    passwordConfigurada: Boolean(password),
    defaultsPlantillas: DEFAULTS_PLANTILLAS,
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
// Traduce los errores mas comunes de nodemailer/Gmail a mensajes
// entendibles, en vez de dejar pasar el mensaje tecnico crudo. Compartido
// entre el envío real (enviarCorreo) y el handshake de solo-verificación
// (verificarConexionSmtp) — mismos códigos de error en ambos casos.
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
    throw traducirErrorSmtp(err, config);
  }
}

// Handshake de solo-verificación (nodemailer .verify(), sin enviar ningún
// correo) contra la configuración YA GUARDADA — nunca contra valores sin
// guardar del formulario, mismo criterio que "Enviar prueba". Si tiene
// éxito, registra el timestamp (marcarSmtpVerificado).
async function verificarConexionSmtp() {
  const config = await getConfigSmtp();
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
  return marcarSmtpVerificado();
}

module.exports = {
  getConfigSmtp,
  setConfigSmtp,
  configSmtpParaMostrar,
  enviarCorreo,
  aplicarPlantilla,
  DEFAULTS_SMTP,
  marcarSmtpVerificado,
  verificarConexionSmtp,
};
