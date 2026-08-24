const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

const { pool } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const app = require('../../server');

// Misma técnica que gastos.test.js/admin.test.js: un usuario de perfil
// concreto salta directo a la 3ra capa de requireAdminAuth con una sola
// consulta a pool.query.
function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('Admin: Ventas (ordenes_compra) — correo opcional + reenviar/asignar', () => {
  afterEach(() => {
    pool.query.mockReset();
  });

  describe('POST /api/admin/ordenes-compra', () => {
    test('registra una venta con correo (comportamiento de siempre)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 5 }]]); // registros (correo con constancia)
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([{ insertId: 10, affectedRows: 1 }]); // INSERT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1 x Producto ($10.00 c/u)', cantidad: 10, email: 'cliente@ejemplo.com' });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('cliente@ejemplo.com');
    });

    test('registra una venta SIN correo (modalidad "Imprimir ticket") — 201, email null', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([{ insertId: 11, affectedRows: 1 }]); // INSERT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1 x Producto ($10.00 c/u)', cantidad: 10 });

      expect(res.status).toBe(201);
      expect(res.body.email).toBeNull();
      // Sin correo, no hay consulta a "registros" (se salta la validación
      // de constancia) — solo config + INSERT + UPDATE + el query de auth.
      expect(pool.query).toHaveBeenCalledTimes(4);
    });

    test('correo inválido cuando SÍ se manda uno, responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1 x Producto ($10.00 c/u)', cantidad: 10, email: 'no-es-un-correo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/correo/i);
    });

    test('correo sin constancia activa (cliente no nuevo) responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // registros -> sin coincidencia

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1 x Producto ($10.00 c/u)', cantidad: 10, email: 'sin-constancia@ejemplo.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/constancia/i);
    });

    test('Cuentas por cobrar (punto 138): venta pendiente con vencimiento futuro — 201', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([{ insertId: 12, affectedRows: 1 }]); // INSERT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra

      const mañana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({
          concepto: '1 x Producto ($10.00 c/u)',
          cantidad: 10,
          estado_pago: 'pendiente',
          fecha_vencimiento: mañana,
          notas_cobro: 'Crédito 15 días',
        });

      expect(res.status).toBe(201);
      expect(res.body.estado_pago).toBe('pendiente');
      expect(res.body.fecha_vencimiento).toBe(mañana);
      expect(res.body.notas_cobro).toBe('Crédito 15 días');
    });

    test('Cuentas por cobrar: vencimiento en el pasado responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1 x Producto ($10.00 c/u)', cantidad: 10, estado_pago: 'pendiente', fecha_vencimiento: ayer });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/vencimiento/i);
    });

    test('Cuentas por cobrar: estado_pago desconocido cae a "pagada" por defecto', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([{ insertId: 13, affectedRows: 1 }]); // INSERT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1 x Producto ($10.00 c/u)', cantidad: 10, estado_pago: 'algo-invalido' });

      expect(res.status).toBe(201);
      expect(res.body.estado_pago).toBe('pagada');
    });
  });

  describe('PUT /api/admin/ordenes-compra/:id/cobro (Cuentas por cobrar, punto 138)', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).put('/api/admin/ordenes-compra/1/cobro').send({ monto: 100 });
      expect(res.status).toBe(401);
    });

    test('perfil "fiscal" no tiene acceso (403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
      const res = await request(app).put('/api/admin/ordenes-compra/1/cobro').auth(usuario, password).send({ monto: 100 });
      expect(res.status).toBe(403);
    });

    test('monto inválido (cero o negativo) responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app).put('/api/admin/ordenes-compra/1/cobro').auth(usuario, password).send({ monto: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/monto/i);
    });

    test('venta inexistente responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // SELECT -> no existe
      const res = await request(app).put('/api/admin/ordenes-compra/999/cobro').auth(usuario, password).send({ monto: 100 });
      expect(res.status).toBe(404);
    });

    test('venta ya pagada (saldo 0) responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 5, total: '500.00', monto_cobrado: '500.00', estado_pago: 'pagada' }]]);
      const res = await request(app).put('/api/admin/ordenes-compra/5/cobro').auth(usuario, password).send({ monto: 100 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ya está pagada/i);
    });

    test('monto excede el saldo pendiente responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 5, total: '500.00', monto_cobrado: '0.00', estado_pago: 'pendiente' }]]);
      const res = await request(app).put('/api/admin/ordenes-compra/5/cobro').auth(usuario, password).send({ monto: 600 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/excede/i);
    });

    test('cobro parcial: actualiza monto_cobrado y deja estado_pago en "pendiente"', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 5, total: '500.00', monto_cobrado: '0.00', estado_pago: 'pendiente' }]]); // SELECT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
      pool.query.mockResolvedValueOnce([[{ id: 5, numero_compra: 'OC-000005', total: '500.00', monto_cobrado: '200.00', estado_pago: 'pendiente', fecha_cobro: null }]]); // SELECT actualizada

      const res = await request(app).put('/api/admin/ordenes-compra/5/cobro').auth(usuario, password).send({ monto: 200 });

      expect(res.status).toBe(200);
      expect(res.body.saldo).toBe(300);
      expect(pool.query).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/UPDATE ordenes_compra SET monto_cobrado/),
        expect.arrayContaining([200, 'pendiente'])
      );
    });

    test('cobro total: marca estado_pago="pagada" y fecha_cobro', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 6, total: '500.00', monto_cobrado: '300.00', estado_pago: 'pendiente' }]]); // SELECT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
      pool.query.mockResolvedValueOnce([[{ id: 6, numero_compra: 'OC-000006', total: '500.00', monto_cobrado: '500.00', estado_pago: 'pagada', fecha_cobro: '2026-08-24 10:00:00' }]]); // SELECT actualizada

      const res = await request(app).put('/api/admin/ordenes-compra/6/cobro').auth(usuario, password).send({ monto: 200, notas_cobro: 'Liquidado' });

      expect(res.status).toBe(200);
      expect(res.body.saldo).toBe(0);
      expect(res.body.orden.estado_pago).toBe('pagada');
      expect(pool.query).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/UPDATE ordenes_compra SET monto_cobrado/),
        expect.arrayContaining([500, 'pagada'])
      );
    });
  });

  describe('POST /api/admin/ordenes-compra/:id/reenviar-correo', () => {
    test('venta que ya tiene correo: reenvía al mismo, ignora el body', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 1, numero_compra: 'OC-000001', fecha_compra: '2026-08-22 10:00:00', concepto: 'x', cantidad: '10.00', iva_porcentaje: '16.00', total: '11.60', email: 'ya-tenia@ejemplo.com' }],
      ]); // SELECT orden
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ host: 'smtp.ejemplo.com', usuario: 'x@ejemplo.com', password: 'x' }) }],
      ]); // getConfigSmtp (dentro de enviarCorreoOrdenCompra)

      const res = await request(app)
        .post('/api/admin/ordenes-compra/1/reenviar-correo')
        .auth(usuario, password)
        .send({ email: 'otro@ejemplo.com' }); // se ignora, la orden ya tiene correo

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('ya-tenia@ejemplo.com');
      expect(res.body.tiene_constancia).toBeNull();
    });

    test('venta SIN correo: exige uno en el body, lo guarda y lo devuelve con tiene_constancia', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 2, numero_compra: 'OC-000002', fecha_compra: '2026-08-22 10:00:00', concepto: 'x', cantidad: '10.00', iva_porcentaje: '16.00', total: '11.60', email: null }],
      ]); // SELECT orden
      pool.query.mockResolvedValueOnce([[{ id: 9 }]]); // registros -> SÍ tiene constancia
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE email
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ host: 'smtp.ejemplo.com', usuario: 'x@ejemplo.com', password: 'x' }) }],
      ]); // getConfigSmtp (dentro de enviarCorreoOrdenCompra)

      const res = await request(app)
        .post('/api/admin/ordenes-compra/2/reenviar-correo')
        .auth(usuario, password)
        .send({ email: 'nuevo@ejemplo.com' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('nuevo@ejemplo.com');
      expect(res.body.tiene_constancia).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE ordenes_compra SET email/),
        expect.arrayContaining(['nuevo@ejemplo.com'])
      );
    });

    test('venta sin correo y sin correo en el body: 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 3, numero_compra: 'OC-000003', fecha_compra: '2026-08-22 10:00:00', concepto: 'x', cantidad: '10.00', iva_porcentaje: '16.00', total: '11.60', email: null }],
      ]); // SELECT orden

      const res = await request(app)
        .post('/api/admin/ordenes-compra/3/reenviar-correo')
        .auth(usuario, password)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/correo/i);
    });
  });
});
