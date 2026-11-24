// POST /api/control/webhooks/stripe — candado de "Opción B" (sonda
// sintética de Kerberos, ver kerberos/utils/stripeProbe.js y el bypass en
// server.js). Archivo propio (no mete estos casos en control.test.js)
// porque necesita mockear el paquete `stripe` completo, algo que ningún
// otro test de este archivo necesita todavía.
//
// secretoInternoValido() lee process.env.INTERNAL_CACHE_SECRET en cada
// llamada (no lo cachea al importar el módulo), así que basta con fijar
// la variable ANTES de requerir server.js una sola vez arriba — no hace
// falta jest.resetModules() entre tests.

const request = require('supertest');

const SECRETO = 'secreto-interno-de-prueba';
process.env.INTERNAL_CACHE_SECRET = SECRETO;
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

jest.mock('../../db', () => ({ obtenerPool: jest.fn() }));

const mockConstructEvent = jest.fn();
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

jest.mock('../../utils/stripeWebhookHealth', () => ({
  secretosCandidatos: jest.fn().mockResolvedValue(['whsec_test_unico']),
}));

const mockRegistrarFirmaInvalida = jest.fn().mockResolvedValue(undefined);
jest.mock('../../utils/stripeWebhookMonitor', () => ({
  registrarFirmaInvalida: mockRegistrarFirmaInvalida,
  registrarErrorProcesamiento: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../../server');

beforeEach(() => {
  mockConstructEvent.mockReset();
  mockRegistrarFirmaInvalida.mockClear();
  // Firma siempre inválida — todos los casos de este archivo viven en la
  // rama `if (!event)` del handler (nunca llegan a procesar un evento real).
  mockConstructEvent.mockImplementation(() => {
    throw new Error('No signatures found matching the expected signature for payload');
  });
});

describe('POST /api/control/webhooks/stripe — Opción B (sonda sintética)', () => {
  test('firma inválida normal (sin headers de sonda): 400 genérico Y SÍ dispara la alerta por correo', async () => {
    const res = await request(app)
      .post('/api/control/webhooks/stripe')
      .set('stripe-signature', 'firma-cualquiera')
      .send({ id: 'evt_real_pero_mal_firmado' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Firma inválida.');
    expect(mockRegistrarFirmaInvalida).toHaveBeenCalledTimes(1);
  });

  test('sonda de Kerberos reconocida (header + secreto interno correctos): 400 distinto, NUNCA dispara la alerta', async () => {
    const res = await request(app)
      .post('/api/control/webhooks/stripe')
      .set('stripe-signature', 'firma-siempre-invalida-a-proposito')
      .set('X-Kerberos-Probe', '1')
      .set('X-Internal-Secret', SECRETO)
      .send({ id: 'evt_kerberos_sonda' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Firma inválida (sonda sintética — esperado).');
    expect(mockRegistrarFirmaInvalida).not.toHaveBeenCalled();
  });

  test('header de sonda SIN el secreto interno correcto: nunca basta solo el header, se trata como real', async () => {
    const res = await request(app)
      .post('/api/control/webhooks/stripe')
      .set('stripe-signature', 'firma-cualquiera')
      .set('X-Kerberos-Probe', '1')
      .set('X-Internal-Secret', 'adivinando-el-secreto')
      .send({ id: 'evt_intento_de_colarse' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Firma inválida.');
    expect(mockRegistrarFirmaInvalida).toHaveBeenCalledTimes(1);
  });

  test('header de sonda SIN mandarlo, solo el secreto interno correcto: tampoco basta solo eso, se trata como real', async () => {
    const res = await request(app)
      .post('/api/control/webhooks/stripe')
      .set('stripe-signature', 'firma-cualquiera')
      .set('X-Internal-Secret', SECRETO)
      .send({ id: 'evt_sin_header_de_sonda' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Firma inválida.');
    expect(mockRegistrarFirmaInvalida).toHaveBeenCalledTimes(1);
  });
});
