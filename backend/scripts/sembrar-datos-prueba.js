// Siembra datos de PRUEBA historicos en la base de datos por defecto
// (portal_facturacion): ventas (ordenes_compra), gastos y algunos tickets
// en estatus "listo" vinculados a ventas, cubriendo los ultimos ~5 meses
// completos mas el tranco del mes en curso hasta ayer. Sirve para validar
// reportes (Resumen financiero, Ventas, Gastos, tendencias) con historial.
//
// Caracteristicas:
// - Determinista (PRNG con semilla fija): dos corridas sobre una BD limpia
//   producen los mismos montos.
// - Transaccional: o se siembra todo o no se siembra nada.
// - Idempotente a su manera: se niega a correr si ya encuentra datos
//   sembrados (marcados por la nota "Dato de prueba" en gastos.notas).
// - Las fechas de venta usan fecha_compra = creado_en = fecha historica
//   real (con retencion >= 365 dias sobreviven sin problema).
// - Los tickets sembrados llevan SOLO placeholders de imagen (no hay
//   archivo en MinIO): abrir la imagen de esos tickets dara 404.
//
// Uso (dentro del contenedor backend):
//   node scripts/sembrar-datos-prueba.js
//
// Limpieza posterior (ver rangos impresos al final):
//   DELETE FROM ordenes_compra WHERE id BETWEEN <min> AND <max>;
//   DELETE FROM tickets       WHERE id BETWEEN <min> AND <max>;
//   DELETE FROM gastos        WHERE notas = '<NOTA_PRUEBA>';

const { pool } = require('../db');

const NOTA_PRUEBA = 'Dato de prueba (validacion de reportes)';
const SEMILLA_PRNG = 20260823;
const RFC_PRUEBA = 'XAXX010101000';

