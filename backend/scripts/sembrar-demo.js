// Script de demo unificado: BORRA los datos transaccionales de la BD que
// apunte DB_NAME (por defecto portal_facturacion, la base SIN tenant — se
// puede apuntar a un tenant_<slug> igual que ensureSchema(), ver punto 115
// de PROJECT_STATE.md) y vuelve a sembrar historia realista (ventas,
// tickets, gastos, inventario con movimientos, CxC, cierres mensuales
// archivados, "Cortes del día" y un puñado de "Eliminados") con la
// ambientación de una escuela privada (Maternal/Kinder/Primaria/
// Secundaria) — productos (uniformes, útiles) Y servicios (colegiaturas,
// inscripción, transporte, comedor, talleres, regularización). Ver
// SEED_MESES/SEED_SEMILLA/SEED_PERFIL más abajo para sembrar varios
// tenants con escenarios financieros distintos sin duplicar el script.
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
// QUÉ CONSERVA (configuración — nunca se toca, incluye fiscal/admin/SMTP):
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
//   SEED_MESES=8 node scripts/sembrar-demo.js --confirmar   (8 meses de historia)
//
// Dos registros (constancias) quedan listos para pruebas manuales de
// correo real en el navegador — ver RFC_DEMO_PRINCIPAL/RFC_DEMO_SECUNDARIO
// abajo. Ninguna fila de esta siembra dispara un correo real (son INSERT
// directos a la base, incluidos los cierres mensuales archivados — se
// arman con guardarReporte() directo, NUNCA con generarYEnviarReporte(),
// justo para no mandar de verdad los N correos de cierre a quien tenga
// configurado "Correo de reportes" en este entorno) — solo dejan datos
// limpios para que tú dispares un correo real a mano después si quieres.

const { pool } = require('../db');
const { getConfiguracionGlobal } = require('../utils/config');
const { generarContenidoMD, guardarReporte } = require('../utils/reportes');
const { ordenAItemArchivado, gastoAItemArchivado, rangoDelPeriodo } = require('../utils/cierreMensual');

const NOTA_PRUEBA = 'Dato de demo (sembrar-demo.js)';

// Parametrización vía env (todas con default = comportamiento histórico
// exacto, sin cambios, cuando se corre sin ninguna variable):
//   SEED_MESES=12          ventana de historia (default 6)
//   SEED_SEMILLA=123       semilla del PRNG (default 20240401)
//   SEED_PERFIL=negativo   favorable|promedio|negativo (default favorable)
// Pensado para sembrar varios tenants con escenarios distintos (misma
// mecánica de generación diaria, solo cambia la tendencia de ventas y el
// peso de los gastos) sin duplicar el script.
const PERFILES_VALIDOS = ['favorable', 'promedio', 'negativo'];
const SEED_PERFIL = (process.env.SEED_PERFIL || 'favorable').toLowerCase();
if (!PERFILES_VALIDOS.includes(SEED_PERFIL)) {
  console.error(`SEED_PERFIL inválido: "${SEED_PERFIL}" — usa favorable, promedio o negativo.`);
  process.exit(1);
}
const SEED_MESES = Number(process.env.SEED_MESES || 6);
const SEMILLA_PRNG = Number(process.env.SEED_SEMILLA || 20240401);

// pendiente: variación de la venta base por mes transcurrido (16% = mismo
// crecimiento agresivo que ya tenía el script). gastoMultiplicador: escala
// los gastos fijos/variables para que la utilidad neta del perfil tenga la
// forma esperada (negativo = gastos pesan más que unas ventas que además
// bajan). ajuste 'piso'/'techo': fuerza la tendencia mes contra mes más
// allá del ruido del PRNG (igual que ya hacía el script solo para
// favorable) — 'promedio' no fuerza nada, se queda con el ruido natural.
const PERFIL_CONFIG = {
  favorable: { pendiente: 0.16, gastoMultiplicador: 1.0, ajuste: 'piso', ajusteFactor: 1.12 },
  promedio: { pendiente: 0.01, gastoMultiplicador: 1.32, ajuste: null, ajusteFactor: 1 },
  negativo: { pendiente: -0.045, gastoMultiplicador: 1.75, ajuste: 'techo', ajusteFactor: 0.95 },
};
const perfilActivo = PERFIL_CONFIG[SEED_PERFIL];

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
function round2(n) { return Math.round(n * 100) / 100; }

