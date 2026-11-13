// Script de demo específico para el tenant "Mas Cómputo" (demo de
// marketing/redes sociales, punto en curso). Copia adaptada de
// scripts/sembrar-demo.js (mismo mecanismo probado: BORRA los datos
// transaccionales de la BD que apunte DB_NAME — aquí siempre
// tenant_mas-computo, NUNCA la base sin tenant ni otro tenant — y vuelve
// a sembrar historia realista) con la ambientación de una tienda de
// consumibles de cómputo con servicio de reparación/asistencia a
// domicilio: 25 productos (periféricos, memorias, almacenamiento, cables,
// energía, consumibles de impresión) y 7 servicios (diagnóstico,
// formateo, limpieza, cambio de pantalla, recuperación de datos,
// instalación de red, soporte a domicilio).
//
// Requiere el flag --confirmar explícito (es DESTRUCTIVO e irreversible
// sin backup). Determinista (PRNG con semilla fija): correrlo dos veces
// seguidas produce exactamente los mismos datos.
//
// Uso (dentro de un contenedor con scripts/ montado, DB_* apuntando a
// tenant_mas-computo):
//   node scripts/sembrar-mas-computo.js --confirmar
//
// Punto 498 (demo de dashboard, 13 nov 2026): para que las tarjetas del
// mes en curso (Total facturado, Ventas sin facturar, Balance, Total
// gastos, Top proveedores de gasto, Distribución de gastos) no queden en
// $0, correr con SEED_INCLUIR_MES_ACTUAL=1 — si no, la siembra se detiene
// al último día del mes ANTERIOR y el mes en curso queda vacío. Las 5
// tarjetas de "Riesgo y control" (bajo mínimo, sin existencia, sin
// movimiento, mermas del mes, por vencer) se siembran siempre, sin
// depender de esa variable (ancladas al reloj real, ver
// sembrarSenalesRiesgoInventario).
//
// Perfil de crecimiento fijo (moderado, "positivo real, no exagerado"):
// ~5%/mes con el ruido natural del PRNG, sin forzar piso/techo mes contra
// mes — a diferencia del perfil "favorable" de sembrar-demo.js.
//
// Ninguna fila de esta siembra dispara un correo real (mismo criterio que
// sembrar-demo.js: cierres mensuales armados con guardarReporte() directo,
// nunca generarYEnviarReporte()).

const { pool } = require('../db');
const { getConfiguracionGlobal } = require('../utils/config');
const { generarContenidoMD, guardarReporte } = require('../utils/reportes');
const { ordenAItemArchivado, gastoAItemArchivado, rangoDelPeriodo } = require('../utils/cierreMensual');

const NOTA_PRUEBA = 'Dato de demo (sembrar-mas-computo.js)';

const SEED_MESES = Number(process.env.SEED_MESES || 9);
const SEMILLA_PRNG = Number(process.env.SEED_SEMILLA || 20261101);

// Perfil único: crecimiento moderado real, sin forzar tendencia más allá
// del ruido natural del PRNG (ajuste: null).
const perfilActivo = { pendiente: 0.05, gastoMultiplicador: 1.05, ajuste: null, ajusteFactor: 1 };

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
  let estado = semilla >>> 0;
  return function () {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}
const prng = crearPrng(SEMILLA_PRNG);
function azarEntre(min, max) { return min + prng() * (max - min); }
function azarEntero(min, max) { return Math.floor(azarEntre(min, max + 1)); }
function elegir(lista) { return lista[azarEntero(0, lista.length - 1)]; }
function probabilidad(p) { return prng() < p; }
function fechaUtc(anio, mesIndex, dia, hora, minuto) {
  return new Date(Date.UTC(anio, mesIndex, dia, hora, minuto, 0));
}
function round2(n) { return Math.round(n * 100) / 100; }

function elegirPonderado(items) {
  const pesoTotal = items.reduce((acc, it) => acc + (it.peso || 0), 0);
  if (pesoTotal <= 0) return elegir(items);
  let dado = prng() * pesoTotal;
  for (const it of items) {
    dado -= it.peso || 0;
    if (dado <= 0) return it;
  }
  return items[items.length - 1];
}

const CONCEPTOS_VENTA = [
  'Venta de accesorios y periféricos', 'Venta de memoria RAM', 'Venta de almacenamiento (SSD/HDD)',
  'Reparación a domicilio', 'Mantenimiento preventivo', 'Venta de refacciones',
  'Formateo e instalación de sistema operativo', 'Recuperación de datos', 'Soporte técnico a domicilio',
  'Venta de consumibles de impresión', 'Instalación y configuración de red',
];

// Negocio de cómputo: tickets más chicos por accesorios sueltos, medianos
// por memoria/almacenamiento o un servicio básico, grandes por reparación
// con refacción (ej. cambio de pantalla) o varios artículos juntos.
function montoVenta() {
  const dado = prng();
  if (dado < 0.40) return azarEntre(120, 600);
  if (dado < 0.72) return azarEntre(600, 1800);
  if (dado < 0.92) return azarEntre(1800, 4500);
  return azarEntre(4500, 9500);
}

