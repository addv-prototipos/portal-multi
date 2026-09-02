// Catálogo de campos mapeables del importador masivo (inventarios.md §34.3)
// Y diccionario de datos de la página de ayuda (§56). Módulo fuente ÚNICO a
// propósito: la página de ayuda y los sinónimos del wizard leen de AQUÍ —
// un campo nuevo aparece en ambos lugares el mismo día, sin mantener dos
// listas a mano (§56.1).
//
// `obligatorio: true` en unidad_base es "obligatorio con default": nunca
// queda vacío (cae a UNIDAD_BASE_DEFECTO de utils/inventario.js), pero SIGUE
// contando como campo obligatorio para la regla de confirmación de 34.3.1
// (una coincidencia difusa sobre un campo obligatorio siempre pide
// confirmación explícita, sku/nombre/unidad_base son los 3 candados).
//
// `etiqueta`/`explicacion_simple`/`ejemplo_valido`/`ejemplo_invalido_comun`
// son los 3 campos exclusivos de la ayuda que pide §56.1, sobre los
// metadatos técnicos que ya usaba el wizard (campo/obligatorio/sinonimos).
const CAMPOS_IMPORTABLES = [
  {
    campo: 'sku', obligatorio: true,
    sinonimos: ['sku', 'codigo', 'clave', 'cve', 'codigo_producto', 'codigo_articulo', 'clave_producto', 'clave_articulo', 'id_producto', 'product_code', 'product_sku', 'código de producto'],
    etiqueta: 'SKU / Clave',
    explicacion_simple: 'El código único que TÚ usas para identificar este producto. No lo genera el sistema — tú lo eliges. No se puede repetir entre dos productos distintos.',
    ejemplo_valido: 'TORN-M6-25MM',
    ejemplo_invalido_comun: 'Dejarlo igual que el nombre del producto (ej. "Tornillo") — dos productos distintos terminan con el mismo SKU.',
  },
  {
    campo: 'nombre', obligatorio: true,
    sinonimos: ['nombre', 'descripcion', 'producto', 'articulo', 'concepto', 'nombre_producto', 'descripcion_producto', 'product_name', 'item', 'item_name', 'nombre_articulo'],
    etiqueta: 'Nombre',
    explicacion_simple: 'Cómo se llama el producto para quien lo ve en pantalla — ventas, tickets, reportes. Debe ser claro por sí solo, sin depender del SKU para entenderlo.',
    ejemplo_valido: 'Tornillo M6 de 25mm',
    ejemplo_invalido_comun: 'Usar solo el código o una abreviatura ("TM625") — no se entiende sin ver también el SKU.',
  },
  {
    campo: 'codigo_barras', obligatorio: false,
    sinonimos: ['codigo_barras', 'barcode', 'ean', 'upc', 'gtin', 'cod_barras', 'código_de_barras', 'ean13'],
    etiqueta: 'Código de barras',
    explicacion_simple: 'El código que imprime la etiqueta física del producto (el que lee una pistola escáner). Opcional — solo si el producto trae uno.',
    ejemplo_valido: '7501234567890',
    ejemplo_invalido_comun: 'Confundirlo con el SKU y capturar el mismo valor en los dos campos.',
  },
  {
    campo: 'descripcion_corta', obligatorio: false,
    sinonimos: ['descripcion_corta', 'resumen', 'subtitulo'],
    etiqueta: 'Descripción corta',
    explicacion_simple: 'Una frase breve que amplía el nombre — para listas y vistas rápidas donde no cabe un párrafo completo.',
    ejemplo_valido: 'Rosca fina, cabeza hexagonal',
    ejemplo_invalido_comun: 'Repetir exactamente el nombre del producto sin agregar información nueva.',
  },
  {
    campo: 'descripcion_larga', obligatorio: false,
    sinonimos: ['descripcion_larga', 'detalle', 'notas_comerciales', 'descripcion_completa', 'ficha'],
    etiqueta: 'Descripción larga',
    explicacion_simple: 'El detalle completo del producto — especificaciones, usos, materiales. Para cuando se necesita toda la información, no un resumen.',
    ejemplo_valido: 'Tornillo de acero inoxidable grado 18-8, rosca fina, cabeza hexagonal, resistente a la corrosión. Ideal para exteriores.',
    ejemplo_invalido_comun: 'Dejarlo vacío y duplicar ahí la descripción corta.',
  },
  {
    campo: 'marca', obligatorio: false,
    sinonimos: ['marca', 'brand', 'marca_producto'],
    etiqueta: 'Marca',
    explicacion_simple: 'El nombre de la marca comercial del producto, si aplica.',
    ejemplo_valido: 'Truper',
    ejemplo_invalido_comun: 'Confundirla con el nombre del proveedor que te lo vende (ese es otro campo).',
  },
  {
    campo: 'fabricante', obligatorio: false,
    sinonimos: ['fabricante', 'manufacturer', 'maker'],
    etiqueta: 'Fabricante',
    explicacion_simple: 'Quién produce físicamente el producto — puede ser distinto de la marca comercial y del proveedor que te lo vende a ti.',
    ejemplo_valido: 'Industrias Acme S.A. de C.V.',
    ejemplo_invalido_comun: 'Repetir el mismo valor que "Marca" cuando en realidad son empresas distintas.',
  },
  {
    campo: 'modelo', obligatorio: false,
    sinonimos: ['modelo', 'model', 'referencia'],
    etiqueta: 'Modelo',
    explicacion_simple: 'El número o clave de modelo que usa el fabricante, distinto de tu propio SKU.',
    ejemplo_valido: 'M6-25-INOX',
    ejemplo_invalido_comun: 'Capturar ahí tu propio SKU en vez del modelo real del fabricante.',
  },
  {
    campo: 'categoria', obligatorio: false,
    sinonimos: ['categoria', 'familia', 'linea', 'rubro', 'grupo', 'category', 'departamento', 'clasificacion'],
    etiqueta: 'Categoría',
    explicacion_simple: 'El grupo o familia a la que pertenece el producto, para organizar tu catálogo y filtrar reportes. Si la escribes y no existe todavía, se crea sola.',
    ejemplo_valido: 'Ferretería',
    ejemplo_invalido_comun: 'Escribir la misma categoría con variaciones ("Ferreteria", "ferretería", "FERRETERIA") — cada variación crea una categoría distinta.',
  },
  {
    campo: 'unidad_base', obligatorio: true,
    sinonimos: ['unidad', 'unidad_medida', 'um', 'u_m', 'presentacion', 'unit', 'uom'],
    etiqueta: 'Unidad de medida',
    explicacion_simple: 'Cómo se cuenta o mide el producto: piezas, kilos, litros, metros. Si no la escribes, se asume "Pieza". A diferencia de la categoría, la unidad NUNCA se crea sola — debe ser una de las que ya existen en el sistema.',
    ejemplo_valido: 'Kilogramo',
    ejemplo_invalido_comun: 'Inventar una unidad que no está en el catálogo del sistema (ej. "bulto") — se rechaza la fila en vez de crearla.',
  },
  {
    campo: 'tipo', obligatorio: false,
    sinonimos: ['tipo', 'tipo_producto', 'tipo_articulo', 'es_servicio'],
    etiqueta: 'Tipo (solo "producto")',
    explicacion_simple: 'La carga masiva es solo para artículos físicos que se guardan en el almacén ("producto"). Los servicios (algo que se vende pero no tiene existencia, como una instalación o una revisión) siempre se dan de alta a mano desde "Nuevo producto" — una fila marcada "servicio" se rechaza aquí. Si no se especifica, se asume "producto".',
    ejemplo_valido: 'producto',
    ejemplo_invalido_comun: 'Marcar una fila como "servicio" — la carga masiva la rechaza completa (INV_IMPORT_SERVICIO_NO_PERMITIDO); da de alta ese servicio a mano.',
  },
  {
    campo: 'costo', obligatorio: false,
    sinonimos: ['costo', 'cost', 'ultimo_costo', 'costo_unitario', 'precio_compra'],
    etiqueta: 'Costo',
    explicacion_simple: 'Lo que a TI te cuesta comprar o producir una unidad — nunca lo que le cobras al cliente (eso es el precio). Si traes existencia inicial en la misma fila, este costo se usa para valuar esa entrada.',
    ejemplo_valido: '120.00',
    ejemplo_invalido_comun: 'Capturar ahí el precio de venta en vez del costo de compra.',
  },
  {
    campo: 'precio', obligatorio: false,
    sinonimos: ['precio', 'pvp', 'precio_venta', 'precio1', 'price', 'precio_publico'],
    etiqueta: 'Precio',
    explicacion_simple: 'Lo que le cobras al cliente por una unidad.',
    ejemplo_valido: '250.00',
    ejemplo_invalido_comun: 'Incluir el símbolo de moneda o separadores de miles ("$250.00", "$1,250") — algunos formatos lo rechazan, mejor solo el número.',
  },
  {
    campo: 'stock_minimo', obligatorio: false,
    sinonimos: ['minimo', 'min', 'stock_min', 'existencia_minima'],
    etiqueta: 'Stock mínimo',
    explicacion_simple: 'La cantidad mínima que quieres tener siempre disponible — si la existencia baja de aquí, el sistema lo marca como "bajo mínimo".',
    ejemplo_valido: '5',
    ejemplo_invalido_comun: 'Poner un mínimo más alto que el máximo por error de captura.',
  },
  {
    campo: 'stock_maximo', obligatorio: false,
    sinonimos: ['maximo', 'max', 'stock_max', 'existencia_maxima'],
    etiqueta: 'Stock máximo',
    explicacion_simple: 'La cantidad tope que planeas tener en existencia — útil como referencia al decidir cuánto reabastecer.',
    ejemplo_valido: '50',
    ejemplo_invalido_comun: 'Dejarlo igual al mínimo, sin dejar margen real entre ambos.',
  },
  {
    campo: 'punto_reorden', obligatorio: false,
    sinonimos: ['reorden', 'punto_reorden', 'punto_de_reorden'],
    etiqueta: 'Punto de reorden',
    explicacion_simple: 'La cantidad en la que deberías empezar a pedir más — normalmente un poco por arriba del mínimo, para que te dé tiempo de reabastecer antes de quedarte en cero.',
    ejemplo_valido: '10',
    ejemplo_invalido_comun: 'Confundirlo con el stock mínimo y capturar el mismo número en los dos campos.',
  },
  {
    campo: 'proveedor_principal', obligatorio: false,
    sinonimos: ['proveedor', 'distribuidor', 'supplier', 'vendor'],
    etiqueta: 'Proveedor principal',
    explicacion_simple: 'De quién compras normalmente este producto. Es texto libre — todavía no existe un catálogo de proveedores en el sistema.',
    ejemplo_valido: 'Ferretería El Tornillo SA de CV',
    ejemplo_invalido_comun: 'Capturar ahí el fabricante en vez de quién te lo vende a ti — pueden ser empresas distintas.',
  },
  {
    campo: 'existencia_inicial', obligatorio: false,
    sinonimos: ['existencia', 'stock', 'cantidad', 'inventario', 'existencias', 'existencia_actual', 'cant_disponible', 'qty', 'quantity'],
    etiqueta: 'Existencia inicial',
    explicacion_simple: 'Cuántas unidades tienes HOY de este producto, al momento de darlo de alta o importarlo. Solo se usa una vez — para arrancar el conteo; después, la existencia real se lleva sola con cada venta, compra o ajuste.',
    ejemplo_valido: '20',
    ejemplo_invalido_comun: 'Volver a capturarla en una reimportación posterior del mismo catálogo — el sistema la ignora a propósito para no duplicar tu inventario.',
  },
  {
    campo: 'estado', obligatorio: false,
    sinonimos: ['estado', 'estatus', 'activo', 'status'],
    etiqueta: 'Estado (activo/inactivo)',
    explicacion_simple: 'Si el producto sigue disponible para venderse ("activo") o ya no ("inactivo") — sin borrarlo del catálogo. Si no se especifica, se asume "activo".',
    ejemplo_valido: 'inactivo',
    ejemplo_invalido_comun: 'Usar "inactivo" para un producto que en realidad se agotó — eso es existencia en cero, no un cambio de estado.',
  },
  {
    campo: 'notas', obligatorio: false,
    sinonimos: ['notas', 'observaciones', 'comentario', 'comments', 'nota'],
    etiqueta: 'Notas',
    explicacion_simple: 'Cualquier comentario interno sobre el producto que no tiene un campo propio todavía.',
    ejemplo_valido: 'Producto de temporada, solo se pide de noviembre a enero.',
    ejemplo_invalido_comun: 'Usarlo para guardar datos que sí tienen su propio campo (ej. el proveedor) en vez de capturarlos ahí.',
  },
];