// Selección ponderada: los productos/servicios con peso 0 NUNCA se venden
// (dead stock real, no solo "poco probable") — quedan fuera del acumulado.
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

// Escuela privada con Maternal/Kinder/Primaria/Secundaria — conceptos de
// venta que cubren tanto colegiaturas/servicios como productos (uniformes,
// útiles) vendidos en la misma "Registrar venta".
const CONCEPTOS_VENTA = [
  'Colegiatura mensual', 'Venta de uniformes', 'Venta de útiles escolares',
  'Inscripción de nuevo ciclo escolar', 'Curso de verano', 'Transporte escolar',
  'Servicio de comedor', 'Papelería y materiales didácticos', 'Taller extracurricular',
  'Clases de regularización', 'Renovación de credencial', 'Evento escolar (kermés/graduación)',
];

// Ventas típicas de una escuela: la mayoría son un artículo suelto o una
// colegiatura; pocas veces se junta uniforme completo + libros o varios
// hermanos en una sola venta — montos mucho más chicos que un negocio de
// cómputo, a propósito (realismo del giro).
function montoVenta() {
  const dado = prng();
  if (dado < 0.45) return azarEntre(300, 1200);
  if (dado < 0.78) return azarEntre(1200, 3200);
  if (dado < 0.94) return azarEntre(3200, 7000);
  return azarEntre(7000, 15000);
}

// 12 PRODUCTOS (uniformes/papelería, con existencia física real) — "peso"
// deliberadamente desparejo para que existan un top-5 y un bottom-5 claros
// en "Más vendido y menos movido" (D9). peso=0 o casi 0 => dead stock real.
const CATALOGO = [
  { sku: 'PAP-KIT-006', nombre: 'Kit de útiles escolares',           categoria: 'Papelería y útiles', costo: 220, precio: 350, stock: 200, peso: 28 },
  { sku: 'UNIF-POL-002', nombre: 'Playera polo institucional',       categoria: 'Uniformes',          costo: 140, precio: 220, stock: 220, peso: 25 },
  { sku: 'PAP-CUA-008', nombre: 'Cuaderno profesional (paq. de 5)',  categoria: 'Papelería y útiles', costo: 90,  precio: 150, stock: 260, peso: 20 },
  { sku: 'UNIF-DEP-001', nombre: 'Uniforme deportivo completo',      categoria: 'Uniformes',          costo: 320, precio: 480, stock: 150, peso: 22 },
  { sku: 'UNIF-EDF-012', nombre: 'Playera de educación física',      categoria: 'Uniformes',          costo: 120, precio: 200, stock: 160, peso: 18 },
  { sku: 'PAP-LIB-007', nombre: 'Paquete de libros de texto',        categoria: 'Papelería y útiles', costo: 650, precio: 950, stock: 110, peso: 16 },
  { sku: 'UNIF-SUE-003', nombre: 'Suéter escolar institucional',     categoria: 'Uniformes',          costo: 260, precio: 380, stock: 130, peso: 14 },
  { sku: 'UNIF-MOC-005', nombre: 'Mochila institucional',            categoria: 'Uniformes',          costo: 380, precio: 590, stock: 100, peso: 10 },
  { sku: 'PAP-AGE-009', nombre: 'Agenda escolar institucional',      categoria: 'Papelería y útiles', costo: 60,  precio: 110, stock: 170, peso: 9 },
  { sku: 'PAP-ART-010', nombre: 'Kit de arte y manualidades',        categoria: 'Papelería y útiles', costo: 150, precio: 250, stock: 90,  peso: 6 },
  { sku: 'UNIF-CHA-004', nombre: 'Chamarra institucional',           categoria: 'Uniformes',          costo: 480, precio: 690, stock: 60,  peso: 2 },
  { sku: 'PAP-TER-011', nombre: 'Termo institucional',               categoria: 'Papelería y útiles', costo: 90,  precio: 160, stock: 100, peso: 0 },
];

