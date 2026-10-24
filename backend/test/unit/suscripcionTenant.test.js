// Punto 416: evaluarBloqueoSuscripcion() es pura (sin I/O), se prueba
// directo sin mocks de BD. La regla no-retroactiva (estatus null nunca
// bloquea) es la más importante de probar — romperla apagaría la
// administración de cualquier tenant existente el día que esto se
// despliegue.
const { evaluarBloqueoSuscripcion } = require('../../utils/suscripcionTenant');

describe('utils/suscripcionTenant.js — evaluarBloqueoSuscripcion', () => {
  test('tenant null/undefined nunca bloquea (sitio base)', () => {
    expect(evaluarBloqueoSuscripcion(null)).toEqual({ bloqueada: false });
    expect(evaluarBloqueoSuscripcion(undefined)).toEqual({ bloqueada: false });
  });

  test('estatus null/ausente ("sin configurar") NUNCA bloquea — regla no-retroactiva', () => {
    expect(evaluarBloqueoSuscripcion({ suscripcion_estatus: null }).bloqueada).toBe(false);
    expect(evaluarBloqueoSuscripcion({}).bloqueada).toBe(false);
  });

  test('estatus "pagada" nunca bloquea, sin importar fechas', () => {
    expect(evaluarBloqueoSuscripcion({ suscripcion_estatus: 'pagada', suscripcion_expira_en: '2020-01-01' }).bloqueada).toBe(false);
  });

  test('estatus "prueba" sin fecha de expiración no bloquea (trial a medio configurar)', () => {
    expect(evaluarBloqueoSuscripcion({ suscripcion_estatus: 'prueba', suscripcion_expira_en: null }).bloqueada).toBe(false);
  });

  test('estatus "prueba" vigente (hoy <= expira) no bloquea', () => {
    const r = evaluarBloqueoSuscripcion({ suscripcion_estatus: 'prueba', suscripcion_expira_en: '2099-01-01' }, { hoy: '2026-10-23' });
    expect(r.bloqueada).toBe(false);
  });

  test('estatus "prueba" exactamente el día que expira todavía NO bloquea (hoy <= expiraEn, inclusive)', () => {
    const r = evaluarBloqueoSuscripcion({ suscripcion_estatus: 'prueba', suscripcion_expira_en: '2026-10-23' }, { hoy: '2026-10-23' });
    expect(r.bloqueada).toBe(false);
  });

  test('estatus "prueba" un día después de expirar SÍ bloquea, con motivo prueba_vencida', () => {
    const r = evaluarBloqueoSuscripcion({ suscripcion_estatus: 'prueba', suscripcion_expira_en: '2026-10-22' }, { hoy: '2026-10-23' });
    expect(r.bloqueada).toBe(true);
    expect(r.motivo).toBe('prueba_vencida');
    expect(r.portalClientesActivo).toBe(true);
    expect(r.expiraEn).toBe('2026-10-22');
  });

  test.each(['pendiente', 'vencida', 'cancelada'])('estatus "%s" bloquea siempre, sin importar fechas', (estatus) => {
    const r = evaluarBloqueoSuscripcion({ suscripcion_estatus: estatus });
    expect(r.bloqueada).toBe(true);
    expect(r.motivo).toBe(estatus);
    expect(r.portalClientesActivo).toBe(true);
  });

  test('acepta tanto la fila cruda (suscripcion_estatus) como req.tenant ya construido (suscripcionEstatus)', () => {
    const porCamelCase = evaluarBloqueoSuscripcion({ suscripcionEstatus: 'vencida' });
    expect(porCamelCase.bloqueada).toBe(true);
    expect(porCamelCase.motivo).toBe('vencida');
  });

  test('valor de estatus inesperado (no en el enum) falla cerrado hacia "no bloquear"', () => {
    expect(evaluarBloqueoSuscripcion({ suscripcion_estatus: 'algo-que-no-existe' }).bloqueada).toBe(false);
  });
});
