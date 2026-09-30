// Pruebas de utils/tenantLifecycle.js (segmento 9, movido a este
// contenedor propio en el segmento 9b — ver PROJECT_STATE.md). Mismo
// patrón de mock que backend/test/unit/adminAuditoria.test.js: se
// mockea `../../db` y `../../utils/notificarBackend` por completo —
// aquí solo interesa que este módulo arme las consultas y llamadas
// correctas, no el comportamiento real de MySQL. A diferencia de la
// versión anterior (en backend/), registrarEvento ahora es una función
// local (no un módulo aparte mockeable) — se verifica revisando
// directamente la 3ra llamada a `db.query` (el INSERT a tenant_eventos).

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/notificarBackend', () => ({
  notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
  activarTenantFisico: jest.fn().mockResolvedValue({ ok: true, dbName: 'tenant_cliente1' }),
  eliminarTenantFisico: jest.fn().mockResolvedValue({ ok: true }),
}));

const { obtenerPool } = require('../../db');
const { notificarInvalidacionCache, activarTenantFisico, eliminarTenantFisico } = require('../../utils/notificarBackend');
const {
  ErrorTransicionTenant,
  listarTenants,
  obtenerTenantPorSlug,
  activarTenant,
  suspenderTenant,
  reactivarTenant,
  darDeBajaTenant,
  eliminarTenantDefinitivo,
  vaciarPapelera,
} = require('../../utils/tenantLifecycle');

const TENANT_FILA = {
  id: 7,
  slug: 'cliente1',
  nombre_empresa: 'Empresa Uno',
  estado: 'activo',
  contacto_email: 'contacto@empresauno.com',
  creado_en: '2026-01-01 00:00:00',
  activado_en: null,
  suspendido_en: null,
  baja_en: null,
};

function mockPool() {
  const pool = { query: jest.fn().mockResolvedValue([[]]) };
  obtenerPool.mockReturnValue(pool);
  return pool;
}

