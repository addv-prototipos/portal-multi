// Módulo "Gastos" (ver PROJECT_STATE.md): control administrativo de los
// gastos de la operación, con o sin factura/CFDI — no es un sistema
// contable, es una herramienta de control financiero operativo. Este
// archivo centraliza lo que comparten la tabla (backend/db.js), la
// validación del CRUD (backend/server.js) y los mensajes de error.
//
// Las categorías son una lista CERRADA que vive aquí en un solo lugar:
// ampliarla es agregar un slug + su etiqueta en ETIQUETAS_CATEGORIAS.
// `categoriaValida()` (usada por server.js) es la fuente de verdad para
// los endpoints, y `clausulaCheckCategoria()` alimenta el CHECK de MySQL
// (el esquema se mantiene al día con la misma migración "actualizar si
// quedó desactualizado" que ya usa chk_tickets_tipo_pago en db.js).

// Slug guardado en la base de datos (columna `categoria`); las etiquetas
// en español viven en el frontend (admin.js) y aquí, solo para mensajes
// de error del backend — mismo patrón de TIPOS_PAGO en server.js.
const CATEGORIAS_GASTOS = [
  'renta',
  'nomina',
  'software',
  'hosting',
  'servicios',
  'papeleria',
  'combustible',
  'viaticos',
  'publicidad',
  'otro',
];

const ETIQUETAS_CATEGORIAS = {
  renta: 'Renta',
  nomina: 'Nómina',
  software: 'Software',
  hosting: 'Hosting',
  servicios: 'Servicios',
  papeleria: 'Papelería',
  combustible: 'Combustible',
  viaticos: 'Viáticos',
  publicidad: 'Publicidad',
  otro: 'Otro',
};

const CLAVE_CHECK_CATEGORIA_GASTOS = 'chk_gastos_categoria';

function categoriaValida(categoria) {
  return typeof categoria === 'string' && CATEGORIAS_GASTOS.includes(categoria);
}

// Fragmento SQL del CHECK (los slugs son seguros: solo minúsculas/letras
// del alfabeto, definidas aquí mismo — no hay riesgo de inyección).
function clausulaCheckCategoria() {
  return `categoria IN (${CATEGORIAS_GASTOS.map((c) => `'${c}'`).join(', ')})`;
}

module.exports = {
  CATEGORIAS_GASTOS,
  ETIQUETAS_CATEGORIAS,
  CLAVE_CHECK_CATEGORIA_GASTOS,
  categoriaValida,
  clausulaCheckCategoria,
};