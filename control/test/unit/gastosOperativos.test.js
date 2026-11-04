// Pruebas de utils/gastosOperativos.js (punto 467) — gasto operativo de
// la PLATAFORMA (vista "Financiero" de /control), captura manual.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const {
  ErrorGastoOperativo,
  CATEGORIAS_DEFAULT,
  crearGasto,
  listarGastosMes,
  sumaGastosMes,
  desgloseCategoriasMes,
  listarCategorias,
} = require('../../utils/gastosOperativos');

describe('gastosOperativos.js', () => {
  let pool;

  beforeEach(() => {
    pool = { query: jest.fn() };
    obtenerPool.mockReturnValue(pool);
  });

  describe('crearGasto', () => {
    const base = { fecha: '2026-11-04', concepto: 'Factura Vultr', categoria: 'Infraestructura (Vultr)', monto: 4200 };

    test('inserta con los datos normalizados y regresa el periodo derivado de la fecha', async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 7 }]);
      const resultado = await crearGasto(base, 'admin', pool);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO control_gastos_operativos'),
        ['2026-11-04', 'Factura Vultr', null, 'Infraestructura (Vultr)', 4200, 0, 1, 0, null, 'admin']
      );
      expect(resultado).toEqual(expect.objectContaining({ id: 7, periodo: '2026-11', monto: 4200 }));
    });

    test('redondea el monto a 2 decimales', async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);
      const resultado = await crearGasto({ ...base, monto: 10.999 }, null, pool);
      expect(resultado.monto).toBe(11);
    });

    test('rechaza fecha inválida', async () => {
      await expect(crearGasto({ ...base, fecha: '04-11-2026' }, null, pool)).rejects.toMatchObject({ codigo: 'fecha_invalida' });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('rechaza concepto vacío', async () => {
      await expect(crearGasto({ ...base, concepto: '  ' }, null, pool)).rejects.toMatchObject({ codigo: 'concepto_invalido' });
    });

    test('rechaza categoría vacía', async () => {
      await expect(crearGasto({ ...base, categoria: '' }, null, pool)).rejects.toMatchObject({ codigo: 'categoria_invalida' });
    });

    test.each([0, -5, NaN, undefined])('rechaza monto inválido: %p', async (monto) => {
      await expect(crearGasto({ ...base, monto }, null, pool)).rejects.toMatchObject({ codigo: 'monto_invalido' });
    });

    test('el error es instancia de ErrorGastoOperativo', async () => {
      try {
        await crearGasto({ ...base, monto: 0 }, null, pool);
        throw new Error('no debió llegar aquí');
      } catch (err) {
        expect(err).toBeInstanceOf(ErrorGastoOperativo);
      }
    });
  });

  describe('listarGastosMes', () => {
    test('filtra por periodo y excluye soft-deleted', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
      const filas = await listarGastosMes('2026-11', pool);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('eliminado_en IS NULL'), ['2026-11']);
      expect(filas).toEqual([{ id: 1 }]);
    });
  });

  describe('sumaGastosMes', () => {
    test('regresa 0 cuando no hay filas', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 0 }]]);
      expect(await sumaGastosMes('2026-11', pool)).toBe(0);
    });

    test('suma real convertida a Number', async () => {
      pool.query.mockResolvedValueOnce([[{ total: '4200.00' }]]);
      expect(await sumaGastosMes('2026-11', pool)).toBe(4200);
    });
  });

  describe('desgloseCategoriasMes', () => {
    test('mapea categoria/total', async () => {
      pool.query.mockResolvedValueOnce([[{ categoria: 'Comisión Stripe', total: '2650.00' }]]);
      const filas = await desgloseCategoriasMes('2026-11', pool);
      expect(filas).toEqual([{ categoria: 'Comisión Stripe', total: 2650 }]);
    });
  });

  describe('listarCategorias', () => {
    test('une las categorías default con las ya usadas, sin duplicados, orden alfabético', async () => {
      pool.query.mockResolvedValueOnce([[{ categoria: 'Zebra' }, { categoria: 'Comisión Stripe' }]]);
      const categorias = await listarCategorias(pool);
      expect(categorias).toContain('Zebra');
      expect(categorias.filter((c) => c === 'Comisión Stripe')).toHaveLength(1);
      expect(categorias.length).toBe(new Set([...CATEGORIAS_DEFAULT, 'Zebra', 'Comisión Stripe']).size);
    });
  });
});
