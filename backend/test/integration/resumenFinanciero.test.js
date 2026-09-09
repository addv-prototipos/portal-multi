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
    pool.query.mockResolvedValueOnce([[{ mes: '2026-08', ventas: '5000.00', subtotal: '4000.00', facturado: '3000.00' }]]); // serie ventas
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
    // utilidad_neta (2800) = subtotal (4000) - gastos (1200), misma fórmula
    // que mes_actual.utilidad_neta arriba — coinciden porque es el mismo mes.
    expect(res.body.serie_mensual).toEqual([{ mes: 'Ago', ventas: 5000, subtotal: 4000, facturado: 3000, gastos: 1200, utilidad_neta: 2800 }]);
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
    expect(res.body.serie_mensual).toEqual([{ mes: 'Ago', ventas: 0, subtotal: 0, facturado: 0, gastos: 500, utilidad_neta: -500 }]);
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
        { mes: '2026-06', ventas: '1000.00', subtotal: '1000.00', facturado: '1000.00' },
        { mes: '2026-07', ventas: '2000.00', subtotal: '2000.00', facturado: '2000.00' },
        { mes: '2026-08', ventas: '3000.00', subtotal: '3000.00', facturado: '3000.00' },
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

  // Bug real (2026-09-02, reportado por el usuario tras un cierre
  // mensual): el mes EN CURSO —parcial, recién empieza— se trataba como
  // un mes cerrado más para calcular la tendencia, hundiendo la
  // proyección a $0 los primeros días de cualquier mes. Este caso arma
  // 3 meses CERRADOS con tendencia +1000/mes y agrega el mes en curso
  // (relativo a la fecha real de hoy, sin fijar un mes fijo) con un
  // valor bajísimo — la proyección debe seguir la tendencia de los 3
  // meses cerrados, ignorando el dato parcial de hoy.
  test('el mes en curso (parcial) no distorsiona la proyección', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    const hoy = new Date();
    const llave = (offsetMeses) => {
      const f = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + offsetMeses, 1));
      return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}`;
    };
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
    pool.query.mockResolvedValueOnce([[{ ventas: '15.00', subtotal: '15.00', facturado: '0.00', facturado_anterior: '3000.00' }]]);
    pool.query.mockResolvedValueOnce([[{ gastos: '0.00', gastos_anterior: '0.00' }]]);
    pool.query.mockResolvedValueOnce([
      [
        { mes: llave(-3), ventas: '1000.00', subtotal: '1000.00', facturado: '1000.00' },
        { mes: llave(-2), ventas: '2000.00', subtotal: '2000.00', facturado: '2000.00' },
        { mes: llave(-1), ventas: '3000.00', subtotal: '3000.00', facturado: '3000.00' },
        // Mes en curso: apenas $15, un par de días de actividad — NO debe
        // contar como el "último mes cerrado" de la tendencia.
        { mes: llave(0), ventas: '15.00', subtotal: '15.00', facturado: '0.00' },
      ],
    ]);
    pool.query.mockResolvedValueOnce([[]]); // serie gastos
    pool.query.mockResolvedValueOnce([[]]); // gastos por categoria
    pool.query.mockResolvedValueOnce([[]]); // top proveedores

    const res = await request(app).get('/api/admin/resumen-financiero').auth(usuario, password);

    expect(res.status).toBe(200);
    // El mes en curso SÍ se sigue mostrando en la serie con su dato real
    // parcial — eso es correcto, no se toca.
    expect(res.body.serie_mensual[res.body.serie_mensual.length - 1]).toMatchObject({ ventas: 15 });
    // La proyección (2 meses después de HOY) sigue la tendencia real de
    // los 3 meses cerrados (+1000/mes desde 3000), NO desde $15.
    // Misma lógica que etiquetaMes() (server.js, no exportada) — se
    // replica aquí en vez de duplicar solo el formato para no depender
    // de un export nuevo únicamente para la prueba.
    const nombreMes = (f) => {
      const corta = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' }).format(f).replace('.', '');
      return corta.charAt(0).toUpperCase() + corta.slice(1);
    };
    // Ancla de etiqueta = el mes en curso (SÍ tiene dato, el de $15) —
    // Oct/Nov, 2/3 saltos de tendencia desde el último mes CERRADO (el
    // de -1, con $3000): 3000+1000*2=5000, 3000+1000*3=6000.
    const fProy1 = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 1));
    const fProy2 = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 2, 1));
    expect(res.body.proyeccion_ventas).toEqual([
      { mes: nombreMes(fProy1), ventas: 5000 },
      { mes: nombreMes(fProy2), ventas: 6000 },
    ]);
  });
});
