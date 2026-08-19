const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

const { pool } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const app = require('../../server');

// Misma técnica que gastos.test.js/admin.test.js: perfil concreto salta
// directo a la 3ra capa de requireAdminAuth con una sola consulta.
function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('Admin: Resumen financiero', () => {
  afterEach(() => {
    pool.query.mockReset();
    pool.getConnection.mockReset();
  });

  test('sin credenciales responde 401', async () => {
    const res = await request(app).get('/api/admin/resumen-financiero');
    expect(res.status).toBe(401);
  });

  test('perfil "fiscal" no tiene acceso (403)', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);
    expect(res.status).toBe(403);
  });

  test('perfil "administrador" recibe KPIs del mes, tendencia y la serie mensual', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
    pool.query.mockResolvedValueOnce([[{ ventas: '5000.00', facturado: '3000.00', facturado_anterior: '2000.00' }]]); // KPI ventas
    pool.query.mockResolvedValueOnce([[{ gastos: '1200.00', gastos_anterior: '800.00' }]]); // KPI gastos
    pool.query.mockResolvedValueOnce([[{ mes: '2026-08', ventas: '5000.00', facturado: '3000.00' }]]); // serie ventas
    pool.query.mockResolvedValueOnce([[{ mes: '2026-08', gastos: '1200.00' }]]); // serie gastos

    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.mes_actual).toEqual({
      ventas: 5000,
      facturado: 3000,
      ventas_sin_facturar: 2000,
      gastos: 1200,
      balance: 1800,
    });
    expect(res.body.tendencia).toEqual({ facturado: 50, gastos: 50 });
    expect(res.body.serie_mensual).toEqual([{ mes: 'Ago', ventas: 5000, facturado: 3000, gastos: 1200 }]);
  });

  test('sin actividad este mes, la serie viene vacía (no meses en 0)', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
    pool.query.mockResolvedValueOnce([[{ ventas: '0.00', facturado: '0.00', facturado_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([[{ gastos: '0.00', gastos_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([[]]); // sin filas de ventas
    pool.query.mockResolvedValueOnce([[]]); // sin filas de gastos

    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.serie_mensual).toEqual([]);
    expect(res.body.mes_actual).toEqual({
      ventas: 0,
      facturado: 0,
      ventas_sin_facturar: 0,
      gastos: 0,
      balance: 0,
    });
    expect(res.body.tendencia).toEqual({ facturado: 0, gastos: 0 });
  });

  test('un mes con solo gastos (sin ventas) sí aparece en la serie', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
    pool.query.mockResolvedValueOnce([[{ ventas: '0.00', facturado: '0.00', facturado_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([[{ gastos: '500.00', gastos_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([[]]); // sin filas de ventas
    pool.query.mockResolvedValueOnce([[{ mes: '2026-08', gastos: '500.00' }]]);

    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.serie_mensual).toEqual([{ mes: 'Ago', ventas: 0, facturado: 0, gastos: 500 }]);
  });
});