// 10 SERVICIOS (sin existencia/costeo — D11: nunca generan movimiento de
// inventario) — colegiaturas por nivel (Maternal/Kinder/Primaria/
// Secundaria) + inscripción/transporte/comedor/talleres/regularización.
// Unidad "Paquete" (mensualidad/curso completo, entera) salvo tutoría, que
// se cobra por "Hora" (punto 298: 2do cobro válido para tipo=servicio).
const SERVICIOS = [
  { sku: 'SERV-PRI-003', nombre: 'Colegiatura Primaria (mensualidad)',        categoria: 'Servicios educativos', precio: 3400, peso: 26, unidad: 'Paquete' },
  { sku: 'SERV-KIN-002', nombre: 'Colegiatura Kinder (mensualidad)',          categoria: 'Servicios educativos', precio: 3100, peso: 22, unidad: 'Paquete' },
  { sku: 'SERV-MAT-001', nombre: 'Colegiatura Maternal (mensualidad)',        categoria: 'Servicios educativos', precio: 2800, peso: 20, unidad: 'Paquete' },
  { sku: 'SERV-SEC-004', nombre: 'Colegiatura Secundaria (mensualidad)',      categoria: 'Servicios educativos', precio: 3800, peso: 18, unidad: 'Paquete' },
  { sku: 'SERV-TRA-006', nombre: 'Transporte escolar (mensualidad)',          categoria: 'Servicios educativos', precio: 950,  peso: 14, unidad: 'Paquete' },
  { sku: 'SERV-COM-007', nombre: 'Servicio de comedor (mensualidad)',         categoria: 'Servicios educativos', precio: 1100, peso: 12, unidad: 'Paquete' },
  { sku: 'SERV-ING-009', nombre: 'Taller de inglés extracurricular',          categoria: 'Servicios educativos', precio: 650,  peso: 10, unidad: 'Paquete' },
  { sku: 'SERV-TUT-010', nombre: 'Clases de regularización / tutoría',        categoria: 'Servicios educativos', precio: 250,  peso: 8,  unidad: 'Hora' },
  { sku: 'SERV-INS-005', nombre: 'Inscripción anual del ciclo escolar',       categoria: 'Servicios educativos', precio: 4200, peso: 6,  unidad: 'Paquete' },
  { sku: 'SERV-VER-008', nombre: 'Curso de verano',                          categoria: 'Servicios educativos', precio: 1800, peso: 4,  unidad: 'Paquete' },
];

// Mismas 10 categorías ya sembradas en `categorias_gastos` (nunca se
// tocan/renombran — solo se reusa el slug con texto/proveedor de escuela).
const GASTOS_FIJOS = [
  { categoria: 'renta', proveedor: 'Inmobiliaria Educativa del Centro', concepto: 'Renta de instalaciones escolares', min: 15000, max: 17000, dia: () => azarEntero(2, 5), recurrente: true },
  // Nómina desglosada por área (antes 1 sola línea genérica) — mismo
  // slug `nomina` de siempre (categorías nunca se tocan), solo más
  // variedad de conceptos/proveedores reales de una escuela. Suma
  // aproximada por quincena similar a la línea única de antes
  // (32,000-38,000), repartida entre las 5 áreas reales del plantel.
  { categoria: 'nomina', proveedor: 'Nómina docente', concepto: 'Nómina docentes Primaria - primera quincena', min: 9000, max: 11000, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina docente', concepto: 'Nómina docentes Primaria - segunda quincena', min: 9000, max: 11000, dia: () => azarEntero(26, 28), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina docente', concepto: 'Nómina docentes Secundaria - primera quincena', min: 7500, max: 9500, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina docente', concepto: 'Nómina docentes Secundaria - segunda quincena', min: 7500, max: 9500, dia: () => azarEntero(26, 28), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina docente', concepto: 'Nómina docentes Maternal y Kinder - primera quincena', min: 6500, max: 8000, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina docente', concepto: 'Nómina docentes Maternal y Kinder - segunda quincena', min: 6500, max: 8000, dia: () => azarEntero(26, 28), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina administrativa', concepto: 'Nómina personal administrativo y dirección - primera quincena', min: 5500, max: 7000, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina administrativa', concepto: 'Nómina personal administrativo y dirección - segunda quincena', min: 5500, max: 7000, dia: () => azarEntero(26, 28), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina de apoyo', concepto: 'Nómina intendencia y mantenimiento - primera quincena', min: 3500, max: 4500, dia: () => azarEntero(14, 16), recurrente: true },
  { categoria: 'nomina', proveedor: 'Nómina de apoyo', concepto: 'Nómina intendencia y mantenimiento - segunda quincena', min: 3500, max: 4500, dia: () => azarEntero(26, 28), recurrente: true },
];

