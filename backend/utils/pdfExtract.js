// pdf-parse se importa de forma diferida dentro de extraerTextoPdf (mas
// abajo), para que el resto de este modulo (regex de CP, catalogo de
// regimenes) se pueda usar/probar de forma independiente.

// Catálogo de Regímenes Fiscales del SAT (Anexo 20 CFDI). Incluye los de
// Persona Física y Persona Moral, ya que varían segun el tipo de
// contribuyente y no sabemos de antemano cuál aplica al PDF.
const REGIMENES_FISCALES = [
  { codigo: '601', nombre: 'General de Ley Personas Morales' },
  { codigo: '603', nombre: 'Personas Morales con Fines no Lucrativos' },
  { codigo: '605', nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { codigo: '606', nombre: 'Arrendamiento' },
  { codigo: '607', nombre: 'Régimen de Enajenación o Adquisición de Bienes' },
  { codigo: '608', nombre: 'Demás ingresos' },
  { codigo: '609', nombre: 'Consolidación' },
  { codigo: '610', nombre: 'Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { codigo: '611', nombre: 'Ingresos por Dividendos (socios y accionistas)' },
  { codigo: '612', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { codigo: '614', nombre: 'Ingresos por intereses' },
  { codigo: '615', nombre: 'Régimen de los ingresos por obtención de premios' },
  { codigo: '616', nombre: 'Sin obligaciones fiscales' },
  { codigo: '620', nombre: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { codigo: '621', nombre: 'Incorporación Fiscal' },
  { codigo: '622', nombre: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { codigo: '623', nombre: 'Opcional para Grupos de Sociedades' },
  { codigo: '624', nombre: 'Coordinados' },
  { codigo: '625', nombre: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { codigo: '626', nombre: 'Régimen Simplificado de Confianza' },
  { codigo: '628', nombre: 'Hidrocarburos' },
  { codigo: '629', nombre: 'De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales' },
  { codigo: '630', nombre: 'Enajenación de acciones en bolsa de valores' },
];

// Frases que solo deberían aparecer en documentos genuinos del SAT. No
// analizamos logotipos/imágenes (requeriría OCR o vision, fuera de alcance
// aquí): la validación se basa en el texto extraíble del PDF.
const INDICADORES_CONSTANCIA_SAT = [
  'cedula de identificacion fiscal',
  'constancia de situacion fiscal',
  'servicio de administracion tributaria',
  'registro federal de contribuyentes',
];

function normalizar(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Extrae el texto de un PDF a partir de su buffer.
 * Devuelve el texto (posiblemente vacio si el PDF es solo imagenes/escaneado
 * sin capa de texto), o null si el archivo no se pudo procesar como PDF.
 */
async function extraerTextoPdf(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const datos = await pdfParse(buffer);
    return datos.text || '';
  } catch (e) {
    return null;
  }
}

/**
 * Revisa si el texto contiene indicios de ser una Constancia de Situacion
 * Fiscal / Cedula de Identificacion Fiscal emitida por el SAT.
 */
function pareceConstanciaFiscal(texto) {
  const normalizado = normalizar(texto);
  return INDICADORES_CONSTANCIA_SAT.some((frase) => normalizado.includes(frase));
}

/**
 * Busca el codigo postal del domicilio fiscal en el texto del PDF.
 * Acepta variantes como "Código Postal:", "C.P.", "CP" seguidas de 5 digitos.
 */
function extraerCodigoPostal(texto) {
  const regex = /c[oó0]digo\s*postal[:\s]*?(\d{5})|c\.?\s*p\.?\s*[:\-]?\s*(\d{5})/i;
  const match = String(texto || '').match(regex);
  if (!match) return null;
  return match[1] || match[2] || null;
}

/**
 * Busca el RFC del contribuyente en el texto del PDF — el VALOR real
 * impreso en el documento (no solo si la etiqueta existe). Se usa para
 * validar que la constancia subida corresponda al mismo RFC de la sesión
 * (o del campo RFC del formulario, si no hay sesión activa), ya que la
 * relación entre un RFC y su constancia es 1 a 1 — no debería poder
 * asociarse la constancia de una persona a la cuenta de otra.
 *
 * Un RFC tiene un formato muy distintivo (3-4 letras + 6 dígitos + 3
 * caracteres alfanuméricos: `AAAA######AAA`), así que primero se busca
 * ese patrón en una ventana de texto alrededor de la etiqueta "Registro
 * Federal de Contribuyentes" (para evitar coincidir por error con algún
 * otro texto de formato parecido en el resto del documento), y si no se
 * encuentra ahí, se busca en todo el documento como respaldo.
 *
 * Devuelve el RFC en mayúsculas, o null si no se pudo determinar (el
 * llamador decide cómo manejarlo).
 */
function extraerRFC(texto) {
  const contenido = String(texto || '');
  if (!contenido.trim()) return null;

  const patronRFC = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/i;
  const patronEtiquetaRfc = /Registro\s+Federal\s+de\s+Contribuyentes\s*:?/i;

  const matchEtiqueta = contenido.match(patronEtiquetaRfc);
  if (matchEtiqueta) {
    const inicioVentana = Math.max(0, matchEtiqueta.index - 300);
    const finVentana = Math.min(contenido.length, matchEtiqueta.index + matchEtiqueta[0].length + 300);
    const ventana = contenido.slice(inicioVentana, finVentana);
    const matchCercano = ventana.match(patronRFC);
    if (matchCercano) return matchCercano[0].toUpperCase();
  }

  const matchGlobal = contenido.match(patronRFC);
  return matchGlobal ? matchGlobal[0].toUpperCase() : null;
}

/**
 * Busca en el texto todos los regimenes fiscales del catalogo del SAT que
 * aparezcan mencionados (por nombre), ya que un mismo contribuyente puede
 * tener mas de uno vigente, y el listado difiere entre persona fisica y
 * persona moral.
 */
function extraerRegimenesFiscales(texto) {
  const normalizado = normalizar(texto);
  const encontrados = [];
  for (const regimen of REGIMENES_FISCALES) {
    if (normalizado.includes(normalizar(regimen.nombre))) {
      encontrados.push(`${regimen.codigo} - ${regimen.nombre}`);
    }
  }
  return encontrados;
}

// Códigos del catálogo del SAT que son EXCLUSIVOS de Persona Moral (una
// persona física nunca puede estar dada de alta en ninguno de estos) —
// según el catálogo oficial "c_RegimenFiscal" del Anexo 20 de CFDI.
// El resto de los códigos son de Persona Física, o aplican a ambos tipos
// de contribuyente (ej. 610 Residentes en el Extranjero, 622 Actividades
// Agrícolas, 624 Coordinados, 626 RESICO, 629, 630) — para esos casos
// ambiguos, sin un código exclusivo de moral presente, se asume Persona
// Física, ya que es el caso más común y el resto de la constancia
// (formato del RFC de 13 caracteres) lo seguiría confirmando en la
// práctica. Esta es una simplificación práctica, no una determinación
// legal exacta para el pequeño número de códigos que de verdad aplican a
// ambos tipos de contribuyente.
const REGIMENES_EXCLUSIVOS_PERSONA_MORAL = ['601', '603', '609', '620', '623', '628'];

/**
 * A partir de la lista de regímenes fiscales ya encontrados en el texto
 * (mismo formato que devuelve extraerRegimenesFiscales: ["601 - General
 * de Ley Personas Morales", ...]), determina si el contribuyente es
 * Persona Física o Persona Moral. Devuelve null si no se encontró ningún
 * régimen (no hay nada de qué partir para calcularlo).
 */
function determinarTipoPersonaPorRegimen(regimenesEncontrados) {
  if (!Array.isArray(regimenesEncontrados) || regimenesEncontrados.length === 0) return null;
  const hayRegimenMoral = regimenesEncontrados.some((regimenTexto) => {
    const codigo = String(regimenTexto).split(' - ')[0].trim();
    return REGIMENES_EXCLUSIVOS_PERSONA_MORAL.includes(codigo);
  });
  return hayRegimenMoral ? 'moral' : 'fisica';
}

// Terminaciones legales que, por ley, solo puede traer la razón social de
// una PERSONA MORAL (una persona física nunca las tiene) — se evalúan
// sobre el texto ya sin puntos ni acentos, con límites de palabra (\b)
// para no confundir una terminación de 2-3 letras (ej. "sc", "ac") con
// parte de otra palabra más larga.
const TERMINACIONES_LEGALES_PERSONA_MORAL = [
  /\bsa\s*de\s*cv\b/,
  /\bsapi\s*de\s*cv\b/,
  /\bsab\s*de\s*cv\b/,
  /\bs\s*de\s*rl\s*de\s*cv\b/,
  /\bs\s*de\s*pr\s*de\s*rl\b/,
  /\bs\s*de\s*rl\b/,
  /\bsas\b/,
  /\bscp\b/,
  /\bsc\b/,
  /\bac\b/,
  /\biap\b/,
  /\bsnc\b/,
  /\bs\s*en\s*c\b/,
];

// Palabras que, sin necesariamente traer una terminación legal explícita
// en el texto extraído (a veces el PDF la corta o el patrón no la
// reconoce), casi siempre forman parte de un nombre comercial/corporativo
// y no del nombre de una persona.
const PALABRAS_CORPORATIVAS = [
  'grupo', 'corporativo', 'comercializadora', 'distribuidora',
  'constructora', 'industrias', 'consultores', 'soluciones',
  'desarrolladora', 'inmobiliaria', 'promotora', 'arrendadora',
  'fundacion', 'asociacion', 'inversiones', 'holding',
];

/**
 * Determina Persona Física/Moral a partir de la razón social, usando la
 * regla: si es un nombre propio (2 a 5 palabras, sin terminación legal ni
 * palabra corporativa) es Persona Física; si trae una terminación legal
 * de persona moral, o una palabra típicamente corporativa, es Persona
 * Moral. Devuelve null si el texto no permite concluir nada (vacío, una
 * sola palabra, o un texto inusualmente largo).
 */
function determinarTipoPersonaPorNombre(razonSocial) {
  if (!razonSocial || !razonSocial.trim()) return null;
  const texto = normalizar(razonSocial).replace(/\./g, '');

  if (TERMINACIONES_LEGALES_PERSONA_MORAL.some((patron) => patron.test(texto))) {
    return 'moral';
  }
  if (PALABRAS_CORPORATIVAS.some((palabra) => texto.includes(palabra))) {
    return 'moral';
  }

  const palabras = texto.split(' ').filter(Boolean);
  if (palabras.length >= 2 && palabras.length <= 5) {
    return 'fisica';
  }
  return null;
}

/**
 * Señal MÁS confiable de las tres: busca directamente en el texto del
 * documento las etiquetas de campo que el propio formato del SAT usa de
 * forma distinta según el tipo de contribuyente — una constancia de
 * Persona Física siempre trae los campos "Primer Apellido" y/o "Segundo
 * Apellido" (una persona moral no tiene apellidos, así que esos campos
 * nunca aparecen en su constancia); una constancia de Persona Moral trae
 * campos como "Régimen Capital" y/o "Nombre Comercial" (una persona
 * física no tiene régimen de capital ni ese campo en su constancia). A
 * diferencia del régimen fiscal o la razón social (que son señales
 * indirectas / heurísticas), esto lee directamente la ESTRUCTURA del
 * formulario que ya llenó el SAT, así que es la primera señal que se
 * revisa. Devuelve null si no se encontró ninguno de estos campos (poco
 * común, pero posible si el PDF viene con un layout distinto).
 */
function determinarTipoPersonaPorCamposDocumento(texto) {
  const normalizado = normalizar(texto);
  // OJO: se usa \s* (cero o más espacios), NO un espacio literal fijo.
  // El extractor de texto de PDF (pdf-parse) con frecuencia concatena
  // las celdas de una tabla SIN insertar ningún espacio entre ellas —
  // en una constancia real, "Régimen Capital:" se extrae literalmente
  // como "RegimenCapital:" (comprobado contra un PDF real de una
  // constancia de persona moral, donde justo esta etiqueta es la que
  // decide el resultado). Buscar la frase con un espacio fijo de por
  // medio nunca la habría encontrado, y el código caía silenciosamente a
  // las siguientes señales (régimen/razón social), que para esa
  // constancia en particular tampoco eran concluyentes — el resultado
  // final terminaba siendo el valor por defecto de
  // determinarTipoPersonaPorRegimen() en vez del correcto.
  if (/primer\s*apellido/.test(normalizado) || /segundo\s*apellido/.test(normalizado)) {
    return 'fisica';
  }
  if (/regimen\s*capital/.test(normalizado) || /nombre\s*comercial/.test(normalizado)) {
    return 'moral';
  }
  return null;
}

/**
 * Determina Persona Física/Moral combinando tres señales disponibles,
 * en orden de confiabilidad:
 *   1. Los CAMPOS del propio documento ("Primer/Segundo Apellido" para
 *      física; "Régimen Capital"/"Nombre Comercial" para moral) — la
 *      señal más directa, ya que lee la estructura real del formulario
 *      del SAT en vez de adivinar. Si es concluyente, gana siempre.
 *   2. Si los campos del documento no dijeron nada, un régimen fiscal
 *      con código EXCLUSIVO de moral (601, 603, etc.).
 *   3. Si tampoco eso fue concluyente, la razón social (terminación
 *      legal, palabra corporativa, o nombre propio corto) — útil sobre
 *      todo para regímenes ambiguos como 626 RESICO.
 *   4. Si ninguna de las tres señales concluyó nada, se regresa al
 *      resultado general del régimen (Física por default si hubo algún
 *      régimen reconocido, o null si no se encontró ninguno).
 */
function determinarTipoPersona(regimenesEncontrados, razonSocial, textoCompleto) {
  const tipoPorCampos = determinarTipoPersonaPorCamposDocumento(textoCompleto);
  if (tipoPorCampos) return tipoPorCampos;

  const regimenes = Array.isArray(regimenesEncontrados) ? regimenesEncontrados : [];
  const hayRegimenMoralExclusivo = regimenes.some((regimenTexto) => {
    const codigo = String(regimenTexto).split(' - ')[0].trim();
    return REGIMENES_EXCLUSIVOS_PERSONA_MORAL.includes(codigo);
  });
  if (hayRegimenMoralExclusivo) return 'moral';

  const tipoPorNombre = determinarTipoPersonaPorNombre(razonSocial);
  if (tipoPorNombre) return tipoPorNombre;

  return determinarTipoPersonaPorRegimen(regimenes);
}

/**
 * Corta un valor en el primer salto de columna (3+ espacios seguidos),
 * comun en extracciones de PDF con layout de tabla, para no arrastrar el
 * siguiente encabezado dentro del valor.
 */
function cortarEnSaltoDeColumna(valor) {
  if (!valor) return '';
  const corte = valor.search(/\s{3,}/);
  return corte === -1 ? valor : valor.slice(0, corte);
}

function limpiarValorExtraido(valor) {
  return cortarEnSaltoDeColumna(valor).replace(/\s+/g, ' ').trim();
}

// Lineas que pueden aparecer PEGADAS entre una etiqueta y su valor real en
// el texto extraido del PDF (por ejemplo "IdCIF" o "IdCIF: 12345678", que
// es un identificador interno de la cedula, no el nombre del
// contribuyente). Se ignoran al buscar la primera linea util despues de
// una etiqueta. Usan "empieza con" (no linea completa), porque estas
// etiquetas suelen traer su propio valor pegado en la misma linea
// ("IdCIF: 12345678"), y esa linea completa sigue siendo ruido, no el
// nombre que buscamos.
const LINEAS_RUIDO = [
  /^id\s*\.?\s*cif\d*/i,
  /^rfc\b/i,
  /^curp\b/i,
  /^c[oó]digo\s*postal\b/i,
  /^c\.?\s*p\.?(\s|\d|:|$)/i,
  /^r[eé]gimen(\s+capital)?\b/i,
  /^fecha\s+de\s+(inicio|nacimiento)\b/i,
  /^estatus\b/i,
  // Etiquetas de persona física que pueden aparecer sueltas dentro de una
  // ventana de búsqueda (ej. el respaldo que junta Nombre+Apellidos) — sin
  // esto, la etiqueta misma ("Primer Apellido:") se colaría en el
  // resultado junto con su valor.
  /^primer\s+apellido\b/i,
  /^segundo\s+apellido\b/i,
  /^nombre\s*\(?s?\)?\s*:?$/i,
];

// Frases de leyenda/instrucción que el SAT imprime como texto fijo en la
// Cédula (por ejemplo, cerca de un sello o código de validación, o como
// título del documento), y que no son parte de ningún valor real. Se
// comparan de forma normalizada (sin acentos, minusculas) porque su
// capitalización exacta puede variar.
const FRASES_INSTRUCCION = [
  'valida tu informacion fiscal',
  'verifica tu informacion fiscal',
  'consulta tu informacion fiscal',
  'esta cedula contiene informacion',
  'hoja',
  'pagina',
  // Título del documento y encabezados fijos — confirmados con un caso
  // real reportado donde terminaban uniéndose como si fueran parte del
  // nombre (ej. "CONSTANCIA DE SITUACIÓN FISCAL Lugar y Fecha de Emisión").
  'constancia de situacion fiscal',
  'cedula de identificacion fiscal',
  'lugar y fecha de emision',
  'datos de identificacion del contribuyente',
  'datos de ubicacion',
];

function esLineaRuido(linea) {
  const limpia = linea.trim();
  if (!limpia) return true;
  if (LINEAS_RUIDO.some((patron) => patron.test(limpia))) return true;
  // RFC en formato real (12-13 caracteres alfanumericos), por si el valor
  // del RFC quedo dentro de la ventana capturada.
  if (/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(limpia)) return true;
  // Una linea que son puros digitos (sin ninguna letra) es casi siempre un
  // identificador (como el valor de IdCIF) y no una razon social completa
  // por si sola, aunque los numeros si esten permitidos como PARTE de un
  // nombre junto con letras (ej. "TRANSPORTES 3000 SA DE CV").
  if (/^\d+$/.test(limpia)) return true;
  const normalizada = normalizar(limpia);
  if (FRASES_INSTRUCCION.some((frase) => normalizada === frase || normalizada.includes(frase))) return true;
  return false;
}


/**
 * Toma un bloque de texto (por ejemplo, todo lo que hay entre dos
 * etiquetas) y lo "aplana" a una sola línea: separa por saltos de línea,
 * descarta las líneas que sean ruido conocido (IdCIF, el RFC repetido,
 * líneas de puros dígitos, leyendas y encabezados fijos del SAT — ver
 * `esLineaRuido`), y une lo que sobrevive con espacios simples, SIN
 * saltos de línea. A propósito NO valida qué caracteres trae cada línea
 * (a diferencia de versiones anteriores) — esa restricción llegó a
 * rechazar nombres reales con caracteres válidos pero poco comunes (ej.
 * "+"), así que ahora se filtra por lo que SÍ se sabe que es ruido, no
 * por una lista cerrada de lo que "se ve como" un nombre.
 */
function aplanarValorEntreEtiquetas(bloque) {
  const lineas = String(bloque || '')
    .split('\n')
    .map((linea) => cortarEnSaltoDeColumna(linea).trim())
    .filter((linea) => linea && !esLineaRuido(linea));
  if (lineas.length === 0) return '';
  return limpiarValorExtraido(lineas.join(' '));
}

/**
 * Variante de `aplanarValorEntreEtiquetas` para cuando solo se tiene UN
 * límite claro (por ejemplo, buscando hacia atrás desde una etiqueta sin
 * la otra como ancla) — en vez de filtrar ruido en toda la ventana y unir
 * lo que sobreviva, PRIMERO salta líneas vacías o de ruido iniciales (es
 * normal que el bloque más cercano a una etiqueta traiga una línea vacía
 * pegada, por el propio salto de línea antes/después de la etiqueta), y
 * LUEGO se DETIENE en cuanto encuentra la primera línea vacía o de ruido
 * tras haber empezado a recolectar — para no arrastrar contenido de
 * otros campos que también pasen el filtro de ruido pero no sean parte
 * del valor buscado. `direccion: 'adelante'` recorre `lineas` en orden;
 * `'atras'` la recorre en reversa (para buscar el valor más cercano al
 * FINAL del bloque).
 */
function aplanarConParadaEnRuido(lineas, direccion) {
  const secuencia = direccion === 'atras' ? [...lineas].reverse() : lineas;

  let idx = 0;
  while (idx < secuencia.length) {
    const linea = cortarEnSaltoDeColumna(secuencia[idx]).trim();
    if (linea && !esLineaRuido(linea)) break;
    idx += 1;
  }

  const encontradas = [];
  while (idx < secuencia.length) {
    const linea = cortarEnSaltoDeColumna(secuencia[idx]).trim();
    if (!linea || esLineaRuido(linea)) break;
    encontradas.push(linea);
    idx += 1;
  }

  if (encontradas.length === 0) return '';
  const ordenadas = direccion === 'atras' ? encontradas.reverse() : encontradas;
  return limpiarValorExtraido(ordenadas.join(' '));
}

/**
 * Busca el nombre, denominación o razón social en el texto del PDF.
 *
 * REGLA PRINCIPAL (misma para persona física y persona moral, sin
 * distinción): el valor real se ubica en el bloque de texto que queda
 * ENTRE la etiqueta "Registro Federal de Contribuyentes" y la etiqueta
 * "Nombre, Denominación o Razón Social" — sin importar cuál de las dos
 * aparezca primero en el texto extraído del PDF (el orden del texto
 * extraído no siempre coincide con el orden visual del documento). Se
 * toma TODO ese bloque, se descarta ruido conocido línea por línea
 * (IdCIF, el propio RFC repetido, líneas de puros dígitos, leyendas y
 * encabezados fijos del SAT como "Constancia de Situación Fiscal" o
 * "Lugar y Fecha de Emisión"), y lo que sobrevive se une en una sola
 * cadena SIN saltos de línea (ver `aplanarValorEntreEtiquetas`).
 *
 * Si esa ventana no existe (no se encontró alguna de las dos etiquetas) o
 * no arroja nada útil, se usan como respaldo: buscar hacia atrás desde la
 * propia etiqueta del nombre sin el RFC como ancla, buscar justo después
 * de la etiqueta del nombre, o (solo para persona física, confirmado por
 * la presencia real de "Primer Apellido") juntar "Nombre (s)" + "Primer
 * Apellido" + "Segundo Apellido".
 *
 * Devuelve el valor encontrado, o null si no se pudo determinar (el
 * llamador decide como manejarlo; no bloquea la carga del documento).
 */
function extraerNombreRazonSocial(texto) {
  const contenido = String(texto || '');
  if (!contenido.trim()) return null;

  const patronEtiquetaNombre = /Nombre\s*\(?s?\)?\s*,?\s*Denominaci[oó]n\s*(?:\/|\s+o\s+)\s*Raz[oó]n\s+Social\s*:?/i;
  const patronEtiquetaRfc = /Registro\s+Federal\s+de\s+Contribuyentes\s*:?/i;

  const matchEtiquetaNombre = contenido.match(patronEtiquetaNombre);
  const matchEtiquetaRfc = contenido.match(patronEtiquetaRfc);

  // Estrategia principal (unificada): todo lo que hay ENTRE las dos
  // etiquetas, sin importar el orden en el que aparezcan.
  if (matchEtiquetaRfc && matchEtiquetaNombre) {
    const bloque =
      matchEtiquetaRfc.index < matchEtiquetaNombre.index
        ? contenido.slice(matchEtiquetaRfc.index + matchEtiquetaRfc[0].length, matchEtiquetaNombre.index)
        : contenido.slice(matchEtiquetaNombre.index + matchEtiquetaNombre[0].length, matchEtiquetaRfc.index);
    const valor = aplanarValorEntreEtiquetas(bloque);
    if (valor) return valor;
  }

  // Respaldo 1: no se encontró la etiqueta del RFC (o el bloque entre
  // ambas no dio nada útil) — buscar hacia atrás desde la propia etiqueta
  // del nombre, DETENIÉNDOSE en la primera línea vacía o de ruido (no
  // hay una segunda etiqueta que delimite el otro extremo, así que no se
  // puede simplemente "tomar todo" como en la estrategia principal).
  if (matchEtiquetaNombre) {
    const lineasAntes = contenido.slice(0, matchEtiquetaNombre.index).split('\n');
    const ventana = lineasAntes.slice(-10);
    const valor = aplanarConParadaEnRuido(ventana, 'atras');
    if (valor) return valor;
  }

  // Respaldo 2: buscar justo después de la etiqueta del nombre (por si el
  // documento sigue un orden más "normal", valor después de etiqueta),
  // deteniéndose igual en la primera línea vacía o de ruido.
  const patronesRazonSocial = [
    patronEtiquetaNombre,
    /Denominaci[oó]n\s*\/?\s*Raz[oó]n\s+Social\s*:?/i,
  ];
  for (const patron of patronesRazonSocial) {
    const match = contenido.match(patron);
    if (match) {
      const resto = contenido.slice(match.index + match[0].length);
      const ventana = resto.split('\n').slice(0, 5);
      const valor = aplanarConParadaEnRuido(ventana, 'adelante');
      if (valor) return valor;
    }
  }

  // Último respaldo: SOLO para persona física (nombre repartido en tres
  // campos: Nombre + Primer Apellido + Segundo Apellido). Se activa
  // ÚNICAMENTE si se encuentra la etiqueta "Primer Apellido" — una señal
  // fuerte e inequívoca de que el documento es de persona física —, y NO
  // simplemente por buscar "Nombre" de forma aislada (eso confundía el
  // resultado con campos no relacionados, como "Nombre Comercial", en
  // documentos de persona moral). El "Nombre" que se toma es el más
  // CERCANO (inmediatamente antes) de "Primer Apellido", no el primero de
  // todo el documento.
  const etiquetaPrimerApellido = contenido.match(/Primer\s+Apellido\s*:?/i);
  if (etiquetaPrimerApellido) {
    const regexNombreGlobal = /Nombre\s*\(?s?\)?\s*:?/gi;
    let etiquetaNombreSolo = null;
    let matchNombre;
    while ((matchNombre = regexNombreGlobal.exec(contenido)) !== null) {
      if (matchNombre.index >= etiquetaPrimerApellido.index) break;
      etiquetaNombreSolo = matchNombre;
    }

    const etiquetaSegundoApellido = contenido.match(/Segundo\s+Apellido\s*:?/i);

    const partes = [etiquetaNombreSolo, etiquetaPrimerApellido, etiquetaSegundoApellido]
      .map((m) => {
        if (!m) return '';
        const ventana = contenido.slice(m.index + m[0].length).split('\n').slice(0, 5);
        return aplanarConParadaEnRuido(ventana, 'adelante');
      })
      .filter(Boolean);

    if (partes.length > 0) {
      return partes.join(' ');
    }
  }

  return null;
}

module.exports = {
  extraerTextoPdf,
  pareceConstanciaFiscal,
  extraerCodigoPostal,
  extraerRFC,
  extraerRegimenesFiscales,
  determinarTipoPersonaPorRegimen,
  determinarTipoPersonaPorNombre,
  determinarTipoPersonaPorCamposDocumento,
  determinarTipoPersona,
  extraerNombreRazonSocial,
};
