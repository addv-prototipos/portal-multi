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
});
