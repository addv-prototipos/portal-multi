// Punto en curso (consistencia de gating Facturación): con Facturación
// apagada en el tenant, el RFC deja de pedirse al crear una cuenta
// cliente (auto-registro o desde /admin) — se genera un identificador
// interno en su lugar (ver generarIdentificadorSinFiscal en server.js).
// Mismo patrón de mocking que cuotaUsuarios.test.js: X-Tenant-Slug
// simula la resolución multi-tenant, obtenerPoolControl mockeado.

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
    facturacion_habilitada: 0,
    portal_clientes_habilitado: 1,
    sucursales_habilitado: 0,
    ...extra,
  };
}

describe('Consistencia de gating Facturación — RFC condicional', () => {
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

  describe('GET /api/config/registro', () => {
    test('tenant con Facturación apagada: facturacionHabilitada false', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 0 })]]);
      const res = await request(app).get('/api/config/registro').set('X-Tenant-Slug', 'norte');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ facturacionHabilitada: false });
    });

    test('tenant con Facturación activa: facturacionHabilitada true', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 1 })]]);
      const res = await request(app).get('/api/config/registro').set('X-Tenant-Slug', 'norte');
      expect(res.body).toEqual({ facturacionHabilitada: true });
    });

    test('sitio base (sin X-Tenant-Slug): facturacionHabilitada true, comportamiento de siempre', async () => {
      const res = await request(app).get('/api/config/registro');
      expect(res.body).toEqual({ facturacionHabilitada: true });
    });
  });

  describe('POST /api/auth/registro', () => {
    test('Facturación apagada: no exige RFC, genera identificador interno', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 0 })]]);
      pool.query
        .mockResolvedValueOnce([[]]) // SELECT id FROM usuarios WHERE rfc = ? (generarIdentificadorSinFiscalUnico)
        .mockResolvedValueOnce([{ insertId: 10 }]); // INSERT

      const res = await request(app)
        .post('/api/auth/registro')
        .set('X-Tenant-Slug', 'norte')
        .send({ email: 'cliente@norte.com', telefono: '5512345678', password: 'Abcdefg1' });

      expect(res.status).toBe(201);
      expect(res.body.rfc).toMatch(/^SINFISCAL-[0-9A-F]{16}$/);
      const llamadaInsert = pool.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO usuarios'));
      expect(llamadaInsert[1][0]).toMatch(/^SINFISCAL-/);
    });

    test('Facturación activa: sigue exigiendo RFC válido (sin regresión)', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 1 })]]);
      const res = await request(app)
        .post('/api/auth/registro')
        .set('X-Tenant-Slug', 'norte')
        .send({ email: 'cliente@norte.com', telefono: '5512345678', password: 'Abcdefg1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/RFC/);
    });
  });

  describe('POST /api/admin/usuarios (perfil cliente)', () => {
    test('Facturación apagada: ignora el RFC capturado y genera identificador interno', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 0 })]]);
      pool.query
        .mockResolvedValueOnce([[]]) // generarIdentificadorSinFiscalUnico
        .mockResolvedValueOnce([[]]) // SELECT existentes
        .mockResolvedValueOnce([{ insertId: 11 }]); // INSERT

      const res = await request(app)
        .post('/api/admin/usuarios')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send({ perfil: 'cliente', rfc: 'XAXX010101000', telefono: '5512345678', email: 'cliente@norte.com', password: 'Abcdefg1' });

      expect(res.status).toBe(201);
      expect(res.body.rfc).toMatch(/^SINFISCAL-/);
    });
  });

  describe('PUT /api/admin/usuarios/:id (perfil cliente)', () => {
    test('Facturación apagada: conserva el RFC/identificador ya guardado, ignora el body', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 0 })]]);
      pool.query
        .mockResolvedValueOnce([
          [{ id: 5, rfc: 'SINFISCAL-AAAA1111BBBB2222', perfil: 'cliente', email: 'a@a.com', telefono: '5500000000' }],
        ]) // SELECT usuarioActual
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

      const res = await request(app)
        .put('/api/admin/usuarios/5')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send({ perfil: 'cliente', rfc: 'INTENTO-DE-RFC-REAL', telefono: '5512345678', email: 'nuevo@norte.com' });

      expect(res.status).toBe(200);
      const llamadaUpdate = pool.query.mock.calls.find(([sql]) => sql.includes('UPDATE usuarios'));
      expect(llamadaUpdate[1]).toContain('SINFISCAL-AAAA1111BBBB2222');
      expect(llamadaUpdate[1]).not.toContain('INTENTO-DE-RFC-REAL');
    });
  });

  describe('GET /api/auth/me — tieneRfc', () => {
    const { crearTokenSesion } = require('../../utils/authUsuario');

    test('identificador interno (sin formato de RFC real): tieneRfc false', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ facturacion_habilitada: 0 })]]);
      pool.query.mockResolvedValueOnce([[{ nombre: 'Cliente Sin RFC', debe_cambiar_password: 0, activo: 1 }]]);

      const token = crearTokenSesion('SINFISCAL-AAAA1111BBBB2222', 'norte');
      const res = await request(app)
        .get('/api/auth/me')
        .set('X-Tenant-Slug', 'norte')
        .set('Cookie', `sesion_usuario=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tieneRfc).toBe(false);
      expect(res.body.facturacionHabilitada).toBe(false);
    });
  });
});
