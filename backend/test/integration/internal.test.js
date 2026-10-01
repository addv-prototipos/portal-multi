// Pruebas de integración de POST /internal/cache-tenant/invalidar
// (segmento 9b, ver PROJECT_STATE.md) — endpoint interno que el servicio
// "control" (ahora en su propio contenedor) llama para invalidar la
// caché de resolución de tenant de este proceso, protegido por un
// secreto compartido.

const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn().mockResolvedValue(undefined),
  crearBaseDeDatosTenant: jest.fn().mockResolvedValue(undefined),
  eliminarBaseDeDatosTenant: jest.fn().mockResolvedValue(undefined),
  obtenerPoolTenant: jest.fn(() => ({ query: jest.fn(), getConnection: jest.fn() })),
  cerrarPoolTenant: jest.fn(),
  obtenerPoolControl: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('../../utils/tenantContext', () => {
  const original = jest.requireActual('../../utils/tenantContext');
  return { ...original, invalidarCacheTenant: jest.fn() };
});

jest.mock('../../utils/storage', () => ({
  PREFIJO_DEFECTO: '_default',
  prefijoTenant: jest.fn(() => '_default'),
  guardarArchivo: jest.fn().mockResolvedValue('marca/cliente1/logo'),
  existeArchivo: jest.fn().mockResolvedValue(true),
  eliminarArchivo: jest.fn().mockResolvedValue(undefined),
  copiarPrefijo: jest.fn().mockResolvedValue(2),
  contarObjetosPrefijo: jest.fn().mockResolvedValue(2),
  calcularBytesPrefijo: jest.fn().mockResolvedValue(734003200),
  copiarArchivo: jest.fn().mockResolvedValue('marca/cliente2/logo'),
  eliminarPrefijo: jest.fn().mockResolvedValue(2),
  enviarArchivoARespuesta: jest.fn((prefijo, carpeta, nombreArchivo, res) => {
    res.end(Buffer.from('contenido-simulado'));
    return Promise.resolve();
  }),
  obtenerArchivo: jest.fn().mockResolvedValue({
    stream: require('stream').Readable.from(Buffer.from('contenido-simulado')),
    contentType: 'image/png',
  }),
}));

const { invalidarCacheTenant } = require('../../utils/tenantContext');
const storage = require('../../utils/storage');
const { ensureSchema, crearBaseDeDatosTenant, eliminarBaseDeDatosTenant, cerrarPoolTenant, obtenerPoolControl } = require('../../db');
const app = require('../../server');

describe('POST /internal/cache-tenant/invalidar', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;

  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });

  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });

  beforeEach(() => {
    invalidarCacheTenant.mockClear();
  });

  test('sin el secreto responde 403 y no invalida nada', async () => {
    const res = await request(app).post('/internal/cache-tenant/invalidar').send({ slug: 'cliente1' });

    expect(res.status).toBe(403);
    expect(invalidarCacheTenant).not.toHaveBeenCalled();
  });

  test('con el secreto incorrecto responde 403', async () => {
    const res = await request(app)
      .post('/internal/cache-tenant/invalidar')
      .set('X-Internal-Secret', 'secreto-equivocado')
      .send({ slug: 'cliente1' });

    expect(res.status).toBe(403);
    expect(invalidarCacheTenant).not.toHaveBeenCalled();
  });

  test('con el secreto correcto, invalida la caché del slug indicado', async () => {
    const res = await request(app)
      .post('/internal/cache-tenant/invalidar')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ slug: 'cliente1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(invalidarCacheTenant).toHaveBeenCalledWith('cliente1');
  });

  test('sin slug en el body, invalida toda la caché (null)', async () => {
    const res = await request(app)
      .post('/internal/cache-tenant/invalidar')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({});

    expect(res.status).toBe(200);
    expect(invalidarCacheTenant).toHaveBeenCalledWith(null);
  });
});

