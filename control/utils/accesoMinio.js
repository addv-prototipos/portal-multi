// "Accesos — MinIO" (punto en curso, propuesta confirmada por el usuario):
// bloc de notas editable con la URL/usuario/password de MinIO, cifrado en
// reposo, para que un operador de /control no tenga que ir a buscar el
// .env cada vez. A propósito NO es un vault vivo: editar aquí nunca rota
// la contraseña real de MinIO (el usuario root se fija al arrancar el
// contenedor vía MINIO_ROOT_USER/MINIO_ROOT_PASSWORD, no se puede cambiar
// por API) ni backend/ lee de aquí para autenticarse — ese seguirá usando
// su propio .env, sin ninguna dependencia nueva hacia control/. Este
// archivo es puramente informativo/de referencia para el operador.
//
// Reusa la tabla genérica `ajustes_globales` (punto 370, ver
// control/utils/ajustesGlobales.js) — 4 claves nuevas, cero tabla nueva.
//
// El cifrado en sí (AES-256-GCM, clave CONTROL_VAULT_KEY) vive en
// control/utils/cifrado.js — compartido con accesoSmtp.js (punto en
// curso), nunca duplicado dentro de control/.

const { obtenerPool } = require('../db');
const { cifrar, descifrar } = require('./cifrado');

const CLAVE_URL = 'minio_url';
const CLAVE_USUARIO = 'minio_usuario';
const CLAVE_PASSWORD = 'minio_password_cifrado';
const CLAVE_NOTAS = 'minio_notas';
const LONGITUD_MAXIMA_TEXTO = 2000;

class ErrorAccesoMinio extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorAccesoMinio';
    this.codigo = codigo; // 'validacion' | 'config'
  }
}

async function getAccesoMinio(db = obtenerPool()) {
  const [filas] = await db.query('SELECT clave, valor FROM ajustes_globales WHERE clave IN (?, ?, ?, ?)', [
    CLAVE_URL,
    CLAVE_USUARIO,
    CLAVE_PASSWORD,
    CLAVE_NOTAS,
  ]);
  const mapa = {};
  for (const fila of filas) mapa[fila.clave] = fila.valor;

  return {
    url: mapa[CLAVE_URL] || '',
    usuario: mapa[CLAVE_USUARIO] || '',
    password: descifrar(mapa[CLAVE_PASSWORD]),
    notas: mapa[CLAVE_NOTAS] || '',
  };
}

function validarTexto(valor, campo) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (texto.length > LONGITUD_MAXIMA_TEXTO) {
    throw new ErrorAccesoMinio(`${campo} no puede superar ${LONGITUD_MAXIMA_TEXTO} caracteres.`, 'validacion');
  }
  return texto.trim();
}

function validarUrl(valor) {
  const texto = validarTexto(valor, 'La URL');
  if (texto && !/^https?:\/\//i.test(texto)) {
    throw new ErrorAccesoMinio('La URL debe empezar con http:// o https://.', 'validacion');
  }
  return texto;
}

async function setAccesoMinio({ url, usuario, password, notas } = {}, db = obtenerPool()) {
  const urlLimpia = validarUrl(url);
  const usuarioLimpio = validarTexto(usuario, 'El usuario');
  const notasLimpias = validarTexto(notas, 'Las notas');
  // password === undefined (campo ni se mandó) conserva lo ya guardado;
  // password === '' (el operador lo borró a propósito) sí lo limpia —
  // misma distinción que el resto del proyecto usa para "no tocar" vs
  // "vaciar a propósito".
  const tocaPassword = password !== undefined;
  if (tocaPassword && String(password).length > LONGITUD_MAXIMA_TEXTO) {
    throw new ErrorAccesoMinio(`La contraseña no puede superar ${LONGITUD_MAXIMA_TEXTO} caracteres.`, 'validacion');
  }

  const filas = [
    [CLAVE_URL, urlLimpia],
    [CLAVE_USUARIO, usuarioLimpio],
    [CLAVE_NOTAS, notasLimpias],
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

  return getAccesoMinio(db);
}

module.exports = { ErrorAccesoMinio, getAccesoMinio, setAccesoMinio };
