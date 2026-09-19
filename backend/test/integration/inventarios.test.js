const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

// El motor de existencias (registrarMovimiento/conciliarInventario) ya
// tiene su propia suite exhaustiva contra su SQL real (test/unit/
// inventario.test.js) y contra MySQL real (scripts/verificar-inventario.js).
// Aquí solo se prueba la CAPA HTTP: validación de tipo, status codes,
// delegación correcta — con el motor mockeado, no reimplementado.
jest.mock('../../utils/inventario', () => {
  const actual = jest.requireActual('../../utils/inventario');
  return {
    ...actual,
    registrarMovimiento: jest.fn(),
    conciliarInventario: jest.fn(),
  };
});

// Imagen principal de producto (punto 159, Segmento B): el pipeline real
// de sharp/MinIO ya tiene su propia suite (test/unit/inventarioImagen.test.js)
// — aquí solo se prueba la CAPA HTTP, mismo criterio que registrarMovimiento
// arriba.
jest.mock('../../utils/inventarioImagen', () => {
  const actual = jest.requireActual('../../utils/inventarioImagen');
  return {
    ...actual,
    guardarImagenProducto: jest.fn(),
    eliminarImagenProducto: jest.fn(),
  };
});

jest.mock('../../utils/storage', () => ({
  PREFIJO_DEFECTO: '_default',
  prefijoTenant: jest.fn(() => '_default'),
  guardarArchivo: jest.fn().mockResolvedValue(undefined),
  existeArchivo: jest.fn().mockResolvedValue(true),
  eliminarArchivo: jest.fn().mockResolvedValue(undefined),
  enviarArchivoARespuesta: jest.fn((prefijo, carpeta, nombreArchivo, res) => {
    res.end(Buffer.from('contenido-simulado'));
    return Promise.resolve();
  }),
}));

const { pool } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const { registrarMovimiento, conciliarInventario, ALMACEN_DEFECTO_CODIGO } = require('../../utils/inventario');
const { guardarImagenProducto, eliminarImagenProducto, ErrorImagenProducto } = require('../../utils/inventarioImagen');
const storage = require('../../utils/storage');
const app = require('../../server');

function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

// Mock por patrón de SQL (en vez de una cadena posicional frágil de
// mockResolvedValueOnce) — más robusto ante el número real de queries
// que dispara cada ruta. `mockResolvedValueOnce` de la llamada de auth
// (arriba) siempre se consume primero; esto cubre todo lo que sigue.
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
const MODULO_INACTIVO = ['SELECT valor FROM configuracion', [[]]]; // sin fila -> default '0'
const ALMACEN_ID = ['SELECT id FROM almacenes WHERE codigo', [[{ id: 1 }]]];

