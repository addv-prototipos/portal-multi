// Pruebas de utils/auth.js — versión reducida para /control (segmento
// 9b, ver PROJECT_STATE.md): a diferencia de backend/utils/auth.js, este
// módulo NO toca ninguna base de datos (solo ADMIN_USERS), así que no
// hace falta mockear ningún pool. Mismo patrón de jest.resetModules()
// que backend/test/unit/auth.test.js: adminUsers se calcula una sola vez
// al cargar el módulo, a partir de ADMIN_USERS — hay que re-requerir
// después de cambiar la variable de entorno.

function mockRes() {
  const res = {};
  res.set = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function basicAuthHeader(usuario, password) {
  return `Basic ${Buffer.from(`${usuario}:${password}`, 'utf8').toString('base64')}`;
}

describe('control/utils/auth.js', () => {
  // Hallazgo C-02 (sonar.html, 2026-10-13): admin:admin se conserva TAL
  // CUAL en dev/test (decisión explícita del usuario, código aún no
  // productivo) — el fail-closed solo debe activarse con
  // NODE_ENV=production. Aquí protege además las 44 rutas cross-tenant
  // de /control.
  describe('loadAdminUsers — fail-closed solo en producción (C-02)', () => {
    const nodeEnvOriginal = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = nodeEnvOriginal;
      delete process.env.ADMIN_USERS;
      jest.resetModules();
    });

    test('NODE_ENV=production sin ADMIN_USERS: el módulo truena al cargarse, nunca cae a admin:admin', () => {
      jest.resetModules();
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_USERS;
      expect(() => require('../../utils/auth')).toThrow(/ADMIN_USERS.*producci[oó]n/i);
    });

    test('NODE_ENV=development sin ADMIN_USERS: sigue cayendo a admin:admin sin tronar (comportamiento de siempre)', () => {
      jest.resetModules();
      process.env.NODE_ENV = 'development';
      delete process.env.ADMIN_USERS;
      expect(() => require('../../utils/auth')).not.toThrow();
    });
  });

  describe('requireAdminAuth con ADMIN_USERS por defecto (admin:admin)', () => {
    let requireAdminAuth;

    beforeEach(() => {
      jest.resetModules();
      delete process.env.ADMIN_USERS;
      ({ requireAdminAuth } = require('../../utils/auth'));
    });

    test('sin cabecera Authorization responde 401', async () => {
      const req = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', expect.stringContaining('Basic'));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('credenciales admin:admin correctas, autentica con perfil "super" y mecanismo "admin_users"', () => {
      const req = { headers: { authorization: basicAuthHeader('admin', 'admin') } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('admin');
      expect(req.adminPerfil).toBe('super');
      expect(req.adminMecanismo).toBe('admin_users');
    });

    test('credenciales incorrectas responden 401 (sin caer a ningún mecanismo de MySQL)', () => {
      const req = { headers: { authorization: basicAuthHeader('admin', 'incorrecta') } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdminAuth con ADMIN_USERS personalizado', () => {
    let requireAdminAuth;

    beforeEach(() => {
      jest.resetModules();
      process.env.ADMIN_USERS = 'super1:ClaveLarga123,otro:otraClave';
      ({ requireAdminAuth } = require('../../utils/auth'));
    });

    afterEach(() => {
      delete process.env.ADMIN_USERS;
    });

    test('acepta cualquier usuario definido en ADMIN_USERS', () => {
      const req = { headers: { authorization: basicAuthHeader('super1', 'ClaveLarga123') } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('super1');
      expect(req.adminPerfil).toBe('super');
    });

    test('el usuario "admin" por defecto ya no es válido si no está en la lista personalizada', () => {
      const req = { headers: { authorization: basicAuthHeader('admin', 'admin') } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdminArea', () => {
    let requireAdminArea;

    beforeEach(() => {
      jest.resetModules();
      ({ requireAdminArea } = require('../../utils/auth'));
    });

    test('perfil "super" siempre pasa, sin importar los perfiles permitidos', () => {
      const req = { adminPerfil: 'super' };
      const res = mockRes();
      const next = jest.fn();

      requireAdminArea()(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('perfil que no es "super" y no está en la lista permitida -> 403', () => {
      const req = { adminPerfil: 'fiscal' };
      const res = mockRes();
      const next = jest.fn();

      requireAdminArea()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // Hallazgo M-02 (sonar.html, 2026-10-14): token de sesión (Bearer)
  // como alternativa ADITIVA a Basic Auth, mismo criterio que
  // backend/utils/auth.js — aquí más simple porque control/ solo tiene
  // el mecanismo admin_users (sin tabla de usuarios propia, sin
  // concepto de tenant).
  describe('requireAdminAuth: Bearer — token de sesión (M-02)', () => {
    let requireAdminAuth;
    let signAdminToken;
    let verifyAdminToken;

    beforeEach(() => {
      jest.resetModules();
      delete process.env.ADMIN_USERS;
      ({ requireAdminAuth, signAdminToken, verifyAdminToken } = require('../../utils/auth'));
    });

    test('token válido autentica con perfil "super" y reemite un token fresco', () => {
      const token = signAdminToken({ usuario: 'admin', perfil: 'super', mecanismo: 'admin_users', iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('admin');
      expect(req.adminPerfil).toBe('super');
      expect(req.adminMecanismo).toBe('admin_users');
      expect(res.set).toHaveBeenCalledWith('X-Admin-Session-Token', expect.any(String));
    });

    test('token de un usuario que ya NO está en ADMIN_USERS: 401 instantáneo', () => {
      const token = signAdminToken({ usuario: 'admin-removido', perfil: 'super', mecanismo: 'admin_users', iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token expirado responde 401', () => {
      const token = signAdminToken({ usuario: 'admin', perfil: 'super', mecanismo: 'admin_users', iat: Date.now() - 20000, exp: Date.now() - 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token con firma manipulada responde 401', () => {
      const token = signAdminToken({ usuario: 'admin', perfil: 'super', mecanismo: 'admin_users', iat: Date.now(), exp: Date.now() + 10000 });
      const payloadFalsificado = Buffer.from(JSON.stringify({ usuario: 'otro', perfil: 'super', mecanismo: 'admin_users', iat: Date.now(), exp: Date.now() + 999999 }), 'utf8').toString('base64url');
      const tokenManipulado = `${payloadFalsificado}.${token.split('.')[1]}`;
      const req = { headers: { authorization: `Bearer ${tokenManipulado}` } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Basic Auth exitoso TAMBIÉN emite un token de sesión (login inicial)', () => {
      const req = { headers: { authorization: basicAuthHeader('admin', 'admin') } };
      const res = mockRes();
      const next = jest.fn();

      requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.set).toHaveBeenCalledWith('X-Admin-Session-Token', expect.any(String));
    });

    test('signAdminToken + verifyAdminToken: round-trip exacto del payload', () => {
      const payload = { usuario: 'admin', perfil: 'super', mecanismo: 'admin_users', iat: Date.now(), exp: Date.now() + 10000 };
      const token = signAdminToken(payload);
      expect(verifyAdminToken(token)).toEqual(payload);
    });

    test('verifyAdminToken con basura devuelve null', () => {
      expect(verifyAdminToken('esto-no-es-un-token')).toBeNull();
      expect(verifyAdminToken('')).toBeNull();
      expect(verifyAdminToken(null)).toBeNull();
    });
  });

  // Hallazgo m-05 (sonar_1.1.html, 2026-10-19): checkCredentials() ya no
  // corta temprano cuando el usuario no existe — siempre corre la
  // comparación de timing constante, para no filtrar por timing cuáles
  // usuarios de ADMIN_USERS son válidos.
  describe('checkCredentials — sin corte temprano por timing (m-05)', () => {
    let checkCredentials;

    beforeEach(() => {
      jest.resetModules();
      process.env.ADMIN_USERS = 'admin:ClaveReal123';
      ({ checkCredentials } = require('../../utils/auth'));
    });

    test('usuario y password correctos: true', () => {
      expect(checkCredentials('admin', 'ClaveReal123')).toBe(true);
    });

    test('usuario correcto, password incorrecto: false', () => {
      expect(checkCredentials('admin', 'otra-cosa')).toBe(false);
    });

    test('usuario inexistente: false (nunca lanza, nunca confunde con éxito)', () => {
      expect(checkCredentials('no-existe', 'cualquier-cosa')).toBe(false);
    });

    test('usuario inexistente SÍ ejecuta timingSafeEqual (mismo costo que un usuario real)', () => {
      const crypto = require('crypto');
      const spy = jest.spyOn(crypto, 'timingSafeEqual');
      checkCredentials('no-existe', 'cualquier-cosa');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