const CAMPOS_OBLIGATORIOS = CAMPOS_IMPORTABLES.filter((c) => c.obligatorio).map((c) => c.campo);
const CAMPOS_NUMERICOS = ['costo', 'precio', 'stock_minimo', 'stock_maximo', 'punto_reorden', 'existencia_inicial'];

// Presets de sistema origen (34.3.3): NO inventan sinónimos nuevos sin
// verificar contra un archivo real — reordenan, dentro del MISMO diccionario
// de arriba, cuáles sinónimos se revisan primero para ese sistema. Es una
// ayuda de arranque, no una fuente de sinónimos paralela; si un preset no
// aporta nada para un campo, ese campo sigue el orden normal.
const PRESETS_SISTEMA = {
  contpaqi: { 'sku': ['codigo_articulo', 'clave_articulo'], 'nombre': ['descripcion_producto', 'nombre_articulo'], 'existencia_inicial': ['existencia_actual'] },
  aspel: { 'sku': ['clave_producto', 'clave_articulo'], 'nombre': ['descripcion', 'nombre_articulo'], 'costo': ['costo_unitario'] },
  excel_generico: {},
  otro: {},
};

function ordenarSinonimosPorPreset(campoDef, presetSistema) {
  const boost = (PRESETS_SISTEMA[presetSistema] && PRESETS_SISTEMA[presetSistema][campoDef.campo]) || [];
  if (boost.length === 0) return campoDef.sinonimos;
  const resto = campoDef.sinonimos.filter((s) => !boost.includes(s));
  return [...boost, ...resto];
}

