// Pedidos (kanban de pre-ventas/cotizaciones, punto 508, Segmento 1).
// Mismo patrón de mocking que ordenes-compra.test.js para las rutas de
// negocio (perfil admin/ventas vía mockUsuarioAdministrativo), y el mismo
// patrón de cuotaUsuarios.test.js/gatingFacturacion.test.js (X-Tenant-Slug
// + obtenerPoolControl + ADMIN_USERS) para probar el candado por plan.

const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
  obtenerPoolControl: jest.fn(),
  obtenerPoolTenant: jest.fn(() => ({ query: jest.fn(), getConnection: jest.fn() })),
  ejecutarComoTenant: jest.fn((tenantPool, fn) => fn()),
  cerrarTodosLosPoolsTenant: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('../../utils/inventario', () => {
  const actual = jest.requireActual('../../utils/inventario');
  return { ...actual, obtenerProductoPorId: jest.fn() };
});

const { pool, obtenerPoolControl } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const { obtenerProductoPorId } = require('../../utils/inventario');
const { invalidarCacheTenant } = require('../../utils/tenantContext');
const app = require('../../server');

function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

function tenantFila(extra = {}) {
  return {
    id: 1,
    slug: 'norte',
    nombre_empresa: 'Norte S.A.',
    estado: 'activo',
    db_host: 'mysql',
    db_name: 'tenant_norte',
    db_user: 'app',
    marca: null,
    marca_logo_url: null,
    tema_json: null,
    grupo_sucursal_id: null,
    contacto_email: null,
    marca_lookfeel_habilitado: 1,
    max_usuarios: null,
    ...extra,
  };
}

