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

function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

// Mismo helper de coincidencia por prefijo que ya usa inventarios.test.js —
// las 4 queries del endpoint no dependen de orden estricto entre sí más
// allá de lo que ya impone el propio handler, así que emparejar por texto
// es más resistente a reordenamientos futuros que una cola posicional.
function mockPoolPorPatron(mapa) {
  pool.query.mockImplementation(async (sql) => {
    const s = String(sql).trim();
    for (const [patron, valor] of mapa) {
      if (s.startsWith(patron)) return typeof valor === 'function' ? valor() : valor;
    }
    return [[]];
  });
}

const MODULO_ACTIVO = ['SELECT valor FROM configuracion', [[{ valor: '1' }]]];
const MODULO_INACTIVO = ['SELECT valor FROM configuracion', [[]]];
const ALMACEN_ID = ['SELECT id FROM almacenes WHERE codigo', [[{ id: 1 }]]];
const VALOR_EXISTENCIA = ["SELECT COALESCE(SUM(e.disponible * p.costo_promedio), 0) AS valor\n         FROM existencias e", [[{ valor: '0' }]]];
const SIN_MOVIMIENTO = ["SELECT COUNT(*) AS total\n         FROM productos p\n        WHERE p.eliminado_en IS NULL AND p.estado = 'activo' AND p.tipo = 'producto'\n          AND NOT EXISTS", [[{ total: 0 }]]];
const BASE_PRODUCTOS_VACIO = ['SELECT p.id, p.nombre,', [[]]];
const CATEGORIA_VACIA = ['SELECT c.id AS categoria_id', [[]]];

