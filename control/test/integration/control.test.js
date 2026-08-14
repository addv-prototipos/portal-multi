// Pruebas de integración de /api/control/* — servicio propio (segmento
// 9b, ver PROJECT_STATE.md). Mismo patrón supertest que
// backend/test/integration/control.test.js (versión anterior, antes de
// separarse). A diferencia de esa versión: sin mecanismo perfil_bd (no
// hay pool tenant-aware aquí), así que no hay casos de perfil
// fiscal/administrador — solo ADMIN_USERS.

const request = require('supertest');

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/notificarBackend', () => ({
  notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
}));

const { obtenerPool } = require('../../db');
const { notificarInvalidacionCache } = require('../../utils/notificarBackend');
const app = require('../../server');

const TENANT_FILA = {
  id: 7,
  slug: 'cliente1',
  nombre_empresa: 'Empresa Uno',
  estado: 'activo',
  contacto_email: 'contacto@empresauno.com',
  creado_en: '2026-01-01 00:00:00',
  activado_en: null,
  suspendido_en: null,
  baja_en: null,
};

describe('Control standalone (/api/control)', () => {
  let pool;

  beforeEach(() => {
    pool = { query: jest.fn() };
    obtenerPool.mockReturnValue(pool);
    notificarInvalidacionCache.mockClear();
  });

  describe('GET /api/control/tenants', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).get('/api/control/tenants');
      expect(res.status).toBe(401);
    });

    test('usuario que no está en ADMIN_USERS responde 401', async () => {
      const res = await request(app).get('/api/control/tenants').auth('quien-sea', 'loquesea');
      expect(res.status).toBe(401);
    });

    test('admin:admin (ADMIN_USERS por defecto) sí tiene acceso y lista los tenants', async () => {
      pool.query.mockResolvedValueOnce([[TENANT_FILA]]);
      const res = await request(app).get('/api/control/tenants').auth('admin', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.tenants).toEqual([TENANT_FILA]);
    });
  });

  describe('POST /api/control/tenants/:slug/suspender', () => {
    test('200, estado "suspendido", y notifica al backend para invalidar caché', async () => {
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'suspendido' }]]) // obtenerTenantPorSlug
        .mockResolvedValueOnce([{}]); // registrarEvento (INSERT)

      const res = await request(app).post('/api/control/tenants/cliente1/suspender').auth('admin', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.tenant.estado).toBe('suspendido');
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');
    });

    test('404 si el slug no existe', async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]).mockResolvedValueOnce([[]]);

      const res = await request(app).post('/api/control/tenants/fantasma/suspender').auth('admin', 'admin');

      expect(res.status).toBe(404);
    });

    test('409 si el tenant existe pero no está en estado "activo"', async () => {
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'baja' }]]);

      const res = await request(app).post('/api/control/tenants/cliente1/suspender').auth('admin', 'admin');

      expect(res.status).toBe(409);
    });

    test('401 sin credenciales válidas', async () => {
      const res = await request(app).post('/api/control/tenants/cliente1/suspender').auth('quien-sea', 'loquesea');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/control/tenants/:slug/reactivar', () => {
    test('200 desde estado "suspendido"', async () => {
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'activo' }]])
        .mockResolvedValueOnce([{}]);

      const res = await request(app).post('/api/control/tenants/cliente1/reactivar').auth('admin', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.tenant.estado).toBe('activo');
    });

    test('200 desde estado "baja" (mismo flujo, decisión ya confirmada)', async () => {
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'activo' }]])
        .mockResolvedValueOnce([{}]);

      const res = await request(app).post('/api/control/tenants/cliente1/reactivar').auth('admin', 'admin');

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/control/tenants/:slug/baja', () => {
    test('200 desde estado "activo"', async () => {
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'baja' }]])
        .mockResolvedValueOnce([{}]);

      const res = await request(app).post('/api/control/tenants/cliente1/baja').auth('admin', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.tenant.estado).toBe('baja');
    });

    test('409 si ya está en "baja"', async () => {
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'baja' }]]);

      const res = await request(app).post('/api/control/tenants/cliente1/baja').auth('admin', 'admin');

      expect(res.status).toBe(409);
    });
  });

  describe('PUT /api/control/tenants/:slug/marca (segmento marca)', () => {
    test('200 actualiza la marca y registra el evento', async () => {
      pool.query
        .mockResolvedValueOnce([[{ ...TENANT_FILA, marca: null, marca_logo_url: null }]]) // SELECT del tenant
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([[{ ...TENANT_FILA, marca: 'Marca Nueva', marca_logo_url: null }]]) // SELECT post-UPDATE
        .mockResolvedValueOnce([{}]); // registrarEvento

      const res = await request(app)
        .put('/api/control/tenants/cliente1/marca')
        .auth('admin', 'admin')
        .send({ marca: '  Marca Nueva  ' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.tenant.marca).toBe('Marca Nueva');
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');
    });

    test('400 con marca que supera 255 caracteres', async () => {
      pool.query.mockResolvedValueOnce([[{ ...TENANT_FILA, marca: null, marca_logo_url: null }]]);

      const res = await request(app)
        .put('/api/control/tenants/cliente1/marca')
        .auth('admin', 'admin')
        .send({ marca: 'x'.repeat(256) });

      expect(res.status).toBe(400);
    });

    test('404 si el slug no existe', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .put('/api/control/tenants/fantasma/marca')
        .auth('admin', 'admin')
        .send({ marca: 'X' });

      expect(res.status).toBe(404);
    });

    test('401 sin credenciales válidas', async () => {
      const res = await request(app).put('/api/control/tenants/cliente1/marca').send({ marca: 'X' });
      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/control/tenants (intake de empresa nueva, segmento 9c)', () => {
    test('201 con datos válidos, guarda la solicitud y registra el evento', async () => {
      pool.query
        .mockResolvedValueOnce([[]]) // SELECT de duplicado
        .mockResolvedValueOnce([{ insertId: 3 }]) // INSERT de la solicitud
        .mockResolvedValueOnce([{}]); // registrarEvento

      const res = await request(app)
        .post('/api/control/tenants')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'Empresa Nueva', slug: 'empresa-nueva' });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.tenant).toMatchObject({
        id: 3,
        slug: 'empresa-nueva',
        nombre_empresa: 'Empresa Nueva',
        estado: 'provisioning',
      });
    });

    test('400 con datos que no pasan la validación (slug reservado)', async () => {
      const res = await request(app)
        .post('/api/control/tenants')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'X', slug: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/reservada/);
      // La auditoría sí escribe (fire-and-forget), pero nunca se intenta
      // el INSERT de la solicitud — el SELECT de duplicado tampoco.
      const llamadas = pool.query.mock.calls.map((c) => c[0]);
      expect(llamadas.some((sql) => sql.includes('INSERT INTO tenants'))).toBe(false);
      expect(llamadas.some((sql) => sql.includes('SELECT id FROM tenants'))).toBe(false);
    });

    test('400 con dato fiscal inválido (RFC)', async () => {
      const res = await request(app)
        .post('/api/control/tenants')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'X', slug: 'empresa', rfcCompania: '!!!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/RFC/);
    });

    test('201 con marca y logo (base64), guarda la ruta pública del logo', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, url: '/api/marca-logo/empresa-nueva' }),
      });

      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 0)]);

      pool.query
        .mockResolvedValueOnce([[]]) // SELECT de duplicado
        .mockResolvedValueOnce([{ insertId: 3 }]) // INSERT de la solicitud
        .mockResolvedValueOnce([{}]); // registrarEvento

      const res = await request(app)
        .post('/api/control/tenants')
        .auth('admin', 'admin')
        .send({
          nombreEmpresa: 'Empresa Nueva',
          slug: 'empresa-nueva',
          marca: 'Marca Nueva',
          logoBase64: png.toString('base64'),
        });

      expect(res.status).toBe(201);
      expect(res.body.tenant.marca).toBe('Marca Nueva');
      expect(res.body.tenant.marca_logo_url).toBe('/api/marca-logo/empresa-nueva');
      // El logo se subió al backend interno antes de crear la fila
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toMatch(/\/internal\/marca-logo\/empresa-nueva$/);
      // La fila guardó la ruta devuelta por el backend
      expect(pool.query.mock.calls[1][1]).toContain('/api/marca-logo/empresa-nueva');

      delete global.fetch;
    });

    test('400 con logo que excede el tamaño máximo', async () => {
      // 2.5 MB binarios: excede MAX_MARCA_LOGO_MB=2 pero su base64 (~3.3 MB)
      // cabe en el límite de 4mb de express.json (3 MB exactos darían 413
      // del parser antes de llegar a la validación propia).
      const pngGrande = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(2.5 * 1024 * 1024),
      ]);

      const res = await request(app)
        .post('/api/control/tenants')
        .auth('admin', 'admin')
        .send({
          nombreEmpresa: 'X',
          slug: 'empresa',
          logoBase64: pngGrande.toString('base64'),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/excede el tamaño máximo/);
    });

    test('400 con logo que no es una imagen real', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'El archivo del logo no es una imagen válida (JPG, PNG o WEBP).' }),
      });

      const res = await request(app)
        .post('/api/control/tenants')
        .auth('admin', 'admin')
        .send({
          nombreEmpresa: 'X',
          slug: 'empresa',
          logoBase64: Buffer.from('no-soy-imagen').toString('base64'),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no es una imagen/);

      delete global.fetch;
    });

    test('409 si el slug ya está registrado', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 9 }]]);

      const res = await request(app)
        .post('/api/control/tenants')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'X', slug: 'cliente1' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/ya está registrado/);
    });

    test('401 sin credenciales válidas', async () => {
      const res = await request(app)
        .post('/api/control/tenants')
        .send({ nombreEmpresa: 'X', slug: 'empresa' });

      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('GET /health', () => {
    test('200 cuando la BD responde', async () => {
      pool.query.mockResolvedValueOnce([[{ '1': 1 }]]);
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });

    test('503 cuando la BD falla', async () => {
      pool.query.mockRejectedValueOnce(new Error('conexión perdida'));
      const res = await request(app).get('/health');
      expect(res.status).toBe(503);
    });
  });
});
