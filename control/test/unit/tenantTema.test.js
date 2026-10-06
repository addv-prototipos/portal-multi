// Pruebas de utils/tenantTema.js (segmento "Look & Feel") — hueco de
// cobertura conocido y documentado (ver CLAUDE.md punto 137), cerrado aquí.
// Cubre validación del tema (colores/tipografía/radio/favicon), contraste
// WCAG 2.1 AA, y actualizarTemaTenant end-to-end con la BD y el backend
// (fetch) mockeados.

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
const {
  ErrorTemaTenant,
  actualizarTemaTenant,
  normalizarTema,
  subirFaviconAlBackend,
  borrarFaviconDelBackend,
} = require('../../utils/tenantTema');

const COLORES_VALIDOS = {
  bg: '#F6F4EF',
  surface: '#FFFFFF',
  border: '#E3DFD4',
  ink: '#21261F',
  inkSoft: '#5B6158',
  accent: '#0F6E5D',
  accentDark: '#0B5548',
  accentSoft: '#E4EFEC',
  warn: '#B4530C',
  warnSoft: '#FBEBDC',
  error: '#B3261E',
  errorSoft: '#FBEAE9',
};

function bufferPng() {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 0),
  ]);
}

function mockPool(tenantFila, filaPostUpdate) {
  const pool = { query: jest.fn() };
  pool.query
    .mockResolvedValueOnce([tenantFila ? [tenantFila] : []]) // SELECT del tenant
    .mockResolvedValueOnce([{ affectedRows: tenantFila ? 1 : 0 }]) // UPDATE
    .mockResolvedValueOnce([[filaPostUpdate || tenantFila]]) // SELECT post-UPDATE
    .mockResolvedValueOnce([{}]); // registrarEvento
  obtenerPool.mockReturnValue(pool);
  return pool;
}

