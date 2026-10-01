// Gobierno de funcionalidades por tenant desde /control (ver PROJECT_STATE.md
// — Fase 1). Mismo patrón de mocking que cuotaUsuarios.test.js/
// sucursalesHermanas.test.js: X-Tenant-Slug simula la resolución
// multi-tenant, obtenerPoolControl mockeado (los flags viven en
// control_tenants.tenants, ver tenantContext.js).
//
// Cubre el contrato central: 404 (nunca 403/401) cuando el flag está
// apagado, SIN tocar lógica de negocio — antes de que requireUserAuth
// siquiera lea la cookie de sesión, y antes de que requireAdminAuth
// importe si las credenciales son válidas.

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
const { crearTokenSesion } = require('../../utils/authUsuario');
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
    disco_cuota_mb: null,
    ...extra,
  };
}

describe('Gobierno de funcionalidades por tenant (Fase 1)', () => {
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

  describe('Facturación — ruta pública (sin sesión)', () => {
    test('facturacion_habilitada=0: GET /api/config/tickets-retencion responde 404, nunca llega a leer la configuración', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 0 })]]);

      const res = await request(app).get('/api/config/tickets-retencion').set('X-Tenant-Slug', 'norte');

      expect(res.status).toBe(404);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('facturacion_habilitada=1 (default): GET /api/config/tickets-retencion responde normal, no 404', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
      pool.query.mockResolvedValue([[]]);

      const res = await request(app).get('/api/config/tickets-retencion').set('X-Tenant-Slug', 'norte');

      expect(res.status).not.toBe(404);
    });

    test('sin X-Tenant-Slug (sitio base): no hay req.tenant, el candado es no-op', async () => {
      pool.query.mockResolvedValue([[]]);

      const res = await request(app).get('/api/config/tickets-retencion');

      expect(res.status).not.toBe(404);
      expect(obtenerPoolControl).not.toHaveBeenCalled();
    });
  });

  describe('Facturación — ruta de admin (requireAdminAuth + requireAdminArea)', () => {
    test('facturacion_habilitada=0: GET /api/admin/tickets responde 404 ANTES de evaluar credenciales', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 0 })]]);

      // Sin .auth(...): si el candado no corriera primero, esto caería en
      // un 401 de requireAdminAuth, no en el 404 del candado de feature.
      const res = await request(app).get('/api/admin/tickets').set('X-Tenant-Slug', 'norte');

      expect(res.status).toBe(404);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('facturacion_habilitada=1: GET /api/admin/tickets sin credenciales cae al 401 normal de siempre (el candado deja pasar)', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);

      const res = await request(app).get('/api/admin/tickets').set('X-Tenant-Slug', 'norte');

      expect(res.status).toBe(401);
    });
  });

  describe('Portal de clientes — requireUserAuth (chokepoint único)', () => {
    test('portal_clientes_habilitado=0: GET /api/tickets responde 404 SIN leer la cookie de sesión', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ portal_clientes_habilitado: 0 })]]);
      const token = crearTokenSesion('GOMJ800101ABC', 'norte');

      const res = await request(app)
        .get('/api/tickets')
        .set('X-Tenant-Slug', 'norte')
        .set('Cookie', `sesion_usuario=${token}`);

      expect(res.status).toBe(404);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('portal_clientes_habilitado=1 (default): GET /api/tickets con sesión válida responde normal, no 404', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
      pool.query.mockResolvedValue([[]]);
      const token = crearTokenSesion('GOMJ800101ABC', 'norte');

      const res = await request(app)
        .get('/api/tickets')
        .set('X-Tenant-Slug', 'norte')
        .set('Cookie', `sesion_usuario=${token}`);

      expect(res.status).not.toBe(404);
    });
  });

  describe('Portal de clientes — login (nace la sesión, antes de requireUserAuth)', () => {
    test('portal_clientes_habilitado=0: POST /api/auth/login responde 404, nunca valida RFC/contraseña', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ portal_clientes_habilitado: 0 })]]);

      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-Slug', 'norte')
        .send({ rfc: 'GOMJ800101ABC', password: 'cualquiera' });

      expect(res.status).toBe(404);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('portal_clientes_habilitado=1 (default): POST /api/auth/login con credenciales inválidas cae al 401 normal, no 404', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
      pool.query.mockResolvedValueOnce([[]]); // sin usuario con ese RFC

      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Tenant-Slug', 'norte')
        .send({ rfc: 'GOMJ800101ABC', password: 'cualquiera' });

      expect(res.status).toBe(401);
    });
  });
});
