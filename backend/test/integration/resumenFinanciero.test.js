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
    pool.query.mockResolvedValueOnce([[{ ventas: '5000.00', subtotal: '4000.00', facturado: '3000.00', facturado_anterior: '2000.00' }]]); // KPI ventas
    pool.query.mockResolvedValueOnce([[{ gastos: '1200.00', gastos_anterior: '800.00' }]]); // KPI gastos
    pool.query.mockResolvedValueOnce([[{ mes: '2026-08', ventas: '5000.00', facturado: '3000.00' }]]); // serie ventas
    pool.query.mockResolvedValueOnce([[{ mes: '2026-08', gastos: '1200.00' }]]); // serie gastos
    pool.query.mockResolvedValueOnce([[{ categoria: 'renta', monto: '800.00' }, { categoria: 'software', monto: '400.00' }]]); // gastos por categoria
    pool.query.mockResolvedValueOnce([[{ proveedor: 'Arrendadora XYZ', monto: '800.00' }]]); // top proveedores

    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.mes_actual).toEqual({
      ventas: 5000,
      facturado: 3000,
      ventas_sin_facturar: 2000,
      gastos: 1200,
      balance: 1800,
      // Tarjeta "Utilidad neta del mes" (punto 118): cuenta TODAS las
      // ventas (facturadas o no) y compara el neto sin IVA contra gastos,
      // por eso utilidad_neta (2800) difiere de balance (1800).
      subtotal_ventas: 4000,
      iva_ventas: 1000,
      utilidad_neta: 2800,
    });
    expect(res.body.tendencia).toEqual({ facturado: 50, gastos: 50 });
    expect(res.body.serie_mensual).toEqual([{ mes: 'Ago', ventas: 5000, facturado: 3000, gastos: 1200 }]);
    expect(res.body.gastos_por_categoria).toEqual([
      { categoria: 'renta', monto: 800 },
      { categoria: 'software', monto: 400 },
    ]);
    expect(res.body.top_proveedores).toEqual([{ proveedor: 'Arrendadora XYZ', monto: 800 }]);
    // Un solo mes en la serie: no hay 3 meses reales para proyectar.
    expect(res.body.proyeccion_ventas).toBeNull();
  });

  test('sin actividad este mes, la serie viene vacía (no meses en 0)', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
    pool.query.mockResolvedValueOnce([[{ ventas: '0.00', subtotal: '0.00', facturado: '0.00', facturado_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([[{ gastos: '0.00', gastos_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([[]]); // sin filas de ventas
    pool.query.mockResolvedValueOnce([[]]); // sin filas de gastos
    pool.query.mockResolvedValueOnce([[]]); // gastos por categoria
    pool.query.mockResolvedValueOnce([[]]); // top proveedores

    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.serie_mensual).toEqual([]);
    expect(res.body.mes_actual).toEqual({
      ventas: 0,
      facturado: 0,
      ventas_sin_facturar: 0,
      gastos: 0,
      balance: 0,
      subtotal_ventas: 0,
      iva_ventas: 0,
      utilidad_neta: 0,
    });
    expect(res.body.tendencia).toEqual({ facturado: 0, gastos: 0 });
    expect(res.body.gastos_por_categoria).toEqual([]);
    expect(res.body.top_proveedores).toEqual([]);
    expect(res.body.proyeccion_ventas).toBeNull();
  });

  test('un mes con solo gastos (sin ventas) sí aparece en la serie', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
    pool.query.mockResolvedValueOnce([[{ ventas: '0.00', subtotal: '0.00', facturado: '0.00', facturado_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([[{ gastos: '500.00', gastos_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([[]]); // sin filas de ventas
    pool.query.mockResolvedValueOnce([[{ mes: '2026-08', gastos: '500.00' }]]);
    pool.query.mockResolvedValueOnce([[{ categoria: 'otro', monto: '500.00' }]]); // gastos por categoria
    pool.query.mockResolvedValueOnce([[]]); // top proveedores

    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.serie_mensual).toEqual([{ mes: 'Ago', ventas: 0, facturado: 0, gastos: 500 }]);
    // Solo gastos y sin ventas: utilidad negativa.
    expect(res.body.mes_actual.utilidad_neta).toBe(-500);
  });

  test('con 3+ meses reales de ventas, proyecta los siguientes 2 meses', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
    pool.query.mockResolvedValueOnce([[{ ventas: '3000.00', subtotal: '3000.00', facturado: '3000.00', facturado_anterior: '2000.00' }]]);
    pool.query.mockResolvedValueOnce([[{ gastos: '0.00', gastos_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([
      [
        { mes: '2026-06', ventas: '1000.00', facturado: '1000.00' },
        { mes: '2026-07', ventas: '2000.00', facturado: '2000.00' },
        { mes: '2026-08', ventas: '3000.00', facturado: '3000.00' },
      ],
    ]); // serie ventas: crecimiento constante de +1000/mes
    pool.query.mockResolvedValueOnce([[]]); // serie gastos
    pool.query.mockResolvedValueOnce([[]]); // gastos por categoria
    pool.query.mockResolvedValueOnce([[]]); // top proveedores

    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);

    expect(res.status).toBe(200);
    // Tendencia constante (+1000/mes) proyectada hacia sep/oct 2026.
    expect(res.body.proyeccion_ventas).toEqual([
      { mes: 'Sep', ventas: 4000 },
      { mes: 'Oct', ventas: 5000 },
    ]);
  });
});
