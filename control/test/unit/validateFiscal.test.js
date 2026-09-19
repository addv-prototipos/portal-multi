const { isValidEmail } = require('../../utils/validateFiscal');

describe('utils/validateFiscal.js', () => {
  describe('isValidEmail', () => {
    test('acepta un correo bien formado', () => {
      expect(isValidEmail('contacto@empresa.mx')).toBe(true);
    });

    test('rechaza formatos inválidos', () => {
      expect(isValidEmail('no-es-correo')).toBe(false);
      expect(isValidEmail('falta-arroba.com')).toBe(false);
      expect(isValidEmail('doble@@arroba.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    test('rechaza valores que no son string', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail(123)).toBe(false);
      expect(isValidEmail({})).toBe(false);
    });
  });
});
