// GET /api/control/terminos/historial-global — vista nueva "Historial de
// aceptaciones" (punto en curso, nombre real + evidencia de T&C):
// listado cross-tenant de quién aceptó qué versión, con la foto de
// nombre/correo guardada en el momento.

const request = require('supertest');

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const app = require('../../server');

describe('GET /api/control/terminos/historial-global', () => {
  let pool;

  beforeEach(() => {
    pool = { query: jest.fn() };
    obtenerPool.mockReturnValue(pool);
  });

  test('sin credenciales responde 401', async () => {
    const res = await request(app).get('/api/control/terminos/historial-global');
    expect(res.status).toBe(401);
  });

  test('con credenciales válidas: responde items + total, pasando limit/offset reales', async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          tenant_slug: 'panaderia-espiga',
          nombre_empresa: 'Panadería La Espiga',
          usuario: 'ADMIN1',
          nombre_completo: 'María Fernanda Torres López',
          email: 'maria@panaderiaespiga.mx',
          aceptado_en: '2026-11-12 09:14:00',
          ip: '187.188.44.12',
          version: '2.1',
        },
      ],
    ]);
    pool.query.mockResolvedValueOnce([[{ total: 1 }]]);

    const res = await request(app)
      .get('/api/control/terminos/historial-global')
      .query({ limit: 25, offset: 0 })
      .auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      nombre_empresa: 'Panadería La Espiga',
      nombre_completo: 'María Fernanda Torres López',
      email: 'maria@panaderiaespiga.mx',
    });
    expect(pool.query.mock.calls[0][1]).toEqual([25, 0]);
  });
});
