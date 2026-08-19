const { pool } = require('../../db');
const { getConfiguracionGlobal } = require('../../utils/config');
const { enviarCorreo } = require('../../utils/email');
const {
  generarContenidoMD,
  guardarReporte,
  generarYEnviarReporte,
  generarCSV,
  generarExcelBuffer,
  aFechaSegura,
} = require('../../utils/reportes');

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../../utils/config', () => ({
  getConfiguracionGlobal: jest.fn(),
  formatearFechaHoraMexico: jest.fn((fecha, zona) => ({ fecha: '24/jul/2026', hora: '10:00:00' })),
}));

jest.mock('../../utils/email', () => ({
  enviarCorreo: jest.fn(),
}));

const itemTicket = {
  tipo_registro: 'ticket',
  identificador: 'F-001',
  rfc: 'GOMJ800101ABC',
  estatus_o_concepto: 'pendiente',
  monto: null,
  fecha_registro: '2026-07-20 10:00:00',
  atendido_por: 'admin',
};

const itemOrden = {
  tipo_registro: 'orden_compra',
  identificador: 'OC-100',
  rfc: 'cliente@x.com',
  estatus_o_concepto: 'Compra de equipo',
  monto: 1500.5,
  fecha_registro: '2026-07-21 12:00:00',
};