describe('POST /internal/marca-logo/:slug', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;

  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });

  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });

  beforeEach(() => {
    storage.guardarArchivo.mockClear();
  });

  // Firma binaria real de PNG — suficiente para pasar la verificación de
  // magic number de validate.js sin necesitar una imagen real.
  const PNG_BUFFER = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 0),
  ]);

  test('sin el secreto responde 403 y no guarda nada', async () => {
    const res = await request(app)
      .post('/internal/marca-logo/cliente1')
      .send({ base64: PNG_BUFFER.toString('base64') });

    expect(res.status).toBe(403);
    expect(storage.guardarArchivo).not.toHaveBeenCalled();
  });

  test('guarda el logo en MinIO y devuelve la ruta pública', async () => {
    const res = await request(app)
      .post('/internal/marca-logo/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ base64: PNG_BUFFER.toString('base64'), mime: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, url: '/api/marca-logo/cliente1' });
    expect(storage.guardarArchivo).toHaveBeenCalledWith(
      'marca',
      'cliente1',
      'logo',
      expect.any(Buffer),
      'image/png'
    );
  });

  test('rechaza un archivo que no es una imagen real', async () => {
    const res = await request(app)
      .post('/internal/marca-logo/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ base64: Buffer.from('esto-no-es-una-imagen').toString('base64'), mime: 'image/png' });

    expect(res.status).toBe(400);
    expect(storage.guardarArchivo).not.toHaveBeenCalled();
  });

  test('rechaza un slug inválido', async () => {
    const res = await request(app)
      .post('/internal/marca-logo/Mal Slug')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ base64: PNG_BUFFER.toString('base64') });

    expect(res.status).toBe(400);
    expect(storage.guardarArchivo).not.toHaveBeenCalled();
  });
});

describe('DELETE /internal/marca-logo/:slug', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;

  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });

  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });

  beforeEach(() => {
    storage.eliminarArchivo.mockClear();
  });

  test('sin el secreto responde 403', async () => {
    const res = await request(app).delete('/internal/marca-logo/cliente1');

    expect(res.status).toBe(403);
    expect(storage.eliminarArchivo).not.toHaveBeenCalled();
  });

  test('borra el logo del almacenamiento', async () => {
    const res = await request(app)
      .delete('/internal/marca-logo/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(storage.eliminarArchivo).toHaveBeenCalledWith('marca', 'cliente1', 'logo');
  });
});

describe('GET /api/marca-logo/:slug', () => {
  beforeEach(() => {
    storage.existeArchivo.mockClear();
    storage.obtenerArchivo.mockClear();
  });

  test('sirve el logo con su Content-Type y cache largo', async () => {
    storage.existeArchivo.mockResolvedValue(true);
    const res = await request(app).get('/api/marca-logo/cliente1');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.headers['cache-control']).toContain('max-age=86400');
    expect(res.body).toEqual(Buffer.from('contenido-simulado'));
  });

  test('responde 404 si el logo no existe', async () => {
    storage.existeArchivo.mockResolvedValue(false);
    const res = await request(app).get('/api/marca-logo/cliente1');

    expect(res.status).toBe(404);
  });

  test('responde 404 con un slug inválido', async () => {
    const res = await request(app).get('/api/marca-logo/Mal%20Slug');

    expect(res.status).toBe(404);
    expect(storage.existeArchivo).not.toHaveBeenCalled();
  });
});

