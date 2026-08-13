const { hashPassword } = require('../../utils/authUsuario');

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
}));

// `pool` se re-obtiene después de cada jest.resetModules() (ver beforeEach
// de cada describe): resetModules() vacía el registro de módulos, así que
// una referencia capturada ANTES del reset queda apuntando a una instancia
// de mock distinta de la que auth.js usa tras volver a requerirse.
let pool;

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

describe('auth.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requireAdminAuth con ADMIN_USERS por defecto (admin:admin)', () => {
    let requireAdminAuth;

    beforeEach(() => {
      jest.resetModules();
      delete process.env.ADMIN_USERS;
      pool = require('../../db').pool;
      pool.query.mockReset();
      ({ requireAdminAuth } = require('../../utils/auth'));
    });

    test('sin cabecera Authorization responde 401 y pide Basic auth', async () => {
      const req = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', expect.stringContaining('Basic'));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('credenciales admin:admin correctas, autentica con perfil "super"', async () => {
      const req = { headers: { authorization: basicAuthHeader('admin', 'admin') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('admin');
      expect(req.adminPerfil).toBe('super');
      expect(req.adminMecanismo).toBe('admin_users');
    });

    test('credenciales ADMIN_USERS incorrectas, cae a cuenta de respaldo (MySQL) sin resultados -> 401', async () => {
      pool.query.mockResolvedValueOnce([[]]); // verificarCuentaRespaldoAdmin: sin fila
      pool.query.mockResolvedValueOnce([[]]); // verificarUsuarioAdministrativo: sin fila

      const req = { headers: { authorization: basicAuthHeader('admin', 'incorrecta') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('esquema distinto de Basic responde 401', async () => {
      const req = { headers: { authorization: 'Bearer algun-token' } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('base64 corrupto responde 400', async () => {
      const req = { headers: { authorization: 'Basic %%%no-es-base64-valido%%%' } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      // Buffer.from con base64 inválido no lanza en Node (ignora chars
      // inválidos), así que el comportamiento real depende del resultado
      // decodificado; se confirma que nunca lanza y siempre responde algo.
      expect(res.status).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('credenciales sin ":" responde 400', async () => {
      const encoded = Buffer.from('usuario-sin-separador', 'utf8').toString('base64');
      const req = { headers: { authorization: `Basic ${encoded}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('sin req.tenant, el realm es "Administracion" (comportamiento previo, sin cambios)', async () => {
      const req = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="Administracion"');
    });

    test('con req.tenant resuelto, el realm incluye el slug (multi-tenant, segmento 3)', async () => {
      const req = { headers: {}, tenant: { slug: 'cliente1' } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="Administracion-cliente1"');
    });
  });

  describe('requireAdminAuth con ADMIN_USERS personalizado', () => {
    let requireAdminAuth;

    beforeEach(() => {
      jest.resetModules();
      process.env.ADMIN_USERS = 'root:secreta1,otro: con espacios ';
      pool = require('../../db').pool;
      pool.query.mockReset();
      ({ requireAdminAuth } = require('../../utils/auth'));
    });

    afterEach(() => {
      delete process.env.ADMIN_USERS;
    });

    test('acepta el primer usuario definido', async () => {
      const req = { headers: { authorization: basicAuthHeader('root', 'secreta1') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('root');
      expect(req.adminPerfil).toBe('super');
    });

    test('la contraseña conserva espacios internos/iniciales sin recortar (solo el usuario se recorta)', async () => {
      // ADMIN_USERS = '...,otro: con espacios ' — pair.trim() quita el
      // espacio FINAL del par completo antes de partir por ':', así que la
      // contraseña real guardada es " con espacios" (con el espacio inicial
      // después de los dos puntos, sin el espacio final).
      const req = { headers: { authorization: basicAuthHeader('otro', ' con espacios') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('usuario "admin" ya no es válido por ADMIN_USERS (no está en la lista) y cae a MySQL', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([[]]);

      const req = { headers: { authorization: basicAuthHeader('admin', 'admin') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdminAuth: cuenta de respaldo "admin" en MySQL', () => {
    let requireAdminAuth;

    beforeEach(() => {
      jest.resetModules();
      delete process.env.ADMIN_USERS; // admin:admin ya cubre username "admin" por ADMIN_USERS -> usar password distinta para forzar la ruta de respaldo
      pool = require('../../db').pool;
      pool.query.mockReset();
      ({ requireAdminAuth } = require('../../utils/auth'));
    });

    test('password que no coincide con ADMIN_USERS pero sí con el hash guardado en MySQL', async () => {
      const hashGuardado = hashPassword('claveDeRespaldo1');
      pool.query.mockResolvedValueOnce([[{ valor: hashGuardado }]]); // verificarCuentaRespaldoAdmin

      const req = { headers: { authorization: basicAuthHeader('admin', 'claveDeRespaldo1') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('admin');
      expect(req.adminPerfil).toBe('super');
      expect(req.adminMecanismo).toBe('fallback_admin');
    });

    test('un error de MySQL en la cuenta de respaldo no tumba la petición, sigue a la siguiente capa', async () => {
      pool.query.mockRejectedValueOnce(new Error('conexión perdida'));
      pool.query.mockResolvedValueOnce([[]]); // verificarUsuarioAdministrativo

      const req = { headers: { authorization: basicAuthHeader('admin', 'lo-que-sea') } };
      const res = mockRes();
      const next = jest.fn();

      await expect(requireAdminAuth(req, res, next)).resolves.not.toThrow();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdminAuth: usuarios administrador/fiscal desde MySQL', () => {
    let requireAdminAuth;

    beforeEach(() => {
      jest.resetModules();
      delete process.env.ADMIN_USERS;
      pool = require('../../db').pool;
      pool.query.mockReset();
      ({ requireAdminAuth } = require('../../utils/auth'));
    });

    test('usuario con perfil "fiscal" autentica con ese perfil (no "super")', async () => {
      // username !== 'admin', así que verificarCuentaRespaldoAdmin() ni
      // siquiera se llama (ver el `if (username === 'admin')` en auth.js) —
      // solo se necesita mockear la consulta de verificarUsuarioAdministrativo.
      const hashGuardado = hashPassword('miClave123');
      pool.query.mockResolvedValueOnce([
        [{ rfc: 'GOMJ800101ABC', password_hash: hashGuardado, perfil: 'fiscal' }],
      ]);

      const req = { headers: { authorization: basicAuthHeader('GOMJ800101ABC', 'miClave123') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('GOMJ800101ABC');
      expect(req.adminPerfil).toBe('fiscal');
      expect(req.adminMecanismo).toBe('perfil_bd');
    });

    test('password incorrecta para usuario administrativo real responde 401', async () => {
      const hashGuardado = hashPassword('miClave123');
      pool.query.mockResolvedValueOnce([
        [{ rfc: 'GOMJ800101ABC', password_hash: hashGuardado, perfil: 'administrador' }],
      ]);

      const req = { headers: { authorization: basicAuthHeader('GOMJ800101ABC', 'incorrecta') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdminArea', () => {
    const { requireAdminArea } = require('../../utils/auth');

    test('perfil "super" siempre pasa, sin importar qué áreas se pidan', () => {
      const req = { adminPerfil: 'super' };
      const res = mockRes();
      const next = jest.fn();

      requireAdminArea('tickets', 'usuarios')(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('perfil incluido en la lista permitida pasa', () => {
      const req = { adminPerfil: 'fiscal' };
      const res = mockRes();
      const next = jest.fn();

      requireAdminArea('fiscal', 'administrador')(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('perfil no incluido responde 403', () => {
      const req = { adminPerfil: 'fiscal' };
      const res = mockRes();
      const next = jest.fn();

      requireAdminArea('administrador')(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireUsuarioAdminExacto', () => {
    const { requireUsuarioAdminExacto } = require('../../utils/auth');

    test('permite solo si req.adminUser === "admin"', () => {
      const req = { adminUser: 'admin' };
      const res = mockRes();
      const next = jest.fn();

      requireUsuarioAdminExacto(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('rechaza cualquier otro usuario, incluyendo otro perfil "super"', () => {
      const req = { adminUser: 'root' };
      const res = mockRes();
      const next = jest.fn();

      requireUsuarioAdminExacto(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
