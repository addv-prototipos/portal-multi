// Pruebas de utils/ajustesGlobales.js (Punto 370) — lectura, desde el
// backend, de la tabla clave/valor `ajustes_globales` de control_tenants
// (la escribe control/, ver control/utils/ajustesGlobales.js). El backend
// solo lee, con caché corto (mismo patrón que tenantContext.js).

jest.mock('../../db', () => ({
  obtenerPoolControl: jest.fn(),
}));

const { obtenerPoolControl } = require('../../db');
const { obtenerImagenMaxMbCacheado } = require('../../utils/ajustesGlobales');

describe('utils/ajustesGlobales.js', () => {
  let pool;
  let tiempoActual;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    pool = { query: jest.fn() };
    obtenerPoolControl.mockReturnValue(pool);
    // Salto grande entre pruebas para que la caché (TTL 45s) de la prueba
    // anterior siempre quede vencida — así cada prueba parte de cero sin
    // depender de resetModules (que rompería la referencia del mock, ver
    // intento anterior fallido).
    tiempoActual = (tiempoActual || 0) + 10 * 60 * 1000;
    jest.setSystemTime(tiempoActual);
  });

  test('sin nada guardado, devuelve el default (2)', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const resultado = await obtenerImagenMaxMbCacheado();
    expect(resultado).toBe(2);
  });

  test('respeta un valor guardado válido', async () => {
    pool.query.mockResolvedValueOnce([[{ valor: '7' }]]);
    const resultado = await obtenerImagenMaxMbCacheado();
    expect(resultado).toBe(7);
  });

  test('un valor guardado fuera de rango (0, negativo, >20, no numérico) cae al default', async () => {
    for (const valorGuardado of ['0', '-3', '25', 'abc', '2.5']) {
      tiempoActual += 10 * 60 * 1000; // cada iteración, cache vencida de nuevo
      jest.setSystemTime(tiempoActual);
      pool.query.mockResolvedValueOnce([[{ valor: valorGuardado }]]);
      // eslint-disable-next-line no-await-in-loop
      const resultado = await obtenerImagenMaxMbCacheado();
      expect(resultado).toBe(2);
    }
  });

  test('si control_tenants falla y nunca hubo caché vigente, cae al default sin tronar', async () => {
    pool.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const resultado = await obtenerImagenMaxMbCacheado();
    expect(resultado).toBe(2);
  });

  test('cachea dentro del TTL: una segunda llamada inmediata no vuelve a consultar', async () => {
    pool.query.mockResolvedValueOnce([[{ valor: '9' }]]);
    const primero = await obtenerImagenMaxMbCacheado();
    const segundo = await obtenerImagenMaxMbCacheado();
    expect(primero).toBe(9);
    expect(segundo).toBe(9);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('si control_tenants falla DESPUÉS de tener caché vigente, conserva el último valor bueno al vencer el TTL', async () => {
    pool.query.mockResolvedValueOnce([[{ valor: '12' }]]);
    const primero = await obtenerImagenMaxMbCacheado();
    expect(primero).toBe(12);

    jest.setSystemTime(tiempoActual + 46 * 1000); // vence el TTL (45s)
    pool.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const segundo = await obtenerImagenMaxMbCacheado();
    expect(segundo).toBe(12);
  });
});
