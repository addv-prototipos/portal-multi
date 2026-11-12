const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}), verify: jest.fn().mockResolvedValue(true) })),
}));

const { pool } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const app = require('../../server');

// Mismo criterio que admin.test.js: nombre de usuario distinto de "admin"
// para saltar directo a la capa de perfil_bd (una sola consulta real a
// pool.query para requireAdminAuth).
function mockUsuarioAdministrativo({ usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil: 'administrador' }]]);
  return { usuario, password };
}

function mockEsCuentaRaiz(esRaiz) {
  pool.query.mockResolvedValueOnce([[{ es_cuenta_raiz: esRaiz ? 1 : 0 }]]);
}

function mockFetchRespuestas(respuestas) {
  let llamada = 0;
  global.fetch = jest.fn(() => {
    const r = respuestas[llamada] || respuestas[respuestas.length - 1];
    llamada += 1;
    return Promise.resolve({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: () => Promise.resolve(r.body),
    });
  });
  return global.fetch;
}

describe('Términos y Condiciones — nombre real + evidencia de aceptación (punto en curso)', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;
  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });
  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });
  afterEach(() => {
    pool.query.mockReset();
    delete global.fetch;
  });

  describe('GET /api/admin/terminos/pendiente', () => {
    test('cuenta raíz sin nombre capturado: incluye nombreFaltante=true y nombreActual=null', async () => {
      const { usuario, password } = mockUsuarioAdministrativo();
      mockEsCuentaRaiz(true);
      mockFetchRespuestas([
        { status: 200, body: { ok: true, pendiente: true, version: { id: 7, version: '2.1', contenido: '<p>...</p>' } } },
      ]);
      pool.query.mockResolvedValueOnce([[{ nombre: null }]]); // SELECT nombre FROM usuarios

      const res = await request(app).get('/api/admin/terminos/pendiente').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.pendiente).toBe(true);
      expect(res.body.nombreFaltante).toBe(true);
      expect(res.body.nombreActual).toBeNull();
      expect(res.body.nombreEmpresa).toBe('ADDV'); // MARCA_DEFECTO, sin tenant en este caso
    });

    test('cuenta raíz CON nombre ya capturado: nombreFaltante=false', async () => {
      const { usuario, password } = mockUsuarioAdministrativo();
      mockEsCuentaRaiz(true);
      mockFetchRespuestas([
        { status: 200, body: { ok: true, pendiente: true, version: { id: 7, version: '2.1', contenido: '<p>...</p>' } } },
      ]);
      pool.query.mockResolvedValueOnce([[{ nombre: 'María Fernanda Torres López' }]]);

      const res = await request(app).get('/api/admin/terminos/pendiente').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.nombreFaltante).toBe(false);
      expect(res.body.nombreActual).toBe('María Fernanda Torres López');
    });

    test('no es cuenta raíz: nunca llega a preguntar nombre (pendiente:false de entrada)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo();
      mockEsCuentaRaiz(false);

      const res = await request(app).get('/api/admin/terminos/pendiente').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ pendiente: false, version: null });
    });
  });

  describe('POST /api/admin/terminos/aceptar', () => {
    test('sin nombre capturado y sin mandar nombreCompleto: 400, nunca registra la aceptación', async () => {
      const { usuario, password } = mockUsuarioAdministrativo();
      mockEsCuentaRaiz(true);
      const fetchMock = mockFetchRespuestas([
        { status: 200, body: { ok: true, pendiente: true, version: { id: 7 } } },
      ]);
      pool.query.mockResolvedValueOnce([[{ nombre: null, email: 'admin@tienda.mx' }]]); // SELECT nombre, email

      const res = await request(app).post('/api/admin/terminos/aceptar').auth(usuario, password).send({});

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('nombre_faltante');
      expect(fetchMock).toHaveBeenCalledTimes(1); // solo el /internal/terminos/estado, nunca /aceptar
    });

    test('sin nombre capturado pero mandando nombreCompleto: lo guarda en usuarios y lo manda como snapshot', async () => {
      const { usuario, password } = mockUsuarioAdministrativo();
      mockEsCuentaRaiz(true);
      const fetchMock = mockFetchRespuestas([
        { status: 200, body: { ok: true, pendiente: true, version: { id: 7 } } },
        { status: 200, body: { ok: true } },
      ]);
      pool.query.mockResolvedValueOnce([[{ nombre: null, email: 'admin@tienda.mx' }]]); // SELECT nombre, email
      pool.query.mockResolvedValueOnce([{}]); // UPDATE usuarios SET nombre

      const res = await request(app)
        .post('/api/admin/terminos/aceptar')
        .auth(usuario, password)
        .send({ nombreCompleto: 'María Fernanda Torres López' });

      expect(res.status).toBe(200);
      expect(pool.query.mock.calls[3][0]).toMatch(/UPDATE usuarios SET nombre/);
      expect(pool.query.mock.calls[3][1]).toEqual(['María Fernanda Torres López', expect.any(Date), usuario]);

      const [, segundaLlamada] = fetchMock.mock.calls;
      const bodyAceptar = JSON.parse(segundaLlamada[1].body);
      expect(bodyAceptar).toMatchObject({
        usuario,
        versionId: 7,
        nombreCompleto: 'María Fernanda Torres López',
        email: 'admin@tienda.mx',
      });
    });

    test('con nombre YA capturado: usa el existente, nunca hace UPDATE', async () => {
      const { usuario, password } = mockUsuarioAdministrativo();
      mockEsCuentaRaiz(true);
      const fetchMock = mockFetchRespuestas([
        { status: 200, body: { ok: true, pendiente: true, version: { id: 9 } } },
        { status: 200, body: { ok: true } },
      ]);
      pool.query.mockResolvedValueOnce([[{ nombre: 'Jorge Ruiz Campos', email: 'jorge@tienda.mx' }]]);

      const res = await request(app).post('/api/admin/terminos/aceptar').auth(usuario, password).send({});

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledTimes(3); // auth + es_cuenta_raiz + SELECT nombre,email — sin UPDATE
      const [, segundaLlamada] = fetchMock.mock.calls;
      const bodyAceptar = JSON.parse(segundaLlamada[1].body);
      expect(bodyAceptar).toMatchObject({
        nombreCompleto: 'Jorge Ruiz Campos',
        email: 'jorge@tienda.mx',
      });
    });

    test('no es cuenta raíz: 403, nunca llega a tocar BD de nombre ni a llamar control', async () => {
      const { usuario, password } = mockUsuarioAdministrativo();
      mockEsCuentaRaiz(false);

      const res = await request(app).post('/api/admin/terminos/aceptar').auth(usuario, password).send({});

      expect(res.status).toBe(403);
    });
  });
});