// ---------------------------------------------------------------------
// Diccionario de datos (§56) — conceptos operativos que NO son columnas
// mapeables del importador (existencias/movimientos/mecánica de
// importación en sí) pero sí necesitan su tarjeta en la página de ayuda,
// per §56.3 grupos 2 y 3. Viven aparte de CAMPOS_IMPORTABLES a propósito:
// mezclar "columnas reales de una fila" con "conceptos del sistema" en el
// mismo arreglo habría complicado sugerirMapeoCompleto() sin necesidad —
// el wizard de mapeo (§34.3) solo necesita las columnas de arriba.
const CONCEPTOS_AYUDA = [
  {
    id: 'existencia_disponible', grupo: 'existencias',
    etiqueta: 'Existencia disponible',
    explicacion_simple: 'Cuántas unidades tienes AHORA MISMO de un producto. Nunca se edita directamente — sube o baja sola cada vez que registras una entrada, una salida o un ajuste.',
    ejemplo_valido: 'Se actualiza sola al vender, comprar o ajustar — no hay un botón para escribirla a mano.',
    ejemplo_invalido_comun: 'Buscar cómo "corregir" la existencia directamente cuando en realidad hay que registrar un ajuste que explique la diferencia.',
  },
  {
    id: 'historial_de_movimientos', grupo: 'existencias',
    etiqueta: 'Historial de movimientos',
    explicacion_simple: 'La bitácora completa de todo lo que le ha pasado a un producto: cada entrada, salida y ajuste, en orden, con quién lo hizo y cuándo. Sirve para entender por qué la existencia quedó en el número que ves hoy.',
    ejemplo_valido: 'Ver el historial de un producto para confirmar cuándo y por qué bajó su existencia.',
    ejemplo_invalido_comun: 'Esperar poder editar o borrar un movimiento ya registrado — es un libro histórico, no se modifica, solo se corrige con un movimiento nuevo.',
  },
  {
    id: 'entrada', grupo: 'existencias',
    etiqueta: 'Entrada',
    explicacion_simple: 'Cualquier movimiento que SUMA existencia: una compra, una devolución de un cliente, o el inventario inicial al dar de alta el producto.',
    ejemplo_valido: 'Registrar una compra de 50 piezas nuevas.',
    ejemplo_invalido_comun: 'Registrar como entrada algo que en realidad es una corrección — para eso existe el ajuste.',
  },
  {
    id: 'salida', grupo: 'existencias',
    etiqueta: 'Salida',
    explicacion_simple: 'Cualquier movimiento que RESTA existencia: una venta, un consumo interno, o una merma (producto dañado o perdido).',
    ejemplo_valido: 'Registrar una merma de 2 piezas que se dañaron en el almacén.',
    ejemplo_invalido_comun: 'Intentar registrar una salida mayor a la existencia disponible — el sistema la rechaza para no dejar números negativos.',
  },
  {
    id: 'costo_promedio', grupo: 'existencias',
    etiqueta: 'Costo promedio',
    explicacion_simple: 'El costo que el sistema calcula solo, combinando todas tus compras a distintos precios. Cada vez que registras una entrada con costo, se recalcula — nunca se edita a mano.',
    ejemplo_valido: 'Compraste 10 piezas a $10 y luego 10 más a $12 → el costo promedio queda en $11.',
    ejemplo_invalido_comun: 'Buscar un campo para "corregir" el costo promedio directamente — se ajusta solo, registrando una entrada más.',
  },
  {
    id: 'ajuste', grupo: 'existencias',
    etiqueta: 'Ajuste (positivo o negativo)',
    explicacion_simple: 'Un movimiento para corregir la existencia cuando un conteo físico no coincide con lo que dice el sistema — nunca se edita el número directamente, siempre queda un movimiento que explica el cambio.',
    ejemplo_valido: 'El conteo físico encontró 3 piezas más de las que decía el sistema → ajuste positivo de 3.',
    ejemplo_invalido_comun: 'Usar un ajuste para registrar una venta o una compra normal — esos ya tienen su propio tipo de movimiento.',
  },
  {
    id: 'fila_de_encabezados', grupo: 'importacion',
    etiqueta: 'Fila de encabezados',
    explicacion_simple: 'La fila de tu archivo (normalmente la primera) que trae el NOMBRE de cada columna — no datos de productos. El sistema la usa para saber qué información trae cada columna.',
    ejemplo_valido: 'sku, nombre, unidad, precio (como primera fila del archivo)',
    ejemplo_invalido_comun: 'Poner un título decorativo o el nombre de tu empresa en la primera fila — confunde la detección automática de la fila de encabezados.',
  },
  {
    id: 'mapeo_de_cabeceras', grupo: 'importacion',
    etiqueta: 'Mapeo de cabeceras',
    explicacion_simple: 'Es decirle al sistema qué columna de TU archivo corresponde a cada campo del sistema. El sistema lo intenta adivinar solo (por nombre exacto, por sinónimo conocido, o por parecido); tú confirmas o corriges antes de importar.',
    ejemplo_valido: 'Tu columna "Clave" se mapea al campo del sistema "SKU".',
    ejemplo_invalido_comun: 'Aceptar sin revisar una sugerencia marcada como "Sugerido, revisa" — esas son las que el sistema NO está seguro de haber adivinado bien.',
  },
  {
    id: 'dato_extra', grupo: 'importacion',
    etiqueta: 'Datos extra (columnas no mapeadas)',
    explicacion_simple: 'Cualquier columna de tu archivo que no corresponde a ningún campo del sistema. No se pierde: se guarda tal cual dentro del producto, visible en su detalle, por si la necesitas después.',
    ejemplo_valido: 'Una columna "código interno del sistema anterior" que no existe en este sistema se conserva como dato extra.',
    ejemplo_invalido_comun: 'Pensar que una columna no reconocida se descarta — se conserva salvo que desactives esa opción antes de importar.',
  },
  {
    id: 'perfil_de_mapeo', grupo: 'importacion',
    etiqueta: 'Perfil de mapeo guardado',
    explicacion_simple: 'Si vas a reimportar el mismo tipo de archivo seguido (por ejemplo, una exportación mensual de tu otro sistema), puedes guardar cómo mapeaste las columnas la primera vez. La próxima vez que subas un archivo con las mismas columnas, se aplica solo.',
    ejemplo_valido: 'Guardar el perfil "Exportación mensual Aspel" para no volver a mapear cada mes.',
    ejemplo_invalido_comun: 'Esperar que un perfil guardado funcione si tu archivo nuevo trae columnas distintas — solo se reaplica cuando las columnas coinciden.',
  },
  // §57: moneda del producto + conversión en la entrada. NO son columnas
  // del importador masivo (§34 sigue MXN-only, fuera de alcance de este
  // segmento) — viven aquí, no en CAMPOS_IMPORTABLES, pero SÍ tienen su
  // ícono "?" en "Crear producto" y en "Registrar entrada" (mismo
  // mecanismo .campo-ayuda[data-campo] del resto de la ayuda).
  {
    id: 'moneda', grupo: 'moneda_extranjera',
    etiqueta: 'Moneda',
    explicacion_simple: 'En qué moneda compras este producto: pesos (MXN, la mayoría) o dólares (USD, típico en importados). Se define por producto — puedes tener unos en MXN y otros en USD en el mismo catálogo.',
    ejemplo_valido: 'Un producto importado de EE.UU. en USD; el resto de tu catálogo nacional en MXN.',
    ejemplo_invalido_comun: 'Cambiar la moneda de un producto solo para "probar" — no rompe tu historial (ya quedó en pesos), pero sí puede confundir la próxima entrada si se te olvida que ahora pide dólares.',
  },
  {
    id: 'tipo_cambio', grupo: 'moneda_extranjera',
    etiqueta: 'Tipo de cambio aplicado',
    explicacion_simple: 'Cuántos pesos vale 1 dólar el día que registras una entrada de un producto en USD. El sistema lo precarga con el valor del día (Banco de México) pero lo puedes corregir antes de guardar. Queda guardado en esa entrada para siempre, aunque el tipo de cambio cambie después.',
    ejemplo_valido: '18.3542',
    ejemplo_invalido_comun: 'Dejarlo en blanco pensando que se calcula solo — sin tipo de cambio, no se puede convertir el costo a pesos.',
  },
  {
    id: 'costo_original', grupo: 'moneda_extranjera',
    etiqueta: 'Costo en la moneda original',
    explicacion_simple: 'Lo que pagaste por unidad en la moneda real de la compra (USD), antes de convertirlo a pesos. El sistema hace la multiplicación por ti: costo en USD × tipo de cambio = costo en pesos, que es el que alimenta tu costo promedio.',
    ejemplo_valido: '25.00 (USD)',
    ejemplo_invalido_comun: 'Capturar ahí el costo ya convertido a pesos — el campo espera el número tal cual viene en la factura del proveedor, en dólares.',
  },
];

