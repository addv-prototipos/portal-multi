// Campana de notificaciones del portal de cliente (punto en curso):
// GET /api/notificaciones (cliente, requireUserAuth) une "promoción"
// (broadcast) y "pago registrado" (dirigida) en un solo listado; POST/GET
// /api/admin/promociones (administrador/super) compone y lista el
// historial de promociones enviadas. Mismo patrón de mocking que
// gatingFacturacion.test.js/reportesEstadoTickets.test.js — X-Tenant-Slug
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
const { hashPassword, crearTokenSesion } = require('../../utils/authUsuario');
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
    cxc_habilitado: 1,
    promociones_habilitado: 1,
    ...extra,
  };
}

function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('Campana de notificaciones del cliente', () => {
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

  describe('GET /api/notificaciones', () => {
    test('sin sesión responde 401', async () => {
      const res = await request(app).get('/api/notificaciones');
      expect(res.status).toBe(401);
    });

    test('tenant con CxC Y Promociones apagados: 404 (nunca 403, mismo criterio anti-enumeración)', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ cxc_habilitado: 0, promociones_habilitado: 0 })]]);
      const res = await request(app)
        .get('/api/notificaciones')
        .set('X-Tenant-Slug', 'norte')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC', 'norte')}`);
      expect(res.status).toBe(404);
    });

    test('tenant con solo CxC activo (Promociones apagado): 200, responde con lo que haya', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ cxc_habilitado: 1, promociones_habilitado: 0 })]]);
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app)
        .get('/api/notificaciones')
        .set('X-Tenant-Slug', 'norte')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC', 'norte')}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ notificaciones: [] });
    });

    test('trae las propias (rfc) y las de broadcast (rfc NULL), en el formato esperado', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
      pool.query.mockResolvedValueOnce([
        [
          { id: 2, rfc: null, tipo: 'promocion', titulo: '15% de descuento', mensaje: 'Todo octubre', orden_id: null, creado_en: '2026-10-07 09:00:00' },
          { id: 1, rfc: 'GOMJ800101ABC', tipo: 'pago_registrado', titulo: 'Pago registrado', mensaje: 'Tu pago de $500.00 sobre la venta OC-000007 ya quedó registrado.', orden_id: 7, creado_en: '2026-10-08 10:00:00' },
        ],
      ]);
      const res = await request(app)
        .get('/api/notificaciones')
        .set('X-Tenant-Slug', 'norte')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC', 'norte')}`);

      expect(res.status).toBe(200);
      expect(res.body.notificaciones).toHaveLength(2);
      expect(res.body.notificaciones[1]).toEqual({
        id: 1,
        tipo: 'pago_registrado',
        titulo: 'Pago registrado',
        mensaje: 'Tu pago de $500.00 sobre la venta OC-000007 ya quedó registrado.',
        ordenId: 7,
        creadoEn: '2026-10-08 10:00:00',
      });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE \(rfc = \? OR rfc IS NULL\)/),
        ['GOMJ800101ABC']
      );
    });

    test('sitio base (sin X-Tenant-Slug): el candado es no-op, responde 200', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app)
        .get('/api/notificaciones')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ notificaciones: [] });
    });
  });

  describe('POST /api/admin/promociones', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).post('/api/admin/promociones').send({ titulo: 'x', mensaje: 'y' });
      expect(res.status).toBe(401);
    });

    test('perfil "ventas" no tiene acceso (403) — solo administrador/super', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas');
      const res = await request(app)
        .post('/api/admin/promociones')
        .auth(usuario, password)
        .send({ titulo: 'x', mensaje: 'y' });
      expect(res.status).toBe(403);
    });

    test('tenant con Promociones apagado: 404', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila({ promociones_habilitado: 0 })]]);
      const res = await request(app)
        .post('/api/admin/promociones')
        .set('X-Tenant-Slug', 'norte')
        .auth('admin', 'admin')
        .send({ titulo: 'x', mensaje: 'y' });
      expect(res.status).toBe(404);
    });

    test('sin título responde 400 sin tocar la base de datos', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/promociones')
        .auth(usuario, password)
        .send({ titulo: '', mensaje: 'Descuento de octubre' });
      expect(res.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(1); // solo el lookup de auth
    });

    test('sin mensaje responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/promociones')
        .auth(usuario, password)
        .send({ titulo: 'Promo', mensaje: '' });
      expect(res.status).toBe(400);
    });

    test('perfil "administrador" crea la promoción con rfc NULL (broadcast), sin vigencia', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (zona_horaria)
      pool.query.mockResolvedValueOnce([{ insertId: 5 }]); // INSERT

      const res = await request(app)
        .post('/api/admin/promociones')
        .auth(usuario, password)
        .send({ titulo: '15% de descuento', mensaje: 'Todo octubre' });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(pool.query).toHaveBeenNthCalledWith(
        3,
        'INSERT INTO notificaciones_cliente (rfc, tipo, titulo, mensaje, orden_id, vigencia_hasta, creado_por, creado_en) VALUES (NULL, ?, ?, ?, NULL, ?, ?, ?)',
        ['promocion', '15% de descuento', 'Todo octubre', null, usuario, expect.any(Date)]
      );
    });

    test('con vigencia futura: guarda vigencia_hasta como el instante exclusivo del día siguiente', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ zona_horaria: 'America/Mexico_City' }) }]]); // getConfiguracionGlobal
      pool.query.mockResolvedValueOnce([{ insertId: 6 }]); // INSERT

      const res = await request(app)
        .post('/api/admin/promociones')
        .auth(usuario, password)
        .send({ titulo: 'Promo con vigencia', mensaje: 'Válida unos días', vigenciaHasta: '2099-12-31' });

      expect(res.status).toBe(201);
      const paramsInsert = pool.query.mock.calls[2][1];
      const vigenciaGuardada = paramsInsert[3];
      expect(vigenciaGuardada).toBeInstanceOf(Date);
      // Medianoche local (México, UTC-6) del 1 de enero de 2100 = 06:00 UTC.
      expect(vigenciaGuardada.toISOString()).toBe('2100-01-01T06:00:00.000Z');
    });

    test('con vigencia en el pasado: 400, sin llegar al INSERT', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal

      const res = await request(app)
        .post('/api/admin/promociones')
        .auth(usuario, password)
        .send({ titulo: 'Promo vieja', mensaje: 'x', vigenciaHasta: '2020-01-01' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/anterior a hoy/);
      expect(pool.query).toHaveBeenCalledTimes(2); // auth + getConfiguracionGlobal, nunca el INSERT
    });

    test('vigencia con formato inválido: 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal

      const res = await request(app)
        .post('/api/admin/promociones')
        .auth(usuario, password)
        .send({ titulo: 'Promo', mensaje: 'x', vigenciaHasta: '31/12/2099' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/admin/promociones/:id/archivar', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).put('/api/admin/promociones/5/archivar');
      expect(res.status).toBe(401);
    });

    test('perfil "administrador" archiva correctamente', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

      const res = await request(app).put('/api/admin/promociones/5/archivar').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/UPDATE notificaciones_cliente SET archivada_en/),
        [expect.any(Date), 5]
      );
    });

    test('ya estaba archivada (o no existe): 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const res = await request(app).put('/api/admin/promociones/5/archivar').auth(usuario, password);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/admin/promociones/:id/relanzar', () => {
    test('promoción inexistente: 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // SELECT ... no existe

      const res = await request(app).put('/api/admin/promociones/999/relanzar').auth(usuario, password);
      expect(res.status).toBe(404);
    });

    test('reactiva sin vigencia por default: limpia archivada_en, vigencia_hasta NULL, actualiza creado_en', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 5 }]]); // SELECT existe
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

      const res = await request(app).put('/api/admin/promociones/5/relanzar').auth(usuario, password).send({});

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenNthCalledWith(
        4,
        'UPDATE notificaciones_cliente SET archivada_en = NULL, vigencia_hasta = ?, creado_en = ? WHERE id = ?',
        [null, expect.any(Date), 5]
      );
    });
  });

  describe('DELETE /api/admin/promociones/:id', () => {
    test('perfil "ventas" no tiene acceso (403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas');
      const res = await request(app).delete('/api/admin/promociones/5').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('perfil "administrador" elimina correctamente', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app).delete('/api/admin/promociones/5').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringMatching(/DELETE FROM notificaciones_cliente/), [5]);
    });

    test('no encontrada: 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
      const res = await request(app).delete('/api/admin/promociones/5').auth(usuario, password);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/promociones', () => {
    test('perfil "fiscal" no tiene acceso (403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app).get('/api/admin/promociones').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('perfil "administrador" lista el historial', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 2, titulo: '15% de descuento', mensaje: 'Todo octubre', vigencia_hasta: null, archivada_en: null, creado_en: '2026-10-08 10:00:00' }],
      ]);
      const res = await request(app).get('/api/admin/promociones').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.promociones).toEqual([
        { id: 2, titulo: '15% de descuento', mensaje: 'Todo octubre', vigenciaHasta: null, creadoEn: '2026-10-08 10:00:00', estado: 'activa' },
      ]);
    });

    test('calcula estado "vencida"/"archivada" — archivada_en gana sobre vigencia_hasta', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [
          { id: 1, titulo: 'Vigente', mensaje: 'x', vigencia_hasta: '2099-01-01 06:00:00', archivada_en: null, creado_en: '2026-10-01 10:00:00' },
          { id: 2, titulo: 'Vencida', mensaje: 'x', vigencia_hasta: '2020-01-01 06:00:00', archivada_en: null, creado_en: '2019-12-01 10:00:00' },
          { id: 3, titulo: 'Archivada a mano antes de vencer', mensaje: 'x', vigencia_hasta: '2099-01-01 06:00:00', archivada_en: '2026-10-05 10:00:00', creado_en: '2026-10-01 10:00:00' },
        ],
      ]);
      const res = await request(app).get('/api/admin/promociones').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.promociones.map((p) => p.estado)).toEqual(['activa', 'vencida', 'archivada']);
    });
  });
});
