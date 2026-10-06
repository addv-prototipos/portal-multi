// Límites de período por zona horaria (utils/limitesPeriodo.js).
//
// Regresión del bug reportado el 2026-10-05: las tarjetas "Ventas hoy" y
// "Movs. de inventario" de Inicio quedaban en $0 tras registrar movimiento
// a las 19:47 hora local, porque la ventana "hoy" estaba anclada a
// MEDIANOCHE UTC en vez de a la medianoche LOCAL (México está en UTC−6,
// así que se corría 6 h y dejaba fuera todo lo de after de 18:00).

const { limitesDia, limitesMes, medianocheLocal, cadenaFecha } = require('../../utils/limitesPeriodo');

const CIUDAD = 'America/Mexico_City'; // UTC−6, sin DST desde 2022
const TIJUANA = 'America/Tijuana'; // único con DST (se rige por EE. UU.)

describe('limitesDia', () => {
  test('la ventana es medianoche LOCAL (06:00Z), no medianoche UTC', () => {
    // 2026-10-06 02:01Z = 20:01 del 5/oct, hora local
    const { instantes, fechas } = limitesDia(CIUDAD, new Date('2026-10-06T02:01:00Z'));

    expect(instantes.inicioHoy.toISOString()).toBe('2026-10-05T06:00:00.000Z');
    expect(instantes.finHoy.toISOString()).toBe('2026-10-06T06:00:00.000Z');
    expect(instantes.inicio7d.toISOString()).toBe('2026-09-28T06:00:00.000Z');
    expect(instantes.finHoy - instantes.inicioHoy).toBe(24 * 3600 * 1000);

    expect(fechas).toEqual({ hoy: '2026-10-05', manana: '2026-10-06', hace7d: '2026-09-28' });
  });

  test('una venta a las 19:47 local (01:47Z del día siguiente en UTC) SÍ cae en "hoy"', () => {
    const { instantes } = limitesDia(CIUDAD, new Date('2026-10-06T02:01:00Z'));
    const venta = new Date('2026-10-06T01:47:08Z');

    expect(venta >= instantes.inicioHoy && venta < instantes.finHoy).toBe(true);

    // Con la ventana vieja (medianoche UTC) NO caía — el bug reportado.
    const vieja = { inicio: new Date('2026-10-05T00:00:00Z'), fin: new Date('2026-10-06T00:00:00Z') };
    expect(venta >= vieja.inicio && venta < vieja.fin).toBe(false);
  });

  test('los últimos minutos del día local siguen dentro de "hoy"', () => {
    const { instantes } = limitesDia(CIUDAD, new Date('2026-10-06T05:59:59Z')); // 23:59 local del 5/oct
    const movimiento = new Date('2026-10-06T05:59:00Z');
    expect(movimiento >= instantes.inicioHoy && movimiento < instantes.finHoy).toBe(true);
  });

  test('5:59Z (23:59 local del día ANTERIOR) queda fuera del día siguiente', () => {
    const { instantes, fechas } = limitesDia(CIUDAD, new Date('2026-10-06T06:01:00Z')); // 00:01 local del 6/oct
    expect(fechas.hoy).toBe('2026-10-06');
    expect(instantes.inicioHoy.toISOString()).toBe('2026-10-06T06:00:00.000Z');
    expect(new Date('2026-10-06T05:59:00Z') >= instantes.inicioHoy).toBe(false);
  });

  test('cruza año nuevo: 31/dic a las 20:01 local sigue siendo "hoy" 31/dic', () => {
    const { instantes, fechas } = limitesDia(CIUDAD, new Date('2027-01-01T02:01:00Z'));
    expect(fechas.hoy).toBe('2026-12-31');
    expect(fechas.manana).toBe('2027-01-01');
    expect(instantes.inicioHoy.toISOString()).toBe('2026-12-31T06:00:00.000Z');
    expect(instantes.finHoy.toISOString()).toBe('2027-01-01T06:00:00.000Z');
    expect(fechas.hace7d).toBe('2026-12-24');
  });

  test('DST de salida en Tijuana: el día dura 25 h y la medianoche no se corre', () => {
    // 2026-11-01: Tijuana pasa de PDT (UTC−7) a PST (UTC−8) a las 02:00.
    const { instantes } = limitesDia(TIJUANA, new Date('2026-11-01T12:00:00Z')); // 04:00 local del 1/nov
    expect(instantes.inicioHoy.toISOString()).toBe('2026-11-01T07:00:00.000Z'); // medianoche en PDT
    expect(instantes.finHoy.toISOString()).toBe('2026-11-02T08:00:00.000Z'); // medianoche en PST
    expect(instantes.finHoy - instantes.inicioHoy).toBe(25 * 3600 * 1000);
  });

  test('DST de entrada en Tijuana: el día dura 23 h', () => {
    // 2026-03-08: Tijuana pasa de PST (UTC−8) a PDT (UTC−7) a las 02:00.
    const { instantes } = limitesDia(TIJUANA, new Date('2026-03-08T18:00:00Z')); // 10:00 local del 8/mar
    expect(instantes.inicioHoy.toISOString()).toBe('2026-03-08T08:00:00.000Z');
    expect(instantes.finHoy.toISOString()).toBe('2026-03-09T07:00:00.000Z');
    expect(instantes.finHoy - instantes.inicioHoy).toBe(23 * 3600 * 1000);
  });
});

