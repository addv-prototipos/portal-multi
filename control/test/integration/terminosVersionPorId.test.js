// GET /api/control/terminos/:id — contenido completo de una versión
// (punto en curso, editor Markdown seguro): base para "Partir de la
// vigente", el diff del editor, y el modal "Ver contenido" de cualquier
// fila del historial. Registrada DESPUÉS de /historial/:slug y
// /historial-global a propósito — este test confirma que esa ruta
// literal sigue resolviendo normal y que :id nunca la intercepta.

const request = require('supertest');

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const app = require('../../server');

describe('GET /api/control/terminos/:id', () => {
  let pool;

  beforeEach(() => {
    pool = { query: jest.fn() };
    obtenerPool.mockReturnValue(pool);
  });

  test('sin credenciales responde 401', async () => {
    const res = await request(app).get('/api/control/terminos/7');
    expect(res.status).toBe(401);
  });

  test('con credenciales válidas: devuelve contenido + formato de esa versión', async () => {
    pool.query.mockResolvedValueOnce([
      [{ id: 7, version: '1.2', contenido: '## Hola\n\nTexto.', formato: 'markdown', resumen_cambios: 'Prueba', creado_en: '2026-11-13 10:00:00' }],
    ]);

    const res = await request(app).get('/api/control/terminos/7').auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 7, version: '1.2', formato: 'markdown', contenido: '## Hola\n\nTexto.' });
  });

  test('id que no existe: responde 404, nunca 200 con contenido vacío', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get('/api/control/terminos/999').auth('admin', 'admin');
    expect(res.status).toBe(404);
  });

  test('la ruta literal /historial-global sigue resolviendo, :id(\\d+) no la intercepta', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    pool.query.mockResolvedValueOnce([[{ total: 0 }]]);
    const res = await request(app).get('/api/control/terminos/historial-global').auth('admin', 'admin');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
  });
});
