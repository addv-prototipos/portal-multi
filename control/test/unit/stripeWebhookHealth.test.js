// Self-healing del webhook de Stripe (punto en curso, incidente real de
// producción — ver control/utils/stripeWebhookHealth.js). Stripe real
// nunca se toca en estos tests: todo mockeado, lo que se valida es la
// LÓGICA de decisión (crear/reactivar/actualizar eventos/no tocar).

jest.mock('../../utils/stripePagos', () => ({
  obtenerStripe: jest.fn(),
  APP_BASE_URL: 'https://clarvo.mx',
}));

jest.mock('../../utils/ajustesGlobales', () => ({
  getValorTexto: jest.fn(),
  setValorTexto: jest.fn().mockResolvedValue(undefined),
}));

const { obtenerStripe } = require('../../utils/stripePagos');
const { getValorTexto, setValorTexto } = require('../../utils/ajustesGlobales');
const {
  URL_WEBHOOK,
  EVENTOS_REQUERIDOS,
  secretosCandidatos,
  verificarYRepararWebhook,
} = require('../../utils/stripeWebhookHealth');

function mockStripe({ list = [], createReturn = null, updateReturn = null } = {}) {
  const create = jest.fn().mockResolvedValue(createReturn);
  const update = jest.fn().mockResolvedValue(updateReturn);
  const stripeMock = {
    webhookEndpoints: {
      list: jest.fn().mockResolvedValue({ data: list }),
      create,
      update,
    },
  };
  obtenerStripe.mockReturnValue(stripeMock);
  return { stripeMock, create, update };
}

describe('stripeWebhookHealth — URL/eventos esperados', () => {
  test('URL_WEBHOOK se arma sobre APP_BASE_URL + la ruta real del webhook', () => {
    expect(URL_WEBHOOK).toBe('https://clarvo.mx/api/control/webhooks/stripe');
  });

  test('EVENTOS_REQUERIDOS son exactamente los 7 que procesarEventoWebhook() maneja', () => {
    expect(EVENTOS_REQUERIDOS).toEqual([
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]);
  });
});

describe('verificarYRepararWebhook — endpoint faltante', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sin ningún endpoint registrado y autoReparar:true -> lo crea con los 7 eventos', async () => {
    const { create } = mockStripe({
      list: [],
      createReturn: { id: 'we_nuevo', secret: 'whsec_nuevo123', livemode: false },
    });

    const resultado = await verificarYRepararWebhook({ autoReparar: true });

    expect(create).toHaveBeenCalledWith({
      url: 'https://clarvo.mx/api/control/webhooks/stripe',
      enabled_events: EVENTOS_REQUERIDOS,
      description: expect.any(String),
    });
    expect(resultado.ok).toBe(true);
    expect(resultado.accion).toBe('creado');
    expect(resultado.endpointId).toBe('we_nuevo');
    expect(resultado.secretoNuevo).toBe('whsec_nuevo123');
    expect(setValorTexto).toHaveBeenCalledWith('stripe_webhook_secret_actual', 'whsec_nuevo123');
    expect(process.env.STRIPE_WEBHOOK_SECRET).toBe('whsec_nuevo123');
  });

  test('sin ningún endpoint registrado y autoReparar:false -> reporta el hueco, nunca llama a create()', async () => {
    const { create } = mockStripe({ list: [] });

    const resultado = await verificarYRepararWebhook({ autoReparar: false });

    expect(create).not.toHaveBeenCalled();
    expect(resultado.ok).toBe(false);
    expect(resultado.error).toMatch(/No existe ningún webhook/);
  });
});

