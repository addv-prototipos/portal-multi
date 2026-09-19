const { notificarInvalidacionCache, activarTenantFisico, ErrorActivacionFisica } = require('../../utils/notificarBackend');

describe('utils/notificarBackend.js', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  describe('notificarInvalidacionCache', () => {
    test('llama al endpoint interno con el secreto y el slug', async () => {
      global.fetch.mockResolvedValue({ ok: true });
      await notificarInvalidacionCache('cliente1');
      const [url, opciones] = global.fetch.mock.calls[0];
      expect(url).toContain('/internal/cache-tenant/invalidar');
      expect(opciones.method).toBe('POST');
      expect(JSON.parse(opciones.body)).toEqual({ slug: 'cliente1' });
    });

    test('propaga el rechazo si el fetch falla (fire-and-forget lo maneja el llamador)', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(notificarInvalidacionCache('cliente1')).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('activarTenantFisico', () => {
    test('retorna los datos del backend cuando la activación tiene éxito', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, tablas: 23 }) });
      const resultado = await activarTenantFisico('cliente1');
      expect(resultado).toEqual({ ok: true, tablas: 23 });
      const [url, opciones] = global.fetch.mock.calls[0];
      expect(url).toContain('/internal/activar-tenant/cliente1');
      expect(opciones.method).toBe('POST');
    });

    test('codifica el slug en la URL', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
      await activarTenantFisico('slug raro/x');
      const [url] = global.fetch.mock.calls[0];
      expect(url).toContain(encodeURIComponent('slug raro/x'));
    });

    test('lanza ErrorActivacionFisica con el mensaje del backend si responde error', async () => {
      global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Ya existe la base de datos' }) });
      await expect(activarTenantFisico('cliente1')).rejects.toThrow(ErrorActivacionFisica);
      await expect(activarTenantFisico('cliente1')).rejects.toThrow('Ya existe la base de datos');
    });

    test('lanza ErrorActivacionFisica genérico si el backend no da error JSON', async () => {
      global.fetch.mockResolvedValue({ ok: false, json: async () => { throw new Error('no json'); } });
      await expect(activarTenantFisico('cliente1')).rejects.toThrow(/No se pudo crear la base de datos/);
    });

    test('lanza ErrorActivacionFisica si no se pudo conectar con el backend', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(activarTenantFisico('cliente1')).rejects.toThrow(ErrorActivacionFisica);
      await expect(activarTenantFisico('cliente1')).rejects.toThrow(/No se pudo conectar/);
    });
  });
});
