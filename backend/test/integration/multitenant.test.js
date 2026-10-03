// Prueba end-to-end del segmento 3 del plan multi-tenant (ver
// PROJECT_STATE.md): el middleware de resolución de tenant + los cambios
// de authUsuario.js, ejercitados a través de rutas REALES con supertest —
// simulando, con el encabezado `X-Tenant-Slug` puesto a mano, lo que
// nginx hará automáticamente a partir del segmento 4. Sin ese encabezado,
// estas mismas rutas ya están cubiertas por test/integration/auth-usuario.test.js
// y deben seguir comportándose exactamente igual (primera prueba de este
// archivo).

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

const RFC_VALIDO = 'GOMJ800101ABC';
const PASSWORD_VALIDA = 'Abcdefg1';

function mockControlPool(filas) {
  const poolControl = { query: jest.fn().mockResolvedValue([filas]) };
  obtenerPoolControl.mockReturnValue(poolControl);
  return poolControl;
}

const TENANT_CLIENTE1 = {
  id: 1,
  slug: 'cliente1',
  nombre_empresa: 'Cliente Uno S.A.',
  estado: 'activo',
  db_host: 'mysql',
  db_name: 'tenant_cliente1',
  db_user: 'app',
};

const TENANT_CLIENTE2 = {
  id: 2,
  slug: 'cliente2',
  nombre_empresa: 'Cliente Dos S.A.',
  estado: 'activo',
  db_host: 'mysql',
  db_name: 'tenant_cliente2',
  db_user: 'app',
};

function usuarioFila(passwordPlano = PASSWORD_VALIDA) {
  return { rfc: RFC_VALIDO, password_hash: hashPassword(passwordPlano), telefono: '5512345678', debe_cambiar_password: 0 };
}

// NOTA: `../../db` está mockeado por completo en este archivo (igual que
// el resto de la suite de integración), así que el `pool` que usan las
// rutas de server.js es siempre el mismo objeto estático de arriba — el
// enrutamiento REAL a un pool distinto por tenant (AsyncLocalStorage +
// proxy) ya está probado a fondo contra el módulo real en
// test/unit/db-multitenant.test.js. Lo que este archivo prueba es la capa
// de encima: que el middleware de resolución de tenant y la sesión
// (firma/cookie por tenant) funcionan correctamente de punta a punta a
// través de rutas reales — por eso todas las respuestas de base de datos
// de las rutas se mockean sobre el `pool` compartido, no sobre un pool de
// tenant aparte.

describe('Multi-tenant (segmento 3) — resolución de tenant end-to-end', () => {
  afterEach(() => {
    jest.clearAllMocks();
    invalidarCacheTenant(); // estado de módulo compartido — no debe filtrarse entre pruebas
  });

  test('sin X-Tenant-Slug, el login se comporta exactamente como antes de este segmento', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });

    expect(res.status).toBe(401);
    expect(obtenerPoolControl).not.toHaveBeenCalled();
  });

  test('X-Tenant-Slug con un tenant inexistente responde 404 antes de llegar a la ruta', async () => {
    mockControlPool([]);

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', 'no-existe')
      .send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });

    expect(res.status).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('login bajo un tenant válido establece una cookie acotada a ese tenant (Path=/<slug>)', async () => {
    mockControlPool([TENANT_CLIENTE1]);
    pool.query.mockResolvedValueOnce([[usuarioFila()]]);

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', 'cliente1')
      .send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^sesion_usuario=/);
    expect(cookie).toMatch(/Path=\/cliente1/i);
  });

  test('una sesión iniciada bajo "cliente1" es rechazada (401) al usarla bajo "cliente2"', async () => {
    mockControlPool([TENANT_CLIENTE1]);
    pool.query.mockResolvedValueOnce([[usuarioFila()]]);

    const resLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', 'cliente1')
      .send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });
    const cookieValor = resLogin.headers['set-cookie'][0].split(';')[0];

    mockControlPool([TENANT_CLIENTE2]);

    const resMe = await request(app)
      .get('/api/auth/me')
      .set('X-Tenant-Slug', 'cliente2')
      .set('Cookie', cookieValor);

    expect(resMe.status).toBe(401);
  });

  test('la MISMA sesión sí es válida al volver a usarla bajo "cliente1" (no es un rechazo general, es específico al tenant)', async () => {
    mockControlPool([TENANT_CLIENTE1]);
    pool.query.mockResolvedValueOnce([[usuarioFila()]]);

    const resLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant-Slug', 'cliente1')
      .send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });
    const cookieValor = resLogin.headers['set-cookie'][0].split(';')[0];

    invalidarCacheTenant(); // fuerza a resolver "cliente1" de nuevo con el mock siguiente
    mockControlPool([TENANT_CLIENTE1]);
    pool.query.mockResolvedValueOnce([[{ debe_cambiar_password: 0 }]]);

    const resMe = await request(app)
      .get('/api/auth/me')
      .set('X-Tenant-Slug', 'cliente1')
      .set('Cookie', cookieValor);

    expect(resMe.status).toBe(200);
    expect(resMe.body.rfc).toBe(RFC_VALIDO);
  });

  test('el panel admin también incluye el slug en el realm de Basic Auth bajo un tenant resuelto', async () => {
    mockControlPool([TENANT_CLIENTE1]);

    const res = await request(app)
      .get('/api/admin/login')
      .set('X-Tenant-Slug', 'cliente1');

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Basic realm="Administracion-cliente1"');
  });

  // Punto 349-350-351 (Fase 5, ver stitch/gobierno-funcionalidades/
  // NOTAS.md): GET /api/admin/login expone las funciones del plan del
  // tenant para que el frontend oculte menú/tarjetas que el backend ya
  // bloquea — TENANT_CLIENTE1 no trae ninguna de las 15 columnas
  // *_habilitado* en la fila mockeada, así que todas caen a su default
  // (true, migración-segura) EXCEPTO sucursalesHabilitado, que por
  // diseño default a false cuando la columna está ausente (feature nueva
  // que nadie tenía antes — ver tenantContext.js).
  test('GET /api/admin/login con tenant resuelto expone "funciones" con los 15 flags del plan', async () => {
    mockControlPool([TENANT_CLIENTE1]);

    const res = await request(app)
      .get('/api/admin/login')
      .set('X-Tenant-Slug', 'cliente1')
      .auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.funciones).toEqual({
      facturacionHabilitada: true,
      portalClientesHabilitado: true,
      sucursalesHabilitado: false,
      marcaLookfeelHabilitado: true,
      ventasHabilitado: true,
      gastosHabilitado: true,
      inventariosHabilitado: true,
      auditoriaHabilitado: true,
      cxcHabilitado: true,
      resumenFinancieroHabilitado: true,
      reportesPorReporteHabilitado: true,
      reportesCortesHabilitado: true,
      reportesEliminadosHabilitado: true,
      reportesEstadoInventarioHabilitado: true,
      reportesEstadoTicketsHabilitado: true,
    });
  });

  test('GET /api/admin/login con tenant resuelto: facturacionHabilitada=0 se expone como false en "funciones"', async () => {
    mockControlPool([{ ...TENANT_CLIENTE1, facturacion_habilitada: 0, ventas_habilitado: 0 }]);

    const res = await request(app)
      .get('/api/admin/login')
      .set('X-Tenant-Slug', 'cliente1')
      .auth('admin', 'admin');

    expect(res.status).toBe(200);
    expect(res.body.funciones.facturacionHabilitada).toBe(false);
    expect(res.body.funciones.ventasHabilitado).toBe(false);
    expect(res.body.funciones.gastosHabilitado).toBe(true);
  });
});
