// Pruebas del registro de pools multi-tenant de backend/db.js (segmento 2
// del plan multi-tenant). A diferencia del resto de la suite (que mockea
// `../../db` por completo, ver test/unit/config.test.js), este archivo
// prueba el MÓDULO REAL — mockeando `mysql2/promise` en su lugar, para
// poder inspeccionar cuántos pools se crean y simular su cierre sin una
// base de datos real.
//
// El módulo se carga UNA SOLA VEZ para todo este archivo (nada de
// `jest.resetModules()` entre pruebas): el registro de pools es estado de
// módulo, así que cada prueba usa slugs únicos (nunca reutilizados entre
// pruebas) para no interferir con el estado que dejaron pruebas previas,
// en vez de recargar el módulo completo.

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({
    query: jest.fn(),
    getConnection: jest.fn(),
    execute: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mysql = require('mysql2/promise');
const db = require('../../db');

// Capturado una sola vez, justo después de cargar el módulo: es el pool
// creado por el `mysql.createPool(...)` de nivel de módulo en db.js (el
// pool "por defecto"), antes de que ninguna prueba haya podido llamar
// `mockClear()` y borrar el registro de esa llamada.
const poolPorDefecto = mysql.createPool.mock.results[0].value;

describe('backend/db.js — multi-tenant (segmento 2)', () => {
  // El registro de pools de tenant es estado de módulo compartido por
  // todas las pruebas de este archivo (no se recarga el módulo entre
  // pruebas) — se vacía antes de cada una para que ninguna prueba dependa
  // de pools que dejó viva una prueba anterior. El pool por defecto y el
  // de control NO se ven afectados (viven fuera de este registro).
  beforeEach(async () => {
    await db.cerrarTodosLosPoolsTenant();
  });

  test('cargar el módulo crea exactamente el pool por defecto (comportamiento previo al refactor)', () => {
    expect(mysql.createPool).toHaveBeenCalledTimes(1);
  });

  test('pool exportado es una interfaz utilizable (proxy) con métodos tipo función', () => {
    expect(typeof db.pool.query).toBe('function');
    expect(typeof db.pool.getConnection).toBe('function');
    expect(typeof db.pool.end).toBe('function');
  });

  test('sin contexto de tenant, pool.query delega al pool por defecto', async () => {
    poolPorDefecto.query.mockResolvedValueOnce([[{ ok: 1 }]]);

    const resultado = await db.pool.query('SELECT 1 -- prueba-default');

    expect(poolPorDefecto.query).toHaveBeenCalledWith('SELECT 1 -- prueba-default');
    expect(resultado).toEqual([[{ ok: 1 }]]);
  });

  describe('obtenerPoolTenant', () => {
    test('crea un pool nuevo la primera vez que se pide un slug', () => {
      const antes = mysql.createPool.mock.calls.length;
      db.obtenerPoolTenant({ slug: 'ot-nuevo', host: 'h', port: 3306, user: 'app', password: 'x', database: 'tenant_ot_nuevo' });
      expect(mysql.createPool.mock.calls.length).toBe(antes + 1);
    });

    test('reutiliza el mismo pool en llamadas subsecuentes con el mismo slug', () => {
      const cfg = { slug: 'ot-reuso', database: 'tenant_ot_reuso' };
      const poolA = db.obtenerPoolTenant(cfg);
      const antes = mysql.createPool.mock.calls.length;
      const poolB = db.obtenerPoolTenant(cfg);

      expect(poolB).toBe(poolA);
      expect(mysql.createPool.mock.calls.length).toBe(antes);
    });

    test('slugs distintos obtienen pools distintos', () => {
      const poolA = db.obtenerPoolTenant({ slug: 'ot-distinto-a', database: 'tenant_a' });
      const poolB = db.obtenerPoolTenant({ slug: 'ot-distinto-b', database: 'tenant_b' });
      expect(poolA).not.toBe(poolB);
    });
  });

  describe('cerrarPoolTenant', () => {
    test('cierra el pool y lo quita del registro (una segunda llamada vuelve a crear uno nuevo)', () => {
      const cfg = { slug: 'cerrar-cliente', database: 'tenant_cerrar_cliente' };
      const poolA = db.obtenerPoolTenant(cfg);

      db.cerrarPoolTenant('cerrar-cliente');
      expect(poolA.end).toHaveBeenCalledTimes(1);

      const poolB = db.obtenerPoolTenant(cfg);
      expect(poolB).not.toBe(poolA);
    });

    test('es un no-op seguro si el slug no está registrado', () => {
      expect(() => db.cerrarPoolTenant('no-existe-jamas')).not.toThrow();
    });
  });

  describe('purgarPoolsInactivos (TTL)', () => {
    test('cierra pools inactivos por más del TTL configurado y conserva los recientes', () => {
      process.env.TENANT_POOL_TTL_MS = '10';
      let ahora = 1000;
      const spy = jest.spyOn(Date, 'now').mockImplementation(() => ahora);

      const poolViejo = db.obtenerPoolTenant({ slug: 'ttl-viejo', database: 'tenant_ttl_viejo' });
      ahora += 20; // supera el TTL de 10ms
      const poolReciente = db.obtenerPoolTenant({ slug: 'ttl-reciente', database: 'tenant_ttl_reciente' });

      db.purgarPoolsInactivos();

      expect(poolViejo.end).toHaveBeenCalledTimes(1);
      expect(poolReciente.end).not.toHaveBeenCalled();

      spy.mockRestore();
      delete process.env.TENANT_POOL_TTL_MS;
    });
  });

  describe('cap LRU (TENANT_POOL_MAX)', () => {
    test('al superar el máximo, evictúa el pool menos usado recientemente antes de crear uno nuevo', () => {
      process.env.TENANT_POOL_MAX = '2';

      let ahora = 1000;
      const spy = jest.spyOn(Date, 'now').mockImplementation(() => ahora);

      db.obtenerPoolTenant({ slug: 'lru-a', database: 'tenant_lru_a' });
      ahora += 10;
      db.obtenerPoolTenant({ slug: 'lru-b', database: 'tenant_lru_b' });
      ahora += 10;
      // ya se llegó al máximo configurado — pedir un tenant nuevo debe
      // evictar el menos usado recientemente ('lru-a', el más viejo).
      db.obtenerPoolTenant({ slug: 'lru-c', database: 'tenant_lru_c' });

      const antesDeRecrear = mysql.createPool.mock.calls.length;
      db.obtenerPoolTenant({ slug: 'lru-a', database: 'tenant_lru_a' }); // fue evictado, se crea de nuevo
      expect(mysql.createPool.mock.calls.length).toBe(antesDeRecrear + 1);

      spy.mockRestore();
      delete process.env.TENANT_POOL_MAX;
    });
  });

  describe('cerrarTodosLosPoolsTenant', () => {
    test('cierra todos los pools de tenant activos en ese momento', async () => {
      const poolA = db.obtenerPoolTenant({ slug: 'cerrar-todos-a', database: 'tenant_a' });
      const poolB = db.obtenerPoolTenant({ slug: 'cerrar-todos-b', database: 'tenant_b' });

      await db.cerrarTodosLosPoolsTenant();

      expect(poolA.end).toHaveBeenCalledTimes(1);
      expect(poolB.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('ejecutarComoTenant / AsyncLocalStorage', () => {
    test('dentro del callback, pool.query delega al pool del tenant activo', async () => {
      const poolTenant = db.obtenerPoolTenant({ slug: 'ctx-simple', database: 'tenant_ctx_simple' });
      poolTenant.query.mockResolvedValueOnce([[{ tenant: 'ctx-simple' }]]);

      await db.ejecutarComoTenant(poolTenant, async () => {
        const resultado = await db.pool.query('SELECT 1 -- ctx-simple');
        expect(resultado).toEqual([[{ tenant: 'ctx-simple' }]]);
      });

      expect(poolTenant.query).toHaveBeenCalledWith('SELECT 1 -- ctx-simple');
    });

    test('fuera del callback, pool.query vuelve a delegar al pool por defecto', async () => {
      const poolTenant = db.obtenerPoolTenant({ slug: 'ctx-fuera', database: 'tenant_ctx_fuera' });
      poolPorDefecto.query.mockResolvedValueOnce([[]]);

      await db.ejecutarComoTenant(poolTenant, async () => {
        await db.pool.query('dentro-ctx-fuera');
      });
      await db.pool.query('fuera-ctx-fuera');

      expect(poolPorDefecto.query).toHaveBeenCalledWith('fuera-ctx-fuera');
      expect(poolTenant.query).not.toHaveBeenCalledWith('fuera-ctx-fuera');
    });

    test('llamadas paralelas a tenants distintos no se cruzan (aislamiento del contexto async)', async () => {
      const poolA = db.obtenerPoolTenant({ slug: 'ctx-paralelo-a', database: 'tenant_a' });
      const poolB = db.obtenerPoolTenant({ slug: 'ctx-paralelo-b', database: 'tenant_b' });

      await Promise.all([
        db.ejecutarComoTenant(poolA, async () => {
          await new Promise((r) => setTimeout(r, 5));
          await db.pool.query('query-a');
        }),
        db.ejecutarComoTenant(poolB, async () => {
          await db.pool.query('query-b');
        }),
      ]);

      expect(poolA.query).toHaveBeenCalledWith('query-a');
      expect(poolA.query).not.toHaveBeenCalledWith('query-b');
      expect(poolB.query).toHaveBeenCalledWith('query-b');
      expect(poolB.query).not.toHaveBeenCalledWith('query-a');
    });
  });

  describe('obtenerPoolControl', () => {
    test('crea el pool de control de forma perezosa y lo reutiliza', () => {
      const antes = mysql.createPool.mock.calls.length;
      const poolControlA = db.obtenerPoolControl();
      expect(mysql.createPool.mock.calls.length).toBe(antes + 1);

      const poolControlB = db.obtenerPoolControl();
      expect(poolControlB).toBe(poolControlA);
      expect(mysql.createPool.mock.calls.length).toBe(antes + 1);
    });
  });

  describe('ensureSchema(db) parametrizado', () => {
    test('sin argumentos, usa el pool por defecto (compatibilidad con todos los llamadores existentes)', async () => {
      poolPorDefecto.getConnection.mockResolvedValueOnce({ release: jest.fn() });
      // Basta con que falle en la primera query real para confirmar que
      // SÍ se usó el pool por defecto — no hace falta simular el esquema
      // completo aquí (eso ya lo cubre backend/scripts/verificar-mysql.js
      // contra MySQL real).
      poolPorDefecto.query.mockRejectedValueOnce(new Error('corte deliberado de la prueba'));

      await expect(db.ensureSchema()).rejects.toThrow('corte deliberado de la prueba');
      expect(poolPorDefecto.getConnection).toHaveBeenCalledTimes(1);
    });

    test('con un pool explícito, lo usa a él en vez del pool por defecto', async () => {
      const poolTenant = db.obtenerPoolTenant({ slug: 'ensure-schema-tenant', database: 'tenant_ensure_schema' });
      poolTenant.getConnection.mockResolvedValueOnce({ release: jest.fn() });
      poolTenant.query.mockRejectedValueOnce(new Error('corte deliberado de la prueba'));
      const llamadasGetConnectionDefectoAntes = poolPorDefecto.getConnection.mock.calls.length;

      await expect(db.ensureSchema(poolTenant)).rejects.toThrow('corte deliberado de la prueba');

      expect(poolTenant.getConnection).toHaveBeenCalledTimes(1);
      expect(poolPorDefecto.getConnection.mock.calls.length).toBe(llamadasGetConnectionDefectoAntes);
    });
  });
});