describe('POST /internal/renombrar-slug', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;

  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });

  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });

  beforeEach(() => {
    storage.copiarPrefijo.mockClear();
    storage.contarObjetosPrefijo.mockClear();
    storage.copiarArchivo.mockClear();
    storage.eliminarPrefijo.mockClear();
    storage.eliminarArchivo.mockClear();
    storage.existeArchivo.mockClear();
    storage.copiarPrefijo.mockResolvedValue(2);
    storage.contarObjetosPrefijo.mockResolvedValue(2);
    storage.copiarArchivo.mockResolvedValue('marca/cliente2/logo');
    storage.eliminarPrefijo.mockResolvedValue(2);
    storage.existeArchivo.mockResolvedValue(true);
  });

  test('sin el secreto responde 403 y no toca el almacenamiento', async () => {
    const res = await request(app)
      .post('/internal/renombrar-slug')
      .send({ slugAnterior: 'cliente1', slugNuevo: 'cliente2' });

    expect(res.status).toBe(403);
    expect(storage.copiarPrefijo).not.toHaveBeenCalled();
  });

  test('rechaza slugs inválidos o iguales', async () => {
    const sinSecretoValido = { 'X-Internal-Secret': 'secreto-de-prueba' };
    let res = await request(app)
      .post('/internal/renombrar-slug')
      .set(sinSecretoValido)
      .send({ slugAnterior: 'Mal Slug', slugNuevo: 'cliente2' });
    expect(res.status).toBe(400);

    res = await request(app)
      .post('/internal/renombrar-slug')
      .set(sinSecretoValido)
      .send({ slugAnterior: 'cliente1', slugNuevo: '' });
    expect(res.status).toBe(400);

    res = await request(app)
      .post('/internal/renombrar-slug')
      .set(sinSecretoValido)
      .send({ slugAnterior: 'cliente1', slugNuevo: 'cliente1' });
    expect(res.status).toBe(400);
    expect(storage.copiarPrefijo).not.toHaveBeenCalled();
  });

  test('copia el prefijo verificando el conteo, mueve el logo y borra lo viejo', async () => {
    const res = await request(app)
      .post('/internal/renombrar-slug')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ slugAnterior: 'cliente1', slugNuevo: 'cliente2' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, copiados: 2, borrados: 2, logoMovido: true, faviconMovido: true });
    expect(storage.contarObjetosPrefijo).toHaveBeenCalledWith('cliente1');
    expect(storage.copiarPrefijo).toHaveBeenCalledWith('cliente1', 'cliente2');
    expect(storage.existeArchivo).toHaveBeenCalledWith('marca', 'cliente1', 'logo');
    expect(storage.copiarArchivo).toHaveBeenCalledWith('marca', 'cliente1', 'logo', 'marca', 'cliente2', 'logo');
    expect(storage.eliminarPrefijo).toHaveBeenCalledWith('cliente1');
    expect(storage.eliminarArchivo).toHaveBeenCalledWith('marca', 'cliente1', 'logo');
  });

  test('migra el favicon cuando el tenant tiene uno', async () => {
    storage.existeArchivo
      .mockResolvedValueOnce(false) // logo: no existe
      .mockResolvedValueOnce(true); // favicon: existe
    const res = await request(app)
      .post('/internal/renombrar-slug')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ slugAnterior: 'cliente1', slugNuevo: 'cliente2' });

    expect(res.status).toBe(200);
    expect(res.body.faviconMovido).toBe(true);
    expect(storage.copiarArchivo).toHaveBeenCalledWith('marca', 'cliente1', 'favicon', 'marca', 'cliente2', 'favicon');
    expect(storage.eliminarArchivo).toHaveBeenCalledWith('marca', 'cliente1', 'favicon');
  });

  test('migra sin logo cuando el tenant no tiene uno', async () => {
    storage.existeArchivo.mockResolvedValue(false);
    const res = await request(app)
      .post('/internal/renombrar-slug')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ slugAnterior: 'cliente1', slugNuevo: 'cliente2' });

    expect(res.status).toBe(200);
    expect(res.body.logoMovido).toBe(false);
    expect(storage.copiarArchivo).not.toHaveBeenCalled();
    expect(storage.eliminarArchivo).not.toHaveBeenCalled();
  });

  test('si el conteo no cuadra responde 502 SIN borrar nada', async () => {
    storage.copiarPrefijo.mockResolvedValue(1); // copió menos de los 2 esperados

    const res = await request(app)
      .post('/internal/renombrar-slug')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ slugAnterior: 'cliente1', slugNuevo: 'cliente2' });

    expect(res.status).toBe(502);
    expect(storage.eliminarPrefijo).not.toHaveBeenCalled();
    expect(storage.eliminarArchivo).not.toHaveBeenCalled();
    expect(storage.copiarArchivo).not.toHaveBeenCalled();
  });

  test('si la copia falla responde 502 sin borrar nada', async () => {
    storage.copiarPrefijo.mockRejectedValue(new Error('MinIO caído'));
    const res = await request(app)
      .post('/internal/renombrar-slug')
      .set('X-Internal-Secret', 'secreto-de-prueba')
      .send({ slugAnterior: 'cliente1', slugNuevo: 'cliente2' });

    expect(res.status).toBe(502);
    expect(storage.eliminarPrefijo).not.toHaveBeenCalled();
  });
});

