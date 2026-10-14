// Pruebas de utils/cifrado.js — cifrado reversible compartido dentro de
// control/ (AES-256-GCM, clave CONTROL_VAULT_KEY). Extraído de
// accesoMinio.test.js al agregar accesoSmtp.js (punto en curso), mismo
// cuerpo de pruebas, ahora dueño de su propio archivo.

const { ErrorCifrado, cifrar, descifrar } = require('../../utils/cifrado');

const CLAVE_VALIDA = 'a'.repeat(64); // 32 bytes en hex

describe('utils/cifrado.js', () => {
  const envOriginal = process.env.CONTROL_VAULT_KEY;

  afterEach(() => {
    process.env.CONTROL_VAULT_KEY = envOriginal;
  });

  test('roundtrip: lo que se cifra se descifra igual', () => {
    process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
    const cifrado = cifrar('SuperSecreta123!');
    expect(cifrado).not.toBe('SuperSecreta123!');
    expect(cifrado.split(':')).toHaveLength(3);
    expect(descifrar(cifrado)).toBe('SuperSecreta123!');
  });

  test('cada cifrado usa un IV distinto (mismo texto, salida distinta)', () => {
    process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
    const a = cifrar('misma-clave');
    const b = cifrar('misma-clave');
    expect(a).not.toBe(b);
    expect(descifrar(a)).toBe('misma-clave');
    expect(descifrar(b)).toBe('misma-clave');
  });

  test('texto vacío/null nunca requiere la clave configurada', () => {
    delete process.env.CONTROL_VAULT_KEY;
    expect(cifrar('')).toBe('');
    expect(cifrar(null)).toBe('');
    expect(descifrar('')).toBe('');
    expect(descifrar(null)).toBe('');
  });

  test('cifrar sin CONTROL_VAULT_KEY configurada lanza ErrorCifrado "config"', () => {
    delete process.env.CONTROL_VAULT_KEY;
    expect(() => cifrar('algo')).toThrow(ErrorCifrado);
    try {
      cifrar('algo');
    } catch (err) {
      expect(err.codigo).toBe('config');
    }
  });

  test('CONTROL_VAULT_KEY con longitud inválida (no 64 hex) también falla como "config"', () => {
    process.env.CONTROL_VAULT_KEY = 'muy-corta';
    expect(() => cifrar('algo')).toThrow(ErrorCifrado);
  });

  test('descifrar un valor con formato corrupto (no 3 partes) devuelve null sin tronar', () => {
    process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
    expect(descifrar('no-tiene-el-formato-esperado')).toBeNull();
  });

  test('descifrar con la clave rotada (ya no coincide el auth tag) devuelve null, no truena', () => {
    process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
    const cifrado = cifrar('valor-original');
    process.env.CONTROL_VAULT_KEY = 'b'.repeat(64); // clave distinta
    expect(descifrar(cifrado)).toBeNull();
  });

  test('descifrar un valor YA guardado sin CONTROL_VAULT_KEY configurada propaga "config" (no lo esconde)', () => {
    process.env.CONTROL_VAULT_KEY = CLAVE_VALIDA;
    const cifrado = cifrar('algo-real');
    delete process.env.CONTROL_VAULT_KEY;
    expect(() => descifrar(cifrado)).toThrow(ErrorCifrado);
  });
});
