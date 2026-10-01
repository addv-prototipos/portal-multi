// Pruebas de utils/tenantEdicion.js (segmento "edición", ver PROJECT_STATE.md
// punto 104) — actualización de TODOS los datos editables de una empresa
// desde /control, incluido el cambio opcional de slug (que dispara la
// migración de archivos en el backend por /internal/renombrar-slug antes
// de tocar la fila). El fetch al backend y la BD se mockean por completo.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

jest.mock('../../utils/notificarBackend', () => ({
  notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
}));

const { obtenerPool } = require('../../db');
const { notificarInvalidacionCache } = require('../../utils/notificarBackend');
const { actualizarDatosTenant, ErrorEdicionTenant } = require('../../utils/tenantEdicion');

function filaTenant(overrides = {}) {
  return {
    id: 7,
    slug: 'cliente1',
    nombre_empresa: 'Empresa Uno',
    contacto_email: 'contacto@uno.com',
    notas: null,
    marca: null,
    marca_logo_url: null,
    estado: 'activo',
    db_name: 'tenant_cliente1',
    storage_prefix: 'cliente1',
    ...overrides,
  };
}

// mockPool arma la secuencia de queries según el caso:
//  - sin slug nuevo: SELECT tenant, UPDATE, SELECT post, INSERT evento
//  - con slug nuevo: SELECT tenant, SELECT duplicados, UPDATE, SELECT post, INSERT evento
function mockPool(tenantFila, conSlugNuevo = false, filaPostUpdate) {
  const pool = { query: jest.fn() };
  const filaFinal =
    filaPostUpdate ||
    (tenantFila
      ? { ...tenantFila, slug: conSlugNuevo ? 'cliente2' : tenantFila.slug }
      : null);
  pool.query.mockResolvedValueOnce(tenantFila ? [[tenantFila]] : [[]]); // SELECT del tenant
  if (conSlugNuevo) {
    pool.query.mockResolvedValueOnce([[]]); // SELECT de duplicados de slug
  }
  pool.query.mockResolvedValueOnce([{ affectedRows: tenantFila ? 1 : 0 }]); // UPDATE
  pool.query.mockResolvedValueOnce([[filaFinal]]); // SELECT post-UPDATE
  pool.query.mockResolvedValueOnce([{}]); // registrarEvento
  obtenerPool.mockReturnValue(pool);
  return pool;
}

// PNG real mínimo (firma binaria válida: 8 bytes mágicos + cabecera IHDR).
function bufferPng() {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 0),
  ]);
}