describe('Admin: Estado del inventario (Reportes)', () => {
  afterEach(() => {
    pool.query.mockReset();
  });

  test('sin credenciales responde 401', async () => {
    const res = await request(app).get('/api/admin/inventarios/reportes/estado');
    expect(res.status).toBe(401);
  });

  test('perfil "fiscal" no tiene acceso (403)', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
    const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);
    expect(res.status).toBe(403);
  });

  test('módulo Inventarios inactivo responde 403 INV_MODULO_INACTIVO', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    mockPoolPorPatron([MODULO_INACTIVO]);
    const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INV_MODULO_INACTIVO');
  });

  test('estado vacío: sin productos, sin NaN/Infinity, porcentajes en 0', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    mockPoolPorPatron([
      MODULO_ACTIVO,
      ALMACEN_ID,
      VALOR_EXISTENCIA,
      SIN_MOVIMIENTO,
      BASE_PRODUCTOS_VACIO,
      CATEGORIA_VACIA,
    ]);
    const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);
    expect(res.status).toBe(200);
    expect(res.body.kpis).toEqual({ valor_total_existencia: 0, rotacion_promedio_catalogo: 0, productos_sin_movimiento_90d: 0 });
    expect(res.body.top_ventas_90d).toEqual([]);
    expect(res.body.bottom_ventas_90d).toEqual([]);
    expect(res.body.rotacion).toEqual([]);
    expect(res.body.valor_por_categoria).toEqual([]);
    expect(res.body.cobertura).toEqual({
      riesgo: { productos: 0, porcentaje: 0 },
      saludable: { productos: 0, porcentaje: 0 },
      sobrestock: { productos: 0, porcentaje: 0 },
      total_productos: 0,
    });
  });

  test('administrador recibe kpis + 4 gráficas con datos reales, rotación_promedio consistente con el array de rotación', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    const filasProductos = [
      { id: 1, nombre: 'Tóner HP Negro', existencia_actual: '100.000', unidades_vendidas_90d: '340.000' },
      { id: 2, nombre: 'Router empresarial', existencia_actual: '40.000', unidades_vendidas_90d: '0.000' },
      { id: 3, nombre: 'Laptop Lenovo 15"', existencia_actual: '10.000', unidades_vendidas_90d: '5.000' },
    ];
    mockPoolPorPatron([
      MODULO_ACTIVO,
      ALMACEN_ID,
      ["SELECT COALESCE(SUM(e.disponible * p.costo_promedio), 0) AS valor\n         FROM existencias e", [[{ valor: '125430.50' }]]],
      ["SELECT COUNT(*) AS total\n         FROM productos p\n        WHERE p.eliminado_en IS NULL AND p.estado = 'activo' AND p.tipo = 'producto'\n          AND NOT EXISTS", [[{ total: 1 }]]],
      ['SELECT p.id, p.nombre,', [filasProductos]],
      ['SELECT c.id AS categoria_id', [[{ categoria_id: 1, categoria_nombre: 'Cómputo', valor: '54000.00' }]]],
    ]);

    const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body.kpis.valor_total_existencia).toBe(125430.5);
    expect(res.body.kpis.productos_sin_movimiento_90d).toBe(1);
    // rotacion_promedio_catalogo = ratio de sumas: (340+0+5) / (100+40+10) = 345/150
    expect(res.body.kpis.rotacion_promedio_catalogo).toBe(Math.round((345 / 150) * 100) / 100);

    expect(res.body.top_ventas_90d[0]).toEqual({ producto_id: 1, nombre: 'Tóner HP Negro', unidades_vendidas_90d: 340 });
    expect(res.body.bottom_ventas_90d[0]).toEqual({ producto_id: 2, nombre: 'Router empresarial', unidades_vendidas_90d: 0 });

    // Producto 1: rotacion = 340 / GREATEST(100,1) = 3.4
    const rotacionToner = res.body.rotacion.find((r) => r.producto_id === 1);
    expect(rotacionToner.rotacion).toBe(3.4);

    expect(res.body.valor_por_categoria).toEqual([{ categoria_id: 1, categoria_nombre: 'Cómputo', valor: 54000 }]);
  });

  test('proxy de rotación con existencia_actual=0 usa GREATEST(existencia,1), nunca Infinity', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    mockPoolPorPatron([
      MODULO_ACTIVO,
      ALMACEN_ID,
      VALOR_EXISTENCIA,
      SIN_MOVIMIENTO,
      ['SELECT p.id, p.nombre,', [[{ id: 9, nombre: 'Producto sin stock', existencia_actual: '0.000', unidades_vendidas_90d: '50.000' }]]],
      CATEGORIA_VACIA,
    ]);
    const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);
    expect(res.status).toBe(200);
    expect(res.body.rotacion[0].rotacion).toBe(50);
    expect(Number.isFinite(res.body.rotacion[0].rotacion)).toBe(true);
  });

  test('buckets de cobertura: 0 ventas cae en sobrestock aunque haya mucho stock', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    mockPoolPorPatron([
      MODULO_ACTIVO,
      ALMACEN_ID,
      VALOR_EXISTENCIA,
      SIN_MOVIMIENTO,
      ['SELECT p.id, p.nombre,', [[{ id: 1, nombre: 'Dead stock', existencia_actual: '999.000', unidades_vendidas_90d: '0.000' }]]],
      CATEGORIA_VACIA,
    ]);
    const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);
    expect(res.status).toBe(200);
    expect(res.body.cobertura).toEqual({
      riesgo: { productos: 0, porcentaje: 0 },
      saludable: { productos: 0, porcentaje: 0 },
      sobrestock: { productos: 1, porcentaje: 100 },
      total_productos: 1,
    });
  });

  test('buckets de cobertura: 7 y 60 días exactos caen en "saludable" (borde inclusivo)', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    // dias_cobertura = existencia / (unidades/90). Para que dé exactamente
    // 7: unidades=90, existencia=7 -> 7/(90/90)=7. Para 60: unidades=90,
    // existencia=60 -> 60/(90/90)=60.
    mockPoolPorPatron([
      MODULO_ACTIVO,
      ALMACEN_ID,
      VALOR_EXISTENCIA,
      SIN_MOVIMIENTO,
      [
        'SELECT p.id, p.nombre,',
        [[
          { id: 1, nombre: 'Borde 7 días', existencia_actual: '7.000', unidades_vendidas_90d: '90.000' },
          { id: 2, nombre: 'Borde 60 días', existencia_actual: '60.000', unidades_vendidas_90d: '90.000' },
        ]],
      ],
      CATEGORIA_VACIA,
    ]);
    const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);
    expect(res.status).toBe(200);
    expect(res.body.cobertura.riesgo.productos).toBe(0);
    expect(res.body.cobertura.saludable.productos).toBe(2);
    expect(res.body.cobertura.sobrestock.productos).toBe(0);
  });

  test('las queries de ventana usan DATE_SUB(NOW(), INTERVAL 90 DAY) — guarda de regresión', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    mockPoolPorPatron([
      MODULO_ACTIVO,
      ALMACEN_ID,
      VALOR_EXISTENCIA,
      SIN_MOVIMIENTO,
      BASE_PRODUCTOS_VACIO,
      CATEGORIA_VACIA,
    ]);
    const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);
    expect(res.status).toBe(200);
    const consultas = pool.query.mock.calls.map((c) => String(c[0]));
    const conVentana = consultas.filter((s) => s.includes('DATE_SUB(NOW(), INTERVAL 90 DAY)'));
    expect(conVentana.length).toBeGreaterThanOrEqual(2);
  });
});