// Diccionario completo (§56): 20 campos importables (grupo "catalogo",
// heredan sinonimos/obligatorio del wizard) + conceptos operativos de
// arriba. `id` es el ancla estable de cada tarjeta (#campo-sku, etc. —
// §56.4 "deep-linking real").
function obtenerDiccionarioInventario() {
  const camposComoDiccionario = CAMPOS_IMPORTABLES.map((c) => ({
    id: c.campo,
    grupo: 'catalogo',
    etiqueta: c.etiqueta,
    obligatorio: c.obligatorio,
    sinonimos: c.sinonimos,
    explicacion_simple: c.explicacion_simple,
    ejemplo_valido: c.ejemplo_valido,
    ejemplo_invalido_comun: c.ejemplo_invalido_comun,
  }));
  const conceptosComoDiccionario = CONCEPTOS_AYUDA.map((c) => ({
    id: c.id,
    grupo: c.grupo,
    etiqueta: c.etiqueta,
    obligatorio: null,
    sinonimos: [],
    explicacion_simple: c.explicacion_simple,
    ejemplo_valido: c.ejemplo_valido,
    ejemplo_invalido_comun: c.ejemplo_invalido_comun,
  }));
  return [...camposComoDiccionario, ...conceptosComoDiccionario];
}

module.exports = {
  CAMPOS_IMPORTABLES,
  CAMPOS_OBLIGATORIOS,
  CAMPOS_NUMERICOS,
  PRESETS_SISTEMA,
  ordenarSinonimosPorPreset,
  CONCEPTOS_AYUDA,
  obtenerDiccionarioInventario,
};
