// Hallazgo M-03 (sonar.html, 2026-10-14): requireOrigenPropio() es el
// guard CSRF contra Basic Auth cacheado — compara `Origin` (si el
// navegador lo manda) contra `req.get('host')`. Se prueba de forma
// directa (no por HTTP) porque supertest usa un puerto efímero distinto
// en cada corrida, así que no hay forma determinista de mandar un
// Origin que coincida con el host real vía una request HTTP real.
jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

const app = require('../../server');

function fakeReq({ method, host, origin, secFetchSite }) {
  return {
    method,
    get: (header) => {
      const h = header.toLowerCase();
      if (h === 'host') return host;
      if (h === 'origin') return origin;
      if (h === 'sec-fetch-site') return secFetchSite;
      return undefined;
    },
  };
}

function fakeRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('requireOrigenPropio (M-03 — guard CSRF sobre Basic Auth)', () => {
  test('GET nunca se bloquea, sin importar el Origin', () => {
    const req = fakeReq({ method: 'GET', host: 'miapp.com', origin: 'https://atacante.com' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(true);
    expect(res.statusCode).toBeUndefined();
  });

  test('POST sin cabecera Origin (cliente no-navegador): pasa', () => {
    const req = fakeReq({ method: 'POST', host: 'miapp.com', origin: undefined });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(true);
  });

  test('POST con Origin que coincide con el host real: pasa', () => {
    const req = fakeReq({ method: 'POST', host: 'miapp.com', origin: 'https://miapp.com' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(true);
  });

  test('POST con Origin que incluye el puerto, igual al host (con puerto): pasa', () => {
    const req = fakeReq({ method: 'PUT', host: 'miapp.com:8088', origin: 'http://miapp.com:8088' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(true);
  });

  test('POST/PUT/DELETE con Origin de un sitio distinto: 403, nunca sigue la cadena', () => {
    const req = fakeReq({ method: 'POST', host: 'miapp.com', origin: 'https://atacante.com' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  test('Origin con formato inválido (no parseable como URL): 403, nunca "pasa por accidente"', () => {
    const req = fakeReq({ method: 'DELETE', host: 'miapp.com', origin: 'esto-no-es-una-url' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  test('Sec-Fetch-Site: cross-site se rechaza aunque no venga Origin', () => {
    const req = fakeReq({ method: 'PUT', host: 'miapp.com', origin: undefined, secFetchSite: 'cross-site' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  test('Sec-Fetch-Site: same-origin/none nunca bloquean por sí solos', () => {
    for (const valor of ['same-origin', 'none', 'same-site']) {
      const req = fakeReq({ method: 'POST', host: 'miapp.com', origin: undefined, secFetchSite: valor });
      const res = fakeRes();
      let siguioLaCadena = false;
      app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
      expect(siguioLaCadena).toBe(true);
    }
  });
});
