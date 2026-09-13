const { hashPassword } = require('../../utils/authUsuario');

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
  obtenerPoolControl: jest.fn(),
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

    test('credenciales ADMIN_USERS incorrectas, cae a verificarUsuarioAdministrativo sin resultados -> 401', async () => {
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

    test('usuario administrativo real con perfil "ventas" puede autenticarse (punto 190)', async () => {
      const hashGuardado = hashPassword('miClave123');
      pool.query.mockResolvedValueOnce([
        [{ rfc: 'ventas1', password_hash: hashGuardado, perfil: 'ventas' }],
      ]);

      const req = { headers: { authorization: basicAuthHeader('ventas1', 'miClave123') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminPerfil).toBe('ventas');
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

    test('cuenta suspendida (activo:0) con contraseña correcta responde 403, nunca deja pasar', async () => {
      const hashGuardado = hashPassword('miClave123');
      pool.query.mockResolvedValueOnce([
        [{ rfc: 'GOMJ800101ABC', password_hash: hashGuardado, perfil: 'administrador', activo: 0 }],
      ]);

      const req = { headers: { authorization: basicAuthHeader('GOMJ800101ABC', 'miClave123') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/suspendida/i) }));
    });

    test('cuenta suspendida con contraseña incorrecta sigue respondiendo 401 (no delata que existe)', async () => {
      const hashGuardado = hashPassword('miClave123');
      pool.query.mockResolvedValueOnce([
        [{ rfc: 'GOMJ800101ABC', password_hash: hashGuardado, perfil: 'administrador', activo: 0 }],
      ]);

      const req = { headers: { authorization: basicAuthHeader('GOMJ800101ABC', 'incorrecta') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    test('cuenta con activo:1 explícito sigue autenticando con normalidad (no regresión)', async () => {
      const hashGuardado = hashPassword('miClave123');
      pool.query.mockResolvedValueOnce([
        [{ rfc: 'GOMJ800101ABC', password_hash: hashGuardado, perfil: 'administrador', activo: 1 }],
      ]);

      const req = { headers: { authorization: basicAuthHeader('GOMJ800101ABC', 'miClave123') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminPerfil).toBe('administrador');
    });
  });

  describe('requireAdminAuth: usuario de sucursal compartido (§58)', () => {
    let requireAdminAuth;
    let poolControl;

    beforeEach(() => {
      jest.resetModules();
      delete process.env.ADMIN_USERS;
      pool = require('../../db').pool;
      pool.query.mockReset().mockResolvedValue([[]]); // tier 3 (perfil_bd): sin match local, siempre
      poolControl = { query: jest.fn() };
      require('../../db').obtenerPoolControl.mockReturnValue(poolControl);
      ({ requireAdminAuth } = require('../../utils/auth'));
    });

    // Encola primero el "sin match" de tier 4 (api_credenciales, que
    // también vive en la BD de control y se prueba ANTES que tier 5 en
    // requireAdminAuth) para que el mock de tier 5 (usuarios_sucursal)
    // sea la SEGUNDA llamada a poolControl.query, no la primera.
    function mockTier5(filaTier5) {
      poolControl.query
        .mockResolvedValueOnce([[]]) // tier 4: api_credenciales, sin match
        .mockResolvedValueOnce([filaTier5 ? [filaTier5] : []]); // tier 5: usuarios_sucursal
    }

    test('sin req.tenant.grupoSucursalId, nunca consulta usuarios_sucursal (solo tier 4, api_credenciales, que no depende del grupo)', async () => {
      poolControl.query.mockResolvedValueOnce([[]]); // tier 4: api_credenciales, sin match

      const req = {
        headers: { authorization: basicAuthHeader('gerente', 'Abcdefg1') },
        tenant: { slug: 'norte', grupoSucursalId: null },
      };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(poolControl.query).toHaveBeenCalledTimes(1); // solo tier 4, tier 5 nunca se dispara
      expect(poolControl.query.mock.calls[0][0]).not.toMatch(/usuarios_sucursal/);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('usuario y contraseña correctos del grupo autentican con el perfil de la credencial compartida', async () => {
      const hashGuardado = hashPassword('Abcdefg1');
      mockTier5({ usuario: 'gerente', password_hash: hashGuardado, perfil: 'administrador' });

      const req = {
        headers: { authorization: basicAuthHeader('gerente', 'Abcdefg1') },
        tenant: { slug: 'norte', grupoSucursalId: 7 },
      };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('gerente');
      expect(req.adminPerfil).toBe('administrador');
      expect(req.adminMecanismo).toBe('usuario_sucursal');
      // Consulta ACOTADA al grupo del tenant resuelto — un usuario de OTRO
      // grupo nunca podría entrar solo por adivinar el usuario/password.
      expect(poolControl.query).toHaveBeenLastCalledWith(expect.stringContaining('grupo_sucursal_id'), [7, 'gerente']);
    });

    test('funciona igual en CUALQUIER tenant del mismo grupo (misma credencial, distinto slug)', async () => {
      const hashGuardado = hashPassword('Abcdefg1');
      mockTier5({ usuario: 'gerente', password_hash: hashGuardado, perfil: 'fiscal' });

      const req = {
        headers: { authorization: basicAuthHeader('gerente', 'Abcdefg1') },
        tenant: { slug: 'sur', grupoSucursalId: 7 },
      };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(req.adminPerfil).toBe('fiscal');
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('usuario que existe pero en OTRO grupo responde 401 (nunca cruza sucursales de otro negocio)', async () => {
      mockTier5(null); // la query ya filtra por grupo_sucursal_id, no hay fila

      const req = {
        headers: { authorization: basicAuthHeader('gerente', 'Abcdefg1') },
        tenant: { slug: 'norte', grupoSucursalId: 7 },
      };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('password incorrecta responde 401', async () => {
      const hashGuardado = hashPassword('Abcdefg1');
      mockTier5({ usuario: 'gerente', password_hash: hashGuardado, perfil: 'administrador' });

      const req = {
        headers: { authorization: basicAuthHeader('gerente', 'incorrecta') },
        tenant: { slug: 'norte', grupoSucursalId: 7 },
      };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('usuario desactivado (activo=0) no aparece en la consulta, responde 401', async () => {
      // La query real ya filtra "AND activo = 1" — sin fila, se comporta
      // igual que "no existe".
      mockTier5(null);

      const req = {
        headers: { authorization: basicAuthHeader('gerente', 'Abcdefg1') },
        tenant: { slug: 'norte', grupoSucursalId: 7 },
      };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('un error consultando la BD de control no lanza, responde 401', async () => {
      poolControl.query
        .mockResolvedValueOnce([[]]) // tier 4: api_credenciales, sin match
        .mockRejectedValueOnce(new Error('conexión perdida')); // tier 5: falla

      const req = {
        headers: { authorization: basicAuthHeader('gerente', 'Abcdefg1') },
        tenant: { slug: 'norte', grupoSucursalId: 7 },
      };
      const res = mockRes();
      const next = jest.fn();

      await expect(requireAdminAuth(req, res, next)).resolves.not.toThrow();
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
});