// 25 PRODUCTOS (consumibles de cómputo, con existencia física real) —
// peso desparejo a propósito (top-vendidos vs. dead stock real en
// "Más vendido y menos movido", D9).
const CATALOGO = [
  { sku: 'ACC-MOU-001', nombre: 'Mouse óptico USB',                     categoria: 'Accesorios y periféricos', costo: 70,  precio: 140, stock: 180, peso: 24 },
  { sku: 'ACC-TEC-002', nombre: 'Teclado USB estándar',                 categoria: 'Accesorios y periféricos', costo: 110, precio: 220, stock: 150, peso: 22 },
  { sku: 'CAB-USC-003', nombre: 'Cable USB-C',                          categoria: 'Cables y conectores',      costo: 50,  precio: 120, stock: 220, peso: 20 },
  { sku: 'CAB-HDM-004', nombre: 'Cable HDMI 1.8m',                      categoria: 'Cables y conectores',      costo: 60,  precio: 150, stock: 180, peso: 18 },
  { sku: 'MEM-USB-005', nombre: 'Memoria USB 32GB',                     categoria: 'Memorias y almacenamiento', costo: 90,  precio: 190, stock: 200, peso: 22 },
  { sku: 'MEM-USB-006', nombre: 'Memoria USB 64GB',                     categoria: 'Memorias y almacenamiento', costo: 140, precio: 280, stock: 150, peso: 17 },
  { sku: 'RAM-D4-007',  nombre: 'Memoria RAM DDR4 8GB',                 categoria: 'Memorias y almacenamiento', costo: 320, precio: 560, stock: 90,  peso: 20 },
  { sku: 'RAM-D4-008',  nombre: 'Memoria RAM DDR4 16GB',                categoria: 'Memorias y almacenamiento', costo: 580, precio: 980, stock: 70,  peso: 16 },
  { sku: 'SSD-480-009', nombre: 'Disco SSD 480GB',                      categoria: 'Memorias y almacenamiento', costo: 620, precio: 1050, stock: 80,  peso: 19 },
  { sku: 'SSD-1TB-010', nombre: 'Disco SSD 1TB',                        categoria: 'Memorias y almacenamiento', costo: 980, precio: 1650, stock: 60,  peso: 15 },
  { sku: 'HDD-EXT-011', nombre: 'Disco duro externo 1TB',               categoria: 'Memorias y almacenamiento', costo: 850, precio: 1450, stock: 50,  peso: 10 },
  { sku: 'ACC-TEI-012', nombre: 'Teclado inalámbrico',                  categoria: 'Accesorios y periféricos', costo: 280, precio: 480, stock: 70,  peso: 12 },
  { sku: 'ACC-MOI-013', nombre: 'Mouse inalámbrico',                    categoria: 'Accesorios y periféricos', costo: 150, precio: 280, stock: 90,  peso: 14 },
  { sku: 'ACC-CAR-014', nombre: 'Cargador universal para laptop',       categoria: 'Energía y protección',     costo: 280, precio: 520, stock: 60,  peso: 11 },
  { sku: 'ACC-BAT-015', nombre: 'Batería para laptop (genérica)',       categoria: 'Energía y protección',     costo: 450, precio: 780, stock: 35,  peso: 6 },
  { sku: 'ACC-AUD-016', nombre: 'Audífonos con micrófono',              categoria: 'Accesorios y periféricos', costo: 130, precio: 260, stock: 100, peso: 13 },
  { sku: 'ACC-BOC-017', nombre: 'Bocinas USB para escritorio',          categoria: 'Accesorios y periféricos', costo: 160, precio: 310, stock: 60,  peso: 8 },
  { sku: 'ACC-CAM-018', nombre: 'Webcam USB HD',                        categoria: 'Accesorios y periféricos', costo: 240, precio: 420, stock: 45,  peso: 9 },
  { sku: 'ACC-HUB-019', nombre: 'Hub USB 4 puertos',                    categoria: 'Cables y conectores',      costo: 90,  precio: 190, stock: 90,  peso: 10 },
  { sku: 'ACC-BAS-020', nombre: 'Base enfriadora para laptop',          categoria: 'Accesorios y periféricos', costo: 220, precio: 400, stock: 40,  peso: 5 },
  { sku: 'ENE-NOB-021', nombre: 'No-break / regulador de voltaje 600VA', categoria: 'Energía y protección',    costo: 480, precio: 820, stock: 30,  peso: 7 },
  { sku: 'CON-TON-022', nombre: 'Tóner genérico para impresora láser',  categoria: 'Consumibles de impresión', costo: 280, precio: 480, stock: 40,  peso: 6 },
  { sku: 'CON-TIN-023', nombre: 'Cartucho de tinta genérico',           categoria: 'Consumibles de impresión', costo: 150, precio: 290, stock: 50,  peso: 4 },
  { sku: 'ACC-PAS-024', nombre: 'Pasta térmica para procesador',        categoria: 'Accesorios y periféricos', costo: 60,  precio: 140, stock: 60,  peso: 3 },
  { sku: 'ACC-MOC-025', nombre: 'Mochila porta laptop',                 categoria: 'Accesorios y periféricos', costo: 260, precio: 480, stock: 35,  peso: 0 },
];

// Producto "fantasma" (punto 498): se dio de alta en catálogo pero NUNCA
// llegó mercancía del proveedor — a propósito fuera de CATALOGO (nunca
// recibe el movimiento 'inventario_inicial' que sembrarCatalogoYExistencias
// aplica a todos los demás) y fuera de catalogoCompleto (peso 0, nunca se
// vende). Es el único camino real para que "Sin movimiento" (NOT EXISTS
// movimientos_inventario) no sea siempre 0 — cualquier producto normal YA
// tiene al menos ese movimiento inicial desde el día uno.
const PRODUCTO_SIN_MOVIMIENTO = {
  sku: 'ACC-SOP-026', nombre: 'Soporte ajustable para monitor', categoria: 'Accesorios y periféricos',
  costo: 180, precio: 340, stock: 0, peso: 0,
};

