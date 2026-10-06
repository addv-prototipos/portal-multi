// Punto 362 (Inicio con datos reales, ver PROJECT_STATE.md):
// GET /api/admin/inicio/resumen — resumen de "hoy" por módulo, cada
// sección gateada por perfil + flag del tenant por separado (sin una
// sola requiereFeature a nivel de ruta, ver comentario en server.js).

const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
  obtenerPoolControl: jest.fn(),
  obtenerPoolTenant: jest.fn(() => ({ query: jest.fn(), getConnection: jest.fn() })),
  ejecutarComoTenant: jest.fn((tenantPool, fn) => fn()),
  cerrarTodosLosPoolsTenant: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('../../utils/inventarioConfig', () => {
  const actual = jest.requireActual('../../utils/inventarioConfig');
  return { ...actual, inventarioActivo: jest.fn() };
});

const { pool, obtenerPoolControl } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const { inventarioActivo } = require('../../utils/inventarioConfig');
const { invalidarCacheTenant } = require('../../utils/tenantContext');
const app = require('../../server');

function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

// La ruta llama getConfiguracionGlobal() antes de cualquier sección — se
// encola siempre como la 2da consulta (1ra es la de auth, salvo con
// admin:admin que no toca la BD).
const MOCK_CONFIG_GLOBAL = [[{ zona_horaria: 'America/Mexico_City', iva_porcentaje: '16.00' }]];

