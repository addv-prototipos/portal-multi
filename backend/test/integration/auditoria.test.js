// GET /api/admin/auditoria (punto 244, mapeo con CLARVO_Planes.md —
// "Auditoría consultable"). Mismo patrón de mocking que
// sucursalesHermanas.test.js/tema.test.js: X-Tenant-Slug simula lo que
// nginx pone a partir del segmento 4, obtenerPoolControl mockeado (la
// tabla admin_auditoria vive en la BD de control).

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
const { invalidarCacheTenant } = require('../../utils/tenantContext');
const { hashPassword } = require('../../utils/authUsuario');
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
    ...extra,
  };
}

const FILA_AUDITORIA = {
  id: 1,
  ocurrido_en: '2026-09-10 12:00:00',
  actor: 'admin',
  mecanismo: 'admin_users',
  perfil: 'super',
  tenant_slug: 'norte',
  metodo: 'POST',
  ruta: '/api/admin/usuarios',
  resultado_estatus: 201,
  ip: '10.0.0.1',
};

describe('GET /api/admin/auditoria (punto 244)', () => {
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
    poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
    const res = await request(app).get('/api/admin/auditoria').set('X-Tenant-Slug', 'norte');
    expect(res.status).toBe(401);
  });

  test('perfil "fiscal" no tiene acceso (403) — solo administrador/super', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila()]]); // resolverTenantMiddleware
    pool.query.mockResolvedValueOnce([[{ rfc: 'fiscal1', password_hash: hashPassword('Clave1234'), perfil: 'fiscal' }]]); // requireAdminAuth (perfil_bd, consulta `pool`, no la de control)

    const res = await request(app)
      .get('/api/admin/auditoria')
      .set('X-Tenant-Slug', 'norte')
      .auth('fiscal1', 'Clave1234');

    expect(res.status).toBe(403);
  });

  test('con tenant resuelto, filtra por ese tenant_slug (nunca cross-tenant)', async () => {
    poolControl.query
      .mockResolvedValueOnce([[tenantFila()]]) // resolverTenantMiddleware
      .mockResolvedValueOnce([[FILA_AUDITORIA]]); // listarAuditoria
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (switch "Mostrar Auditoría"), sin fila = default (habilitada)

    const res = await request(app)
      .get('/api/admin/auditoria')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.registros[0]).toEqual({
      id: 1,
      ocurridoEn: '2026-09-10 12:00:00',
      actor: 'admin',
      mecanismo: 'admin_users',
      perfil: 'super',
      metodo: 'POST',
      ruta: '/api/admin/usuarios',
      estatus: 201,
      ip: '10.0.0.1',
    });
    const [sqlAuditoria, paramsAuditoria] = poolControl.query.mock.calls[1];
    expect(sqlAuditoria).toMatch(/WHERE tenant_slug = \?/);
    expect(paramsAuditoria).toEqual(['norte']);
  });

  test('sin tenant (sitio base), filtra por tenant_slug IS NULL, nunca trae registros de un tenant real', async () => {
    poolControl.query.mockResolvedValueOnce([[FILA_AUDITORIA]]); // listarAuditoria (sin resolución de tenant)
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal, default habilitada

    const res = await request(app).get('/api/admin/auditoria').auth('admin', 'admin');

    expect(res.status).toBe(200);
    const [sqlAuditoria] = poolControl.query.mock.calls[0];
    expect(sqlAuditoria).toMatch(/WHERE tenant_slug IS NULL/);
  });

  test('acepta filtros actor/desde/hasta/limite y los pasa a listarAuditoria', async () => {
    poolControl.query
      .mockResolvedValueOnce([[tenantFila()]]) // resolverTenantMiddleware
      .mockResolvedValueOnce([[]]); // listarAuditoria
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal, default habilitada

    const res = await request(app)
      .get('/api/admin/auditoria?actor=admin&desde=2026-09-01&hasta=2026-09-10&limite=250')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    const [sqlAuditoria, paramsAuditoria] = poolControl.query.mock.calls[1];
    expect(sqlAuditoria).toMatch(/actor = \?/);
    expect(sqlAuditoria).toMatch(/ocurrido_en >= \?/);
    expect(sqlAuditoria).toMatch(/ocurrido_en <= \?/);
    expect(sqlAuditoria).toMatch(/LIMIT 250/);
    expect(paramsAuditoria).toEqual(['admin', 'norte', '2026-09-01', '2026-09-10']);
  });

  test('con el switch "Mostrar Auditoría" apagado, responde 403 aunque el perfil sí tenga acceso', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila()]]); // resolverTenantMiddleware
    pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ auditoria_habilitada: false }) }]]); // getConfiguracionGlobal

    const res = await request(app)
      .get('/api/admin/auditoria')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin');

    expect(res.status).toBe(403);
    // listarAuditoria() nunca se llegó a invocar — solo 1 llamada a poolControl (la de resolverTenantMiddleware)
    expect(poolControl.query).toHaveBeenCalledTimes(1);
  });
});