// Señales de riesgo que la siembra original (punto 495) nunca producía —
// agregadas en el punto 498 para que las 5 tarjetas de "Riesgo y control"
// del dashboard de Inventarios muestren datos reales en la demo, no puros
// ceros. Fechas ancladas al reloj REAL (no a la línea de tiempo simulada
// de fechaInicial/finVentana) porque las queries del backend usan NOW()/
// CURDATE() — igual que fecha_expiracion/mermas_periodo en server.js.
const SKU_AGOTADO = 'ACC-BAT-015'; // Batería para laptop: stock bajo (35), candidato realista a agotarse
const SKUS_BAJO_MINIMO = ['ACC-BAS-020', 'ENE-NOB-021']; // Base enfriadora / No-break: stock bajo, fácil de dejar por debajo del mínimo
const SKUS_MERMA_MES = [
  { sku: 'CON-TIN-023', cantidad: 2, motivo: 'Cartuchos dañados por humedad en almacén (demo).' },
  { sku: 'ACC-CAM-018', cantidad: 1, motivo: 'Webcam con lente rayado, dada de baja en revisión de stock (demo).' },
];
const SKUS_POR_VENCER = [
  { sku: 'CON-TON-022', dias: 12 },
  { sku: 'CON-TIN-023', dias: 24 },
];

// 7 SERVICIOS (sin existencia/costeo — D11: nunca generan movimiento de
// inventario) — reparación y asistencia a domicilio. Diagnóstico y
// soporte técnico se cobran por "Hora" (punto 298: 2do cobro válido para
// tipo=servicio); el resto son un "Paquete" (visita/servicio completo).
const SERVICIOS = [
  { sku: 'SERV-DIA-001', nombre: 'Diagnóstico de equipo a domicilio',              categoria: 'Servicios técnicos', precio: 350,  peso: 20, unidad: 'Hora' },
  { sku: 'SERV-FOR-002', nombre: 'Formateo e instalación de sistema operativo',    categoria: 'Servicios técnicos', precio: 650,  peso: 22, unidad: 'Paquete' },
  { sku: 'SERV-LIM-003', nombre: 'Limpieza física y mantenimiento preventivo',     categoria: 'Servicios técnicos', precio: 450,  peso: 18, unidad: 'Paquete' },
  { sku: 'SERV-PAN-004', nombre: 'Cambio de pantalla a domicilio (laptop)',        categoria: 'Servicios técnicos', precio: 1800, peso: 10, unidad: 'Paquete' },
  { sku: 'SERV-REC-005', nombre: 'Recuperación de datos',                         categoria: 'Servicios técnicos', precio: 900,  peso: 8,  unidad: 'Paquete' },
  { sku: 'SERV-RED-006', nombre: 'Instalación y configuración de red/WiFi',       categoria: 'Servicios técnicos', precio: 550,  peso: 12, unidad: 'Paquete' },
  { sku: 'SERV-SOP-007', nombre: 'Soporte técnico a domicilio (visita general)',  categoria: 'Servicios técnicos', precio: 300,  peso: 14, unidad: 'Hora' },
];

// Mismas 10 categorías ya sembradas en `categorias_gastos` (nunca se
// tocan/renombran — solo se reusa el slug con texto/proveedor del taller).
const GASTOS_FIJOS = [
  { categoria: 'renta', proveedor: 'Plaza Comercial del Centro', concepto: 'Renta de local y taller de servicio', min: 6500, max: 8500, dia: () => azarEntero(2, 5), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina técnicos', concepto: 'Nómina técnico de reparación 1 - primera quincena', min: 4500, max: 5500, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina técnicos', concepto: 'Nómina técnico de reparación 1 - segunda quincena', min: 4500, max: 5500, dia: () => azarEntero(26, 28), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina técnicos', concepto: 'Nómina técnico de reparación 2 - primera quincena', min: 4000, max: 5000, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina técnicos', concepto: 'Nómina técnico de reparación 2 - segunda quincena', min: 4000, max: 5000, dia: () => azarEntero(26, 28), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina mostrador', concepto: 'Nómina mostrador y atención a clientes - primera quincena', min: 2800, max: 3600, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina mostrador', concepto: 'Nómina mostrador y atención a clientes - segunda quincena', min: 2800, max: 3600, dia: () => azarEntero(26, 28), recurrente: true },
];

const GASTOS_VARIABLES = [
  { categoria: 'software', proveedores: ['Microsoft', 'Licencias MX', 'Office Depot Licencias'], concepto: 'Licencias de sistema operativo y utilerías de diagnóstico', min: 400, max: 2200, vecesMes: [1, 2], recurrente: true },
  { categoria: 'hosting', proveedores: ['GoDaddy', 'Hostinger MX'], concepto: 'Hospedaje de página de citas y catálogo en línea', min: 250, max: 900, vecesMes: [1, 1], recurrente: true },
  { categoria: 'servicios', proveedores: ['CFE', 'Telmex', 'Totalplay'], concepto: 'Servicios básicos del local (luz, internet)', min: 500, max: 2200, vecesMes: [1, 2], recurrente: true },
  { categoria: 'papeleria', proveedores: ['Office Depot', 'Lumen'], concepto: 'Papelería y material de oficina del mostrador', min: 150, max: 1200, vecesMes: [0, 2], recurrente: false },
  { categoria: 'combustible', proveedores: ['Gasolinera Pemex', 'G500'], concepto: 'Combustible para visitas de servicio a domicilio', min: 600, max: 3000, vecesMes: [1, 4], recurrente: false },
  { categoria: 'viaticos', proveedores: ['Uber', 'Autobuses MX'], concepto: 'Viáticos de técnicos en visitas foráneas', min: 200, max: 1500, vecesMes: [0, 2], recurrente: false },
  { categoria: 'publicidad', proveedores: ['Meta Ads', 'Google Ads', 'TikTok Ads'], concepto: 'Campaña de redes sociales y anuncios locales', min: 800, max: 3500, vecesMes: [0, 2], recurrente: false },
  { categoria: 'otro', proveedores: ['CT Internacional', 'PCH Importaciones', 'Intelaf', 'Steren'], concepto: 'Refacciones y herramientas de taller', min: 500, max: 4000, vecesMes: [1, 3], recurrente: false },
];

