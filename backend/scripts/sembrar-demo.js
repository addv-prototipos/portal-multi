// Script de demo unificado: BORRA los datos transaccionales de la base SIN
// tenant (portal_facturacion) y vuelve a sembrar ~6 meses de historia
// realista (ventas, tickets, gastos, inventario con movimientos y CxC).
//
// Reemplaza a scripts/sembrar-datos-prueba.js y scripts/poblar-tony.js —
// ambos hacían siembras parecidas pero sin borrar antes ni tocar
// inventario a la vez, lo que dejaba dos fuentes de verdad distintas para
// la misma tarea. Este es el único script de demo desde ahora.
//
// QUÉ BORRA (todo lo transaccional/de negocio):
//   registros, tickets, ordenes_compra, orden_productos, gastos,
//   movimientos_inventario, existencias, productos, reportes,
//   reporte_items, imp_importaciones, imp_importacion_errores.
// QUÉ CONSERVA (configuración — nunca se toca):
//   configuracion, usuarios, categorias_gastos, categorias_inventario,
//   unidades_medida, conversiones_unidad, almacenes, inv_perfiles_mapeo,
//   preferencias_dashboard.
//
// Requiere el flag --confirmar explícito (es DESTRUCTIVO e irreversible
// sin backup). Determinista (PRNG con semilla fija): correrlo dos veces
// seguidas produce exactamente los mismos datos.
//
// Uso (dentro del contenedor backend):
//   node scripts/sembrar-demo.js --confirmar
//
// Dos registros (constancias) quedan listos para pruebas manuales de
// correo real en el navegador — ver RFC_DEMO_PRINCIPAL/RFC_DEMO_SECUNDARIO
// abajo. Ninguna fila de esta siembra dispara un correo real (son INSERT
// directos a la base, no pasan por los endpoints) — solo dejan datos
// limpios para que tú dispares esos correos a mano después.

const { pool } = require('../db');

const NOTA_PRUEBA = 'Dato de demo (sembrar-demo.js)';
const SEMILLA_PRNG = 20240401;
const RFC_DEMO_PRINCIPAL = 'XAXX010101000';
const EMAIL_DEMO_PRINCIPAL = 'aprado13@gmail.com';
const RFC_DEMO_SECUNDARIO = 'XEXX010101000';
const EMAIL_DEMO_SECUNDARIO = 'aprado13+demo2@gmail.com';

const TABLAS_A_BORRAR = [
  'reporte_items',
  'reportes',
  'imp_importacion_errores',
  'imp_importaciones',
  'movimientos_inventario',
  'existencias',
  'productos',
  'orden_productos',
  'tickets',
  'ordenes_compra',
  'gastos',
  'registros',
  'inv_idempotencia',
];

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
function azarEntre(min, max) { return min + prng() * (max - min); }
function azarEntero(min, max) { return Math.floor(azarEntre(min, max + 1)); }
function elegir(lista) { return lista[azarEntero(0, lista.length - 1)]; }
function probabilidad(p) { return prng() < p; }
function fechaUtc(anio, mesIndex, dia, hora, minuto) {
  return new Date(Date.UTC(anio, mesIndex, dia, hora, minuto, azarEntero(0, 59)));
}

// Selección ponderada: los productos con peso 0 NUNCA se venden (dead
// stock real, no solo "poco probable") — quedan fuera del acumulado.
function elegirPonderado(items) {
  const conPeso = items.filter((it) => it.peso > 0);
  const total = conPeso.reduce((acc, it) => acc + it.peso, 0);
  let r = prng() * total;
  for (const it of conPeso) {
    r -= it.peso;
    if (r <= 0) return it;
  }
  return conPeso[conPeso.length - 1];
}

const CONCEPTOS_VENTA = [
  'Suministro de equipo de cómputo', 'Servicio de mantenimiento preventivo', 'Refacción original',
  'Consumibles de oficina', 'Instalación de red estructurada', 'Licencia de software anual',
  'Cableado y conectores', 'Equipo de videovigilancia', 'Soporte técnico mensual',
  'Papelería personalizada', 'Toners y cartuchos', 'Mobiliario de oficina',
];

