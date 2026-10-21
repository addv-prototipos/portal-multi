// Hallazgo C-03 (sonar.html, 2026-10-13): hostPermitido() es el candado
// nuevo contra Host header injection en detectarUrlPortal() — un Host
// falsificado (p. ej. "atacante.com") no debe poder hacer que el correo
// de recuperación de contraseña (u otros correos con enlace) apunte al
// dominio del atacante. Se prueba de forma directa (no por HTTP) porque
// detectarUrlPortal() se invoca dentro de un flujo fire-and-forget de
// envío de correo — frágil de verificar por assert vía supertest.
jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

describe('hostPermitido (C-03 — Host header allowlist)', () => {
  const ALLOWED_HOSTS_ORIGINAL = process.env.ALLOWED_HOSTS;

  afterEach(() => {
    if (ALLOWED_HOSTS_ORIGINAL === undefined) delete process.env.ALLOWED_HOSTS;
    else process.env.ALLOWED_HOSTS = ALLOWED_HOSTS_ORIGINAL;
    jest.resetModules();
  });

  test('ALLOWED_HOSTS sin configurar: acepta cualquier Host (comportamiento de siempre, dev-friendly)', () => {
    jest.resetModules();
    delete process.env.ALLOWED_HOSTS;
    const app = require('../../server');

    expect(app.hostPermitido('localhost:8088')).toBe(true);
    expect(app.hostPermitido('atacante.com')).toBe(true); // sin configurar, aún vulnerable a propósito — ver comentario de la función
  });

  test('ALLOWED_HOSTS configurado: Host en la lista se acepta', () => {
    jest.resetModules();
    process.env.ALLOWED_HOSTS = 'yt.addv.com.mx,www.yt.addv.com.mx';
    const app = require('../../server');

    expect(app.hostPermitido('yt.addv.com.mx')).toBe(true);
    expect(app.hostPermitido('www.yt.addv.com.mx')).toBe(true);
  });

  test('ALLOWED_HOSTS configurado: Host fuera de la lista (falsificado) se rechaza', () => {
    jest.resetModules();
    process.env.ALLOWED_HOSTS = 'yt.addv.com.mx';
    const app = require('../../server');

    expect(app.hostPermitido('atacante.com')).toBe(false);
    expect(app.hostPermitido('yt.addv.com.mx.atacante.com')).toBe(false); // subdominio-trampa, tampoco coincide exacto
  });

  test('ALLOWED_HOSTS configurado: comparación insensible a mayúsculas', () => {
    jest.resetModules();
    process.env.ALLOWED_HOSTS = 'YT.ADDV.COM.MX';
    const app = require('../../server');

    expect(app.hostPermitido('yt.addv.com.mx')).toBe(true);
  });
});
