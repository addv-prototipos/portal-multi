// Catálogo de campos mapeables del importador masivo (inventarios.md §34.3).
// Módulo fuente ÚNICO a propósito (§56 de inventarios.md): cuando la página
// de ayuda del segmento 8 exista, importará este mismo archivo para su
// diccionario de datos — un campo nuevo aparece en ambos lugares el mismo
// día, sin mantener dos listas a mano.
//
// `obligatorio: true` en unidad_base es "obligatorio con default": nunca
// queda vacío (cae a UNIDAD_BASE_DEFECTO de utils/inventario.js), pero SIGUE
// contando como campo obligatorio para la regla de confirmación de 34.3.1
// (una coincidencia difusa sobre un campo obligatorio siempre pide
// confirmación explícita, sku/nombre/unidad_base son los 3 candados).
const CAMPOS_IMPORTABLES = [
  { campo: 'sku', obligatorio: true, sinonimos: ['sku', 'codigo', 'clave', 'cve', 'codigo_producto', 'codigo_articulo', 'clave_producto', 'clave_articulo', 'id_producto', 'product_code', 'product_sku', 'código de producto'] },
  { campo: 'nombre', obligatorio: true, sinonimos: ['nombre', 'descripcion', 'producto', 'articulo', 'concepto', 'nombre_producto', 'descripcion_producto', 'product_name', 'item', 'item_name', 'nombre_articulo'] },
  { campo: 'codigo_barras', obligatorio: false, sinonimos: ['codigo_barras', 'barcode', 'ean', 'upc', 'gtin', 'cod_barras', 'código_de_barras', 'ean13'] },
  { campo: 'descripcion_corta', obligatorio: false, sinonimos: ['descripcion_corta', 'resumen', 'subtitulo'] },
  { campo: 'descripcion_larga', obligatorio: false, sinonimos: ['descripcion_larga', 'detalle', 'notas_comerciales', 'descripcion_completa', 'ficha'] },
  { campo: 'marca', obligatorio: false, sinonimos: ['marca', 'brand', 'marca_producto'] },
  { campo: 'fabricante', obligatorio: false, sinonimos: ['fabricante', 'manufacturer', 'maker'] },
  { campo: 'modelo', obligatorio: false, sinonimos: ['modelo', 'model', 'referencia'] },
  { campo: 'categoria', obligatorio: false, sinonimos: ['categoria', 'familia', 'linea', 'rubro', 'grupo', 'category', 'departamento', 'clasificacion'] },
  { campo: 'unidad_base', obligatorio: true, sinonimos: ['unidad', 'unidad_medida', 'um', 'u_m', 'presentacion', 'unit', 'uom'] },
  { campo: 'tipo', obligatorio: false, sinonimos: ['tipo', 'tipo_producto', 'tipo_articulo', 'es_servicio'] },
  { campo: 'costo', obligatorio: false, sinonimos: ['costo', 'cost', 'ultimo_costo', 'costo_unitario', 'precio_compra'] },
  { campo: 'precio', obligatorio: false, sinonimos: ['precio', 'pvp', 'precio_venta', 'precio1', 'price', 'precio_publico'] },
  { campo: 'stock_minimo', obligatorio: false, sinonimos: ['minimo', 'min', 'stock_min', 'existencia_minima'] },
  { campo: 'stock_maximo', obligatorio: false, sinonimos: ['maximo', 'max', 'stock_max', 'existencia_maxima'] },
  { campo: 'punto_reorden', obligatorio: false, sinonimos: ['reorden', 'punto_reorden', 'punto_de_reorden'] },
  { campo: 'proveedor_principal', obligatorio: false, sinonimos: ['proveedor', 'distribuidor', 'supplier', 'vendor'] },
  { campo: 'existencia_inicial', obligatorio: false, sinonimos: ['existencia', 'stock', 'cantidad', 'inventario', 'existencias', 'existencia_actual', 'cant_disponible', 'qty', 'quantity'] },
  { campo: 'estado', obligatorio: false, sinonimos: ['estado', 'estatus', 'activo', 'status'] },
  { campo: 'notas', obligatorio: false, sinonimos: ['notas', 'observaciones', 'comentario', 'comments', 'nota'] },
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

module.exports = {
  CAMPOS_IMPORTABLES,
  CAMPOS_OBLIGATORIOS,
  CAMPOS_NUMERICOS,
  PRESETS_SISTEMA,
  ordenarSinonimosPorPreset,
};
