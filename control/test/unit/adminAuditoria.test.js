const { asegurarTablaAuditoria, registrarAccesoAdmin } = require('../../utils/adminAuditoria');

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');

describe('utils/adminAuditoria.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('asegurarTablaAuditoria', () => {
    test('ejecuta el CREATE TABLE IF NOT EXISTS contra la BD dada', async () => {
      const db = { query: jest.fn().mockResolvedValue([{}]) };
      await asegurarTablaAuditoria(db);
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).toMatch(/CREATE TABLE IF NOT EXISTS admin_auditoria/);
    });

    test('usa obtenerPool() por defecto si no se pasa una BD', async () => {
      const pool = { query: jest.fn().mockResolvedValue([{}]) };
      obtenerPool.mockReturnValue(pool);
      await asegurarTablaAuditoria();
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('registrarAccesoAdmin', () => {
    test('inserta con todos los campos esperados en el orden correcto', async () => {
      const db = { query: jest.fn().mockResolvedValue([{}]) };
      await registrarAccesoAdmin(
        {
          actor: 'admin',
          mecanismo: 'admin_users',
          perfil: 'super',
          tenantSlug: 'cliente1',
          metodo: 'GET',
          ruta: '/api/control/tenants',
          estatus: 200,
          ip: '127.0.0.1',
        },
        db
      );
      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO admin_auditoria/);
      expect(params).toEqual([
        expect.any(Date),
        'admin',
        'admin_users',
        'super',
        'cliente1',
        'GET',
        '/api/control/tenants',
        200,
        '127.0.0.1',
      ]);
    });

    test('normaliza tenantSlug e ip ausentes a null (acceso sin tenant/sin IP conocida)', async () => {
      const db = { query: jest.fn().mockResolvedValue([{}]) };
      await registrarAccesoAdmin(
        { actor: 'admin', mecanismo: 'admin_users', perfil: 'super', metodo: 'GET', ruta: '/health', estatus: 200 },
        db
      );
      const [, params] = db.query.mock.calls[0];
      expect(params[4]).toBeNull(); // tenant_slug
      expect(params[8]).toBeNull(); // ip
    });

    test('usa obtenerPool() por defecto si no se pasa una BD', async () => {
      const pool = { query: jest.fn().mockResolvedValue([{}]) };
      obtenerPool.mockReturnValue(pool);
      await registrarAccesoAdmin({
        actor: 'admin',
        mecanismo: 'admin_users',
        perfil: 'super',
        metodo: 'GET',
        ruta: '/health',
        estatus: 200,
      });
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });
});
