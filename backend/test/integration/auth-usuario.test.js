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
      expect(res.body.error).toMatch(/RFC, correo o contraseña incorrectos/);
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
        [{ rfc: RFC_VALIDO, password_hash: hashPassword(PASSWORD_VALIDA), telefono: '5512345678', debe_cambiar_password: 1, activo: 1 }],
      ]);
      const res = await request(app).post('/api/auth/login').send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.debeCambiarPassword).toBe(true);
      expect(res.headers['set-cookie'][0]).toMatch(/^sesion_usuario=/);
    });

    test('cuenta suspendida (activo:0) con contraseña correcta responde 403 y no establece cookie', async () => {
      pool.query.mockResolvedValueOnce([
        [{ rfc: RFC_VALIDO, password_hash: hashPassword(PASSWORD_VALIDA), telefono: '5512345678', debe_cambiar_password: 0, activo: 0 }],
      ]);
      const res = await request(app).post('/api/auth/login').send({ rfc: RFC_VALIDO, password: PASSWORD_VALIDA });

      expect(res.status).toBe(403);
      expect(res.body.codigo).toBe('CUENTA_SUSPENDIDA');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    // Punto en curso (login RFC o correo) — el correo ya es obligatorio
    // para cualquier cliente desde su creación, sin excepción por tenant,
    // así que entrar con correo funciona para cualquier cuenta existente,
    // no solo cuando Facturación está apagada.
    test('login con correo (en vez de RFC) funciona igual, comparando OR contra ambas columnas', async () => {
      pool.query.mockResolvedValueOnce([
        [{ rfc: RFC_VALIDO, password_hash: hashPassword(PASSWORD_VALIDA), telefono: '5512345678', debe_cambiar_password: 0, activo: 1 }],
      ]);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ rfc: 'Cliente@Example.com', password: PASSWORD_VALIDA });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // La sesión se abre con el RFC real de la fila, nunca con el correo
      // tecleado — así folios/aclaraciones/header siguen viendo un RFC.
      expect(res.body.rfc).toBe(RFC_VALIDO);
      expect(res.headers['set-cookie'][0]).toMatch(/^sesion_usuario=/);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM usuarios WHERE rfc = ? OR email = ?',
        ['CLIENTE@EXAMPLE.COM', 'cliente@example.com']
      );
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
      pool.query.mockResolvedValueOnce([[{ debe_cambiar_password: 1, activo: 1 }]]);
      const res = await request(app).get('/api/auth/me').set('Cookie', cookieDeSesion());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ rfc: RFC_VALIDO, debeCambiarPassword: true, suspendido: false });
    });

    test('con cookie válida y cuenta suspendida, devuelve suspendido:true', async () => {
      pool.query.mockResolvedValueOnce([[{ debe_cambiar_password: 0, activo: 0 }]]);
      const res = await request(app).get('/api/auth/me').set('Cookie', cookieDeSesion());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ rfc: RFC_VALIDO, debeCambiarPassword: false, suspendido: true });
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

  describe('POST /api/auth/recuperar', () => {
    test('sin identificador responde 400 sin tocar la base de datos', async () => {
      const res = await request(app).post('/api/auth/recuperar').send({});
      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('cuenta inexistente: responde 200 con el mismo mensaje genérico (anti-enumeración), sin generar token', async () => {
      pool.query.mockResolvedValueOnce([[]]); // SELECT ... WHERE rfc = ? OR email = ?
      const res = await request(app).post('/api/auth/recuperar').send({ identificador: 'no-existe@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/Si el dato coincide con una cuenta/);
      // Un solo SELECT — nunca llega al UPDATE de reset_token_hash porque no hay usuario.
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('cuenta existente pero sin email guardado: mismo mensaje genérico, sin generar token', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 5, email: null, perfil: 'cliente' }]]);
      const res = await request(app).post('/api/auth/recuperar').send({ identificador: RFC_VALIDO });

      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/Si el dato coincide con una cuenta/);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('cuenta existente con email: mismo mensaje genérico, SÍ genera y guarda el token', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 7, email: 'cliente@example.com', perfil: 'cliente' }]]);
      pool.query.mockResolvedValueOnce([{}]); // UPDATE usuarios SET reset_token_hash = ...
      pool.query.mockResolvedValueOnce([[]]); // getConfigSmtp() dentro del envío fire-and-forget (sin configurar, no truena)

      const res = await request(app).post('/api/auth/recuperar').send({ identificador: 'cliente@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/Si el dato coincide con una cuenta/);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE usuarios SET reset_token_hash'),
        expect.arrayContaining([expect.any(String), expect.any(Date), 7])
      );
    });
  });

  describe('POST /api/auth/restablecer', () => {
    test('sin token responde 400 TOKEN_INVALIDO sin tocar la base de datos', async () => {
      const res = await request(app).post('/api/auth/restablecer').send({ password: PASSWORD_VALIDA });
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('TOKEN_INVALIDO');
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('contraseña que no cumple las reglas responde 400 sin tocar la base de datos', async () => {
      const res = await request(app).post('/api/auth/restablecer').send({ token: 'abc123', password: 'debil' });
      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('token inexistente o expirado responde 400 TOKEN_INVALIDO', async () => {
      pool.query.mockResolvedValueOnce([[]]); // SELECT ... WHERE reset_token_hash = ? AND reset_token_expira > ?
      const res = await request(app).post('/api/auth/restablecer').send({ token: 'abc123', password: PASSWORD_VALIDA });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('TOKEN_INVALIDO');
    });

    test('token válido: actualiza password_hash, limpia el token (un solo uso) y devuelve el perfil', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 9, perfil: 'administrador' }]]);
      pool.query.mockResolvedValueOnce([{}]); // UPDATE usuarios SET password_hash = ..., reset_token_hash = NULL ...

      const res = await request(app).post('/api/auth/restablecer').send({ token: 'abc123', password: PASSWORD_VALIDA });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, perfil: 'administrador' });
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/UPDATE usuarios[\s\S]*reset_token_hash = NULL/),
        expect.arrayContaining([expect.any(String), expect.any(Date), 9])
      );
    });
  });
});
