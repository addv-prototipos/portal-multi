jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
}));

const {
  CATEGORIAS_SEED,
  ETIQUETAS_SEED,
  SLUG_CATEGORIA_PROTEGIDA,
  generarSlugCategoria,
} = require('../../utils/gastos');

describe('utils/gastos (módulo Gastos)', () => {
  describe('semilla de categorías', () => {
    test('la semilla no está vacía y contiene solo slugs seguros', () => {
      expect(CATEGORIAS_SEED.length).toBeGreaterThan(0);
      CATEGORIAS_SEED.forEach((slug) => {
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^[a-z]+$/);
      });
    });

    test('todas las categorías de la semilla tienen etiqueta en español', () => {
      CATEGORIAS_SEED.forEach((slug) => {
        expect(typeof ETIQUETAS_SEED[slug]).toBe('string');
        expect(ETIQUETAS_SEED[slug].length).toBeGreaterThan(0);
      });
    });

    test('"otro" es la categoría protegida (respaldo del sistema)', () => {
      expect(SLUG_CATEGORIA_PROTEGIDA).toBe('otro');
      expect(CATEGORIAS_SEED).toContain(SLUG_CATEGORIA_PROTEGIDA);
    });
  });

  describe('generarSlugCategoria', () => {
    test('normaliza acentos, espacios y mayúsculas', () => {
      expect(generarSlugCategoria('Papelería y oficina')).toBe('papeleria_y_oficina');
      expect(generarSlugCategoria('  Café  ')).toBe('cafe');
    });

    test('quita caracteres especiales, dejando solo [a-z0-9_]', () => {
      expect(generarSlugCategoria('Mantenimiento / Reparaciones!!')).toBe('mantenimiento_reparaciones');
      expect(generarSlugCategoria('¿Qué es esto?')).toBe('que_es_esto');
    });

    test('recorta a 50 caracteres', () => {
      const larga = 'a'.repeat(80);
      expect(generarSlugCategoria(larga).length).toBeLessThanOrEqual(50);
    });

    test('nunca regresa un slug vacío, ni con entrada vacía o solo símbolos', () => {
      expect(generarSlugCategoria('')).toBe('categoria');
      expect(generarSlugCategoria('!!!')).toBe('categoria');
      expect(generarSlugCategoria(null)).toBe('categoria');
    });
  });
});
