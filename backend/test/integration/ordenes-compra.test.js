const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

// D8 (inventarios.md §22, segmento 4): registrarMovimiento/
// obtenerProductoPorId ya tienen su propia suite exhaustiva (test/unit/
// inventario.test.js contra su SQL real, y verificar-inventario.js
// contra MySQL real). Aquí solo se prueba que la ruta de Ventas los
// invoque correctamente y reaccione bien a sus resultados — motor
// mockeado, no reimplementado.
jest.mock('../../utils/inventario', () => {
  const actual = jest.requireActual('../../utils/inventario');
  return { ...actual, registrarMovimiento: jest.fn(), obtenerProductoPorId: jest.fn() };
});
jest.mock('../../utils/inventarioConfig', () => {
  const actual = jest.requireActual('../../utils/inventarioConfig');
  return { ...actual, inventarioActivo: jest.fn() };
});

// DELETE /ordenes-compra/:id genera un reporte de respaldo antes de
// borrar (comportamiento preexistente, sin relación con D8) — se mockea
// aquí para los tests nuevos de DELETE+reingreso de abajo, que de otra
// forma tendrían que simular también el SQL interno de esa función.
jest.mock('../../utils/reportes', () => {
  const actual = jest.requireActual('../../utils/reportes');
  return {
    ...actual,
    generarYEnviarReporte: jest.fn().mockResolvedValue({ correoEnviado: false, correoDestino: null }),
    guardarReporte: jest.fn().mockResolvedValue(999),
  };
});

