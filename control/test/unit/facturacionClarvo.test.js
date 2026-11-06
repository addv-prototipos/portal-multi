// Pruebas de utils/facturacionClarvo.js — "Facturación de Clarvo" en Mi
// Cuenta (historial real de Stripe) + montoRealInvoiceTenant (punto 479:
// el CFDI se emite por el NETO que de verdad llega a la cuenta de Clarvo
// — bruto menos descuento de cupón (si hubo) menos la comisión REAL que
// Stripe retiene por procesar el cobro, nunca por invoice.total ni por
// precio de catálogo — ver el comentario de la función).

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

// Mock del Stripe real que necesita obtenerComisionStripe() para resolver
// la comisión: invoices.retrieve({expand:[...]}) -> payments.data[0] con
// el payment_intent, luego paymentIntents.retrieve({expand:[...]}) ->
// latest_charge.balance_transaction con fee/net reales.
function mockStripeConComision({ feeCentavos, netCentavos, invoiceRetrieveMock, piId = 'pi_1' }) {
  const paymentIntentsRetrieve = jest.fn().mockResolvedValue({
    latest_charge: { id: 'ch_1', balance_transaction: { fee: feeCentavos, net: netCentavos, amount: netCentavos + feeCentavos } },
  });
  return {
    invoices: { retrieve: invoiceRetrieveMock },
    paymentIntents: { retrieve: paymentIntentsRetrieve },
  };
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

    test('invoice real pero de OTRO customer -> null (candado cross-tenant), nunca intenta resolver la comisión', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]]);
      const paymentIntentsRetrieve = jest.fn();
      obtenerStripe.mockReturnValue({
        invoices: {
          retrieve: jest.fn().mockResolvedValue({ id: 'in_ajeno', customer: 'cus_OTRO_TENANT', total: 85000, status: 'paid' }),
        },
        paymentIntents: { retrieve: paymentIntentsRetrieve },
      });

      const resultado = await montoRealInvoiceTenant('panes', 'in_ajeno', pool);

      expect(resultado).toBeNull();
      expect(paymentIntentsRetrieve).not.toHaveBeenCalled();
    });

    test('invoice pagada sin comisión resoluble (edge case) -> se cae al bruto de la invoice', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]]);
      obtenerStripe.mockReturnValue({
        invoices: {
          retrieve: jest.fn()
            .mockResolvedValueOnce({ id: 'in_real123', customer: 'cus_1', total: 85000, status: 'paid' })
            // Segunda llamada: la de obtenerComisionStripe(), con expand —
            // sin pagos listados, no hay forma de llegar al payment_intent.
            .mockResolvedValueOnce({ id: 'in_real123', payments: { data: [] } }),
        },
      });

      const resultado = await montoRealInvoiceTenant('panes', 'in_real123', pool);

      expect(resultado).toBe(850);
    });

    test('invoice pagada con comisión real resoluble -> monto = NETO (bruto - comisión de Stripe), nunca el bruto', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]]);
      const invoiceRetrieve = jest.fn()
        .mockResolvedValueOnce({ id: 'in_con_comision', customer: 'cus_1', total: 4964, status: 'paid' })
        .mockResolvedValueOnce({
          id: 'in_con_comision',
          payments: { data: [{ payment: { payment_intent: 'pi_1' } }] },
        });
      obtenerStripe.mockReturnValue(mockStripeConComision({ feeCentavos: 585, netCentavos: 4379, invoiceRetrieveMock: invoiceRetrieve }));

      const resultado = await montoRealInvoiceTenant('panes', 'in_con_comision', pool);

      expect(resultado).toBe(43.79);
    });

    test('invoice NO pagada (status "open") -> nunca intenta resolver comisión, se cae al bruto directo', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]]);
      const invoiceRetrieve = jest.fn().mockResolvedValueOnce({ id: 'in_pendiente', customer: 'cus_1', total: 19900, status: 'open' });
      const paymentIntentsRetrieve = jest.fn();
      obtenerStripe.mockReturnValue({ invoices: { retrieve: invoiceRetrieve }, paymentIntents: { retrieve: paymentIntentsRetrieve } });

      const resultado = await montoRealInvoiceTenant('panes', 'in_pendiente', pool);

      expect(resultado).toBe(199);
      // Solo 1 llamada a invoices.retrieve (la de validación) — status
      // !== 'paid' corta obtenerComisionStripe() antes de la segunda.
      expect(invoiceRetrieve).toHaveBeenCalledTimes(1);
      expect(paymentIntentsRetrieve).not.toHaveBeenCalled();
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

    test('invoice pagada con descuento, sin comisión resoluble en el mock: expone subtotal/total/descuento y prorratea por línea (comisión en 0)', async () => {
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
          // Sin .retrieve mockeado -> obtenerComisionStripe() revienta al
          // invocarlo y cae a null por el try/catch (mismo criterio que
          // "sin comisión resoluble, nunca tumba el listado completo").
        },
      });

      const [factura] = await listarFacturasTenant('panes', { db: pool });

      expect(factura.subtotal).toBe(599);
      expect(factura.total).toBe(479.2);
      expect(factura.descuento).toBe(119.8);
      expect(factura.comisionStripe).toBeNull();
      expect(factura.montoNeto).toBe(479.2); // sin comisión resoluble, se cae al total
      expect(factura.lineas).toEqual([
        { descripcion: '1 × Clarvo - Crece', monto: 599, descuento: 119.8, comisionStripe: 0, montoNeto: 479.2 },
      ]);
    });

    test('invoice pagada SIN descuento pero CON comisión real de Stripe: la línea trae su propia "comisionStripe", el total de la factura usa el NETO', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[{ stripe_customer_id: 'cus_1' }]])
        .mockResolvedValueOnce([[]]);

      const invoiceRetrieve = jest.fn().mockResolvedValueOnce({
        id: 'in_2',
        payments: { data: [{ payment: { payment_intent: 'pi_2' } }] },
      });
      const paymentIntentsRetrieve = jest.fn().mockResolvedValue({
        latest_charge: { id: 'ch_2', balance_transaction: { fee: 1797, net: 18103, amount: 19900 } },
      });

      obtenerStripe.mockReturnValue({
        invoices: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'in_2',
                number: 'F-002',
                status: 'paid',
                created: 1700000000,
                subtotal: 19900,
                total: 19900, // sin cupón: subtotal === total
                status_transitions: { paid_at: 1700000100 },
                due_date: null,
                hosted_invoice_url: null,
                invoice_pdf: null,
                lines: {
                  data: [
                    { amount: 19900, description: '1 × Clarvo - Solicita (at $199.00 / month)', period: { start: 1700000000 } },
                  ],
                },
              },
            ],
          }),
          retrieve: invoiceRetrieve,
        },
        paymentIntents: { retrieve: paymentIntentsRetrieve },
      });

      const [factura] = await listarFacturasTenant('panes', { db: pool });

      expect(factura.descuento).toBe(0);
      expect(factura.comisionStripe).toBe(17.97);
      expect(factura.montoNeto).toBe(181.03);
      expect(factura.lineas).toEqual([
        { descripcion: '1 × Clarvo - Solicita', monto: 199, descuento: 0, comisionStripe: 17.97, montoNeto: 181.03 },
      ]);
    });
  });
});
