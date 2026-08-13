const { pool } = require('../../db');
const {
  CATALOGO_DEFAULT,
  getUsosCfdi,
  getInfoSincronizacion,
  sincronizarDesdeOrigen,
  normalizarCatalogoRemoto,
  esCatalogoValido,
} = require('../../utils/usoCfdi');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
}));

describe('usoCfdi.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
    delete process.env.USO_CFDI_SYNC_URL;
  });

  describe('getUsosCfdi', () => {
    test('devuelve el catálogo por defecto si no hay nada guardado', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const resultado = await getUsosCfdi();
      expect(resultado).toEqual(CATALOGO_DEFAULT);
    });

    test('devuelve el catálogo guardado si es JSON válido y no vacío', async () => {
      const catalogoGuardado = [{ clave: 'G01', descripcion: 'Custom' }];
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify(catalogoGuardado) }]]);
      const resultado = await getUsosCfdi();
      expect(resultado).toEqual(catalogoGuardado);
    });

    test('cae al default si el JSON guardado está corrupto', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: 'no-es-json{{{' }]]);
      const resultado = await getUsosCfdi();
      expect(resultado).toEqual(CATALOGO_DEFAULT);
    });

    test('cae al default si el JSON guardado es un arreglo vacío', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '[]' }]]);
      const resultado = await getUsosCfdi();
      expect(resultado).toEqual(CATALOGO_DEFAULT);
    });
  });

  describe('getInfoSincronizacion', () => {
    test('devuelve fecha y origen guardados', async () => {
      pool.query.mockResolvedValueOnce([
        [
          { clave: 'uso_cfdi_actualizado_en', valor: '2026-01-01T00:00:00.000Z' },
          { clave: 'uso_cfdi_origen', valor: 'https://sat.example/catalogo' },
        ],
      ]);
      const resultado = await getInfoSincronizacion();
      expect(resultado).toEqual({
        actualizadoEn: '2026-01-01T00:00:00.000Z',
        origen: 'https://sat.example/catalogo',
      });
    });

    test('devuelve el texto por defecto si nunca se ha sincronizado', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const resultado = await getInfoSincronizacion();
      expect(resultado).toEqual({
        actualizadoEn: null,
        origen: 'catálogo incluido por defecto',
      });
    });
  });

  describe('esCatalogoValido', () => {
    test('acepta un catálogo bien formado con al menos 5 elementos', () => {
      const catalogo = Array.from({ length: 5 }, (_, i) => ({ clave: `C0${i}`, descripcion: `Desc ${i}` }));
      expect(esCatalogoValido(catalogo)).toBe(true);
    });

    test('rechaza si tiene menos de 5 elementos', () => {
      expect(esCatalogoValido([{ clave: 'G01', descripcion: 'x' }])).toBe(false);
    });

    test('rechaza si no es arreglo', () => {
      expect(esCatalogoValido('no es arreglo')).toBe(false);
      expect(esCatalogoValido(null)).toBe(false);
    });

    test('rechaza si algún item tiene clave vacía o mayor a 10 caracteres', () => {
      const base = Array.from({ length: 4 }, (_, i) => ({ clave: `C0${i}`, descripcion: `Desc ${i}` }));
      expect(esCatalogoValido([...base, { clave: '', descripcion: 'x' }])).toBe(false);
      expect(esCatalogoValido([...base, { clave: 'A'.repeat(11), descripcion: 'x' }])).toBe(false);
    });

    test('rechaza si algún item no trae descripción', () => {
      const base = Array.from({ length: 4 }, (_, i) => ({ clave: `C0${i}`, descripcion: `Desc ${i}` }));
      expect(esCatalogoValido([...base, { clave: 'C99', descripcion: '' }])).toBe(false);
    });
  });

  describe('normalizarCatalogoRemoto', () => {
    test('interpreta JSON como arreglo directo', () => {
      const catalogo = Array.from({ length: 5 }, (_, i) => ({ clave: `C0${i}`, descripcion: `Desc ${i}` }));
      const resultado = normalizarCatalogoRemoto(JSON.stringify(catalogo));
      expect(resultado).toEqual(catalogo);
    });

    test('interpreta JSON con forma { data: [...] }', () => {
      const catalogo = Array.from({ length: 5 }, (_, i) => ({ clave: `C0${i}`, descripcion: `Desc ${i}` }));
      const resultado = normalizarCatalogoRemoto(JSON.stringify({ data: catalogo }));
      expect(resultado).toEqual(catalogo);
    });

    test('interpreta variantes de nombre de campo (value/c_UsoCFDI/text/label)', () => {
      const remoto = Array.from({ length: 5 }, (_, i) => ({ c_UsoCFDI: `C0${i}`, label: `Desc ${i}` }));
      const resultado = normalizarCatalogoRemoto(JSON.stringify(remoto));
      expect(resultado).toEqual(
        Array.from({ length: 5 }, (_, i) => ({ clave: `C0${i}`, descripcion: `Desc ${i}` }))
      );
    });

    test('interpreta CSV con encabezado y comas', () => {
      const csv = [
        'clave,descripcion',
        'G01,Adquisicion de mercancias',
        'G02,Devoluciones',
        'G03,Gastos en general',
        'I01,Construcciones',
        'I02,Mobiliario',
      ].join('\n');
      const resultado = normalizarCatalogoRemoto(csv);
      expect(resultado).toHaveLength(5);
      expect(resultado[0]).toEqual({ clave: 'G01', descripcion: 'Adquisicion de mercancias' });
    });

    test('interpreta TSV (tabulador) con encabezado', () => {
      const tsv = [
        'clave\tdescripcion',
        'G01\tAdquisicion',
        'G02\tDevoluciones',
        'G03\tGastos',
        'I01\tConstrucciones',
        'I02\tMobiliario',
      ].join('\n');
      const resultado = normalizarCatalogoRemoto(tsv);
      expect(resultado).toHaveLength(5);
      expect(resultado[0]).toEqual({ clave: 'G01', descripcion: 'Adquisicion' });
    });

    test('respeta comillas en CSV (campo con coma interna)', () => {
      const csv = [
        'clave,descripcion',
        'G01,"Adquisicion, con coma"',
        'G02,Devoluciones',
        'G03,Gastos',
        'I01,Construcciones',
        'I02,Mobiliario',
      ].join('\n');
      const resultado = normalizarCatalogoRemoto(csv);
      expect(resultado[0].descripcion).toBe('Adquisicion, con coma');
    });

    test('devuelve null para texto vacío', () => {
      expect(normalizarCatalogoRemoto('')).toBeNull();
      expect(normalizarCatalogoRemoto(null)).toBeNull();
    });

    test('devuelve null si ni JSON ni CSV producen un catálogo válido', () => {
      expect(normalizarCatalogoRemoto('esto no es ni json ni csv util')).toBeNull();
    });
  });

  describe('sincronizarDesdeOrigen', () => {
    test('lanza error claro si no hay URL configurada ni se pasa una', async () => {
      await expect(sincronizarDesdeOrigen()).rejects.toThrow(/No hay un origen de sincronización configurado/);
    });

    test('lanza error si fetch no puede conectar', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
      await expect(sincronizarDesdeOrigen('https://sat.example/catalogo')).rejects.toThrow(/No se pudo conectar/);
    });

    test('lanza error si la respuesta HTTP no es ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
      await expect(sincronizarDesdeOrigen('https://sat.example/catalogo')).rejects.toThrow(/error HTTP 500/);
    });

    test('lanza error si la respuesta no se pudo interpretar como catálogo', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => 'texto sin sentido' });
      await expect(sincronizarDesdeOrigen('https://sat.example/catalogo')).rejects.toThrow(/no se pudo interpretar/);
    });

    test('sincroniza y guarda correctamente con una respuesta válida', async () => {
      const catalogoRemoto = Array.from({ length: 5 }, (_, i) => ({ clave: `C0${i}`, descripcion: `Desc ${i}` }));
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(catalogoRemoto) });

      const conexionMock = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
      };
      pool.getConnection.mockResolvedValue(conexionMock);

      const resultado = await sincronizarDesdeOrigen('https://sat.example/catalogo');

      expect(resultado).toEqual(catalogoRemoto);
      expect(conexionMock.beginTransaction).toHaveBeenCalled();
      expect(conexionMock.commit).toHaveBeenCalled();
      expect(conexionMock.query).toHaveBeenCalledTimes(3); // catalogo, actualizado, origen
      expect(conexionMock.release).toHaveBeenCalled();
    });

    test('usa USO_CFDI_SYNC_URL del entorno si no se pasa una URL explícita', async () => {
      process.env.USO_CFDI_SYNC_URL = 'https://sat.example/desde-env';
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

      await expect(sincronizarDesdeOrigen()).rejects.toThrow(/error HTTP 404/);
      expect(global.fetch).toHaveBeenCalledWith('https://sat.example/desde-env', expect.any(Object));
    });

    test('si el guardado falla, hace rollback y libera la conexión', async () => {
      const catalogoRemoto = Array.from({ length: 5 }, (_, i) => ({ clave: `C0${i}`, descripcion: `Desc ${i}` }));
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(catalogoRemoto) });

      const conexionMock = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn().mockRejectedValue(new Error('fallo de escritura')),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
      };
      pool.getConnection.mockResolvedValue(conexionMock);

      await expect(sincronizarDesdeOrigen('https://sat.example/catalogo')).rejects.toThrow('fallo de escritura');
      expect(conexionMock.rollback).toHaveBeenCalled();
      expect(conexionMock.release).toHaveBeenCalled();
      expect(conexionMock.commit).not.toHaveBeenCalled();
    });
  });
});
