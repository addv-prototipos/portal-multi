const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

const { pool } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const app = require('../../server');

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
