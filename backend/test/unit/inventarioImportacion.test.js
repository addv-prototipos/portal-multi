jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
}));

const { pool } = require('../../db');
const {
  normalizarCabecera,
  similitud,
  sugerirMapeoCompleto,
  firmaCabeceras,
  parsearArchivoCSV,
  parsearNumeroTolerante,
  normalizarTipoProducto,
  normalizarEstadoProducto,
  validarFilasImportacion,
  detectarDatosMezclados,
  generarPlantillaCSV,
  protegerCeldaCSV,
  CLAVES_EXTRA_PROHIBIDAS,
} = require('../../utils/inventarioImportacion');
const { CAMPOS_IMPORTABLES } = require('../../utils/inventarioCampos');

describe('normalizarCabecera', () => {
  test('minúsculas, sin acentos, espacios/guiones a guion bajo', () => {
    expect(normalizarCabecera('Código de Producto')).toBe('codigo_de_producto');
    expect(normalizarCabecera('Descripción-Producto')).toBe('descripcion_producto');
    expect(normalizarCabecera('  SKU  ')).toBe('sku');
  });

  test('caracteres no alfanuméricos se eliminan', () => {
    expect(normalizarCabecera('Precio ($MXN)')).toBe('precio_mxn');
  });
});

describe('similitud (Levenshtein normalizado)', () => {
  test('cadenas idénticas dan 1', () => {
    expect(similitud('sku', 'sku')).toBe(1);
  });

  test('cadenas muy distintas dan un score bajo', () => {
    expect(similitud('sku', 'zzzzzzzzzz')).toBeLessThan(0.3);
  });
});

describe('sugerirMapeoCompleto — mapeo en 3 niveles (§34.3)', () => {
  test('coincidencia exacta gana con confianza "exacto"', () => {
    const { mapeo } = sugerirMapeoCompleto(['sku', 'nombre']);
    expect(mapeo.sku.confianza).toBe('exacto');
    expect(mapeo.nombre.confianza).toBe('exacto');
  });

  test('sinónimo reconocido gana con confianza "reconocido"', () => {
    const { mapeo } = sugerirMapeoCompleto(['clave', 'descripcion']);
    expect(mapeo.sku.confianza).toBe('reconocido');
    expect(mapeo.nombre.confianza).toBe('reconocido');
  });

  test('coincidencia difusa (Levenshtein >=80%) gana con confianza "sugerido"', () => {
    const { mapeo } = sugerirMapeoCompleto(['descripcionn']); // typo de "descripcion" (sinónimo de nombre)
    expect(mapeo.nombre).toBeDefined();
    expect(mapeo.nombre.confianza).toBe('sugerido');
  });

  test('campo obligatorio resuelto SOLO por coincidencia difusa exige confirmación (§34.3.1)', () => {
    const { mapeo } = sugerirMapeoCompleto(['nombree']); // typo de "nombre", obligatorio
    expect(mapeo.nombre.confianza).toBe('sugerido');
    expect(mapeo.nombre.requiereConfirmacion).toBe(true);
  });

  test('campo opcional resuelto por coincidencia difusa NO exige confirmación', () => {
    const { mapeo } = sugerirMapeoCompleto(['marcaa']); // typo de "marca", opcional
    expect(mapeo.marca.confianza).toBe('sugerido');
    expect(mapeo.marca.requiereConfirmacion).toBe(false);
  });

  test('un campo recibe a lo más UNA columna — no se duplica la asignación', () => {
    const { mapeo, columnasSinMapear } = sugerirMapeoCompleto(['sku', 'clave', 'codigo_producto']);
    // "sku" (exacto) se lleva la columna 0; "clave"/"codigo_producto" son
    // sinónimos del MISMO campo (sku), que ya está resuelto — deben quedar
    // sin mapear en vez de pelear por el mismo campo.
    expect(mapeo.sku.columnaIndice).toBe(0);
    const indicesSinMapear = columnasSinMapear.map((c) => c.indice);
    expect(indicesSinMapear).toEqual(expect.arrayContaining([1, 2]));
  });

  test('columnas sin ninguna coincidencia quedan en columnasSinMapear', () => {
    const { columnasSinMapear } = sugerirMapeoCompleto(['sku', 'columna_rara_del_cliente']);
    expect(columnasSinMapear.map((c) => c.original)).toContain('columna_rara_del_cliente');
  });

  test('perfil de mapeo guardado tiene prioridad sobre exacto/sinónimo/difuso', () => {
    // El perfil manda "codigo_raro" -> sku, aunque el archivo TAMBIÉN traiga
    // una columna literal "sku" — el perfil gana (34.3.1 punto 1).
    const { mapeo } = sugerirMapeoCompleto(['sku', 'codigo_raro'], {
      perfilMapeo: { sku: 'codigo_raro' },
    });
    expect(mapeo.sku.columnaIndice).toBe(1);
    expect(mapeo.sku.confianza).toBe('perfil');
  });

  test('cubre los 20 campos importables sin lanzar', () => {
    const cabeceras = CAMPOS_IMPORTABLES.map((c) => c.campo);
    const { mapeo } = sugerirMapeoCompleto(cabeceras);
    CAMPOS_IMPORTABLES.forEach((c) => expect(mapeo[c.campo].confianza).toBe('exacto'));
  });
});

