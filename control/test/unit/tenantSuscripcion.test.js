// Pruebas de utils/tenantSuscripcion.js — cubre la regla de autocálculo
// confirmada con el usuario (propuesta visual, punto en curso):
// pruebaIniciaEn/expiraEn NUNCA llegan del cliente, se calculan server-side
// a partir de enPrueba + diasPrueba, con HOY fijo en America/Mexico_City.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { ErrorSuscripcionTenant, actualizarSuscripcionTenant } = require('../../utils/tenantSuscripcion');

function mockPool(tenantFila, filaPostUpdate) {
  const pool = { query: jest.fn() };
  pool.query
    .mockResolvedValueOnce([tenantFila ? [tenantFila] : []]) // SELECT del tenant
    .mockResolvedValueOnce([{ affectedRows: tenantFila ? 1 : 0 }]) // UPDATE
    .mockResolvedValueOnce([[filaPostUpdate || tenantFila]]) // SELECT post-UPDATE
    .mockResolvedValueOnce([{}]); // registrarEvento
  obtenerPool.mockReturnValue(pool);
  return pool;
}

describe('utils/tenantSuscripcion.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('actualizarSuscripcionTenant — validación', () => {
    test('rechaza un slug inválido sin llegar a hacer ninguna consulta', async () => {
      const pool = { query: jest.fn() };
      obtenerPool.mockReturnValue(pool);
      await expect(actualizarSuscripcionTenant('Slug Invalido', {})).rejects.toThrow(ErrorSuscripcionTenant);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('responde "no_encontrado" si el tenant no existe', async () => {
      mockPool(null);
      await expect(actualizarSuscripcionTenant('no-existe', {})).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    test('rechaza días de prueba no enteros o <= 0', async () => {
      mockPool({ id: 1, slug: 'cliente1' });
      await expect(actualizarSuscripcionTenant('cliente1', { diasPrueba: 0 })).rejects.toThrow(/entero mayor a 0/);
      mockPool({ id: 1, slug: 'cliente1' });
      await expect(actualizarSuscripcionTenant('cliente1', { diasPrueba: 3.5 })).rejects.toThrow(/entero mayor a 0/);
    });

    test('rechaza un ciclo fuera del catálogo', async () => {
      mockPool({ id: 1, slug: 'cliente1' });
      await expect(actualizarSuscripcionTenant('cliente1', { ciclo: 'semanal' })).rejects.toThrow(/ciclo de facturación/);
    });

    test('rechaza un estatus fuera del catálogo', async () => {
      mockPool({ id: 1, slug: 'cliente1' });
      await expect(actualizarSuscripcionTenant('cliente1', { estatus: 'moroso' })).rejects.toThrow(/estatus de cobro/);
    });

    test('si el UPDATE no afecta filas (carrera con un borrado), responde no_encontrado', async () => {
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[{ id: 1, slug: 'cliente1' }]])
        .mockResolvedValueOnce([{ affectedRows: 0 }]);
      obtenerPool.mockReturnValue(pool);
      await expect(actualizarSuscripcionTenant('cliente1', {})).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });
  });

  describe('actualizarSuscripcionTenant — autocálculo de fechas', () => {
    test('enPrueba=true sin inicio previo: fija "hoy" (America/Mexico_City) y calcula expira = hoy + días', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-12T12:00:00Z'));
      const tenantFila = {
        id: 1,
        slug: 'cliente1',
        suscripcion_prueba_inicia_en: null,
        suscripcion_expira_en: null,
      };
      const pool = mockPool(tenantFila, tenantFila);

      await actualizarSuscripcionTenant('cliente1', { enPrueba: true, diasPrueba: 25 });

      const [, paramsUpdate] = pool.query.mock.calls[1];
      const [, , pruebaIniciaEn, , expiraEn] = paramsUpdate;
      expect(pruebaIniciaEn).toBe('2026-10-12');
      expect(expiraEn).toBe('2026-11-06'); // 12 oct + 25 días
    });

    test('enPrueba=true con inicio ya guardado: respeta el inicio, solo recalcula expira al cambiar días', async () => {
      const tenantFila = {
        id: 1,
        slug: 'cliente1',
        suscripcion_prueba_inicia_en: '2026-09-01',
        suscripcion_expira_en: '2026-09-15',
      };
      const pool = mockPool(tenantFila, tenantFila);

      await actualizarSuscripcionTenant('cliente1', { enPrueba: true, diasPrueba: 30 });

      const [, paramsUpdate] = pool.query.mock.calls[1];
      const [, , pruebaIniciaEn, , expiraEn] = paramsUpdate;
      expect(pruebaIniciaEn).toBe('2026-09-01'); // sin mover, aunque cambiaron los días
      expect(expiraEn).toBe('2026-10-01'); // 1 sep + 30 días
    });

    test('enPrueba=true sin diasPrueba: fija inicio pero expira queda null (no hay con qué calcular)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-12T12:00:00Z'));
      const tenantFila = { id: 1, slug: 'cliente1', suscripcion_prueba_inicia_en: null, suscripcion_expira_en: null };
      const pool = mockPool(tenantFila, tenantFila);

      await actualizarSuscripcionTenant('cliente1', { enPrueba: true });

      const [, paramsUpdate] = pool.query.mock.calls[1];
      expect(paramsUpdate[2]).toBe('2026-10-12');
      expect(paramsUpdate[4]).toBeNull();
    });

    test('enPrueba=false: congela los últimos valores guardados, no los borra', async () => {
      const tenantFila = {
        id: 1,
        slug: 'cliente1',
        suscripcion_prueba_inicia_en: '2026-09-01',
        suscripcion_expira_en: '2026-09-26',
      };
      const pool = mockPool(tenantFila, tenantFila);

      await actualizarSuscripcionTenant('cliente1', { enPrueba: false, diasPrueba: 99 });

      const [, paramsUpdate] = pool.query.mock.calls[1];
      const [, , pruebaIniciaEn, , expiraEn] = paramsUpdate;
      expect(pruebaIniciaEn).toBe('2026-09-01');
      expect(expiraEn).toBe('2026-09-26'); // ignora diasPrueba=99, no recalcula apagado
    });

    test('enPrueba=false sin fechas previas: ambas quedan null, nunca se inventan', async () => {
      const tenantFila = { id: 1, slug: 'cliente1', suscripcion_prueba_inicia_en: null, suscripcion_expira_en: null };
      const pool = mockPool(tenantFila, tenantFila);

      await actualizarSuscripcionTenant('cliente1', { enPrueba: false });

      const [, paramsUpdate] = pool.query.mock.calls[1];
      expect(paramsUpdate[2]).toBeNull();
      expect(paramsUpdate[4]).toBeNull();
    });

    test('ignora pruebaIniciaEn/expiraEn si el cliente los manda de todas formas', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-12T12:00:00Z'));
      const tenantFila = { id: 1, slug: 'cliente1', suscripcion_prueba_inicia_en: null, suscripcion_expira_en: null };
      const pool = mockPool(tenantFila, tenantFila);

      await actualizarSuscripcionTenant('cliente1', {
        enPrueba: true,
        diasPrueba: 10,
        pruebaIniciaEn: '1999-01-01',
        expiraEn: '1999-12-31',
      });

      const [, paramsUpdate] = pool.query.mock.calls[1];
      expect(paramsUpdate[2]).toBe('2026-10-12');
      expect(paramsUpdate[4]).toBe('2026-10-22');
    });
  });
});
