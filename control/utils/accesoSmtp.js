// "Accesos — SMTP" (punto en curso, pedido explícito del usuario): copia
// del SMTP del SITIO BASE (sin tenant, backend/utils/email.js vía
// configuracion_global) para que control/ pueda mandar sus propios
// correos (el de bienvenida del onboarding, cuando se construya) sin
// depender de que backend/ esté arriba en ese momento. A propósito es
// una COPIA, no una migración — backend/ sigue usando su propia
// configuración de `configuracion_global` tal cual para todo lo que ya
// manda (factura lista, recuperación de contraseña, aviso al contador,
// etc.); borrarla de ahí rompería esas funciones ya en producción.
//
// Mismo patrón que accesoMinio.js: reusa `ajustes_globales`, password
// cifrado con AES-256-GCM (ver control/utils/cifrado.js), cero tabla
// nueva.
//
// La contraseña real NUNCA se pudo leer de vuelta desde backend (ver
// backend/utils/email.js:configSmtpParaMostrar — la quita a propósito de
// cualquier respuesta) — así que la copia inicial de host/puerto/
// seguridad/usuario/remitente se hizo a mano una sola vez con los
// valores que SÍ expone esa ruta; la contraseña la tiene que volver a
// capturar un operador aquí, una sola vez.

const { obtenerPool } = require('../db');
const { cifrar, descifrar } = require('./cifrado');

const CLAVE_HOST = 'smtp_host';
const CLAVE_PUERTO = 'smtp_puerto';
const CLAVE_SEGURIDAD = 'smtp_seguridad';
const CLAVE_USUARIO = 'smtp_usuario';
const CLAVE_PASSWORD = 'smtp_password_cifrado';
const CLAVE_NOMBRE_REMITENTE = 'smtp_nombre_remitente';
const CLAVE_CORREO_REMITENTE = 'smtp_correo_remitente';

const TODAS_LAS_CLAVES = [
  CLAVE_HOST,
  CLAVE_PUERTO,
  CLAVE_SEGURIDAD,
  CLAVE_USUARIO,
  CLAVE_PASSWORD,
  CLAVE_NOMBRE_REMITENTE,
  CLAVE_CORREO_REMITENTE,
];

const SEGURIDAD_VALIDA = ['starttls', 'ssl'];
const LONGITUD_MAXIMA_TEXTO = 255;
const PUERTO_MIN = 1;
const PUERTO_MAX = 65535;

class ErrorAccesoSmtp extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorAccesoSmtp';
    this.codigo = codigo; // 'validacion' | 'config'
  }
}

function validarTexto(valor, campo, { obligatorio = false } = {}) {
  const texto = valor === null || valor === undefined ? '' : String(valor).trim();
  if (obligatorio && !texto) {
    throw new ErrorAccesoSmtp(`${campo} es obligatorio.`, 'validacion');
  }
  if (texto.length > LONGITUD_MAXIMA_TEXTO) {
    throw new ErrorAccesoSmtp(`${campo} no puede superar ${LONGITUD_MAXIMA_TEXTO} caracteres.`, 'validacion');
  }
  return texto;
}

function validarCorreo(valor, campo, { obligatorio = false } = {}) {
  const texto = validarTexto(valor, campo, { obligatorio });
  if (texto && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) {
    throw new ErrorAccesoSmtp(`${campo} debe ser un correo válido.`, 'validacion');
  }
  return texto;
}

async function getAccesoSmtp(db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT clave, valor FROM ajustes_globales WHERE clave IN (${TODAS_LAS_CLAVES.map(() => '?').join(',')})`,
    TODAS_LAS_CLAVES
  );
  const mapa = {};
  for (const fila of filas) mapa[fila.clave] = fila.valor;

  return {
    host: mapa[CLAVE_HOST] || '',
    puerto: mapa[CLAVE_PUERTO] ? Number(mapa[CLAVE_PUERTO]) : null,
    seguridad: mapa[CLAVE_SEGURIDAD] || '',
    usuario: mapa[CLAVE_USUARIO] || '',
    password: descifrar(mapa[CLAVE_PASSWORD]),
    nombreRemitente: mapa[CLAVE_NOMBRE_REMITENTE] || '',
    correoRemitente: mapa[CLAVE_CORREO_REMITENTE] || '',
  };
}

async function setAccesoSmtp(
  { host, puerto, seguridad, usuario, password, nombreRemitente, correoRemitente } = {},
  db = obtenerPool()
) {
  const hostLimpio = validarTexto(host, 'El host SMTP');
  const usuarioLimpio = validarCorreo(usuario, 'El usuario SMTP');
  const nombreRemitenteLimpio = validarTexto(nombreRemitente, 'El nombre del remitente');
  const correoRemitenteLimpio = validarCorreo(correoRemitente, 'El correo del remitente');

  let puertoLimpio = null;
  if (puerto !== null && puerto !== undefined && puerto !== '') {
    const n = Number(puerto);
    if (!Number.isInteger(n) || n < PUERTO_MIN || n > PUERTO_MAX) {
      throw new ErrorAccesoSmtp(`El puerto debe ser un entero entre ${PUERTO_MIN} y ${PUERTO_MAX}.`, 'validacion');
    }
    puertoLimpio = n;
  }

  let seguridadLimpia = '';
  if (seguridad !== null && seguridad !== undefined && seguridad !== '') {
    if (!SEGURIDAD_VALIDA.includes(seguridad)) {
      throw new ErrorAccesoSmtp(`La seguridad debe ser una de: ${SEGURIDAD_VALIDA.join(', ')}.`, 'validacion');
    }
    seguridadLimpia = seguridad;
  }

  // Mismo criterio que accesoMinio.js: password === undefined conserva
  // lo ya guardado, password === '' lo limpia a propósito.
  const tocaPassword = password !== undefined;
  if (tocaPassword && String(password).length > LONGITUD_MAXIMA_TEXTO) {
    throw new ErrorAccesoSmtp(`La contraseña no puede superar ${LONGITUD_MAXIMA_TEXTO} caracteres.`, 'validacion');
  }

  const filas = [
    [CLAVE_HOST, hostLimpio],
    [CLAVE_PUERTO, puertoLimpio === null ? '' : String(puertoLimpio)],
    [CLAVE_SEGURIDAD, seguridadLimpia],
    [CLAVE_USUARIO, usuarioLimpio],
    [CLAVE_NOMBRE_REMITENTE, nombreRemitenteLimpio],
    [CLAVE_CORREO_REMITENTE, correoRemitenteLimpio],
  ];
  if (tocaPassword) {
    filas.push([CLAVE_PASSWORD, cifrar(password)]);
  }

  for (const [clave, valor] of filas) {
    await db.query(
      `INSERT INTO ajustes_globales (clave, valor) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [clave, valor]
    );
  }

  return getAccesoSmtp(db);
}

module.exports = { ErrorAccesoSmtp, getAccesoSmtp, setAccesoSmtp };
