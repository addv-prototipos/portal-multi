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

// Mismo criterio que preferenciasDashboard.test.js/resumenFinanciero.test.js:
// perfil concreto salta directo a la 3ra capa de requireAdminAuth con una
// sola consulta.
function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

function mockConfigGlobalYOperadores({ totalOperadores = 3 } = {}) {
  // GET /api/admin/mi-cuenta arma "empresa" con getConfiguracionGlobal()
  // (1 query) + el conteo de operadores (1 query) — en ese orden.
  pool.query.mockResolvedValueOnce([[]]); // sin fila en `configuracion` -> DEFAULTS
  pool.query.mockResolvedValueOnce([[{ total_operadores: totalOperadores }]]);
}

describe('Admin: Mi Cuenta (autoservicio de la sesión actual)', () => {
  afterEach(() => {
    pool.query.mockReset();
    pool.getConnection.mockReset();
    invalidarCacheTenant();
  });

  test('sin credenciales responde 401 (GET/PUT/PUT password)', async () => {
    const resGet = await request(app).get('/api/admin/mi-cuenta');
    expect(resGet.status).toBe(401);
    const resPut = await request(app).put('/api/admin/mi-cuenta').send({ email: 'a@a.com' });
    expect(resPut.status).toBe(401);
    const resPass = await request(app)
      .put('/api/admin/mi-cuenta/password')
      .send({ password_actual: 'x', password_nueva: 'y' });
    expect(resPass.status).toBe(401);
  });

  test('GET con perfil "administrador" (perfil_bd) devuelve datos propios editables + bloque empresa', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[{ nombre: 'Ana Torres', telefono: '5512345678', email: 'ana@empresa.mx' }]]);
    mockConfigGlobalYOperadores({ totalOperadores: 4 });

    const res = await request(app).get('/api/admin/mi-cuenta').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.editable).toBe(true);
    expect(res.body.datos).toEqual({ nombre: 'Ana Torres', telefono: '5512345678', email: 'ana@empresa.mx' });
    expect(res.body.empresa).toBeDefined();
    expect(res.body.empresa.totalOperadores).toBe(4);
  });

  test('GET con perfil "fiscal" (perfil_bd) devuelve datos propios SIN bloque empresa', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
    pool.query.mockResolvedValueOnce([[{ nombre: '', telefono: '5500000000', email: 'fiscal1@empresa.mx' }]]);

    const res = await request(app).get('/api/admin/mi-cuenta').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.editable).toBe(true);
    expect(res.body.empresa).toBeUndefined();
  });

  // Punto 418: "Datos de pago" (Stripe) en Mi Cuenta pasó de "cualquier
  // administrador/super" a "solo la cuenta raíz/maestra" — admin_users
  // (super real, sin fila en usuarios) conserva acceso total por diseño.
  describe('"Datos de pago" solo para la cuenta raíz/maestra (punto 418)', () => {
    function mockPlanYSuscripcion(poolControl, { stripeCustomerId = 'cus_123', precioMensual = 1490, precioAnual = 14900 } = {}) {
      poolControl.query.mockResolvedValueOnce([
        [{
          plan_id: 1, plan_nombre: 'Pro', precio_mensual: precioMensual, precio_anual: precioAnual,
          suscripcion_estatus: 'pagada', suscripcion_ciclo: 'mensual', suscripcion_expira_en: '2026-12-01',
          contacto_email: null, stripe_customer_id: stripeCustomerId,
        }],
      ]);
    }

    let poolControl;
    beforeEach(() => {
      poolControl = { query: jest.fn() };
      obtenerPoolControl.mockReturnValue(poolControl);
    });

    test('administrador SIN la marca de raíz: no recibe datosPago', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]); // resolverTenantMiddleware
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ nombre: 'Ana', telefono: '', email: 'ana@norte.mx', es_cuenta_raiz: 0 }]]);
      mockConfigGlobalYOperadores({ totalOperadores: 1 });
      pool.query.mockResolvedValueOnce([[{ totalMaster: 1 }]]); // COUNT totalMaster
      mockPlanYSuscripcion(poolControl);

      const res = await request(app).get('/api/admin/mi-cuenta').set('X-Tenant-Slug', 'norte').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.empresa.datosPago).toBeUndefined();
    });

    test('administrador marcado como raíz/maestra: sí recibe datosPago', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ nombre: 'Ana', telefono: '', email: 'ana@norte.mx', es_cuenta_raiz: 1 }]]);
      mockConfigGlobalYOperadores({ totalOperadores: 1 });
      pool.query.mockResolvedValueOnce([[{ totalMaster: 1 }]]);
      mockPlanYSuscripcion(poolControl, { stripeCustomerId: 'cus_raiz' });

      const res = await request(app).get('/api/admin/mi-cuenta').set('X-Tenant-Slug', 'norte').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.empresa.datosPago).toEqual({ stripeCustomerId: 'cus_raiz' });
    });

    test('ADMIN_USERS (super real): siempre recibe datosPago, sin importar ninguna fila', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
      mockConfigGlobalYOperadores({ totalOperadores: 1 });
      pool.query.mockResolvedValueOnce([[{ totalMaster: 1 }]]);
      mockPlanYSuscripcion(poolControl, { stripeCustomerId: 'cus_super' });

      const res = await request(app).get('/api/admin/mi-cuenta').set('X-Tenant-Slug', 'norte').auth('admin', 'admin');

      expect(res.status).toBe(200);
      expect(res.body.empresa.datosPago).toEqual({ stripeCustomerId: 'cus_super' });
    });

    // Punto 418 (Deck A2): el panel "Actualizar método de pago" muestra el
    // precio REAL del plan (nunca un monto inventado) — expuesto junto al
    // resto de empresa.suscripcion sin importar si hay o no datosPago.
    test('empresa.suscripcion expone precioMensual/precioAnual reales del plan', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ nombre: 'Ana', telefono: '', email: 'ana@norte.mx', es_cuenta_raiz: 0 }]]);
      mockConfigGlobalYOperadores({ totalOperadores: 1 });
      pool.query.mockResolvedValueOnce([[{ totalMaster: 1 }]]);
      mockPlanYSuscripcion(poolControl, { precioMensual: 1490, precioAnual: 14900 });

      const res = await request(app).get('/api/admin/mi-cuenta').set('X-Tenant-Slug', 'norte').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.empresa.suscripcion.precioMensual).toBe(1490);
      expect(res.body.empresa.suscripcion.precioAnual).toBe(14900);
    });

    test('plan sin precio configurado (NULL en BD): precioMensual/precioAnual quedan null, nunca inventados', async () => {
      poolControl.query.mockResolvedValueOnce([[tenantFila()]]);
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ nombre: 'Ana', telefono: '', email: 'ana@norte.mx', es_cuenta_raiz: 0 }]]);
      mockConfigGlobalYOperadores({ totalOperadores: 1 });
      pool.query.mockResolvedValueOnce([[{ totalMaster: 1 }]]);
      mockPlanYSuscripcion(poolControl, { precioMensual: null, precioAnual: null });

      const res = await request(app).get('/api/admin/mi-cuenta').set('X-Tenant-Slug', 'norte').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.empresa.suscripcion.precioMensual).toBeNull();
      expect(res.body.empresa.suscripcion.precioAnual).toBeNull();
    });
  });

  test('GET con ADMIN_USERS (perfil "super", sin fila en usuarios) no es editable pero sí ve empresa', async () => {
    mockConfigGlobalYOperadores({ totalOperadores: 2 });

    const res = await request(app).get('/api/admin/mi-cuenta').auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.mecanismo).toBe('admin_users');
    expect(res.body.editable).toBe(false);
    expect(res.body.datos).toBeNull();
    expect(res.body.empresa.totalOperadores).toBe(2);
  });

  test('PUT /mi-cuenta con ADMIN_USERS (sin fila real) responde 403', async () => {
    const res = await request(app)
      .put('/api/admin/mi-cuenta')
      .auth('admin', 'admin')
      .send({ nombre: 'X', telefono: '', email: 'x@x.com' });
    expect(res.status).toBe(403);
  });

  test('PUT /mi-cuenta actualiza nombre/teléfono/correo de la propia fila', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .put('/api/admin/mi-cuenta')
      .auth(usuario, password)
      .send({ nombre: 'Ana Torres', telefono: '5512345678', email: 'ana@empresa.mx' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const llamadaUpdate = pool.query.mock.calls.find(([sql]) => sql.includes('UPDATE usuarios SET nombre'));
    expect(llamadaUpdate).toBeDefined();
    expect(llamadaUpdate[1]).toEqual(['Ana Torres', '5512345678', 'ana@empresa.mx', expect.any(Date), usuario]);
  });

  test('PUT /mi-cuenta sin correo válido responde 400', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    const res = await request(app)
      .put('/api/admin/mi-cuenta')
      .auth(usuario, password)
      .send({ nombre: 'Ana', telefono: '', email: 'no-es-correo' });
    expect(res.status).toBe(400);
  });

  test('PUT /mi-cuenta/password con ADMIN_USERS responde 403', async () => {
    const res = await request(app)
      .put('/api/admin/mi-cuenta/password')
      .auth('admin', 'admin')
      .send({ password_actual: 'admin', password_nueva: 'ClaveNueva9' });
    expect(res.status).toBe(403);
  });

  test('PUT /mi-cuenta/password con la contraseña actual incorrecta responde 400', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[{ password_hash: hashPassword('OtraClave9') }]]);

    const res = await request(app)
      .put('/api/admin/mi-cuenta/password')
      .auth(usuario, password)
      .send({ password_actual: 'ClaveIncorrecta9', password_nueva: 'ClaveNueva9' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/actual/i);
  });

  test('PUT /mi-cuenta/password con datos correctos actualiza el hash', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[{ password_hash: hashPassword(password) }]]);
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .put('/api/admin/mi-cuenta/password')
      .auth(usuario, password)
      .send({ password_actual: password, password_nueva: 'ClaveNueva9' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const llamadaUpdate = pool.query.mock.calls.find(([sql]) => sql.includes('UPDATE usuarios SET password_hash'));
    expect(llamadaUpdate).toBeDefined();
  });

  test('PUT /mi-cuenta/password con nueva contraseña débil responde 400', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[{ password_hash: hashPassword(password) }]]);

    const res = await request(app)
      .put('/api/admin/mi-cuenta/password')
      .auth(usuario, password)
      .send({ password_actual: password, password_nueva: 'debil' });

    expect(res.status).toBe(400);
  });
});