const GASTOS_VARIABLES = [
  { categoria: 'software', proveedores: ['Google Workspace for Education', 'Microsoft 365 Educación', 'Sistema de Control Escolar SAE'], concepto: 'Plataforma de gestión escolar y calificaciones', min: 800, max: 4500, vecesMes: [1, 2], recurrente: true },
  { categoria: 'hosting', proveedores: ['Classroom Cloud MX', 'Moodle Cloud', 'EduHost'], concepto: 'Hospedaje de plataforma de aprendizaje en línea', min: 400, max: 2600, vecesMes: [1, 2], recurrente: true },
  { categoria: 'servicios', proveedores: ['CFE', 'Telmex', 'Agua de la Ciudad'], concepto: 'Servicios básicos del plantel (agua, luz, internet)', min: 500, max: 3500, vecesMes: [1, 3], recurrente: true },
  { categoria: 'papeleria', proveedores: ['Office Depot', 'Distribuidora Escolar del Bajío', 'Lumen'], concepto: 'Material didáctico y papelería institucional', min: 300, max: 2800, vecesMes: [1, 2], recurrente: false },
  { categoria: 'combustible', proveedores: ['Gasolinera Pemex', 'BP Morelia'], concepto: 'Combustible de transporte escolar', min: 700, max: 3200, vecesMes: [1, 3], recurrente: false },
  { categoria: 'viaticos', proveedores: ['Hotel Vista Express', 'Aeroméxico', 'Uber'], concepto: 'Capacitación y viáticos del personal docente', min: 900, max: 4000, vecesMes: [0, 2], recurrente: false },
  { categoria: 'publicidad', proveedores: ['Meta Ads', 'Google Ads', 'Radio Local FM'], concepto: 'Campaña de inscripciones y difusión', min: 1200, max: 5000, vecesMes: [0, 1], recurrente: false },
  { categoria: 'otro', proveedores: ['Mantenimiento Integral SA', 'Producciones Escolares', 'Varios SA de CV'], concepto: 'Mantenimiento, limpieza y eventos del plantel', min: 200, max: 2500, vecesMes: [0, 2], recurrente: false },
];

async function borrarDatosTransaccionales() {
  console.log(`Borrando datos transaccionales de ${process.env.DB_NAME || 'portal_facturacion'} (config/usuarios NO se tocan)...`);
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
    ['Familia Demo Principal (Escuela)', RFC_DEMO_PRINCIPAL, EMAIL_DEMO_PRINCIPAL, ahora, ahora]
  );
  await conexion.query(
    `INSERT INTO registros
       (nombre, tipo_persona, rfc, email, archivo_nombre_original, archivo_nombre_guardado,
        archivo_mime, archivo_tamano_bytes, regimen_fiscal, codigo_postal, uso_cfdi,
        eliminado_en, creado_en, actualizado_en)
     VALUES (?, 'fisica', ?, ?, 'constancia-demo.pdf', 'constancia-demo-placeholder-2.pdf',
             'application/pdf', 51200, NULL, NULL, NULL, NULL, ?, ?)`,
    ['Familia Demo Secundaria (Escuela)', RFC_DEMO_SECUNDARIO, EMAIL_DEMO_SECUNDARIO, ahora, ahora]
  );
  console.log(`Registros demo listos para pruebas manuales de correo real:`);
  console.log(`  RFC ${RFC_DEMO_PRINCIPAL} -> ${EMAIL_DEMO_PRINCIPAL} (con historial de ventas/tickets)`);
  console.log(`  RFC ${RFC_DEMO_SECUNDARIO} -> ${EMAIL_DEMO_SECUNDARIO} (limpio, sin historial)`);
  console.log('  NOTA: ninguna de las 2 constancias tiene archivo real en MinIO (placeholder) — descargarla dará 404.\n');
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

  console.log(`Catálogo sembrado: ${productos.length} productos + ${servicios.length} servicios, ${categoriasNombres.length} categorías, almacén ${almacenId}.\n`);
  return { productos, servicios, almacenId };
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

// Archiva un periodo (YYYY-MM) exactamente como cierreMensual.js
// (ordenAItemArchivado/gastoAItemArchivado + guardarReporte tipo
// 'cierre_mensual'), pero SIN pasar por generarYEnviarReporte — nunca
// dispara un correo real, sin importar qué tenga configurado este
// entorno en "Correo de reportes".
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

// Día del mes con más ventas reales cercano al 15 — determinista (solo
// depende de los datos ya sembrados, no de Math.random ni de la hora
// real), para elegir un buen día de ejemplo para "Corte del día".
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

