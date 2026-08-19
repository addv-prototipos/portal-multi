const {
  CATEGORIAS_GASTOS,
  ETIQUETAS_CATEGORIAS,
  CLAVE_CHECK_CATEGORIA_GASTOS,
  categoriaValida,
  clausulaCheckCategoria,
} = require('../../utils/gastos');

describe('utils/gastos (módulo Gastos)', () => {
  test('la lista de categorías no está vacía y contiene solo strings seguros', () => {
    expect(CATEGORIAS_GASTOS.length).toBeGreaterThan(0);
    CATEGORIAS_GASTOS.forEach((slug) => {
      expect(typeof slug).toBe('string');
      expect(slug).toMatch(/^[a-z]+$/); // slugs solo minúsculas, sin caracteres especiales
    });
  });

  test('todas las categorías tienen etiqueta en español', () => {
    CATEGORIAS_GASTOS.forEach((slug) => {
      expect(typeof ETIQUETAS_CATEGORIAS[slug]).toBe('string');
      expect(ETIQUETAS_CATEGORIAS[slug].length).toBeGreaterThan(0);
    });
  });

  test('la clave del CHECK es la esperada', () => {
    expect(CLAVE_CHECK_CATEGORIA_GASTOS).toBe('chk_gastos_categoria');
  });

  test('categoriaValida acepta solo slugs de la lista cerrada', () => {
    expect(categoriaValida('renta')).toBe(true);
    expect(categoriaValida('nomina')).toBe(true);
    expect(categoriaValida('otro')).toBe(true);
    expect(categoriaValida('categoria-hackeada')).toBe(false);
    expect(categoriaValida('RENTA')).toBe(false);
    expect(categoriaValida('')).toBe(false);
    expect(categoriaValida(null)).toBe(false);
    expect(categoriaValida(42)).toBe(false);
  });

  test('clausulaCheckCategoria genera el IN con TODAS las categorías', () => {
    const clausula = clausulaCheckCategoria();
    expect(clausula.startsWith('categoria IN (')).toBe(true);
    expect(clausula.endsWith(')')).toBe(true);
    // Todas las categorías, escapadas como strings, aparecen exactamente una vez.
    CATEGORIAS_GASTOS.forEach((slug) => {
      expect(clausula.match(new RegExp(`'${slug}'`, 'g'))).toHaveLength(1);
    });
  });
});