async function borrarDatosTransaccionales() {
  console.log(`Borrando datos transaccionales de ${process.env.DB_NAME} (config/usuarios NO se tocan)...`);
  if (!/^tenant_/.test(process.env.DB_NAME || '')) {
    throw new Error(`DB_NAME="${process.env.DB_NAME}" no empieza con "tenant_" — este script SOLO debe correr contra la BD de un tenant, nunca la base sin tenant.`);
  }
  for (const tabla of TABLAS_A_BORRAR) {
    const [r] = await pool.query(`DELETE FROM ${tabla}`);
    console.log(`  ${tabla}: ${r.affectedRows} filas borradas`);
  }
  for (const tabla of TABLAS_A_BORRAR) {
    if (tabla === 'inv_idempotencia') continue;
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
    ['Cliente Demo Principal (Mas Cómputo)', RFC_DEMO_PRINCIPAL, EMAIL_DEMO_PRINCIPAL, ahora, ahora]
  );
  await conexion.query(
    `INSERT INTO registros
       (nombre, tipo_persona, rfc, email, archivo_nombre_original, archivo_nombre_guardado,
        archivo_mime, archivo_tamano_bytes, regimen_fiscal, codigo_postal, uso_cfdi,
        eliminado_en, creado_en, actualizado_en)
     VALUES (?, 'fisica', ?, ?, 'constancia-demo.pdf', 'constancia-demo-placeholder-2.pdf',
             'application/pdf', 51200, NULL, NULL, NULL, NULL, ?, ?)`,
    ['Cliente Demo Secundario (Mas Cómputo)', RFC_DEMO_SECUNDARIO, EMAIL_DEMO_SECUNDARIO, ahora, ahora]
  );
  console.log(`Registros demo listos:`);
  console.log(`  RFC ${RFC_DEMO_PRINCIPAL} -> ${EMAIL_DEMO_PRINCIPAL} (con historial de ventas/tickets)`);
  console.log(`  RFC ${RFC_DEMO_SECUNDARIO} -> ${EMAIL_DEMO_SECUNDARIO} (limpio, sin historial)`);
  console.log('  NOTA: ninguna de las 2 constancias tiene archivo real en MinIO/Garage (placeholder).\n');
}

async function sembrarCatalogoYExistencias(conexion, fechaInicial) {
  const [[unidadPieza]] = await conexion.query("SELECT id FROM unidades_medida WHERE nombre = 'Pieza' LIMIT 1");
  const [[unidadHora]] = await conexion.query("SELECT id FROM unidades_medida WHERE nombre = 'Hora' LIMIT 1");
  const [[unidadPaquete]] = await conexion.query("SELECT id FROM unidades_medida WHERE nombre = 'Paquete' LIMIT 1");
  const [[almacen]] = await conexion.query("SELECT id FROM almacenes WHERE codigo = 'ALM-1' LIMIT 1");
  const almacenId = almacen.id;

  const categoriasNombres = [...new Set([...CATALOGO.map((p) => p.categoria), ...SERVICIOS.map((s) => s.categoria)])];
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

    productos.push({ ...p, id: productoId, tipo: 'producto', unidad_nombre: 'Pieza' });
  }

  const servicios = [];
  for (const s of SERVICIOS) {
    const unidadId = s.unidad === 'Hora' ? unidadHora.id : unidadPaquete.id;
    const [r] = await conexion.query(
      `INSERT INTO productos
         (sku, codigo_barras, nombre, categoria_id, unidad_id, tipo, costo, costo_promedio, ultimo_costo,
          precio, stock_minimo, stock_maximo, punto_reorden, estado, proveedor_principal, moneda,
          eliminado_en, creado_en, actualizado_en)
       VALUES (?, NULL, ?, ?, ?, 'servicio', NULL, 0, NULL, ?, NULL, NULL, NULL, 'activo', NULL, 'MXN', NULL, ?, ?)`,
      [s.sku, s.nombre, categoriaIdPorNombre.get(s.categoria), unidadId, s.precio, fechaInicial, fechaInicial]
    );
    servicios.push({ ...s, id: r.insertId, tipo: 'servicio', unidad_nombre: s.unidad });
  }

  // Producto fantasma (punto 498): alta en catálogo, existencia en 0,
  // CERO filas en movimientos_inventario — a propósito, nunca pasa por
  // el bloque de arriba (ese bloque siempre inserta 'inventario_inicial').
  // Su categoría ya existe (es una de las de CATALOGO), así que solo se
  // reusa el id ya resuelto en categoriaIdPorNombre.
  const categoriaFantasmaId = categoriaIdPorNombre.get(PRODUCTO_SIN_MOVIMIENTO.categoria);
  const [rFantasma] = await conexion.query(
    `INSERT INTO productos
       (sku, codigo_barras, nombre, categoria_id, unidad_id, tipo, costo, costo_promedio, ultimo_costo,
        precio, stock_minimo, stock_maximo, punto_reorden, estado, proveedor_principal, moneda,
        eliminado_en, creado_en, actualizado_en)
     VALUES (?, NULL, ?, ?, ?, 'producto', ?, ?, ?, ?, ?, ?, ?, 'activo', ?, 'MXN', NULL, ?, ?)`,
    [PRODUCTO_SIN_MOVIMIENTO.sku, PRODUCTO_SIN_MOVIMIENTO.nombre, categoriaFantasmaId, unidadPieza.id,
      PRODUCTO_SIN_MOVIMIENTO.costo, PRODUCTO_SIN_MOVIMIENTO.costo, PRODUCTO_SIN_MOVIMIENTO.costo,
      PRODUCTO_SIN_MOVIMIENTO.precio, 5, 0, 2, `Proveedor ${PRODUCTO_SIN_MOVIMIENTO.sku} (nunca entregó)`,
      fechaInicial, fechaInicial]
  );
  await conexion.query('INSERT INTO existencias (producto_id, almacen_id, disponible, actualizado_en) VALUES (?, ?, 0, ?)', [
    rFantasma.insertId, almacenId, fechaInicial,
  ]);

  console.log(`Catálogo sembrado: ${productos.length} productos + ${servicios.length} servicios, ${categoriasNombres.length} categorías, almacén ${almacenId}.\n`);
  console.log(`Producto fantasma (sin movimiento, sin existencia): ${PRODUCTO_SIN_MOVIMIENTO.sku}.\n`);
  return { productos, servicios, almacenId };
}

