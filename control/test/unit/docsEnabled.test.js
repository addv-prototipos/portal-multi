// Hallazgo M-17 (sonar.html, 2026-10-13): /api/control/docs.json y
// /api/control/docs (Swagger) estaban públicos sin ningún interruptor.
// Hallazgo m-01 (sonar_1.1.html, Fase D, punto 410, 2026-10-21): invertido
// a opt-in — apagado por defecto (404, nunca 403), solo se enciende con
// DOCS_ENABLED=true explícito.
const request = require('supertest');

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/notificarBackend', () => {
  const real = jest.requireActual('../../utils/notificarBackend');
  return {
    notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
    activarTenantFisico: jest.fn().mockResolvedValue({ ok: true, dbName: 'tenant_cliente1' }),
    eliminarTenantFisico: jest.fn().mockResolvedValue({ ok: true }),
    calcularUsoDiscoFisico: jest.fn().mockResolvedValue(734003200),
    aplicarLimiteUsuarios: jest.fn().mockResolvedValue([]),
    obtenerUsoUsuarios: jest.fn().mockResolvedValue(3),
    crearAdminInicialFisico: jest.fn().mockResolvedValue({ ok: true }),
    ErrorActivacionFisica: real.ErrorActivacionFisica,
    ErrorEliminacionFisica: real.ErrorEliminacionFisica,
    ErrorCalculoDisco: real.ErrorCalculoDisco,
  };
});
jest.mock('../../utils/ajustesGlobales', () => ({
  getImagenMaxMb: jest.fn().mockResolvedValue(2),
  setImagenMaxMb: jest.fn().mockResolvedValue(2),
}));

describe('DOCS_ENABLED (M-17 — Swagger/docs opt-out, /control)', () => {
  const DOCS_ENABLED_ORIGINAL = process.env.DOCS_ENABLED;

  afterEach(() => {
    if (DOCS_ENABLED_ORIGINAL === undefined) delete process.env.DOCS_ENABLED;
    else process.env.DOCS_ENABLED = DOCS_ENABLED_ORIGINAL;
    jest.resetModules();
  });

  test('sin configurar: /api/control/docs.json responde 404 (opt-in, apagado por defecto)', async () => {
    jest.resetModules();
    delete process.env.DOCS_ENABLED;
    const app = require('../../server');

    const res = await request(app).get('/api/control/docs.json');
    expect(res.status).toBe(404);
  });

  test('DOCS_ENABLED=false: /api/control/docs.json responde 404, nunca 403', async () => {
    jest.resetModules();
    process.env.DOCS_ENABLED = 'false';
    const app = require('../../server');

    const res = await request(app).get('/api/control/docs.json');
    expect(res.status).toBe(404);
  });

  test('DOCS_ENABLED=true: /api/control/docs.json responde 200', async () => {
    jest.resetModules();
    process.env.DOCS_ENABLED = 'true';
    const app = require('../../server');

    const res = await request(app).get('/api/control/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBeDefined();
  });

  test('swaggerSpec de control nunca trae una IP/host hardcodeada en servers', async () => {
    jest.resetModules();
    delete process.env.DOCS_ENABLED;
    const { swaggerSpec } = require('../../utils/swagger');

    expect(swaggerSpec.servers).toEqual([{ url: '/', description: 'Origen actual' }]);
  });
});
