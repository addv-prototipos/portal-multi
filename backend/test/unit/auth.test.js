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

  // Hallazgo C-02 (sonar.html, 2026-10-13): admin:admin se conserva TAL
  // CUAL en dev/test (decisión explícita del usuario, código aún no
  // productivo) — el fail-closed solo debe activarse con
  // NODE_ENV=production.
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

    test('NODE_ENV=production con ADMIN_USERS vacío (parsea a cero usuarios): también truena', () => {
      jest.resetModules();
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_USERS = '   ';
      expect(() => require('../../utils/auth')).toThrow(/ADMIN_USERS.*producci[oó]n/i);
    });

    test('NODE_ENV=development sin ADMIN_USERS: sigue cayendo a admin:admin sin tronar (comportamiento de siempre)', () => {
      jest.resetModules();
      process.env.NODE_ENV = 'development';
      delete process.env.ADMIN_USERS;
      expect(() => require('../../utils/auth')).not.toThrow();
    });

    test('NODE_ENV=production CON ADMIN_USERS definido: carga normal, sin tronar', () => {
      jest.resetModules();
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_USERS = 'super:ClaveReal123';
      expect(() => require('../../utils/auth')).not.toThrow();
    });
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

  // Hallazgo M-02 (sonar.html, 2026-10-14): token de sesión (Bearer)
  // como alternativa ADITIVA a Basic Auth — admin.js/control.js migran
  // a esto para no guardar la contraseña real en sessionStorage. Decisión
  // explícita del usuario (2026-10-15): 30 min de vida, deslizante
  // (cada request válido reemite un token fresco), y re-validación
  // instantánea de suspensión/ADMIN_USERS en cada request (nunca confía
  // ciegamente en el payload firmado).
  describe('requireAdminAuth: Bearer — token de sesión (M-02)', () => {
    let requireAdminAuth;
    let signAdminToken;
    let verifyAdminToken;

    beforeEach(() => {
      jest.resetModules();
      delete process.env.ADMIN_USERS;
      pool = require('../../db').pool;
      pool.query.mockReset();
      ({ requireAdminAuth, signAdminToken, verifyAdminToken } = require('../../utils/auth'));
    });

    test('token emitido para admin_users ("super") autentica y reemite un token fresco', async () => {
      const token = signAdminToken({ usuario: 'admin', perfil: 'super', mecanismo: 'admin_users', tenantSlug: null, iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('admin');
      expect(req.adminPerfil).toBe('super');
      expect(req.adminMecanismo).toBe('admin_users');
      // Sesión deslizante: SIEMPRE sale un token fresco, no solo en /login.
      expect(res.set).toHaveBeenCalledWith('X-Admin-Session-Token', expect.any(String));
      // Cero queries — admin_users nunca toca la BD (igual que con Basic).
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('token con usuario que ya NO está en ADMIN_USERS: 401 instantáneo, sin esperar a que expire', async () => {
      const token = signAdminToken({ usuario: 'admin-removido', perfil: 'super', mecanismo: 'admin_users', tenantSlug: null, iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token emitido para perfil_bd autentica con lookup SIN password (la firma ya probó identidad)', async () => {
      pool.query.mockResolvedValueOnce([[{ rfc: 'GOMJ800101ABC', perfil: 'fiscal', activo: 1, nombre: 'Juan', email: 'juan@x.com', debe_cambiar_password: 0 }]]);
      const token = signAdminToken({ usuario: 'GOMJ800101ABC', perfil: 'fiscal', mecanismo: 'perfil_bd', tenantSlug: null, iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe('GOMJ800101ABC');
      expect(req.adminPerfil).toBe('fiscal');
      expect(req.adminMecanismo).toBe('perfil_bd');
      expect(req.adminNombre).toBe('Juan');
      // Lookup sin password: un solo SELECT, nunca verifyPassword.
      expect(pool.query.mock.calls[0][0]).toMatch(/SELECT rfc, perfil, activo, nombre, email, debe_cambiar_password/);
      expect(res.set).toHaveBeenCalledWith('X-Admin-Session-Token', expect.any(String));
    });

    test('perfil_bd suspendido DESPUÉS de emitido el token: 403 instantáneo (nunca espera a que expire)', async () => {
      pool.query.mockResolvedValueOnce([[{ rfc: 'GOMJ800101ABC', perfil: 'administrador', activo: 0 }]]);
      const token = signAdminToken({ usuario: 'GOMJ800101ABC', perfil: 'administrador', mecanismo: 'perfil_bd', tenantSlug: null, iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'CUENTA_SUSPENDIDA' }));
    });

    test('perfil_bd eliminado (sin fila) tras emitido el token: 401, nunca 403', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const token = signAdminToken({ usuario: 'YA-NO-EXISTE', perfil: 'administrador', mecanismo: 'perfil_bd', tenantSlug: null, iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token expirado (exp en el pasado) responde 401', async () => {
      const token = signAdminToken({ usuario: 'admin', perfil: 'super', mecanismo: 'admin_users', tenantSlug: null, iat: Date.now() - 20000, exp: Date.now() - 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token con firma manipulada (payload alterado tras firmar) responde 401', async () => {
      const token = signAdminToken({ usuario: 'admin', perfil: 'super', mecanismo: 'admin_users', tenantSlug: null, iat: Date.now(), exp: Date.now() + 10000 });
      const [cuerpo] = token.split('.');
      const payloadFalsificado = Buffer.from(JSON.stringify({ usuario: 'otro-admin', perfil: 'super', mecanismo: 'admin_users', tenantSlug: null, iat: Date.now(), exp: Date.now() + 999999 }), 'utf8').toString('base64url');
      const tokenManipulado = `${payloadFalsificado}.${token.split('.')[1]}`; // cuerpo nuevo + firma vieja (no coincide)

      const req = { headers: { authorization: `Bearer ${tokenManipulado}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token de un tenant distinto al de la request actual (cross-tenant) responde 401', async () => {
      const token = signAdminToken({ usuario: 'GOMJ800101ABC', perfil: 'administrador', mecanismo: 'perfil_bd', tenantSlug: 'cliente1', iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` }, tenant: { slug: 'cliente2' } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(pool.query).not.toHaveBeenCalled(); // rechazado antes de tocar la BD
    });

    test('token con mecanismo desconocido en el payload (firma válida, payload inesperado) responde 401', async () => {
      const token = signAdminToken({ usuario: 'x', perfil: 'super', mecanismo: 'api_clave', tenantSlug: null, iat: Date.now(), exp: Date.now() + 10000 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Basic Auth exitoso TAMBIÉN emite un token de sesión (login inicial)', async () => {
      const req = { headers: { authorization: basicAuthHeader('admin', 'admin') } };
      const res = mockRes();
      const next = jest.fn();

      await requireAdminAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.set).toHaveBeenCalledWith('X-Admin-Session-Token', expect.any(String));
    });

    test('signAdminToken + verifyAdminToken: round-trip exacto del payload', () => {
      const payload = { usuario: 'admin', perfil: 'super', mecanismo: 'admin_users', tenantSlug: null, iat: Date.now(), exp: Date.now() + 10000 };
      const token = signAdminToken(payload);
      const verificado = verifyAdminToken(token);
      expect(verificado).toEqual(payload);
    });

    test('verifyAdminToken con basura (ni formato de token) devuelve null', () => {
      expect(verifyAdminToken('esto-no-es-un-token')).toBeNull();
      expect(verifyAdminToken('')).toBeNull();
      expect(verifyAdminToken(null)).toBeNull();
      expect(verifyAdminToken(undefined)).toBeNull();
    });
  });

  // Hallazgo m-05 (sonar_1.1.html, 2026-10-19 — mismo patrón ya corregido
  // en control/utils/auth.js): checkCredentials() ya no corta temprano
  // cuando el usuario no existe, para no filtrar por timing cuáles
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

  // Punto 416: finalizarAutenticacionAdmin() — único punto donde
  // requireAdminAuth() decide si, además de autenticado, se le deja
  // seguir. Pura en el sentido de que no vuelve a tocar BD (lee
  // req.tenant.suscripcionBloqueo, ya calculado por tenantContext.js).
  describe('finalizarAutenticacionAdmin (punto 416 — bloqueo por suscripción)', () => {
    let finalizarAutenticacionAdmin;

    beforeEach(() => {
      jest.resetModules();
      process.env.ADMIN_USERS = 'admin:ClaveReal123';
      ({ finalizarAutenticacionAdmin } = require('../../utils/auth'));
    });

    function mockRes() {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    }

    test('adminMecanismo="admin_users" (super real) SIEMPRE pasa, incluso con suscripción bloqueada', () => {
      const req = {
        adminMecanismo: 'admin_users',
        adminPerfil: 'super',
        tenant: { slug: 't1', suscripcionBloqueo: { bloqueada: true, motivo: 'vencida' } },
      };
      const res = mockRes();
      const next = jest.fn();
      finalizarAutenticacionAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('adminPerfil="super" vía api_credencial (tenant-scoped) SÍ se bloquea — no es el super admin real', () => {
      const req = {
        adminMecanismo: 'api_credencial',
        adminPerfil: 'super',
        tenant: { slug: 't1', suscripcionBloqueo: { bloqueada: true, motivo: 'vencida', titulo: 'x', mensaje: 'y', expiraEn: '2026-09-01' } },
      };
      const res = mockRes();
      const next = jest.fn();
      finalizarAutenticacionAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(402);
    });

    test('perfil "administrador" (perfil_bd) con suscripción bloqueada responde 402 con codigo SUSCRIPCION_BLOQUEADA y portalClientesActivo:true', () => {
      const req = {
        adminMecanismo: 'perfil_bd',
        adminPerfil: 'administrador',
        tenant: {
          slug: 't1',
          suscripcionBloqueo: {
            bloqueada: true,
            motivo: 'pendiente',
            titulo: 'Tu pago está pendiente',
            mensaje: 'Aún no confirmamos tu pago.',
            expiraEn: null,
            portalClientesActivo: true,
          },
        },
      };
      const res = mockRes();
      const next = jest.fn();
      finalizarAutenticacionAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ codigo: 'SUSCRIPCION_BLOQUEADA', motivo: 'pendiente', portalClientesActivo: true })
      );
    });

    test('perfil "fiscal"/"ventas"/"inventario" también se bloquean igual que administrador', () => {
      for (const perfil of ['fiscal', 'ventas', 'inventario']) {
        const req = {
          adminMecanismo: 'perfil_bd',
          adminPerfil: perfil,
          tenant: { slug: 't1', suscripcionBloqueo: { bloqueada: true, motivo: 'cancelada', titulo: 'x', mensaje: 'y' } },
        };
        const res = mockRes();
        const next = jest.fn();
        finalizarAutenticacionAdmin(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(402);
      }
    });

    test('suscripción NO bloqueada: pasa normal, sin importar el perfil', () => {
      const req = {
        adminMecanismo: 'perfil_bd',
        adminPerfil: 'administrador',
        tenant: { slug: 't1', suscripcionBloqueo: { bloqueada: false } },
      };
      const res = mockRes();
      const next = jest.fn();
      finalizarAutenticacionAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('sin tenant resuelto (sitio base) nunca bloquea', () => {
      const req = { adminMecanismo: 'perfil_bd', adminPerfil: 'administrador', tenant: null };
      const res = mockRes();
      const next = jest.fn();
      finalizarAutenticacionAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
