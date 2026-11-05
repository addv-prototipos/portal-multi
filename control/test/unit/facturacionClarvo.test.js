// Pruebas de utils/facturacionClarvo.js — "Facturación de Clarvo" en Mi
// Cuenta (historial real de Stripe) + montoCatalogoTenant (punto en
// curso: "Solicitar factura" se pide por precio de CATÁLOGO, nunca por
// lo que Stripe cobró internamente — ver el comentario de la función).

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/stripePagos', () => ({
  obtenerStripe: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { obtenerStripe } = require('../../utils/stripePagos');
const { listarFacturasTenant, montoCatalogoTenant } = require('../../utils/facturacionClarvo');

function mockPool() {
  const pool = { query: jest.fn() };
  obtenerPool.mockReturnValue(pool);
  return pool;
}

describe('utils/facturacionClarvo.js', () => {
  describe('montoCatalogoTenant', () => {
    test('tenant inexistente -> total 0, sin líneas', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      const resultado = await montoCatalogoTenant('fantasma', pool);

      expect(resultado).toEqual({ total: 0, lineas: [] });
    });

    test('plan mensual + 2 upscales activos: suma precio de catálogo, nunca lo que cobró Stripe', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[
          { id: 30, suscripcion_ciclo: 'mensual', plan_nombre: 'Plan Panadero', precio_mensual: '850.00', precio_anual: '8500.00' },
        ]])
        .mockResolvedValueOnce([[
          { nombre: 'Usuario adicional', monto_recurrente: '50.00' },
          { nombre: 'Espacio adicional (500 MB)', monto_recurrente: '50.00' },
        ]]);

      const resultado = await montoCatalogoTenant('panes', pool);

      expect(resultado.total).toBe(950);
      expect(resultado.lineas).toEqual([
        { descripcion: 'Clarvo — Plan Panadero (mes)', monto: 850 },
        { descripcion: 'Usuario adicional', monto: 50 },
        { descripcion: 'Espacio adicional (500 MB)', monto: 50 },
      ]);
    });

    test('ciclo anual: usa precio_anual, nunca precio_mensual', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[
          { id: 7, suscripcion_ciclo: 'anual', plan_nombre: 'Plan Crece', precio_mensual: '799.00', precio_anual: '7990.00' },
        ]])
        .mockResolvedValueOnce([[]]);

      const resultado = await montoCatalogoTenant('cliente1', pool);

      expect(resultado.total).toBe(7990);
      expect(resultado.lineas).toEqual([{ descripcion: 'Clarvo — Plan Crece (año)', monto: 7990 }]);
    });

    test('sin upscales activos: solo el plan', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[
          { id: 3, suscripcion_ciclo: 'mensual', plan_nombre: 'Plan Solicita', precio_mensual: '399.00', precio_anual: null },
        ]])
        .mockResolvedValueOnce([[]]);

      const resultado = await montoCatalogoTenant('cliente2', pool);

      expect(resultado.total).toBe(399);
      expect(resultado.lineas).toHaveLength(1);
    });

    test('plan sin precio configurado (NULL): no inventa un monto, solo suma lo que sí existe', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[
          { id: 9, suscripcion_ciclo: 'mensual', plan_nombre: 'Plan sin precio', precio_mensual: null, precio_anual: null },
        ]])
        .mockResolvedValueOnce([[{ nombre: 'Usuario adicional', monto_recurrente: '50.00' }]]);

      const resultado = await montoCatalogoTenant('cliente3', pool);

      expect(resultado.total).toBe(50);
      expect(resultado.lineas).toEqual([{ descripcion: 'Usuario adicional', monto: 50 }]);
    });
  });

  describe('listarFacturasTenant', () => {
    test('tenant sin stripe_customer_id: lista vacía, nunca llama a Stripe', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: null }]]);

      const resultado = await listarFacturasTenant('panes', { db: pool });

      expect(resultado).toEqual([]);
      expect(obtenerStripe).not.toHaveBeenCalled();
    });
  });
});