const { pool } = require('../../db');
const { guardarReporte } = require('../../utils/reportes');
const { hashPassword } = require('../../utils/authUsuario');
const { registrarMovimiento, obtenerProductoPorId } = require('../../utils/inventario');
const { inventarioActivo } = require('../../utils/inventarioConfig');
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

    test('perfil "ventas" sí tiene acceso (punto 190) — pasa el gate y llega a la lógica real', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
      pool.query.mockResolvedValueOnce([[]]); // SELECT -> no existe, prueba que no fue un 403
      const res = await request(app).put('/api/admin/ordenes-compra/999/cobro').auth(usuario, password).send({ monto: 100 });
      expect(res.status).toBe(404);
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

describe('Admin: Ventas — D8 (inventarios.md §22, segmento 4): producto opcional', () => {
  afterEach(() => {
    pool.query.mockReset();
    registrarMovimiento.mockReset();
    obtenerProductoPorId.mockReset();
    inventarioActivo.mockReset();
  });

  describe('POST /api/admin/ordenes-compra con producto_id', () => {
    test('inventario activo + producto tipo "producto": genera la salida y guarda producto_id/producto_cantidad', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      inventarioActivo.mockResolvedValue(true);
      obtenerProductoPorId.mockResolvedValue({ id: 5, tipo: 'producto', nombre: 'Tornillo' });
      registrarMovimiento.mockResolvedValue({ movimientoId: 10, folio: 'SA-000010', existenciaAnterior: 20, existenciaPosterior: 15 });
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([{ insertId: 50 }]); // INSERT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // obtenerAlmacenDefectoId (ALM-1)

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1 x Tornillo M6', cantidad: 50, producto_id: 5, producto_cantidad: 5 });

      expect(res.status).toBe(201);
      expect(res.body.producto_id).toBe(5);
      expect(res.body.producto_cantidad).toBe(5);
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({ productoId: 5, tipo: 'venta', cantidad: 5, documentoOrigen: res.body.numero_compra })
      );
    });

    test('sin stock suficiente: revierte la venta (borra la fila) y responde 409 con el error real', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      inventarioActivo.mockResolvedValue(true);
      obtenerProductoPorId.mockResolvedValue({ id: 5, tipo: 'producto', nombre: 'Tornillo' });
      registrarMovimiento.mockResolvedValue({ error: 'INV_STOCK_INSUFICIENTE', mensaje: 'sin stock', disponible: 2 });
      pool.query.mockResolvedValueOnce([[]]); // config
      pool.query.mockResolvedValueOnce([{ insertId: 51 }]); // INSERT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE compensatorio

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1 x Tornillo M6', cantidad: 50, producto_id: 5, producto_cantidad: 999 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('INV_STOCK_INSUFICIENTE');
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM ordenes_compra WHERE id = ?', [51]);
    });

    // Punto 175: la validación real vive en registrarMovimiento() (ver
    // test/unit/inventario.test.js) — aquí solo se confirma que el error
    // se propaga con el status correcto (400, no 409 — no es un problema
    // de stock) hasta la respuesta HTTP de Ventas.
    test('cantidad con decimales en un producto de unidad de conteo: responde 400 con INV_CANTIDAD_DEBE_SER_ENTERA', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      inventarioActivo.mockResolvedValue(true);
      obtenerProductoPorId.mockResolvedValue({ id: 5, tipo: 'producto', nombre: 'Tornillo' });
      registrarMovimiento.mockResolvedValue({
        error: 'INV_CANTIDAD_DEBE_SER_ENTERA',
        mensaje: '"Pieza" es una unidad de conteo — la cantidad debe ser un número entero, sin decimales.',
      });
      pool.query.mockResolvedValueOnce([[]]); // config
      pool.query.mockResolvedValueOnce([{ insertId: 52 }]); // INSERT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE compensatorio

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: '1.5 x Tornillo M6', cantidad: 50, producto_id: 5, producto_cantidad: 1.5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_CANTIDAD_DEBE_SER_ENTERA');
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM ordenes_compra WHERE id = ?', [52]);
    });

    test('producto tipo "servicio": no llama a registrarMovimiento (D11)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      inventarioActivo.mockResolvedValue(true);
      obtenerProductoPorId.mockResolvedValue({ id: 9, tipo: 'servicio', nombre: 'Instalación' });
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([{ insertId: 52 }]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: 'Instalación', cantidad: 300, producto_id: 9, producto_cantidad: 1 });

      expect(res.status).toBe(201);
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });

    test('inventario_activo=0 en el tenant: ignora producto_id por completo, venta manual como siempre', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      inventarioActivo.mockResolvedValue(false);
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([{ insertId: 53 }]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: 'Producto sin modulo activo', cantidad: 10, producto_id: 5, producto_cantidad: 1 });

      expect(res.status).toBe(201);
      expect(res.body.producto_id).toBeNull();
      expect(obtenerProductoPorId).not.toHaveBeenCalled();
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });

    test('sin producto_id en el body: nunca llama a inventarioActivo() (cero costo para una venta manual normal)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([{ insertId: 54 }]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({ concepto: 'Venta manual normal', cantidad: 10 });

      expect(res.status).toBe(201);
      expect(inventarioActivo).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/ordenes-compra con productos_inventario (Segmento A, varias líneas)', () => {
    test('2 líneas de inventario: descuenta ambas y las guarda en orden_productos', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      inventarioActivo.mockResolvedValue(true);
      obtenerProductoPorId.mockImplementation((id) =>
        Promise.resolve(id === 5 ? { id: 5, tipo: 'producto', sku: 'TNR-5', nombre: 'Toner' } : { id: 6, tipo: 'producto', sku: 'PAP-6', nombre: 'Papel' })
      );
      registrarMovimiento.mockResolvedValue({ movimientoId: 1, folio: 'SA-000001' });
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([{ insertId: 60 }]); // INSERT ordenes_compra
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // obtenerAlmacenDefectoId (ALM-1)
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]); // INSERT orden_productos línea 1
      pool.query.mockResolvedValueOnce([{ insertId: 2 }]); // INSERT orden_productos línea 2

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({
          concepto: '2 x Toner ($450.00 c/u)\n1 x Papel ($320.00 c/u)',
          cantidad: 1220,
          productos_inventario: [
            { producto_id: 5, cantidad: 2 },
            { producto_id: 6, cantidad: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.producto_id).toBeNull();
      expect(res.body.productos_inventario).toEqual([
        { producto_id: 5, cantidad: 2, sku: 'TNR-5', nombre: 'Toner' },
        { producto_id: 6, cantidad: 1, sku: 'PAP-6', nombre: 'Papel' },
      ]);
      expect(registrarMovimiento).toHaveBeenCalledTimes(2);
      expect(registrarMovimiento).toHaveBeenNthCalledWith(1, expect.objectContaining({ productoId: 5, tipo: 'venta', cantidad: 2 }));
      expect(registrarMovimiento).toHaveBeenNthCalledWith(2, expect.objectContaining({ productoId: 6, tipo: 'venta', cantidad: 1 }));
      expect(pool.query).toHaveBeenCalledWith('INSERT INTO orden_productos (orden_id, producto_id, cantidad, creado_en) VALUES (?, ?, ?, ?)', expect.arrayContaining([60, 5, 2]));
    });

    test('todo o nada: si la 2da línea no tiene stock, revierte la 1ra (devolucion_cliente) y borra la venta', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      inventarioActivo.mockResolvedValue(true);
      obtenerProductoPorId.mockImplementation((id) =>
        Promise.resolve(id === 5 ? { id: 5, tipo: 'producto', sku: 'TNR-5', nombre: 'Toner' } : { id: 6, tipo: 'producto', sku: 'PAP-6', nombre: 'Papel' })
      );
      registrarMovimiento
        .mockResolvedValueOnce({ movimientoId: 1, folio: 'SA-000001' }) // línea 1: OK
        .mockResolvedValueOnce({ error: 'INV_STOCK_INSUFICIENTE', mensaje: 'sin stock', disponible: 0 }) // línea 2: falla
        .mockResolvedValueOnce({ movimientoId: 2, folio: 'EN-000002' }); // reversión de la línea 1
      pool.query.mockResolvedValueOnce([[]]); // config
      pool.query.mockResolvedValueOnce([{ insertId: 61 }]); // INSERT ordenes_compra
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_compra
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // obtenerAlmacenDefectoId
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE compensatorio de la venta

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({
          concepto: '2 x Toner ($450.00 c/u)\n99 x Papel ($320.00 c/u)',
          cantidad: 32580,
          productos_inventario: [
            { producto_id: 5, cantidad: 2 },
            { producto_id: 6, cantidad: 99 },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('INV_STOCK_INSUFICIENTE');
      expect(registrarMovimiento).toHaveBeenCalledTimes(3);
      expect(registrarMovimiento).toHaveBeenNthCalledWith(3, expect.objectContaining({ productoId: 5, tipo: 'devolucion_cliente', cantidad: 2 }));
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM ordenes_compra WHERE id = ?', [61]);
    });

    test('el mismo producto repetido en 2 líneas: 400, sin tocar inventario', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      inventarioActivo.mockResolvedValue(true);
      obtenerProductoPorId.mockResolvedValue({ id: 5, tipo: 'producto', sku: 'TNR-5', nombre: 'Toner' });

      const res = await request(app)
        .post('/api/admin/ordenes-compra')
        .auth(usuario, password)
        .send({
          concepto: '2 x Toner ($450.00 c/u)\n1 x Toner ($450.00 c/u)',
          cantidad: 1350,
          productos_inventario: [
            { producto_id: 5, cantidad: 2 },
            { producto_id: 5, cantidad: 1 },
          ],
        });

      expect(res.status).toBe(400);
      expect(obtenerProductoPorId).toHaveBeenCalledTimes(1);
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/ordenes-compra con productos_inventario (Segmento A)', () => {
    test('incluye la lista de líneas de inventario por venta', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 70, numero_compra: 'OC-000070', fecha_compra: '2026-08-25 10:00:00', concepto: 'x', cantidad: '1220.00', iva_porcentaje: '16.00', total: '1415.20', email: null, estado_pago: 'pagada', producto_id: null, producto_cantidad: null, facturado: 0 }],
      ]); // SELECT ordenes
      pool.query.mockResolvedValueOnce([
        [
          { orden_id: 70, producto_id: 5, cantidad: '2.000', producto_sku: 'TNR-5', producto_nombre: 'Toner' },
          { orden_id: 70, producto_id: 6, cantidad: '1.000', producto_sku: 'PAP-6', producto_nombre: 'Papel' },
        ],
      ]); // SELECT orden_productos
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults

      const res = await request(app).get('/api/admin/ordenes-compra').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.ordenes[0].productos_inventario).toEqual([
        { producto_id: 5, cantidad: 2, sku: 'TNR-5', nombre: 'Toner' },
        { producto_id: 6, cantidad: 1, sku: 'PAP-6', nombre: 'Papel' },
      ]);
    });

    test('perfil "ventas" sí tiene acceso (punto 190)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
      pool.query.mockResolvedValueOnce([[]]); // SELECT ordenes -> ninguna
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults

      const res = await request(app).get('/api/admin/ordenes-compra').auth(usuario, password);

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/admin/ordenes-compra/:id con producto (reingreso automático)', () => {
    test('producto sigue existiendo: reingresa las unidades (devolucion_cliente) antes de borrar', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 7, numero_compra: 'OC-000007', fecha_compra: '2026-08-22 10:00:00', concepto: 'x', cantidad: '50.00', iva_porcentaje: '16.00', total: '58.00', email: null, producto_id: 5, producto_cantidad: '5.000' }],
      ]); // SELECT orden
      obtenerProductoPorId.mockResolvedValue({ id: 5, tipo: 'producto' });
      registrarMovimiento.mockResolvedValue({ movimientoId: 20, folio: 'EN-000020' });
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // obtenerAlmacenDefectoId (ALM-1)
      pool.query.mockResolvedValueOnce([[]]); // SELECT orden_productos (Segmento A) — sin líneas
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]); // DELETE FROM orden_productos (Segmento A)
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE final

      const res = await request(app).delete('/api/admin/ordenes-compra/7').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({ productoId: 5, almacenId: 1, tipo: 'devolucion_cliente', cantidad: 5, documentoOrigen: 'OC-000007' })
      );
    });

    test('el reingreso falla (ej. concurrencia real): NO borra la venta, responde 409', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 8, numero_compra: 'OC-000008', fecha_compra: '2026-08-22 10:00:00', concepto: 'x', cantidad: '50.00', iva_porcentaje: '16.00', total: '58.00', email: null, producto_id: 5, producto_cantidad: '5.000' }],
      ]);
      obtenerProductoPorId.mockResolvedValue({ id: 5, tipo: 'producto' });
      registrarMovimiento.mockResolvedValue({ error: 'INV_CONCURRENCIA', mensaje: 'reintenta' });
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // obtenerAlmacenDefectoId (ALM-1)

      const res = await request(app).delete('/api/admin/ordenes-compra/8').auth(usuario, password);

      expect(res.status).toBe(409);
      expect(pool.query).not.toHaveBeenCalledWith('DELETE FROM ordenes_compra WHERE id = ?', [8]);
    });

    test('el producto ya no existe (borrado aparte): omite el reingreso en silencio y borra la venta igual', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 9, numero_compra: 'OC-000009', fecha_compra: '2026-08-22 10:00:00', concepto: 'x', cantidad: '50.00', iva_porcentaje: '16.00', total: '58.00', email: null, producto_id: 999, producto_cantidad: '5.000' }],
      ]);
      obtenerProductoPorId.mockResolvedValue(null);
      pool.query.mockResolvedValueOnce([[]]); // SELECT orden_productos (Segmento A) — sin líneas
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]); // DELETE FROM orden_productos (Segmento A)
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE final

      const res = await request(app).delete('/api/admin/ordenes-compra/9').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });

    test('venta sin producto_id (venta manual normal): no consulta obtenerProductoPorId', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 10, numero_compra: 'OC-000010', fecha_compra: '2026-08-22 10:00:00', concepto: 'x', cantidad: '50.00', iva_porcentaje: '16.00', total: '58.00', email: null, producto_id: null, producto_cantidad: null }],
      ]);
      pool.query.mockResolvedValueOnce([[]]); // SELECT orden_productos (Segmento A) — sin líneas
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]); // DELETE FROM orden_productos (Segmento A)
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE final

      const res = await request(app).delete('/api/admin/ordenes-compra/10').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(obtenerProductoPorId).not.toHaveBeenCalled();
    });

    test('varias líneas de inventario (Segmento A): reingresa cada una y borra orden_productos', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 11, numero_compra: 'OC-000011', fecha_compra: '2026-08-25 10:00:00', concepto: 'x', cantidad: '1220.00', iva_porcentaje: '16.00', total: '1415.20', email: null, producto_id: null, producto_cantidad: null }],
      ]); // SELECT orden
      pool.query.mockResolvedValueOnce([[{ producto_id: 5, cantidad: '2.000' }, { producto_id: 6, cantidad: '1.000' }]]); // SELECT orden_productos
      obtenerProductoPorId.mockImplementation((id) => Promise.resolve({ id, tipo: 'producto' }));
      registrarMovimiento.mockResolvedValue({ movimientoId: 99, folio: 'EN-000099' });
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // obtenerAlmacenDefectoId
      pool.query.mockResolvedValueOnce([{ affectedRows: 2 }]); // DELETE FROM orden_productos
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE final

      const res = await request(app).delete('/api/admin/ordenes-compra/11').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(registrarMovimiento).toHaveBeenCalledTimes(2);
      expect(registrarMovimiento).toHaveBeenCalledWith(expect.objectContaining({ productoId: 5, tipo: 'devolucion_cliente', cantidad: 2 }));
      expect(registrarMovimiento).toHaveBeenCalledWith(expect.objectContaining({ productoId: 6, tipo: 'devolucion_cliente', cantidad: 1 }));
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM orden_productos WHERE orden_id = ?', [11]);
    });
  });
});

