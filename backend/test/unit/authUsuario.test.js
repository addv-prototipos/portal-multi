const {
  hashPassword,
  verifyPassword,
  validarPassword,
  crearTokenSesion,
  verificarTokenSesion,
  requireUserAuth,
  obtenerRfcSesionOpcional,
  establecerCookieSesion,
  limpiarCookieSesion,
} = require('../../utils/authUsuario');

describe('authUsuario.js', () => {
  describe('hashPassword / verifyPassword', () => {
    test('un hash se verifica correctamente contra su contraseña original', () => {
      const hash = hashPassword('MiPassword123');
      expect(verifyPassword('MiPassword123', hash)).toBe(true);
    });

    test('rechaza una contraseña incorrecta', () => {
      const hash = hashPassword('MiPassword123');
      expect(verifyPassword('OtraPassword456', hash)).toBe(false);
    });

    test('dos hashes de la misma contraseña son distintos (salt aleatorio)', () => {
      const hash1 = hashPassword('MiPassword123');
      const hash2 = hashPassword('MiPassword123');
      expect(hash1).not.toBe(hash2);
      expect(verifyPassword('MiPassword123', hash1)).toBe(true);
      expect(verifyPassword('MiPassword123', hash2)).toBe(true);
    });

    test('el hash tiene formato "salt:hash"', () => {
      const hash = hashPassword('x');
      expect(hash.split(':')).toHaveLength(2);
    });

    test('verifyPassword devuelve false para valores mal formados o vacíos', () => {
      expect(verifyPassword('cualquiera', null)).toBe(false);
      expect(verifyPassword('cualquiera', '')).toBe(false);
      expect(verifyPassword('cualquiera', 'sin-dos-puntos')).toBe(false);
    });

    test('verifyPassword no lanza excepción con un salt corrupto', () => {
      expect(() => verifyPassword('x', 'salt-invalido:hash-invalido')).not.toThrow();
    });
  });

  describe('validarPassword', () => {
    test('acepta una contraseña que cumple las 4 reglas', () => {
      expect(validarPassword('Abcdefg1')).toBeNull();
    });

    test('rechaza menos de 8 caracteres', () => {
      expect(validarPassword('Abc123')).toMatch(/al menos 8 caracteres/);
    });

    test('rechaza sin número', () => {
      expect(validarPassword('Abcdefgh')).toMatch(/al menos un número/);
    });

    test('rechaza sin minúscula', () => {
      expect(validarPassword('ABCDEFG1')).toMatch(/letra minúscula/);
    });

    test('rechaza sin mayúscula', () => {
      expect(validarPassword('abcdefg1')).toMatch(/letra mayúscula/);
    });

    test('rechaza valores no-string', () => {
      expect(validarPassword(12345678)).toMatch(/al menos 8 caracteres/);
      expect(validarPassword(null)).toMatch(/al menos 8 caracteres/);
    });
  });

  describe('crearTokenSesion / verificarTokenSesion', () => {
    test('un token recién creado se verifica y expone el rfc correcto', () => {
      const token = crearTokenSesion('GOMJ800101ABC');
      const payload = verificarTokenSesion(token);
      expect(payload).not.toBeNull();
      expect(payload.rfc).toBe('GOMJ800101ABC');
    });

    test('rechaza token null/vacío/sin punto', () => {
      expect(verificarTokenSesion(null)).toBeNull();
      expect(verificarTokenSesion('')).toBeNull();
      expect(verificarTokenSesion('sin-punto')).toBeNull();
    });

    test('rechaza un token con la firma alterada', () => {
      const token = crearTokenSesion('GOMJ800101ABC');
      const [payload] = token.split('.');
      const tokenAlterado = `${payload}.firmaInventadaQueNoCoincideXX`;
      expect(verificarTokenSesion(tokenAlterado)).toBeNull();
    });

    test('rechaza un token con el payload alterado (firma ya no coincide)', () => {
      const token = crearTokenSesion('GOMJ800101ABC');
      const [, firma] = token.split('.');
      const payloadFalso = Buffer.from(JSON.stringify({ rfc: 'OTRO000000XXX', exp: Date.now() + 100000 }), 'utf8').toString('base64url');
      expect(verificarTokenSesion(`${payloadFalso}.${firma}`)).toBeNull();
    });

    test('rechaza un token expirado', () => {
      // Token construido a mano con exp en el pasado, firmado igual que
      // crearTokenSesion pero sin poder llamar directamente a firmar()
      // (no exportada) — se verifica indirectamente: un token válido con
      // fecha de expiración manipulada ya no pasa la firma, así que en vez
      // de eso se confirma el comportamiento con un token real cuya
      // expiración forzamos a través de Date.now mockeado.
      const ahoraReal = Date.now;
      Date.now = () => ahoraReal() - 13 * 60 * 60 * 1000; // 13 horas en el pasado
      const tokenExpirado = crearTokenSesion('GOMJ800101ABC');
      Date.now = ahoraReal;

      expect(verificarTokenSesion(tokenExpirado)).toBeNull();
    });

    test('rechaza payload no JSON válido', () => {
      const payloadBasura = Buffer.from('no-es-json', 'utf8').toString('base64url');
      // Sin firma real no pasaría la verificación de firma primero, así que
      // esta prueba confirma la robustez general: nunca lanza, siempre null.
      expect(() => verificarTokenSesion(`${payloadBasura}.firmaCualquiera`)).not.toThrow();
      expect(verificarTokenSesion(`${payloadBasura}.firmaCualquiera`)).toBeNull();
    });
  });

  describe('crearTokenSesion / verificarTokenSesion — multi-tenant (segmento 3)', () => {
    test('un token creado sin tenant se sigue verificando sin tenant (compatibilidad)', () => {
      const token = crearTokenSesion('GOMJ800101ABC');
      expect(verificarTokenSesion(token)).not.toBeNull();
      expect(verificarTokenSesion(token, null)).not.toBeNull();
    });

    test('un token creado para un tenant se verifica correctamente contra ESE mismo tenant', () => {
      const token = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      const payload = verificarTokenSesion(token, 'cliente1');
      expect(payload).not.toBeNull();
      expect(payload.rfc).toBe('GOMJ800101ABC');
      expect(payload.tid).toBe('cliente1');
    });

    test('un token de "cliente1" se RECHAZA al verificarlo contra "cliente2" (firma no coincide, clave derivada distinta)', () => {
      const token = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      expect(verificarTokenSesion(token, 'cliente2')).toBeNull();
    });

    test('un token de tenant se RECHAZA si se verifica sin tenant, y viceversa', () => {
      const tokenConTenant = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      const tokenSinTenant = crearTokenSesion('GOMJ800101ABC');

      expect(verificarTokenSesion(tokenConTenant, null)).toBeNull();
      expect(verificarTokenSesion(tokenSinTenant, 'cliente1')).toBeNull();
    });

    test('no basta con falsificar el campo "tid" del payload: la firma se calculó con la clave del tenant original', () => {
      const token = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      const [, firma] = token.split('.');
      const payloadFalso = Buffer.from(
        JSON.stringify({ rfc: 'GOMJ800101ABC', tid: 'cliente2', exp: Date.now() + 100000 }),
        'utf8'
      ).toString('base64url');

      expect(verificarTokenSesion(`${payloadFalso}.${firma}`, 'cliente2')).toBeNull();
    });

    test('dos tenants distintos producen tokens con firmas distintas para el mismo rfc', () => {
      const tokenA = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      const tokenB = crearTokenSesion('GOMJ800101ABC', 'cliente2');
      expect(tokenA).not.toBe(tokenB);
    });
  });

  describe('requireUserAuth (middleware)', () => {
    function mockRes() {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    }

    test('con cookie de sesión válida, llama a next() y expone req.userRfc', () => {
      const token = crearTokenSesion('GOMJ800101ABC');
      const req = { cookies: { sesion_usuario: token } };
      const res = mockRes();
      const next = jest.fn();

      requireUserAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.userRfc).toBe('GOMJ800101ABC');
      expect(res.status).not.toHaveBeenCalled();
    });

    test('sin cookie, responde 401 y no llama a next()', () => {
      const req = { cookies: {} };
      const res = mockRes();
      const next = jest.fn();

      requireUserAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('sin req.cookies definido, no lanza y responde 401', () => {
      const req = {};
      const res = mockRes();
      const next = jest.fn();

      expect(() => requireUserAuth(req, res, next)).not.toThrow();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('con req.tenant resuelto, exige un token firmado para ESE tenant', () => {
      const token = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      const req = { cookies: { sesion_usuario: token }, tenant: { slug: 'cliente1' } };
      const res = mockRes();
      const next = jest.fn();

      requireUserAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.userRfc).toBe('GOMJ800101ABC');
    });

    test('un token de otro tenant se rechaza aunque la cookie esté presente', () => {
      const token = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      const req = { cookies: { sesion_usuario: token }, tenant: { slug: 'cliente2' } };
      const res = mockRes();
      const next = jest.fn();

      requireUserAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    // Gobierno de funcionalidades por plan (ver PROJECT_STATE.md):
    // requireUserAuth es el chokepoint único de "portal de clientes" —
    // responde 404 (no 401, no 403) antes de siquiera leer la cookie, para
    // que el tenant sin el módulo se comporte como si la ruta no existiera.
    test('con portalClientesHabilitado=false en req.tenant, responde 404 SIN leer la cookie de sesión', () => {
      const token = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      const req = {
        cookies: { sesion_usuario: token },
        tenant: { slug: 'cliente1', portalClientesHabilitado: false },
      };
      const res = mockRes();
      res.end = jest.fn();
      const next = jest.fn();

      requireUserAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.end).toHaveBeenCalled();
      expect(req.userRfc).toBeUndefined();
    });

    test('con portalClientesHabilitado=true (o sin definir) en req.tenant, valida la sesión normalmente', () => {
      const token = crearTokenSesion('GOMJ800101ABC', 'cliente1');
      const req = {
        cookies: { sesion_usuario: token },
        tenant: { slug: 'cliente1', portalClientesHabilitado: true },
      };
      const res = mockRes();
      const next = jest.fn();

      requireUserAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.userRfc).toBe('GOMJ800101ABC');
    });
  });

  describe('obtenerRfcSesionOpcional', () => {
    test('devuelve el rfc si hay sesión válida', () => {
      const token = crearTokenSesion('GOMJ800101ABC');
      const req = { cookies: { sesion_usuario: token } };
      expect(obtenerRfcSesionOpcional(req)).toBe('GOMJ800101ABC');
    });

    test('devuelve null si no hay sesión, sin rechazar la petición', () => {
      const req = { cookies: {} };
      expect(obtenerRfcSesionOpcional(req)).toBeNull();
    });
  });

  describe('establecerCookieSesion / limpiarCookieSesion', () => {
    test('establecerCookieSesion llama a res.cookie con httpOnly y el nombre correcto', () => {
      const res = { cookie: jest.fn() };
      establecerCookieSesion(res, 'GOMJ800101ABC');

      expect(res.cookie).toHaveBeenCalledTimes(1);
      const [nombre, valor, opciones] = res.cookie.mock.calls[0];
      expect(nombre).toBe('sesion_usuario');
      expect(typeof valor).toBe('string');
      expect(opciones.httpOnly).toBe(true);
      expect(opciones.path).toBe('/');
    });

    test('limpiarCookieSesion llama a res.clearCookie con el nombre correcto', () => {
      const res = { clearCookie: jest.fn() };
      limpiarCookieSesion(res);
      expect(res.clearCookie).toHaveBeenCalledWith('sesion_usuario', { path: '/' });
    });

    test('con tenant, establecerCookieSesion acota la cookie a path "/<slug>"', () => {
      const res = { cookie: jest.fn() };
      establecerCookieSesion(res, 'GOMJ800101ABC', 'cliente1');

      const [, , opciones] = res.cookie.mock.calls[0];
      expect(opciones.path).toBe('/cliente1');
    });

    test('con tenant, limpiarCookieSesion usa el mismo path que se usó al establecerla', () => {
      const res = { clearCookie: jest.fn() };
      limpiarCookieSesion(res, 'cliente1');
      expect(res.clearCookie).toHaveBeenCalledWith('sesion_usuario', { path: '/cliente1' });
    });
  });
});