describe('POST /internal/activar-tenant/:slug', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;

  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });

  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });

  beforeEach(() => {
    crearBaseDeDatosTenant.mockClear();
    ensureSchema.mockClear();
    crearBaseDeDatosTenant.mockResolvedValue(undefined);
    ensureSchema.mockResolvedValue(undefined);
  });

  test('sin el secreto responde 403 y no crea nada', async () => {
    const res = await request(app).post('/internal/activar-tenant/cliente1');

    expect(res.status).toBe(403);
    expect(crearBaseDeDatosTenant).not.toHaveBeenCalled();
  });

  test('con el secreto incorrecto responde 403', async () => {
    const res = await request(app)
      .post('/internal/activar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-equivocado');

    expect(res.status).toBe(403);
    expect(crearBaseDeDatosTenant).not.toHaveBeenCalled();
  });

  test('slug inválido responde 400', async () => {
    const res = await request(app)
      .post('/internal/activar-tenant/Mal Slug')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(400);
    expect(crearBaseDeDatosTenant).not.toHaveBeenCalled();
  });

  test('con el secreto correcto: crea la BD física y aplica el esquema', async () => {
    const res = await request(app)
      .post('/internal/activar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, dbName: 'tenant_cliente1' });
    expect(crearBaseDeDatosTenant).toHaveBeenCalledWith('tenant_cliente1');
    expect(ensureSchema).toHaveBeenCalledTimes(1);
  });

  test('si crear la base de datos falla (ej. sin privilegios), responde 502', async () => {
    crearBaseDeDatosTenant.mockRejectedValueOnce(new Error('ER_DBACCESS_DENIED_ERROR'));

    const res = await request(app)
      .post('/internal/activar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(502);
    expect(ensureSchema).not.toHaveBeenCalled();
  });

  test('si aplicar el esquema falla, responde 502', async () => {
    ensureSchema.mockRejectedValueOnce(new Error('esquema inválido'));

    const res = await request(app)
      .post('/internal/activar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(502);
  });
});

describe('POST /internal/disco-uso/:slug (punto 347)', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;

  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });

  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });

  beforeEach(() => {
    storage.calcularBytesPrefijo.mockClear();
    storage.calcularBytesPrefijo.mockResolvedValue(734003200);
  });

  test('sin el secreto responde 403 y no calcula nada', async () => {
    const res = await request(app).post('/internal/disco-uso/cliente1');

    expect(res.status).toBe(403);
    expect(storage.calcularBytesPrefijo).not.toHaveBeenCalled();
  });

  test('con el secreto incorrecto responde 403', async () => {
    const res = await request(app).post('/internal/disco-uso/cliente1').set('X-Internal-Secret', 'secreto-equivocado');

    expect(res.status).toBe(403);
    expect(storage.calcularBytesPrefijo).not.toHaveBeenCalled();
  });

  test('slug inválido responde 400', async () => {
    const res = await request(app).post('/internal/disco-uso/Mal Slug').set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(400);
    expect(storage.calcularBytesPrefijo).not.toHaveBeenCalled();
  });

  test('con el secreto correcto: suma los bytes del prefijo del slug y los devuelve', async () => {
    const res = await request(app).post('/internal/disco-uso/cliente1').set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, bytes: 734003200 });
    expect(storage.calcularBytesPrefijo).toHaveBeenCalledWith('cliente1');
  });

  test('si MinIO falla, responde 502', async () => {
    storage.calcularBytesPrefijo.mockRejectedValueOnce(new Error('conexión rechazada'));

    const res = await request(app).post('/internal/disco-uso/cliente1').set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(502);
  });
});

