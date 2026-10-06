// Pruebas de utils/tenantMarca.js (segmento "marca") — actualización de la
// marca (y logo) de un tenant desde /control. El logo se reenvía al
// backend principal por su endpoint interno (fetch mockeado aquí); la BD
// se mockea completa, solo interesa la validación y el UPDATE correcto.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

jest.mock('../../utils/notificarBackend', () => ({
  notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/ajustesGlobales', () => ({
  getImagenMaxMb: jest.fn().mockResolvedValue(2),
}));

const { obtenerPool } = require('../../db');
const { notificarInvalidacionCache } = require('../../utils/notificarBackend');
const { actualizarMarcaTenant, subirLogoAlBackend, ErrorMarcaTenant } = require('../../utils/tenantMarca');

function mockPool(tenantFila, postUpdate) {
  const pool = { query: jest.fn() };
  const filaPostUpdate = postUpdate || {
    ...tenantFila,
    marca: 'Nueva Marca',
    marca_logo_url: '/api/marca-logo/x',
  };
  pool.query
    .mockResolvedValueOnce([tenantFila ? [tenantFila] : []]) // SELECT del tenant
    .mockResolvedValueOnce([{ affectedRows: tenantFila ? 1 : 0 }]) // UPDATE
    .mockResolvedValueOnce([[filaPostUpdate]]) // SELECT post-UPDATE
    .mockResolvedValueOnce([{}]); // registrarEvento
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

describe('utils/tenantMarca.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('actualizarMarcaTenant', () => {
    test('actualiza la marca y registra el evento', async () => {
      const pool = mockPool({ id: 7, slug: 'cliente1', marca: null, marca_logo_url: null });
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

      const resultado = await actualizarMarcaTenant('cliente1', { marca: 'Nueva Marca' }, { actor: 'admin' });

      // UPDATE con la marca nueva
      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[1];
      expect(sqlUpdate).toMatch(/UPDATE tenants SET marca = \?, marca_logo_url = \? WHERE slug = \?/);
      expect(paramsUpdate).toEqual(['Nueva Marca', null, 'cliente1']);

      // El logo no se tocó: no se llamó al backend
      expect(global.fetch).not.toHaveBeenCalled();

      // Evento de auditoría
      const [sqlEvento] = pool.query.mock.calls[3];
      expect(sqlEvento).toMatch(/INSERT INTO tenant_eventos/);
      expect(pool.query.mock.calls[3][1][1]).toBe('marca_actualizada');
      expect(pool.query.mock.calls[3][1][3]).toBe('admin');

      // La caché del backend se invalidó
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');

      expect(resultado.marca).toBe('Nueva Marca');
    });

    test('sube un logo nuevo y guarda su ruta', async () => {
      const pool = mockPool(
        { id: 7, slug: 'cliente1', marca: null, marca_logo_url: null },
        { id: 7, slug: 'cliente1', marca: 'Marca', marca_logo_url: '/api/marca-logo/cliente1' }
      );
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, url: '/api/marca-logo/cliente1' }),
      });

      const resultado = await actualizarMarcaTenant(
        'cliente1',
        { marca: 'Marca', logoBase64: bufferPng().toString('base64') },
        { actor: 'admin' }
      );

      // Se llamó al endpoint interno del backend con el base64 y el secreto
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, opciones] = global.fetch.mock.calls[0];
      expect(url).toMatch(/\/internal\/marca-logo\/cliente1$/);
      expect(opciones.method).toBe('POST');
      expect(opciones.headers['X-Internal-Secret']).toBeDefined();
      const body = JSON.parse(opciones.body);
      expect(body.base64).toBe(bufferPng().toString('base64'));
      expect(body.mime).toBe('image/png');

      // La ruta devuelta por el backend se guardó en la fila
      const paramsUpdate = pool.query.mock.calls[1][1];
      expect(paramsUpdate[1]).toBe('/api/marca-logo/cliente1');
      expect(resultado.marca_logo_url).toBe('/api/marca-logo/cliente1');
    });

    test('quitarLogo borra el archivo en el backend y limpia la ruta', async () => {
      const pool = mockPool({ id: 7, slug: 'cliente1', marca: 'Marca', marca_logo_url: '/api/marca-logo/cliente1' });
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

      await actualizarMarcaTenant('cliente1', { marca: 'Marca', quitarLogo: true }, { actor: 'admin' });

      const [url, opciones] = global.fetch.mock.calls[0];
      expect(url).toMatch(/\/internal\/marca-logo\/cliente1$/);
      expect(opciones.method).toBe('DELETE');

      const paramsUpdate = pool.query.mock.calls[1][1];
      expect(paramsUpdate[1]).toBeNull();
    });

    test('logo que no es imagen real -> ErrorMarcaTenant de validación', async () => {
      const pool = mockPool({ id: 7, slug: 'cliente1', marca: null, marca_logo_url: null });
      const error = await actualizarMarcaTenant(
        'cliente1',
        { logoBase64: Buffer.from('esto-no-es-una-imagen').toString('base64') },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorMarcaTenant);
      expect(error.codigo).toBe('validacion');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('logo que excede el tamaño máximo -> ErrorMarcaTenant de validación', async () => {
      const pool = mockPool({ id: 7, slug: 'cliente1', marca: null, marca_logo_url: null });
      const error = await actualizarMarcaTenant(
        'cliente1',
        { logoBase64: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(3 * 1024 * 1024)]).toString('base64') },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorMarcaTenant);
      expect(error.codigo).toBe('validacion');
      expect(error.message).toMatch(/excede el tamaño máximo/);
    });

    test('marca que supera 255 caracteres -> ErrorMarcaTenant de validación', async () => {
      const pool = mockPool({ id: 7, slug: 'cliente1', marca: null, marca_logo_url: null });
      const error = await actualizarMarcaTenant('cliente1', { marca: 'x'.repeat(256) }, {}).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorMarcaTenant);
      expect(error.codigo).toBe('validacion');
    });

    test('slug inexistente -> ErrorMarcaTenant "no_encontrado"', async () => {
      const pool = mockPool(null); // el SELECT no devuelve filas
      const error = await actualizarMarcaTenant('nadie', { marca: 'X' }, {}).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorMarcaTenant);
      expect(error.codigo).toBe('no_encontrado');
    });

    test('backend rechaza el logo -> ErrorMarcaTenant "backend"', async () => {
      const pool = mockPool({ id: 7, slug: 'cliente1', marca: null, marca_logo_url: null });
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'El archivo no es una imagen válida.' }),
      });

      const error = await actualizarMarcaTenant(
        'cliente1',
        { logoBase64: bufferPng().toString('base64') },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorMarcaTenant);
      expect(error.codigo).toBe('backend');
      expect(error.message).toMatch(/imagen válida/);
    });
  });
});