async function registrarSalidaVenta(conexion, { producto, almacenId, cantidad, numeroCompra, fecha }) {
  const [[exRow]] = await conexion.query(
    'SELECT disponible FROM existencias WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
    [producto.id, almacenId]
  );
  const anterior = Number(exRow.disponible);
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

async function archivarPeriodoSinCorreo(periodo, zonaHoraria) {
  const [ventas] = await pool.query(
    `SELECT * FROM ordenes_compra
      WHERE eliminado_en IS NULL AND archivado_en IS NULL AND DATE_FORMAT(fecha_compra, '%Y-%m') = ?
      ORDER BY fecha_compra ASC`,
    [periodo]
  );
  const [gastosPeriodo] = await pool.query(
    `SELECT * FROM gastos
      WHERE eliminado_en IS NULL AND archivado_en IS NULL AND DATE_FORMAT(fecha, '%Y-%m') = ?
      ORDER BY fecha ASC`,
    [periodo]
  );
  if (ventas.length === 0 && gastosPeriodo.length === 0) return { periodo, ventas: 0, gastos: 0 };

  const items = [...ventas.map(ordenAItemArchivado), ...gastosPeriodo.map(gastoAItemArchivado)];
  const { inicio, fin } = rangoDelPeriodo(periodo);
  const fechaGeneracion = new Date();
  const mdContenido = generarContenidoMD({ tipo: 'cierre_mensual', fechaGeneracion, rangoInicio: inicio, rangoFin: fin, items, zonaHoraria });
  await guardarReporte({ tipo: 'cierre_mensual', fechaGeneracion, rangoInicio: inicio, rangoFin: fin, items, mdContenido, correoEnviadoA: null, correoEnviado: false });

  const ahora = new Date();
  ahora.setMilliseconds(0);
  if (ventas.length > 0) {
    await pool.query('UPDATE ordenes_compra SET archivado_en = ?, periodo_archivado = ? WHERE id IN (?)', [ahora, periodo, ventas.map((v) => v.id)]);
  }
  if (gastosPeriodo.length > 0) {
    await pool.query('UPDATE gastos SET archivado_en = ?, periodo_archivado = ? WHERE id IN (?)', [ahora, periodo, gastosPeriodo.map((g) => g.id)]);
  }
  return { periodo, ventas: ventas.length, gastos: gastosPeriodo.length };
}

async function elegirDiaConVentas(anio, mes) {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 1));
  const [filas] = await pool.query(
    `SELECT DAY(fecha_compra) AS dia, COUNT(*) AS n
       FROM ordenes_compra
      WHERE eliminado_en IS NULL AND fecha_compra >= ? AND fecha_compra < ?
      GROUP BY DAY(fecha_compra)
      ORDER BY ABS(dia - 15) ASC, n DESC, dia ASC
      LIMIT 1`,
    [inicio, fin]
  );
  return filas.length ? filas[0].dia : null;
}