describe('firmaCabeceras (§34.3.2)', () => {
  test('mismas cabeceras en distinto orden producen la MISMA firma', () => {
    const firmaA = firmaCabeceras(['sku', 'nombre', 'precio']);
    const firmaB = firmaCabeceras(['precio', 'sku', 'nombre']);
    expect(firmaA).toBe(firmaB);
  });

  test('cabeceras distintas producen firmas distintas', () => {
    const firmaA = firmaCabeceras(['sku', 'nombre']);
    const firmaB = firmaCabeceras(['sku', 'nombre', 'precio']);
    expect(firmaA).not.toBe(firmaB);
  });
});

describe('parsearArchivoCSV — delimitador y encoding', () => {
  test('autodetecta punto y coma', () => {
    const buffer = Buffer.from('sku;nombre;precio\nA1;Producto uno;10\n', 'utf8');
    const { cabeceras, filas, delimitador } = parsearArchivoCSV(buffer);
    expect(delimitador).toBe(';');
    expect(cabeceras).toEqual(['sku', 'nombre', 'precio']);
    expect(filas).toEqual([['A1', 'Producto uno', '10']]);
  });

  test('autodetecta tabulador', () => {
    const buffer = Buffer.from('sku\tnombre\nA1\tProducto uno\n', 'utf8');
    const { delimitador } = parsearArchivoCSV(buffer);
    expect(delimitador).toBe('\t');
  });

  test('coma por defecto', () => {
    const buffer = Buffer.from('sku,nombre\nA1,Producto uno\n', 'utf8');
    const { delimitador, encoding } = parsearArchivoCSV(buffer);
    expect(delimitador).toBe(',');
    expect(encoding).toBe('utf8');
  });
});

describe('parsearNumeroTolerante (§34.5)', () => {
  test('punto decimal estándar', () => {
    expect(parsearNumeroTolerante('123.45').valor).toBeCloseTo(123.45);
  });

  test('coma como decimal (sin punto) se interpreta como decimal', () => {
    const { valor, nota } = parsearNumeroTolerante('12,5');
    expect(valor).toBeCloseTo(12.5);
    expect(nota).toBeTruthy();
  });

  test('punto de miles + coma decimal (formato latinoamericano)', () => {
    const { valor } = parsearNumeroTolerante('1.234,56');
    expect(valor).toBeCloseTo(1234.56);
  });

  test('coma de miles + punto decimal (formato US)', () => {
    const { valor } = parsearNumeroTolerante('1,234.56');
    expect(valor).toBeCloseTo(1234.56);
  });

  test('vacío da null, no NaN (campo opcional sin dato)', () => {
    expect(parsearNumeroTolerante('').valor).toBeNull();
    expect(parsearNumeroTolerante(null).valor).toBeNull();
  });

  test('texto no numérico da NaN', () => {
    expect(Number.isNaN(parsearNumeroTolerante('abc').valor)).toBe(true);
  });
});