describe('Admin: Pedidos (kanban de pre-ventas)', () => {
  afterEach(() => {
    pool.query.mockReset();
  });

  describe('POST /api/admin/pedidos', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).post('/api/admin/pedidos').send({ concepto: 'x', cantidad: 10 });
      expect(res.status).toBe(401);
    });

    test('perfil "fiscal" no tiene acceso (403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10 });
      expect(res.status).toBe(403);
    });

    test('crea un pedido mínimo (sin correo ni nombre) — nace en la columna "Pedido"', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }]); // INSERT
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE numero_pedido

      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'Cotización mostrador', cantidad: 1500 });

      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('pedido');
      expect(res.body.numero_pedido).toBe('PED-000001');
      expect(res.body.email).toBeNull();
      expect(res.body.nombre_cliente_manual).toBeNull();
    });

    test('concepto vacío responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app).post('/api/admin/pedidos').auth(usuario, password).send({ concepto: '  ', cantidad: 10 });
      expect(res.status).toBe(400);
    });

    test('cantidad cero o negativa responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app).post('/api/admin/pedidos').auth(usuario, password).send({ concepto: 'x', cantidad: 0 });
      expect(res.status).toBe(400);
    });

    test('correo inválido responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10, email: 'no-es-correo' });
      expect(res.status).toBe(400);
    });

    test('descuento fuera de rango (>=100) responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10, descuento_porcentaje: 100 });
      expect(res.status).toBe(400);
    });

    test('con producto_id válido: lo guarda y lo devuelve', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      obtenerProductoPorId.mockResolvedValue({ id: 5, tipo: 'producto' });
      pool.query.mockResolvedValueOnce([{ insertId: 2, affectedRows: 1 }]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'Refacciones', cantidad: 300, producto_id: 5, producto_cantidad: 2 });

      expect(res.status).toBe(201);
      expect(res.body.producto_id).toBe(5);
      expect(res.body.producto_cantidad).toBe(2);
    });

    test('producto_id que ya no existe responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      obtenerProductoPorId.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10, producto_id: 999, producto_cantidad: 1 });
      expect(res.status).toBe(400);
    });

    // Punto 508, rediseño "panel dividido" (propuesta visual elegida por
    // el usuario, concepto 1): clasificación Tipo (Pedido/Cotización) +
    // Cantidad siempre presente, ya no exclusiva de cuando hay producto.
    test('tipo: sin mandarlo, default "cotizacion" (mismo criterio que la columna en BD)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([{ insertId: 3, affectedRows: 1 }]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10 });
      expect(res.status).toBe(201);
      expect(res.body.tipo).toBe('cotizacion');
    });

    test('tipo: "pedido" explícito se guarda y se devuelve', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([{ insertId: 4, affectedRows: 1 }]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10, tipo: 'pedido' });
      expect(res.status).toBe(201);
      expect(res.body.tipo).toBe('pedido');
    });

    test('tipo inválido responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10, tipo: 'no-existe' });
      expect(res.status).toBe(400);
    });

    test('producto_cantidad: sin mandarlo y sin producto_id, default 1 (cantidad general, no solo de catálogo)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([{ insertId: 5, affectedRows: 1 }]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10 });
      expect(res.status).toBe(201);
      expect(res.body.producto_cantidad).toBe(1);
      expect(res.body.producto_id).toBeNull();
    });

    test('producto_cantidad inválida (0) sin producto_id responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/pedidos')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10, producto_cantidad: 0 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/pedidos', () => {
    test('perfil "ventas" sí tiene acceso (punto 190)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/admin/pedidos').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.pedidos).toEqual([]);
    });

    test('expone "vendedor" (a diferencia de ordenes_compra, aquí sí se muestra creado_por)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 1, numero_pedido: 'PED-000001', concepto: 'x', cantidad: '100.00', estado: 'pedido', estado_actualizado_en: '2026-11-20 10:00:00', creado_por: 'Laura Nava', creado_en: '2026-11-20 10:00:00' }],
      ]);
      const res = await request(app).get('/api/admin/pedidos').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.pedidos[0].vendedor).toBe('Laura Nava');
      expect(res.body.pedidos[0].creado_por).toBeUndefined();
    });

    test('expone "tipo" (Pedido/Cotización, punto 508 rediseño)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 1, numero_pedido: 'PED-000001', tipo: 'pedido', concepto: 'x', cantidad: '100.00', estado: 'pedido', estado_actualizado_en: '2026-11-20 10:00:00', creado_por: 'Laura Nava', creado_en: '2026-11-20 10:00:00' }],
      ]);
      const res = await request(app).get('/api/admin/pedidos').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.pedidos[0].tipo).toBe('pedido');
    });

    test('filtra por estado cuando se manda ?estado=', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]);
      await request(app).get('/api/admin/pedidos?estado=confirmar').auth(usuario, password);
      const [sql, params] = pool.query.mock.calls[1];
      expect(sql).toMatch(/pe\.estado = \?/);
      expect(params).toContain('confirmar');
    });
  });

  describe('PUT /api/admin/pedidos/:id (editar)', () => {
    test('pedido inexistente responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).put('/api/admin/pedidos/9').auth(usuario, password).send({ concepto: 'x', cantidad: 10 });
      expect(res.status).toBe(404);
    });

    test('pedido ya entregado: 409, no se puede editar', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'entregado' }]]);
      const res = await request(app).put('/api/admin/pedidos/1').auth(usuario, password).send({ concepto: 'x', cantidad: 10 });
      expect(res.status).toBe(409);
    });

    test('edición válida sobre un pedido abierto: 200', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'progreso' }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app)
        .put('/api/admin/pedidos/1')
        .auth(usuario, password)
        .send({ concepto: 'Actualizado', cantidad: 2000 });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    // Punto 508, rediseño "panel dividido": `tipo` se agregó al FINAL del
    // UPDATE (nunca intercalado) a propósito — mismo criterio ya
    // documentado en CLAUDE.md para no romper tests que indexan params
    // por posición.
    test('edición: manda "pedido" como tipo — el UPDATE real lo incluye al final de los params', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'pedido' }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app)
        .put('/api/admin/pedidos/7')
        .auth(usuario, password)
        .send({ concepto: 'x', cantidad: 10, tipo: 'pedido' });
      expect(res.status).toBe(200);
      const llamadaUpdate = pool.query.mock.calls[2];
      expect(llamadaUpdate[0]).toMatch(/UPDATE pedidos/);
      const params = llamadaUpdate[1];
      expect(params[params.length - 2]).toBe('pedido');
      expect(params[params.length - 1]).toBe(7);
    });
  });

  describe('PUT /api/admin/pedidos/:id/mover', () => {
    test('etapa inválida (ej. "entregado") responde 400 — ese estado exige /convertir', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app).put('/api/admin/pedidos/1/mover').auth(usuario, password).send({ estado: 'entregado' });
      expect(res.status).toBe(400);
    });

    test('pedido ya cerrado: 409', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'cancelado' }]]);
      const res = await request(app).put('/api/admin/pedidos/1/mover').auth(usuario, password).send({ estado: 'progreso' });
      expect(res.status).toBe(409);
    });

    test('mueve de "pedido" a "confirmar": 200', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'pedido' }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app).put('/api/admin/pedidos/1/mover').auth(usuario, password).send({ estado: 'confirmar' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('confirmar');
    });
  });

  describe('PUT /api/admin/pedidos/:id/cancelar', () => {
    test('pedido ya cerrado: 409', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'entregado' }]]);
      const res = await request(app).put('/api/admin/pedidos/1/cancelar').auth(usuario, password).send({});
      expect(res.status).toBe(409);
    });

    test('cancela con motivo: 200, queda en estado "cancelado"', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'confirmar' }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app)
        .put('/api/admin/pedidos/1/cancelar')
        .auth(usuario, password)
        .send({ motivo_cancelacion: 'Cliente canceló por presupuesto' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('cancelado');
      const [sql, params] = pool.query.mock.calls[2];
      expect(sql).toMatch(/UPDATE pedidos SET estado = "cancelado"/);
      expect(params).toContain('Cliente canceló por presupuesto');
    });
  });

  describe('PUT /api/admin/pedidos/:id/convertir', () => {
    test('sin orden_id responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app).put('/api/admin/pedidos/1/convertir').auth(usuario, password).send({});
      expect(res.status).toBe(400);
    });

    test('pedido ya cerrado: 409', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'cancelado' }]]);
      const res = await request(app).put('/api/admin/pedidos/1/convertir').auth(usuario, password).send({ orden_id: 50 });
      expect(res.status).toBe(409);
    });

    test('la venta indicada no existe: 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'confirmar' }]]);
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).put('/api/admin/pedidos/1/convertir').auth(usuario, password).send({ orden_id: 999 });
      expect(res.status).toBe(400);
    });

    test('convierte correctamente: 200, estado "entregado", vincula convertido_a_orden_id', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ estado: 'confirmar' }]]);
      pool.query.mockResolvedValueOnce([[{ id: 50 }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app).put('/api/admin/pedidos/1/convertir').auth(usuario, password).send({ orden_id: 50 });

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('entregado');
      expect(res.body.convertido_a_orden_id).toBe(50);
    });
  });

  describe('GET /api/admin/pedidos/reportes/resumen', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).get('/api/admin/pedidos/reportes/resumen');
      expect(res.status).toBe(401);
    });

    test('catálogo vacío: todo en ceros, promedios en null (nunca 0 disfrazado)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // porEtapa
      pool.query.mockResolvedValueOnce([[{ atascados: 0, en_riesgo: 0, al_dia: 0 }]]); // sla
      pool.query.mockResolvedValueOnce([[]]); // cargaVendedor
      pool.query.mockResolvedValueOnce([[]]); // motivosCancelacion
      pool.query.mockResolvedValueOnce([[]]); // cancelacionPorVendedor
      pool.query.mockResolvedValueOnce([[]]); // clientesCancelaciones
      pool.query.mockResolvedValueOnce([[{ cotizado_promedio: null, vendido_promedio: null }]]); // ticket
      pool.query.mockResolvedValueOnce([[{ con_saldo: 0, pagado_completo: 0 }]]); // saldo
      pool.query.mockResolvedValueOnce([[{ horas_promedio: null }]]); // ciclo
      pool.query.mockResolvedValueOnce([[]]); // tiempoPorEtapa

      const res = await request(app).get('/api/admin/pedidos/reportes/resumen').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.porEtapa).toEqual([
        { estado: 'pedido', n: 0, total: 0 },
        { estado: 'progreso', n: 0, total: 0 },
        { estado: 'confirmar', n: 0, total: 0 },
        { estado: 'entregado', n: 0, total: 0 },
        { estado: 'cancelado', n: 0, total: 0 },
      ]);
      expect(res.body.estadistico.tasaConversion).toBeNull();
      expect(res.body.estadistico.cicloPromedioHoras).toBeNull();
      expect(res.body.estadistico.ticketCotizadoPromedio).toBeNull();
      expect(res.body.financiero.ingresoProyectado).toBeNull();
      expect(res.body.financiero.pipeline).toBe(0);
    });

    test('con datos reales: calcula pipeline, tasa de conversión e ingreso proyectado', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[
        { estado: 'pedido', n: 2, total: 10000 },
        { estado: 'progreso', n: 1, total: 5000 },
        { estado: 'confirmar', n: 0, total: 0 },
        { estado: 'entregado', n: 6, total: 30000 },
        { estado: 'cancelado', n: 2, total: 4000 },
      ]]); // porEtapa
      pool.query.mockResolvedValueOnce([[{ atascados: 1, en_riesgo: 1, al_dia: 1 }]]); // sla
      pool.query.mockResolvedValueOnce([[{ vendedor: 'Laura Nava', n: 2 }]]); // cargaVendedor
      pool.query.mockResolvedValueOnce([[{ motivo: 'Cliente canceló por presupuesto', n: 2 }]]); // motivos
      pool.query.mockResolvedValueOnce([[{ vendedor: 'Laura Nava', cancelados: 2, total: 8 }]]); // cancelacionPorVendedor
      pool.query.mockResolvedValueOnce([[{ cliente: 'Cliente Frecuente SA', n: 2 }]]); // clientesCancelaciones
      pool.query.mockResolvedValueOnce([[{ cotizado_promedio: 5000, vendido_promedio: 4800 }]]); // ticket
      pool.query.mockResolvedValueOnce([[{ con_saldo: 3000, pagado_completo: 27000 }]]); // saldo
      pool.query.mockResolvedValueOnce([[{ horas_promedio: 48.5 }]]); // ciclo
      pool.query.mockResolvedValueOnce([[{ etapa: 'pedido', horas_promedio: 24, n: 8 }]]); // tiempoPorEtapa

      const res = await request(app).get('/api/admin/pedidos/reportes/resumen').auth(usuario, password);

      expect(res.status).toBe(200);
      // 6 entregados + 2 cancelados = 8 cerrados -> 75% conversión
      expect(res.body.estadistico.tasaConversion).toBe(75);
      expect(res.body.estadistico.embudo).toEqual({ creados: 11, entregados: 6, cancelados: 2, abiertos: 3 });
      // pipeline = 10000 + 5000 + 0
      expect(res.body.financiero.pipeline).toBe(15000);
      // ingresoProyectado = 15000 * 0.75
      expect(res.body.financiero.ingresoProyectado).toBe(11250);
      expect(res.body.financiero.valorPerdidoCancelacion).toBe(4000);
      expect(res.body.financiero.entregadosConSaldo).toBe(3000);
      expect(res.body.financiero.entregadosPagadoCompleto).toBe(27000);
      expect(res.body.estadistico.cicloPromedioHoras).toBe(48.5);
      expect(res.body.estadistico.ticketCotizadoPromedio).toBe(5000);
      expect(res.body.estadistico.ticketVendidoPromedio).toBe(4800);
      expect(res.body.operativo.sla).toEqual({ atascados: 1, enRiesgo: 1, alDia: 1 });
      expect(res.body.operativo.cargaPorVendedor).toEqual([{ vendedor: 'Laura Nava', n: 2 }]);
      expect(res.body.cliente.masCancelaciones).toEqual([{ cliente: 'Cliente Frecuente SA', n: 2 }]);
    });
  });
});

