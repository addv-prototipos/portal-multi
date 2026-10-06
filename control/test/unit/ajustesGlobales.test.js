// Pruebas de utils/ajustesGlobales.js (Punto 370) — ajustes globales de
// la plataforma, tabla clave/valor `ajustes_globales`. Primer campo:
// imagen_max_mb.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { getImagenMaxMb, setImagenMaxMb, IMAGEN_MAX_MB_DEFAULT } = require('../../utils/ajustesGlobales');

describe('ajustesGlobales.js', () => {
  let pool;

  beforeEach(() => {
    pool = { query: jest.fn() };
    obtenerPool.mockReturnValue(pool);
  });

  describe('getImagenMaxMb', () => {
    test('sin nada guardado, devuelve el default (2)', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const resultado = await getImagenMaxMb();
      expect(resultado).toBe(IMAGEN_MAX_MB_DEFAULT);
    });

    test('respeta un valor guardado válido', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '5' }]]);
      const resultado = await getImagenMaxMb();
      expect(resultado).toBe(5);
    });

    test('un valor guardado fuera de rango (0, negativo, >20, no numérico) cae al default', async () => {
      for (const valorGuardado of ['0', '-3', '25', 'abc', '2.5']) {
        pool.query.mockResolvedValueOnce([[{ valor: valorGuardado }]]);
        // eslint-disable-next-line no-await-in-loop
        const resultado = await getImagenMaxMb();
        expect(resultado).toBe(IMAGEN_MAX_MB_DEFAULT);
      }
    });
  });

  describe('setImagenMaxMb', () => {
    test('guarda un entero válido dentro de rango', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      const resultado = await setImagenMaxMb(8);
      expect(resultado).toBe(8);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ajustes_globales'),
        ['imagen_max_mb', '8']
      );
    });

    test('rechaza 0, negativos, no enteros y valores arriba de 20', async () => {
      await expect(setImagenMaxMb(0)).rejects.toThrow(/entre 1 y 20/);
      await expect(setImagenMaxMb(-1)).rejects.toThrow(/entre 1 y 20/);
      await expect(setImagenMaxMb(2.5)).rejects.toThrow(/entre 1 y 20/);
      await expect(setImagenMaxMb(21)).rejects.toThrow(/entre 1 y 20/);
      await expect(setImagenMaxMb('texto')).rejects.toThrow(/entre 1 y 20/);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('acepta exactamente los límites 1 y 20', async () => {
      pool.query.mockResolvedValue([{}]);
      await expect(setImagenMaxMb(1)).resolves.toBe(1);
      await expect(setImagenMaxMb(20)).resolves.toBe(20);
    });
  });
});