async function generarCorteDemo(desdeStr, hastaStr, zonaHoraria) {
  const [y1, m1, d1] = desdeStr.split('-').map(Number);
  const [y2, m2, d2] = hastaStr.split('-').map(Number);
  const inicio = new Date(Date.UTC(y1, m1 - 1, d1));
  const finExclusivo = new Date(Date.UTC(y2, m2 - 1, d2 + 1));

  const [ordenes] = await pool.query(
    `SELECT o.id, o.numero_compra, o.fecha_compra, o.concepto, o.cantidad, o.total, o.email,
            o.estado_pago, o.monto_cobrado, o.creado_por, (o.facturado_en IS NOT NULL) AS facturado
       FROM ordenes_compra o
      WHERE o.eliminado_en IS NULL AND o.fecha_compra >= ? AND o.fecha_compra < ?
      ORDER BY o.fecha_compra ASC`,
    [inicio, finExclusivo]
  );
  if (ordenes.length === 0) return null;

  let subtotal = 0, total = 0;
  for (const o of ordenes) {
    subtotal += Number(o.cantidad);
    total += Number(o.total);
  }
  subtotal = round2(subtotal);
  total = round2(total);

  const items = ordenes.map((o) => ({
    tipo_registro: 'orden_compra',
    identificador: o.numero_compra,
    rfc: o.email,
    estatus_o_concepto: o.concepto,
    monto: Number(o.total),
    fecha_registro: o.fecha_compra,
    atendido_por: o.creado_por,
  }));
  const fechaGeneracion = new Date();
  const finParaMostrar = new Date(finExclusivo.getTime() - 1000);
  const mdContenido = generarContenidoMD({ tipo: 'corte', fechaGeneracion, rangoInicio: inicio, rangoFin: finParaMostrar, items, zonaHoraria });
  await guardarReporte({
    tipo: 'corte', fechaGeneracion, rangoInicio: inicio, rangoFin: finParaMostrar, items, mdContenido,
    correoEnviadoA: null, correoEnviado: false, totalMonto: total,
  });
  return { ventas: ordenes.length, total };
}

async function sembrarReporteEliminado(tipo, items, fechaGeneracion, zonaHoraria) {
  const tiempos = items.map((i) => new Date(i.fecha_registro).getTime());
  const rangoInicio = new Date(Math.min(...tiempos));
  const rangoFin = new Date(Math.max(...tiempos));
  const mdContenido = generarContenidoMD({ tipo, fechaGeneracion, rangoInicio, rangoFin, items, zonaHoraria });
  await guardarReporte({ tipo, fechaGeneracion, rangoInicio, rangoFin, items, mdContenido, correoEnviadoA: null, correoEnviado: false });
}

// Señales de riesgo de inventario (punto 498): ancladas al reloj REAL
// (ahoraReal = Date real de cuando corre el script), porque las queries
// del dashboard que las leen (bajoMinimo/sinExistencia/mermasPeriodo/
// porVencer en server.js) usan NOW()/CURDATE(), nunca la línea de tiempo
// simulada de la siembra. mermas_periodo y por_vencer decaen con el
// tiempo real (se salen de la ventana del mes/de los 30 días) — mismo
// riesgo inherente que ya documenta backend/utils/config.js para
// fecha_expiracion; aceptable para una demo que se puede re-sembrar.
async function obtenerProductoPorSku(conexion, sku) {
  const [[p]] = await conexion.query('SELECT id, costo, stock_minimo FROM productos WHERE sku = ? LIMIT 1', [sku]);
  return p || null;
}
async function obtenerDisponible(conexion, productoId, almacenId) {
  const [[e]] = await conexion.query(
    'SELECT disponible FROM existencias WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
    [productoId, almacenId]
  );
  return Number(e.disponible);
}
async function registrarSalidaAjusteOMerma(conexion, { producto, almacenId, cantidad, tipo, motivo, fecha }) {
  const anterior = await obtenerDisponible(conexion, producto.id, almacenId);
  const cantidadReal = Math.min(cantidad, anterior);
  if (cantidadReal <= 0) return;
  const posterior = round2(anterior - cantidadReal);
  const [ins] = await conexion.query(
    `INSERT INTO movimientos_inventario
       (folio, producto_id, almacen_id, tipo, cantidad, costo_unitario, existencia_anterior, existencia_posterior,
        motivo, usuario, creado_en)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?)`,
    [producto.id, almacenId, tipo, cantidadReal, producto.costo, anterior, posterior, motivo, fecha]
  );
  const prefijo = tipo === 'merma' ? 'ME' : 'AJ';
  await conexion.query('UPDATE movimientos_inventario SET folio = ? WHERE id = ?', [
    `${prefijo}-${String(ins.insertId).padStart(6, '0')}`, ins.insertId,
  ]);
  await conexion.query('UPDATE existencias SET disponible = ?, actualizado_en = ? WHERE producto_id = ? AND almacen_id = ?', [
    posterior, fecha, producto.id, almacenId,
  ]);
}

async function sembrarSenalesRiesgoInventario(conexion, { almacenId, ahoraReal }) {
  const diaReal = (offset) => fechaUtc(
    ahoraReal.getUTCFullYear(), ahoraReal.getUTCMonth(), Math.max(ahoraReal.getUTCDate() - offset, 1), 11, 30
  );

  const pAgotado = await obtenerProductoPorSku(conexion, SKU_AGOTADO);
  if (pAgotado) {
    const disponible = await obtenerDisponible(conexion, pAgotado.id, almacenId);
    await registrarSalidaAjusteOMerma(conexion, {
      producto: pAgotado, almacenId, cantidad: disponible, tipo: 'ajuste_negativo',
      motivo: 'Última pieza vendida por alta demanda; pendiente de reabastecer con el proveedor (demo).',
      fecha: diaReal(2),
    });
  }

  for (const sku of SKUS_BAJO_MINIMO) {
    const p = await obtenerProductoPorSku(conexion, sku);
    if (!p) continue;
    const disponible = await obtenerDisponible(conexion, p.id, almacenId);
    const objetivo = Math.max(Math.floor(Number(p.stock_minimo) * 0.5), 1);
    const salida = Math.max(disponible - objetivo, 0);
    if (salida > 0) {
      await registrarSalidaAjusteOMerma(conexion, {
        producto: p, almacenId, cantidad: salida, tipo: 'ajuste_negativo',
        motivo: 'Salida registrada por reparaciones recientes; queda por debajo del mínimo configurado (demo).',
        fecha: diaReal(3),
      });
    }
  }

  for (const m of SKUS_MERMA_MES) {
    const p = await obtenerProductoPorSku(conexion, m.sku);
    if (!p) continue;
    await registrarSalidaAjusteOMerma(conexion, {
      producto: p, almacenId, cantidad: m.cantidad, tipo: 'merma', motivo: m.motivo, fecha: diaReal(1),
    });
  }

  for (const e of SKUS_POR_VENCER) {
    const fechaExp = new Date(ahoraReal.getTime() + e.dias * 86400000).toISOString().slice(0, 10);
    await conexion.query('UPDATE productos SET fecha_expiracion = ? WHERE sku = ?', [fechaExp, e.sku]);
  }

  console.log('Señales de riesgo de inventario sembradas: 1 agotado, 2 bajo mínimo, 2 mermas del mes, 2 por vencer, 1 sin movimiento (fantasma).\n');
}

