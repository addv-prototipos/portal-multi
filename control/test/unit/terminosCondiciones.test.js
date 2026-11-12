// Pruebas de utils/terminosCondiciones.js — punto en curso (nombre real +
// evidencia de aceptación de T&C): registrarAceptacion() ahora guarda una
// foto de nombre_completo/email junto con usuario/ip/fecha, y
// listarHistorialGlobal() es la fuente de la vista nueva de /control.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { registrarAceptacion, listarHistorialGlobal, listarHistorialTenant } = require('../../utils/terminosCondiciones');

describe('utils/terminosCondiciones.js', () => {
  let pool;

  beforeEach(() => {
    pool = { query: jest.fn() };
    obtenerPool.mockReturnValue(pool);
  });

  describe('registrarAceptacion', () => {
    test('guarda nombre_completo y email junto con usuario/ip/version', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      await registrarAceptacion({
        tenantSlug: 'panaderia-espiga',
        usuario: 'ADMIN1',
        versionId: 7,
        ip: '187.188.44.12',
        nombreCompleto: 'María Fernanda Torres López',
        email: 'maria@panaderiaespiga.mx',
      });

      const [sql, valores] = pool.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO terminos_aceptaciones/);
      expect(sql).toMatch(/nombre_completo/);
      expect(sql).toMatch(/email/);
      expect(valores).toEqual([
        'panaderia-espiga',
        'ADMIN1',
        7,
        expect.any(Date),
        '187.188.44.12',
        'María Fernanda Torres López',
        'maria@panaderiaespiga.mx',
      ]);
    });

    test('sin nombreCompleto/email (nunca deberían faltar, pero no bloquea el registro): guarda null', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      await registrarAceptacion({ tenantSlug: 'panaderia-espiga', usuario: 'ADMIN1', versionId: 7, ip: null });

      const [, valores] = pool.query.mock.calls[0];
      expect(valores[5]).toBeNull();
      expect(valores[6]).toBeNull();
    });

    test('sin tenantSlug: usa el sentinel __base__', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      await registrarAceptacion({ usuario: 'ADMIN1', versionId: 7 });
      const [, valores] = pool.query.mock.calls[0];
      expect(valores[0]).toBe('__base__');
    });
  });

  describe('listarHistorialTenant', () => {
    test('selecciona nombre_completo y email además de usuario/ip/fecha/versión', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await listarHistorialTenant('panaderia-espiga');
      const [sql, valores] = pool.query.mock.calls[0];
      expect(sql).toMatch(/a\.nombre_completo/);
      expect(sql).toMatch(/a\.email/);
      expect(valores).toEqual(['panaderia-espiga']);
    });
  });

  describe('listarHistorialGlobal', () => {
    test('trae filas de todas las empresas + el total, con límite/offset por default', async () => {
      pool.query.mockResolvedValueOnce([
        [
          { tenant_slug: 'panaderia-espiga', nombre_empresa: 'Panadería La Espiga', usuario: 'ADMIN1', nombre_completo: 'María Fernanda Torres López', email: 'maria@panaderiaespiga.mx', aceptado_en: '2026-11-12 09:14:00', ip: '187.188.44.12', version: '2.1' },
        ],
      ]);
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]);

      const resultado = await listarHistorialGlobal({});

      expect(resultado.total).toBe(1);
      expect(resultado.filas).toHaveLength(1);
      const [sql, parametros] = pool.query.mock.calls[0];
      expect(sql).toMatch(/LEFT JOIN tenants/);
      expect(sql).toMatch(/COALESCE\(t\.nombre_empresa, 'Sitio base ADDV'\)/);
      expect(parametros).toEqual([50, 0]);
    });

    test('respeta limit/offset pedidos, acotado a un máximo de 200', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([[{ total: 0 }]]);
      await listarHistorialGlobal({ limit: 999, offset: 40 });
      const [, parametros] = pool.query.mock.calls[0];
      expect(parametros).toEqual([200, 40]);
    });
  });
});