describe('reportes.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('aFechaSegura', () => {
    test('convierte un string "YYYY-MM-DD HH:MM:SS" (formato dateStrings de MySQL) a Date', () => {
      const resultado = aFechaSegura('2026-07-20 10:00:00');
      expect(resultado).toBeInstanceOf(Date);
      expect(resultado.toISOString()).toBe('2026-07-20T10:00:00.000Z');
    });

    test('pasa un Date real directamente', () => {
      const fecha = new Date('2026-07-20T10:00:00.000Z');
      expect(aFechaSegura(fecha)).toBe(fecha);
    });

    test('devuelve null para valores vacíos/inválidos', () => {
      expect(aFechaSegura(null)).toBeNull();
      expect(aFechaSegura('')).toBeNull();
      expect(aFechaSegura('no-es-fecha')).toBeNull();
    });

    test('devuelve null para un Date inválido', () => {
      expect(aFechaSegura(new Date('fecha-invalida'))).toBeNull();
    });
  });

  describe('generarContenidoMD', () => {
    test('incluye conteos correctos de tickets y órdenes', () => {
      const md = generarContenidoMD({
        tipo: 'manual',
        fechaGeneracion: new Date(),
        items: [itemTicket, itemOrden],
        zonaHoraria: 'America/Mexico_City',
      });
      expect(md).toContain('**Tickets:** 1');
      expect(md).toContain('**Órdenes de compra:** 1');
      expect(md).toContain('**Total de registros:** 2');
    });

    test('tipo "automatico" se etiqueta como generado antes del borrado', () => {
      const md = generarContenidoMD({ tipo: 'automatico', fechaGeneracion: new Date(), items: [], zonaHoraria: 'America/Mexico_City' });
      expect(md).toContain('Automático (antes de borrado por retención)');
    });

    test('sin tickets ni órdenes, muestra los mensajes de "sin registros"', () => {
      const md = generarContenidoMD({ tipo: 'manual', fechaGeneracion: new Date(), items: [], zonaHoraria: 'America/Mexico_City' });
      expect(md).toContain('_Sin tickets en este reporte._');
      expect(md).toContain('_Sin órdenes de compra en este reporte._');
    });

    test('escapa "|" dentro de una celda para no romper la tabla Markdown', () => {
      const item = { ...itemTicket, estatus_o_concepto: 'pendiente | urgente' };
      const md = generarContenidoMD({ tipo: 'manual', fechaGeneracion: new Date(), items: [item], zonaHoraria: 'America/Mexico_City' });
      expect(md).toContain('pendiente \\| urgente');
    });

    test('incluye el rango cubierto solo si ambas fechas son válidas', () => {
      const mdConRango = generarContenidoMD({
        tipo: 'manual',
        fechaGeneracion: new Date(),
        rangoInicio: new Date('2026-07-01T00:00:00.000Z'),
        rangoFin: new Date('2026-07-31T00:00:00.000Z'),
        items: [],
        zonaHoraria: 'America/Mexico_City',
      });
      expect(mdConRango).toContain('**Rango cubierto:**');

      const mdSinRango = generarContenidoMD({ tipo: 'manual', fechaGeneracion: new Date(), items: [], zonaHoraria: 'America/Mexico_City' });
      expect(mdSinRango).not.toContain('**Rango cubierto:**');
    });
  });

  describe('guardarReporte', () => {
    test('inserta el reporte y cada item, devuelve el id insertado', async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 42 }]); // INSERT INTO reportes
      pool.query.mockResolvedValueOnce([{}]); // INSERT INTO reporte_items

      const reporteId = await guardarReporte({
        tipo: 'manual',
        fechaGeneracion: new Date(),
        items: [itemTicket, itemOrden],
        mdContenido: '# md',
        correoEnviadoA: 'x@x.com',
        correoEnviado: true,
      });

      expect(reporteId).toBe(42);
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query.mock.calls[1][0]).toContain('INSERT INTO reporte_items');
    });

    test('no inserta reporte_items si no hay items', async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

      await guardarReporte({ tipo: 'manual', fechaGeneracion: new Date(), items: [], mdContenido: '# md' });

      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('generarYEnviarReporte', () => {
    test('sin correo_reportes configurado, guarda pero no envía correo', async () => {
      getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City', correo_reportes: '' });
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await generarYEnviarReporte({ tipo: 'manual', items: [itemTicket] });

      expect(enviarCorreo).not.toHaveBeenCalled();
      expect(resultado.correoEnviado).toBe(false);
      expect(resultado.correoDestino).toBeNull();
    });

    test('con correo_reportes configurado, envía el correo con el markdown adjunto', async () => {
      getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City', correo_reportes: 'reportes@x.com' });
      enviarCorreo.mockResolvedValue();
      pool.query.mockResolvedValueOnce([{ insertId: 2 }]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await generarYEnviarReporte({ tipo: 'automatico', items: [itemTicket, itemOrden] });

      expect(enviarCorreo).toHaveBeenCalledWith(
        expect.objectContaining({
          destinatario: 'reportes@x.com',
          adjuntos: expect.arrayContaining([expect.objectContaining({ contentType: 'text/markdown' })]),
        })
      );
      expect(resultado.correoEnviado).toBe(true);
      expect(resultado.errorCorreo).toBeNull();
    });

    test('si el envío de correo falla, igual guarda el reporte y expone el error', async () => {
      getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City', correo_reportes: 'reportes@x.com' });
      enviarCorreo.mockRejectedValue(new Error('SMTP no configurado'));
      pool.query.mockResolvedValueOnce([{ insertId: 3 }]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await generarYEnviarReporte({ tipo: 'manual', items: [itemTicket] });

      expect(resultado.correoEnviado).toBe(false);
      expect(resultado.errorCorreo).toBe('SMTP no configurado');
      expect(resultado.reporteId).toBe(3); // el guardado no se ve afectado por el fallo de correo
    });
  });

  describe('generarCSV', () => {
    test('incluye BOM UTF-8 al inicio', () => {
      const csv = generarCSV([itemTicket], 'America/Mexico_City');
      expect(csv.startsWith('﻿')).toBe(true);
    });

    test('incluye encabezados y una fila por item', () => {
      const csv = generarCSV([itemTicket, itemOrden], 'America/Mexico_City');
      const lineas = csv.replace('﻿', '').split('\r\n');
      expect(lineas[0]).toBe('Tipo,Identificador,RFC / Correo,Estatus,Monto,Atendido por,Fecha de registro,Acción');
      expect(lineas).toHaveLength(3); // encabezado + 2 items
    });

    test('escapa valores con comas envolviéndolos en comillas', () => {
      const item = { ...itemOrden, estatus_o_concepto: 'Compra, con coma' };
      const csv = generarCSV([item], 'America/Mexico_City');
      expect(csv).toContain('"Compra, con coma"');
    });
  });

  describe('generarExcelBuffer', () => {
    test('genera un Buffer .xlsx real y no vacío', async () => {
      const buffer = await generarExcelBuffer([itemTicket, itemOrden], 'America/Mexico_City');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      // Un .xlsx es un ZIP: debe empezar con la firma "PK"
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
    });
  });
});
