jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const {
  generarPasswordApi,
  generarClaveApi,
  hashPasswordApi,
  verifyPasswordApi,
  listarCredencialesPorTenant,
  obtenerCredencialActivaPorUsuario,
  obtenerCredencialActivaPorApiKey,
  crearCredencialApi,
  rotarCredencialApi,
  revocarCredencialApi,
} = require('../../utils/apiCredenciales');

describe('utils/apiCredenciales.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generarPasswordApi / generarClaveApi', () => {
    test('genera password de la longitud pedida, sin caracteres ambiguos (0/O/1/l/I)', () => {
      const password = generarPasswordApi(24);
      expect(password).toHaveLength(24);
      expect(password).not.toMatch(/[0O1lI]/);
    });

    test('dos llamadas generan valores distintos (aleatoriedad real)', () => {
      expect(generarPasswordApi(24)).not.toBe(generarPasswordApi(24));
    });

    test('la clave API lleva el prefijo "sk_"', () => {
      const clave = generarClaveApi(32);
      expect(clave.startsWith('sk_')).toBe(true);
      expect(clave).toHaveLength(3 + 32);
    });
  });

  describe('hashPasswordApi / verifyPasswordApi', () => {
    test('un password correcto verifica true contra su propio hash', () => {
      const hash = hashPasswordApi('mi-password-seguro');
      expect(verifyPasswordApi('mi-password-seguro', hash)).toBe(true);
    });

    test('un password incorrecto verifica false', () => {
      const hash = hashPasswordApi('mi-password-seguro');
      expect(verifyPasswordApi('password-equivocado', hash)).toBe(false);
    });

    test('el hash tiene formato salt:derivado', () => {
      const hash = hashPasswordApi('x');
      expect(hash.split(':')).toHaveLength(2);
    });

    test('dos hashes del mismo password son distintos (salt aleatorio)', () => {
      expect(hashPasswordApi('mismo')).not.toBe(hashPasswordApi('mismo'));
    });

    test('verifyPasswordApi es defensivo ante hash ausente o mal formado', () => {
      expect(verifyPasswordApi('x', null)).toBe(false);
      expect(verifyPasswordApi('x', undefined)).toBe(false);
      expect(verifyPasswordApi('x', 'sin-dos-puntos')).toBe(false);
      expect(verifyPasswordApi('x', 'salt-basura:derivado-basura')).toBe(false);
    });
  });

  describe('listarCredencialesPorTenant', () => {
    test('consulta filtrando por tenant_slug', async () => {
      const pool = { query: jest.fn().mockResolvedValue([[{ id: 1, api_usuario: 'cliente1_api' }]]) };
      obtenerPool.mockReturnValue(pool);
      const resultado = await listarCredencialesPorTenant('cliente1');
      expect(resultado).toEqual([{ id: 1, api_usuario: 'cliente1_api' }]);
      expect(pool.query.mock.calls[0][1]).toEqual(['cliente1']);
    });
  });

  describe('obtenerCredencialActivaPorUsuario', () => {
    test('retorna la fila si existe', async () => {
      const pool = { query: jest.fn().mockResolvedValue([[{ id: 1, api_usuario: 'cliente1_api' }]]) };
      obtenerPool.mockReturnValue(pool);
      const resultado = await obtenerCredencialActivaPorUsuario('cliente1_api');
      expect(resultado).toEqual({ id: 1, api_usuario: 'cliente1_api' });
    });

    test('retorna null si no existe', async () => {
      const pool = { query: jest.fn().mockResolvedValue([[]]) };
      obtenerPool.mockReturnValue(pool);
      expect(await obtenerCredencialActivaPorUsuario('nadie')).toBeNull();
    });
  });

  describe('obtenerCredencialActivaPorApiKey', () => {
    test('retorna null de inmediato si falta apiKey o tenantSlug (sin tocar la BD)', async () => {
      const pool = { query: jest.fn() };
      obtenerPool.mockReturnValue(pool);
      expect(await obtenerCredencialActivaPorApiKey(null, 'cliente1')).toBeNull();
      expect(await obtenerCredencialActivaPorApiKey('sk_x', null)).toBeNull();
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('encuentra la credencial cuyo hash verifica contra la apiKey en texto plano', async () => {
      const hashReal = hashPasswordApi('sk_correcta');
      const pool = {
        query: jest.fn().mockResolvedValue([
          [
            { id: 1, api_key_hash: hashPasswordApi('sk_otra') },
            { id: 2, api_key_hash: hashReal },
          ],
        ]),
      };
      obtenerPool.mockReturnValue(pool);
      const resultado = await obtenerCredencialActivaPorApiKey('sk_correcta', 'cliente1');
      expect(resultado.id).toBe(2);
    });

    test('retorna null si ninguna credencial activa coincide', async () => {
      const pool = { query: jest.fn().mockResolvedValue([[{ id: 1, api_key_hash: hashPasswordApi('sk_otra') }]]) };
      obtenerPool.mockReturnValue(pool);
      expect(await obtenerCredencialActivaPorApiKey('sk_no-coincide', 'cliente1')).toBeNull();
    });
  });

  describe('crearCredencialApi', () => {
    test('rechaza si ya existe una credencial activa para el tenant', async () => {
      const pool = { query: jest.fn() };
      obtenerPool.mockReturnValue(pool);
      pool.query.mockResolvedValueOnce([[{ id: 1, api_usuario: 'cliente1_api', activo: 1 }]]); // listarCredencialesPorTenant

      await expect(crearCredencialApi('cliente1', 'admin')).rejects.toMatchObject({ codigo: 'ya_existe' });
    });

    test('crea la credencial con usuario derivado del slug cuando no hay conflicto', async () => {
      const pool = { query: jest.fn() };
      obtenerPool.mockReturnValue(pool);
      pool.query
        .mockResolvedValueOnce([[]]) // listarCredencialesPorTenant: nada activo
        .mockResolvedValueOnce([[]]) // chequeo de usuario único: libre
        .mockResolvedValueOnce([{ insertId: 10 }]); // INSERT

      const resultado = await crearCredencialApi('cliente1', 'admin');

      expect(resultado.api_usuario).toBe('cliente1_api');
      expect(resultado.id).toBe(10);
      expect(resultado.password_plano).toHaveLength(24);
      expect(resultado.clave_api.startsWith('sk_')).toBe(true);
    });

    test('agrega un sufijo numérico si el usuario derivado ya existe (reuso de slug)', async () => {
      const pool = { query: jest.fn() };
      obtenerPool.mockReturnValue(pool);
      pool.query
        .mockResolvedValueOnce([[]]) // sin credencial activa
        .mockResolvedValueOnce([[{ id: 99 }]]) // cliente1_api ya existe
        .mockResolvedValueOnce([[]]) // cliente1_api2 libre
        .mockResolvedValueOnce([{ insertId: 11 }]); // INSERT

      const resultado = await crearCredencialApi('cliente1', 'admin');
      expect(resultado.api_usuario).toBe('cliente1_api2');
    });
  });

  describe('rotarCredencialApi', () => {
    test('rechaza si la credencial no existe para ese tenant', async () => {
      const pool = { query: jest.fn().mockResolvedValue([[]]) };
      obtenerPool.mockReturnValue(pool);
      await expect(rotarCredencialApi(1, 'cliente1', 'admin')).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    test('genera password/clave nuevos y actualiza la fila', async () => {
      const pool = { query: jest.fn() };
      obtenerPool.mockReturnValue(pool);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, tenant_slug: 'cliente1', api_usuario: 'cliente1_api' }]]) // SELECT
        .mockResolvedValueOnce([{}]); // UPDATE

      const resultado = await rotarCredencialApi(1, 'cliente1', 'admin');

      expect(resultado.password_plano).toHaveLength(24);
      expect(resultado.clave_api.startsWith('sk_')).toBe(true);
      expect(pool.query.mock.calls[1][0]).toMatch(/UPDATE api_credenciales/);
    });
  });

  describe('revocarCredencialApi', () => {
    test('rechaza si la credencial no existe para ese tenant', async () => {
      const pool = { query: jest.fn().mockResolvedValue([[]]) };
      obtenerPool.mockReturnValue(pool);
      await expect(revocarCredencialApi(1, 'cliente1')).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    test('marca activo=0 (soft revoke) cuando la credencial existe', async () => {
      const pool = { query: jest.fn() };
      obtenerPool.mockReturnValue(pool);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, tenant_slug: 'cliente1' }]])
        .mockResolvedValueOnce([{}]);

      const resultado = await revocarCredencialApi(1, 'cliente1');
      expect(resultado).toEqual({ ok: true });
      expect(pool.query.mock.calls[1][0]).toMatch(/SET activo = 0/);
    });
  });
});
