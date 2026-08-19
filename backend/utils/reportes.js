const { pool } = require('../db');
const { getConfiguracionGlobal, formatearFechaHoraMexico } = require('./config');
const { enviarCorreo } = require('./email');

// Este módulo es el motor central de "Reportes": arma el contenido en
// Markdown, guarda los datos estructurados para poder filtrarlos/
// exportarlos después desde "Lectura de reportes", y manda el correo si
// hay uno configurado. Se usa desde DOS lugares distintos:
//   1. ticketsCleanup.js, justo ANTES de que el borrado automático por
//      retención elimine tickets/órdenes vencidos — para no perder esa
//      información para siempre.
//   2. El botón "Enviar reporte" del panel (envío manual, bajo demanda).
// En ambos casos el "item" de cada ticket/orden capturado tiene la MISMA
// forma, para no tener que mantener dos formatos distintos de reporte.

function formatearMonto(valor) {
  if (valor === null || valor === undefined) return '—';
  return `$${Number(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// El pool de MySQL de este proyecto usa `dateStrings: true` (ver db.js),
// así que una columna DATETIME llega aquí como texto plano
// ("2026-07-28 10:00:00"), NO como un objeto Date — pasar ese texto
// directamente a formatearFechaHoraMexico() (que internamente usa
// Intl.DateTimeFormat, el cual espera un Date/timestamp, no un string)
// lanza "RangeError: Invalid time value". Esta función convierte de
// forma seguro cualquiera de los dos casos (ya sea que llegue como
// string o ya como Date) a un Date real antes de formatear — mismo
// patrón (reemplazar el espacio por "T" y agregar "Z" para forzar UTC)
// que ya se usa en otras partes de este proyecto para el mismo problema.
function aFechaSegura(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const fecha = new Date(`${String(valor).replace(' ', 'T')}Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function escaparCeldaMD(valor) {
  // Un "|" sin escapar dentro de una celda rompe la tabla de Markdown —
  // se reemplaza por su entidad, y los saltos de línea (ej. en notas
  // largas) se aplanan a un espacio para no partir la fila.
  return String(valor === null || valor === undefined ? '—' : valor)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim() || '—';
}

/**
 * Arma el contenido completo del reporte en Markdown a partir de la
 * lista de items ya capturados (tickets y órdenes de compra mezclados,
 * cada uno con su "tipo_registro"). `fechaGeneracion` es un objeto Date
 * — se le da formato con la zona horaria configurada actualmente, para
 * que el reporte diga exactamente cuándo se generó, en la misma zona
 * horaria que usa el resto de la app.
 */
function generarContenidoMD({ tipo, fechaGeneracion, rangoInicio, rangoFin, items, zonaHoraria }) {
  const fechaGeneracionFormateada = formatearFechaHoraMexico(aFechaSegura(fechaGeneracion) || new Date(), zonaHoraria);
  const tickets = items.filter((i) => i.tipo_registro === 'ticket');
  const ordenes = items.filter((i) => i.tipo_registro === 'orden_compra');
  const tipoTexto = tipo === 'automatico' ? 'Automático (antes de borrado por retención)' : 'Manual';

  const lineas = [];
  lineas.push(`# Reporte de tickets y órdenes de compra`);
  lineas.push('');
  lineas.push(`**Tipo de reporte:** ${tipoTexto}`);
  lineas.push(`**Fecha y hora de generación:** ${fechaGeneracionFormateada.fecha} ${fechaGeneracionFormateada.hora}`);
  const rangoInicioSeguro = aFechaSegura(rangoInicio);
  const rangoFinSeguro = aFechaSegura(rangoFin);
  if (rangoInicioSeguro && rangoFinSeguro) {
    const inicioFormateado = formatearFechaHoraMexico(rangoInicioSeguro, zonaHoraria);
    const finFormateado = formatearFechaHoraMexico(rangoFinSeguro, zonaHoraria);
    lineas.push(`**Rango cubierto:** ${inicioFormateado.fecha} — ${finFormateado.fecha}`);
  }
  lineas.push('');
  lineas.push(`## Resumen`);
  lineas.push('');
  lineas.push(`- **Tickets:** ${tickets.length}`);
  lineas.push(`- **Órdenes de compra:** ${ordenes.length}`);
  lineas.push(`- **Total de registros:** ${items.length}`);
  lineas.push('');

  lineas.push(`## Tickets (${tickets.length})`);
  lineas.push('');
  if (tickets.length === 0) {
    lineas.push('_Sin tickets en este reporte._');
  } else {
    lineas.push('| Folio | RFC | Estatus | Atendido por | Fecha de creación |');
    lineas.push('|---|---|---|---|---|');
    tickets.forEach((t) => {
      const fechaSegura = aFechaSegura(t.fecha_registro);
      const fechaFormateada = fechaSegura ? formatearFechaHoraMexico(fechaSegura, zonaHoraria) : null;
      lineas.push(
        `| ${escaparCeldaMD(t.identificador)} | ${escaparCeldaMD(t.rfc)} | ${escaparCeldaMD(t.estatus_o_concepto)} | ${escaparCeldaMD(
          t.atendido_por
        )} | ${fechaFormateada ? `${fechaFormateada.fecha} ${fechaFormateada.hora}` : '—'} |`
      );
    });
  }
  lineas.push('');

  lineas.push(`## Órdenes de compra (${ordenes.length})`);
  lineas.push('');
  if (ordenes.length === 0) {
    lineas.push('_Sin órdenes de compra en este reporte._');
  } else {
    lineas.push('| No. Compra | RFC | Concepto | Total | Fecha de compra |');
    lineas.push('|---|---|---|---|---|');
    ordenes.forEach((o) => {
      const fechaSegura = aFechaSegura(o.fecha_registro);
      const fechaFormateada = fechaSegura ? formatearFechaHoraMexico(fechaSegura, zonaHoraria) : null;
      lineas.push(
        `| ${escaparCeldaMD(o.identificador)} | ${escaparCeldaMD(o.rfc)} | ${escaparCeldaMD(o.estatus_o_concepto)} | ${formatearMonto(
          o.monto
        )} | ${fechaFormateada ? `${fechaFormateada.fecha} ${fechaFormateada.hora}` : '—'} |`
      );
    });
  }
  lineas.push('');

  return lineas.join('\n');
}

/**
 * Guarda el reporte (metadatos + Markdown en `reportes`, y cada item en
 * `reporte_items`) y devuelve el id insertado. No manda ningún correo —
 * eso lo hace generarYEnviarReporte(), que es la función que de verdad
 * se llama desde fuera de este módulo.
 */
async function guardarReporte({ tipo, fechaGeneracion, rangoInicio, rangoFin, items, mdContenido, correoEnviadoA, correoEnviado }) {
  const tickets = items.filter((i) => i.tipo_registro === 'ticket');
  const ordenes = items.filter((i) => i.tipo_registro === 'orden_compra');

  const [resultado] = await pool.query(
    `INSERT INTO reportes
      (tipo, fecha_generacion, rango_inicio, rango_fin, correo_enviado_a, correo_enviado, total_tickets, total_ordenes, md_contenido, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tipo,
      fechaGeneracion,
      rangoInicio || null,
      rangoFin || null,
      correoEnviadoA || null,
      correoEnviado ? 1 : 0,
      tickets.length,
      ordenes.length,
      mdContenido,
      fechaGeneracion,
    ]
  );
  const reporteId = resultado.insertId;

  if (items.length > 0) {
    const valores = items.map((item) => [
      reporteId,
      item.tipo_registro,
      item.identificador,
      item.rfc || null,
      item.estatus_o_concepto || null,
      item.monto === undefined ? null : item.monto,
      item.fecha_registro || null,
      item.atendido_por || null,
      item.accion || null,
      fechaGeneracion,
    ]);
    await pool.query(
      `INSERT INTO reporte_items
        (reporte_id, tipo_registro, identificador, rfc, estatus_o_concepto, monto, fecha_registro, atendido_por, accion, creado_en)
       VALUES ?`,
      [valores]
    );
  }

  return reporteId;
}

/**
 * Punto de entrada único: arma el Markdown, lo guarda (con sus items
 * estructurados), y manda el correo SI hay uno configurado — sin
 * "correo_reportes" configurado, el reporte igual se genera y se guarda
 * (para poder verlo en "Lectura de reportes" o descargarlo después), solo
 * que no se manda nada por correo. Un error al enviar el correo NO
 * impide que el reporte se haya guardado — se reporta aparte, para que
 * quien llame a esta función (ej. la limpieza automática) decida si debe
 * detener el borrado o no.
 */
async function generarYEnviarReporte({ tipo, items, rangoInicio, rangoFin }) {
  const configGlobal = await getConfiguracionGlobal();
  const fechaGeneracion = new Date();

  const mdContenido = generarContenidoMD({
    tipo,
    fechaGeneracion,
    rangoInicio,
    rangoFin,
    items,
    zonaHoraria: configGlobal.zona_horaria,
  });

  const correoDestino = configGlobal.correo_reportes;
  let correoEnviado = false;
  let errorCorreo = null;

  if (correoDestino) {
    try {
      const fechaGeneracionFormateada = formatearFechaHoraMexico(fechaGeneracion, configGlobal.zona_horaria);
      await enviarCorreo({
        destinatario: correoDestino,
        asunto: `Reporte de tickets y órdenes de compra — ${fechaGeneracionFormateada.fecha}`,
        cuerpo: `Se adjunta el reporte generado el ${fechaGeneracionFormateada.fecha} a las ${fechaGeneracionFormateada.hora}.\n\nTickets: ${
          items.filter((i) => i.tipo_registro === 'ticket').length
        }\nÓrdenes de compra: ${items.filter((i) => i.tipo_registro === 'orden_compra').length}`,
        adjuntos: [
          {
            filename: `reporte-${fechaGeneracion.toISOString().slice(0, 10)}.md`,
            content: mdContenido,
            contentType: 'text/markdown',
          },
        ],
      });
      correoEnviado = true;
    } catch (err) {
      errorCorreo = err.message;
    }
  }

  const reporteId = await guardarReporte({
    tipo,
    fechaGeneracion,
    rangoInicio,
    rangoFin,
    items,
    mdContenido,
    correoEnviadoA: correoDestino || null,
    correoEnviado,
  });

  return { reporteId, mdContenido, correoEnviado, errorCorreo, correoDestino: correoDestino || null };
}

const ExcelJS = require('exceljs');

function escaparCeldaCSV(valor) {
  const texto = String(valor === null || valor === undefined ? '' : valor);
  // Regla estándar de CSV: si el valor trae coma, comillas o salto de
  // línea, se envuelve entre comillas dobles, y cualquier comilla doble
  // que ya traiga el texto se duplica (escape estándar de CSV).
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

const ENCABEZADOS_EXPORTACION = ['Tipo', 'Identificador', 'RFC / Correo', 'Estatus', 'Monto', 'Atendido por', 'Fecha de registro', 'Acción'];

function itemsAFilas(items, zonaHoraria) {
  return items.map((item) => {
    const fechaSegura = aFechaSegura(item.fecha_registro);
    const fechaFormateada = fechaSegura ? formatearFechaHoraMexico(fechaSegura, zonaHoraria) : null;
    return [
      item.tipo_registro === 'ticket' ? 'Ticket' : 'Orden de compra',
      item.identificador,
      item.rfc || '',
      item.estatus_o_concepto || '',
      item.monto === null || item.monto === undefined ? '' : Number(item.monto),
      item.atendido_por || '',
      fechaFormateada ? `${fechaFormateada.fecha} ${fechaFormateada.hora}` : '',
      item.accion === 'eliminado' ? 'Eliminado' : '',
    ];
  });
}

/**
 * Genera el contenido de un archivo CSV (como texto) a partir de una
 * lista de items de reporte — usado por el botón "Exportar a CSV" de
 * "Lectura de reportes".
 */
function generarCSV(items, zonaHoraria) {
  const filas = [ENCABEZADOS_EXPORTACION, ...itemsAFilas(items, zonaHoraria)];
  // "\uFEFF" (BOM) al inicio para que Excel en Windows detecte UTF-8
  // automáticamente y no muestre acentos/eñes corrompidos al abrir el
  // CSV directamente — un problema real y común de Excel con CSV sin BOM.
  return '\uFEFF' + filas.map((fila) => fila.map(escaparCeldaCSV).join(',')).join('\r\n');
}

/**
 * Genera un archivo .xlsx real (no un CSV disfrazado) a partir de una
 * lista de items de reporte — usado por el botón "Exportar a Excel".
 * Devuelve un Buffer listo para mandar como respuesta HTTP.
 */
async function generarExcelBuffer(items, zonaHoraria) {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet('Reporte');

  // Ancho extra para la columna "Estatus" — sigue haciendo falta aunque
  // se haya renombrado, ya que esta misma columna también guarda el
  // concepto (texto libre, potencialmente largo) de una orden de
  // compra, no solo el estatus corto de un ticket.
  hoja.columns = ENCABEZADOS_EXPORTACION.map((titulo) => ({ header: titulo, width: titulo === 'Estatus' ? 32 : 20 }));
  hoja.getRow(1).font = { bold: true };

  itemsAFilas(items, zonaHoraria).forEach((fila) => hoja.addRow(fila));

  // La columna de Monto se le da formato de moneda solo en las filas que
  // de verdad traen un número (las de tipo "Ticket" se quedan vacías).
  hoja.getColumn(5).numFmt = '$#,##0.00';

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  generarContenidoMD,
  guardarReporte,
  generarYEnviarReporte,
  generarCSV,
  generarExcelBuffer,
  aFechaSegura,
};
