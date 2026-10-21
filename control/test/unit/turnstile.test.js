// Hallazgo M-06 (sonar_1.1.html, Fase D, punto 410): verificarTurnstile()
// es el candado que protege POST /api/public/onboarding/convertir/:token
// (la única ruta del onboarding público que de verdad aprovisiona
// infraestructura real). Fetch real mockeado — mismo patrón que
// backend/test/unit/tipoCambio.test.js.
const { verificarTurnstile } = require('../../utils/turnstile');

describe('verificarTurnstile', () => {
  const SECRETO_ORIGINAL = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
    if (SECRETO_ORIGINAL === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = SECRETO_ORIGINAL;
  });

  test('falla CERRADO si TURNSTILE_SECRET_KEY no está configurado — nunca omite la verificación', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const resultado = await verificarTurnstile('token-cualquiera', '1.2.3.4');
    expect(resultado).toEqual({ ok: false, motivo: 'no_configurado' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('rechaza si no se manda token, sin llamar a Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto-de-prueba';
    const resultado = await verificarTurnstile(undefined, '1.2.3.4');
    expect(resultado).toEqual({ ok: false, motivo: 'token_faltante' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('Cloudflare aprueba (success:true): ok true', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto-de-prueba';
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    const resultado = await verificarTurnstile('token-real', '1.2.3.4');

    expect(resultado).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
    const cuerpoEnviado = global.fetch.mock.calls[0][1].body;
    expect(cuerpoEnviado.get('secret')).toBe('secreto-de-prueba');
    expect(cuerpoEnviado.get('response')).toBe('token-real');
    expect(cuerpoEnviado.get('remoteip')).toBe('1.2.3.4');
  });

  test('Cloudflare rechaza (success:false): ok false, motivo "rechazado"', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto-de-prueba';
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) });

    const resultado = await verificarTurnstile('token-malo', '1.2.3.4');
    expect(resultado).toEqual({ ok: false, motivo: 'rechazado' });
  });

  test('Cloudflare responde con error HTTP: ok false, motivo "error_http"', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto-de-prueba';
    global.fetch.mockResolvedValue({ ok: false, status: 503 });

    const resultado = await verificarTurnstile('token-real', '1.2.3.4');
    expect(resultado).toEqual({ ok: false, motivo: 'error_http' });
  });

  test('fetch rechaza (red caída): ok false, motivo "error_red", nunca revienta la petición', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto-de-prueba';
    global.fetch.mockRejectedValue(new Error('red caída'));

    const resultado = await verificarTurnstile('token-real', '1.2.3.4');
    expect(resultado).toEqual({ ok: false, motivo: 'error_red' });
  });

  test('sin IP (ej. test interno): no manda remoteip, pero sí verifica', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto-de-prueba';
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    await verificarTurnstile('token-real', undefined);

    const cuerpoEnviado = global.fetch.mock.calls[0][1].body;
    expect(cuerpoEnviado.has('remoteip')).toBe(false);
  });
});