describe('utils/tenantEdicion.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('actualizarDatosTenant', () => {
    test('actualiza todos los campos editables y registra el evento de auditoría', async () => {
      const pool = mockPool(filaTenant(), false, {
        ...filaTenant(),
        nombre_empresa: 'Empresa Uno Renombrada',
        contacto_email: 'nuevo@uno.com',
        notas: 'nota nueva',
        marca: 'Marca Uno',
      });
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

      const resultado = await actualizarDatosTenant(
        'cliente1',
        {
          nombreEmpresa: 'Empresa Uno Renombrada',
          contactoEmail: 'nuevo@uno.com',
          notas: 'nota nueva',
          marca: 'Marca Uno',
        },
        { actor: 'admin' }
      );

      // UPDATE con todos los campos en orden (ver tenantEdicion.js)
      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[1];
      expect(sqlUpdate).toMatch(/^UPDATE tenants SET\s+slug = \?, nombre_empresa = \?, contacto_email = \?, notas = \?,\s+db_name = \?, storage_prefix = \?,/);
      expect(paramsUpdate[0]).toBe('cliente1'); // slug sin cambios
      expect(paramsUpdate[1]).toBe('Empresa Uno Renombrada');
      expect(paramsUpdate[2]).toBe('nuevo@uno.com');
      expect(paramsUpdate[3]).toBe('nota nueva');
      expect(paramsUpdate[4]).toBe('tenant_cliente1'); // db_name se conserva
      expect(paramsUpdate[5]).toBe('cliente1'); // storage_prefix se conserva
      expect(paramsUpdate[6]).toBe('Marca Uno');
      expect(paramsUpdate[7]).toBeNull(); // sin logo

      // Evento de auditoría
      const sqlEvento = pool.query.mock.calls[3][0];
      expect(sqlEvento).toMatch(/INSERT INTO tenant_eventos/);
      expect(pool.query.mock.calls[3][1][1]).toBe('datos_actualizados');
      expect(pool.query.mock.calls[3][1][3]).toBe('admin');

      // Sin cambio de slug: no se llama al backend de almacenamiento
      expect(global.fetch).not.toHaveBeenCalled();
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');

      expect(resultado.nombre_empresa).toBe('Empresa Uno Renombrada');
    });

    test('cambio de slug: migra en el backend ANTES del UPDATE, actualiza slug/storage_prefix y conserva db_name en tenants activos', async () => {
      const pool = mockPool(
        filaTenant({ marca_logo_url: '/api/marca-logo/cliente1' }),
        true,
        {
          ...filaTenant({ marca_logo_url: '/api/marca-logo/cliente2' }),
          slug: 'cliente2',
          storage_prefix: 'cliente2',
        }
      );
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, copiados: 3, borrados: 3, logoMovido: true }),
      });

      const resultado = await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' },
        { actor: 'admin' }
      );

      // 1) La migración se disparó con ambos slugs
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, opciones] = global.fetch.mock.calls[0];
      expect(url).toMatch(/\/internal\/renombrar-slug$/);
      expect(opciones.method).toBe('POST');
      expect(opciones.headers['X-Internal-Secret']).toBeDefined();
      expect(JSON.parse(opciones.body)).toEqual({ slugAnterior: 'cliente1', slugNuevo: 'cliente2' });

      // 2) El SELECT de duplicados ocurrió antes del UPDATE
      const sqlDuplicados = pool.query.mock.calls[1][0];
      expect(sqlDuplicados).toMatch(/SELECT id FROM tenants WHERE slug = \? AND id <> \?/);
      expect(pool.query.mock.calls[1][1]).toEqual(['cliente2', 7]);

      // 3) UPDATE: slug y storage_prefix nuevos, pero db_name conservado (activo)
      const paramsUpdate = pool.query.mock.calls[2][1];
      expect(paramsUpdate[0]).toBe('cliente2');
      expect(paramsUpdate[4]).toBe('tenant_cliente1');
      expect(paramsUpdate[5]).toBe('cliente2');
      // La ruta del logo se reescribió al slug nuevo (el archivo lo movió la migración)
      expect(paramsUpdate[7]).toBe('/api/marca-logo/cliente2');

      // 4) Evento específico de cambio de slug
      expect(pool.query.mock.calls[4][1][1]).toBe('slug_cambiado');
      expect(pool.query.mock.calls[4][1][2]).toBe('slug: cliente1 -> cliente2');

      // 5) Caché invalidada para AMBOS slugs (el viejo queda 404 y el nuevo responde ya)
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente2');

      expect(resultado.slug).toBe('cliente2');
    });

    test('en estado provisioning, el cambio de slug también regenera db_name con el slug nuevo', async () => {
      const tenant = filaTenant({ estado: 'provisioning' });
      const pool = mockPool(tenant, true, { ...tenant, slug: 'cliente2' });
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, copiados: 0, borrados: 0, logoMovido: false }) });

      await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' },
        { actor: 'admin' }
      );

      const paramsUpdate = pool.query.mock.calls[2][1];
      expect(paramsUpdate[0]).toBe('cliente2');
      expect(paramsUpdate[4]).toBe('tenant_cliente2'); // db_name regenerado
    });

    test('slug nuevo duplicado -> ErrorEdicionTenant "slug_existe" sin migrar nada', async () => {
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[filaTenant()]]) // SELECT del tenant
        .mockResolvedValueOnce([[{ id: 99 }]]); // SELECT de duplicados: YA existe
      obtenerPool.mockReturnValue(pool);

      const error = await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('slug_existe');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(pool.query.mock.calls.length).toBe(2); // nunca el UPDATE
    });

    test('slug nuevo inválido -> ErrorEdicionTenant "validacion"', async () => {
      const pool = mockPool(filaTenant());
      const error = await actualizarDatosTenant('cliente1', { slug: 'Mal Slug!' }, {}).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('validacion');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('slug actual inválido -> ErrorEdicionTenant "validacion" sin tocar la BD', async () => {
      const error = await actualizarDatosTenant('Mal Slug', {}, {}).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('validacion');
      expect(obtenerPool().query).not.toHaveBeenCalled();
    });

    test('nombre obligatorio -> ErrorEdicionTenant "validacion"', async () => {
      const pool = mockPool(filaTenant());
      const error = await actualizarDatosTenant('cliente1', { nombreEmpresa: '' }, {}).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('validacion');
      expect(pool.query.mock.calls.length).toBe(1); // solo el SELECT, nunca el UPDATE
    });

    // Punto 170: obligatorio también al editar — cierra el hueco de tenants
    // viejos que no lo tenían, forzándolos a llenarlo la próxima vez que
    // se guarde cualquier cambio (el formulario real siempre lo reenvía,
    // ver frontend/control.js).
    test('sin correo de contacto -> ErrorEdicionTenant "validacion"', async () => {
      const pool = mockPool(filaTenant());
      const error = await actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno' }, {}).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('validacion');
      expect(error.message).toMatch(/correo de contacto/);
      expect(pool.query.mock.calls.length).toBe(1); // solo el SELECT, nunca el UPDATE
    });

    test('slug inexistente -> ErrorEdicionTenant "no_encontrado"', async () => {
      const pool = mockPool(null);
      const error = await actualizarDatosTenant('nadie', { nombreEmpresa: 'X' }, {}).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('no_encontrado');
    });

    test('backend rechaza la migración -> ErrorEdicionTenant "backend" y NO se toca la fila', async () => {
      const pool = mockPool(filaTenant(), true);
      global.fetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: 'No se pudo migrar el almacenamiento del tenant al slug nuevo.' }),
      });

      const error = await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('backend');
      expect(pool.query.mock.calls.length).toBe(2); // SELECTs, nunca el UPDATE
    });

    test('backend inalcanzable -> ErrorEdicionTenant "backend"', async () => {
      const pool = mockPool(filaTenant(), true);
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const error = await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('backend');
      expect(pool.query.mock.calls.length).toBe(2);
    });

    test('sube logo nuevo al slug final después de la migración', async () => {
      const pool = mockPool(filaTenant(), true, {
        ...filaTenant(),
        slug: 'cliente2',
        marca_logo_url: '/api/marca-logo/cliente2',
      });
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, copiados: 0, borrados: 0, logoMovido: false }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, url: '/api/marca-logo/cliente2' }) });

      await actualizarDatosTenant(
        'cliente1',
        {
          nombreEmpresa: 'Empresa Uno',
          contactoEmail: 'contacto@uno.com',
          slug: 'cliente2',
          logoBase64: bufferPng().toString('base64'),
        },
        { actor: 'admin' }
      );

      // 1er fetch: migración; 2do fetch: subir el logo AL slug nuevo
      const logoFetch = global.fetch.mock.calls[1];
      expect(logoFetch[0]).toMatch(/\/internal\/marca-logo\/cliente2$/);
      expect(logoFetch[1].method).toBe('POST');

      const paramsUpdate = pool.query.mock.calls[2][1];
      expect(paramsUpdate[7]).toBe('/api/marca-logo/cliente2');
    });

    test('quitarLogo con cambio de slug borra el logo del slug nuevo', async () => {
      const pool = mockPool(filaTenant({ marca_logo_url: '/api/marca-logo/cliente1' }), true, {
        ...filaTenant({ marca_logo_url: null }),
        slug: 'cliente2',
      });
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, copiados: 0, borrados: 0, logoMovido: true }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

      await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2', quitarLogo: true },
        { actor: 'admin' }
      );

      const borrarFetch = global.fetch.mock.calls[1];
      expect(borrarFetch[0]).toMatch(/\/internal\/marca-logo\/cliente2$/);
      expect(borrarFetch[1].method).toBe('DELETE');

      const paramsUpdate = pool.query.mock.calls[2][1];
      expect(paramsUpdate[7]).toBeNull();
    });

    test('logo que excede el tamaño máximo -> ErrorEdicionTenant "validacion"', async () => {
      const pool = mockPool(filaTenant());
      const error = await actualizarDatosTenant(
        'cliente1',
        {
          nombreEmpresa: 'Empresa Uno',
          contactoEmail: 'contacto@uno.com',
          logoBase64: Buffer.alloc(3 * 1024 * 1024).toString('base64'),
        },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('validacion');
      expect(error.message).toMatch(/excede el tamaño máximo/);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('una invalidación de caché que falla no revienta la edición', async () => {
      const pool = mockPool(filaTenant(), true, { ...filaTenant(), slug: 'cliente2' });
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, copiados: 0, borrados: 0, logoMovido: false }) });
      notificarInvalidacionCache
        .mockRejectedValueOnce(new Error('backend caído'))
        .mockResolvedValueOnce(undefined);

      const resultado = await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', slug: 'cliente2' },
        { actor: 'admin' }
      );

      expect(resultado.slug).toBe('cliente2');
      expect(notificarInvalidacionCache).toHaveBeenCalledTimes(2);
    });

    // Punto 244 (mapeo con CLARVO_Planes.md): gate de marca/Look & Feel +
    // cuota de usuarios.
    test('maxUsuarios: guarda un entero positivo tal cual', async () => {
      const pool = mockPool(filaTenant(), false, { ...filaTenant(), max_usuarios: 5 });

      await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', maxUsuarios: 5 },
        {}
      );

      const paramsUpdate = pool.query.mock.calls[1][1];
      expect(paramsUpdate[10]).toBe(5); // max_usuarios
    });

    test('maxUsuarios vacío/null se guarda como sin límite (NULL)', async () => {
      const pool = mockPool(filaTenant({ max_usuarios: 5 }), false, { ...filaTenant(), max_usuarios: null });

      await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', maxUsuarios: null },
        {}
      );

      const paramsUpdate = pool.query.mock.calls[1][1];
      expect(paramsUpdate[10]).toBeNull();
    });

    test('maxUsuarios ausente en el body conserva el valor actual de la fila (no lo resetea)', async () => {
      const pool = mockPool(filaTenant({ max_usuarios: 7 }), false, { ...filaTenant(), max_usuarios: 7 });

      await actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com' }, {});

      const paramsUpdate = pool.query.mock.calls[1][1];
      expect(paramsUpdate[10]).toBe(7);
    });

    test('maxUsuarios inválido (0, negativo o no entero) -> ErrorEdicionTenant "validacion", sin tocar la BD', async () => {
      const pool = mockPool(filaTenant());

      const error = await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', maxUsuarios: 0 },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorEdicionTenant);
      expect(error.codigo).toBe('validacion');
      expect(pool.query).toHaveBeenCalledTimes(1); // solo el SELECT del tenant, nunca el UPDATE
    });

    test('marcaLookfeelHabilitado=false se guarda como 0', async () => {
      const pool = mockPool(filaTenant(), false, { ...filaTenant(), marca_lookfeel_habilitado: 0 });

      await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', marcaLookfeelHabilitado: false },
        {}
      );

      const paramsUpdate = pool.query.mock.calls[1][1];
      expect(paramsUpdate[9]).toBe(0);
    });

    test('marcaLookfeelHabilitado ausente conserva el valor actual de la fila', async () => {
      const pool = mockPool(filaTenant({ marca_lookfeel_habilitado: 1 }), false, { ...filaTenant(), marca_lookfeel_habilitado: 1 });

      await actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com' }, {});

      const paramsUpdate = pool.query.mock.calls[1][1];
      expect(paramsUpdate[9]).toBe(1);
    });
  });

  // Punto 347: asignar un plan copia sus 6 valores a la fila del tenant
  // (nunca queda ligado en vivo). Secuencia de queries distinta a
  // mockPool(): SELECT tenant, SELECT plan (obtenerPlan), UPDATE, SELECT
  // post-UPDATE, INSERT evento — se arma a mano en cada prueba.
  describe('actualizarDatosTenant — Punto 347: plan y funciones', () => {
    function filaPlan(overrides = {}) {
      return {
        id: 2,
        nombre: 'Pro',
        descripcion: null,
        precio_mensual: null,
        precio_anual: null,
        max_usuarios: 15,
        sucursales_habilitado: 1,
        facturacion_habilitada: 1,
        portal_clientes_habilitado: 1,
        marca_lookfeel_habilitado: 0,
        disco_cuota_mb: 2048,
        activo: 1,
        orden: 2,
        total_tenants: 0,
        ...overrides,
      };
    }

    test('planId nuevo: copia los 6 valores del plan a la fila y registra evento "plan_asignado"', async () => {
      const tenantBase = filaTenant({
        plan_id: null, max_usuarios: null, facturacion_habilitada: 0,
        portal_clientes_habilitado: 1, sucursales_habilitado: 0, marca_lookfeel_habilitado: 0, disco_cuota_mb: null,
      });
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[tenantBase]]) // SELECT tenant
        .mockResolvedValueOnce([[filaPlan()]]) // obtenerPlan
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([[{ ...tenantBase, plan_id: 2 }]]) // SELECT post
        .mockResolvedValueOnce([{}]); // INSERT evento
      obtenerPool.mockReturnValue(pool);

      await actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', planId: 2 }, { actor: 'super' });

      const paramsUpdate = pool.query.mock.calls[2][1];
      // ...marca_lookfeel_habilitado(9), max_usuarios(10), plan_id(11), plan_actualizado_en(12),
      // facturacion_habilitada(13), portal_clientes_habilitado(14), sucursales_habilitado(15), disco_cuota_mb(16)
      expect(paramsUpdate[9]).toBe(0); // marca_lookfeel_habilitado del plan (apagado)
      expect(paramsUpdate[10]).toBe(15); // max_usuarios del plan
      expect(paramsUpdate[11]).toBe(2); // plan_id
      expect(paramsUpdate[12]).toBeInstanceOf(Date); // plan_actualizado_en
      expect(paramsUpdate[13]).toBe(1); // facturacion_habilitada
      expect(paramsUpdate[14]).toBe(1); // portal_clientes_habilitado
      expect(paramsUpdate[15]).toBe(1); // sucursales_habilitado
      expect(paramsUpdate[16]).toBe(2048); // disco_cuota_mb

      const eventoTipo = pool.query.mock.calls[4][1][1];
      expect(eventoTipo).toBe('plan_asignado');
    });

    test('planId de un plan archivado: ErrorEdicionTenant validacion, nunca llega al UPDATE', async () => {
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[filaTenant()]]) // SELECT tenant
        .mockResolvedValueOnce([[filaPlan({ activo: 0 })]]); // obtenerPlan
      obtenerPool.mockReturnValue(pool);

      await expect(
        actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', planId: 2 }, {})
      ).rejects.toMatchObject({ name: 'ErrorEdicionTenant', codigo: 'validacion' });
      expect(pool.query).toHaveBeenCalledTimes(2); // nunca llega al UPDATE
    });

    test('planId de un plan inexistente: ErrorEdicionTenant validacion', async () => {
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[filaTenant()]]) // SELECT tenant
        .mockResolvedValueOnce([[]]); // obtenerPlan: no existe
      obtenerPool.mockReturnValue(pool);

      await expect(
        actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', planId: 999 }, {})
      ).rejects.toMatchObject({ codigo: 'validacion' });
    });

    test('reaplicarPlan=true sin plan_id previo: ErrorEdicionTenant validacion, sin consultar planes', async () => {
      const pool = { query: jest.fn() };
      pool.query.mockResolvedValueOnce([[filaTenant({ plan_id: null })]]); // SELECT tenant
      obtenerPool.mockReturnValue(pool);

      await expect(
        actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', reaplicarPlan: true }, {})
      ).rejects.toMatchObject({ codigo: 'validacion' });
      expect(pool.query).toHaveBeenCalledTimes(1); // nunca consulta planes
    });

    test('reaplicarPlan=true con plan_id ya asignado: vuelve a copiar los valores del plan actual', async () => {
      const tenantBase = filaTenant({ plan_id: 2, max_usuarios: 99, facturacion_habilitada: 0 }); // "excepción" previa desalineada del plan
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[tenantBase]]) // SELECT tenant
        .mockResolvedValueOnce([[filaPlan()]]) // obtenerPlan(2)
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([[tenantBase]]) // SELECT post
        .mockResolvedValueOnce([{}]); // INSERT evento
      obtenerPool.mockReturnValue(pool);

      await actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', reaplicarPlan: true }, {});

      const consultaPlan = pool.query.mock.calls[1][1];
      expect(consultaPlan).toEqual([2]); // consultó el plan YA asignado (id 2), no uno nuevo
      const paramsUpdate = pool.query.mock.calls[2][1];
      expect(paramsUpdate[10]).toBe(15); // max_usuarios vuelve al valor del plan (99 -> 15)
      expect(paramsUpdate[13]).toBe(1); // facturacion_habilitada vuelve a ON
    });

    test('override explícito junto con planId: el override gana sobre el valor del plan para ESE campo', async () => {
      const tenantBase = filaTenant({ plan_id: null, sucursales_habilitado: 0 });
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[tenantBase]]) // SELECT tenant
        .mockResolvedValueOnce([[filaPlan()]]) // obtenerPlan — trae sucursales_habilitado=1
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
        .mockResolvedValueOnce([[tenantBase]]) // SELECT post
        .mockResolvedValueOnce([{}]); // INSERT evento
      obtenerPool.mockReturnValue(pool);

      await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', planId: 2, sucursalesHabilitado: false },
        {}
      );

      const paramsUpdate = pool.query.mock.calls[2][1];
      expect(paramsUpdate[15]).toBe(0); // excepción gana: apagado aunque el plan lo traiga encendido
      expect(paramsUpdate[13]).toBe(1); // el resto de los campos del plan sí se copiaron normal
    });

    test('sin planId/reaplicarPlan: un override individual no toca el plan_id existente', async () => {
      const tenantBase = filaTenant({ plan_id: 2, facturacion_habilitada: 1 });
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[tenantBase]]) // SELECT tenant
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE (sin consulta de plan)
        .mockResolvedValueOnce([[tenantBase]]) // SELECT post
        .mockResolvedValueOnce([{}]); // INSERT evento
      obtenerPool.mockReturnValue(pool);

      await actualizarDatosTenant(
        'cliente1',
        { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', facturacionHabilitada: false },
        {}
      );

      expect(pool.query).toHaveBeenCalledTimes(4); // nunca consultó planes
      const paramsUpdate = pool.query.mock.calls[1][1];
      expect(paramsUpdate[11]).toBe(2); // plan_id intacto
      expect(paramsUpdate[13]).toBe(0); // solo cambió el campo pedido
    });

    test('disco_cuota_mb inválido -> ErrorEdicionTenant validacion, sin tocar la BD', async () => {
      const pool = { query: jest.fn() };
      pool.query.mockResolvedValueOnce([[filaTenant()]]); // SELECT tenant
      obtenerPool.mockReturnValue(pool);

      await expect(
        actualizarDatosTenant('cliente1', { nombreEmpresa: 'Empresa Uno', contactoEmail: 'contacto@uno.com', discoCuotaMb: -5 }, {})
      ).rejects.toMatchObject({ codigo: 'validacion' });
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });
});