// PRNG determinista (mulberry32) — Math.random no sirve porque queremos
// poder reproducir la misma siembra tras una limpieza.
function crearPrng(semilla) {
  let a = semilla >>> 0;
  return function prng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const prng = crearPrng(SEMILLA_PRNG);
function azarEntre(min, max) {
  return min + prng() * (max - min);
}
function azarEntero(min, max) {
  return Math.floor(azarEntre(min, max + 1));
}
function elegir(lista) {
  return lista[azarEntero(0, lista.length - 1)];
}
function probabilidad(p) {
  return prng() < p;
}

function fechaUtc(anio, mesIndex, dia, hora, minuto) {
  return new Date(Date.UTC(anio, mesIndex, dia, hora, minuto, azarEntero(0, 59)));
}

const CONCEPTOS_VENTA = [
  'Suministro de equipo de cómputo',
  'Servicio de mantenimiento preventivo',
  'Refacción original',
  'Consumibles de oficina',
  'Instalación de red estructurada',
  'Licencia de software anual',
  'Cableado y conectores',
  'Equipo de videovigilancia',
  'Soporte técnico mensual',
  'Papelería personalizada',
  'Toners y cartuchos',
  'Mobiliario de oficina',
];

// Montos por nivel: la mayoría de ventas chicas, algunas grandes — para
// que KPIs, barras y proyección tengan forma realista.
function montoVenta() {
  const dado = prng();
  if (dado < 0.5) return azarEntre(800, 3000);
  if (dado < 0.8) return azarEntre(3000, 9000);
  if (dado < 0.95) return azarEntre(9000, 25000);
  return azarEntre(25000, 45000);
}

const GASTOS_FIJOS = [
  {
    categoria: 'renta',
    proveedor: 'Inmobiliaria Central',
    concepto: 'Renta mensual de oficinas',
    min: 14000,
    max: 16000,
    dia: () => azarEntero(2, 5),
    recurrente: true,
  },
  {
    categoria: 'nomina',
    proveedor: 'Prestaciones de personal',
    concepto: 'Nómina primera quincena',
    min: 26000,
    max: 32000,
    dia: () => azarEntero(14, 16),
    recurrente: true,
  },
  {
    categoria: 'nomina',
    proveedor: 'Prestaciones de personal',
    concepto: 'Nómina segunda quincena',
    min: 26000,
    max: 32000,
    dia: () => azarEntero(26, 28),
    recurrente: true,
  },
];

const GASTOS_VARIABLES = [
  { categoria: 'software', proveedores: ['Microsoft México', 'Adobe Systems', 'Autodesk'], concepto: 'Suscripción de software', min: 800, max: 4500, vecesMes: [1, 2], recurrente: true },
  { categoria: 'hosting', proveedores: ['AWS', 'DigitalOcean', 'Google Cloud'], concepto: 'Infraestructura y hosting', min: 400, max: 2600, vecesMes: [1, 2], recurrente: true },
  { categoria: 'servicios', proveedores: ['Telmex', 'CFE', 'Agua de Morelia'], concepto: 'Servicios básicos', min: 500, max: 3500, vecesMes: [1, 3], recurrente: true },
  { categoria: 'papeleria', proveedores: ['Office Depot', 'Imprenta Rápida', 'Lumen'], concepto: 'Papelería e insumos', min: 300, max: 2800, vecesMes: [1, 2], recurrente: false },
  { categoria: 'combustible', proveedores: ['Gasolinera Pemex', 'BP Morelia'], concepto: 'Combustible de unidades', min: 700, max: 3200, vecesMes: [1, 3], recurrente: false },
  { categoria: 'viaticos', proveedores: ['Uber', 'Hotel Vista Express', 'Aeroméxico'], concepto: 'Viáticos de visita a cliente', min: 900, max: 6500, vecesMes: [0, 2], recurrente: false },
  { categoria: 'publicidad', proveedores: ['Meta Ads', 'Google Ads'], concepto: 'Campaña digital', min: 1200, max: 8000, vecesMes: [0, 1], recurrente: false },
  { categoria: 'otro', proveedores: ['Fletes del Bajío', 'Varios SA de CV'], concepto: 'Gasto operativo varios', min: 200, max: 4000, vecesMes: [0, 2], recurrente: false },
];

async function principal() {
  // Salvaguarda: no duplicar siembras.
  const [[previo]] = await pool.query('SELECT COUNT(*) AS n FROM gastos WHERE notas = ?', [NOTA_PRUEBA]);
  if (previo.n > 0) {
    console.error(
      `Ya existen ${previo.n} gastos sembrados (notas = "${NOTA_PRUEBA}").` +
        '\nLimpia los datos de prueba antes de volver a sembrar (ver SQL de limpieza en PROJECT_STATE.md).'
    );
    process.exit(1);
  }

  const hoyUtc = new Date();
  const anioActual = hoyUtc.getUTCFullYear();
  const mesActual = hoyUtc.getUTCMonth();
  // Primer día del mes hace 5 meses (ventana de ~6 meses con el actual).
  const inicio = new Date(Date.UTC(anioActual, mesActual - 5, 1));
  const ayer = new Date(Date.UTC(anioActual, mesActual, hoyUtc.getUTCDate() - 1));

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    let contadorVentas = 0;
    let contadorTickets = 0;
    let contadorGastos = 0;
    let idMinVenta = null;
    let idMaxVenta = null;
    let idMinTicket = null;
    let idMaxTicket = null;

    const resumenPorMes = new Map();
    function acumularMes(llave, campo, monto) {
      if (!resumenPorMes.has(llave)) resumenPorMes.set(llave, { ventas: 0, tickets: 0, gastos: 0 });
      resumenPorMes.get(llave)[campo] += monto;
    }

    for (
      let d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));
      d <= ayer;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const anio = d.getUTCFullYear();
      const mes = d.getUTCMonth();
      const dia = d.getUTCDate();
      const diaSemana = d.getUTCDay(); // 0 domingo, 6 sábado
      const llaveMes = `${anio}-${String(mes + 1).padStart(2, '0')}`;

      // ---- Ventas: entre semana 0-3, sábado 0-1, domingo ninguna.
      let ventasDelDia = 0;
      if (diaSemana >= 1 && diaSemana <= 5) {
        ventasDelDia = probabilidad(0.72) ? azarEntero(1, 2) : azarEntero(0, 1);
        if (probabilidad(0.12)) ventasDelDia += 1;
      } else if (diaSemana === 6 && probabilidad(0.35)) {
        ventasDelDia = 1;
      }

      for (let v = 0; v < ventasDelDia; v += 1) {
        const cantidad = Math.round(montoVenta() * 100) / 100; // subtotal sin IVA
        const ivaPorcentaje = 16; // foto del valor vigente en configuracion_global
        const total = Math.round(cantidad * (1 + ivaPorcentaje / 100) * 100) / 100;
        const fechaCompra = fechaUtc(anio, mes, dia, azarEntero(9, 18), azarEntero(0, 59));

        const [resultadoVenta] = await conexion.query(
          `INSERT INTO ordenes_compra
             (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, eliminado_en, creado_en, actualizado_en)
           VALUES ('TEMP', ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
          [fechaCompra, elegir(CONCEPTOS_VENTA), cantidad, ivaPorcentaje, total, fechaCompra, fechaCompra]
        );
        const idVenta = resultadoVenta.insertId;
        await conexion.query('UPDATE ordenes_compra SET numero_compra = ? WHERE id = ?', [
          `OC-${String(idVenta).padStart(6, '0')}`,
          idVenta,
        ]);

        contadorVentas += 1;
        idMinVenta = idMinVenta === null ? idVenta : idMinVenta;
        idMaxVenta = idVenta;
        acumularMes(llaveMes, 'ventas', total);

        // ---- Ticket "listo" vinculado (~45% de las ventas): es lo que el
        // sistema cuenta como "Facturado" en Resumen financiero y Ventas.
        if (probabilidad(0.45)) {
          const fechaTicket = fechaUtc(anio, mes, dia, Math.min(fechaCompra.getUTCHours() + 2, 21), azarEntero(0, 59));
          const tipoPago = elegir(['efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito']);
          const [resultadoTicket] = await conexion.query(
            `INSERT INTO tickets
               (folio, rfc, uso_cfdi, tipo_pago, tipo_pago_otro, comentarios, orden_compra_id,
                imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
                estatus, factura_nombre_original, factura_nombre_guardado, factura_mime,
                notas_admin, actualizado_por, eliminado_en, creado_en, actualizado_en)
             VALUES ('TEMP', ?, NULL, ?, NULL, 'Ticket de prueba (siembra para validación de reportes).', ?,
                     'ticket-prueba.jpg', ?, 'image/jpeg', 102400,
                     'listo', NULL, NULL, NULL,
                     'Imagen placeholder: no hay archivo en MinIO.', 'admin', NULL, ?, ?)`,
            [RFC_PRUEBA, tipoPago, idVenta, `sembrado-ticket-${idVenta}.jpg`, fechaTicket, fechaTicket]
          );
          const idTicket = resultadoTicket.insertId;
          await conexion.query('UPDATE tickets SET folio = ? WHERE id = ?', [
            `TK-${String(idTicket).padStart(6, '0')}`,
            idTicket,
          ]);

          contadorTickets += 1;
          idMinTicket = idMinTicket === null ? idTicket : idMinTicket;
          idMaxTicket = idTicket;
          acumularMes(llaveMes, 'tickets', 1);
        }
      }

      // ---- Gastos fijos del mes (se registran cuando llega su día).
      for (const gastoFijo of GASTOS_FIJOS) {
        const diaGasto = gastoFijo.dia();
        if (dia !== diaGasto) continue;
        await sembrarGasto(conexion, {
          fecha: fechaUtc(anio, mes, dia, azarEntero(9, 17), azarEntero(0, 59)),
          concepto: gastoFijo.concepto,
          proveedor: gastoFijo.proveedor,
          categoria: gastoFijo.categoria,
          monto: azarEntre(gastoFijo.min, gastoFijo.max),
          recurrente: gastoFijo.recurrente,
        });
        contadorGastos += 1;
        acumularMes(llaveMes, 'gastos', 1);
      }

      // ---- Gastos variables: el día 7 de cada mes se decide cuántos y
      // cuáles entran ese mes (fechas repartidas al azar del mes).
      if (dia === 7) {
        for (const variable of GASTOS_VARIABLES) {
          const veces = azarEntero(variable.vecesMes[0], variable.vecesMes[1]);
          for (let i = 0; i < veces; i += 1) {
            await sembrarGasto(conexion, {
              fecha: fechaUtc(anio, mes, azarEntero(1, 28), azarEntero(9, 19), azarEntero(0, 59)),
              concepto: variable.concepto,
              proveedor: elegir(variable.proveedores),
              categoria: variable.categoria,
              monto: azarEntre(variable.min, variable.max),
              recurrente: variable.recurrente,
            });
            contadorGastos += 1;
            acumularMes(`${anio}-${String(mes + 1).padStart(2, '0')}`, 'gastos', 1);
          }
        }
      }
    }

    await conexion.commit();

    console.log('Siembra completada.');
    console.log(`  Ventas  (ordenes_compra): ${contadorVentas}  (ids ${idMinVenta}..${idMaxVenta})`);
    console.log(`  Tickets (estatus listo):  ${contadorTickets}  (ids ${idMinTicket}..${idMaxTicket})`);
    console.log(`  Gastos:                   ${contadorGastos}`);
    console.log('');
    console.log('Resumen por mes (YYYY-MM | ventas MXN | tickets | gastos capturados):');
    for (const llave of [...resumenPorMes.keys()].sort()) {
      const fila = resumenPorMes.get(llave);
      console.log(`  ${llave} | ${fila.ventas.toFixed(2).padStart(12)} | ${String(fila.tickets).padStart(4)} | ${fila.gastos}`);
    }
    console.log('');
    console.log('SQL de limpieza (cuando ya no necesites estos datos):');
    console.log(`  DELETE FROM ordenes_compra WHERE id BETWEEN ${idMinVenta} AND ${idMaxVenta};`);
    console.log(`  DELETE FROM tickets WHERE id BETWEEN ${idMinTicket} AND ${idMaxTicket};`);
    console.log(`  DELETE FROM gastos WHERE notas = '${NOTA_PRUEBA}';`);
    console.log('');
    console.log('Nota: los tickets sembrados NO tienen imagen en MinIO (placeholder).');
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function sembrarGasto(conexion, { fecha, concepto, proveedor, categoria, monto, recurrente }) {
  const montoRedondeado = Math.round(monto * 100) / 100;
  const tieneFactura = probabilidad(0.7);
  await conexion.query(
    `INSERT INTO gastos
       (fecha, concepto, proveedor, categoria, monto, iva_incluido, tiene_factura,
        comprobante_nombre_original, comprobante_nombre_guardado, comprobante_mime,
        recurrente, notas, creado_por, eliminado_en, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 'admin', NULL, ?, ?)`,
    [
      fecha.toISOString().slice(0, 10),
      concepto,
      proveedor,
      categoria,
      montoRedondeado,
      probabilidad(0.55) ? 1 : 0,
      tieneFactura ? 1 : 0,
      recurrente ? 1 : 0,
      NOTA_PRUEBA,
      fecha,
      fecha,
    ]
  );
}

principal()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('La siembra falló, se hizo rollback completo:', error);
    process.exit(1);
  });