describe('Inventarios — capa HTTP (segmento 2)', () => {
  afterEach(() => {
    pool.query.mockReset();
    registrarMovimiento.mockReset();
    conciliarInventario.mockReset();
  });

  describe('Gate D8/§0.6: requireInventarioActivo', () => {
    test('módulo inactivo (default) responde 403 INV_MODULO_INACTIVO en una ruta gateada', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_INACTIVO]);

      const res = await request(app).get('/api/admin/inventarios/categorias').auth(usuario, password);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('INV_MODULO_INACTIVO');
    });

    test('GET /configuracion NUNCA se bloquea por el gate (si no, nadie podría prenderlo)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValue([[]]); // todas las claves caen a su default

      const res = await request(app).get('/api/admin/inventarios/configuracion').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.configuracion.inventario_activo).toBe('0');
    });

    test('perfil "fiscal" no tiene acceso al módulo (403, coherente con D7)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app).get('/api/admin/inventarios/categorias').auth(usuario, password);
      expect(res.status).toBe(403);
    });
  });

  describe('Configuración', () => {
    test('PUT /configuracion/:clave rechaza clave no reconocida', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .put('/api/admin/inventarios/configuracion/clave_inventada')
        .auth(usuario, password)
        .send({ valor: '1' });
      expect(res.status).toBe(400);
    });

    test('PUT /configuracion/inventario_activo con "1" activa el módulo', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValue([{ affectedRows: 1 }]);

      const res = await request(app)
        .put('/api/admin/inventarios/configuracion/inventario_activo')
        .auth(usuario, password)
        .send({ valor: '1' });

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe('1');
    });

    test('PUT /configuracion/inv_imagen_max_mb fuera de rango (P3: 1-20) responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .put('/api/admin/inventarios/configuracion/inv_imagen_max_mb')
        .auth(usuario, password)
        .send({ valor: '50' });
      expect(res.status).toBe(400);
    });

    test('PUT /configuracion/inv_solo_servicios con "1" e inventario inactivo responde 400 INV_MODULO_INACTIVO (punto 188)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_INACTIVO]);

      const res = await request(app)
        .put('/api/admin/inventarios/configuracion/inv_solo_servicios')
        .auth(usuario, password)
        .send({ valor: '1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_MODULO_INACTIVO');
    });

    test('PUT /configuracion/inv_solo_servicios con "1" e inventario activo sin productos físicos activa (punto 188)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT COUNT(*) AS total FROM productos', [[{ total: 0 }]]],
        ['INSERT INTO configuracion', [{ affectedRows: 1 }]],
      ]);

      const res = await request(app)
        .put('/api/admin/inventarios/configuracion/inv_solo_servicios')
        .auth(usuario, password)
        .send({ valor: '1' });

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe('1');
    });
  });

  describe('Categorías', () => {
    test('GET /categorias lista con módulo activo', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT c.id, c.slug, c.nombre, c.activa', [[{ id: 1, slug: 'ferreteria', nombre: 'Ferretería', activa: 1, tiene_productos: 0 }]]],
      ]);
      const res = await request(app).get('/api/admin/inventarios/categorias').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.categorias).toHaveLength(1);
      expect(res.body.categorias[0].slug).toBe('ferreteria');
    });

    test('POST /categorias sin nombre responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app).post('/api/admin/inventarios/categorias').auth(usuario, password).send({});
      expect(res.status).toBe(400);
    });

    test('POST /categorias crea con slug generado', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM categorias_inventario WHERE slug', [[]]],
        ['INSERT INTO categorias_inventario', [{ insertId: 7 }]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/categorias')
        .auth(usuario, password)
        .send({ nombre: 'Papelería' });
      expect(res.status).toBe(201);
      expect(res.body.categoria.slug).toBe('papeleria');
    });

    test('DELETE /categorias/:id con productos asociados desactiva en vez de borrar', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT c.id,', [[{ id: 3, tiene_productos: 1 }]]],
        ['UPDATE categorias_inventario SET activa = 0', [{ affectedRows: 1 }]],
      ]);
      const res = await request(app).delete('/api/admin/inventarios/categorias/3').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/desactivada/i);
    });
  });

  describe('Productos', () => {
    test('POST /productos sin SKU responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Tornillo' });
      expect(res.status).toBe(400);
    });

    test('POST /productos con SKU duplicado responde INV_SKU_DUPLICADO', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM productos WHERE sku', [[{ id: 99 }]]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Tornillo', sku: 'TORN-1', unidad_id: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_SKU_DUPLICADO');
    });

    // "SELECT valor FROM configuracion WHERE clave = ? LIMIT 1" es el
    // MISMO texto SQL para "inventario_activo" (gate del módulo) y para
    // "inv_solo_servicios" (punto 182, guard de validarCuerpoProducto en
    // altas de producto) — mockPoolPorPatron solo distingue por prefijo
    // de SQL, no por el parámetro, así que estas 2 pruebas necesitan
    // mirar `params` para no confundir una con la otra (inv_solo_servicios
    // debe caer a su default '0'/desactivado en ambas).
    function mockPoolConfigPorClave(mapaAdicional) {
      pool.query.mockImplementation(async (sql, params) => {
        const s = String(sql).trim();
        if (s.startsWith('SELECT valor FROM configuracion')) {
          if (params && params[0] === 'inv_solo_servicios') return [[]]; // sin fila -> default '0'
          return [[{ valor: '1' }]]; // inventario_activo
        }
        for (const [patron, valor] of mapaAdicional) {
          if (s.startsWith(patron)) return typeof valor === 'function' ? valor() : valor;
        }
        return [[]];
      });
    }

    test('POST /productos con unidad inexistente responde INV_UNIDAD_INVALIDA', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolConfigPorClave([
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT id FROM unidades_medida WHERE id', [[]]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Tornillo', sku: 'TORN-1', unidad_id: 999 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_UNIDAD_INVALIDA');
    });

    test('POST /productos válido crea (tipo default "producto")', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolConfigPorClave([
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT id FROM unidades_medida WHERE id', [[{ id: 1 }]]],
        ['INSERT INTO productos', [{ insertId: 42 }]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Tornillo M6', sku: 'TORN-M6', unidad_id: 1 });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(42);
    });

    // Punto 179: tipo=servicio ignora codigo_barras/stock_minimo/
    // stock_maximo/punto_reorden (quedan NA), sin importar lo que mande
    // el body — validado del lado del servidor. Sin `unidad_id` en el
    // body cae al default histórico "Hora" (compatibilidad).
    test('POST /productos tipo=servicio sin unidad_id cae a "Hora" e ignora codigo_barras/stock/punto_reorden', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT id FROM unidades_medida WHERE nombre', [[{ id: 9 }]]],
        ['INSERT INTO productos', [{ insertId: 55 }]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({
          nombre: 'Consultoría fiscal', sku: 'SERV-1', tipo: 'servicio',
          codigo_barras: '7501234567890', stock_minimo: '5', stock_maximo: '20', punto_reorden: '3',
          costo: '100', precio: '250',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(55);

      const insert = pool.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO productos'));
      const params = insert[1];
      // Orden de columnas: sku, codigo_barras, nombre, categoria_id, unidad_id, tipo, ...
      expect(params[1]).toBeNull(); // codigo_barras
      expect(params[4]).toBe(9); // unidad_id default "Hora"
      expect(params[9]).toBeNull(); // stock_minimo
      expect(params[10]).toBeNull(); // stock_maximo
      expect(params[11]).toBeNull(); // punto_reorden
    });

    // [Servicio en paquete]: 2do cobro válido para tipo=servicio — precio
    // fijo por todo el servicio, reusa la unidad "Paquete" ya sembrada
    // (misma fila que un producto físico puede usar).
    test('POST /productos tipo=servicio con unidad_id="Paquete" la respeta (no la pisa a "Hora")', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT nombre FROM unidades_medida WHERE id', [[{ nombre: 'Paquete' }]]],
        ['INSERT INTO productos', [{ insertId: 56 }]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Mantenimiento anual', sku: 'SERV-PAQ-1', tipo: 'servicio', unidad_id: 3, precio: '5000' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(56);

      const insert = pool.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO productos'));
      expect(insert[1][4]).toBe(3); // unidad_id respetada (Paquete), no forzada a Hora
    });

    test('POST /productos tipo=servicio con unidad_id fuera del catálogo de servicio responde INV_UNIDAD_SERVICIO_INVALIDA', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT nombre FROM unidades_medida WHERE id', [[{ nombre: 'Kilogramo' }]]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Consultoría', sku: 'SERV-BAD-1', tipo: 'servicio', unidad_id: 5 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_UNIDAD_SERVICIO_INVALIDA');
    });

    // Punto 213: fecha de expiración opcional, por producto (no servicio).
    test('POST /productos con fecha_expiracion válida la guarda', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolConfigPorClave([
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT id FROM unidades_medida WHERE id', [[{ id: 1 }]]],
        ['INSERT INTO productos', [{ insertId: 60 }]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Yogurt natural', sku: 'LAC-YOG-1L', unidad_id: 1, fecha_expiracion: '2026-12-15' });

      expect(res.status).toBe(201);
      const insert = pool.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO productos'));
      expect(insert[1][14]).toBe('2026-12-15'); // fecha_expiracion
    });

    test('POST /productos con fecha_expiracion en formato inválido responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolConfigPorClave([
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT id FROM unidades_medida WHERE id', [[{ id: 1 }]]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Yogurt natural', sku: 'LAC-YOG-1L', unidad_id: 1, fecha_expiracion: '15/12/2026' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/fecha de expiración/i);
    });

    test('POST /productos tipo=servicio ignora fecha_expiracion aunque venga en el body', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT id FROM unidades_medida WHERE nombre', [[{ id: 9 }]]],
        ['INSERT INTO productos', [{ insertId: 61 }]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Consultoría fiscal', sku: 'SERV-3', tipo: 'servicio', fecha_expiracion: '2026-12-15' });

      expect(res.status).toBe(201);
      const insert = pool.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO productos'));
      expect(insert[1][14]).toBeNull(); // fecha_expiracion ignorada
    });

    test('GET /productos con ?vencimiento=por_vencer filtra vencidos+próximos 30 días, solo producto activo', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT COUNT(*) AS total FROM productos', [[{ total: 2 }]]],
        ['SELECT p.*, e.disponible', [[]]],
      ]);
      const res = await request(app)
        .get('/api/admin/inventarios/productos?vencimiento=por_vencer')
        .auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      const countCall = pool.query.mock.calls.find(([sql]) => String(sql).startsWith('SELECT COUNT(*) AS total FROM productos'));
      expect(countCall[0]).toMatch(/fecha_expiracion IS NOT NULL AND p\.fecha_expiracion <= DATE_ADD\(CURDATE\(\), INTERVAL \? DAY\)/);
      expect(countCall[1]).toContain(30);
    });

    test('GET /productos sin el filtro NO aplica ninguna condición de expiración', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT COUNT(*) AS total FROM productos', [[{ total: 10 }]]],
        ['SELECT p.*, e.disponible', [[]]],
      ]);
      const res = await request(app).get('/api/admin/inventarios/productos').auth(usuario, password);

      expect(res.status).toBe(200);
      const countCall = pool.query.mock.calls.find(([sql]) => String(sql).startsWith('SELECT COUNT(*) AS total FROM productos'));
      expect(countCall[0]).not.toMatch(/fecha_expiracion/);
    });

    test('POST /productos tipo=servicio sin unidad "Hora" configurada responde INV_UNIDAD_SERVICIO_NO_CONFIGURADA', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM productos WHERE sku', [[]]],
        ['SELECT id FROM unidades_medida WHERE nombre', [[]]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos')
        .auth(usuario, password)
        .send({ nombre: 'Consultoría', sku: 'SERV-2', tipo: 'servicio' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_UNIDAD_SERVICIO_NO_CONFIGURADA');
    });

    // Punto 186 (cierre del hueco del punto 182): el guard de ALTA por sí
    // solo no bastaba — reactivar un producto archivado vía PUT (estado
    // -> 'activo') se saltaba el guard por completo (idExcluir !== null).
    test('PUT /productos/:id reactivando (estado=activo) con "Solamente servicios" activo responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockImplementation(async (sql, params) => {
        const s = String(sql).trim();
        if (s.startsWith('SELECT valor FROM configuracion')) return [[{ valor: '1' }]]; // inventario_activo E inv_solo_servicios, ambos '1'
        if (s.startsWith('SELECT * FROM productos WHERE id')) return [[{ id: 5 }]];
        if (s.startsWith('SELECT id FROM productos WHERE sku')) return [[]];
        if (s.startsWith('SELECT id FROM unidades_medida WHERE id')) return [[{ id: 1 }]];
        return [[]];
      });
      const res = await request(app)
        .put('/api/admin/inventarios/productos/5')
        .auth(usuario, password)
        .send({ nombre: 'Tornillo', sku: 'TORN-1', unidad_id: 1, tipo: 'producto', estado: 'activo' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_SOLO_SERVICIOS_ACTIVO');
      expect(res.body.mensaje).toMatch(/reactivar/);
    });

    test('PUT /productos/:id sin reactivar (estado sigue archivado) con "Solamente servicios" activo sí se permite', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockImplementation(async (sql) => {
        const s = String(sql).trim();
        if (s.startsWith('SELECT valor FROM configuracion')) return [[{ valor: '1' }]];
        if (s.startsWith('SELECT * FROM productos WHERE id')) return [[{ id: 5 }]];
        if (s.startsWith('SELECT id FROM productos WHERE sku')) return [[]];
        if (s.startsWith('SELECT id FROM unidades_medida WHERE id')) return [[{ id: 1 }]];
        if (s.startsWith('UPDATE productos SET')) return [{}];
        return [[]];
      });
      const res = await request(app)
        .put('/api/admin/inventarios/productos/5')
        .auth(usuario, password)
        .send({ nombre: 'Tornillo', sku: 'TORN-1', unidad_id: 1, tipo: 'producto', estado: 'archivado' });
      expect(res.status).toBe(200);
    });

    test('GET /productos/:id inexistente responde 404 INV_PRODUCTO_NO_ENCONTRADO', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[]]]]);
      const res = await request(app).get('/api/admin/inventarios/productos/1').auth(usuario, password);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('INV_PRODUCTO_NO_ENCONTRADO');
    });

    test('DELETE /productos/:id/permanente con historial se rechaza (§38)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM productos WHERE id = ? AND eliminado_en IS NOT NULL', [[{ id: 5 }]]],
        ['SELECT id FROM movimientos_inventario WHERE producto_id', [[{ id: 1 }]]],
      ]);
      const res = await request(app).delete('/api/admin/inventarios/productos/5/permanente').auth(usuario, password);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_PRODUCTO_CON_HISTORIAL');
    });

    test('DELETE /productos/:id/permanente sin historial elimina de verdad', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT id FROM productos WHERE id = ? AND eliminado_en IS NOT NULL', [[{ id: 5 }]]],
        ['SELECT id FROM movimientos_inventario WHERE producto_id', [[]]],
        ['DELETE FROM existencias', [{ affectedRows: 1 }]],
        ['DELETE FROM productos', [{ affectedRows: 1 }]],
      ]);
      const res = await request(app).delete('/api/admin/inventarios/productos/5/permanente').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/permanentemente/i);
    });
  });

  // Imagen principal de producto (punto 159, Segmento B). El pipeline real
  // (sharp/MinIO) va mockeado — ver test/unit/inventarioImagen.test.js
  // para la lógica de procesamiento real.
  describe('Imagen de producto (Segmento B)', () => {
    const IMAGEN_BUFFER = Buffer.from('contenido-de-prueba-no-es-una-imagen-real');

    beforeEach(() => {
      guardarImagenProducto.mockReset();
      eliminarImagenProducto.mockReset().mockResolvedValue(undefined);
    });

    test('POST /:id/imagen sin archivo adjunto responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app).post('/api/admin/inventarios/productos/1/imagen').auth(usuario, password);
      expect(res.status).toBe(400);
    });

    test('POST /:id/imagen con extensión no permitida responde 400 (filtro de multer)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos/1/imagen')
        .auth(usuario, password)
        .attach('imagen', IMAGEN_BUFFER, { filename: 'foto.exe', contentType: 'application/octet-stream' });
      expect(res.status).toBe(400);
    });

    test('POST /:id/imagen a un producto inexistente responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[]]]]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos/999/imagen')
        .auth(usuario, password)
        .attach('imagen', IMAGEN_BUFFER, { filename: 'foto.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('INV_PRODUCTO_NO_ENCONTRADO');
      expect(guardarImagenProducto).not.toHaveBeenCalled();
    });

    test('POST /:id/imagen procesa, guarda las keys y responde con las URLs', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      guardarImagenProducto.mockResolvedValue({ imagenKey: 'a/productos/1/principal.webp', thumbKey: 'a/productos/1/thumb_principal.webp', ancho: 800, alto: 600 });
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT * FROM productos WHERE id', [[{ id: 1, nombre: 'Tornillo' }]]],
        ['UPDATE productos SET imagen_key', [{ affectedRows: 1 }]],
      ]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos/1/imagen')
        .auth(usuario, password)
        .attach('imagen', IMAGEN_BUFFER, { filename: 'foto.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.imagen_url).toMatch(/\/imagen$/);
      expect(res.body.imagen_thumb_url).toMatch(/v=thumb/);
      expect(guardarImagenProducto).toHaveBeenCalledWith('_default', 1, expect.any(Buffer));
    });

    test('POST /:id/imagen con imagen inválida (dimensión/tipo) responde 400 con el código real', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      guardarImagenProducto.mockRejectedValue(new ErrorImagenProducto('INV_IMAGEN_DIMENSION_INVALIDA', 'Demasiado grande.'));
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[{ id: 1 }]]]]);
      const res = await request(app)
        .post('/api/admin/inventarios/productos/1/imagen')
        .auth(usuario, password)
        .attach('imagen', IMAGEN_BUFFER, { filename: 'foto.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_IMAGEN_DIMENSION_INVALIDA');
    });

    test('GET /:id/imagen de un producto sin imagen responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[{ id: 1, imagen_key: null, imagen_thumb_key: null }]]]]);
      const res = await request(app).get('/api/admin/inventarios/productos/1/imagen').auth(usuario, password);
      expect(res.status).toBe(404);
    });

    test('GET /:id/imagen sirve la variante principal desde MinIO', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[{ id: 1, imagen_key: 'k.webp', imagen_thumb_key: 't.webp' }]]]]);
      const res = await request(app).get('/api/admin/inventarios/productos/1/imagen').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/webp');
      expect(storage.enviarArchivoARespuesta).toHaveBeenCalledWith('_default', 'productos/1', 'principal.webp', expect.anything());
    });

    test('GET /:id/imagen?v=thumb sirve la miniatura', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[{ id: 1, imagen_key: 'k.webp', imagen_thumb_key: 't.webp' }]]]]);
      const res = await request(app).get('/api/admin/inventarios/productos/1/imagen?v=thumb').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(storage.enviarArchivoARespuesta).toHaveBeenCalledWith('_default', 'productos/1', 'thumb_principal.webp', expect.anything());
    });

    test('DELETE /:id/imagen de un producto inexistente responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[]]]]);
      const res = await request(app).delete('/api/admin/inventarios/productos/999/imagen').auth(usuario, password);
      expect(res.status).toBe(404);
      expect(eliminarImagenProducto).not.toHaveBeenCalled();
    });

    test('DELETE /:id/imagen borra de MinIO y limpia las columnas', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT * FROM productos WHERE id', [[{ id: 1, imagen_key: 'k.webp' }]]],
        ['UPDATE productos SET imagen_key = NULL', [{ affectedRows: 1 }]],
      ]);
      const res = await request(app).delete('/api/admin/inventarios/productos/1/imagen').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(eliminarImagenProducto).toHaveBeenCalledWith('_default', 1);
    });
  });

  describe('Código de barras imprimible (punto 167)', () => {
    test('GET /:id/codigo-barras.svg de un producto inexistente responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[]]]]);
      const res = await request(app).get('/api/admin/inventarios/productos/999/codigo-barras.svg').auth(usuario, password);
      expect(res.status).toBe(404);
    });

    test('sin codigo_barras ni sku responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[{ id: 1, sku: '', codigo_barras: null }]]]]);
      const res = await request(app).get('/api/admin/inventarios/productos/1/codigo-barras.svg').auth(usuario, password);
      expect(res.status).toBe(400);
    });

    test('con codigo_barras genera el SVG con ese valor', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[{ id: 1, sku: 'TORN-001', codigo_barras: '7501234567890' }]]]]);
      const res = await request(app).get('/api/admin/inventarios/productos/1/codigo-barras.svg').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/svg+xml; charset=utf-8');
      expect(Buffer.isBuffer(res.body) ? res.body.toString('utf8') : res.text).toContain('<svg');
    });

    test('sin codigo_barras usa el sku como respaldo', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ['SELECT * FROM productos WHERE id', [[{ id: 1, sku: 'TORN-M6-25MM', codigo_barras: null }]]]]);
      const res = await request(app).get('/api/admin/inventarios/productos/1/codigo-barras.svg').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(Buffer.isBuffer(res.body) ? res.body.toString('utf8') : res.text).toContain('<svg');
    });

    test('perfil "ventas" no tiene acceso (403) — mismo gate que el resto de Inventarios', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas');
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app).get('/api/admin/inventarios/productos/1/codigo-barras.svg').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('módulo de inventario inactivo responde 403 INV_MODULO_INACTIVO', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_INACTIVO]);
      const res = await request(app).get('/api/admin/inventarios/productos/1/codigo-barras.svg').auth(usuario, password);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('INV_MODULO_INACTIVO');
    });
  });

  describe('Entradas / Salidas — delegación al motor (mockeado)', () => {
    test('POST /entradas con tipo de salida responde INV_TIPO_INVALIDO sin llamar al motor', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app)
        .post('/api/admin/inventarios/entradas')
        .auth(usuario, password)
        .send({ producto_id: 1, tipo: 'merma', cantidad: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_TIPO_INVALIDO');
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });

    test('POST /salidas con tipo "venta" se rechaza (esa salida solo la genera D8, nunca a mano)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app)
        .post('/api/admin/inventarios/salidas')
        .auth(usuario, password)
        .send({ producto_id: 1, tipo: 'venta', cantidad: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INV_TIPO_INVALIDO');
      expect(registrarMovimiento).not.toHaveBeenCalled();
    });

    test('POST /entradas válida delega en registrarMovimiento con almacén ALM-1 e Idempotency-Key', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ALMACEN_ID]);
      registrarMovimiento.mockResolvedValue({ movimientoId: 1, folio: 'EN-000001', existenciaAnterior: 0, existenciaPosterior: 5 });

      const res = await request(app)
        .post('/api/admin/inventarios/entradas')
        .auth(usuario, password)
        .set('Idempotency-Key', 'clave-123')
        .send({ producto_id: 1, tipo: 'compra', cantidad: 5, costo_unitario: 10 });

      expect(res.status).toBe(201);
      expect(res.body.folio).toBe('EN-000001');
      expect(registrarMovimiento).toHaveBeenCalledWith(
        expect.objectContaining({ productoId: 1, almacenId: 1, tipo: 'compra', cantidad: 5, idempotencyKey: 'clave-123' })
      );
    });

    test('POST /salidas con stock insuficiente propaga 409 INV_STOCK_INSUFICIENTE', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO, ALMACEN_ID]);
      registrarMovimiento.mockResolvedValue({ error: 'INV_STOCK_INSUFICIENTE', mensaje: 'sin stock', disponible: 0 });

      const res = await request(app)
        .post('/api/admin/inventarios/salidas')
        .auth(usuario, password)
        .send({ producto_id: 1, tipo: 'merma', cantidad: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('INV_STOCK_INSUFICIENTE');
    });
  });

  describe('Kardex', () => {
    test('sin producto_id responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app).get('/api/admin/inventarios/kardex').auth(usuario, password);
      expect(res.status).toBe(400);
    });

    test('con producto_id devuelve movimientos', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT COUNT(*) AS total FROM movimientos_inventario', [[{ total: 1 }]]],
        [
          'SELECT * FROM movimientos_inventario',
          [[{ id: 1, folio: 'EN-000001', cantidad: '5.000', costo_unitario: '10.00', existencia_anterior: '0.000', existencia_posterior: '5.000' }]],
        ],
      ]);
      const res = await request(app).get('/api/admin/inventarios/kardex?producto_id=1').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.movimientos[0].cantidad).toBe(5);
    });
  });

  describe('Verificar integridad (§0.5.F)', () => {
    test('sin divergencias responde ok:true', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      conciliarInventario.mockResolvedValue([]);
      const res = await request(app).get('/api/admin/inventarios/verificar-integridad').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('con divergencias responde ok:false y la lista', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      mockPoolPorPatron([MODULO_ACTIVO]);
      conciliarInventario.mockResolvedValue([{ productoId: 1, almacenId: 1, saldoCacheado: 99, saldoRecalculado: 5 }]);
      const res = await request(app).get('/api/admin/inventarios/verificar-integridad').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.divergencias).toHaveLength(1);
    });
  });

  describe('Dashboard', () => {
    test('responde los KPIs de v1 (§0.3:10) + "Servicios activos" (punto 179)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockImplementation(async (sql) => {
        const s = String(sql).trim();
        if (s.startsWith('SELECT valor FROM configuracion')) return [[{ valor: '1' }]];
        if (s.includes('COALESCE(SUM(e.disponible * p.costo_promedio)')) return [[{ valor: '1500.00' }]];
        if (s.includes("AND estado = 'activo' AND tipo = 'producto'")) return [[{ total: 10 }]];
        if (s.includes("AND estado = 'activo' AND tipo = 'servicio'")) return [[{ total: 4 }]];
        if (s.includes('NOT EXISTS') && s.includes('orden_productos')) return [[{ total: 1 }]];
        if (s.includes('COALESCE(SUM(e.disponible), 0) AS total')) return [[{ total: 200 }]];
        if (s.includes('e.disponible < p.stock_minimo')) return [[{ total: 2 }]];
        if (s.includes('e.disponible = 0')) return [[{ total: 1 }]];
        if (s.includes('NOT EXISTS (SELECT 1 FROM movimientos_inventario')) return [[{ total: 3 }]];
        if (s.includes("m.tipo = 'merma'")) return [[{ valor: '80.00', cantidad: 2 }]];
        if (s.includes('fecha_expiracion IS NOT NULL')) return [[{ total: 5 }]];
        return [[]];
      });

      const res = await request(app).get('/api/admin/inventarios/dashboard').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        valor_total_inventario: 1500,
        costo_promedio_ponderado: 7.5,
        productos_activos: 10,
        servicios_activos: 4,
        servicios_sin_ventas_90d: 1,
        unidades_disponibles: 200,
        productos_bajo_minimo: 2,
        productos_sin_existencia: 1,
        productos_sin_movimiento: 3,
        productos_por_vencer: 5,
        mermas_periodo_valor: 80,
        mermas_periodo_cantidad: 2,
      });
    });
  });

  // punto 321: perfil "Inventario" — un solo módulo, nada de negocio
  // fuera de eso. Verifica el acceso real al backend, no solo la UI.
  describe('Perfil "Inventario" (punto 321)', () => {
    test('SÍ puede leer el catálogo de Inventarios (unidades de medida)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('inventario', { usuario: 'inv1' });
      mockPoolPorPatron([MODULO_ACTIVO]);
      const res = await request(app).get('/api/admin/inventarios/unidades').auth(usuario, password);
      expect(res.status).toBe(200);
    });

    test('SÍ puede leer "Estado del inventario" (su "Inicio")', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('inventario', { usuario: 'inv1' });
      mockPoolPorPatron([
        MODULO_ACTIVO,
        ['SELECT COALESCE(SUM(e.disponible * p.costo_promedio), 0) AS valor', [[{ valor: '0' }]]],
      ]);
      const res = await request(app).get('/api/admin/inventarios/reportes/estado').auth(usuario, password);
      expect(res.status).toBe(200);
    });

    test('NO puede entrar a Usuarios (nada de negocio fuera de Inventarios)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('inventario', { usuario: 'inv1' });
      const res = await request(app).get('/api/admin/usuarios').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('NO puede entrar a Gastos', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('inventario', { usuario: 'inv1' });
      const res = await request(app).get('/api/admin/gastos').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('NO puede entrar a Configuraciones globales', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('inventario', { usuario: 'inv1' });
      const res = await request(app).get('/api/admin/config/global').auth(usuario, password);
      expect(res.status).toBe(403);
    });
  });
});