describe('verificarYRepararWebhook — endpoint ya existente', () => {
  beforeEach(() => jest.clearAllMocks());

  test('endpoint propio, habilitado, con los 7 eventos -> no toca nada', async () => {
    const { create, update } = mockStripe({
      list: [{ id: 'we_1', url: 'https://clarvo.mx/api/control/webhooks/stripe', status: 'enabled', enabled_events: EVENTOS_REQUERIDOS, livemode: false }],
    });

    const resultado = await verificarYRepararWebhook({ autoReparar: true });

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(resultado.ok).toBe(true);
    expect(resultado.accion).toBe('ninguna');
    expect(resultado.endpointId).toBe('we_1');
  });

  test('endpoint propio pero deshabilitado por Stripe (fallos repetidos) -> lo reactiva', async () => {
    const { update } = mockStripe({
      list: [{ id: 'we_1', url: 'https://clarvo.mx/api/control/webhooks/stripe', status: 'disabled', enabled_events: EVENTOS_REQUERIDOS, livemode: false }],
    });

    const resultado = await verificarYRepararWebhook({ autoReparar: true });

    expect(update).toHaveBeenCalledWith('we_1', { enabled_events: EVENTOS_REQUERIDOS, disabled: false });
    expect(resultado.accion).toBe('reactivado');
    expect(resultado.ok).toBe(true);
  });

  test('endpoint propio habilitado pero le faltan eventos (ej. se agregó un tipo nuevo al código) -> los actualiza', async () => {
    const { update } = mockStripe({
      list: [{ id: 'we_1', url: 'https://clarvo.mx/api/control/webhooks/stripe', status: 'enabled', enabled_events: ['checkout.session.completed'], livemode: false }],
    });

    const resultado = await verificarYRepararWebhook({ autoReparar: true });

    expect(update).toHaveBeenCalledWith('we_1', { enabled_events: EVENTOS_REQUERIDOS, disabled: false });
    expect(resultado.accion).toBe('eventos_actualizados');
  });

  test('endpoint propio deshabilitado y autoReparar:false -> reporta el problema, nunca llama a update()', async () => {
    const { update } = mockStripe({
      list: [{ id: 'we_1', url: 'https://clarvo.mx/api/control/webhooks/stripe', status: 'disabled', enabled_events: EVENTOS_REQUERIDOS, livemode: false }],
    });

    const resultado = await verificarYRepararWebhook({ autoReparar: false });

    expect(update).not.toHaveBeenCalled();
    expect(resultado.ok).toBe(false);
    expect(resultado.error).toMatch(/deshabilitó/);
  });

  test('nunca toca un endpoint de OTRA URL (ej. uno viejo de yt.addv.com.mx) — se reporta como ajeno, no se borra ni se actualiza', async () => {
    const { create, update } = mockStripe({
      list: [{ id: 'we_viejo', url: 'https://yt.addv.com.mx/api/control/webhooks/stripe', status: 'enabled', enabled_events: EVENTOS_REQUERIDOS, livemode: false }],
      createReturn: { id: 'we_nuevo', secret: 'whsec_x', livemode: false },
    });

    const resultado = await verificarYRepararWebhook({ autoReparar: true });

    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1); // crea el propio, nunca toca el ajeno
    expect(resultado.endpointsAjenos).toEqual([{ id: 'we_viejo', url: 'https://yt.addv.com.mx/api/control/webhooks/stripe', status: 'enabled' }]);
  });
});

describe('secretosCandidatos — fallback .env -> ajustes_globales', () => {
  const envOriginal = process.env.STRIPE_WEBHOOK_SECRET;
  afterEach(() => { process.env.STRIPE_WEBHOOK_SECRET = envOriginal; jest.clearAllMocks(); });

  test('con .env configurado y BD con el MISMO valor -> solo un candidato', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_env';
    getValorTexto.mockResolvedValue('whsec_env');
    const candidatos = await secretosCandidatos();
    expect(candidatos).toEqual(['whsec_env']);
  });

  test('con .env desactualizado y BD con uno distinto (self-heal creó uno nuevo) -> intenta .env primero, BD como fallback', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_viejo';
    getValorTexto.mockResolvedValue('whsec_nuevo');
    const candidatos = await secretosCandidatos();
    expect(candidatos).toEqual(['whsec_viejo', 'whsec_nuevo']);
  });

  test('sin .env y sin BD -> lista vacía (el caller debe responder 503, nunca intentar verificar nada)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    getValorTexto.mockResolvedValue(null);
    const candidatos = await secretosCandidatos();
    expect(candidatos).toEqual([]);
  });
});