describe('normalizarTipoProducto / normalizarEstadoProducto', () => {
  test('vacío u otro valor cae a "producto"', () => {
    expect(normalizarTipoProducto('')).toBe('producto');
    expect(normalizarTipoProducto('mercancia')).toBe('producto');
  });

  test('"servicio" y variantes caen a "servicio"', () => {
    expect(normalizarTipoProducto('Servicio')).toBe('servicio');
    expect(normalizarTipoProducto('SERVICIO')).toBe('servicio');
  });

  test('estado vacío cae a "activo"; variantes de baja caen a "inactivo"', () => {
    expect(normalizarEstadoProducto('')).toBe('activo');
    expect(normalizarEstadoProducto('0')).toBe('inactivo');
    expect(normalizarEstadoProducto('Inactivo')).toBe('inactivo');
  });
});

describe('validarFilasImportacion (§34.5)', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue([[{ id: 1, nombre: 'Pieza' }]]);
  });

  const cabeceras = ['sku', 'nombre', 'unidad', 'existencia'];
  const mapeoFinal = { sku: 0, nombre: 1, unidad_base: 2, existencia_inicial: 3 };

  test('SKU vacío se reporta como error (modo tolerante, no aborta el resto)', async () => {
    const filas = [['', 'Producto A', 'Pieza', '5'], ['B1', 'Producto B', 'Pieza', '3']];
    const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
    expect(resultado.filasOk).toBe(1);
    expect(resultado.errores.some((e) => e.motivo.includes('SKU vacío'))).toBe(true);
    expect(resultado.abortado).toBe(false);
  });

  test('SKU duplicado dentro del archivo se reporta', async () => {
    const filas = [['A1', 'Producto A', 'Pieza', '1'], ['A1', 'Producto A bis', 'Pieza', '1']];
    const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
    expect(resultado.filasOk).toBe(1);
    expect(resultado.errores.some((e) => e.motivo.includes('duplicado'))).toBe(true);
  });

  test('unidad desconocida se rechaza — nunca se crea implícita', async () => {
    const filas = [['A1', 'Producto A', 'UnidadRara', '1']];
    const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
    expect(resultado.filasOk).toBe(0);
    expect(resultado.errores[0].motivo).toContain('Unidad de medida desconocida');
  });

  test('existencia inicial negativa se rechaza', async () => {
    const filas = [['A1', 'Producto A', 'Pieza', '-5']];
    const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
    expect(resultado.filasOk).toBe(0);
    expect(resultado.errores[0].motivo).toContain('negativa');
  });

  test('modo estricto: un solo error aborta TODO el archivo', async () => {
    const filas = [['', 'Producto A', 'Pieza', '1'], ['B1', 'Producto B', 'Pieza', '1']];
    const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'estricto' });
    expect(resultado.abortado).toBe(true);
    expect(resultado.filasValidas.length).toBe(0);
  });

  test('columna no mapeada válida se conserva en "extra"', async () => {
    const cabecerasConExtra = [...cabeceras, 'campo_del_cliente'];
    const filas = [['A1', 'Producto A', 'Pieza', '1', 'dato migrado']];
    const resultado = await validarFilasImportacion(cabecerasConExtra, filas, { mapeoFinal, modo: 'tolerante', conservarExtra: true });
    expect(resultado.filasValidas[0].extra).toEqual({ campo_del_cliente: 'dato migrado' });
  });

  test('cabecera __proto__/constructor/prototype como extra se rechaza (INV_EXTRA_CLAVE_PROHIBIDA)', async () => {
    expect(CLAVES_EXTRA_PROHIBIDAS.has('__proto__')).toBe(true);
    const cabecerasConExtra = [...cabeceras, '__proto__'];
    const filas = [['A1', 'Producto A', 'Pieza', '1', 'valor_malicioso']];
    const resultado = await validarFilasImportacion(cabecerasConExtra, filas, { mapeoFinal, modo: 'tolerante', conservarExtra: true });
    expect(resultado.filasOk).toBe(0);
    expect(resultado.errores.some((e) => e.motivo.includes('INV_EXTRA_CLAVE_PROHIBIDA'))).toBe(true);
  });

  test('fila válida completa se acumula en filasValidas con tipos correctos', async () => {
    const filas = [['A1', 'Producto A', 'Pieza', '10']];
    const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
    expect(resultado.filasValidas[0]).toMatchObject({ sku: 'A1', nombre: 'Producto A', unidad_id: 1, existencia_inicial: 10, tipo: 'producto', estado: 'activo' });
  });

  // Punto 179: la carga masiva es SOLO para productos — un servicio
  // siempre se da de alta a mano desde "Nuevo producto".
  test('fila con tipo=servicio se rechaza (INV_IMPORT_SERVICIO_NO_PERMITIDO), no aborta el resto en modo tolerante', async () => {
    const cabecerasConTipo = [...cabeceras, 'tipo'];
    const mapeoConTipo = { ...mapeoFinal, tipo: 4 };
    const filas = [
      ['A1', 'Producto A', 'Pieza', '1', 'servicio'],
      ['B1', 'Producto B', 'Pieza', '1', 'producto'],
    ];
    const resultado = await validarFilasImportacion(cabecerasConTipo, filas, { mapeoFinal: mapeoConTipo, modo: 'tolerante' });
    expect(resultado.filasOk).toBe(1);
    expect(resultado.filasValidas[0].sku).toBe('B1');
    expect(resultado.errores.some((e) => e.motivo.includes('INV_IMPORT_SERVICIO_NO_PERMITIDO'))).toBe(true);
  });

  // Punto 397, propuesta 1: "agrupar por valor" — un mismo valor de
  // catálogo sin resolver (ej. "UNIDAD") repetido en miles de filas se
  // reporta como un solo grupo con conteo real, no una fila por error.
  test('erroresAgrupados colapsa errores idénticos (misma columna/valor/motivo) con su conteo real', async () => {
    const filas = [
      ['A1', 'Producto A', 'UNIDAD', '1'],
      ['A2', 'Producto B', 'UNIDAD', '1'],
      ['A3', 'Producto C', 'UNIDAD', '1'],
      ['A4', 'Producto D', 'OtraCosa', '1'],
    ];
    const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
    expect(resultado.filasOk).toBe(0);
    expect(resultado.errores.length).toBe(4);
    expect(resultado.erroresAgrupados.length).toBe(2);
    const grupoUnidad = resultado.erroresAgrupados.find((g) => g.valor === 'UNIDAD');
    expect(grupoUnidad.count).toBe(3);
    expect(grupoUnidad.filasEjemplo).toEqual([2, 3, 4]);
  });

  // Punto 397, propuesta 1: valorOverrides resuelve "UNIDAD" → "Pieza" sin
  // tocar el archivo original — las 3 filas pasan a ser válidas.
  test('valorOverrides resuelve un valor de catálogo desconocido para todas las filas que lo usan', async () => {
    const filas = [
      ['A1', 'Producto A', 'UNIDAD', '1'],
      ['A2', 'Producto B', 'UNIDAD', '1'],
    ];
    const resultado = await validarFilasImportacion(cabeceras, filas, {
      mapeoFinal,
      modo: 'tolerante',
      valorOverrides: { unidad_base: { unidad: 'Pieza' } },
    });
    expect(resultado.filasOk).toBe(2);
    expect(resultado.filasValidas.every((f) => f.unidad_id === 1)).toBe(true);
    expect(resultado.errores.length).toBe(0);
  });

  test('valorOverrides no afecta valores que no coinciden con la clave guardada', async () => {
    const filas = [['A1', 'Producto A', 'UNIDAD', '1']];
    const resultado = await validarFilasImportacion(cabeceras, filas, {
      mapeoFinal,
      modo: 'tolerante',
      valorOverrides: { unidad_base: { otravalor: 'Pieza' } },
    });
    expect(resultado.filasOk).toBe(0);
    expect(resultado.errores[0].motivo).toContain('Unidad de medida desconocida');
  });

  // Punto 397, propuesta 5: checklist de calidad de datos ampliado.
  describe('hallazgosCalidad', () => {
    test('detecta SKU que ya existe en el catálogo (distinto de duplicado dentro del archivo)', async () => {
      pool.query.mockReset();
      pool.query
        .mockResolvedValueOnce([[{ id: 1, nombre: 'Pieza' }]]) // unidades_medida
        .mockResolvedValueOnce([[{ sku: 'A1' }]]); // productos ya existentes
      const filas = [['A1', 'Producto A', 'Pieza', '1']];
      const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
      const hallazgo = resultado.hallazgosCalidad.find((h) => h.tipo === 'duplicado_catalogo');
      expect(hallazgo).toBeDefined();
      expect(hallazgo.count).toBe(1);
      expect(hallazgo.filasEjemplo).toEqual([2]);
    });

    test('no reporta duplicado_catalogo si ningún SKU del archivo existe ya', async () => {
      pool.query.mockReset();
      pool.query
        .mockResolvedValueOnce([[{ id: 1, nombre: 'Pieza' }]])
        .mockResolvedValueOnce([[]]);
      const filas = [['A1', 'Producto A', 'Pieza', '1']];
      const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
      expect(resultado.hallazgosCalidad.some((h) => h.tipo === 'duplicado_catalogo')).toBe(false);
    });

    test('detecta texto con pinta de precio mezclado en una columna de texto libre (ej. "nombre")', async () => {
      pool.query.mockReset();
      pool.query.mockResolvedValue([[{ id: 1, nombre: 'Pieza' }]]);
      const filas = [['A1', 'BRAZO AUXILIAR FORD F150 2005 $519 MAYASA', 'Pieza', '1']];
      const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
      const hallazgo = resultado.hallazgosCalidad.find((h) => h.tipo === 'datos_mezclados');
      expect(hallazgo).toBeDefined();
      expect(hallazgo.count).toBe(1);
      expect(hallazgo.filasEjemplo).toEqual([2]);
    });

    test('precio en $0.00 explícito se reporta como aviso informativo, nunca bloquea la fila', async () => {
      pool.query.mockReset();
      pool.query.mockResolvedValue([[{ id: 1, nombre: 'Pieza' }]]);
      const cabecerasConPrecio = [...cabeceras, 'precio'];
      const mapeoConPrecio = { ...mapeoFinal, precio: 4 };
      const filas = [['A1', 'Producto A', 'Pieza', '1', '0']];
      const resultado = await validarFilasImportacion(cabecerasConPrecio, filas, { mapeoFinal: mapeoConPrecio, modo: 'tolerante' });
      expect(resultado.filasOk).toBe(1);
      const hallazgo = resultado.hallazgosCalidad.find((h) => h.tipo === 'precio_cero');
      expect(hallazgo).toBeDefined();
      expect(hallazgo.severidad).toBe('info');
      expect(hallazgo.count).toBe(1);
    });
  });

  // Punto 398: proveedor + precio pegados al texto, detección real (dato
  // encontrado en producción con el archivo real del usuario: "BRAZO
  // AUXILIAR FORD F150 2005 $519 MAYASA" dentro de "Producto").
  describe('datos mezclados: proveedor + precio (punto 398)', () => {
    test('detectarDatosMezclados: un token junto a $precio en 2+ filas se confirma como proveedor', () => {
      const filasCrudas = [
        ['A1', 'BRAZO AUXILIAR FORD F150 2005 $519 MAYASA', 'Pieza', '1'],
        ['A2', 'BIELETA NISS SENTRA B14 $66 MAYASA', 'Pieza', '1'],
      ];
      const deteccion = detectarDatosMezclados(filasCrudas, mapeoFinal);
      const mezclaNombre = deteccion.get('nombre');
      expect(mezclaNombre.tokensConfirmados.get('MAYASA')).toBe(2);
      expect(mezclaNombre.filasProveedor.size).toBe(2);
      expect(mezclaNombre.filasProveedor.get(0)).toEqual({ token: 'MAYASA', textoLimpio: 'BRAZO AUXILIAR FORD F150 2005' });
    });

    test('detectarDatosMezclados: un token que aparece UNA sola vez junto a $precio NO se confirma (evita falsos positivos)', () => {
      const filasCrudas = [['A1', 'ROTULA RAM 700 IZQ $57 UNICO', 'Pieza', '1']];
      const deteccion = detectarDatosMezclados(filasCrudas, mapeoFinal);
      const mezclaNombre = deteccion.get('nombre');
      expect(mezclaNombre.filasProveedor.size).toBe(0);
      expect(mezclaNombre.filasPrecio.size).toBe(1); // el precio sí se detecta, no depende de confirmar proveedor
    });

    test('detectarDatosMezclados: con el token ya confirmado, también detecta filas SIN precio (ej. "FILTRO GASOLINA VW A4 MAYASA")', () => {
      const filasCrudas = [
        ['A1', 'BRAZO AUXILIAR FORD F150 2005 $519 MAYASA', 'Pieza', '1'],
        ['A2', 'BIELETA NISS SENTRA B14 $66 MAYASA', 'Pieza', '1'],
        ['A3', 'FILTRO GASOLINA VW A4 MAYASA', 'Pieza', '1'],
      ];
      const deteccion = detectarDatosMezclados(filasCrudas, mapeoFinal);
      const mezclaNombre = deteccion.get('nombre');
      expect(mezclaNombre.filasProveedor.size).toBe(3);
      expect(mezclaNombre.filasProveedor.get(2)).toEqual({ token: 'MAYASA', textoLimpio: 'FILTRO GASOLINA VW A4' });
    });

    test('hallazgosCalidad reporta tienePrecio/tieneProveedor y desaparece una vez que el usuario ya decidió qué hacer', async () => {
      pool.query.mockReset();
      pool.query.mockResolvedValue([[{ id: 1, nombre: 'Pieza' }]]);
      const filas = [
        ['A1', 'BRAZO AUXILIAR FORD F150 2005 $519 MAYASA', 'Pieza', '1'],
        ['A2', 'BIELETA NISS SENTRA B14 $66 MAYASA', 'Pieza', '1'],
      ];
      const sinResolver = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
      const hallazgo = sinResolver.hallazgosCalidad.find((h) => h.tipo === 'datos_mezclados');
      expect(hallazgo.tienePrecio).toBe(true);
      expect(hallazgo.tieneProveedor).toBe(true);
      expect(hallazgo.totalProveedor).toBe(2);

      const yaResuelto = await validarFilasImportacion(cabeceras, filas, {
        mapeoFinal,
        modo: 'tolerante',
        limpiezaMezcla: { nombre: { proveedor: 'proveedor_principal', precio: 'costo' } },
      });
      expect(yaResuelto.hallazgosCalidad.some((h) => h.tipo === 'datos_mezclados')).toBe(false);
    });

    test('limpiezaMezcla: mueve proveedor a proveedor_principal y precio a costo, dejando el nombre limpio', async () => {
      pool.query.mockReset();
      pool.query.mockResolvedValue([[{ id: 1, nombre: 'Pieza' }]]);
      const filas = [
        ['A1', 'BRAZO AUXILIAR FORD F150 2005 $519 MAYASA', 'Pieza', '1'],
        ['A2', 'BIELETA NISS SENTRA B14 $66 MAYASA', 'Pieza', '1'],
      ];
      const resultado = await validarFilasImportacion(cabeceras, filas, {
        mapeoFinal,
        modo: 'tolerante',
        limpiezaMezcla: { nombre: { proveedor: 'proveedor_principal', precio: 'costo' } },
      });
      expect(resultado.filasValidas[0].nombre).toBe('BRAZO AUXILIAR FORD F150 2005');
      expect(resultado.filasValidas[0].proveedor_principal).toBe('MAYASA');
      expect(resultado.filasValidas[0].costo).toBe(519);
    });

    test('limpiezaMezcla NUNCA sobreescribe un proveedor_principal ya mapeado desde una columna real', async () => {
      pool.query.mockReset();
      pool.query.mockResolvedValue([[{ id: 1, nombre: 'Pieza' }]]);
      const cabecerasConProveedor = [...cabeceras, 'proveedor'];
      const mapeoConProveedor = { ...mapeoFinal, proveedor_principal: 4 };
      const filas = [
        ['A1', 'BRAZO AUXILIAR FORD F150 2005 $519 MAYASA', 'Pieza', '1', 'Proveedor Real SA'],
        ['A2', 'BIELETA NISS SENTRA B14 $66 MAYASA', 'Pieza', '1', 'Proveedor Real SA'],
      ];
      const resultado = await validarFilasImportacion(cabecerasConProveedor, filas, {
        mapeoFinal: mapeoConProveedor,
        modo: 'tolerante',
        limpiezaMezcla: { nombre: { proveedor: 'proveedor_principal' } },
      });
      expect(resultado.filasValidas[0].proveedor_principal).toBe('Proveedor Real SA');
    });

    test('limpiezaMezcla con "descartar" limpia el nombre sin escribir nada en otro campo', async () => {
      pool.query.mockReset();
      pool.query.mockResolvedValue([[{ id: 1, nombre: 'Pieza' }]]);
      const filas = [
        ['A1', 'BRAZO AUXILIAR FORD F150 2005 $519 MAYASA', 'Pieza', '1'],
        ['A2', 'BIELETA NISS SENTRA B14 $66 MAYASA', 'Pieza', '1'],
      ];
      const resultado = await validarFilasImportacion(cabeceras, filas, {
        mapeoFinal,
        modo: 'tolerante',
        limpiezaMezcla: { nombre: { proveedor: 'descartar', precio: 'descartar' } },
      });
      expect(resultado.filasValidas[0].nombre).toBe('BRAZO AUXILIAR FORD F150 2005');
      expect(resultado.filasValidas[0].proveedor_principal).toBeNull();
      expect(resultado.filasValidas[0].costo).toBeNull();
    });

    test('sin limpiezaMezcla, el nombre se deja exactamente como vino en el archivo (comportamiento por default, sin sorpresas)', async () => {
      pool.query.mockReset();
      pool.query.mockResolvedValue([[{ id: 1, nombre: 'Pieza' }]]);
      const filas = [
        ['A1', 'BRAZO AUXILIAR FORD F150 2005 $519 MAYASA', 'Pieza', '1'],
        ['A2', 'BIELETA NISS SENTRA B14 $66 MAYASA', 'Pieza', '1'],
      ];
      const resultado = await validarFilasImportacion(cabeceras, filas, { mapeoFinal, modo: 'tolerante' });
      expect(resultado.filasValidas[0].nombre).toBe('BRAZO AUXILIAR FORD F150 2005 $519 MAYASA');
    });
  });
});

describe('protegerCeldaCSV — OWASP CSV Injection (§35, reutilizado en errores.csv)', () => {
  test('antepone apóstrofo a valores que empiezan con = + - @', () => {
    expect(protegerCeldaCSV('=cmd|"/c calc"!A1')).toBe("'=cmd|\"/c calc\"!A1");
    expect(protegerCeldaCSV('+1234')).toBe("'+1234");
    expect(protegerCeldaCSV('-1234')).toBe("'-1234");
    expect(protegerCeldaCSV('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  test('texto normal no se toca', () => {
    expect(protegerCeldaCSV('Producto normal')).toBe('Producto normal');
  });
});

describe('generarPlantillaCSV (§34.3.4)', () => {
  test('trae las cabeceras EXACTAS de los 20 campos importables', () => {
    const csv = generarPlantillaCSV();
    const primeraLinea = csv.split('\r\n')[0];
    CAMPOS_IMPORTABLES.forEach((c) => expect(primeraLinea).toContain(c.campo));
  });

  test('trae al menos 2 filas de ejemplo', () => {
    const csv = generarPlantillaCSV();
    const lineas = csv.split('\r\n');
    expect(lineas.length).toBeGreaterThanOrEqual(3); // cabecera + 2 ejemplos
  });
});