describe('utils/tenantTema.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('normalizarTema', () => {
    test('acepta un tema vacío ({})', () => {
      expect(normalizarTema({})).toEqual({});
    });

    test('acepta un tema completo válido y lo normaliza a minúsculas', () => {
      const tema = normalizarTema({
        colores: { ...COLORES_VALIDOS, accent: '#0F6E5D'.toUpperCase() },
        tipografia: { display: 'lora', cuerpo: 'open-sans' },
        radio: 'lg',
        faviconUrl: '/api/favicon/mi-empresa',
      });
      expect(tema.colores.accent).toBe('#0f6e5d');
      expect(tema.tipografia).toEqual({ display: 'lora', cuerpo: 'open-sans' });
      expect(tema.radio).toBe('lg');
      expect(tema.faviconUrl).toBe('/api/favicon/mi-empresa');
    });

    test('rechaza datos que no son objeto', () => {
      expect(() => normalizarTema(null)).toThrow(ErrorTemaTenant);
      expect(() => normalizarTema([])).toThrow(ErrorTemaTenant);
      expect(() => normalizarTema('texto')).toThrow(ErrorTemaTenant);
    });

    test('rechaza "colores" que no es objeto', () => {
      expect(() => normalizarTema({ colores: 'rojo' })).toThrow(/colores.*debe ser un objeto/);
    });

    test('rechaza un color con formato hex inválido', () => {
      expect(() => normalizarTema({ colores: { bg: 'no-es-hex' } })).toThrow(/hexadecimal/);
      expect(() => normalizarTema({ colores: { bg: '#FFF' } })).toThrow(/hexadecimal/); // solo 3 dígitos, no soportado
    });

    test('ignora claves de color desconocidas fuera del catálogo', () => {
      const tema = normalizarTema({ colores: { ...COLORES_VALIDOS, colorInventado: '#123456' } });
      expect(tema.colores.colorInventado).toBeUndefined();
    });

    test('rechaza cuando el contraste texto/fondo no cumple AA', () => {
      // bg y ink casi idénticos: contraste muy bajo, debe reventar.
      expect(() =>
        normalizarTema({ colores: { ...COLORES_VALIDOS, bg: '#FFFFFF', ink: '#FEFEFE' } })
      ).toThrow(/contraste AA/);
    });

    test('rechaza tipografía "display" fuera del catálogo o de tipo incorrecto', () => {
      expect(() => normalizarTema({ tipografia: { display: 'no-existe' } })).toThrow(/no está en el catálogo/);
      // "inter" es de tipo cuerpo, no display
      expect(() => normalizarTema({ tipografia: { display: 'inter' } })).toThrow(/títulos no está en el catálogo/);
    });

    test('rechaza tipografía "cuerpo" fuera del catálogo o de tipo incorrecto', () => {
      expect(() => normalizarTema({ tipografia: { cuerpo: 'no-existe' } })).toThrow(/no está en el catálogo/);
      expect(() => normalizarTema({ tipografia: { cuerpo: 'lora' } })).toThrow(/cuerpo no está en el catálogo/);
    });

    test('rechaza un radio fuera del catálogo cerrado', () => {
      expect(() => normalizarTema({ radio: 'xl' })).toThrow(/sm.*md.*lg/);
    });

    test('rechaza un faviconUrl que no respeta el patrón /api/favicon/<slug>', () => {
      expect(() => normalizarTema({ faviconUrl: 'https://evil.com/x.png' })).toThrow(/ruta pública/);
      expect(() => normalizarTema({ faviconUrl: '/api/favicon/../../etc' })).toThrow(/ruta pública/);
    });
  });

  describe('subirFaviconAlBackend', () => {
    test('rechaza un buffer que no es imagen válida (firma binaria)', async () => {
      await expect(subirFaviconAlBackend('cliente1', Buffer.from('no es imagen'))).rejects.toThrow(
        /no es una imagen válida/
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('sube un PNG válido y retorna la URL que da el backend', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ url: '/api/favicon/cliente1' }) });
      const url = await subirFaviconAlBackend('cliente1', bufferPng());
      expect(url).toBe('/api/favicon/cliente1');
      const [fetchUrl, opciones] = global.fetch.mock.calls[0];
      expect(fetchUrl).toContain('/internal/favicon/cliente1');
      expect(opciones.method).toBe('POST');
      expect(opciones.headers['X-Internal-Secret']).toBeDefined();
    });

    test('propaga error si el backend rechaza la subida', async () => {
      global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Cuota excedida' }) });
      await expect(subirFaviconAlBackend('cliente1', bufferPng())).rejects.toThrow('Cuota excedida');
    });

    test('propaga error "backend" si la conexión con el backend falla', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(subirFaviconAlBackend('cliente1', bufferPng())).rejects.toThrow(/no se pudo conectar/i);
    });
  });

  describe('borrarFaviconDelBackend', () => {
    test('no lanza si el backend responde ok', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200 });
      await expect(borrarFaviconDelBackend('cliente1')).resolves.toBeUndefined();
    });

    test('no lanza (best-effort) si el backend responde 404 (ya no existía)', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 404 });
      await expect(borrarFaviconDelBackend('cliente1')).resolves.toBeUndefined();
    });

    test('no lanza (best-effort) si la conexión falla', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(borrarFaviconDelBackend('cliente1')).resolves.toBeUndefined();
    });
  });

  describe('actualizarTemaTenant', () => {
    test('rechaza un slug inválido sin llegar a hacer ninguna consulta', async () => {
      const pool = { query: jest.fn() };
      obtenerPool.mockReturnValue(pool);
      await expect(actualizarTemaTenant('Slug Invalido', { tema: {} })).rejects.toThrow(ErrorTemaTenant);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('responde "no_encontrado" si el tenant no existe', async () => {
      mockPool(null);
      await expect(actualizarTemaTenant('no-existe', { tema: {} })).rejects.toMatchObject({ codigo: 'no_encontrado' });
    });

    test('rechaza si falta el tema a guardar (ni tema ni restablecer)', async () => {
      mockPool({ id: 1, slug: 'cliente1', tema_json: null });
      await expect(actualizarTemaTenant('cliente1', {})).rejects.toThrow(/Falta el tema/);
    });

    test('guarda un tema nuevo y notifica invalidación de caché', async () => {
      const tenantFila = { id: 1, slug: 'cliente1', tema_json: null };
      const filaFinal = { ...tenantFila, tema_json: JSON.stringify({ radio: 'lg' }) };
      const pool = mockPool(tenantFila, filaFinal);

      const resultado = await actualizarTemaTenant('cliente1', { tema: { radio: 'lg' } }, { actor: 'admin' });

      expect(resultado).toEqual(filaFinal);
      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[1];
      expect(sqlUpdate).toMatch(/UPDATE tenants SET tema_json = \? WHERE slug = \?/);
      expect(paramsUpdate).toEqual([JSON.stringify({ radio: 'lg' }), 'cliente1']);
      expect(notificarInvalidacionCache).toHaveBeenCalledWith('cliente1');
    });

    test('restablecer=true regresa el tema a NULL sin exigir "tema"', async () => {
      const tenantFila = { id: 1, slug: 'cliente1', tema_json: JSON.stringify({ radio: 'lg' }) };
      const filaFinal = { ...tenantFila, tema_json: null };
      const pool = mockPool(tenantFila, filaFinal);

      const resultado = await actualizarTemaTenant('cliente1', { restablecer: true }, { actor: 'admin' });

      expect(resultado.tema_json).toBeNull();
      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[1];
      expect(sqlUpdate).toMatch(/UPDATE tenants SET tema_json = NULL WHERE slug = \?/);
      expect(paramsUpdate).toEqual(['cliente1']);
    });

    test('restablecer=true borra el favicon en el backend si el tema previo tenía uno', async () => {
      const tenantFila = {
        id: 1,
        slug: 'cliente1',
        tema_json: JSON.stringify({ faviconUrl: '/api/favicon/cliente1' }),
      };
      mockPool(tenantFila, { ...tenantFila, tema_json: null });
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      await actualizarTemaTenant('cliente1', { restablecer: true });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/favicon/cliente1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    test('quitarFavicon=true borra el favicon y lo quita del tema guardado', async () => {
      const tenantFila = { id: 1, slug: 'cliente1', tema_json: JSON.stringify({ faviconUrl: '/api/favicon/cliente1', radio: 'lg' }) };
      const pool = mockPool(tenantFila, { ...tenantFila, tema_json: JSON.stringify({ radio: 'lg' }) });
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      await actualizarTemaTenant('cliente1', { tema: { radio: 'lg' }, quitarFavicon: true });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/favicon/cliente1'),
        expect.objectContaining({ method: 'DELETE' })
      );
      const [, paramsUpdate] = pool.query.mock.calls[1];
      expect(paramsUpdate[0]).toBe(JSON.stringify({ radio: 'lg' }));
    });

    test('sin favicon nuevo ni quitarFavicon, conserva el favicon ya guardado', async () => {
      const tenantFila = { id: 1, slug: 'cliente1', tema_json: JSON.stringify({ faviconUrl: '/api/favicon/cliente1' }) };
      const pool = mockPool(tenantFila, tenantFila);

      await actualizarTemaTenant('cliente1', { tema: { radio: 'md' } });

      const [, paramsUpdate] = pool.query.mock.calls[1];
      const temaGuardado = JSON.parse(paramsUpdate[0]);
      expect(temaGuardado.faviconUrl).toBe('/api/favicon/cliente1');
      expect(temaGuardado.radio).toBe('md');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('faviconBase64 nuevo sube al backend y guarda la URL devuelta', async () => {
      const tenantFila = { id: 1, slug: 'cliente1', tema_json: null };
      const pool = mockPool(tenantFila, tenantFila);
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ url: '/api/favicon/cliente1' }) });

      await actualizarTemaTenant('cliente1', { tema: {}, faviconBase64: bufferPng().toString('base64') });

      const [, paramsUpdate] = pool.query.mock.calls[1];
      const temaGuardado = JSON.parse(paramsUpdate[0]);
      expect(temaGuardado.faviconUrl).toBe('/api/favicon/cliente1');
    });

    test('si el UPDATE no afecta filas (carrera con un borrado), responde no_encontrado', async () => {
      const tenantFila = { id: 1, slug: 'cliente1', tema_json: null };
      const pool = { query: jest.fn() };
      pool.query
        .mockResolvedValueOnce([[tenantFila]]) // SELECT
        .mockResolvedValueOnce([{ affectedRows: 0 }]); // UPDATE no afectó nada
      obtenerPool.mockReturnValue(pool);

      await expect(actualizarTemaTenant('cliente1', { tema: { radio: 'lg' } })).rejects.toMatchObject({
        codigo: 'no_encontrado',
      });
    });

    test('un fallo al invalidar la caché del backend no revienta la actualización (best-effort)', async () => {
      const tenantFila = { id: 1, slug: 'cliente1', tema_json: null };
      mockPool(tenantFila, tenantFila);
      notificarInvalidacionCache.mockRejectedValueOnce(new Error('backend caído'));

      await expect(actualizarTemaTenant('cliente1', { tema: { radio: 'lg' } })).resolves.toBeDefined();
    });
  });
});
