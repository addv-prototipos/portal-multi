const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

const { pool } = require('../../db');
const { crearTokenSesion } = require('../../utils/authUsuario');
const app = require('../../server');

const RFC_VALIDO = 'GOMJ800101ABC';

function cookieDeSesion(rfc = RFC_VALIDO) {
  return `sesion_usuario=${crearTokenSesion(rfc)}`;
}

// Segmento 3 de "Mi Cuenta" (Gestión de crédito, ver PROJECT_STATE.md):
// visibilidad de CxC + historial real de abonos, vinculado por correo.
// requiereFeature('ventasHabilitado'/'cxcHabilitado') es no-op sin
// req.tenant (sitio base, sin X-Tenant-Slug — ver requiereFeature.js), así
// que estos tests cubren la lógica de negocio real sin necesitar mockear
// el middleware de tenant.
describe('Cliente: Mi Cuenta — Gestión de crédito (GET /api/mi-cuenta/credito)', () => {
  afterEach(() => {
    pool.query.mockReset();
  });

  test('sin sesión responde 401', async () => {
    const res = await request(app).get('/api/mi-cuenta/credito');
    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('cuenta sin correo capturado: ceros y listas vacías, sin consultar ventas', async () => {
    pool.query.mockResolvedValueOnce([[{ email: null }]]); // SELECT email FROM usuarios
    const res = await request(app).get('/api/mi-cuenta/credito').set('Cookie', cookieDeSesion());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      resumen: { totalFacturado: 0, totalPagado: 0, saldoPendiente: 0 },
      ventasPendientes: [],
      abonos: [],
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('con correo pero sin ventas: ceros y listas vacías', async () => {
    pool.query.mockResolvedValueOnce([[{ email: 'cliente@empresa.mx' }]]); // SELECT email
    pool.query.mockResolvedValueOnce([[]]); // SELECT ventas
    pool.query.mockResolvedValueOnce([[]]); // SELECT abonos

    const res = await request(app).get('/api/mi-cuenta/credito').set('Cookie', cookieDeSesion());

    expect(res.status).toBe(200);
    expect(res.body.resumen).toEqual({ totalFacturado: 0, totalPagado: 0, saldoPendiente: 0 });
    expect(res.body.ventasPendientes).toEqual([]);
    expect(res.body.abonos).toEqual([]);
  });

  test('con ventas pagadas y pendientes: resumen correcto, solo las pendientes en ventasPendientes', async () => {
    pool.query.mockResolvedValueOnce([[{ email: 'cliente@empresa.mx' }]]); // SELECT email
    pool.query.mockResolvedValueOnce([
      [
        { id: 1, numero_compra: 'OC-000001', concepto: 'Venta 1', total: '500.00', monto_cobrado: '500.00', estado_pago: 'pagada', fecha_compra: '2026-09-01 10:00:00' },
        { id: 2, numero_compra: 'OC-000002', concepto: 'Venta 2', total: '300.00', monto_cobrado: '100.00', estado_pago: 'pendiente', fecha_compra: '2026-09-15 10:00:00' },
      ],
    ]); // SELECT ventas
    pool.query.mockResolvedValueOnce([
      [{ monto: '100.00', notas: 'Abono inicial', creado_en: '2026-09-16 09:00:00', numero_compra: 'OC-000002' }],
    ]); // SELECT abonos

    const res = await request(app).get('/api/mi-cuenta/credito').set('Cookie', cookieDeSesion());

    expect(res.status).toBe(200);
    expect(res.body.resumen).toEqual({ totalFacturado: 800, totalPagado: 600, saldoPendiente: 200 });
    expect(res.body.ventasPendientes).toEqual([
      { id: 2, numeroCompra: 'OC-000002', concepto: 'Venta 2', total: 300, saldo: 200, fechaCompra: '2026-09-15 10:00:00' },
    ]);
    expect(res.body.abonos).toEqual([
      { monto: 100, notas: 'Abono inicial', creadoEn: '2026-09-16 09:00:00', numeroCompra: 'OC-000002' },
    ]);
  });

  test('las consultas de ventas/abonos filtran por el correo de la sesión, no por un valor arbitrario', async () => {
    pool.query.mockResolvedValueOnce([[{ email: 'cliente@empresa.mx' }]]);
    pool.query.mockResolvedValueOnce([[]]);
    pool.query.mockResolvedValueOnce([[]]);

    await request(app).get('/api/mi-cuenta/credito').set('Cookie', cookieDeSesion());

    const llamadaVentas = pool.query.mock.calls.find(([sql]) => sql.includes('FROM ordenes_compra WHERE email'));
    expect(llamadaVentas[1]).toEqual(['cliente@empresa.mx']);
    const llamadaAbonos = pool.query.mock.calls.find(([sql]) => sql.includes('FROM abonos'));
    expect(llamadaAbonos[1]).toEqual(['cliente@empresa.mx']);
  });
});