// La mayoría de ventas chicas/medianas, algunas grandes — para que KPIs,
// barras y proyección tengan forma realista (no una línea plana).
function montoVenta() {
  const dado = prng();
  if (dado < 0.5) return azarEntre(800, 3000);
  if (dado < 0.8) return azarEntre(3000, 9000);
  if (dado < 0.95) return azarEntre(9000, 25000);
  return azarEntre(25000, 45000);
}

// 12 productos con "peso" de popularidad — deliberadamente desparejo para
// que existan un top-5 y un bottom-5 claros en la gráfica "Más vendido y
// menos movido" (D9 del segmento nuevo). peso=0 => nunca se vende (dead
// stock real). Distribuidos en 4 categorías para que "Valor por categoría"
// no salga con una sola rebanada dominando todo.
const CATALOGO = [
  { sku: 'PROD-TON-002', nombre: 'Tóner HP Negro',            categoria: 'Consumibles', costo: 950,  precio: 1450, stock: 220, peso: 30 },
  { sku: 'PROD-PAP-007', nombre: 'Papel A4 caja 10 rec',      categoria: 'Consumibles', costo: 850,  precio: 1150, stock: 260, peso: 25 },
  { sku: 'PROD-CAB-003', nombre: 'Cable UTP Cat6 305m',       categoria: 'Electrónica', costo: 1200, precio: 1850, stock: 70,  peso: 18 },
  { sku: 'PROD-EXT-008', nombre: 'Disco SSD 1TB',              categoria: 'Cómputo',     costo: 1650, precio: 2400, stock: 90,  peso: 12 },
  { sku: 'PROD-TEC-012', nombre: 'Teclado inalámbrico',        categoria: 'Cómputo',     costo: 480,  precio: 750,  stock: 130, peso: 10 },
  { sku: 'PROD-MON-005', nombre: 'Monitor 24" FHD',            categoria: 'Cómputo',     costo: 2800, precio: 3900, stock: 45,  peso: 8 },
  { sku: 'PROD-LAP-001', nombre: 'Laptop Lenovo 15"',          categoria: 'Cómputo',     costo: 18500,precio: 23500,stock: 25,  peso: 5 },
  { sku: 'PROD-SIL-004', nombre: 'Silla ergonómica',           categoria: 'Mobiliario',  costo: 2100, precio: 3200, stock: 35,  peso: 1 },
  { sku: 'PROD-IMP-006', nombre: 'Impresora multifuncional',   categoria: 'Cómputo',     costo: 4200, precio: 5900, stock: 20,  peso: 1 },
  { sku: 'PROD-UPS-011', nombre: 'UPS 1500VA',                 categoria: 'Electrónica', costo: 3100, precio: 4400, stock: 50,  peso: 0.3 },
  { sku: 'PROD-RUT-009', nombre: 'Router empresarial',         categoria: 'Electrónica', costo: 3600, precio: 5200, stock: 40,  peso: 0 },
  { sku: 'PROD-ESC-010', nombre: 'Escáner de mesa',            categoria: 'Cómputo',     costo: 2900, precio: 4100, stock: 30,  peso: 0 },
];

