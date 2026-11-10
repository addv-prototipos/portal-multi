// Switch prueba/producción de Stripe (punto en curso) — mockea
// ajustesGlobales.js, nunca toca Stripe real ni MySQL real.

jest.mock('../../utils/ajustesGlobales', () => ({
  getValorTexto: jest.fn(),
  setValorTexto: jest.fn().mockResolvedValue(undefined),
}));

const { getValorTexto, setValorTexto } = require('../../utils/ajustesGlobales');
const stripeModo = require('../../utils/stripeModo');

describe('stripeModo — lectura del flag', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sin fila guardada -> "prueba" (default seguro)', async () => {
    getValorTexto.mockResolvedValue(null);
    expect(await stripeModo.modoActivo()).toBe('prueba');
  });

  test('con "produccion" guardado -> "produccion"', async () => {
    getValorTexto.mockResolvedValue('produccion');
    expect(await stripeModo.modoActivo()).toBe('produccion');
  });

  test('con un valor inválido/corrupto guardado -> cae a "prueba", nunca truena', async () => {
    getValorTexto.mockResolvedValue('algo-que-no-es-un-modo');
    expect(await stripeModo.modoActivo()).toBe('prueba');
  });
});

describe('stripeModo — credenciales activas', () => {
  const envOriginal = { ...process.env };
  afterEach(() => {
    process.env = { ...envOriginal };
    jest.clearAllMocks();
  });

  test('modo prueba usa STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY (las de siempre)', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc1234';
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc1234';
    getValorTexto.mockResolvedValue(null);
    const cred = await stripeModo.obtenerCredencialesActivas();
    expect(cred).toEqual({ modo: 'prueba', secretKey: 'sk_test_abc1234', publishableKey: 'pk_test_abc1234' });
  });

  test('modo producción usa STRIPE_SECRET_KEY_LIVE/STRIPE_PUBLISHABLE_KEY_LIVE', async () => {
    process.env.STRIPE_SECRET_KEY_LIVE = 'sk_live_xyz9876';
    process.env.STRIPE_PUBLISHABLE_KEY_LIVE = 'pk_live_xyz9876';
    getValorTexto.mockResolvedValue('produccion');
    const cred = await stripeModo.obtenerCredencialesActivas();
    expect(cred).toEqual({ modo: 'produccion', secretKey: 'sk_live_xyz9876', publishableKey: 'pk_live_xyz9876' });
  });
});

describe('stripeModo — estado() para la UI de /control', () => {
  const envOriginal = { ...process.env };
  afterEach(() => {
    process.env = { ...envOriginal };
    jest.clearAllMocks();
  });

  test('nunca expone la llave completa, solo los últimos 4 caracteres', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_0001';
    getValorTexto.mockResolvedValue(null);
    const info = await stripeModo.estado();
    expect(info.llaveActivaUltimos4).toBe('0001');
    expect(JSON.stringify(info)).not.toContain('sk_test_0001');
  });

  test('liveConfigurado:false si falta cualquiera de las 2 llaves live', async () => {
    delete process.env.STRIPE_SECRET_KEY_LIVE;
    process.env.STRIPE_PUBLISHABLE_KEY_LIVE = 'pk_live_1234';
    getValorTexto.mockResolvedValue(null);
    const info = await stripeModo.estado();
    expect(info.liveConfigurado).toBe(false);
  });

  test('liveConfigurado:true con las 2 llaves live presentes', async () => {
    process.env.STRIPE_SECRET_KEY_LIVE = 'sk_live_1234';
    process.env.STRIPE_PUBLISHABLE_KEY_LIVE = 'pk_live_1234';
    getValorTexto.mockResolvedValue(null);
    const info = await stripeModo.estado();
    expect(info.liveConfigurado).toBe(true);
  });
});

describe('stripeModo — cambiarModo()', () => {
  const envOriginal = { ...process.env };
  afterEach(() => {
    process.env = { ...envOriginal };
    jest.clearAllMocks();
  });

  test('modo inválido -> rechaza sin tocar la BD', async () => {
    await expect(stripeModo.cambiarModo('asdf')).rejects.toThrow(/inválido/);
    expect(setValorTexto).not.toHaveBeenCalled();
  });

  test('pasar a producción SIN llaves live configuradas -> rechaza, nunca guarda el cambio', async () => {
    delete process.env.STRIPE_SECRET_KEY_LIVE;
    delete process.env.STRIPE_PUBLISHABLE_KEY_LIVE;
    await expect(stripeModo.cambiarModo('produccion')).rejects.toMatchObject({ codigo: 'live_no_configurado' });
    expect(setValorTexto).not.toHaveBeenCalled();
  });

  test('pasar a producción CON llaves live configuradas -> guarda el cambio', async () => {
    process.env.STRIPE_SECRET_KEY_LIVE = 'sk_live_1234';
    process.env.STRIPE_PUBLISHABLE_KEY_LIVE = 'pk_live_1234';
    await stripeModo.cambiarModo('produccion');
    expect(setValorTexto).toHaveBeenCalledWith('stripe_modo_cobro', 'produccion');
  });

  test('volver a prueba nunca exige nada de la llave live', async () => {
    delete process.env.STRIPE_SECRET_KEY_LIVE;
    await stripeModo.cambiarModo('prueba');
    expect(setValorTexto).toHaveBeenCalledWith('stripe_modo_cobro', 'prueba');
  });
});
