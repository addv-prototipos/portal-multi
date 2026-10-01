// Pruebas de utils/planes.js (punto 347) — catálogo de planes,
// independiente de cualquier tenant. BD mockeada a mano, mismo patrón
// que sucursales.test.js.

jest.mock('../../db', () => ({ obtenerPool: jest.fn() }));

const {
  ErrorPlan,
  listarPlanes,
  obtenerPlan,
  crearPlan,
  actualizarPlan,
  archivarPlan,
  reactivarPlan,
} = require('../../utils/planes');

function mockDb() {
  return { query: jest.fn() };
}

function filaPlan(extra = {}) {
  return {
    id: 1,
    nombre: 'Pro',
    descripcion: 'Incluye sucursales y Facturación.',
    precio_mensual: '1490.00',
    precio_anual: '14900.00',
    max_usuarios: 15,
    sucursales_habilitado: 1,
    facturacion_habilitada: 1,
    portal_clientes_habilitado: 1,
    marca_lookfeel_habilitado: 0,
    disco_cuota_mb: 2048,
    activo: 1,
    orden: 2,
    creado_en: new Date('2026-09-30'),
    actualizado_en: new Date('2026-09-30'),
    total_tenants: 3,
    ...extra,
  };
}

describe('utils/planes.js (punto 347)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listarPlanes', () => {
    test('por defecto solo trae planes activos (activo = 1 en el WHERE)', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[filaPlan()]]);

      const planes = await listarPlanes({}, db);

      expect(db.query.mock.calls[0][0]).toMatch(/WHERE p\.activo = 1/);
      expect(planes).toHaveLength(1);
      expect(planes[0]).toMatchObject({ id: 1, nombre: 'Pro', precio_mensual: 1490, total_tenants: 3 });
      expect(planes[0].sucursales_habilitado).toBe(true);
      expect(planes[0].marca_lookfeel_habilitado).toBe(false);
    });

    test('incluirArchivados=true: no filtra por activo', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[filaPlan({ activo: 0 })]]);

      const planes = await listarPlanes({ incluirArchivados: true }, db);

      expect(db.query.mock.calls[0][0]).not.toMatch(/WHERE p\.activo = 1/);
      expect(planes[0].activo).toBe(false);
    });
  });

  describe('obtenerPlan', () => {
    test('plan inexistente: ErrorPlan no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);

      await expect(obtenerPlan(999, db)).rejects.toMatchObject({ name: 'ErrorPlan', codigo: 'no_encontrado' });
    });

    test('convierte precios/cuotas a Number y flags a Boolean', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[filaPlan({ precio_anual: null, disco_cuota_mb: null, max_usuarios: null })]]);

      const plan = await obtenerPlan(1, db);

      expect(plan.precio_mensual).toBe(1490);
      expect(plan.precio_anual).toBeNull();
      expect(plan.disco_cuota_mb).toBeNull();
      expect(plan.max_usuarios).toBeNull();
    });
  });

  describe('crearPlan', () => {
    test('rechaza nombre vacío sin tocar la BD', async () => {
      const db = mockDb();
      await expect(crearPlan({ nombre: '   ' }, db)).rejects.toMatchObject({
        name: 'ErrorPlan',
        codigo: 'validacion',
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    test('rechaza max_usuarios no entero', async () => {
      const db = mockDb();
      await expect(crearPlan({ nombre: 'Básico', max_usuarios: 2.5 }, db)).rejects.toMatchObject({
        codigo: 'validacion',
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    test('crea el plan con activo=1 hardcodeado en el SQL (no viaja como param) y recarga con obtenerPlan', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([{ insertId: 7 }]) // INSERT
        .mockResolvedValueOnce([[filaPlan({ id: 7 })]]); // obtenerPlan

      const plan = await crearPlan({ nombre: 'Pro', max_usuarios: 15, facturacion_habilitada: true }, db);

      expect(plan.id).toBe(7);
      const [sqlInsert, params] = db.query.mock.calls[0];
      expect(sqlInsert).toMatch(/INSERT INTO planes/);
      expect(sqlInsert).toMatch(/VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, 1, \?, \?, \?\)/);
      expect(params).toHaveLength(13); // 10 antes del "1" literal + orden/creado_en/actualizado_en
      expect(params[0]).toBe('Pro');
      expect(params[4]).toBe(15); // max_usuarios
      expect(params[6]).toBe(1); // facturacion_habilitada normalizado a 1
    });

    test('campos booleanos ausentes se normalizan a 0 (apagado por default en un plan nuevo)', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([{ insertId: 8 }]).mockResolvedValueOnce([[filaPlan({ id: 8 })]]);

      await crearPlan({ nombre: 'Básico' }, db);

      const [, params] = db.query.mock.calls[0];
      // orden: nombre, descripcion, precio_mensual, precio_anual, max_usuarios,
      // sucursales_habilitado, facturacion_habilitada, portal_clientes_habilitado,
      // marca_lookfeel_habilitado, disco_cuota_mb, orden, creado_en, actualizado_en
      expect(params[5]).toBe(0); // sucursales_habilitado
      expect(params[6]).toBe(0); // facturacion_habilitada
      expect(params[7]).toBe(0); // portal_clientes_habilitado
      expect(params[8]).toBe(0); // marca_lookfeel_habilitado
    });
  });

  describe('actualizarPlan', () => {
    test('plan inexistente: ErrorPlan no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);

      await expect(actualizarPlan(999, { nombre: 'X' }, db)).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    test('sin campos en el body: ErrorPlan validacion, sin UPDATE', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // existe

      await expect(actualizarPlan(1, {}, db)).rejects.toMatchObject({ codigo: 'validacion' });
      expect(db.query).toHaveBeenCalledTimes(1); // solo el SELECT de existencia
    });

    test('edición parcial: solo actualiza los campos presentes en el body', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // existe
        .mockResolvedValueOnce([{}]) // UPDATE
        .mockResolvedValueOnce([[filaPlan({ facturacion_habilitada: 0 })]]); // obtenerPlan

      await actualizarPlan(1, { facturacion_habilitada: false }, db);

      const [sqlUpdate] = db.query.mock.calls[1];
      expect(sqlUpdate).toMatch(/UPDATE planes SET facturacion_habilitada = \?, actualizado_en = \? WHERE id = \?/);
    });
  });

  describe('archivarPlan / reactivarPlan', () => {
    test('archivarPlan: set activo=0, no toca tenants ya asignados', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]]) // existe
        .mockResolvedValueOnce([{}]) // UPDATE activo=0
        .mockResolvedValueOnce([[filaPlan({ activo: 0 })]]); // obtenerPlan

      const plan = await archivarPlan(1, db);

      expect(plan.activo).toBe(false);
      expect(db.query.mock.calls[1][0]).toMatch(/UPDATE planes SET activo = 0/);
    });

    test('archivarPlan en plan inexistente: ErrorPlan no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);

      await expect(archivarPlan(999, db)).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    test('reactivarPlan: set activo=1', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ id: 1 }]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([[filaPlan({ activo: 1 })]]);

      const plan = await reactivarPlan(1, db);

      expect(plan.activo).toBe(true);
      expect(db.query.mock.calls[1][0]).toMatch(/UPDATE planes SET activo = 1/);
    });
  });
});
