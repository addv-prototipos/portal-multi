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

describe('Cliente: Mi Cuenta (autoservicio del portal)', () => {
  afterEach(() => {
    pool.query.mockReset();
  });

  describe('GET /api/mi-cuenta', () => {
    test('sin sesión responde 401', async () => {
      const res = await request(app).get('/api/mi-cuenta');
      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('con sesión devuelve nombre/telefono/email de la fila', async () => {
      pool.query.mockResolvedValueOnce([[{ nombre: 'Juan López', telefono: '5512345678', email: 'juan@empresa.mx' }]]);
      const res = await request(app).get('/api/mi-cuenta').set('Cookie', cookieDeSesion());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        rfc: RFC_VALIDO,
        nombre: 'Juan López',
        telefono: '5512345678',
        email: 'juan@empresa.mx',
      });
    });

    test('fila inexistente (cuenta borrada tras emitirse la cookie) responde 404', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/mi-cuenta').set('Cookie', cookieDeSesion());
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/mi-cuenta', () => {
    test('sin sesión responde 401', async () => {
      const res = await request(app).put('/api/mi-cuenta').send({ email: 'a@a.com' });
      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('teléfono inválido responde 400 sin tocar la base de datos', async () => {
      const res = await request(app)
        .put('/api/mi-cuenta')
        .set('Cookie', cookieDeSesion())
        .send({ nombre: 'Juan', telefono: '123', email: 'juan@empresa.mx' });
      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('correo inválido responde 400 sin tocar la base de datos', async () => {
      const res = await request(app)
        .put('/api/mi-cuenta')
        .set('Cookie', cookieDeSesion())
        .send({ nombre: 'Juan', telefono: '5512345678', email: 'no-es-correo' });
      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('correo ya usado por otra cuenta responde 409 sin actualizar', async () => {
      pool.query.mockResolvedValueOnce([[{ rfc: 'OTRO1234567A' }]]); // SELECT rfc FROM usuarios WHERE email = ? AND rfc <> ?
      const res = await request(app)
        .put('/api/mi-cuenta')
        .set('Cookie', cookieDeSesion())
        .send({ nombre: 'Juan', telefono: '5512345678', email: 'duplicado@empresa.mx' });

      expect(res.status).toBe(409);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('datos válidos actualiza nombre/telefono/email de la propia fila', async () => {
      pool.query.mockResolvedValueOnce([[]]); // sin duplicado
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

      const res = await request(app)
        .put('/api/mi-cuenta')
        .set('Cookie', cookieDeSesion())
        .send({ nombre: 'Juan López', telefono: '5512345678', email: 'juan@empresa.mx' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const llamadaUpdate = pool.query.mock.calls.find(([sql]) => sql.includes('UPDATE usuarios SET nombre'));
      expect(llamadaUpdate).toBeDefined();
      expect(llamadaUpdate[1]).toEqual(['Juan López', '5512345678', 'juan@empresa.mx', expect.any(Date), RFC_VALIDO]);
    });
  });

  describe('PUT /api/mi-cuenta/password', () => {
    test('sin sesión responde 401', async () => {
      const res = await request(app)
        .put('/api/mi-cuenta/password')
        .send({ password_actual: 'x', password_nueva: 'y' });
      expect(res.status).toBe(401);
    });

    test('contraseña actual incorrecta responde 400', async () => {
      pool.query.mockResolvedValueOnce([[{ password_hash: hashPassword('OtraClave9') }]]);
      const res = await request(app)
        .put('/api/mi-cuenta/password')
        .set('Cookie', cookieDeSesion())
        .send({ password_actual: 'ClaveIncorrecta9', password_nueva: 'ClaveNueva9' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/actual/i);
    });

    test('contraseña nueva débil responde 400', async () => {
      pool.query.mockResolvedValueOnce([[{ password_hash: hashPassword(PASSWORD_VALIDA) }]]);
      const res = await request(app)
        .put('/api/mi-cuenta/password')
        .set('Cookie', cookieDeSesion())
        .send({ password_actual: PASSWORD_VALIDA, password_nueva: 'debil' });

      expect(res.status).toBe(400);
    });

    test('datos correctos actualiza el hash y apaga debe_cambiar_password', async () => {
      pool.query.mockResolvedValueOnce([[{ password_hash: hashPassword(PASSWORD_VALIDA) }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .put('/api/mi-cuenta/password')
        .set('Cookie', cookieDeSesion())
        .send({ password_actual: PASSWORD_VALIDA, password_nueva: 'ClaveNueva9' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const llamadaUpdate = pool.query.mock.calls.find(([sql]) => sql.includes('UPDATE usuarios SET password_hash'));
      expect(llamadaUpdate).toBeDefined();
      expect(llamadaUpdate[0]).toMatch(/debe_cambiar_password = 0/);
    });
  });
});
