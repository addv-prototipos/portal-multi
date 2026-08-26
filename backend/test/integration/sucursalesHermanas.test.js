// §58: GET /api/admin/sucursales-hermanas — alimenta el switcher del
// sidebar con las sucursales asociadas al tenant actual (mismo grupo,
// ver backend/utils/auth.js). Mismo patrón de mocking que
// test/integration/multitenant.test.js: X-Tenant-Slug simula lo que
// nginx pondrá a partir del segmento 4, obtenerPoolControl mockeado para
// no depender de MySQL real.

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

const { obtenerPoolControl } = require('../../db');
const { invalidarCacheTenant } = require('../../utils/tenantContext');
const app = require('../../server');

function tenantFila({ grupoSucursalId = null } = {}) {
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
    grupo_sucursal_id: grupoSucursalId,
  };
}

describe('GET /api/admin/sucursales-hermanas (§58)', () => {
  let poolControl;

  beforeEach(() => {
    poolControl = { query: jest.fn() };
    obtenerPoolControl.mockReturnValue(poolControl);
  });

  afterEach(() => {
    jest.clearAllMocks();
    invalidarCacheTenant();
  });

  test('sin X-Tenant-Slug (tráfico sin multi-tenant), responde lista vacía', async () => {
    const res = await request(app).get('/api/admin/sucursales-hermanas').auth('admin', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.sucursales).toEqual([]);
    expect(poolControl.query).not.toHaveBeenCalled();
  });

  test('tenant sin grupo_sucursal_id responde lista vacía sin consultar tenants por grupo', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila()]]); // resolverTenantMiddleware

    const res = await request(app)
      .get('/api/admin/sucursales-hermanas')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.sucursales).toEqual([]);
    expect(poolControl.query).toHaveBeenCalledTimes(1); // solo la resolución del tenant
  });

  test('tenant con grupo devuelve sus sucursales hermanas, marcando la actual', async () => {
    poolControl.query
      .mockResolvedValueOnce([[tenantFila({ grupoSucursalId: 7 })]]) // resolverTenantMiddleware
      .mockResolvedValueOnce([
        [
          { slug: 'norte', nombre_empresa: 'Norte S.A.' },
          { slug: 'sur', nombre_empresa: 'Sur S.A.' },
        ],
      ]); // SELECT tenants del grupo

    const res = await request(app)
      .get('/api/admin/sucursales-hermanas')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.sucursales).toEqual([
      { slug: 'norte', nombre_empresa: 'Norte S.A.', actual: true },
      { slug: 'sur', nombre_empresa: 'Sur S.A.', actual: false },
    ]);
    expect(poolControl.query.mock.calls[1][0]).toMatch(/grupo_sucursal_id/);
    expect(poolControl.query.mock.calls[1][1]).toEqual([7]);
  });

  test('sin credenciales responde 401', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila()]]); // resolverTenantMiddleware
    const res = await request(app).get('/api/admin/sucursales-hermanas').set('X-Tenant-Slug', 'norte');
    expect(res.status).toBe(401);
  });
});
