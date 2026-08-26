// §57: pruebas de backend/utils/tipoCambio.js — nunca debe lanzar, siempre
// degrada a `fuente` cuando no hay token, la red falla, o Banxico no tiene
// un dato publicado (fin de semana/feriado).
describe('utils/tipoCambio — obtenerTipoCambioUSD', () => {
  const tokenOriginal = process.env.BANXICO_TOKEN;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.BANXICO_TOKEN = tokenOriginal;
    delete global.fetch;
  });

  test('sin BANXICO_TOKEN configurado, degrada a manual_requerido sin llamar a fetch', async () => {
    delete process.env.BANXICO_TOKEN;
    const { obtenerTipoCambioUSD } = require('../../utils/tipoCambio');
    const resultado = await obtenerTipoCambioUSD();
    expect(resultado).toEqual({ valor: null, fecha: null, fuente: 'manual_requerido' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('con token y respuesta válida de Banxico, regresa el valor y lo cachea', async () => {
    process.env.BANXICO_TOKEN = 'token-de-prueba';
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bmx: { series: [{ datos: [{ fecha: '26/08/2026', dato: '18.3542' }] }] } }),
    });
    const { obtenerTipoCambioUSD } = require('../../utils/tipoCambio');
    const primero = await obtenerTipoCambioUSD();
    expect(primero.valor).toBe(18.3542);
    expect(primero.fuente).toBe('banxico');

    // Segunda llamada el mismo día: usa el caché en memoria, no vuelve a golpear la red.
    const segundo = await obtenerTipoCambioUSD();
    expect(segundo.valor).toBe(18.3542);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('respuesta HTTP no-ok degrada a manual_requerido sin caché previo', async () => {
    process.env.BANXICO_TOKEN = 'token-de-prueba';
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    const { obtenerTipoCambioUSD } = require('../../utils/tipoCambio');
    const resultado = await obtenerTipoCambioUSD();
    expect(resultado.fuente).toBe('manual_requerido');
    expect(resultado.valor).toBeNull();
  });

  test('sin dato publicado todavía (fin de semana) degrada a manual_requerido', async () => {
    process.env.BANXICO_TOKEN = 'token-de-prueba';
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bmx: { series: [{ datos: [{ fecha: '26/08/2026', dato: 'N/E' }] }] } }),
    });
    const { obtenerTipoCambioUSD } = require('../../utils/tipoCambio');
    const resultado = await obtenerTipoCambioUSD();
    expect(resultado.fuente).toBe('manual_requerido');
    expect(resultado.valor).toBeNull();
  });

  test('con un valor ya cacheado, una falla de red al día siguiente degrada a banxico_caducado en vez de perder el dato', async () => {
    process.env.BANXICO_TOKEN = 'token-de-prueba';
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-08-25T12:00:00Z'));
    const { obtenerTipoCambioUSD } = require('../../utils/tipoCambio');

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bmx: { series: [{ datos: [{ fecha: '25/08/2026', dato: '18.10' }] }] } }),
    });
    const primero = await obtenerTipoCambioUSD();
    expect(primero.fuente).toBe('banxico');
    expect(primero.valor).toBe(18.1);

    jest.setSystemTime(new Date('2026-08-26T12:00:00Z'));
    global.fetch.mockRejectedValue(new Error('red caída'));
    const segundo = await obtenerTipoCambioUSD();
    expect(segundo.fuente).toBe('banxico_caducado');
    expect(segundo.valor).toBe(18.1);

    jest.useRealTimers();
  });
});
