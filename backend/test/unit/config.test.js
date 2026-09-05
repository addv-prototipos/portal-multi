const { pool } = require('../../db');
const {
  getCamposObligatorios,
  setCamposObligatorios,
  getRetencionTicketsDias,
  setRetencionTicketsDias,
  ZONAS_HORARIAS_MEXICO,
  getConfiguracionGlobal,
  setConfiguracionGlobal,
  formatearFechaHoraMexico,
} = require('../../utils/config');

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
}));

describe('config.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCamposObligatorios / setCamposObligatorios', () => {
    test('devuelve los defaults si no hay nada guardado', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const resultado = await getCamposObligatorios();
      expect(resultado).toEqual({
        tipo_persona: true,
        rfc: false,
        uso_cfdi: false,
        tipo_pago: false,
        comentarios: false,
      });
    });

    test('cae a defaults si el JSON guardado está corrupto', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '{{{corrupto' }]]);
      const resultado = await getCamposObligatorios();
      expect(resultado.tipo_persona).toBe(true);
    });

    test('solo respeta campos configurables conocidos, ignora claves extrañas', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ rfc: true, campo_inventado: true }) }]]);
      const resultado = await getCamposObligatorios();
      expect(resultado.rfc).toBe(true);
      expect(resultado.campo_inventado).toBeUndefined();
    });

    test('setCamposObligatorios combina cambios sobre el estado actual y guarda', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios interno (actual)
      pool.query.mockResolvedValueOnce([{}]); // INSERT/UPDATE

      const resultado = await setCamposObligatorios({ rfc: true });

      expect(resultado.rfc).toBe(true);
      expect(resultado.tipo_persona).toBe(true); // no tocado, mantiene default
      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO configuracion'),
        ['campos_obligatorios', JSON.stringify(resultado)]
      );
    });

    test('setCamposObligatorios ignora valores no booleanos', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await setCamposObligatorios({ rfc: 'no-es-booleano' });
      expect(resultado.rfc).toBe(false); // se queda en el default, el cambio inválido se ignora
    });
  });

  describe('getRetencionTicketsDias / setRetencionTicketsDias', () => {
    test('devuelve null si no hay retención configurada', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      expect(await getRetencionTicketsDias()).toBeNull();
    });

    test('devuelve el número de días si está configurado y es válido', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '30' }]]);
      expect(await getRetencionTicketsDias()).toBe(30);
    });

    test('devuelve null si el valor guardado no es un entero positivo', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '-5' }]]);
      expect(await getRetencionTicketsDias()).toBeNull();
      pool.query.mockResolvedValueOnce([[{ valor: 'no-numero' }]]);
      expect(await getRetencionTicketsDias()).toBeNull();
    });

    test('setRetencionTicketsDias guarda un valor entero positivo', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      const resultado = await setRetencionTicketsDias(45);
      expect(resultado).toBe(45);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO configuracion'), [
        'tickets_retencion_dias',
        '45',
      ]);
    });

    test('setRetencionTicketsDias con 0/null/negativo borra la configuración (desactiva)', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      const resultado = await setRetencionTicketsDias(0);
      expect(resultado).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM configuracion'), [
        'tickets_retencion_dias',
      ]);
    });
  });

  describe('getConfiguracionGlobal', () => {
    test('devuelve los defaults si no hay nada guardado', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const resultado = await getConfiguracionGlobal();
      expect(resultado.iva_porcentaje).toBe(16);
      expect(resultado.zona_horaria).toBe('America/Mexico_City');
      expect(resultado.ordenes_compra_habilitado).toBe(true);
    });

    test('respeta valores guardados válidos', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ iva_porcentaje: 8, zona_horaria: 'America/Tijuana', ordenes_compra_habilitado: false }) }],
      ]);
      const resultado = await getConfiguracionGlobal();
      expect(resultado.iva_porcentaje).toBe(8);
      expect(resultado.zona_horaria).toBe('America/Tijuana');
      expect(resultado.ordenes_compra_habilitado).toBe(false);
    });

    test('ignora iva_porcentaje fuera de rango (usa default)', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ iva_porcentaje: 150 }) }]]);
      const resultado = await getConfiguracionGlobal();
      expect(resultado.iva_porcentaje).toBe(16);
    });

    test('ignora zona_horaria desconocida (usa default)', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ zona_horaria: 'Europe/Madrid' }) }]]);
      const resultado = await getConfiguracionGlobal();
      expect(resultado.zona_horaria).toBe('America/Mexico_City');
    });

    test('retrocompatibilidad: lee "codigo_sat" si "clave_sat" no existe', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ codigo_sat: '12345678' }) }]]);
      const resultado = await getConfiguracionGlobal();
      expect(resultado.clave_sat).toBe('12345678');
    });

    test('clave_sat tiene prioridad sobre codigo_sat si ambos existen', async () => {
      pool.query.mockResolvedValueOnce([
        [{ valor: JSON.stringify({ clave_sat: '87654321', codigo_sat: '11111111' }) }],
      ]);
      const resultado = await getConfiguracionGlobal();
      expect(resultado.clave_sat).toBe('87654321');
    });

    test('cae a defaults si el JSON está corrupto', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: 'no-json{{{' }]]);
      const resultado = await getConfiguracionGlobal();
      expect(resultado.iva_porcentaje).toBe(16);
    });

    test('normaliza correo_reportes a minúsculas', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ correo_reportes: 'ADMIN@Empresa.com' }) }]]);
      const resultado = await getConfiguracionGlobal();
      expect(resultado.correo_reportes).toBe('admin@empresa.com');
    });
  });

  describe('setConfiguracionGlobal', () => {
    function mockActualVacio() {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal interno
      pool.query.mockResolvedValueOnce([{}]); // INSERT/UPDATE final
    }

    test('acepta iva_porcentaje válido', async () => {
      mockActualVacio();
      const resultado = await setConfiguracionGlobal({ iva_porcentaje: 8 });
      expect(resultado.iva_porcentaje).toBe(8);
    });

    test('rechaza iva_porcentaje fuera de rango', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(setConfiguracionGlobal({ iva_porcentaje: 150 })).rejects.toThrow(/entre 0 y 100/);
    });

    test('rechaza zona_horaria inválida', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(setConfiguracionGlobal({ zona_horaria: 'Europe/Madrid' })).rejects.toThrow(/zona horaria válida/);
    });

    test('logo_url vacío se guarda como null', async () => {
      mockActualVacio();
      const resultado = await setConfiguracionGlobal({ logo_url: '   ' });
      expect(resultado.logo_url).toBeNull();
    });

    test('rechaza rfc_compania con formato inválido', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(setConfiguracionGlobal({ rfc_compania: '123' })).rejects.toThrow(/RFC de la compañía/);
    });

    test('rechaza clave_sat que no sean exactamente 8 dígitos', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(setConfiguracionGlobal({ clave_sat: '123' })).rejects.toThrow(/exactamente 8 dígitos/);
    });

    test('acepta clave_sat vacía (limpia el valor, no lanza)', async () => {
      mockActualVacio();
      const resultado = await setConfiguracionGlobal({ clave_sat: '' });
      expect(resultado.clave_sat).toBe('');
    });

    test('rechaza correo_reportes con formato inválido', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(setConfiguracionGlobal({ correo_reportes: 'no-es-correo' })).rejects.toThrow(/correo de reportes/);
    });

    test('tipo_persona_compania solo acepta "fisica"/"moral", cualquier otra cosa se guarda como null', async () => {
      mockActualVacio();
      const resultado = await setConfiguracionGlobal({ tipo_persona_compania: 'otro-valor' });
      expect(resultado.tipo_persona_compania).toBeNull();
    });

    test('ordenes_compra_habilitado se convierte a booleano explícito', async () => {
      mockActualVacio();
      const resultado = await setConfiguracionGlobal({ ordenes_compra_habilitado: 0 });
      expect(resultado.ordenes_compra_habilitado).toBe(false);
    });
  });

  describe('formatearFechaHoraMexico', () => {
    test('formatea fecha/hora en la zona horaria dada, sin punto en el mes abreviado', () => {
      // 2026-07-24 15:30:45 UTC — con America/Mexico_City (UTC-6 en verano)
      const fecha = new Date('2026-07-24T15:30:45.000Z');
      const resultado = formatearFechaHoraMexico(fecha, 'America/Mexico_City');
      expect(resultado.fecha).toBe('24/jul/2026');
      expect(resultado.hora).toBe('09:30:45');
      expect(resultado.fecha).not.toContain('.');
    });

    test('usa la zona horaria default si se pasa una inválida', () => {
      const fecha = new Date('2026-07-24T15:30:45.000Z');
      const resultadoInvalida = formatearFechaHoraMexico(fecha, 'Europe/Madrid');
      const resultadoDefault = formatearFechaHoraMexico(fecha, 'America/Mexico_City');
      expect(resultadoInvalida).toEqual(resultadoDefault);
    });

    test('la hora usa formato 24h (00-23), nunca "24"', () => {
      const medianoche = new Date('2026-07-24T06:00:00.000Z'); // 00:00 en America/Mexico_City
      const resultado = formatearFechaHoraMexico(medianoche, 'America/Mexico_City');
      expect(resultado.hora).toBe('00:00:00');
    });
  });

  describe('ZONAS_HORARIAS_MEXICO', () => {
    test('incluye Ciudad de México', () => {
      expect(ZONAS_HORARIAS_MEXICO.some((z) => z.id === 'America/Mexico_City')).toBe(true);
    });

    test('todas tienen id y etiqueta', () => {
      ZONAS_HORARIAS_MEXICO.forEach((z) => {
        expect(typeof z.id).toBe('string');
        expect(typeof z.etiqueta).toBe('string');
      });
    });
  });
});
