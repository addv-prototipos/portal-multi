const { notificarInvalidacionCache, activarTenantFisico, ErrorActivacionFisica, aplicarLimiteUsuarios, obtenerUsoUsuarios } = require('../../utils/notificarBackend');

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

  // Punto 349-350-351 (regla 9): a diferencia de activarTenantFisico/
  // eliminarTenantFisico, esta función NUNCA lanza — un fallo aquí no
  // debe revertir una edición de tenant que ya se guardó correctamente.
  describe('aplicarLimiteUsuarios', () => {
    test('maxUsuarios null/undefined: no-op explícito, ni siquiera llama al backend', async () => {
      const resultado = await aplicarLimiteUsuarios('cliente1', null);
      expect(resultado).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('llama al endpoint interno con el secreto, el slug y el límite', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, suspendidos: [] }) });
      await aplicarLimiteUsuarios('cliente1', 5);
      const [url, opciones] = global.fetch.mock.calls[0];
      expect(url).toContain('/internal/aplicar-limite-usuarios/cliente1');
      expect(opciones.method).toBe('POST');
      expect(JSON.parse(opciones.body)).toEqual({ maxUsuarios: 5 });
    });

    test('devuelve la lista de usuarios suspendidos que reporta el backend', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, suspendidos: [{ id: 10, rfc: 'ventas-nuevo' }] }),
      });
      const resultado = await aplicarLimiteUsuarios('cliente1', 5);
      expect(resultado).toEqual([{ id: 10, rfc: 'ventas-nuevo' }]);
    });

    test('si el backend responde error, devuelve null sin lanzar (nunca revierte la edición ya guardada)', async () => {
      global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'algo falló' }) });
      await expect(aplicarLimiteUsuarios('cliente1', 5)).resolves.toBeNull();
    });

    test('si no se pudo conectar con el backend, devuelve null sin lanzar', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(aplicarLimiteUsuarios('cliente1', 5)).resolves.toBeNull();
    });
  });

  // Punto 350/351 (regla 8 extendida): solo lectura, para el banner de
  // impacto de "Editar empresa" ANTES de guardar — nunca suspende nada.
  describe('obtenerUsoUsuarios', () => {
    test('llama al endpoint interno de solo lectura con el secreto y el slug', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, total: 3 }) });
      await obtenerUsoUsuarios('cliente1');
      const [url, opciones] = global.fetch.mock.calls[0];
      expect(url).toContain('/internal/uso-usuarios/cliente1');
      expect(opciones.method).toBe('GET');
    });

    test('devuelve el total que reporta el backend', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, total: 7 }) });
      await expect(obtenerUsoUsuarios('cliente1')).resolves.toBe(7);
    });

    test('si el backend responde error, devuelve null', async () => {
      global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'algo falló' }) });
      await expect(obtenerUsoUsuarios('cliente1')).resolves.toBeNull();
    });

    test('si no se pudo conectar con el backend, devuelve null sin lanzar', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(obtenerUsoUsuarios('cliente1')).resolves.toBeNull();
    });
  });
});
