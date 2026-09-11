// Cuota de cuentas de panel (administrador/fiscal/ventas) por tenant,
// punto 244 (mapeo con CLARVO_Planes.md) — POST/PUT /api/admin/usuarios.
// Mismo patrón de mocking que auditoria.test.js/sucursalesHermanas.test.js:
// X-Tenant-Slug simula la resolución multi-tenant, obtenerPoolControl
// mockeado (max_usuarios vive en control_tenants.tenants).

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
    ...extra,
  };
}

const NUEVO_USUARIO = {
  perfil: 'ventas',
  rfc: 'nuevoventas',
  telefono: '5512345678',
  email: 'ventas2@norte.com',
  password: 'Abcdefg1',
};

describe('Cuota de usuarios de panel por tenant (punto 244)', () => {
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

  describe('POST /api/admin/usuarios', () => {
    test('tenant sin max_usuarios (NULL): sin límite, nunca cuenta ni bloquea', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ max_usuarios: null })]]); // resolverTenantMiddleware
      pool.query
        .mockResolvedValueOnce([[]]) // sin rfc existente
        .mockResolvedValueOnce([{ insertId: 9 }]); // INSERT

      const res = await request(app)
        .post('/api/admin/usuarios')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send(NUEVO_USUARIO);

      expect(res.status).toBe(201);
      // Sin cuota, jamás se consulta el COUNT(*) de operadores (los demás
      // pool.query posteriores son efectos fire-and-forget ya existentes
      // — invitación por correo/auditoría — sin relación con la cuota).
      expect(pool.query.mock.calls.some(([sql]) => sql.includes('COUNT(*)'))).toBe(false);
    });

    test('bajo la cuota: permite crear la cuenta', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ max_usuarios: 3 })]]);
      pool.query
        .mockResolvedValueOnce([[]]) // sin rfc existente
        .mockResolvedValueOnce([[{ total: 2 }]]) // COUNT(*) de operadores
        .mockResolvedValueOnce([{ insertId: 9 }]); // INSERT

      const res = await request(app)
        .post('/api/admin/usuarios')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send(NUEVO_USUARIO);

      expect(res.status).toBe(201);
    });

    test('en la cuota exacta: rechaza con 400 CUOTA_USUARIOS_EXCEDIDA, sin insertar', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ max_usuarios: 3 })]]);
      pool.query
        .mockResolvedValueOnce([[]]) // sin rfc existente
        .mockResolvedValueOnce([[{ total: 3 }]]); // COUNT(*) ya en el tope

      const res = await request(app)
        .post('/api/admin/usuarios')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send(NUEVO_USUARIO);

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('CUOTA_USUARIOS_EXCEDIDA');
      expect(pool.query).toHaveBeenCalledTimes(2); // nunca llega al INSERT
    });

    test('perfil "cliente" nunca cuenta contra la cuota (no es un asiento del plan)', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ max_usuarios: 1 })]]);
      pool.query
        .mockResolvedValueOnce([[]]) // sin rfc existente
        .mockResolvedValueOnce([{ insertId: 9 }]); // INSERT — sin pasar por el COUNT(*)

      const res = await request(app)
        .post('/api/admin/usuarios')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send({ perfil: 'cliente', rfc: 'GOMJ800101ABC', telefono: '5512345678', email: 'cliente@x.com', password: 'Abcdefg1' });

      expect(res.status).toBe(201);
      expect(pool.query.mock.calls.some(([sql]) => sql.includes('COUNT(*)'))).toBe(false);
    });

    test('sitio base (sin X-Tenant-Slug): sin cuota, comportamiento de siempre', async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // sin rfc existente
        .mockResolvedValueOnce([{ insertId: 9 }]); // INSERT

      const res = await request(app).post('/api/admin/usuarios').auth('admin', 'admin').send(NUEVO_USUARIO);

      expect(res.status).toBe(201);
      // Sin req.tenant, la cuota nunca se evalúa — nada que ver con que
      // obtenerPoolControl() pueda tocarse por otro efecto (auditoría).
      expect(pool.query.mock.calls.some(([sql]) => sql.includes('COUNT(*)'))).toBe(false);
    });
  });

  describe('PUT /api/admin/usuarios/:id', () => {
    test('sube de "cliente" a "ventas" en la cuota exacta: 400 CUOTA_USUARIOS_EXCEDIDA', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ max_usuarios: 2 })]]);
      pool.query
        .mockResolvedValueOnce([[{ id: 5, rfc: 'CLIENTE1', perfil: 'cliente' }]]) // SELECT * usuario actual
        .mockResolvedValueOnce([[{ total: 2 }]]); // COUNT(*) ya en el tope

      const res = await request(app)
        .put('/api/admin/usuarios/5')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send({ perfil: 'ventas', rfc: 'CLIENTE1', telefono: '', email: 'cliente1@norte.com' });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('CUOTA_USUARIOS_EXCEDIDA');
    });

    test('editar una cuenta que YA era "ventas" (sin cambiar de categoría) no vuelve a contar contra la cuota', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ max_usuarios: 1 })]]);
      pool.query
        .mockResolvedValueOnce([[{ id: 5, rfc: 'VENTAS1', perfil: 'ventas' }]]) // ya era ventas
        .mockResolvedValueOnce([[]]) // unicidad de rfc
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE — sin pasar por el COUNT(*)

      const res = await request(app)
        .put('/api/admin/usuarios/5')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send({ perfil: 'ventas', rfc: 'VENTAS1', telefono: '', email: 'ventas1@norte.com' });

      expect(res.status).toBe(200);
    });
  });
});
