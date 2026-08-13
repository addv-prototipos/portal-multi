const { pool } = require('../db');
const { getRetencionTicketsDias } = require('./config');
const { generarYEnviarReporte } = require('./reportes');
const storage = require('./storage');

// Misma configuración de días para ambas limpiezas (tickets y órdenes de
// compra) — un solo número de retención que el administrador configura
// una vez, aplicado a las dos. Se registra la última limpieza de cada
// una por separado (claves distintas), para poder mostrar información
// específica de cada una en el panel, aunque compartan el mismo "cuándo".
const CLAVE_ULTIMA_LIMPIEZA_TICKETS = 'tickets_ultima_limpieza';
const CLAVE_ULTIMA_LIMPIEZA_ORDENES = 'ordenes_compra_ultima_limpieza';

async function getInfoUltimaLimpieza(clave = CLAVE_ULTIMA_LIMPIEZA_TICKETS) {
  const [filas] = await pool.query('SELECT valor FROM configuracion WHERE clave = ?', [clave]);
  if (filas.length === 0) return null;
  try {
    return JSON.parse(filas[0].valor);
  } catch (e) {
    return null;
  }
}

async function registrarLimpieza(clave, cantidadEliminados) {
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [clave, JSON.stringify({ fecha: new Date().toISOString(), cantidadEliminados })]
  );
}

// Trae (sin borrar todavía) los tickets/órdenes cuya fecha de creación
// exceda el número de días de retención configurado — separado del
// borrado en sí para poder generar el reporte ANTES de eliminar nada
// (ver ejecutarLimpiezaConReporte más abajo, que es quien de verdad
// encadena "obtener -> reportar -> borrar" en ese orden).
async function obtenerTicketsVencidos() {
  const dias = await getRetencionTicketsDias();
  if (!dias) return { ticketsVencidos: [], retencionActiva: false, diasConfigurados: null };
  const [vencidos] = await pool.query('SELECT * FROM tickets WHERE creado_en < DATE_SUB(NOW(), INTERVAL ? DAY)', [dias]);
  return { ticketsVencidos: vencidos, retencionActiva: true, diasConfigurados: dias };
}

async function obtenerOrdenesVencidas() {
  const dias = await getRetencionTicketsDias();
  if (!dias) return { ordenesVencidas: [], retencionActiva: false, diasConfigurados: null };
  const [vencidas] = await pool.query('SELECT * FROM ordenes_compra WHERE creado_en < DATE_SUB(NOW(), INTERVAL ? DAY)', [dias]);
  return { ordenesVencidas: vencidas, retencionActiva: true, diasConfigurados: dias };
}

// Borra (imagen + factura si existe + fila) los tickets ya obtenidos con
// obtenerTicketsVencidos(). Los errores al borrar un ticket individual
// (ej. el archivo ya no existe) no detienen el resto del lote.
//
// Multi-tenant (segmento 5 del plan, ver PROJECT_STATE.md): esta función
// corre desde un `setInterval` en server.js, FUERA de cualquier request
// HTTP — no hay un `req.tenant` que leer. Usa `storage.PREFIJO_DEFECTO`
// (el mismo tenant único de siempre) a propósito; iterar la limpieza
// sobre todos los tenants reales es trabajo pendiente, ya anotado desde
// el segmento 2 como una extensión futura de este mismo mecanismo, no
// algo que este segmento (solo migración de almacenamiento) deba resolver.
async function eliminarTickets(ticketsVencidos) {
  let eliminados = 0;
  for (const ticket of ticketsVencidos) {
    try {
      await storage.eliminarArchivo(storage.PREFIJO_DEFECTO, 'tickets', ticket.imagen_nombre_guardado);

      if (ticket.factura_nombre_guardado) {
        await storage.eliminarArchivo(storage.PREFIJO_DEFECTO, 'facturas', ticket.factura_nombre_guardado);
      }

      await pool.query('DELETE FROM tickets WHERE id = ?', [ticket.id]);
      eliminados += 1;
    } catch (err) {
      console.error(`No se pudo eliminar el ticket vencido ${ticket.id} (folio ${ticket.folio}):`, err);
    }
  }
  if (eliminados > 0) {
    await registrarLimpieza(CLAVE_ULTIMA_LIMPIEZA_TICKETS, eliminados);
  }
  return eliminados;
}

// Borra en lote las órdenes de compra ya obtenidas con
// obtenerOrdenesVencidas() — a diferencia de un ticket, una orden no
// tiene ningún archivo en disco que limpiar, así que no hace falta
// procesarlas una por una.
async function eliminarOrdenes(ordenesVencidas) {
  if (ordenesVencidas.length === 0) return 0;
  const ids = ordenesVencidas.map((o) => o.id);
  const [resultado] = await pool.query('DELETE FROM ordenes_compra WHERE id IN (?)', [ids]);
  const eliminados = resultado.affectedRows;
  if (eliminados > 0) {
    await registrarLimpieza(CLAVE_ULTIMA_LIMPIEZA_ORDENES, eliminados);
  }
  return eliminados;
}

