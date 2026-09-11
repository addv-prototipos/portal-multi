// Pruebas del middleware de resolución de tenant (segmento 3 del plan
// multi-tenant, ver PROJECT_STATE.md). Mockea `../../db` por completo
// (mismo patrón que el resto de la suite, ver test/unit/config.test.js) —
// a diferencia de test/unit/db-multitenant.test.js, aquí no interesa el
// comportamiento REAL del registro de pools, solo que este middleware lo
// use correctamente.

jest.mock('../../db', () => ({
  obtenerPoolControl: jest.fn(),
  obtenerPoolTenant: jest.fn(),
  ejecutarComoTenant: jest.fn((pool, fn) => fn()),
}));

const { obtenerPoolControl, obtenerPoolTenant, ejecutarComoTenant } = require('../../db');
const {
  resolverTenantMiddleware,
  resolverTenantPorSlug,
  invalidarCacheTenant,
} = require('../../utils/tenantContext');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockPoolControl(filas) {
  const poolControl = { query: jest.fn().mockResolvedValue([filas]) };
  obtenerPoolControl.mockReturnValue(poolControl);
  return poolControl;
}

const FILA_TENANT_ACTIVO = {
  id: 1,
  slug: 'cliente1',
  nombre_empresa: 'Cliente Uno S.A.',
  estado: 'activo',
  db_host: 'mysql',
  db_name: 'tenant_cliente1',
  db_user: 'app',
  marca: 'Cliente Uno',
  marca_logo_url: '/api/marca-logo/cliente1',
};

