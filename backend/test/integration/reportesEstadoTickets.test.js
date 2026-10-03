// Reportes → "Estado de tickets" (punto 360, movido desde "Inicio" — ver
// PROJECT_STATE.md): mismo patrón de mocking que gatingFacturacion.test.js
// para probar el doble candado requiereFeature('facturacionHabilitada') +
// requiereFeature('reportesEstadoTicketsHabilitado') con X-Tenant-Slug.

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
    facturacion_habilitada: 1,
    portal_clientes_habilitado: 1,
    sucursales_habilitado: 0,
    reportes_estado_tickets_habilitado: 1,
    ...extra,
  };
}

function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('GET /api/admin/reportes/estado-tickets (Reportes → Estado de tickets, punto 360)', () => {
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
    const res = await request(app).get('/api/admin/reportes/estado-tickets');
    expect(res.status).toBe(401);
  });

  test('perfil "ventas" no tiene acceso (403)', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
    const res = await request(app).get('/api/admin/reportes/estado-tickets').auth(usuario, password);
    expect(res.status).toBe(403);
  });

  test('perfil "fiscal" sí tiene acceso — pasa el gate y llega a la lógica real', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
    pool.query.mockResolvedValueOnce([[]]); // SELECT tickets
    const res = await request(app).get('/api/admin/reportes/estado-tickets').auth(usuario, password);
    expect(res.status).toBe(200);
  });

  test('tenant con Facturación apagada: 404 (nunca 403, mismo criterio anti-enumeración)', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 0 })]]);
    const res = await request(app)
      .get('/api/admin/reportes/estado-tickets')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');
    expect(res.status).toBe(404);
  });

  test('tenant con Facturación activa pero "Estado de tickets" apagado en /control: 404', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila({ reportes_estado_tickets_habilitado: 0 })]]);
    const res = await request(app)
      .get('/api/admin/reportes/estado-tickets')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');
    expect(res.status).toBe(404);
  });

  test('tenant con ambos flags activos: 200 con los datos reales', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
    pool.query.mockResolvedValueOnce([
      [
        { id: 1, folio: 'TK-000001', rfc: 'XAXX010101000', estatus: 'listo', creado_en: '2026-09-01 10:00:00' },
        { id: 2, folio: 'TK-000002', rfc: 'XAXX010101000', estatus: 'pendiente', creado_en: '2026-09-15 10:00:00' },
      ],
    ]);
    const res = await request(app)
      .get('/api/admin/reportes/estado-tickets')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.tickets).toHaveLength(2);
  });

  test('sitio base (sin X-Tenant-Slug): el candado es no-op, responde 200', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get('/api/admin/reportes/estado-tickets').auth('admin', 'admin');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 0, tickets: [] });
  });

  test('solo trae tickets activos (no eliminados), sin filtros extra en la query', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await request(app).get('/api/admin/reportes/estado-tickets').auth('admin', 'admin');
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toMatch(/eliminado_en IS NULL/);
    expect(sql).not.toMatch(/estatus = \?/);
  });
});
