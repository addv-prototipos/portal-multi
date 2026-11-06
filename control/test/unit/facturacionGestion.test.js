// Pruebas de utils/facturacionGestion.js — ciclo de vida de "Solicitar
// factura" (CFDI vía SAT). Foco de este archivo: crearSolicitud() nunca
// confía en un `monto` recibido del llamador — siempre se recalcula del
// cobro REAL de Stripe para ese invoiceId (montoRealInvoiceTenant, punto
// en curso — reemplaza el criterio anterior de "precio de catálogo", para
// que el CFDI coincida con lo que Stripe de verdad cobró, incluido
// cualquier descuento de un solo cobro activo ese mes).

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/facturacionClarvo', () => ({
  montoRealInvoiceTenant: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { montoRealInvoiceTenant } = require('../../utils/facturacionClarvo');
const { ErrorFacturacionGestion, crearSolicitud } = require('../../utils/facturacionGestion');

function mockPool() {
  const pool = { query: jest.fn() };
  obtenerPool.mockReturnValue(pool);
  return pool;
}

const DATOS_BASE = {
  slug: 'panes',
  invoiceId: 'in_real123',
  periodoEtiqueta: 'noviembre 2026',
  razonSocial: 'Panes SA de CV',
  rfc: 'PAN010101AAA',
  regimenFiscal: '601',
  codigoPostal: '01000',
};

describe('utils/facturacionGestion.js', () => {
  beforeEach(() => {
    montoRealInvoiceTenant.mockReset();
  });

  test('faltan datos obligatorios -> ErrorFacturacionGestion "datos_incompletos", nunca llama a montoRealInvoiceTenant', async () => {
    const pool = mockPool();

    const error = await crearSolicitud({ ...DATOS_BASE, rfc: '' }, pool).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorFacturacionGestion);
    expect(error.codigo).toBe('datos_incompletos');
    expect(montoRealInvoiceTenant).not.toHaveBeenCalled();
  });

  test('ignora cualquier `monto` que mande el llamador — siempre usa montoRealInvoiceTenant', async () => {
    const pool = mockPool();
    pool.query
      .mockResolvedValueOnce([[]]) // SELECT existente: ninguna
      .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT
    montoRealInvoiceTenant.mockResolvedValueOnce(479.2);

    await crearSolicitud({ ...DATOS_BASE, monto: 49.64 }, pool);

    expect(montoRealInvoiceTenant).toHaveBeenCalledWith('panes', 'in_real123', pool);
    const [sqlInsert, paramsInsert] = pool.query.mock.calls[1];
    expect(sqlInsert).toMatch(/INSERT INTO tenant_solicitudes_factura/);
    expect(paramsInsert).toContain(479.2);
    expect(paramsInsert).not.toContain(49.64);
  });

  test('solicitud nueva (sin fila previa): guarda el monto real del invoice como snapshot', async () => {
    const pool = mockPool();
    pool.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ insertId: 5 }]);
    montoRealInvoiceTenant.mockResolvedValueOnce(399);

    const resultado = await crearSolicitud(DATOS_BASE, pool);

    expect(resultado).toEqual({ id: 5, folio: expect.stringMatching(/^SOL-/), estado: 'solicitada' });
  });

  test('montoRealInvoiceTenant no encuentra el invoice (null) -> ErrorFacturacionGestion "invoice_no_encontrado", nunca inserta', async () => {
    const pool = mockPool();
    pool.query.mockResolvedValueOnce([[]]); // SELECT existente: ninguna
    montoRealInvoiceTenant.mockResolvedValueOnce(null);

    const error = await crearSolicitud(DATOS_BASE, pool).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorFacturacionGestion);
    expect(error.codigo).toBe('invoice_no_encontrado');
    expect(pool.query).toHaveBeenCalledTimes(1); // solo el SELECT, nunca el INSERT
  });

  test('ya existe una solicitud no rechazada -> ErrorFacturacionGestion "ya_existe", nunca vuelve a calcular el monto', async () => {
    const pool = mockPool();
    pool.query.mockResolvedValueOnce([[{ id: 1, folio: 'SOL-123', estado: 'solicitada' }]]);

    const error = await crearSolicitud(DATOS_BASE, pool).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorFacturacionGestion);
    expect(error.codigo).toBe('ya_existe');
    expect(montoRealInvoiceTenant).not.toHaveBeenCalled();
  });

  test('reenviar una solicitud rechazada: reutiliza la misma fila, nunca recalcula el monto (snapshot del primer intento se conserva)', async () => {
    const pool = mockPool();
    pool.query
      .mockResolvedValueOnce([[{ id: 1, folio: 'SOL-123', estado: 'rechazada' }]])
      .mockResolvedValueOnce([{}]); // UPDATE

    const resultado = await crearSolicitud(DATOS_BASE, pool);

    expect(resultado).toEqual({ id: 1, folio: 'SOL-123', estado: 'solicitada' });
    expect(montoRealInvoiceTenant).not.toHaveBeenCalled();
    const [sqlUpdate] = pool.query.mock.calls[1];
    expect(sqlUpdate).toMatch(/UPDATE tenant_solicitudes_factura/);
    expect(sqlUpdate).not.toMatch(/monto/);
  });
});