describe('POST /internal/eliminar-tenant/:slug (punto 345, "papelera")', () => {
  const SECRETO_ANTERIOR = process.env.INTERNAL_CACHE_SECRET;
  let poolControl;

  beforeAll(() => {
    process.env.INTERNAL_CACHE_SECRET = 'secreto-de-prueba';
  });

  afterAll(() => {
    process.env.INTERNAL_CACHE_SECRET = SECRETO_ANTERIOR;
  });

  beforeEach(() => {
    eliminarBaseDeDatosTenant.mockClear();
    eliminarBaseDeDatosTenant.mockResolvedValue(undefined);
    cerrarPoolTenant.mockClear();
    storage.eliminarPrefijo.mockClear();
    storage.existeArchivo.mockClear();
    storage.eliminarArchivo.mockClear();
    storage.eliminarPrefijo.mockResolvedValue(2);
    storage.existeArchivo.mockResolvedValue(false);
    poolControl = { query: jest.fn() };
    obtenerPoolControl.mockReturnValue(poolControl);
  });

  test('sin el secreto responde 403 y no toca nada', async () => {
    const res = await request(app).post('/internal/eliminar-tenant/cliente1');

    expect(res.status).toBe(403);
    expect(eliminarBaseDeDatosTenant).not.toHaveBeenCalled();
  });

  test('slug inválido responde 400', async () => {
    const res = await request(app)
      .post('/internal/eliminar-tenant/Mal Slug')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(400);
    expect(eliminarBaseDeDatosTenant).not.toHaveBeenCalled();
  });

  test('404 si el tenant no existe en control_tenants', async () => {
    poolControl.query.mockResolvedValueOnce([[]]); // SELECT

    const res = await request(app)
      .post('/internal/eliminar-tenant/fantasma')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(404);
    expect(eliminarBaseDeDatosTenant).not.toHaveBeenCalled();
  });

  test('409 si el tenant no está en "baja" — candado de seguridad', async () => {
    poolControl.query.mockResolvedValueOnce([[{ id: 7, estado: 'activo' }]]); // SELECT

    const res = await request(app)
      .post('/internal/eliminar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(409);
    expect(eliminarBaseDeDatosTenant).not.toHaveBeenCalled();
  });

  test('con el secreto correcto y estado "baja": borra la BD, los archivos y las filas de control', async () => {
    poolControl.query
      .mockResolvedValueOnce([[{ id: 7, estado: 'baja' }]]) // SELECT
      .mockResolvedValueOnce([{ affectedRows: 3 }]) // DELETE tenant_eventos
      .mockResolvedValueOnce([{ affectedRows: 0 }]) // DELETE api_credenciales
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE tenants (guarda atómica)

    const res = await request(app)
      .post('/internal/eliminar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(cerrarPoolTenant).toHaveBeenCalledWith('cliente1');
    expect(eliminarBaseDeDatosTenant).toHaveBeenCalledWith('tenant_cliente1');
    expect(storage.eliminarPrefijo).toHaveBeenCalledWith('cliente1');
    expect(poolControl.query).toHaveBeenCalledWith('DELETE FROM tenant_eventos WHERE tenant_id = ?', [7]);
    expect(poolControl.query).toHaveBeenCalledWith('DELETE FROM api_credenciales WHERE tenant_slug = ?', ['cliente1']);
    expect(poolControl.query).toHaveBeenCalledWith('DELETE FROM tenants WHERE id = ? AND estado = ?', [7, 'baja']);
  });

  test('borra también el logo/favicon de marca si existen', async () => {
    storage.existeArchivo.mockResolvedValue(true);
    poolControl.query
      .mockResolvedValueOnce([[{ id: 7, estado: 'baja' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post('/internal/eliminar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(200);
    expect(storage.eliminarArchivo).toHaveBeenCalledWith('marca', 'cliente1', 'logo');
    expect(storage.eliminarArchivo).toHaveBeenCalledWith('marca', 'cliente1', 'favicon');
  });

  test('si borrar la base de datos falla, responde 502 y nunca toca archivos ni filas de control', async () => {
    poolControl.query.mockResolvedValueOnce([[{ id: 7, estado: 'baja' }]]);
    eliminarBaseDeDatosTenant.mockRejectedValueOnce(new Error('ER_DBACCESS_DENIED_ERROR'));

    const res = await request(app)
      .post('/internal/eliminar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(502);
    expect(storage.eliminarPrefijo).not.toHaveBeenCalled();
    expect(poolControl.query).toHaveBeenCalledTimes(1); // solo el SELECT inicial
  });

  test('si borrar los archivos falla, responde 502 (la BD ya se borró, se informa así)', async () => {
    poolControl.query.mockResolvedValueOnce([[{ id: 7, estado: 'baja' }]]);
    storage.eliminarPrefijo.mockRejectedValueOnce(new Error('MinIO caído'));

    const res = await request(app)
      .post('/internal/eliminar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(502);
    expect(eliminarBaseDeDatosTenant).toHaveBeenCalled();
    expect(poolControl.query).toHaveBeenCalledTimes(1); // nunca llegó a borrar filas de control
  });

  test('409 si el estado cambió justo antes del DELETE final (carrera extremadamente rara) — la fila queda huérfana a propósito', async () => {
    poolControl.query
      .mockResolvedValueOnce([[{ id: 7, estado: 'baja' }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ affectedRows: 0 }]); // DELETE tenants no afectó ninguna fila

    const res = await request(app)
      .post('/internal/eliminar-tenant/cliente1')
      .set('X-Internal-Secret', 'secreto-de-prueba');

    expect(res.status).toBe(409);
  });
});