describe('Pedidos — candado por plan (pedidosHabilitado)', () => {
  let poolControl;

  beforeEach(() => {
    poolControl = { query: jest.fn() };
    obtenerPoolControl.mockReturnValue(poolControl);
  });

  afterEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
    invalidarCacheTenant();
  });

  test('tenant con pedidos_habilitado=0: POST /api/admin/pedidos responde 404 (nunca 403)', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila({ pedidos_habilitado: 0 })]]);
    const res = await request(app)
      .post('/api/admin/pedidos')
      .set('X-Tenant-Slug', 'norte')
      .auth('admin', 'admin')
      .send({ concepto: 'x', cantidad: 10 });
    expect(res.status).toBe(404);
  });

  test('tenant con ventas_habilitado=0 (aunque pedidos_habilitado sea 1): GET /api/admin/pedidos responde 404 — Pedidos depende de Ventas', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila({ ventas_habilitado: 0, pedidos_habilitado: 1 })]]);
    const res = await request(app).get('/api/admin/pedidos').set('X-Tenant-Slug', 'norte').auth('admin', 'admin');
    expect(res.status).toBe(404);
  });

  test('tenant con ambos flags activos: GET /api/admin/pedidos pasa el gate y llega a la lógica real', async () => {
    poolControl.query.mockResolvedValueOnce([[tenantFila({ ventas_habilitado: 1, pedidos_habilitado: 1 })]]);
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get('/api/admin/pedidos').set('X-Tenant-Slug', 'norte').auth('admin', 'admin');
    expect(res.status).toBe(200);
  });
});
