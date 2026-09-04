const { pool, ejecutarComoTenant, obtenerPoolControl, obtenerPoolTenant } = require('../../db');
const { getRetencionTicketsDias } = require('../../utils/config');
const { generarYEnviarReporte } = require('../../utils/reportes');
const {
  limpiarTicketsVencidos,
  limpiarOrdenesVencidas,
  obtenerTicketsVencidos,
  obtenerOrdenesVencidas,
  eliminarTickets,
  eliminarOrdenes,
  ejecutarLimpiezaConReporte,
  ejecutarLimpiezaParaTodos,
  getInfoUltimaLimpieza,
  CLAVE_ULTIMA_LIMPIEZA_TICKETS,
  CLAVE_ULTIMA_LIMPIEZA_ORDENES,
} = require('../../utils/ticketsCleanup');

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
  // Mismo criterio que cierreMensual.test.js: ejecutarComoTenant recibe un
  // POOL real (objeto), nunca el slug crudo.
  ejecutarComoTenant: jest.fn((tenantPool, fn) => fn()),
  obtenerPoolControl: jest.fn(),
  obtenerPoolTenant: jest.fn((cfg) => ({ __poolTenantMock: cfg.slug })),
}));

jest.mock('../../utils/config', () => ({
  getRetencionTicketsDias: jest.fn(),
}));

jest.mock('../../utils/reportes', () => ({
  generarYEnviarReporte: jest.fn(),
}));

// Segmento 5 del plan multi-tenant (ver PROJECT_STATE.md): el
// almacenamiento de archivos se movió de disco local (fs) a MinIO — se
// mockea backend/utils/storage.js en vez de fs.
jest.mock('../../utils/storage', () => ({
  PREFIJO_DEFECTO: '_default',
  eliminarArchivo: jest.fn().mockResolvedValue(undefined),
}));

const storage = require('../../utils/storage');

const ticketVencido = {
  id: 1,
  folio: 'F-001',
  rfc: 'GOMJ800101ABC',
  estatus: 'pendiente',
  creado_en: '2026-01-01 00:00:00',
  actualizado_por: 'admin',
  imagen_nombre_guardado: 'ticket1.jpg',
  factura_nombre_guardado: null,
};

const ordenVencida = {
  id: 10,
  numero_compra: 'OC-100',
  email: 'cliente@x.com',
  concepto: 'Equipo',
  total: 500,
  creado_en: '2026-01-01 00:00:00',
};

