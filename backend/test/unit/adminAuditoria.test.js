// Pruebas de utils/adminAuditoria.js (segmento 7 del plan multi-tenant,
// ver PROJECT_STATE.md). Mismo patrón de mock que tenantContext.test.js:
// se mockea `../../db` por completo, aquí solo interesa que este módulo
// arme las consultas correctas, no el comportamiento real de MySQL.

jest.mock('../../db', () => ({
  obtenerPoolControl: jest.fn(),
}));

const { obtenerPoolControl } = require('../../db');
const {
  asegurarTablaAuditoria,
  registrarAccesoAdmin,
  listarAuditoria,
} = require('../../utils/adminAuditoria');

function mockPoolControl() {
  const poolControl = { query: jest.fn().mockResolvedValue([[]]) };
  obtenerPoolControl.mockReturnValue(poolControl);
  return poolControl;
}

describe('utils/adminAuditoria.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('asegurarTablaAuditoria', () => {
    test('emite un CREATE TABLE IF NOT EXISTS (idempotente, seguro de re-correr)', async () => {
      const poolControl = mockPoolControl();

      await asegurarTablaAuditoria();

      expect(poolControl.query).toHaveBeenCalledTimes(1);
      expect(poolControl.query.mock.calls[0][0]).toMatch(/CREATE TABLE IF NOT EXISTS admin_auditoria/);
    });

    test('acepta un pool explícito en vez del de control por defecto', async () => {
      const poolExplicito = { query: jest.fn().mockResolvedValue([[]]) };

      await asegurarTablaAuditoria(poolExplicito);

      expect(poolExplicito.query).toHaveBeenCalledTimes(1);
      expect(obtenerPoolControl).not.toHaveBeenCalled();
    });
  });

  describe('registrarAccesoAdmin', () => {
    test('inserta con todos los campos, incluyendo tenantSlug', async () => {
      const poolControl = mockPoolControl();

      await registrarAccesoAdmin({
        actor: 'admin',
        mecanismo: 'admin_users',
        perfil: 'super',
        tenantSlug: 'cliente1',
        metodo: 'POST',
        ruta: '/config',
        estatus: 200,
        ip: '10.0.0.1',
      });

      expect(poolControl.query).toHaveBeenCalledTimes(1);
      const [sql, params] = poolControl.query.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO admin_auditoria/);
      expect(params).toEqual([
        expect.any(Date),
        'admin',
        'admin_users',
        'super',
        'cliente1',
        'POST',
        '/config',
        200,
        '10.0.0.1',
      ]);
    });

    test('sin tenantSlug ni ip, inserta NULL en vez de undefined', async () => {
      const poolControl = mockPoolControl();

      await registrarAccesoAdmin({
        actor: 'admin',
        mecanismo: 'fallback_admin',
        perfil: 'super',
        metodo: 'GET',
        ruta: '/login',
        estatus: 200,
      });

      const [, params] = poolControl.query.mock.calls[0];
      expect(params[4]).toBeNull(); // tenantSlug
      expect(params[8]).toBeNull(); // ip
    });

    test('un fallo del INSERT se propaga (el llamador es responsable del fire-and-forget)', async () => {
      const poolControl = { query: jest.fn().mockRejectedValue(new Error('conexión perdida')) };
      obtenerPoolControl.mockReturnValue(poolControl);

      await expect(
        registrarAccesoAdmin({
          actor: 'admin',
          mecanismo: 'admin_users',
          perfil: 'super',
          metodo: 'GET',
          ruta: '/login',
          estatus: 200,
        })
      ).rejects.toThrow('conexión perdida');
    });
  });

  describe('listarAuditoria', () => {
    test('sin filtros, consulta sin WHERE y con el límite por defecto', async () => {
      const poolControl = mockPoolControl();

      await listarAuditoria();

      const [sql] = poolControl.query.mock.calls[0];
      expect(sql).not.toMatch(/WHERE/);
      expect(sql).toMatch(/LIMIT 100/);
    });

    test('con filtros, arma el WHERE con los parámetros correspondientes', async () => {
      const poolControl = mockPoolControl();

      await listarAuditoria({ actor: 'admin', tenantSlug: 'cliente1' });

      const [sql, params] = poolControl.query.mock.calls[0];
      expect(sql).toMatch(/WHERE actor = \? AND tenant_slug = \?/);
      expect(params).toEqual(['admin', 'cliente1']);
    });

    test('sinTenant filtra por tenant_slug IS NULL (sitio base, punto 244)', async () => {
      const poolControl = mockPoolControl();

      await listarAuditoria({ sinTenant: true });

      const [sql, params] = poolControl.query.mock.calls[0];
      expect(sql).toMatch(/WHERE tenant_slug IS NULL/);
      expect(params).toEqual([]);
    });

    test('tenantSlug tiene prioridad sobre sinTenant si ambos vienen (nunca debería pasar, pero no debe romperse)', async () => {
      const poolControl = mockPoolControl();

      await listarAuditoria({ tenantSlug: 'cliente1', sinTenant: true });

      const [sql, params] = poolControl.query.mock.calls[0];
      expect(sql).toMatch(/WHERE tenant_slug = \?/);
      expect(sql).not.toMatch(/IS NULL/);
      expect(params).toEqual(['cliente1']);
    });

    test('el límite se acota entre 1 y 500', async () => {
      const poolControl = mockPoolControl();

      await listarAuditoria({ limite: 10000 });
      expect(poolControl.query.mock.calls[0][0]).toMatch(/LIMIT 500/);

      poolControl.query.mockClear();
      await listarAuditoria({ limite: -5 });
      expect(poolControl.query.mock.calls[0][0]).toMatch(/LIMIT 1/);
    });
  });
});
