// Pruebas de utils/financieroResumen.js (punto 467) — KPIs reales de la
// vista "Financiero" de /control. Fecha fija (2026-11-04) para que
// periodoActual() sea determinista en el test.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/gastosOperativos', () => ({
  sumaGastosMes: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { sumaGastosMes } = require('../../utils/gastosOperativos');
const {
  periodoActual,
  calcularMrr,
  upsertUtilidadMensual,
  utilidadAcumulada,
  historialUtilidad,
} = require('../../utils/financieroResumen');

describe('financieroResumen.js', () => {
  let pool;

  beforeEach(() => {
    pool = { query: jest.fn() };
    obtenerPool.mockReturnValue(pool);
    sumaGastosMes.mockReset();
  });

  test('periodoActual() da formato YYYY-MM', () => {
    expect(periodoActual(new Date('2026-11-04T12:00:00Z'))).toBe('2026-11');
    expect(periodoActual(new Date('2026-01-31T12:00:00Z'))).toBe('2026-01');
  });

  describe('calcularMrr', () => {
    test('suma MRR base + upscales de disco/usuarios', async () => {
      pool.query.mockResolvedValueOnce([[{
        tenants_activos: 3,
        mrr_base: '2390.00',
        mrr_upscale_disco: '150.00',
        mrr_upscale_usuarios: '50.00',
      }]]);
      const resultado = await calcularMrr(pool);
      expect(resultado).toEqual({ tenantsActivos: 3, mrrBase: 2390, mrrUpscale: 200, mrr: 2590 });
      expect(pool.query.mock.calls[0][0]).toContain("t.estado = 'activo'");
      expect(pool.query.mock.calls[0][0]).toContain("suscripcion_estatus != 'prueba'");
    });
  });

  describe('upsertUtilidadMensual', () => {
    test('hace UPSERT con el MRR en vivo y el gasto real del mes, regresa la utilidad', async () => {
      pool.query
        .mockResolvedValueOnce([[{ tenants_activos: 2, mrr_base: '1000.00', mrr_upscale_disco: '0.00', mrr_upscale_usuarios: '0.00' }]])
        .mockResolvedValueOnce([{}]); // el propio INSERT...ON DUPLICATE
      sumaGastosMes.mockResolvedValueOnce(400);

      const resultado = await upsertUtilidadMensual(pool);

      expect(resultado.ingreso).toBe(1000);
      expect(resultado.gasto).toBe(400);
      expect(resultado.utilidad).toBe(600);
      const [sql, params] = pool.query.mock.calls[1];
      expect(sql).toContain('ON DUPLICATE KEY UPDATE');
      expect(params[1]).toBe(1000);
      expect(params[2]).toBe(400);
    });
  });

  describe('utilidadAcumulada', () => {
    test('regresa 0 sin historial', async () => {
      pool.query.mockResolvedValueOnce([[{ acumulado: 0 }]]);
      expect(await utilidadAcumulada(pool)).toBe(0);
    });
  });

  describe('historialUtilidad', () => {
    test('mapea cada fila con utilidad calculada (ingreso - gasto)', async () => {
      pool.query.mockResolvedValueOnce([[
        { periodo: '2026-11', ingreso: '1000.00', gasto: '400.00', fuente_ingreso: 'mrr_estimado' },
      ]]);
      const historial = await historialUtilidad(pool);
      expect(historial).toEqual([{ periodo: '2026-11', ingreso: 1000, gasto: 400, utilidad: 600, fuenteIngreso: 'mrr_estimado' }]);
    });
  });
});