const GASTOS_FIJOS = [
  { categoria: 'renta', proveedor: 'Inmobiliaria Central', concepto: 'Renta mensual de oficinas', min: 15000, max: 17000, dia: () => azarEntero(2, 5), recurrente: true },
  { categoria: 'nomina', proveedor: 'Prestaciones de personal', concepto: 'Nómina primera quincena', min: 32000, max: 38000, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Prestaciones de personal', concepto: 'Nómina segunda quincena', min: 32000, max: 38000, dia: () => azarEntero(26, 28), recurrente: true },
];

const GASTOS_VARIABLES = [
  { categoria: 'software', proveedores: ['Microsoft México', 'Adobe Systems', 'Autodesk'], concepto: 'Suscripción de software', min: 800, max: 4500, vecesMes: [1, 2], recurrente: true },
  { categoria: 'hosting', proveedores: ['AWS', 'DigitalOcean', 'Google Cloud'], concepto: 'Infraestructura y hosting', min: 400, max: 2600, vecesMes: [1, 2], recurrente: true },
  { categoria: 'servicios', proveedores: ['Telmex', 'CFE', 'Agua de Morelia'], concepto: 'Servicios básicos', min: 500, max: 3500, vecesMes: [1, 3], recurrente: true },
  { categoria: 'papeleria', proveedores: ['Office Depot', 'Imprenta Rápida', 'Lumen'], concepto: 'Papelería e insumos', min: 300, max: 2800, vecesMes: [1, 2], recurrente: false },
  { categoria: 'combustible', proveedores: ['Gasolinera Pemex', 'BP Morelia'], concepto: 'Combustible de unidades', min: 700, max: 3200, vecesMes: [1, 3], recurrente: false },
  { categoria: 'viaticos', proveedores: ['Uber', 'Hotel Vista Express', 'Aeroméxico'], concepto: 'Viáticos de visita a cliente', min: 900, max: 4000, vecesMes: [0, 2], recurrente: false },
  { categoria: 'publicidad', proveedores: ['Meta Ads', 'Google Ads'], concepto: 'Campaña digital', min: 1200, max: 5000, vecesMes: [0, 1], recurrente: false },
  { categoria: 'otro', proveedores: ['Fletes del Bajío', 'Varios SA de CV'], concepto: 'Gasto operativo varios', min: 200, max: 2500, vecesMes: [0, 2], recurrente: false },
];

async function borrarDatosTransaccionales() {
  console.log('Borrando datos transaccionales de portal_facturacion (config/usuarios NO se tocan)...');
  for (const tabla of TABLAS_A_BORRAR) {
    const [r] = await pool.query(`DELETE FROM ${tabla}`);
    console.log(`  ${tabla}: ${r.affectedRows} filas borradas`);
  }
  for (const tabla of TABLAS_A_BORRAR) {
    if (tabla === 'inv_idempotencia') continue; // sin AUTO_INCREMENT relevante para folios
    await pool.query(`ALTER TABLE ${tabla} AUTO_INCREMENT = 1`);
  }
  console.log('AUTO_INCREMENT reiniciado (folios OC-000001 / TK-000001 / etc. arrancan limpios).\n');
}

async function sembrarRegistrosDemo(conexion, ahora) {
  await conexion.query(
    `INSERT INTO registros
       (nombre, tipo_persona, rfc, email, archivo_nombre_original, archivo_nombre_guardado,
        archivo_mime, archivo_tamano_bytes, regimen_fiscal, codigo_postal, uso_cfdi,
        eliminado_en, creado_en, actualizado_en)
     VALUES (?, 'fisica', ?, ?, 'constancia-demo.pdf', 'constancia-demo-placeholder.pdf',
             'application/pdf', 51200, NULL, NULL, NULL, NULL, ?, ?)`,
    ['Cliente Demo Principal', RFC_DEMO_PRINCIPAL, EMAIL_DEMO_PRINCIPAL, ahora, ahora]
  );
  await conexion.query(
    `INSERT INTO registros
       (nombre, tipo_persona, rfc, email, archivo_nombre_original, archivo_nombre_guardado,
        archivo_mime, archivo_tamano_bytes, regimen_fiscal, codigo_postal, uso_cfdi,
        eliminado_en, creado_en, actualizado_en)
     VALUES (?, 'fisica', ?, ?, 'constancia-demo.pdf', 'constancia-demo-placeholder-2.pdf',
             'application/pdf', 51200, NULL, NULL, NULL, NULL, ?, ?)`,
    ['Cliente Demo Secundario', RFC_DEMO_SECUNDARIO, EMAIL_DEMO_SECUNDARIO, ahora, ahora]
  );
  console.log(`Registros demo listos para pruebas manuales de correo real:`);
  console.log(`  RFC ${RFC_DEMO_PRINCIPAL} -> ${EMAIL_DEMO_PRINCIPAL} (con historial de ventas/tickets)`);
  console.log(`  RFC ${RFC_DEMO_SECUNDARIO} -> ${EMAIL_DEMO_SECUNDARIO} (limpio, sin historial)`);
  console.log('  NOTA: ninguna de las 2 constancias tiene archivo real en MinIO (placeholder) — descargarla dará 404.\n');
}

async function sembrarCatalogoYExistencias(conexion, fechaInicial) {
  const [[unidadPieza]] = await conexion.query("SELECT id FROM unidades_medida WHERE nombre = 'Pieza' LIMIT 1");
  const [[almacen]] = await conexion.query("SELECT id FROM almacenes WHERE codigo = 'ALM-1' LIMIT 1");
  const almacenId = almacen.id;

  const categoriasNombres = [...new Set(CATALOGO.map((p) => p.categoria))];
  const categoriaIdPorNombre = new Map();
  for (const nombre of categoriasNombres) {
    const slug = nombre.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
    const [[existente]] = await conexion.query('SELECT id FROM categorias_inventario WHERE slug = ? LIMIT 1', [slug]);
    if (existente) {
      categoriaIdPorNombre.set(nombre, existente.id);
    } else {
      const [r] = await conexion.query(
        'INSERT INTO categorias_inventario (slug, nombre, activa, orden, creado_en, actualizado_en) VALUES (?, ?, 1, 999, ?, ?)',
        [slug, nombre, new Date(), new Date()]
      );
      categoriaIdPorNombre.set(nombre, r.insertId);
    }
  }

  const productos = [];
  for (const p of CATALOGO) {
    const [r] = await conexion.query(
      `INSERT INTO productos
         (sku, codigo_barras, nombre, categoria_id, unidad_id, tipo, costo, costo_promedio, ultimo_costo,
          precio, stock_minimo, stock_maximo, punto_reorden, estado, proveedor_principal, moneda,
          eliminado_en, creado_en, actualizado_en)
       VALUES (?, NULL, ?, ?, ?, 'producto', ?, ?, ?, ?, ?, ?, ?, 'activo', ?, 'MXN', NULL, ?, ?)`,
      [p.sku, p.nombre, categoriaIdPorNombre.get(p.categoria), unidadPieza.id, p.costo, p.costo, p.costo,
        p.precio, Math.round(p.stock * 0.1), p.stock * 4, Math.round(p.stock * 0.2), `Proveedor ${p.sku}`,
        fechaInicial, fechaInicial]
    );
    const productoId = r.insertId;

    await conexion.query('INSERT INTO existencias (producto_id, almacen_id, disponible, actualizado_en) VALUES (?, ?, 0, ?)', [
      productoId, almacenId, fechaInicial,
    ]);
    const [insMov] = await conexion.query(
      `INSERT INTO movimientos_inventario
         (folio, producto_id, almacen_id, tipo, cantidad, costo_unitario, existencia_anterior, existencia_posterior,
          motivo, usuario, creado_en)
       VALUES (NULL, ?, ?, 'inventario_inicial', ?, ?, 0, ?, 'Stock inicial (siembra demo)', 'admin', ?)`,
      [productoId, almacenId, p.stock, p.costo, p.stock, fechaInicial]
    );
    await conexion.query('UPDATE movimientos_inventario SET folio = ? WHERE id = ?', [
      `EN-${String(insMov.insertId).padStart(6, '0')}`, insMov.insertId,
    ]);
    await conexion.query('UPDATE existencias SET disponible = ? WHERE producto_id = ? AND almacen_id = ?', [
      p.stock, productoId, almacenId,
    ]);

    productos.push({ ...p, id: productoId });
  }
  console.log(`Catálogo sembrado: ${productos.length} productos, ${categoriasNombres.length} categorías, almacén ${almacenId}.\n`);
  return { productos, almacenId };
}

async function registrarSalidaVenta(conexion, { producto, almacenId, cantidad, numeroCompra, fecha }) {
  const [[exRow]] = await conexion.query(
    'SELECT disponible FROM existencias WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
    [producto.id, almacenId]
  );
  const anterior = Number(exRow.disponible);
  // La siembra nunca debe generar negativos: si el stock ya no alcanza,
  // se limita la cantidad vendida a lo disponible (mínimo 1).
  const cantidadReal = Math.min(cantidad, Math.max(anterior, 1));
  const posterior = anterior - cantidadReal;
  const [insMov] = await conexion.query(
    `INSERT INTO movimientos_inventario
       (folio, producto_id, almacen_id, tipo, cantidad, costo_unitario, existencia_anterior, existencia_posterior,
        documento_origen, usuario, creado_en)
     VALUES (NULL, ?, ?, 'venta', ?, NULL, ?, ?, ?, 'admin', ?)`,
    [producto.id, almacenId, cantidadReal, anterior, posterior, numeroCompra, fecha]
  );
  await conexion.query('UPDATE movimientos_inventario SET folio = ? WHERE id = ?', [
    `SA-${String(insMov.insertId).padStart(6, '0')}`, insMov.insertId,
  ]);
  await conexion.query('UPDATE existencias SET disponible = ?, actualizado_en = ? WHERE producto_id = ? AND almacen_id = ?', [
    posterior, fecha, producto.id, almacenId,
  ]);
  return cantidadReal;
}

async function sembrarGasto(conexion, { fecha, concepto, proveedor, categoria, monto, recurrente }) {
  const montoRedondeado = Math.round(monto * 100) / 100;
  await conexion.query(
    `INSERT INTO gastos
       (fecha, concepto, proveedor, categoria, monto, iva_incluido, tiene_factura,
        comprobante_nombre_original, comprobante_nombre_guardado, comprobante_mime,
        recurrente, notas, creado_por, eliminado_en, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 'admin', NULL, ?, ?)`,
    [fecha.toISOString().slice(0, 10), concepto, proveedor, categoria, montoRedondeado,
      probabilidad(0.55) ? 1 : 0, probabilidad(0.7) ? 1 : 0, recurrente ? 1 : 0, NOTA_PRUEBA, fecha, fecha]
  );
}

async function principal() {
  const confirmar = process.argv.includes('--confirmar');
  if (!confirmar) {
    console.error('Este script BORRA todos los datos de ventas/inventario/gastos/tickets/constancias');
    console.error('de portal_facturacion (config y usuarios NO se tocan) y vuelve a sembrar todo.');
    console.error('Es irreversible sin backup. Vuelve a correr con --confirmar si es lo que quieres:');
    console.error('  node scripts/sembrar-demo.js --confirmar');
    process.exit(1);
  }

  await borrarDatosTransaccionales();

  const hoyUtc = new Date();
  const anioActual = hoyUtc.getUTCFullYear();
  const mesActual = hoyUtc.getUTCMonth();
  const inicio = new Date(Date.UTC(anioActual, mesActual - 6, 1));
  // El mes EN CURSO se deja completamente vacío a propósito — se registra
  // a mano (pedido explícito del usuario) para probar el flujo real, no
  // datos sembrados. `Date.UTC(anio, mesActual, 0)` = día 0 del mes
  // actual = último día del mes ANTERIOR, sin importar cuántos días
  // lleve corriendo el mes actual.
  const finMesAnterior = new Date(Date.UTC(anioActual, mesActual, 0));
  const fechaInicial = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate(), 9, 0, 0));

  const conexion = await pool.getConnection();
  try {
    await sembrarRegistrosDemo(conexion, fechaInicial);
    const { productos, almacenId } = await sembrarCatalogoYExistencias(conexion, fechaInicial);

    await conexion.beginTransaction();

    let contadorVentas = 0;
    let contadorTickets = 0;
    let contadorGastos = 0;
    let contadorLineasInventario = 0;
    const resumenPorMes = new Map();
    function acumularMes(llave, campo, monto) {
      if (!resumenPorMes.has(llave)) resumenPorMes.set(llave, { ventas: 0, tickets: 0, gastos: 0 });
      resumenPorMes.get(llave)[campo] += monto;
    }

    for (
      let d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));
      d <= finMesAnterior;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const anio = d.getUTCFullYear();
      const mes = d.getUTCMonth();
      const dia = d.getUTCDate();
      const diaSemana = d.getUTCDay();
      const llaveMes = `${anio}-${String(mes + 1).padStart(2, '0')}`;

      // Escenario favorable: crecimiento mensual constante (~16%/mes desde
      // el primer mes de la ventana) para que la tendencia de los últimos
      // 3 meses cerrados sea siempre ascendente — la proyección de ventas
      // de Resumen financiero (server.js, solo extrapola meses CERRADOS)
      // necesita esa forma para no clavarse en $0 con un trimestre plano
      // o descendente.
      const indiceMes = (anio * 12 + mes) - (inicio.getUTCFullYear() * 12 + inicio.getUTCMonth());
      const factorCrecimiento = 1 + indiceMes * 0.16;

      let ventasDelDia = 0;
      if (diaSemana >= 1 && diaSemana <= 5) {
        ventasDelDia = probabilidad(0.72) ? azarEntero(1, 2) : azarEntero(0, 1);
        if (probabilidad(0.12)) ventasDelDia += 1;
      } else if (diaSemana === 6 && probabilidad(0.35)) {
        ventasDelDia = 1;
      }

      for (let v = 0; v < ventasDelDia; v += 1) {
        const cantidad = Math.round(montoVenta() * factorCrecimiento * 100) / 100;
        const ivaPorcentaje = 16;
        const total = Math.round(cantidad * (1 + ivaPorcentaje / 100) * 100) / 100;
        const fechaCompra = fechaUtc(anio, mes, dia, azarEntero(9, 18), azarEntero(0, 59));

        const esPendiente = probabilidad(0.25);
        let estadoPago = 'pagada', montoCobrado = total, fechaVenc = null, fechaCobro = null, notasCobro = null;
        if (esPendiente) {
          estadoPago = 'pendiente';
          const diasVenc = azarEntero(15, 30);
          const fv = new Date(fechaCompra);
          fv.setUTCDate(fv.getUTCDate() + diasVenc);
          fechaVenc = fv.toISOString().slice(0, 10);
          if (probabilidad(0.4)) {
            montoCobrado = Math.round(total * azarEntre(0.3, 0.7) * 100) / 100;
            fechaCobro = fechaUtc(anio, mes, Math.min(dia + azarEntero(2, 5), 28), 10, 0);
            notasCobro = 'Abono parcial registrado (demo)';
          } else {
            montoCobrado = 0;
          }
        } else {
          fechaCobro = fechaUtc(anio, mes, Math.min(dia + azarEntero(1, 3), 28), 10, 0);
        }

        const [resultadoVenta] = await conexion.query(
          `INSERT INTO ordenes_compra
             (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, estado_pago,
              fecha_vencimiento, monto_cobrado, fecha_cobro, notas_cobro, eliminado_en, creado_en, actualizado_en)
           VALUES ('TEMP', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          [fechaCompra, elegir(CONCEPTOS_VENTA), cantidad, ivaPorcentaje, total, estadoPago,
            fechaVenc, montoCobrado, fechaCobro, notasCobro, fechaCompra, fechaCompra]
        );
        const idVenta = resultadoVenta.insertId;
        const numeroCompra = `OC-${String(idVenta).padStart(6, '0')}`;
        await conexion.query('UPDATE ordenes_compra SET numero_compra = ? WHERE id = ?', [numeroCompra, idVenta]);
        contadorVentas += 1;
        acumularMes(llaveMes, 'ventas', total);

        // 65% de las ventas llevan 1-2 líneas de inventario (Segmento A).
        if (probabilidad(0.65)) {
          const numLineas = probabilidad(0.25) ? 2 : 1;
          const productosElegidos = new Set();
          for (let i = 0; i < numLineas; i += 1) {
            const producto = elegirPonderado(productos);
            if (productosElegidos.has(producto.id)) continue;
            productosElegidos.add(producto.id);
            const cantidadPedida = azarEntero(1, 6);
            const cantidadReal = await registrarSalidaVenta(conexion, {
              producto, almacenId, cantidad: cantidadPedida, numeroCompra, fecha: fechaCompra,
            });
            await conexion.query('INSERT INTO orden_productos (orden_id, producto_id, cantidad, creado_en) VALUES (?, ?, ?, ?)', [
              idVenta, producto.id, cantidadReal, fechaCompra,
            ]);
            contadorLineasInventario += 1;
          }
        }

        // Ticket: 70% facturado (listo), del resto ~60% queda como
        // pendiente/en_curso visible (mismo patrón ya validado antes).
        if (probabilidad(0.7)) {
          const fechaTicket = fechaUtc(anio, mes, dia, Math.min(fechaCompra.getUTCHours() + 2, 21), azarEntero(0, 59));
          const tipoPago = elegir(['efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito']);
          const [resultadoTicket] = await conexion.query(
            `INSERT INTO tickets
               (folio, rfc, uso_cfdi, tipo_pago, tipo_pago_otro, comentarios, orden_compra_id,
                imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
                estatus, factura_nombre_original, factura_nombre_guardado, factura_mime,
                notas_admin, actualizado_por, eliminado_en, creado_en, actualizado_en)
             VALUES ('TEMP', ?, NULL, ?, NULL, 'Ticket de demo (sembrar-demo.js).', ?,
                     'ticket-demo.jpg', ?, 'image/jpeg', 102400,
                     'listo', NULL, NULL, NULL,
                     'Imagen placeholder: no hay archivo en MinIO.', 'admin', NULL, ?, ?)`,
            [RFC_DEMO_PRINCIPAL, tipoPago, idVenta, `sembrado-${idVenta}.jpg`, fechaTicket, fechaTicket]
          );
          const idTicket = resultadoTicket.insertId;
          await conexion.query('UPDATE tickets SET folio = ? WHERE id = ?', [`TK-${String(idTicket).padStart(6, '0')}`, idTicket]);
          // Punto 183: "facturado" ya no se lee del ticket en vivo (se
          // borra por retención) — se fija aquí el hecho permanente,
          // igual que lo haría POST /admin/tickets/:id/factura de verdad.
          await conexion.query('UPDATE ordenes_compra SET facturado_en = ? WHERE id = ?', [fechaTicket, idVenta]);
          contadorTickets += 1;
          acumularMes(llaveMes, 'tickets', 1);
        } else if (probabilidad(0.6)) {
          const fechaTicket = fechaUtc(anio, mes, dia, Math.min(fechaCompra.getUTCHours() + 1, 20), azarEntero(0, 59));
          const est = elegir(['pendiente', 'en_curso']);
          const [resultadoTicket] = await conexion.query(
            `INSERT INTO tickets
               (folio, rfc, uso_cfdi, tipo_pago, tipo_pago_otro, comentarios, orden_compra_id,
                imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
                estatus, eliminado_en, creado_en, actualizado_en)
             VALUES ('TEMP', ?, NULL, NULL, NULL, 'Pendiente de facturar (demo).', ?,
                     'ticket-demo-pend.jpg', ?, 'image/jpeg', 102400, ?, NULL, ?, ?)`,
            [RFC_DEMO_PRINCIPAL, idVenta, `sembrado-pend-${idVenta}.jpg`, est, fechaTicket, fechaTicket]
          );
          const idTicket = resultadoTicket.insertId;
          await conexion.query('UPDATE tickets SET folio = ? WHERE id = ?', [`TK-${String(idTicket).padStart(6, '0')}`, idTicket]);
        }
      }

      for (const gastoFijo of GASTOS_FIJOS) {
        if (dia !== gastoFijo.dia()) continue;
        await sembrarGasto(conexion, {
          fecha: fechaUtc(anio, mes, dia, azarEntero(9, 17), azarEntero(0, 59)),
          concepto: gastoFijo.concepto, proveedor: gastoFijo.proveedor, categoria: gastoFijo.categoria,
          monto: azarEntre(gastoFijo.min, gastoFijo.max), recurrente: gastoFijo.recurrente,
        });
        contadorGastos += 1;
        acumularMes(llaveMes, 'gastos', 1);
      }
      if (dia === 7) {
        for (const variable of GASTOS_VARIABLES) {
          const veces = azarEntero(variable.vecesMes[0], variable.vecesMes[1]);
          for (let i = 0; i < veces; i += 1) {
            await sembrarGasto(conexion, {
              fecha: fechaUtc(anio, mes, azarEntero(1, 28), azarEntero(9, 19), azarEntero(0, 59)),
              concepto: variable.concepto, proveedor: elegir(variable.proveedores), categoria: variable.categoria,
              monto: azarEntre(variable.min, variable.max), recurrente: variable.recurrente,
            });
            contadorGastos += 1;
            acumularMes(llaveMes, 'gastos', 1);
          }
        }
      }
    }

    // Escenario favorable: garantiza que cada mes cerrado facture al menos
    // 12% más que el anterior — el ruido diario del PRNG por sí solo puede
    // dar un trimestre plano o descendente, y la proyección de ventas de
    // Resumen financiero (server.js, solo extrapola los últimos 3 meses
    // CERRADOS) se clava en $0 en ese caso. Solo EMPUJA hacia arriba (nunca
    // hacia abajo), escalando cantidad/total/monto_cobrado del mes completo
    // por el mismo factor — conserva el ratio IVA/subtotal y el % ya
    // cobrado de cada venta.
    const CRECIMIENTO_MINIMO_MES = 1.12;
    const llavesVentaOrdenadas = [...resumenPorMes.keys()].sort();
    let pisoAnterior = null;
    for (const llave of llavesVentaOrdenadas) {
      const fila = resumenPorMes.get(llave);
      const pisoMinimo = pisoAnterior !== null ? pisoAnterior * CRECIMIENTO_MINIMO_MES : null;
      if (pisoMinimo !== null && fila.ventas < pisoMinimo) {
        const factor = pisoMinimo / fila.ventas;
        const [anioLlave, mesLlave] = llave.split('-').map(Number);
        const desde = new Date(Date.UTC(anioLlave, mesLlave - 1, 1));
        const hasta = new Date(Date.UTC(anioLlave, mesLlave, 1));
        await conexion.query(
          `UPDATE ordenes_compra
              SET cantidad = ROUND(cantidad * ?, 2),
                  total = ROUND(total * ?, 2),
                  monto_cobrado = ROUND(monto_cobrado * ?, 2)
            WHERE eliminado_en IS NULL AND fecha_compra >= ? AND fecha_compra < ?`,
          [factor, factor, factor, desde, hasta]
        );
        fila.ventas *= factor;
      }
      pisoAnterior = fila.ventas;
    }

    await conexion.commit();

    console.log('Siembra completada.');
    console.log(`  Ventas: ${contadorVentas}  |  Tickets: ${contadorTickets}  |  Gastos: ${contadorGastos}  |  Líneas de inventario: ${contadorLineasInventario}`);
    console.log('');
    console.log('Resumen por mes (subtotal ventas MXN | gastos capturados | tickets):');
    for (const llave of [...resumenPorMes.keys()].sort()) {
      const fila = resumenPorMes.get(llave);
      console.log(`  ${llave} | ventas $${fila.ventas.toFixed(2)} | gastos ${fila.gastos} | tickets ${fila.tickets}`);
    }
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

principal()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('La siembra falló:', error);
    process.exit(1);
  });
