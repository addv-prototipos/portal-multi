const { pool } = require('../db');
const { getRetencionTicketsDias } = require('./config');
const { generarYEnviarReporte } = require('./reportes');
const storage = require('./storage');

// Retención por días — SOLO tickets (peticiones de factura). Desde el
// punto 158 (2026-08-28) ya NO borra ventas/gastos: esos se archivan al
// cierre mensual hacia Reportes (ver cierreMensual.js). Se conserva la
// clave de órdenes por compatibilidad (no se escribe más).
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

/**
 * @deprecated desde punto 158 — retención ya no borra órdenes. Se conserva
 * por compatibilidad (tests / scripts viejos) pero NO se usa en el flujo
 * real (`ejecutarLimpiezaConReporte` ya no la llama).
 */
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

// @deprecated desde punto 158 — ver obtenerOrdenesVencidas. No se llama en
// el flujo real; solo wrapper para compatibilidad.
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

/** @deprecated desde punto 158 — ver obtenerOrdenesVencidas. */
async function limpiarOrdenesVencidas() {
  const { ordenesVencidas, retencionActiva, diasConfigurados } = await obtenerOrdenesVencidas();
  if (!retencionActiva) return { eliminados: 0, retencionActiva: false };
  const eliminados = await eliminarOrdenes(ordenesVencidas);
  return { eliminados, retencionActiva: true, diasConfigurados };
}

// Convierte una fila de ticket/orden ya cruda de MySQL al formato de
// "item" que espera utils/reportes.js. Ambas funciones se usan SOLO desde
// flujos que de verdad borran el registro (limpieza automática por
// retención, y "Eliminar" una orden de compra) — por eso accion:'eliminado'
// va fijo aquí, no como parámetro. La fotografía manual ("Enviar
// reporte", que no borra nada) arma sus items aparte, sin pasar por
// estas funciones, así que sus items quedan sin esta marca.
function ticketAItemReporte(ticket) {
  return {
    tipo_registro: 'ticket',
    identificador: ticket.folio,
    rfc: ticket.rfc,
    estatus_o_concepto: ticket.estatus,
    monto: null, // un ticket no tiene un monto propio — el monto real vive en su orden de compra, si tiene una vinculada
    fecha_registro: ticket.creado_en,
    atendido_por: ticket.actualizado_por,
    accion: 'eliminado',
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
    accion: 'eliminado',
  };
}

// Flujo real que corre cada hora (ver server.js): obtiene los tickets
// vencidos SIN borrarlos todavía, genera y envía (si hay correo
// configurado) UN reporte con esos tickets — y SOLO DESPUÉS de que el
// reporte ya quedó guardado, borra los tickets. Desde el punto 158 ya NO
// toca órdenes/gastos (se archivan al cierre mensual hacia Reportes).
// Si no hay nada vencido, no se genera ningún reporte.
async function ejecutarLimpiezaConReporte() {
  const { ticketsVencidos, retencionActiva, diasConfigurados } = await obtenerTicketsVencidos();

  let reporteId = null;
  let correoEnviado = false;
  let errorCorreo = null;

  if (ticketsVencidos.length > 0) {
    const items = ticketsVencidos.map(ticketAItemReporte);
    const fechas = items.map((i) => new Date(i.fecha_registro)).filter((f) => !Number.isNaN(f.getTime()));
    const rangoInicio = fechas.length ? new Date(Math.min(...fechas)) : null;
    const rangoFin = fechas.length ? new Date(Math.max(...fechas)) : null;

    try {
      const resultado = await generarYEnviarReporte({ tipo: 'automatico', items, rangoInicio, rangoFin });
      reporteId = resultado.reporteId;
      correoEnviado = resultado.correoEnviado;
      errorCorreo = resultado.errorCorreo;
    } catch (err) {
      console.error('No se pudo generar el reporte antes de la limpieza automática:', err);
    }
  }

  const eliminadosTickets = retencionActiva ? await eliminarTickets(ticketsVencidos) : 0;
  const eliminadosOrdenes = 0; // deprecated desde punto 158 — retención ya no borra órdenes

  return {
    eliminadosTickets,
    eliminadosOrdenes,
    retencionActiva,
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
  ordenAItemReporte,
  CLAVE_ULTIMA_LIMPIEZA_TICKETS,
  CLAVE_ULTIMA_LIMPIEZA_ORDENES,
};
