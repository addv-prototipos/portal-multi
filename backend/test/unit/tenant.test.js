const { validarSlug, nombreDbTenant, SLUGS_RESERVADOS } = require('../../utils/tenant');

describe('utils/tenant.js', () => {
  describe('validarSlug', () => {
    test('acepta un slug válido simple', () => {
      expect(validarSlug('cliente1')).toBeNull();
    });

    test('acepta guiones internos', () => {
      expect(validarSlug('empresa-uno')).toBeNull();
    });

    test('rechaza mayúsculas', () => {
      expect(validarSlug('Cliente1')).not.toBeNull();
    });

    test('rechaza guion al inicio', () => {
      expect(validarSlug('-cliente1')).not.toBeNull();
    });

    test('rechaza guion al final', () => {
      expect(validarSlug('cliente1-')).not.toBeNull();
    });

    test('rechaza caracteres no permitidos', () => {
      expect(validarSlug('cliente_1')).not.toBeNull();
      expect(validarSlug('cliente uno')).not.toBeNull();
      expect(validarSlug('cliente.uno')).not.toBeNull();
    });

    test('rechaza cadena vacía', () => {
      expect(validarSlug('')).not.toBeNull();
    });

    test('rechaza valores no-string', () => {
      expect(validarSlug(null)).not.toBeNull();
      expect(validarSlug(undefined)).not.toBeNull();
      expect(validarSlug(123)).not.toBeNull();
    });

    test('rechaza slugs más largos de 50 caracteres', () => {
      const largo = 'a'.repeat(51);
      expect(validarSlug(largo)).not.toBeNull();
    });

    test('acepta exactamente 50 caracteres', () => {
      const limite = 'a' + 'b'.repeat(48) + 'c';
      expect(limite).toHaveLength(50);
      expect(validarSlug(limite)).toBeNull();
    });

    test.each([...SLUGS_RESERVADOS])('rechaza el slug reservado "%s"', (reservado) => {
      expect(validarSlug(reservado)).not.toBeNull();
    });
  });

  describe('nombreDbTenant', () => {
    test('antepone el prefijo tenant_', () => {
      expect(nombreDbTenant('cliente1')).toBe('tenant_cliente1');
    });
  });
});