describe('limitesMes', () => {
  test('instantes = medianoche local; fechas = calendario local (DATE)', () => {
    const { instantes, fechas } = limitesMes(CIUDAD, new Date('2026-10-06T02:01:00Z'));

    expect(instantes.inicio.toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(instantes.fin.toISOString()).toBe('2026-11-01T06:00:00.000Z');
    expect(instantes.inicioAnterior.toISOString()).toBe('2026-09-01T06:00:00.000Z');
    expect(instantes.finAnterior.toISOString()).toBe('2026-10-01T06:00:00.000Z');

    expect(fechas).toEqual({
      inicio: '2026-10-01',
      fin: '2026-11-01',
      inicioAnterior: '2026-09-01',
      finAnterior: '2026-10-01',
    });
  });

  test('una venta del último día a las 19:00 local queda en ESTE mes', () => {
    const { instantes } = limitesMes(CIUDAD, new Date('2026-11-01T02:00:00Z')); // 20:00 local del 31/oct
    const venta = new Date('2026-11-01T01:00:00Z'); // 19:00 local del 31/oct

    expect(venta >= instantes.inicio && venta < instantes.fin).toBe(true);
    // Con medianoche UTC (comportamiento viejo) se colaba en noviembre.
    expect(venta < new Date('2026-11-01T00:00:00Z')).toBe(false);
  });

  test('rollo de año: diciembre → enero', () => {
    const { instantes, fechas } = limitesMes(CIUDAD, new Date('2026-12-31T20:00:00Z')); // 14:00 local del 31/dic
    expect(instantes.inicio.toISOString()).toBe('2026-12-01T06:00:00.000Z');
    expect(instantes.fin.toISOString()).toBe('2027-01-01T06:00:00.000Z');
    expect(fechas.inicio).toBe('2026-12-01');
    expect(fechas.fin).toBe('2027-01-01');
  });
});

describe('medianocheLocal / cadenaFecha', () => {
  test('normalizan mes/día como Date.UTC (día 0 y mes 13)', () => {
    expect(medianocheLocal(2026, 13, 1, CIUDAD).toISOString()).toBe('2027-01-01T06:00:00.000Z');
    expect(medianocheLocal(2026, 0, 15, CIUDAD).toISOString()).toBe('2025-12-15T06:00:00.000Z');
    expect(cadenaFecha(2026, 13, 1)).toBe('2027-01-01');
    expect(cadenaFecha(2026, 0, 15)).toBe('2025-12-15');
  });
});
