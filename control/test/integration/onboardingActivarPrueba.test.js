// Punto en curso (prueba gratis de 10 días, self-service): endpoint
// público nuevo POST /api/public/onboarding/activar-prueba/:token.
//
// Archivo APARTE de control.test.js a propósito, mismo criterio ya
// documentado (CLAUDE.md, usuariosAdminControl.test.js/docsEnabled.test.js):
// esta ruta vive detrás de `onboardingPublicLimiter`, no del limiter
// global de /control, pero de todas formas cada test carga su propia
// `app` fresca con jest.resetModules() para poder mockear
// verificarRecaptcha/convertirBorrador con control total por caso, sin
// arrastrar estado entre pruebas.

const request = require('supertest');

function mockearDependencias() {
  jest.mock('../../utils/recaptcha', () => ({
    verificarRecaptcha: jest.fn().mockResolvedValue({ ok: true }),
  }));
  jest.mock('../../utils/onboardingConversion', () => {
    const real = jest.requireActual('../../utils/onboardingConversion');
    return { ...real, convertirBorrador: jest.fn() };
  });
}

describe('POST /api/public/onboarding/activar-prueba/:token', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('sin recaptchaToken válido: 400, nunca llama a convertirBorrador', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { convertirBorrador } = require('../../utils/onboardingConversion');
    const { verificarRecaptcha } = require('../../utils/recaptcha');
    verificarRecaptcha.mockResolvedValueOnce({ ok: false });

    const res = await request(app)
      .post('/api/public/onboarding/activar-prueba/tok123')
      .send({ recaptchaToken: 'malo' });

    expect(res.status).toBe(400);
    expect(convertirBorrador).not.toHaveBeenCalled();
  }, 10000);

  test('recaptcha ok: llama a convertirBorrador con esPrueba=true, diasPrueba=10, y responde 200 con el resultado', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { convertirBorrador } = require('../../utils/onboardingConversion');
    convertirBorrador.mockResolvedValueOnce({
      slug: 'tacos-el-buen-sabor',
      urlAdmin: 'https://clarvo.mx/tacos-el-buen-sabor/admin',
      urlPortal: 'https://clarvo.mx/tacos-el-buen-sabor',
    });

    const res = await request(app)
      .post('/api/public/onboarding/activar-prueba/tok123')
      .send({ recaptchaToken: 'bueno' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      slug: 'tacos-el-buen-sabor',
      urlAdmin: 'https://clarvo.mx/tacos-el-buen-sabor/admin',
      urlPortal: 'https://clarvo.mx/tacos-el-buen-sabor',
    });
    expect(convertirBorrador).toHaveBeenCalledWith('tok123', { esPrueba: true, diasPrueba: 10 });
  }, 10000);

  test('convertirBorrador lanza ErrorOnboarding: responde con el status mapeado y el mensaje real, nunca 500 genérico', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { convertirBorrador } = require('../../utils/onboardingConversion');
    const { ErrorOnboarding } = require('../../utils/onboardingBorrador');
    convertirBorrador.mockRejectedValueOnce(new ErrorOnboarding('Faltan datos para activar tu cuenta: correo del administrador.', 'validacion'));

    const res = await request(app)
      .post('/api/public/onboarding/activar-prueba/tok123')
      .send({ recaptchaToken: 'bueno' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Faltan datos/);
  }, 10000);
});