// Genera un "Corte del día" real (mismo cálculo que
// POST /api/admin/reportes/corte) para un solo día — funciona igual con
// ventas ya archivadas por el cierre mensual (el corte nunca filtra
// archivado_en, es una fotografía puntual por fecha).
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

// Guarda un reporte de auditoría con items accion:'eliminado' — igual que
// dejaría la retención automática de tickets (tipo 'automatico') o borrar
// una venta a mano (tipo 'manual') ANTES de borrar el registro real. No
// borra nada real: solo deja el rastro en "Todo lo eliminado", tal como
// quedaría si esas filas de verdad se hubieran borrado en su momento.
async function sembrarReporteEliminado(tipo, items, fechaGeneracion, zonaHoraria) {
  const tiempos = items.map((i) => new Date(i.fecha_registro).getTime());
  const rangoInicio = new Date(Math.min(...tiempos));
  const rangoFin = new Date(Math.max(...tiempos));
  const mdContenido = generarContenidoMD({ tipo, fechaGeneracion, rangoInicio, rangoFin, items, zonaHoraria });
  await guardarReporte({ tipo, fechaGeneracion, rangoInicio, rangoFin, items, mdContenido, correoEnviadoA: null, correoEnviado: false });
}

async function sembrarEliminadosDemo(llavesOrdenadas, zonaHoraria) {
  if (llavesOrdenadas.length === 0) return;

  const llaveA = llavesOrdenadas[Math.floor(llavesOrdenadas.length * 0.2)];
  const [anioA, mesA] = llaveA.split('-').map(Number);
  const fechaA = fechaUtc(anioA, mesA - 1, 12, 11, 30);
  await sembrarReporteEliminado('manual', [{
    tipo_registro: 'orden_compra', identificador: `OC-DEMO-${llaveA}`, rfc: 'familia.perez@example.com',
    estatus_o_concepto: 'Colegiatura duplicada por error de captura', monto: 3400,
    fecha_registro: fechaA, atendido_por: 'admin', accion: 'eliminado',
  }], fechaA, zonaHoraria);

  const llaveB = llavesOrdenadas[Math.floor(llavesOrdenadas.length * 0.6)];
  const [anioB, mesB] = llaveB.split('-').map(Number);
  const fechaB = fechaUtc(anioB, mesB - 1, 20, 16, 10);
  await sembrarReporteEliminado('manual', [{
    tipo_registro: 'orden_compra', identificador: `OC-DEMO-${llaveB}`, rfc: 'familia.lopez@example.com',
    estatus_o_concepto: 'Venta de uniformes cancelada por cambio de talla', monto: 690,
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
    console.error('de portal_facturacion (config y usuarios NO se tocan) y vuelve a sembrar todo.');
    console.error('Es irreversible sin backup. Vuelve a correr con --confirmar si es lo que quieres:');
    console.error('  node scripts/sembrar-demo.js --confirmar');
    process.exit(1);
  }

  console.log(`Perfil: ${SEED_PERFIL} | Meses: ${SEED_MESES} | Semilla: ${SEMILLA_PRNG} | DB: ${process.env.DB_NAME || 'portal_facturacion'}\n`);

  await borrarDatosTransaccionales();

  const hoyUtc = new Date();
  const anioActual = hoyUtc.getUTCFullYear();
  const mesActual = hoyUtc.getUTCMonth();
  const inicio = new Date(Date.UTC(anioActual, mesActual - SEED_MESES, 1));
  // Por default el mes EN CURSO se deja completamente vacío (pedido
  // explícito de una sesión anterior — se registra a mano para probar el
  // flujo real, no datos sembrados). `SEED_INCLUIR_MES_ACTUAL=1` lo
  // extiende hasta AYER (nunca "hoy", para no pisar una venta real que se
  // capture manualmente el mismo día que se corre el script) — pedido
  // explícito de una sesión posterior, porque dejar el mes en curso en
  // $0.00 se leía como "no hay datos" en los KPIs/tarjetas de Resumen
  // financiero que muestran el mes actual (Utilidad neta, Cobranza del
  // mes, Ventas facturadas vs sin facturar, Distribución de gastos, Top
  // proveedores, los 4 KPI de encabezado). `Date.UTC(anio, mesActual, 0)`
  // = día 0 del mes actual = último día del mes ANTERIOR.
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

      // Tendencia base del perfil activo (favorable/promedio/negativo) —
      // ver PERFIL_CONFIG arriba. Clamp a 0.15 como piso de seguridad: con
      // muchos meses de ventana, un perfil "negativo" no debe llegar a
      // ventas negativas o en cero por la pendiente sola.
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

        // 65% de las ventas llevan 1-2 líneas de inventario (productos Y
        // servicios comparten el mismo pool ponderado — D8/D11).
        if (probabilidad(0.65)) {
          const numLineas = probabilidad(0.25) ? 2 : 1;
          const itemsElegidos = new Set();
          for (let i = 0; i < numLineas; i += 1) {
            const item = elegirPonderado(catalogoCompleto);
            if (itemsElegidos.has(item.id)) continue;
            itemsElegidos.add(item.id);
            let cantidadReal;
            if (item.tipo === 'servicio') {
              // Colegiatura/inscripción/transporte/comedor/taller = 1
              // "paquete" (un mes/curso); tutoría se cobra por hora.
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

    // Fuerza la tendencia mes contra mes más allá del ruido del PRNG —
    // 'piso' (favorable) garantiza al menos +12% para que la proyección de
    // ventas de Resumen financiero (solo extrapola los últimos 3 meses
    // CERRADOS) nunca se clave en $0 con un trimestre plano; 'techo'
    // (negativo) fuerza una baja real mes contra mes para que el
    // escenario de resultados negativos no dependa de que el ruido
    // aleatorio decida bajar por su cuenta. 'promedio' no define ajuste
    // (perfilActivo.ajuste === null): se queda con el ruido natural.
    // Solo escala cantidad/total/monto_cobrado del mes completo por el
    // mismo factor — conserva el ratio IVA/subtotal y el % ya cobrado de
    // cada venta.
    // Con SEED_INCLUIR_MES_ACTUAL=1, el mes en curso es siempre PARCIAL
    // (menos días que un mes cerrado) — nunca se le aplica el ajuste
    // piso/techo (lo dejaría con más ventas que un mes completo, sin
    // sentido); tampoco cuenta como "mes anterior" para el siguiente,
    // porque no hay siguiente.
    const llaveMesActual = incluirMesActual ? `${anioActual}-${String(mesActual + 1).padStart(2, '0')}` : null;
    if (perfilActivo.ajuste) {
      const llavesVentaOrdenadas = [...resumenPorMes.keys()].sort();
      let ventasAnterior = null;
      for (const llave of llavesVentaOrdenadas) {
        if (llave === llaveMesActual) continue;
        const fila = resumenPorMes.get(llave);
        const limite = ventasAnterior !== null ? ventasAnterior * perfilActivo.ajusteFactor : null;
        const violaPiso = perfilActivo.ajuste === 'piso' && limite !== null && fila.ventas < limite;
        const violaTecho = perfilActivo.ajuste === 'techo' && limite !== null && fila.ventas > limite;
        if (violaPiso || violaTecho) {
          const factor = limite / fila.ventas;
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
        ventasAnterior = fila.ventas;
      }
    }

    await conexion.commit();

    console.log('Siembra completada.');
    console.log(`  Ventas: ${contadorVentas}  |  Tickets: ${contadorTickets}  |  Gastos: ${contadorGastos}  |  Líneas de inventario/servicio: ${contadorLineasInventario}`);
    console.log('');
    console.log('Resumen por mes (subtotal ventas MXN | gastos capturados | tickets):');
    for (const llave of [...resumenPorMes.keys()].sort()) {
      const fila = resumenPorMes.get(llave);
      console.log(`  ${llave} | ventas $${fila.ventas.toFixed(2)} | gastos ${fila.gastos} | tickets ${fila.tickets}`);
    }

    // --- Reportes: cierre mensual archivado, "Corte del día" y
    // "Eliminados" — todo fuera de la transacción de arriba (usa `pool`
    // directo, mismo patrón que el código real de producción). ---
    const zonaHoraria = (await getConfiguracionGlobal()).zona_horaria;
    const llavesOrdenadas = [...resumenPorMes.keys()].sort();

    // Se archivan todos los meses MENOS los últimos 2 — así "Ventas"/
    // "Gastos"/CxC siguen mostrando actividad reciente sin archivar por
    // defecto, y los meses archivados alimentan el selector de "Periodo",
    // "Lectura de reportes" y el histórico de Resumen financiero.
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