describe('utils/tenantContext.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidarCacheTenant(); // la caché es estado de módulo compartido entre pruebas
  });

  describe('resolverTenantMiddleware', () => {
    test('sin encabezado X-Tenant-Slug, es un no-op: llama a next() sin tocar la base de datos', async () => {
      const req = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.tenant).toBeUndefined();
      expect(obtenerPoolControl).not.toHaveBeenCalled();
    });

    test('slug con formato inválido responde 400 sin tocar la base de datos', async () => {
      const req = { headers: { 'x-tenant-slug': 'Slug Invalido!' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
      expect(obtenerPoolControl).not.toHaveBeenCalled();
    });

    test('slug reservado (ej. "admin") responde 400', async () => {
      const req = { headers: { 'x-tenant-slug': 'admin' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('slug válido pero no encontrado (o no activo) responde 404', async () => {
      mockPoolControl([]);
      const req = { headers: { 'x-tenant-slug': 'no-existe' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    test('segmento 7: un slug no encontrado paga el costo artificial anti-enumeración antes del 404', async () => {
      const crypto = require('crypto');
      const scryptSpy = jest.spyOn(crypto, 'scryptSync');
      mockPoolControl([]);
      const req = { headers: { 'x-tenant-slug': 'no-existe' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(scryptSpy).toHaveBeenCalledTimes(1);
      scryptSpy.mockRestore();
    });

    test('segmento 7: un slug encontrado NO paga el costo artificial (solo se aplica en la rama 404)', async () => {
      const crypto = require('crypto');
      const scryptSpy = jest.spyOn(crypto, 'scryptSync');
      mockPoolControl([FILA_TENANT_ACTIVO]);
      obtenerPoolTenant.mockReturnValue({ query: jest.fn() });
      const req = { headers: { 'x-tenant-slug': 'cliente1' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(scryptSpy).not.toHaveBeenCalled();
      scryptSpy.mockRestore();
    });

    test('slug válido y activo: resuelve req.tenant, obtiene el pool del tenant y corre next() dentro de ejecutarComoTenant', async () => {
      mockPoolControl([FILA_TENANT_ACTIVO]);
      const poolTenantFalso = { query: jest.fn() };
      obtenerPoolTenant.mockReturnValue(poolTenantFalso);

      const req = { headers: { 'x-tenant-slug': 'cliente1' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(req.tenant).toEqual({
        id: 1,
        slug: 'cliente1',
        nombreEmpresa: 'Cliente Uno S.A.',
        marca: 'Cliente Uno',
        marcaLogoUrl: '/api/marca-logo/cliente1',
        temaJson: null,
        grupoSucursalId: null,
        contactoEmail: null,
        marcaLookfeelHabilitado: true,
        maxUsuarios: null,
      });
      expect(obtenerPoolTenant).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'cliente1', host: 'mysql', database: 'tenant_cliente1', user: 'app' })
      );
    });

    // §58: un tenant asociado a un grupo de sucursales expone
    // grupoSucursalId — es lo que consulta requireAdminAuth (usuarios
    // compartidos) y GET /api/admin/sucursales-hermanas.
    test('tenant con grupo_sucursal_id expone grupoSucursalId en req.tenant', async () => {
      mockPoolControl([{ ...FILA_TENANT_ACTIVO, grupo_sucursal_id: 5 }]);
      obtenerPoolTenant.mockReturnValue({ query: jest.fn() });

      const req = { headers: { 'x-tenant-slug': 'cliente1' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(req.tenant.grupoSucursalId).toBe(5);
      expect(next).toHaveBeenCalledTimes(1);
    });

    // Punto 170: correo de contacto de la empresa cliente, usado por la
    // burbuja "Solicitar aclaraciones" del portal. Null en tenants viejos
    // que no lo llenaron todavía (la burbuja se oculta en ese caso).
    test('tenant con contacto_email lo expone como contactoEmail en req.tenant', async () => {
      mockPoolControl([{ ...FILA_TENANT_ACTIVO, contacto_email: 'contacto@cliente1.com' }]);
      obtenerPoolTenant.mockReturnValue({ query: jest.fn() });

      const req = { headers: { 'x-tenant-slug': 'cliente1' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(req.tenant.contactoEmail).toBe('contacto@cliente1.com');
    });

    test('tenant sin contacto_email expone contactoEmail null', async () => {
      mockPoolControl([FILA_TENANT_ACTIVO]);
      obtenerPoolTenant.mockReturnValue({ query: jest.fn() });

      const req = { headers: { 'x-tenant-slug': 'cliente1' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(req.tenant.contactoEmail).toBeNull();
    });

    test('el slug del encabezado se normaliza a minúsculas', async () => {
      const poolControl = mockPoolControl([FILA_TENANT_ACTIVO]);
      obtenerPoolTenant.mockReturnValue({ query: jest.fn() });

      const req = { headers: { 'x-tenant-slug': 'CLIENTE1' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(poolControl.query).toHaveBeenCalledWith(expect.any(String), ['cliente1']);
    });

    test('un error consultando la base de control responde 503 sin llamar a next()', async () => {
      obtenerPoolControl.mockReturnValue({ query: jest.fn().mockRejectedValue(new Error('conexión perdida')) });

      const req = { headers: { 'x-tenant-slug': 'cliente1' } };
      const res = mockRes();
      const next = jest.fn();

      await resolverTenantMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('resolverTenantPorSlug — caché con TTL', () => {
    test('una segunda resolución del mismo slug dentro del TTL no vuelve a consultar la base de datos', async () => {
      const poolControl = mockPoolControl([FILA_TENANT_ACTIVO]);

      await resolverTenantPorSlug('cliente1');
      await resolverTenantPorSlug('cliente1');

      expect(poolControl.query).toHaveBeenCalledTimes(1);
    });

    test('invalidarCacheTenant(slug) fuerza una nueva consulta para ese slug', async () => {
      const poolControl = mockPoolControl([FILA_TENANT_ACTIVO]);

      await resolverTenantPorSlug('cliente1');
      invalidarCacheTenant('cliente1');
      await resolverTenantPorSlug('cliente1');

      expect(poolControl.query).toHaveBeenCalledTimes(2);
    });

    test('invalidarCacheTenant() sin argumento limpia toda la caché', async () => {
      const poolControl = mockPoolControl([FILA_TENANT_ACTIVO]);

      await resolverTenantPorSlug('cliente1');
      invalidarCacheTenant();
      await resolverTenantPorSlug('cliente1');

      expect(poolControl.query).toHaveBeenCalledTimes(2);
    });
  });
});