describe('GET /api/admin/inicio/resumen (punto 362)', () => {
  let poolControl;

  beforeEach(() => {
    poolControl = { query: jest.fn() };
    obtenerPoolControl.mockReturnValue(poolControl);
    inventarioActivo.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
    invalidarCacheTenant();
  });

  test('sin credenciales responde 401', async () => {
    const res = await request(app).get('/api/admin/inicio/resumen');
    expect(res.status).toBe(401);
  });

  test('perfil "fiscal": solo trae la sección de tickets', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
    pool.query
      .mockResolvedValueOnce(MOCK_CONFIG_GLOBAL)
      .mockResolvedValueOnce([[{ total: 3 }]]) // tickets hoy
      .mockResolvedValueOnce([[{ total: 2 }]]) // pendientes
      .mockResolvedValueOnce([[{ total: 14 }]]); // 7 días

    const res = await request(app).get('/api/admin/inicio/resumen').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.tickets).toEqual({
      hoy: 3,
      pendientes: 2,
      tendencia: { texto: '+50% vs prom. 7d', direccion: 'pos' },
    });
    expect(res.body.ventas).toBeUndefined();
    expect(res.body.gastos).toBeUndefined();
    expect(res.body.inventario).toBeUndefined();
  });

  test('perfil "ventas": trae ventas y gastos, no tickets ni inventario', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
    pool.query
      .mockResolvedValueOnce(MOCK_CONFIG_GLOBAL)
      .mockResolvedValueOnce([[{ total: 6, suma: '18420.00' }]]) // ventas hoy
      .mockResolvedValueOnce([[{ suma: '114800.00' }]]) // ventas 7d
      .mockResolvedValueOnce([
        [
          { numero_compra: 'OC-000198', email: 'a@a.com', total: '7424.00', fecha_compra: '2026-10-02 10:00:00' },
        ],
      ]) // ventas recientes
      .mockResolvedValueOnce([[{ total: 2, suma: '3260.00', con_factura: 1 }]]) // gastos hoy
      .mockResolvedValueOnce([[{ suma: '28000.00' }]]) // gastos 7d
      .mockResolvedValueOnce([
        [{ concepto: 'Renta', proveedor: 'Inmobiliaria Centro', monto: '32000.00', fecha: '2026-10-01' }],
      ]); // gastos recientes

    const res = await request(app).get('/api/admin/inicio/resumen').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.ventas.hoy).toEqual({ total: 18420, count: 6 });
    expect(res.body.ventas.recientes).toHaveLength(1);
    expect(res.body.ventas.recientes[0].email).toBe('a@a.com');
    expect(res.body.gastos.hoy).toEqual({ total: 3260, count: 2, conFactura: 1 });
    expect(res.body.tickets).toBeUndefined();
    expect(res.body.inventario).toBeUndefined();
  });

  test('venta sin correo: email viaja null, no string vacío', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query
      .mockResolvedValueOnce(MOCK_CONFIG_GLOBAL)
      .mockResolvedValueOnce([[{ total: 2, suma: '2146.00' }]]) // tickets... espera, administrador trae las 4 secciones
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 1, suma: '2146.00' }]]) // ventas hoy
      .mockResolvedValueOnce([[{ suma: '0.00' }]]) // ventas 7d
      .mockResolvedValueOnce([
        [{ numero_compra: 'OC-000196', email: null, total: '1740.00', fecha_compra: '2026-10-02 09:00:00' }],
      ])
      .mockResolvedValueOnce([[{ total: 0, suma: '0.00', con_factura: 0 }]]) // gastos hoy
      .mockResolvedValueOnce([[{ suma: '0.00' }]])
      .mockResolvedValueOnce([[]]); // gastos recientes vacío
    // perfil administrador también entra a inventario, pero inventarioActivo() mockeado en false arriba -> sección omitida.

    const res = await request(app).get('/api/admin/inicio/resumen').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.ventas.recientes[0].email).toBeNull();
    expect(res.body.inventario).toBeUndefined();
  });

  test('tenant con Ventas apagado en /control: la sección de ventas no viaja', async () => {
    poolControl.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          slug: 'norte',
          nombre_empresa: 'Norte S.A.',
          estado: 'activo',
          db_host: 'mysql',
          db_name: 'tenant_norte',
          db_user: 'app',
          facturacion_habilitada: 1,
          portal_clientes_habilitado: 1,
          sucursales_habilitado: 0,
          ventas_habilitado: 0,
          gastos_habilitado: 1,
        },
      ],
    ]);
    pool.query
      .mockResolvedValueOnce(MOCK_CONFIG_GLOBAL)
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0, suma: '0.00', con_factura: 0 }]])
      .mockResolvedValueOnce([[{ suma: '0.00' }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .get('/api/admin/inicio/resumen')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.ventas).toBeUndefined();
    expect(res.body.gastos).toBeDefined();
  });

  // Regresión del bug reportado el 2026-10-05: la ventana "hoy" estaba
  // anclada a medianoche UTC y dejaba fuera de las tarjetas todo lo
  // ocurrido a partir de las 18:00 hora local (México = UTC−6).
  test('Ventas/Inventario usan instantes de medianoche LOCAL y Gastos recibe fechas DATE', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventaszonas' });
    pool.query
      .mockResolvedValueOnce(MOCK_CONFIG_GLOBAL)
      .mockResolvedValueOnce([[{ total: 1, suma: '100.00' }]]) // ventas hoy
      .mockResolvedValueOnce([[{ suma: '100.00' }]]) // ventas 7d
      .mockResolvedValueOnce([[]]) // ventas recientes
      .mockResolvedValueOnce([[{ total: 1, suma: '50.00', con_factura: 0 }]]) // gastos hoy
      .mockResolvedValueOnce([[{ suma: '50.00' }]]) // gastos 7d
      .mockResolvedValueOnce([[]]); // gastos recientes

    const res = await request(app).get('/api/admin/inicio/resumen').auth(usuario, password);
    expect(res.status).toBe(200);

    const llamadas = pool.query.mock.calls;
    const [, pVentasHoy] = llamadas[2];
    const [, pVentas7d] = llamadas[3];
    const [, pGastosHoy] = llamadas[5];
    const [, pGastos7d] = llamadas[6];

    // DATETIME (ordenes_compra.fecha_compra): instante UTC de medianoche
    // LOCAL — 06:00Z para America/Mexico_City, nunca 00:00Z (el bug).
    expect(pVentasHoy[0]).toBeInstanceOf(Date);
    expect(pVentasHoy[0].getUTCHours()).toBe(6);
    expect(pVentasHoy[1].getUTCHours()).toBe(6);
    expect(pVentasHoy[1] - pVentasHoy[0]).toBe(24 * 3600 * 1000);
    expect(pVentas7d[0]).toBeInstanceOf(Date);
    expect(pVentas7d[1]).toEqual(pVentasHoy[0]);

    // DATE (gastos.fecha): string de calendario local, no Date — un Date de
    // medianoche 06:00Z excluiría el día 1 y arrancaría el mes tarde.
    expect(typeof pGastosHoy[0]).toBe('string');
    expect(pGastosHoy[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pGastosHoy[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pGastosHoy[1] > pGastosHoy[0]).toBe(true);
    expect(pGastos7d[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(pGastos7d[1]).toBe(pGastosHoy[0]);
  });
});
