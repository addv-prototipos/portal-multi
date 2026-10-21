// Hallazgo M-03 (sonar.html, 2026-10-14): mismo guard CSRF que
// backend/server.js, aplicado aquí solo al prefijo /api/control/*
// (nunca a /api/public/onboarding/*, que es cross-origin a propósito
// desde clarvo.mx — ver comentario junto a app.use('/api/control', ...)
// en server.js). Se prueba de forma directa, no por HTTP, por el mismo
// motivo que backend/test/unit/requireOrigenPropio.test.js: supertest
// usa un puerto efímero distinto en cada corrida.
jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/notificarBackend', () => {
  const real = jest.requireActual('../../utils/notificarBackend');
  return {
    notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
    activarTenantFisico: jest.fn().mockResolvedValue({ ok: true, dbName: 'tenant_cliente1' }),
    eliminarTenantFisico: jest.fn().mockResolvedValue({ ok: true }),
    calcularUsoDiscoFisico: jest.fn().mockResolvedValue(734003200),
    aplicarLimiteUsuarios: jest.fn().mockResolvedValue([]),
    obtenerUsoUsuarios: jest.fn().mockResolvedValue(3),
    crearAdminInicialFisico: jest.fn().mockResolvedValue({ ok: true }),
    ErrorActivacionFisica: real.ErrorActivacionFisica,
    ErrorEliminacionFisica: real.ErrorEliminacionFisica,
    ErrorCalculoDisco: real.ErrorCalculoDisco,
  };
});
jest.mock('../../utils/ajustesGlobales', () => ({
  getImagenMaxMb: jest.fn().mockResolvedValue(2),
  setImagenMaxMb: jest.fn().mockResolvedValue(2),
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

describe('requireOrigenPropio (M-03 — guard CSRF sobre Basic Auth, /control)', () => {
  test('GET nunca se bloquea, sin importar el Origin', () => {
    const req = fakeReq({ method: 'GET', host: 'control.local', origin: 'https://atacante.com' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(true);
  });

  test('POST sin cabecera Origin (cliente no-navegador): pasa', () => {
    const req = fakeReq({ method: 'POST', host: 'control.local', origin: undefined });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(true);
  });

  test('POST con Origin que coincide con el host real: pasa', () => {
    const req = fakeReq({ method: 'POST', host: 'control.local', origin: 'https://control.local' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(true);
  });

  test('POST/PUT/DELETE con Origin de un sitio distinto (ej. el <form> cruzado del informe): 403', () => {
    const req = fakeReq({ method: 'DELETE', host: 'control.local', origin: 'https://atacante.com' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  test('Sec-Fetch-Site: cross-site se rechaza aunque no venga Origin', () => {
    const req = fakeReq({ method: 'PUT', host: 'control.local', origin: undefined, secFetchSite: 'cross-site' });
    const res = fakeRes();
    let siguioLaCadena = false;
    app.requireOrigenPropio(req, res, () => { siguioLaCadena = true; });
    expect(siguioLaCadena).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
