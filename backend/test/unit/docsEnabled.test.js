// Hallazgo M-17 (sonar.html, 2026-10-13): /api/docs.json y /api/docs
// (Swagger) estaban públicos sin ningún interruptor — cualquiera podía
// listar toda la superficie de la API. Hallazgo m-01 (sonar_1.1.html,
// Fase D, punto 410, 2026-10-21): invertido a opt-in — por defecto
// APAGADO (404, nunca 403, mismo criterio anti-enumeración que
// requiereFeature()), solo se enciende con DOCS_ENABLED=true explícito.
const request = require('supertest');

// N-05 (sonar_1.3.html): intermitente bajo carga completa de la suite
// (timeout de 5s, pasa en aislado) — levanta el servidor completo +
// swagger-jsdoc, más lento bajo saturación de workers paralelos.
jest.setTimeout(20000);

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

describe('DOCS_ENABLED (M-17 — Swagger/docs opt-out)', () => {
  const DOCS_ENABLED_ORIGINAL = process.env.DOCS_ENABLED;

  afterEach(() => {
    if (DOCS_ENABLED_ORIGINAL === undefined) delete process.env.DOCS_ENABLED;
    else process.env.DOCS_ENABLED = DOCS_ENABLED_ORIGINAL;
    jest.resetModules();
  });

  test(
    'sin configurar: /api/docs.json responde 404 (opt-in, apagado por defecto)',
    async () => {
      jest.resetModules();
      delete process.env.DOCS_ENABLED;
      const app = require('../../server');

      const res = await request(app).get('/api/docs.json');
      expect(res.status).toBe(404);
    },
    // Primer require('../../server') del archivo — carga en frío de todo
    // el módulo. Bajo la suite completa (más presión de memoria que en
    // aislamiento) puede pasar los 5000 ms default; no es una regresión
    // de este test, es el costo normal de resetModules() + primer require.
    15000
  );

  test('DOCS_ENABLED=false: /api/docs.json responde 404, nunca 403 (anti-enumeración)', async () => {
    jest.resetModules();
    process.env.DOCS_ENABLED = 'false';
    const app = require('../../server');

    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(404);
  });

  test('DOCS_ENABLED=true: /api/docs.json responde 200', async () => {
    jest.resetModules();
    process.env.DOCS_ENABLED = 'true';
    const app = require('../../server');

    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBeDefined();
  });

  test('DOCS_ENABLED=true: /api/docs/ (UI) responde 200', async () => {
    jest.resetModules();
    process.env.DOCS_ENABLED = 'true';
    const app = require('../../server');

    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
  });

  test('DOCS_ENABLED=false: /api/docs (UI) también responde 404', async () => {
    jest.resetModules();
    process.env.DOCS_ENABLED = 'false';
    const app = require('../../server');

    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(404);
  });

  test('swaggerSpec nunca trae una IP/host hardcodeada en servers — solo el origen relativo', async () => {
    jest.resetModules();
    delete process.env.DOCS_ENABLED;
    const { swaggerSpec } = require('../../utils/swagger');

    expect(swaggerSpec.servers).toEqual([{ url: '/', description: 'Origen actual' }]);
  });
});