async function sembrarEliminadosDemo(llavesOrdenadas, zonaHoraria) {
  if (llavesOrdenadas.length === 0) return;

  const llaveA = llavesOrdenadas[Math.floor(llavesOrdenadas.length * 0.2)];
  const [anioA, mesA] = llaveA.split('-').map(Number);
  const fechaA = fechaUtc(anioA, mesA - 1, 12, 11, 30);
  await sembrarReporteEliminado('manual', [{
    tipo_registro: 'orden_compra', identificador: `OC-DEMO-${llaveA}`, rfc: 'cliente.demo1@example.com',
    estatus_o_concepto: 'Venta de memoria RAM cancelada por producto dañado', monto: 980,
    fecha_registro: fechaA, atendido_por: 'admin', accion: 'eliminado',
  }], fechaA, zonaHoraria);

  const llaveB = llavesOrdenadas[Math.floor(llavesOrdenadas.length * 0.6)];
  const [anioB, mesB] = llaveB.split('-').map(Number);
  const fechaB = fechaUtc(anioB, mesB - 1, 20, 16, 10);
  await sembrarReporteEliminado('manual', [{
    tipo_registro: 'orden_compra', identificador: `OC-DEMO-${llaveB}`, rfc: 'cliente.demo2@example.com',
    estatus_o_concepto: 'Reparación duplicada por error de captura', monto: 650,
    fecha_registro: fechaB, atendido_por: 'admin', accion: 'eliminado',
  }], fechaB, zonaHoraria);

  const llaveC = llavesOrdenadas[Math.floor(llavesOrdenadas.length * 0.4)];
  const [anioC, mesC] = llaveC.split('-').map(Number);
  const fechaC1 = fechaUtc(anioC, mesC - 1, 5, 9, 0);
  const fechaC2 = fechaUtc(anioC, mesC - 1, 8, 10, 15);
  await sembrarReporteEliminado('automatico', [
    { tipo_registro: 'ticket', identificador: `TK-DEMO-${llaveC}A`, rfc: RFC_DEMO_PRINCIPAL, estatus_o_concepto: 'listo', monto: null, fecha_registro: fechaC1, atendido_por: 'admin', accion: 'eliminado' },
    { tipo_registro: 'ticket', identificador: `TK-DEMO-${llaveC}B`, rfc: RFC_DEMO_PRINCIPAL, estatus_o_concepto: 'listo', monto: null, fecha_registro: fechaC2, atendido_por: 'admin', accion: 'eliminado' },
  ], fechaC2, zonaHoraria);

  console.log('  2 ventas "eliminadas" (manual) + 1 lote de 2 tickets purgados (automatico)');
}