describe('utils/tenantLifecycle.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listarTenants', () => {
    test('sin filtros, consulta sin WHERE', async () => {
      const pool = mockPool();

      await listarTenants();

      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).not.toMatch(/WHERE/);
      expect(params).toEqual([]);
    });

    test('con estado y q, arma el WHERE con LIKE en slug/nombre_empresa', async () => {
      const pool = mockPool();

      await listarTenants({ estado: 'activo', q: 'uno' });

      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toMatch(/WHERE estado = \? AND \(slug LIKE \? OR nombre_empresa LIKE \?\)/);
      expect(params).toEqual(['activo', '%uno%', '%uno%']);
    });
  });

  describe('obtenerTenantPorSlug', () => {
    test('devuelve null si no existe', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      const resultado = await obtenerTenantPorSlug('no-existe');

      expect(resultado).toBeNull();
    });

    test('devuelve la fila si existe', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[TENANT_FILA]]);

      const resultado = await obtenerTenantPorSlug('cliente1');

      expect(resultado).toEqual(TENANT_FILA);
    });
  });

  describe('activarTenant', () => {
    test('provisioning -> activo: verifica estado, crea la BD física en el backend y actualiza', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'provisioning' }]]) // obtenerTenantPorSlug inicial
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE (aplicarTransicion)
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'activo' }]]) // obtenerTenantPorSlug posterior
        .mockResolvedValueOnce([{}]); // registrarEvento (INSERT)

      const resultado = await activarTenant('cliente1', { actor: 'admin' });

      expect(activarTenantFisico).toHaveBeenCalledWith('cliente1');
      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[1];
      expect(sqlUpdate).toMatch(/SET estado = \?, activado_en = NOW\(\) WHERE slug = \? AND estado IN \(\?\)/);
      expect(paramsUpdate).toEqual(['activo', 'cliente1', 'provisioning']);
      const [, paramsInsert] = pool.query.mock.calls[3];
      expect(paramsInsert).toEqual([7, 'alta_completada', expect.any(String), 'admin', expect.any(Date)]);
      expect(resultado.estado).toBe('activo');
    });

    test('slug inexistente -> ErrorTransicionTenant "no_encontrado", nunca llama al backend', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      const error = await activarTenant('fantasma', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('no_encontrado');
      expect(activarTenantFisico).not.toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('estado distinto de "provisioning" -> ErrorTransicionTenant "estado_invalido", nunca llama al backend', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'activo' }]]);

      const error = await activarTenant('cliente1', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('estado_invalido');
      expect(activarTenantFisico).not.toHaveBeenCalled();
    });

    test('el backend falla al crear la BD física -> ErrorTransicionTenant "error_fisico", nunca marca "activo"', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'provisioning' }]]);
      activarTenantFisico.mockRejectedValueOnce(new Error('No se pudo crear la base de datos del tenant.'));

      const error = await activarTenant('cliente1', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('error_fisico');
      // Ningún UPDATE se disparó tras el fallo físico — solo la consulta inicial.
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('suspenderTenant', () => {
    test('UPDATE con guarda de estado, registra evento y notifica al backend', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'suspendido' }]]) // obtenerTenantPorSlug posterior
        .mockResolvedValueOnce([{}]); // registrarEvento (INSERT)

      const resultado = await suspenderTenant('cliente1', { actor: 'admin' });

      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[0];
      expect(sqlUpdate).toMatch(/UPDATE tenants SET estado = \?, suspendido_en = NOW\(\) WHERE slug = \? AND estado IN \(\?\)/);
      expect(paramsUpdate).toEqual(['suspendido', 'cliente1', 'activo']);

      const [sqlInsert, paramsInsert] = pool.query.mock.calls[2];
      expect(sqlInsert).toMatch(/INSERT INTO tenant_eventos/);
      expect(paramsInsert).toEqual([7, 'suspension', expect.any(String), 'admin', expect.any(Date)]);

      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');
      expect(resultado.estado).toBe('suspendido');
    });

    test('affectedRows=0 y el tenant no existe -> ErrorTransicionTenant "no_encontrado"', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([[]]);

      const error = await suspenderTenant('fantasma', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('no_encontrado');
      expect(pool.query).toHaveBeenCalledTimes(2); // sin INSERT de evento
      expect(notificarInvalidacionCache).not.toHaveBeenCalled();
    });

    test('affectedRows=0 pero el tenant existe en otro estado -> ErrorTransicionTenant "estado_invalido"', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'baja' }]]);

      const error = await suspenderTenant('cliente1', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('estado_invalido');
    });

    test('un fallo al notificar al backend no tumba la transición (fire-and-forget)', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'suspendido' }]])
        .mockResolvedValueOnce([{}]);
      notificarInvalidacionCache.mockRejectedValueOnce(new Error('backend no alcanzable'));

      await expect(suspenderTenant('cliente1', { actor: 'admin' })).resolves.toMatchObject({ estado: 'suspendido' });
    });
  });

  describe('reactivarTenant', () => {
    test('permite la transición desde "suspendido" o "baja"', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'activo' }]])
        .mockResolvedValueOnce([{}]);

      await reactivarTenant('cliente1', { actor: 'admin' });

      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[0];
      expect(sqlUpdate).toMatch(/SET estado = \?, activado_en = NOW\(\) WHERE slug = \? AND estado IN \(\?,\?\)/);
      expect(paramsUpdate).toEqual(['activo', 'cliente1', 'suspendido', 'baja']);
      const [, paramsInsert] = pool.query.mock.calls[2];
      expect(paramsInsert).toEqual([7, 'reactivacion', expect.any(String), 'admin', expect.any(Date)]);
    });
  });

  describe('darDeBajaTenant', () => {
    test('permite la transición desde "activo" o "suspendido"', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'baja' }]])
        .mockResolvedValueOnce([{}]);

      await darDeBajaTenant('cliente1', { actor: 'admin' });

      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[0];
      expect(sqlUpdate).toMatch(/SET estado = \?, baja_en = NOW\(\) WHERE slug = \? AND estado IN \(\?,\?\)/);
      expect(paramsUpdate).toEqual(['baja', 'cliente1', 'activo', 'suspendido']);
      const [, paramsInsert] = pool.query.mock.calls[2];
      expect(paramsInsert).toEqual([7, 'baja', expect.any(String), 'admin', expect.any(Date)]);
    });

    test('rechaza la transición si el tenant ya está en "baja"', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'baja' }]]);

      const error = await darDeBajaTenant('cliente1', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('estado_invalido');
    });
  });

  describe('eliminarTenantDefinitivo', () => {
    test('desde "baja": llama a eliminarTenantFisico y devuelve la fila', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'baja' }]]);

      const resultado = await eliminarTenantDefinitivo('cliente1', { actor: 'admin' });

      expect(eliminarTenantFisico).toHaveBeenCalledWith('cliente1');
      expect(resultado.estado).toBe('baja');
    });

    test('slug inexistente -> ErrorTransicionTenant "no_encontrado", nunca llama al backend', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      const error = await eliminarTenantDefinitivo('fantasma', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('no_encontrado');
      expect(eliminarTenantFisico).not.toHaveBeenCalled();
    });

    test('estado distinto de "baja" (ej. "activo") -> ErrorTransicionTenant "estado_invalido", candado de seguridad', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'activo' }]]);

      const error = await eliminarTenantDefinitivo('cliente1', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('estado_invalido');
      expect(eliminarTenantFisico).not.toHaveBeenCalled();
    });

    test('el backend falla al eliminar la BD física -> ErrorTransicionTenant "error_fisico"', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ ...TENANT_FILA, estado: 'baja' }]]);
      eliminarTenantFisico.mockRejectedValueOnce(new Error('No se pudo borrar la base de datos del tenant.'));

      const error = await eliminarTenantDefinitivo('cliente1', { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorTransicionTenant);
      expect(error.codigo).toBe('error_fisico');
    });
  });

  describe('vaciarPapelera', () => {
    test('elimina todos los tenants en "baja", uno por uno', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[
          { ...TENANT_FILA, id: 1, slug: 'uno', estado: 'baja' },
          { ...TENANT_FILA, id: 2, slug: 'dos', estado: 'baja' },
        ]]) // listarTenants({estado:'baja'})
        .mockResolvedValueOnce([[{ ...TENANT_FILA, id: 1, slug: 'uno', estado: 'baja' }]]) // obtenerTenantPorSlug('uno')
        .mockResolvedValueOnce([[{ ...TENANT_FILA, id: 2, slug: 'dos', estado: 'baja' }]]); // obtenerTenantPorSlug('dos')

      const resultado = await vaciarPapelera({ actor: 'admin' });

      expect(eliminarTenantFisico).toHaveBeenCalledWith('uno');
      expect(eliminarTenantFisico).toHaveBeenCalledWith('dos');
      expect(resultado.eliminados).toEqual(['uno', 'dos']);
      expect(resultado.fallidos).toEqual([]);
    });

    test('un tenant que falla no detiene a los demás — se reporta en "fallidos"', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[
          { ...TENANT_FILA, id: 1, slug: 'uno', estado: 'baja' },
          { ...TENANT_FILA, id: 2, slug: 'dos', estado: 'baja' },
        ]])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, id: 1, slug: 'uno', estado: 'baja' }]])
        .mockResolvedValueOnce([[{ ...TENANT_FILA, id: 2, slug: 'dos', estado: 'baja' }]]);
      eliminarTenantFisico.mockImplementationOnce(() => Promise.reject(new Error('MySQL no disponible')));
      eliminarTenantFisico.mockImplementationOnce(() => Promise.resolve({ ok: true }));

      const resultado = await vaciarPapelera({ actor: 'admin' });

      expect(resultado.eliminados).toEqual(['dos']);
      expect(resultado.fallidos).toEqual([{ slug: 'uno', error: 'MySQL no disponible' }]);
    });

    test('papelera vacía: no llama a eliminarTenantFisico ni una vez', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      const resultado = await vaciarPapelera({ actor: 'admin' });

      expect(eliminarTenantFisico).not.toHaveBeenCalled();
      expect(resultado).toEqual({ eliminados: [], fallidos: [] });
    });
  });
});
