// Pruebas de utils/facturacionClarvo.js — "Facturación de Clarvo" en Mi
// Cuenta (historial real de Stripe) + montoRealInvoiceTenant (punto en
// curso: "Solicitar factura" se pide por el cobro REAL de Stripe para un
// invoiceId dado, nunca por precio de catálogo — ver el comentario de la
// función).

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/stripePagos', () => ({
  obtenerStripe: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { obtenerStripe } = require('../../utils/stripePagos');
const { listarFacturasTenant, montoRealInvoiceTenant } = require('../../utils/facturacionClarvo');

function mockPool() {
  const pool = { query: jest.fn() };
  obtenerPool.mockReturnValue(pool);
  return pool;
}

describe('utils/facturacionClarvo.js', () => {
  beforeEach(() => {
    obtenerStripe.mockReset();
  });

  describe('montoRealInvoiceTenant', () => {
    test('tenant sin stripe_customer_id -> null, nunca llama a Stripe', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: null }]]);

      const resultado = await montoRealInvoiceTenant('fantasma', 'in_123', pool);

      expect(resultado).toBeNull();
      expect(obtenerStripe).not.toHaveBeenCalled();
    });

    test('invoice no existe en Stripe (retrieve lanza) -> null, nunca truena', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]]);
      obtenerStripe.mockReturnValue({
        invoices: { retrieve: jest.fn().mockRejectedValue(new Error('No such invoice')) },
      });

      const resultado = await montoRealInvoiceTenant('panes', 'in_falso', pool);

      expect(resultado).toBeNull();
    });

    test('invoice real pero de OTRO customer -> null (candado cross-tenant)', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]]);
      obtenerStripe.mockReturnValue({
        invoices: {
          retrieve: jest.fn().mockResolvedValue({ customer: 'cus_OTRO_TENANT', total: 85000 }),
        },
      });

      const resultado = await montoRealInvoiceTenant('panes', 'in_ajeno', pool);

      expect(resultado).toBeNull();
    });

    test('invoice real del mismo customer, sin descuento -> monto = total / 100', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]]);
      obtenerStripe.mockReturnValue({
        invoices: {
          retrieve: jest.fn().mockResolvedValue({ customer: 'cus_1', total: 85000 }),
        },
      });

      const resultado = await montoRealInvoiceTenant('panes', 'in_real123', pool);

      expect(resultado).toBe(850);
    });

    test('invoice real con descuento de un solo cobro -> monto YA con descuento (total, nunca subtotal)', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]]);
      obtenerStripe.mockReturnValue({
        invoices: {
          retrieve: jest.fn().mockResolvedValue({ customer: 'cus_1', subtotal: 59900, total: 47920 }),
        },
      });

      const resultado = await montoRealInvoiceTenant('panes', 'in_con_cupon', pool);

      expect(resultado).toBe(479.2);
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

    test('invoice pagada con descuento: expone subtotal/total/descuento y prorratea por línea', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]])
        .mockResolvedValueOnce([[]]); // solicitudes de factura: ninguna

      obtenerStripe.mockReturnValue({
        invoices: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'in_1',
                number: 'F-001',
                status: 'paid',
                created: 1700000000,
                subtotal: 59900,
                total: 47920,
                status_transitions: { paid_at: 1700000100 },
                due_date: null,
                hosted_invoice_url: 'https://stripe/hosted',
                invoice_pdf: 'https://stripe/pdf',
                lines: {
                  data: [
                    { amount: 59900, description: '1 × Clarvo - Crece (at $599.00 / month)', period: { start: 1700000000 } },
                  ],
                },
              },
            ],
          }),
        },
      });

      const [factura] = await listarFacturasTenant('panes', { db: pool });

      expect(factura.subtotal).toBe(599);
      expect(factura.total).toBe(479.2);
      expect(factura.descuento).toBe(119.8);
      expect(factura.lineas).toEqual([
        { descripcion: '1 × Clarvo - Crece', monto: 599, descuento: 119.8, montoNeto: 479.2 },
      ]);
    });
  });
});
