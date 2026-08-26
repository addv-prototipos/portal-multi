const {
  CAMPOS_IMPORTABLES,
  CONCEPTOS_AYUDA,
  obtenerDiccionarioInventario,
} = require('../../utils/inventarioCampos');

describe('CAMPOS_IMPORTABLES — metadatos de ayuda (§56.1)', () => {
  test('cada campo trae etiqueta/explicacion_simple/ejemplo_valido/ejemplo_invalido_comun no vacíos', () => {
    CAMPOS_IMPORTABLES.forEach((c) => {
      expect(typeof c.etiqueta).toBe('string');
      expect(c.etiqueta.length).toBeGreaterThan(0);
      expect(typeof c.explicacion_simple).toBe('string');
      expect(c.explicacion_simple.length).toBeGreaterThan(10);
      expect(typeof c.ejemplo_valido).toBe('string');
      expect(c.ejemplo_valido.length).toBeGreaterThan(0);
      expect(typeof c.ejemplo_invalido_comun).toBe('string');
      expect(c.ejemplo_invalido_comun.length).toBeGreaterThan(10);
    });
  });
});

describe('CONCEPTOS_AYUDA — conceptos operativos (§56.3 grupos 2 y 3)', () => {
  test('cada concepto trae id único, grupo válido y los mismos 3 campos de ayuda', () => {
    const gruposValidos = ['existencias', 'importacion', 'moneda_extranjera'];
    const idsVistos = new Set();
    CONCEPTOS_AYUDA.forEach((c) => {
      expect(idsVistos.has(c.id)).toBe(false);
      idsVistos.add(c.id);
      expect(gruposValidos).toContain(c.grupo);
      expect(c.explicacion_simple.length).toBeGreaterThan(10);
      expect(c.ejemplo_valido.length).toBeGreaterThan(0);
      expect(c.ejemplo_invalido_comun.length).toBeGreaterThan(10);
    });
  });
});

describe('obtenerDiccionarioInventario() (§56.6 criterios de aceptación)', () => {
  const diccionario = obtenerDiccionarioInventario();

  test('todo campo mapeable del wizard tiene su tarjeta correspondiente — misma fuente, no a mano', () => {
    const idsDiccionario = new Set(diccionario.map((d) => d.id));
    CAMPOS_IMPORTABLES.forEach((c) => {
      expect(idsDiccionario.has(c.campo)).toBe(true);
    });
  });

  test('todo concepto operativo también aparece en el diccionario combinado', () => {
    const idsDiccionario = new Set(diccionario.map((d) => d.id));
    CONCEPTOS_AYUDA.forEach((c) => {
      expect(idsDiccionario.has(c.id)).toBe(true);
    });
  });

  test('sin ids duplicados entre campos importables y conceptos', () => {
    const ids = diccionario.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('total = campos importables + conceptos de ayuda', () => {
    expect(diccionario.length).toBe(CAMPOS_IMPORTABLES.length + CONCEPTOS_AYUDA.length);
  });

  test('cada entrada trae grupo, etiqueta y los 3 campos de ayuda', () => {
    diccionario.forEach((d) => {
      expect(d.grupo).toBeTruthy();
      expect(d.etiqueta).toBeTruthy();
      expect(d.explicacion_simple).toBeTruthy();
      expect(d.ejemplo_valido).toBeTruthy();
      expect(d.ejemplo_invalido_comun).toBeTruthy();
    });
  });

  test('los campos del catálogo llevan grupo "catalogo" y conservan obligatorio/sinonimos', () => {
    const skuEnDiccionario = diccionario.find((d) => d.id === 'sku');
    expect(skuEnDiccionario.grupo).toBe('catalogo');
    expect(skuEnDiccionario.obligatorio).toBe(true);
    expect(skuEnDiccionario.sinonimos).toContain('clave');
  });

  test('buscar "costo" encuentra costo, sus sinónimos y costo_promedio (§56.6 ejemplo literal)', () => {
    const termino = 'costo';
    const coincidencias = diccionario.filter(
      (d) =>
        d.id.includes(termino) ||
        d.etiqueta.toLowerCase().includes(termino) ||
        d.sinonimos.some((s) => s.includes(termino))
    );
    const ids = coincidencias.map((c) => c.id);
    expect(ids).toContain('costo');
    expect(ids).toContain('costo_promedio');
  });
});
