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

  describe('PUT /api/control/tenants/:slug (edición de empresa, segmento "edición")', () => {
    const FILA_COMPLETA = {
      ...TENANT_FILA,
      notas: null,
      rfc_compania: null,
      razon_social_compania: null,
      regimen_fiscal_compania: null,
      tipo_persona_compania: null,
      clave_sat: null,
      link_codigos_sat: null,
      correo_reportes: null,
      marca: null,
      marca_logo_url: null,
      db_name: 'tenant_cliente1',
      storage_prefix: 'cliente1',
    };

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    test('200 actualiza los datos editables y registra el evento', async () => {
      pool.query
        .mockResolvedValueOnce([[FILA_COMPLETA]]) // SELECT del tenant
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([[{ ...FILA_COMPLETA, nombre_empresa: 'Empresa Uno Nueva' }]]) // SELECT post-UPDATE
        .mockResolvedValueOnce([{}]); // registrarEvento

      const res = await request(app)
        .put('/api/control/tenants/cliente1')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'Empresa Uno Nueva', contactoEmail: 'contacto@uno.com', notas: 'nota' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.tenant.nombre_empresa).toBe('Empresa Uno Nueva');
      expect(global.fetch).not.toHaveBeenCalled(); // sin cambio de slug no hay migración
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');
    });

    test('200 con slug nuevo: delega la migración al backend y devuelve el tenant renombrado', async () => {
      pool.query
        .mockResolvedValueOnce([[FILA_COMPLETA]]) // SELECT del tenant
        .mockResolvedValueOnce([[]]) // SELECT de duplicados
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([[{ ...FILA_COMPLETA, slug: 'cliente2', storage_prefix: 'cliente2' }]]) // SELECT post-UPDATE
        .mockResolvedValueOnce([{}]); // registrarEvento
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, copiados: 0, borrados: 0, logoMovido: false }),
      });

      const res = await request(app)
        .put('/api/control/tenants/cliente1')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' });

      expect(res.status).toBe(200);
      expect(res.body.tenant.slug).toBe('cliente2');
      const [url] = global.fetch.mock.calls[0];
      expect(url).toMatch(/\/internal\/renombrar-slug$/);
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente2');
    });

    test('409 con slug nuevo que ya pertenece a otra empresa', async () => {
      pool.query
        .mockResolvedValueOnce([[FILA_COMPLETA]]) // SELECT del tenant
        .mockResolvedValueOnce([[{ id: 99 }]]); // SELECT de duplicados: ya existe

      const res = await request(app)
        .put('/api/control/tenants/cliente1')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' });

      expect(res.status).toBe(409);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('400 con datos inválidos (nombre vacío)', async () => {
      pool.query.mockResolvedValueOnce([[FILA_COMPLETA]]);

      const res = await request(app)
        .put('/api/control/tenants/cliente1')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: '  ' });

      expect(res.status).toBe(400);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('404 si el slug no existe', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .put('/api/control/tenants/fantasma')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'X' });

      expect(res.status).toBe(404);
    });

    test('502 si la migración falla en el backend', async () => {
      pool.query
        .mockResolvedValueOnce([[FILA_COMPLETA]]) // SELECT del tenant
        .mockResolvedValueOnce([[]]); // SELECT de duplicados
      global.fetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: 'No se pudo migrar el almacenamiento del tenant al slug nuevo.' }),
      });

      const res = await request(app)
        .put('/api/control/tenants/cliente1')
        .auth('admin', 'admin')
        .send({ nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' });

      expect(res.status).toBe(502);
    });

    test('401 sin credenciales válidas', async () => {
      const res = await request(app).put('/api/control/tenants/cliente1').send({ nombreEmpresa: 'X' });
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
        .send({ nombreEmpresa: 'Empresa Nueva', slug: 'empresa-nueva', contactoEmail: 'contacto@empresa-nueva.com' });

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
        .send({ nombreEmpresa: 'X', slug: 'empresa', contactoEmail: 'contacto@empresa.com', rfcCompania: '!!!' });

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
          contactoEmail: 'contacto@empresa-nueva.com',
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
        .send({ nombreEmpresa: 'X', slug: 'cliente1', contactoEmail: 'contacto@cliente1.com' });

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

  describe('Sucursales (§58): /api/control/grupos-sucursal', () => {
    test('401 sin credenciales', async () => {
      const res = await request(app).get('/api/control/grupos-sucursal');
      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('POST crea un grupo y responde 201', async () => {
      pool.query
        .mockResolvedValueOnce([{ insertId: 3 }]) // INSERT grupos_sucursal
        .mockResolvedValueOnce([[{ id: 3, nombre: 'Grupo Norte' }]]) // obtenerGrupoSucursal: SELECT grupo
        .mockResolvedValueOnce([[]]) // SELECT tenants del grupo
        .mockResolvedValueOnce([[]]); // SELECT usuarios del grupo

      const res = await request(app)
        .post('/api/control/grupos-sucursal')
        .auth('admin', 'admin')
        .send({ nombre: 'Grupo Norte' });

      expect(res.status).toBe(201);
      expect(res.body.grupo.id).toBe(3);
    });

    test('POST con nombre vacío responde 400', async () => {
      const res = await request(app)
        .post('/api/control/grupos-sucursal')
        .auth('admin', 'admin')
        .send({ nombre: '' });

      expect(res.status).toBe(400);
    });

    test('GET :id inexistente responde 404', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/control/grupos-sucursal/999').auth('admin', 'admin');
      expect(res.status).toBe(404);
    });

    test('GET lista grupos con sus tenants y conteo de usuarios', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 1, nombre: 'Grupo Norte' }]]) // SELECT grupos
        .mockResolvedValueOnce([[{ slug: 'norte', nombre_empresa: 'Norte SA', grupo_sucursal_id: 1 }]]) // tenants asociados
        .mockResolvedValueOnce([[{ grupo_sucursal_id: 1, total: 2 }]]); // conteo usuarios

      const res = await request(app).get('/api/control/grupos-sucursal').auth('admin', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.grupos[0].total_usuarios).toBe(2);
      expect(res.body.grupos[0].tenants).toEqual([{ slug: 'norte', nombre_empresa: 'Norte SA' }]);
    });

    test('POST usuarios con perfil inválido responde 400', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // el grupo existe
      const res = await request(app)
        .post('/api/control/grupos-sucursal/1/usuarios')
        .auth('admin', 'admin')
        .send({ usuario: 'gerente', password: 'Abcdefg1', perfil: 'cliente' });

      expect(res.status).toBe(400);
    });

    test('DELETE grupo inexistente responde 404', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).delete('/api/control/grupos-sucursal/999').auth('admin', 'admin');
      expect(res.status).toBe(404);
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