// Wrappers que combinan "obtener + borrar" en una sola llamada, para
// quien solo necesite borrar sin generar ningún reporte (ej. una prueba
// aislada, o un uso futuro fuera del flujo con reporte). El flujo real
// que corre en producción es ejecutarLimpiezaConReporte(), más abajo.
async function limpiarTicketsVencidos() {
  const { ticketsVencidos, retencionActiva, diasConfigurados } = await obtenerTicketsVencidos();
  if (!retencionActiva) return { eliminados: 0, retencionActiva: false };
  const eliminados = await eliminarTickets(ticketsVencidos);
  return { eliminados, retencionActiva: true, diasConfigurados };
}

async function limpiarOrdenesVencidas() {
  const { ordenesVencidas, retencionActiva, diasConfigurados } = await obtenerOrdenesVencidas();
  if (!retencionActiva) return { eliminados: 0, retencionActiva: false };
  const eliminados = await eliminarOrdenes(ordenesVencidas);
  return { eliminados, retencionActiva: true, diasConfigurados };
}

// Convierte una fila de ticket/orden ya cruda de MySQL al formato de
// "item" que espera utils/reportes.js.
function ticketAItemReporte(ticket) {
  return {
    tipo_registro: 'ticket',
    identificador: ticket.folio,
    rfc: ticket.rfc,
    estatus_o_concepto: ticket.estatus,
    monto: null, // un ticket no tiene un monto propio — el monto real vive en su orden de compra, si tiene una vinculada
    fecha_registro: ticket.creado_en,
    atendido_por: ticket.actualizado_por,
  };
}

function ordenAItemReporte(orden) {
  return {
    tipo_registro: 'orden_compra',
    identificador: orden.numero_compra,
    rfc: orden.email, // ordenes_compra no guarda RFC propio, solo el correo del cliente — se usa ese como identificador del contribuyente en el reporte
    estatus_o_concepto: orden.concepto,
    monto: orden.total,
    fecha_registro: orden.creado_en,
  };
}

// Flujo real que corre cada hora (ver server.js): obtiene los tickets y
// órdenes vencidos SIN borrarlos todavía, genera y envía (si hay correo
// configurado) UN SOLO reporte combinado con toda esa información —
// "reporte del mes" pedido explícitamente, para no perder ese historial
// para siempre justo antes de que el borrado automático lo elimine — y
// SOLO DESPUÉS de que el reporte ya quedó guardado, borra ambos. Si no
// hay nada vencido de ningún tipo, no se genera ningún reporte (un
// reporte vacío no le sirve a nadie).
async function ejecutarLimpiezaConReporte() {
  const { ticketsVencidos, retencionActiva: retencionTickets, diasConfigurados } = await obtenerTicketsVencidos();
  const { ordenesVencidas, retencionActiva: retencionOrdenes } = await obtenerOrdenesVencidas();

  let reporteId = null;
  let correoEnviado = false;
  let errorCorreo = null;

  if (ticketsVencidos.length > 0 || ordenesVencidas.length > 0) {
    const items = [...ticketsVencidos.map(ticketAItemReporte), ...ordenesVencidas.map(ordenAItemReporte)];
    // El rango cubierto es "desde el registro más antiguo hasta el más
    // reciente" de lo que se está a punto de borrar en esta corrida —
    // más útil para el administrador que un rango de calendario fijo,
    // ya que refleja exactamente lo que trae el reporte.
    const fechas = items.map((i) => new Date(i.fecha_registro)).filter((f) => !Number.isNaN(f.getTime()));
    const rangoInicio = fechas.length ? new Date(Math.min(...fechas)) : null;
    const rangoFin = fechas.length ? new Date(Math.max(...fechas)) : null;

    try {
      const resultado = await generarYEnviarReporte({ tipo: 'automatico', items, rangoInicio, rangoFin });
      reporteId = resultado.reporteId;
      correoEnviado = resultado.correoEnviado;
      errorCorreo = resultado.errorCorreo;
    } catch (err) {
      // Si el reporte en sí falla al generarse/guardarse (no solo el
      // correo, que ya se maneja aparte dentro de generarYEnviarReporte),
      // se registra el error pero NO se detiene el borrado — perder el
      // reporte de una corrida es mejor que dejar acumulándose
      // indefinidamente tickets/órdenes que ya deberían haberse borrado
      // por la retención configurada.
      console.error('No se pudo generar el reporte antes de la limpieza automática:', err);
    }
  }

  const eliminadosTickets = retencionTickets ? await eliminarTickets(ticketsVencidos) : 0;
  const eliminadosOrdenes = retencionOrdenes ? await eliminarOrdenes(ordenesVencidas) : 0;

  return {
    eliminadosTickets,
    eliminadosOrdenes,
    retencionActiva: retencionTickets || retencionOrdenes,
    diasConfigurados,
    reporteId,
    correoEnviado,
    errorCorreo,
  };
}

module.exports = {
  limpiarTicketsVencidos,
  limpiarOrdenesVencidas,
  obtenerTicketsVencidos,
  obtenerOrdenesVencidas,
  eliminarTickets,
  eliminarOrdenes,
  ejecutarLimpiezaConReporte,
  getInfoUltimaLimpieza,
  CLAVE_ULTIMA_LIMPIEZA_TICKETS,
  CLAVE_ULTIMA_LIMPIEZA_ORDENES,
};
