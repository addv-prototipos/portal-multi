// CRM (punto en curso): ficha de contacto de clientes + métricas de
// cartera. GET /api/admin/crm/contactos — mismo patrón de mocking que
// notificacionesCliente.test.js/gatingFacturacion.test.js: X-Tenant-Slug +
// obtenerPoolControl simulan la resolución multi-tenant para probar el
// candado requiereFeature('crmHabilitado'); pool.query mockeado para la
// query agregada (usuarios + pedidos + ordenes_compra por email).

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

const { pool, obtenerPoolControl } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const { invalidarCacheTenant } = require('../../utils/tenantContext');
const app = require('../../server');

function tenantFila(extra = {}) {
  return {
    id: 1,
    slug: 'norte',
    nombre_empresa: 'Norte S.A.',
    estado: 'activo',
    db_host: 'mysql',
    db_name: 'tenant_norte',
    db_user: 'app',
    marca: null,
    marca_logo_url: null,
    tema_json: null,
    grupo_sucursal_id: null,
    contacto_email: null,
    marca_lookfeel_habilitado: 1,
    max_usuarios: null,
    crm_habilitado: 1,
    ...extra,
  };
}

function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('CRM: GET /api/admin/crm/contactos', () => {
  let poolControl;

  beforeEach(() => {
    poolControl = { query: jest.fn() };
    obtenerPoolControl.mockReturnValue(poolControl);
  });

  afterEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
    invalidarCacheTenant();
  });

  test('sin credenciales responde 401', async () => {
    const res = await request(app).get('/api/admin/crm/contactos');
    expect(res.status).toBe(401);
  });

  test('perfil "fiscal" no tiene acceso (403) — mismo gate que ordenes/pedidos', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('fiscal');
    const res = await request(app).get('/api/admin/crm/contactos').auth(usuario, password);
    expect(res.status).toBe(403);
  });

  test('tenant con crm_habilitado=0: responde 404 (nunca 403, anti-enumeración)', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila({ crm_habilitado: 0 })]]);
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    const res = await request(app)
      .get('/api/admin/crm/contactos')
      .set('X-Tenant-Slug', 'norte')
      .auth(usuario, password);
    expect(res.status).toBe(404);
  });

  test('perfil "ventas" con crm_habilitado=1: 200', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
    const { usuario, password } = mockUsuarioAdministrativo('ventas');
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app)
      .get('/api/admin/crm/contactos')
      .set('X-Tenant-Slug', 'norte')
      .auth(usuario, password);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ contactos: [] });
  });

  test('mapea segmento/identificador/nombre correctamente para 3 casos reales', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([
      [
        // Cliente recurrente, RFC real — identificador debe viajar.
        {
          id: 1, rfc: 'GOMJ800101ABC', nombre: 'Gómez Mayorista', email: 'gomez@example.com',
          telefono: '3312345678', creado_en: '2025-01-10 09:00:00', activo: 1,
          total_pedidos: 6, ultima_actividad_pedido: '2026-11-20 10:00:00',
          total_ventas: 5, valor_total: '12500.00', ultima_venta: '2026-11-21 10:00:00',
        },
        // Cliente nunca ha comprado nada — segmento 'nuevo', sin RFC real
        // (SINFISCAL-*) — identificador debe salir null, nombre cae a email.
        {
          id: 2, rfc: 'SINFISCAL-ABCDEF1234567890', nombre: null, email: 'nuevo@example.com',
          telefono: '3300000000', creado_en: '2026-11-01 09:00:00', activo: 1,
          total_pedidos: 0, ultima_actividad_pedido: null,
          total_ventas: 0, valor_total: '0.00', ultima_venta: null,
        },
        // Cuenta suspendida — segmento 'inactivo' pase lo que pase con sus operaciones.
        {
          id: 3, rfc: 'SINFISCAL-ZZZZZZ0000000000', nombre: 'Ex Cliente', email: 'ex@example.com',
          telefono: '3399999999', creado_en: '2024-01-01 09:00:00', activo: 0,
          total_pedidos: 3, ultima_actividad_pedido: '2024-02-01 09:00:00',
          total_ventas: 2, valor_total: '800.00', ultima_venta: '2024-02-02 09:00:00',
        },
      ],
    ]);

    const res = await request(app)
      .get('/api/admin/crm/contactos')
      .set('X-Tenant-Slug', 'norte')
      .auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.contactos).toHaveLength(3);

    const [recurrente, nuevo, inactivo] = res.body.contactos;
    expect(recurrente).toMatchObject({
      id: 1, identificador: 'GOMJ800101ABC', nombre: 'Gómez Mayorista',
      totalPedidos: 6, totalVentas: 5, valorTotal: 12500, segmento: 'recurrente',
    });
    expect(nuevo).toMatchObject({
      id: 2, identificador: null, nombre: 'nuevo@example.com',
      totalPedidos: 0, totalVentas: 0, valorTotal: 0, segmento: 'nuevo',
    });
    expect(inactivo).toMatchObject({
      id: 3, identificador: null, activo: false, segmento: 'inactivo',
    });
  });
});
