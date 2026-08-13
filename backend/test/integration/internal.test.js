// Pruebas de integración de POST /internal/cache-tenant/invalidar
// (segmento 9b, ver PROJECT_STATE.md) — endpoint interno que el servicio
// "control" (ahora en su propio contenedor) llama para invalidar la
// caché de resolución de tenant de este proceso, protegido por un
// secreto compartido.

const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('../../utils/tenantContext', () => {
  const original = jest.requireActual('../../utils/tenantContext');
  return { ...original, invalidarCacheTenant: jest.fn() };
});

const { invalidarCacheTenant } = require('../../utils/tenantContext');
const app = require('../../server');

describe('POST /internal/cache-tenant/invalidar', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;

  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });

  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });

  beforeEach(() => {
    invalidarCacheTenant.mockClear();
  });

  test('sin el secreto responde 403 y no invalida nada', async () => {
    const res = await request(app).post('/internal/cache-tenant/invalidar').send({ slug: 'cliente1' });

    expect(res.status).toBe(403);
    expect(invalidarCacheTenant).not.toHaveBeenCalled();
  });

  test('con el secreto incorrecto responde 403', async () => {
    const res = await request(app)
      .post('/internal/cache-tenant/invalidar')
      .set('X-Internal-Secret', 'secreto-equivocado')
      .send({ slug: 'cliente1' });

    expect(res.status).toBe(403);
    expect(invalidarCacheTenant).not.toHaveBeenCalled();
  });

  test('con el secreto correcto, invalida la caché del slug indicado', async () => {
    const res = await request(app)
      .post('/internal/cache-tenant/invalidar')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ slug: 'cliente1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(invalidarCacheTenant).toHaveBeenCalledWith('cliente1');
  });

  test('sin slug en el body, invalida toda la caché (null)', async () => {
    const res = await request(app)
      .post('/internal/cache-tenant/invalidar')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({});

    expect(res.status).toBe(200);
    expect(invalidarCacheTenant).toHaveBeenCalledWith(null);
  });
});
