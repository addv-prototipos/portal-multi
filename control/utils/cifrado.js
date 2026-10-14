// Cifrado reversible compartido dentro de control/ (extraído de
// accesoMinio.js al agregar "Accesos — SMTP", punto en curso — código
// pequeño se duplica entre backend/control por convención del proyecto,
// pero DENTRO del mismo servicio no: duplicar lógica de cifrado es
// justo el tipo de cosa que no debe divergir por accidente entre 2
// copias). AES-256-GCM con una clave de 32 bytes que vive SOLO en el
// .env del servidor (CONTROL_VAULT_KEY, nunca en la BD).
//
// Primer cifrado REVERSIBLE del repo (todo lo demás son hashes de
// contraseña de login, irreversibles a propósito vía crypto.scrypt — ver
// backend/utils/auth.js) — ver control/utils/accesoMinio.js para el caso
// de uso original.

const crypto = require('crypto');

const ALGORITMO = 'aes-256-gcm';

class ErrorCifrado extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorCifrado';
    this.codigo = codigo; // 'config'
  }
}

function obtenerClaveCifrado() {
  const hex = process.env.CONTROL_VAULT_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new ErrorCifrado(
      'CONTROL_VAULT_KEY no está configurada (debe ser una clave hexadecimal de 64 caracteres / 32 bytes en el .env del servidor).',
      'config'
    );
  }
  return Buffer.from(hex, 'hex');
}

// Formato guardado: "iv:tag:cifrado", los 3 en hex, separados por ':'.
function cifrar(textoPlano) {
  if (!textoPlano) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, obtenerClaveCifrado(), iv);
  const cifrado = Buffer.concat([cipher.update(String(textoPlano), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), cifrado.toString('hex')].join(':');
}

// Dos fallos muy distintos, tratados distinto a propósito:
// 1. CONTROL_VAULT_KEY faltante/mal formada — error de CONFIGURACIÓN,
//    propaga ErrorCifrado('config') sin atraparlo (mismo criterio que
//    cifrar() — nunca esconder que el sistema no está listo para
//    descifrar nada). Nunca se llega a evaluar si no hay nada guardado
//    todavía (valorCifrado vacío corta antes, sin necesitar la clave).
// 2. Formato corrupto / auth tag no coincide (ej. se rotó
//    CONTROL_VAULT_KEY sin re-guardar el valor) — recuperable, no debe
//    tumbar el resto del registro: devuelve null, el llamador decide
//    cómo mostrarlo.
function descifrar(valorCifrado) {
  if (!valorCifrado) return '';
  const partes = String(valorCifrado).split(':');
  if (partes.length !== 3) return null;
  const [ivHex, tagHex, dataHex] = partes;
  const clave = obtenerClaveCifrado(); // nunca dentro del try: no se atrapa a propósito
  try {
    const decipher = crypto.createDecipheriv(ALGORITMO, clave, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const textoPlano = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return textoPlano.toString('utf8');
  } catch (err) {
    return null;
  }
}

module.exports = { ErrorCifrado, cifrar, descifrar };