async function principal() {
  const confirmar = process.argv.includes('--confirmar');
  if (!confirmar) {
    console.error('Este script BORRA todos los datos de ventas/inventario/gastos/tickets/constancias');
    console.error(`de ${process.env.DB_NAME} (config y usuarios NO se tocan) y vuelve a sembrar todo.`);
    console.error('Es irreversible sin backup. Vuelve a correr con --confirmar si es lo que quieres:');
    console.error('  node scripts/sembrar-mas-computo.js --confirmar');
    process.exit(1);
  }

  console.log(`Meses: ${SEED_MESES} | Semilla: ${SEMILLA_PRNG} | DB: ${process.env.DB_NAME}\n`);

  await borrarDatosTransaccionales();

  const hoyUtc = new Date();
  const anioActual = hoyUtc.getUTCFullYear();
  const mesActual = hoyUtc.getUTCMonth();
  const inicio = new Date(Date.UTC(anioActual, mesActual - SEED_MESES, 1));
  const incluirMesActual = process.env.SEED_INCLUIR_MES_ACTUAL === '1';
  const finVentana = incluirMesActual
    ? new Date(Date.UTC(anioActual, mesActual, Math.max(hoyUtc.getUTCDate() - 1, 1)))
    : new Date(Date.UTC(anioActual, mesActual, 0));
  const fechaInicial = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate(), 9, 0, 0));

  const conexion = await pool.getConnection();
  try {
    await sembrarRegistrosDemo(conexion, fechaInicial);
    const { productos, servicios, almacenId } = await sembrarCatalogoYExistencias(conexion, fechaInicial);
    const catalogoCompleto = [...productos, ...servicios];

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
      d <= finVentana;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const anio = d.getUTCFullYear();
      const mes = d.getUTCMonth();
      const dia = d.getUTCDate();
      const diaSemana = d.getUTCDay();
      const llaveMes = `${anio}-${String(mes + 1).padStart(2, '0')}`;

      const indiceMes = (anio * 12 + mes) - (inicio.getUTCFullYear() * 12 + inicio.getUTCMonth());
      const factorCrecimiento = Math.max(0.15, 1 + indiceMes * perfilActivo.pendiente);

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

        if (probabilidad(0.65)) {
          const numLineas = probabilidad(0.25) ? 2 : 1;
          const itemsElegidos = new Set();
          for (let i = 0; i < numLineas; i += 1) {
            const item = elegirPonderado(catalogoCompleto);
            if (itemsElegidos.has(item.id)) continue;
            itemsElegidos.add(item.id);
            let cantidadReal;
            if (item.tipo === 'servicio') {
              cantidadReal = item.unidad_nombre === 'Hora' ? azarEntero(1, 4) : 1;
            } else {
              const cantidadPedida = azarEntero(1, 6);
              cantidadReal = await registrarSalidaVenta(conexion, {
                producto: item, almacenId, cantidad: cantidadPedida, numeroCompra, fecha: fechaCompra,
              });
            }
            await conexion.query('INSERT INTO orden_productos (orden_id, producto_id, cantidad, creado_en) VALUES (?, ?, ?, ?)', [
              idVenta, item.id, cantidadReal, fechaCompra,
            ]);
            contadorLineasInventario += 1;
          }
        }

        if (probabilidad(0.7)) {
          const fechaTicket = fechaUtc(anio, mes, dia, Math.min(fechaCompra.getUTCHours() + 2, 21), azarEntero(0, 59));
          const tipoPago = elegir(['efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito']);
          const [resultadoTicket] = await conexion.query(
            `INSERT INTO tickets
               (folio, rfc, uso_cfdi, tipo_pago, tipo_pago_otro, comentarios, orden_compra_id,
                imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
                estatus, factura_nombre_original, factura_nombre_guardado, factura_mime,
                notas_admin, actualizado_por, eliminado_en, creado_en, actualizado_en)
             VALUES ('TEMP', ?, NULL, ?, NULL, 'Ticket de demo (sembrar-mas-computo.js).', ?,
                     'ticket-demo.jpg', ?, 'image/jpeg', 102400,
                     'listo', NULL, NULL, NULL,
                     'Imagen placeholder: no hay archivo en MinIO.', 'admin', NULL, ?, ?)`,
            [RFC_DEMO_PRINCIPAL, tipoPago, idVenta, `sembrado-${idVenta}.jpg`, fechaTicket, fechaTicket]
          );
          const idTicket = resultadoTicket.insertId;
          await conexion.query('UPDATE tickets SET folio = ? WHERE id = ?', [`TK-${String(idTicket).padStart(6, '0')}`, idTicket]);
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
          monto: azarEntre(gastoFijo.min, gastoFijo.max) * perfilActivo.gastoMultiplicador, recurrente: gastoFijo.recurrente,
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
              monto: azarEntre(variable.min, variable.max) * perfilActivo.gastoMultiplicador, recurrente: variable.recurrente,
            });
            contadorGastos += 1;
            acumularMes(llaveMes, 'gastos', 1);
          }
        }
      }
    }

    await sembrarSenalesRiesgoInventario(conexion, { almacenId, ahoraReal: hoyUtc });

    await conexion.commit();

    console.log('Siembra completada.');
    console.log(`  Ventas: ${contadorVentas}  |  Tickets: ${contadorTickets}  |  Gastos: ${contadorGastos}  |  Líneas de inventario/servicio: ${contadorLineasInventario}`);
    console.log('');
    console.log('Resumen por mes (subtotal ventas MXN | gastos capturados | tickets):');
    for (const llave of [...resumenPorMes.keys()].sort()) {
      const fila = resumenPorMes.get(llave);
      console.log(`  ${llave} | ventas $${fila.ventas.toFixed(2)} | gastos ${fila.gastos} | tickets ${fila.tickets}`);
    }

    const zonaHoraria = (await getConfiguracionGlobal()).zona_horaria;
    const llavesOrdenadas = [...resumenPorMes.keys()].sort();

    const llavesAArchivar = llavesOrdenadas.slice(0, Math.max(0, llavesOrdenadas.length - 2));
    console.log('\nArchivando cierres mensuales (sin enviar correo real):');
    for (const periodo of llavesAArchivar) {
      const r = await archivarPeriodoSinCorreo(periodo, zonaHoraria);
      console.log(`  ${periodo}: ${r.ventas} ventas + ${r.gastos} gastos archivados`);
    }

    console.log('\nGenerando "Corte del día" de ejemplo (1 por mes):');
    for (const llave of llavesOrdenadas) {
      const [anioC, mesC] = llave.split('-').map(Number);
      const diaCorte = await elegirDiaConVentas(anioC, mesC);
      if (!diaCorte) continue;
      const fechaStr = `${llave}-${String(diaCorte).padStart(2, '0')}`;
      const r = await generarCorteDemo(fechaStr, fechaStr, zonaHoraria);
      if (r) console.log(`  ${fechaStr}: ${r.ventas} ventas, total $${r.total.toFixed(2)}`);
    }

    console.log('\nSembrando historial de "Eliminados" (reportes de auditoría, sin borrar nada real):');
    await sembrarEliminadosDemo(llavesOrdenadas, zonaHoraria);
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
