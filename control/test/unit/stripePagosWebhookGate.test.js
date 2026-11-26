// Prueba enfocada del punto en curso (prueba gratis de 10 días): el gate
// de checkout.session.completed en utils/stripePagos.js:procesarEventoWebhook
// debe aceptar tanto payment_status 'paid' (tarjeta normal) como
// 'no_payment_required' (Subscription con trial_end futuro, $0 debido
// hoy — "agregar método de pago durante la prueba") — y seguir rechazando
// cualquier otro valor (ej. 'unpaid', el caso OXXO/SPEI que espera al
// evento async_payment_succeeded en vez de activarse aquí).
//
// Se usa metadata.tipo='reactivacion' (en vez de 'onboarding') porque es
// la ruta real por la que "agregar tarjeta durante la prueba" entra a
// este webhook (ver reactivacionTenant.js:crearCheckoutSessionReactivacion)
// y porque enrutarPagoConfirmado() delega ahí con un solo require, fácil
// de mockear sin arrastrar todo el pipeline de onboarding.

jest.mock('../../db', () => ({ obtenerPool: jest.fn() }));
jest.mock('../../utils/reactivacionTenant', () => ({
  manejarReactivacionConfirmada: jest.fn().mockResolvedValue(undefined),
}));

const { procesarEventoWebhook } = require('../../utils/stripePagos');
const { manejarReactivacionConfirmada } = require('../../utils/reactivacionTenant');

function mockDb() {
  // yaProcesado() hace un INSERT que resuelve normal la primera vez
  // (nunca ER_DUP_ENTRY) — eso basta para que procesarEventoWebhook
  // trate el evento como "nuevo".
  return { query: jest.fn().mockResolvedValue([{}]) };
}

function eventoCheckoutCompletado(paymentStatus, extra = {}) {
  return {
    id: `evt_${paymentStatus}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        payment_status: paymentStatus,
        metadata: { tipo: 'reactivacion', tenantId: '7' },
        customer: 'cus_abc',
        subscription: 'sub_abc',
        ...extra,
      },
    },
  };
}

describe('utils/stripePagos.js — gate de checkout.session.completed (prueba gratis)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('payment_status "paid": enruta y procesa (tarjeta normal)', async () => {
    const db = mockDb();
    await procesarEventoWebhook(eventoCheckoutCompletado('paid'), { db });

    expect(manejarReactivacionConfirmada).toHaveBeenCalledTimes(1);
  });

  test('payment_status "no_payment_required": enruta y procesa (agregar tarjeta durante la prueba, $0 debido hoy)', async () => {
    const db = mockDb();
    await procesarEventoWebhook(eventoCheckoutCompletado('no_payment_required'), { db });

    expect(manejarReactivacionConfirmada).toHaveBeenCalledTimes(1);
  });

  test('payment_status "unpaid" (OXXO/SPEI, ficha generada sin pagar): NO enruta todavía', async () => {
    const db = mockDb();
    await procesarEventoWebhook(eventoCheckoutCompletado('unpaid'), { db });

    expect(manejarReactivacionConfirmada).not.toHaveBeenCalled();
  });

  test('evento ya procesado antes (ER_DUP_ENTRY en el INSERT): no enruta una segunda vez', async () => {
    const db = { query: jest.fn().mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' }) };
    await procesarEventoWebhook(eventoCheckoutCompletado('no_payment_required'), { db });

    expect(manejarReactivacionConfirmada).not.toHaveBeenCalled();
  });
});
