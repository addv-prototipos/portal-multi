// Pruebas de utils/requiereFeature.js — candado de feature-flag por
// tenant (ver PROJECT_STATE.md — "Gobierno de funcionalidades por tenant
// desde /control"). Responde 404, nunca 403 (anti-enumeración).

const { requiereFeature } = require('../../utils/requiereFeature');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

describe('utils/requiereFeature.js', () => {
  test('sin req.tenant (no-op), llama a next() sin tocar res', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    requiereFeature('facturacionHabilitada')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('con el campo en true, llama a next()', () => {
    const req = { tenant: { facturacionHabilitada: true } };
    const res = mockRes();
    const next = jest.fn();

    requiereFeature('facturacionHabilitada')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('con el campo ausente en req.tenant (undefined), llama a next() — solo bloquea false explícito', () => {
    const req = { tenant: { slug: 'cliente1' } };
    const res = mockRes();
    const next = jest.fn();

    requiereFeature('facturacionHabilitada')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('con el campo en false, responde 404 y NO llama a next() — nunca 403', () => {
    const req = { tenant: { facturacionHabilitada: false } };
    const res = mockRes();
    const next = jest.fn();

    requiereFeature('facturacionHabilitada')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  // Punto 349-350: GET /api/admin/periodos-archivados sirve tanto a
  // Ventas como a Gastos — debe responder mientras CUALQUIERA de los dos
  // siga activo (OR), no solo cuando ambos lo están.
  test('con un arreglo de campos (OR): pasa si AL MENOS uno está en true', () => {
    const req = { tenant: { ventasHabilitado: true, gastosHabilitado: false } };
    const res = mockRes();
    const next = jest.fn();

    requiereFeature(['ventasHabilitado', 'gastosHabilitado'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('con un arreglo de campos (OR): responde 404 solo si TODOS están en false', () => {
    const req = { tenant: { ventasHabilitado: false, gastosHabilitado: false } };
    const res = mockRes();
    const next = jest.fn();

    requiereFeature(['ventasHabilitado', 'gastosHabilitado'])(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('con un arreglo de campos (OR): un campo ausente (undefined) cuenta como "no desactivado explícitamente"', () => {
    const req = { tenant: { ventasHabilitado: false } }; // gastosHabilitado ni siquiera existe en el objeto
    const res = mockRes();
    const next = jest.fn();

    requiereFeature(['ventasHabilitado', 'gastosHabilitado'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('cada feature se candadea de forma independiente (campo distinto, mismo tenant)', () => {
    const req = { tenant: { facturacionHabilitada: false, portalClientesHabilitado: true } };
    const resFactura = mockRes();
    const resPortal = mockRes();
    const next = jest.fn();

    requiereFeature('facturacionHabilitada')(req, resFactura, next);
    requiereFeature('portalClientesHabilitado')(req, resPortal, next);

    expect(resFactura.status).toHaveBeenCalledWith(404);
    expect(resPortal.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