describe('POST /api/admin/reportes/corte (punto 168: "Corte del día" en Ventas)', () => {
  afterEach(() => {
    pool.query.mockReset();
    guardarReporte.mockClear();
  });

  test('sin fechas responde 400', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    const res = await request(app).post('/api/admin/reportes/corte').auth(usuario, password).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fecha/i);
  });

  test('desde posterior a hasta responde 400', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    const res = await request(app)
      .post('/api/admin/reportes/corte')
      .auth(usuario, password)
      .send({ desde: '2026-08-31', hasta: '2026-08-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/anterior o igual/i);
  });

  test('perfil "fiscal" no tiene acceso (403) — misma restricción que el resto de Ventas', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
    const res = await request(app)
      .post('/api/admin/reportes/corte')
      .auth(usuario, password)
      .send({ desde: '2026-08-01', hasta: '2026-08-31' });
    expect(res.status).toBe(403);
  });

  test('perfil "ventas" sí tiene acceso (punto 190) — el botón "Corte del día" vive dentro de Ventas', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
    pool.query.mockResolvedValueOnce([[]]); // SELECT ordenes -> ninguna
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
    const res = await request(app)
      .post('/api/admin/reportes/corte')
      .auth(usuario, password)
      .send({ desde: '2026-08-01', hasta: '2026-08-31' });
    expect(res.status).toBe(200);
  });

  test('calcula subtotal/IVA/facturado/cobrado correctamente y guarda el reporte (tipo "corte")', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          numero_compra: 'OC-000001',
          fecha_compra: '2026-08-15 10:00:00',
          concepto: 'Venta 1',
          cantidad: '100.00',
          total: '116.00',
          email: 'cliente1@ejemplo.com',
          estado_pago: 'pagada',
          monto_cobrado: '116.00',
          facturado: 1,
        },
        {
          id: 2,
          numero_compra: 'OC-000002',
          fecha_compra: '2026-08-16 12:00:00',
          concepto: 'Venta 2',
          cantidad: '200.00',
          total: '232.00',
          email: 'cliente2@ejemplo.com',
          estado_pago: 'pendiente',
          monto_cobrado: '0.00',
          facturado: 0,
        },
      ],
    ]); // SELECT ordenes en rango
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults

    const res = await request(app)
      .post('/api/admin/reportes/corte')
      .auth(usuario, password)
      .send({ desde: '2026-08-01', hasta: '2026-08-31' });

    expect(res.status).toBe(200);
    expect(res.body.resumen).toEqual({
      ventas: 2,
      subtotal: 300,
      iva: 48,
      total: 348,
      facturado: 116,
      sin_facturar: 232,
      cobrado: 116,
      pendiente_cobro: 232,
    });
    expect(res.body.ordenes).toHaveLength(2);
    expect(res.body.ordenes[0].facturado).toBe(true);
    expect(res.body.ordenes[1].facturado).toBe(false);
    expect(guardarReporte).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'corte',
        totalMonto: 348,
        items: expect.arrayContaining([
          expect.objectContaining({ tipo_registro: 'orden_compra', identificador: 'OC-000001' }),
          expect.objectContaining({ tipo_registro: 'orden_compra', identificador: 'OC-000002' }),
        ]),
      })
    );
  });

  test('sin ventas en el rango: resumen en ceros, reporte igual se guarda', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[]]); // SELECT ordenes -> ninguna
    pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults

    const res = await request(app)
      .post('/api/admin/reportes/corte')
      .auth(usuario, password)
      .send({ desde: '2026-01-01', hasta: '2026-01-31' });

    expect(res.status).toBe(200);
    expect(res.body.resumen.ventas).toBe(0);
    expect(res.body.ordenes).toEqual([]);
    expect(guardarReporte).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'corte', items: [] }));
  });
});
