const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

const { pool } = require('../../db');
const { hashPassword, crearTokenSesion } = require('../../utils/authUsuario');
const app = require('../../server');

const RFC_VALIDO = 'GOMJ800101ABC';
const PASSWORD_VALIDA = 'Abcdefg1';

function cookieDeSesion(rfc = RFC_VALIDO) {
  return `sesion_usuario=${crearTokenSesion(rfc)}`;
}

describe('Auth de usuario', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/registro', () => {
    test('registra correctamente con datos válidos y establece cookie de sesión', async () => {
      pool.query.mockResolvedValueOnce([[]]); // sin RFC existente
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]); // INSERT

      const res = await request(app).post('/api/auth/registro').send({
        rfc: RFC_VALIDO,
        email: 'cliente@example.com',
        telefono: '5512345678',
        password: PASSWORD_VALIDA,
      });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.rfc).toBe(RFC_VALIDO);
      expect(res.headers['set-cookie'][0]).toMatch(/^sesion_usuario=/);
    });

    test('rechaza RFC inválido sin tocar la base de datos', async () => {
      const res = await request(app).post('/api/auth/registro').send({
        rfc: '123',
        email: 'cliente@example.com',
        telefono: '5512345678',
        password: PASSWORD_VALIDA,
      });

      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('rechaza correo inválido', async () => {
      const res = await request(app).post('/api/auth/registro').send({
        rfc: RFC_VALIDO,
        email: 'no-es-correo',
        telefono: '5512345678',
        password: PASSWORD_VALIDA,
      });
      expect(res.status).toBe(400);
    });

    test('rechaza teléfono inválido', async () => {
      const res = await request(app).post('/api/auth/registro').send({
        rfc: RFC_VALIDO,
        email: 'cliente@example.com',
        telefono: '123',
        password: PASSWORD_VALIDA,
      });
      expect(res.status).toBe(400);
    });

    test('rechaza contraseña que no cumple las reglas', async () => {
      const res = await request(app).post('/api/auth/registro').send({
        rfc: RFC_VALIDO,
        email: 'cliente@example.com',
        telefono: '5512345678',
        password: 'debil',
      });
      expect(res.status).toBe(400);
    });

    test('responde 409 si el RFC ya está registrado', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]);

      const res = await request(app).post('/api/auth/registro').send({
        rfc: RFC_VALIDO,
        email: 'cliente@example.com',
        telefono: '5512345678',
        password: PASSWORD_VALIDA,
      });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    test('responde 400 sin rfc o password', async () => {
      const res = await request(app).post('/api/auth/login').send({ rfc: RFC_VALIDO });
      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('responde 401 genérico si el RFC no existe (no revela si existe o no)', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).post('/api/auth/login').send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/RFC o contraseña incorrectos/);
    });

    test('responde 401 con password incorrecta', async () => {
      pool.query.mockResolvedValueOnce([
        [{ rfc: RFC_VALIDO, password_hash: hashPassword(PASSWORD_VALIDA), telefono: '5512345678', debe_cambiar_password: 0 }],
      ]);
      const res = await request(app).post('/api/auth/login').send({ rfc: RFC_VALIDO, password: 'OtraClave1' });
      expect(res.status).toBe(401);
    });

    test('login correcto establece cookie y expone debeCambiarPassword', async () => {
      pool.query.mockResolvedValueOnce([
        [{ rfc: RFC_VALIDO, password_hash: hashPassword(PASSWORD_VALIDA), telefono: '5512345678', debe_cambiar_password: 1 }],
      ]);
      const res = await request(app).post('/api/auth/login').send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.debeCambiarPassword).toBe(true);
      expect(res.headers['set-cookie'][0]).toMatch(/^sesion_usuario=/);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('limpia la cookie de sesión sin requerir autenticación', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(res.headers['set-cookie'][0]).toMatch(/^sesion_usuario=;/);
    });
  });

  describe('GET /api/auth/me', () => {
    test('sin cookie responde 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('con cookie válida devuelve el rfc y debeCambiarPassword convertido a booleano', async () => {
      pool.query.mockResolvedValueOnce([[{ debe_cambiar_password: 1 }]]);
      const res = await request(app).get('/api/auth/me').set('Cookie', cookieDeSesion());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ rfc: RFC_VALIDO, debeCambiarPassword: true });
    });

    test('con cookie inválida (manipulada) responde 401', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', 'sesion_usuario=token.invalido');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/auth/password', () => {
    test('sin sesión responde 401', async () => {
      const res = await request(app).put('/api/auth/password').send({ password: PASSWORD_VALIDA });
      expect(res.status).toBe(401);
    });

    test('con sesión pero contraseña débil responde 400', async () => {
      const res = await request(app).put('/api/auth/password').set('Cookie', cookieDeSesion()).send({ password: 'debil' });
      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('con sesión y contraseña válida, actualiza correctamente', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      const res = await request(app)
        .put('/api/auth/password')
        .set('Cookie', cookieDeSesion())
        .send({ password: 'NuevaClave9' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE usuarios'), expect.any(Array));
    });
  });
});