describe('ticketsCleanup.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInfoUltimaLimpieza', () => {
    test('devuelve null si no hay registro guardado', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      expect(await getInfoUltimaLimpieza()).toBeNull();
    });

    test('devuelve el objeto parseado si existe', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ fecha: '2026-01-01', cantidadEliminados: 3 }) }]]);
      const resultado = await getInfoUltimaLimpieza();
      expect(resultado).toEqual({ fecha: '2026-01-01', cantidadEliminados: 3 });
    });

    test('devuelve null si el JSON está corrupto', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: 'no-json{{{' }]]);
      expect(await getInfoUltimaLimpieza()).toBeNull();
    });

    test('usa la clave de órdenes cuando se pasa explícitamente', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await getInfoUltimaLimpieza(CLAVE_ULTIMA_LIMPIEZA_ORDENES);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [CLAVE_ULTIMA_LIMPIEZA_ORDENES]);
    });
  });

  describe('obtenerTicketsVencidos / obtenerOrdenesVencidas', () => {
    test('retención inactiva (sin días configurados) no consulta tickets vencidos', async () => {
      getRetencionTicketsDias.mockResolvedValue(null);
      const resultado = await obtenerTicketsVencidos();
      expect(resultado).toEqual({ ticketsVencidos: [], retencionActiva: false, diasConfigurados: null });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('retención activa consulta y devuelve los tickets vencidos', async () => {
      getRetencionTicketsDias.mockResolvedValue(30);
      pool.query.mockResolvedValueOnce([[ticketVencido]]);
      const resultado = await obtenerTicketsVencidos();
      expect(resultado).toEqual({ ticketsVencidos: [ticketVencido], retencionActiva: true, diasConfigurados: 30 });
    });

    test('obtenerOrdenesVencidas sigue el mismo patrón', async () => {
      getRetencionTicketsDias.mockResolvedValue(30);
      pool.query.mockResolvedValueOnce([[ordenVencida]]);
      const resultado = await obtenerOrdenesVencidas();
      expect(resultado).toEqual({ ordenesVencidas: [ordenVencida], retencionActiva: true, diasConfigurados: 30 });
    });
  });

  describe('eliminarTickets', () => {
    test('borra imagen, factura (si existe) y la fila; registra la limpieza', async () => {
      pool.query.mockResolvedValueOnce([{}]); // DELETE ticket
      pool.query.mockResolvedValueOnce([{}]); // registrarLimpieza

      const ticketConFactura = { ...ticketVencido, factura_nombre_guardado: 'factura1.pdf' };
      const eliminados = await eliminarTickets([ticketConFactura]);

      expect(eliminados).toBe(1);
      expect(storage.eliminarArchivo).toHaveBeenCalledTimes(2); // imagen + factura
      expect(storage.eliminarArchivo).toHaveBeenCalledWith(storage.PREFIJO_DEFECTO, 'tickets', 'ticket1.jpg');
      expect(storage.eliminarArchivo).toHaveBeenCalledWith(storage.PREFIJO_DEFECTO, 'facturas', 'factura1.pdf');
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM tickets WHERE id = ?', [ticketConFactura.id]);
    });

    test('no intenta borrar la factura si el ticket no tiene una', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      pool.query.mockResolvedValueOnce([{}]);

      await eliminarTickets([ticketVencido]);

      expect(storage.eliminarArchivo).toHaveBeenCalledTimes(1); // solo la imagen
    });

    test('tolera que el archivo ya no exista en el almacenamiento (delete idempotente)', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      pool.query.mockResolvedValueOnce([{}]);

      const eliminados = await eliminarTickets([ticketVencido]);

      expect(eliminados).toBe(1);
      expect(storage.eliminarArchivo).toHaveBeenCalledTimes(1);
    });

    test('un error al eliminar un ticket individual no detiene el resto del lote', async () => {
      pool.query
        .mockRejectedValueOnce(new Error('fallo en el primero')) // DELETE del primer ticket falla
        .mockResolvedValueOnce([{}]) // DELETE del segundo ticket ok
        .mockResolvedValueOnce([{}]); // registrarLimpieza

      const segundoTicket = { ...ticketVencido, id: 2, folio: 'F-002' };
      const eliminados = await eliminarTickets([ticketVencido, segundoTicket]);

      expect(eliminados).toBe(1); // solo el segundo se contó
    });

    test('con lista vacía, no registra limpieza ni consulta nada', async () => {
      const eliminados = await eliminarTickets([]);
      expect(eliminados).toBe(0);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('eliminarOrdenes', () => {
    test('borra en lote y registra la limpieza', async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 2 }]);
      pool.query.mockResolvedValueOnce([{}]); // registrarLimpieza

      const eliminados = await eliminarOrdenes([ordenVencida, { ...ordenVencida, id: 11 }]);

      expect(eliminados).toBe(2);
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM ordenes_compra WHERE id IN (?)', [[10, 11]]);
    });

    test('con lista vacía, no consulta nada y devuelve 0', async () => {
      const eliminados = await eliminarOrdenes([]);
      expect(eliminados).toBe(0);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('limpiarTicketsVencidos / limpiarOrdenesVencidas (wrappers)', () => {
    test('limpiarTicketsVencidos no hace nada si la retención está inactiva', async () => {
      getRetencionTicketsDias.mockResolvedValue(null);
      const resultado = await limpiarTicketsVencidos();
      expect(resultado).toEqual({ eliminados: 0, retencionActiva: false });
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('limpiarOrdenesVencidas borra cuando la retención está activa', async () => {
      getRetencionTicketsDias.mockResolvedValue(15);
      pool.query.mockResolvedValueOnce([[ordenVencida]]); // obtenerOrdenesVencidas
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE
      pool.query.mockResolvedValueOnce([{}]); // registrarLimpieza

      const resultado = await limpiarOrdenesVencidas();
      expect(resultado).toEqual({ eliminados: 1, retencionActiva: true, diasConfigurados: 15 });
    });
  });

  describe('ejecutarLimpiezaConReporte', () => {
    test('sin nada vencido, no genera reporte ni borra nada', async () => {
      getRetencionTicketsDias.mockResolvedValue(null);

      const resultado = await ejecutarLimpiezaConReporte();

      expect(generarYEnviarReporte).not.toHaveBeenCalled();
      expect(resultado).toEqual({
        eliminadosTickets: 0,
        eliminadosOrdenes: 0,
        retencionActiva: false,
        diasConfigurados: null,
        reporteId: null,
        correoEnviado: false,
        errorCorreo: null,
      });
    });

    test('con tickets y órdenes vencidos, genera el reporte ANTES de borrar', async () => {
      getRetencionTicketsDias.mockResolvedValue(30);
      // obtenerTicketsVencidos (solo tickets desde punto 158)
      pool.query.mockResolvedValueOnce([[ticketVencido]]);

      generarYEnviarReporte.mockResolvedValue({ reporteId: 99, correoEnviado: true, errorCorreo: null });

      // eliminarTickets: DELETE + registrarLimpieza
      pool.query.mockResolvedValueOnce([{}]);
      pool.query.mockResolvedValueOnce([{}]);

      const resultado = await ejecutarLimpiezaConReporte();

      expect(generarYEnviarReporte).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'automatico',
          items: expect.arrayContaining([
            expect.objectContaining({ tipo_registro: 'ticket', identificador: 'F-001' }),
          ]),
        })
      );
      // Desde punto 158 ya no incluye órdenes vencidas en el reporte
      expect(generarYEnviarReporte.mock.calls[0][0].items).toHaveLength(1);
      expect(resultado.reporteId).toBe(99);
      expect(resultado.correoEnviado).toBe(true);
      expect(resultado.eliminadosTickets).toBe(1);
      expect(resultado.eliminadosOrdenes).toBe(0);

      // Confirma el orden: generarYEnviarReporte se llamó antes que el DELETE de tickets/órdenes.
      const ordenLlamadas = generarYEnviarReporte.mock.invocationCallOrder[0];
      const primerDelete = pool.query.mock.calls.findIndex((c) => String(c[0]).includes('DELETE'));
      expect(ordenLlamadas).toBeLessThan(pool.query.mock.invocationCallOrder[primerDelete]);
    });

    test('si generar el reporte falla, igual continúa con el borrado', async () => {
      getRetencionTicketsDias.mockResolvedValue(30);
      pool.query.mockResolvedValueOnce([[ticketVencido]]);

      generarYEnviarReporte.mockRejectedValue(new Error('fallo al generar reporte'));

      pool.query.mockResolvedValueOnce([{}]); // DELETE ticket
      pool.query.mockResolvedValueOnce([{}]); // registrarLimpieza

      const resultado = await ejecutarLimpiezaConReporte();

      expect(resultado.reporteId).toBeNull();
      expect(resultado.eliminadosTickets).toBe(1); // el borrado no se detuvo por el fallo del reporte
    });
  });

  // Auditoría 2026-09-03 (hallazgo #8): antes de este fix, la limpieza
  // automática solo corría contra el pool por defecto — los tickets de
  // cualquier tenant real nunca se purgaban por retención. Mismo patrón de
  // prueba que cierreMensual.test.js (dual base + tenants).
  describe('ejecutarLimpiezaParaTodos (dual base + tenants, punto de la auditoría #8)', () => {
    test('ejecuta la limpieza contra base ADDV Y cada tenant activo, con su propio prefijo de storage', async () => {
      getRetencionTicketsDias.mockResolvedValue(null); // retención inactiva en todas — solo importa la orquestación
      obtenerPoolControl.mockReturnValue({
        query: jest.fn().mockResolvedValue([[
          { slug: 'tenant1', db_host: 'mysql', db_name: 'tenant_1', db_user: 'app' },
          { slug: 'tenant2', db_host: 'mysql', db_name: 'tenant_2', db_user: 'app' },
        ]]),
      });

      const resultados = await ejecutarLimpiezaParaTodos();

      expect(resultados).toHaveLength(3);
      expect(resultados[0]).toMatchObject({ slug: null, base: true, retencionActiva: false });
      expect(resultados[1]).toMatchObject({ slug: 'tenant1', retencionActiva: false });
      expect(resultados[2]).toMatchObject({ slug: 'tenant2', retencionActiva: false });

      expect(obtenerPoolTenant).toHaveBeenCalledWith(expect.objectContaining({ slug: 'tenant1', database: 'tenant_1' }));
      expect(obtenerPoolTenant).toHaveBeenCalledWith(expect.objectContaining({ slug: 'tenant2', database: 'tenant_2' }));
      expect(ejecutarComoTenant).toHaveBeenCalledTimes(2);
    });

    test('un error al listar/ejecutar un tenant no detiene la limpieza de los demás', async () => {
      getRetencionTicketsDias.mockResolvedValue(null);
      obtenerPoolControl.mockReturnValue({
        query: jest.fn().mockResolvedValue([[
          { slug: 'tenant-malo', db_host: 'mysql', db_name: 'tenant_malo', db_user: 'app' },
          { slug: 'tenant-bueno', db_host: 'mysql', db_name: 'tenant_bueno', db_user: 'app' },
        ]]),
      });
      ejecutarComoTenant
        .mockImplementationOnce(() => { throw new Error('tenant-malo caído'); })
        .mockImplementationOnce((tenantPool, fn) => fn());

      const resultados = await ejecutarLimpiezaParaTodos();

      expect(resultados).toHaveLength(3);
      expect(resultados[1]).toMatchObject({ slug: 'tenant-malo', error: 'tenant-malo caído' });
      expect(resultados[2]).toMatchObject({ slug: 'tenant-bueno', retencionActiva: false });
    });

    test('si no se puede listar tenants de control, igual devuelve el resultado de la base', async () => {
      getRetencionTicketsDias.mockResolvedValue(null);
      obtenerPoolControl.mockReturnValue({
        query: jest.fn().mockRejectedValue(new Error('control caído')),
      });

      const resultados = await ejecutarLimpiezaParaTodos();

      expect(resultados).toHaveLength(1);
      expect(resultados[0]).toMatchObject({ slug: null, base: true });
    });
  });
});
