const { SLUG_REGEX, SLUGS_RESERVADOS, PREFIJO_DB_TENANT, validarSlug, nombreDbTenant } = require('../../utils/tenant');

describe('utils/tenant.js', () => {
  describe('validarSlug', () => {
    test('acepta slugs minúsculas/números/guiones bien formados', () => {
      expect(validarSlug('cliente1')).toBeNull();
      expect(validarSlug('mi-empresa-2')).toBeNull();
      expect(validarSlug('a')).toBeNull();
    });

    test('rechaza valores que no son string', () => {
      expect(validarSlug(null)).toMatch(/minúsculas/);
      expect(validarSlug(123)).toMatch(/minúsculas/);
      expect(validarSlug(undefined)).toMatch(/minúsculas/);
    });

    test('rechaza mayúsculas, espacios y caracteres especiales', () => {
      expect(validarSlug('Cliente1')).toMatch(/minúsculas/);
      expect(validarSlug('mi empresa')).toMatch(/minúsculas/);
      expect(validarSlug('cliente_1')).toMatch(/minúsculas/);
      expect(validarSlug('cliente@1')).toMatch(/minúsculas/);
    });

    test('rechaza slug que empieza o termina en guion', () => {
      expect(validarSlug('-cliente')).toMatch(/minúsculas/);
      expect(validarSlug('cliente-')).toMatch(/minúsculas/);
    });

    test('rechaza slug vacío o mayor a 50 caracteres', () => {
      expect(validarSlug('')).toMatch(/minúsculas/);
      expect(validarSlug('a'.repeat(51))).toMatch(/minúsculas/);
      expect(validarSlug('a'.repeat(50))).toBeNull(); // límite exacto, válido
    });

    test('rechaza cualquier slug reservado que sí tenga forma de slug válido', () => {
      // "favicon.ico"/"robots.txt" nunca llegan a esta rama: el punto ya
      // los rechaza antes por SLUG_REGEX (ver hallazgo de auditoría:
      // esas 2 entradas de SLUGS_RESERVADOS son inalcanzables tal cual,
      // el regex ya las bloquea de todos modos).
      for (const reservado of SLUGS_RESERVADOS) {
        if (!SLUG_REGEX.test(reservado)) continue;
        expect(validarSlug(reservado)).toMatch(/ruta reservada/);
      }
    });

    test('"favicon.ico"/"robots.txt" quedan bloqueados igual, vía SLUG_REGEX (no vía la lista reservada)', () => {
      expect(SLUG_REGEX.test('favicon.ico')).toBe(false);
      expect(SLUG_REGEX.test('robots.txt')).toBe(false);
      expect(validarSlug('favicon.ico')).toMatch(/minúsculas/);
      expect(validarSlug('robots.txt')).toMatch(/minúsculas/);
    });
  });

  describe('nombreDbTenant', () => {
    test('antepone el prefijo de BD de tenant al slug', () => {
      expect(nombreDbTenant('cliente1')).toBe(`${PREFIJO_DB_TENANT}cliente1`);
      expect(nombreDbTenant('cliente1')).toBe('tenant_cliente1');
    });
  });

  describe('SLUG_REGEX', () => {
    test('coincide exactamente con lo que valida validarSlug', () => {
      expect(SLUG_REGEX.test('cliente-1')).toBe(true);
      expect(SLUG_REGEX.test('Cliente-1')).toBe(false);
    });
  });
});
