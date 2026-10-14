// Motor del importador masivo CSV/XLSX (inventarios.md §34, decisión D9).
// require() perezoso de '../db' — mismo motivo que utils/inventario.js y
// utils/gastos.js: db.js importa (indirectamente) este archivo antes de
// terminar de armar su module.exports.
function obtenerPool() {
  return require('../db').pool;
}

const crypto = require('crypto');
const { parse: parseCSV } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { sanitizeText, sanitizeTextoLibre } = require('./validate');
const {
  CAMPOS_IMPORTABLES,
  CAMPOS_NUMERICOS,
  ordenarSinonimosPorPreset,
} = require('./inventarioCampos');
const {
  UNIDAD_BASE_DEFECTO,
  registrarMovimiento,
  productoTieneMovimientos,
  generarSlugCategoriaInventario,
} = require('./inventario');

// Claves prohibidas en `productos.extra` (§34.4, hallazgo de seguridad
// 2026-08-24): una cabecera del archivo del cliente se vuelve clave de un
// objeto JSON que después se lee/edita en JS — `__proto__`/`constructor`/
// `prototype` son vector real de prototype pollution si algún flujo futuro
// mezcla ese JSON con Object.assign/spread sin filtrar.
const CLAVES_EXTRA_PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);

// ---------------------------------------------------------------------
// Normalización de cabeceras y coincidencia (§34.3)
// ---------------------------------------------------------------------

function normalizarCabecera(texto) {
  return String(texto || '')
    .normalize('NFD')
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function distanciaLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const fila = new Array(n + 1);
  for (let j = 0; j <= n; j++) fila[j] = j;
  for (let i = 1; i <= m; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = fila[j];
      fila[j] = a[i - 1] === b[j - 1]
        ? anterior
        : 1 + Math.min(anterior, fila[j], fila[j - 1]);
      anterior = temp;
    }
  }
  return fila[n];
}

function similitud(a, b) {
  if (a === b) return 1;
  const largo = Math.max(a.length, b.length);
  if (largo === 0) return 1;
  return 1 - distanciaLevenshtein(a, b) / largo;
}

const UMBRAL_DIFUSO = 0.8;

// Campo-céntrico a propósito: "un campo del sistema recibe a lo más UNA
// columna" (34.3 regla 1) sale gratis recorriendo por campo en vez de por
// cabecera — el primer nivel que encuentra columna libre para ese campo
// gana, sin necesitar lógica de desempate aparte.
function sugerirMapeoCompleto(cabecerasOriginales, opciones = {}) {
  const { presetSistema = 'otro', perfilMapeo = null } = opciones;
  const cabecerasNorm = cabecerasOriginales.map(normalizarCabecera);
  const resultado = {};
  const columnasUsadas = new Set();

  // Prioridad 1 (§34.3.1): perfil de mapeo guardado del tenant.
  if (perfilMapeo) {
    for (const [campo, cabeceraNormPerfil] of Object.entries(perfilMapeo)) {
      const idx = cabecerasNorm.indexOf(cabeceraNormPerfil);
      const def = CAMPOS_IMPORTABLES.find((c) => c.campo === campo);
      if (idx !== -1 && !columnasUsadas.has(idx) && def) {
        resultado[campo] = {
          columnaIndice: idx,
          columnaOriginal: cabecerasOriginales[idx],
          confianza: 'perfil',
          razon: 'Aplicado desde tu perfil de mapeo guardado.',
          esObligatorio: def.obligatorio,
          requiereConfirmacion: false,
        };
        columnasUsadas.add(idx);
      }
    }
  }

  // Prioridades 2-4: exacto → sinónimo (con reordenamiento de preset) → difuso.
  const niveles = ['exacto', 'reconocido', 'sugerido'];
  for (const nivel of niveles) {
    for (const campoDef of CAMPOS_IMPORTABLES) {
      if (resultado[campoDef.campo]) continue;
      let mejorIdx = -1;
      let mejorRazon = '';
      let mejorScore = 0;

      cabecerasNorm.forEach((cabNorm, idx) => {
        if (columnasUsadas.has(idx) || mejorIdx !== -1 && nivel !== 'sugerido') return;
        if (!cabNorm) return;
        if (nivel === 'exacto') {
          if (cabNorm === campoDef.campo) {
            mejorIdx = idx;
            mejorRazon = `coincide exactamente con el campo "${campoDef.campo}"`;
          }
        } else if (nivel === 'reconocido') {
          const sinonimosOrdenados = ordenarSinonimosPorPreset(campoDef, presetSistema);
          const encontrado = sinonimosOrdenados.find((s) => normalizarCabecera(s) === cabNorm);
          if (encontrado) {
            mejorIdx = idx;
            mejorRazon = `coincide con el sinónimo "${encontrado}"`;
          }
        } else if (nivel === 'sugerido') {
          if (columnasUsadas.has(idx)) return;
          const candidatos = [campoDef.campo, ...campoDef.sinonimos];
          for (const candidato of candidatos) {
            const score = similitud(cabNorm, normalizarCabecera(candidato));
            if (score >= UMBRAL_DIFUSO && score > mejorScore) {
              mejorScore = score;
              mejorIdx = idx;
              mejorRazon = `similar a "${candidato}" (${Math.round(score * 100)}% de coincidencia)`;
            }
          }
        }
      });

      if (mejorIdx !== -1) {
        resultado[campoDef.campo] = {
          columnaIndice: mejorIdx,
          columnaOriginal: cabecerasOriginales[mejorIdx],
          confianza: nivel,
          razon: mejorRazon,
          esObligatorio: campoDef.obligatorio,
          // 34.3.1: un campo obligatorio resuelto SOLO por coincidencia
          // difusa nunca se auto-acepta en silencio.
          requiereConfirmacion: nivel === 'sugerido' && campoDef.obligatorio,
        };
        columnasUsadas.add(mejorIdx);
      }
    }
  }

  const columnasSinMapear = cabecerasOriginales
    .map((original, idx) => ({ indice: idx, original }))
    .filter((c) => !columnasUsadas.has(c.indice));

  return { mapeo: resultado, columnasSinMapear };
}

// Firma de cabeceras (34.3.2): hash del SET ORDENADO de cabeceras
// normalizadas — dos archivos con las mismas columnas en distinto orden
// producen la misma firma (el mapeo no depende del orden de columnas).
function firmaCabeceras(cabecerasOriginales) {
  const normalizadas = cabecerasOriginales.map(normalizarCabecera).filter(Boolean).sort();
  return crypto.createHash('sha256').update(normalizadas.join('|')).digest('hex');
}

// ---------------------------------------------------------------------
// Parseo de archivos (§34.1)
// ---------------------------------------------------------------------

function decodificarBuffer(buffer) {
  const utf8 = buffer.toString('utf8');
  if (utf8.includes('�')) {
    return { texto: buffer.toString('latin1'), encoding: 'latin1' };
  }
  return { texto: utf8, encoding: 'utf8' };
}

function detectarDelimitadorCSV(lineaEncabezados) {
  const candidatos = [',', ';', '\t', '|'];
  let mejor = ',';
  let mejorConteo = -1;
  for (const candidato of candidatos) {
    let conteo = 0;
    let dentroComillas = false;
    for (const ch of lineaEncabezados) {
      if (ch === '"') dentroComillas = !dentroComillas;
      else if (ch === candidato && !dentroComillas) conteo += 1;
    }
    if (conteo > mejorConteo) {
      mejorConteo = conteo;
      mejor = candidato;
    }
  }
  return mejor;
}

function parsearArchivoCSV(buffer) {
  const { texto, encoding } = decodificarBuffer(buffer);
  const primeraLinea = (texto.split(/\r?\n/, 1)[0] || '');
  const delimitador = detectarDelimitadorCSV(primeraLinea);
  const filas = parseCSV(texto, {
    delimiter: delimitador,
    bom: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  if (filas.length === 0) return { cabeceras: [], filas: [], encoding, delimitador, filaEncabezados: 1 };
  const [cabeceras, ...resto] = filas;
  return { cabeceras, filas: resto, encoding, delimitador, filaEncabezados: 1 };
}

// Heurística simple: entre las primeras 10 filas, la fila de encabezados es
// la que tiene más celdas no vacías (cubre el caso de títulos/logos
// decorativos arriba, mencionado en 34.1, sin necesitar reconocimiento de
// texto — solo densidad de celdas).
function detectarFilaEncabezadosXLSX(filasCrudas) {
  const limite = Math.min(filasCrudas.length, 10);
  let mejorIdx = 0;
  let mejorConteo = -1;
  for (let i = 0; i < limite; i++) {
    const noVacias = filasCrudas[i].filter((v) => String(v).trim() !== '').length;
    if (noVacias > mejorConteo) {
      mejorConteo = noVacias;
      mejorIdx = i;
    }
  }
  return mejorIdx;
}

function valorCeldaXLSX(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    if (typeof valor.text === 'string') return valor.text;
    if (valor.result !== undefined) return String(valor.result);
    if (Array.isArray(valor.richText)) return valor.richText.map((r) => r.text).join('');
  }
  return String(valor);
}

async function listarHojasXLSX(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets.map((ws) => ws.name);
}

// Lectura de .xls real (Excel 97-2003, binario OLE2) — ExcelJS NO lee este
// formato (solo XLSX/OOXML), así que se usa SheetJS ('xlsx' en npm) SOLO
// para esta rama de lectura. require() perezoso para no cargar la
// dependencia si ningún tenant sube un .xls real.
let xlsLegacy = null;
function obtenerLibreriaXLSLegacy() {
  if (!xlsLegacy) xlsLegacy = require('xlsx');
  return xlsLegacy;
}

function listarHojasXLS(buffer) {
  const workbook = obtenerLibreriaXLSLegacy().read(buffer, { type: 'buffer' });
  return workbook.SheetNames;
}

function parsearArchivoXLS(buffer, hojaNombre = null) {
  const XLSX = obtenerLibreriaXLSLegacy();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const nombreHoja = hojaNombre && workbook.SheetNames.includes(hojaNombre)
    ? hojaNombre
    : workbook.SheetNames[0];
  const hoja = nombreHoja ? workbook.Sheets[nombreHoja] : null;
  if (!hoja) return { cabeceras: [], filas: [], hoja: null, filaEncabezados: 1 };

  const filasCrudas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: null, blankrows: false });
  if (filasCrudas.length === 0) return { cabeceras: [], filas: [], hoja: nombreHoja, filaEncabezados: 1 };

  const filaEncabezadosIdx = detectarFilaEncabezadosXLSX(filasCrudas);
  const cabeceras = filasCrudas[filaEncabezadosIdx];
  const filas = filasCrudas.slice(filaEncabezadosIdx + 1);
  return { cabeceras, filas, hoja: nombreHoja, filaEncabezados: filaEncabezadosIdx + 1 };
}

async function parsearArchivoXLSX(buffer, hojaNombre = null) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const hoja = hojaNombre ? workbook.getWorksheet(hojaNombre) : workbook.worksheets[0];
  if (!hoja) return { cabeceras: [], filas: [], hoja: null, filaEncabezados: 1 };

  const filasCrudas = [];
  hoja.eachRow({ includeEmpty: false }, (row) => {
    filasCrudas.push(row.values.slice(1).map(valorCeldaXLSX));
  });
  if (filasCrudas.length === 0) return { cabeceras: [], filas: [], hoja: hoja.name, filaEncabezados: 1 };

  const filaEncabezadosIdx = detectarFilaEncabezadosXLSX(filasCrudas);
  const cabeceras = filasCrudas[filaEncabezadosIdx];
  const filas = filasCrudas.slice(filaEncabezadosIdx + 1);
  return { cabeceras, filas, hoja: hoja.name, filaEncabezados: filaEncabezadosIdx + 1 };
}

// ---------------------------------------------------------------------
// Números tolerantes (§34.5): coma decimal, separador de miles, símbolos.
// ---------------------------------------------------------------------

function parsearNumeroTolerante(valorCrudo) {
  if (valorCrudo === null || valorCrudo === undefined) return { valor: null, nota: null };
  let texto = String(valorCrudo).trim();
  if (texto === '') return { valor: null, nota: null };
  texto = texto.replace(/[^0-9.,-]/g, '');
  if (texto === '') return { valor: NaN, nota: null };
  const tieneComa = texto.includes(',');
  const tienePunto = texto.includes('.');
  let nota = null;
  if (tieneComa && tienePunto) {
    const ultimaComa = texto.lastIndexOf(',');
    const ultimoPunto = texto.lastIndexOf('.');
    if (ultimaComa > ultimoPunto) {
      texto = texto.replace(/\./g, '').replace(',', '.');
      nota = 'coma interpretada como separador decimal (punto como separador de miles)';
    } else {
      texto = texto.replace(/,/g, '');
    }
  } else if (tieneComa && !tienePunto) {
    texto = texto.replace(',', '.');
    nota = 'coma interpretada como separador decimal';
  }
  const numero = Number(texto);
  return { valor: Number.isFinite(numero) ? numero : NaN, nota };
}

function normalizarTipoProducto(valorCrudo) {
  const texto = String(valorCrudo || '').trim().toLowerCase();
  if (!texto) return 'producto';
  if (texto.includes('servicio') || texto === 'service' || texto === '1' || texto === 'si' || texto === 'sí') return 'servicio';
  return 'producto';
}

function normalizarEstadoProducto(valorCrudo) {
  const texto = String(valorCrudo || '').trim().toLowerCase();
  if (!texto) return 'activo';
  if (['inactivo', 'no', '0', 'false', 'baja', 'inactive'].includes(texto)) return 'inactivo';
  return 'activo';
}

// ---------------------------------------------------------------------
// Validación de todas las filas (§34.5) — nunca importa nada sin validar
// primero el archivo completo.
// ---------------------------------------------------------------------

// Columnas de texto libre (nunca numéricas, nunca de catálogo cerrado)
// donde puede venir un precio y/o un proveedor pegados al dato real — ej.
// una fila real vista en producción: "BRAZO AUXILIAR FORD F150 2005 $519
// MAYASA" dentro de la columna "Producto" (nombre real, precio de lista
// del proveedor, código del proveedor, los 3 concatenados). No es un error
// que bloquee la fila — es un aviso de calidad de datos (§34, ampliación
// "sanitización en validación") con una resolución real: separar el
// precio/proveedor a su propio campo, o descartarlos, dejando el nombre
// limpio (punto 398).
const CAMPOS_TEXTO_LIBRE_PARA_MEZCLA = ['nombre', 'descripcion_corta', 'descripcion_larga', 'marca', 'fabricante', 'modelo', 'proveedor_principal', 'categoria'];

// "$519 MAYASA" al final del texto: precio con $ opcionalmente seguido de
// un token en mayúsculas (el candidato a proveedor). El token es opcional
// a propósito — un archivo puede traer SOLO el precio pegado, sin proveedor.
const PATRON_PRECIO_TOKEN_FINAL = /\$\s?([\d,]+(?:\.\d+)?)\s*([A-ZÑÁÉÍÓÚ][A-ZÑÁÉÍÓÚ0-9]{1,30})?\s*$/;
// Un token se considera "proveedor confirmado" solo si aparece junto a un
// $precio explícito en 2+ filas distintas — nunca se adivina una palabra
// suelta en mayúsculas sin ese respaldo (evita falsos positivos como
// "IZQ"/"STD" que son parte normal del nombre del producto, no un proveedor).
const MIN_OCURRENCIAS_PROVEEDOR_CONFIRMADO = 2;

// Detección en 2 pasadas, por columna de texto libre mapeada (§34,
// ampliación "datos mezclados", punto 398):
// 1) Candidatos a proveedor: tokens que aparecen junto a "$precio" en 2+
//    filas — señal fuerte, no una palabra cualquiera en mayúsculas.
// 2) Con esos tokens ya confirmados, se buscan también al final de filas
//    SIN precio (ej. "FILTRO GASOLINA VW A4 GONHER") — mismo proveedor,
//    el archivo simplemente no repitió el precio en esa fila.
// Nunca se persiste ni se hardcodea ningún nombre de proveedor real —
// el set de tokens se descubre de nuevo en cada archivo.
function detectarDatosMezclados(filasCrudas, mapeoFinal) {
  const resultadoPorColumna = new Map();

  for (const campo of CAMPOS_TEXTO_LIBRE_PARA_MEZCLA) {
    const idx = mapeoFinal[campo];
    if (idx === undefined || idx === null) continue;

    const tokensConfirmados = new Map();
    for (let i = 0; i < filasCrudas.length; i++) {
      const texto = String(filasCrudas[i][idx] || '').trim();
      const m = texto.match(PATRON_PRECIO_TOKEN_FINAL);
      if (m && m[2]) tokensConfirmados.set(m[2], (tokensConfirmados.get(m[2]) || 0) + 1);
    }
    for (const [token, count] of Array.from(tokensConfirmados.entries())) {
      if (count < MIN_OCURRENCIAS_PROVEEDOR_CONFIRMADO) tokensConfirmados.delete(token);
    }

    const filasProveedor = new Map(); // filaIdx -> { token, textoLimpio }
    const filasPrecio = new Map(); // filaIdx -> { valor, textoLimpio }
    for (let i = 0; i < filasCrudas.length; i++) {
      const texto = String(filasCrudas[i][idx] || '').trim();
      if (!texto) continue;
      const m = texto.match(PATRON_PRECIO_TOKEN_FINAL);
      if (m) {
        const valorPrecio = Number(m[1].replace(/,/g, ''));
        const textoLimpio = texto.slice(0, m.index).trim();
        if (Number.isFinite(valorPrecio)) filasPrecio.set(i, { valor: valorPrecio, textoLimpio });
        if (m[2] && tokensConfirmados.has(m[2])) filasProveedor.set(i, { token: m[2], textoLimpio });
        continue;
      }
      for (const token of tokensConfirmados.keys()) {
        if (texto.length <= token.length) continue;
        if (texto.slice(-token.length) !== token) continue;
        const antes = texto[texto.length - token.length - 1];
        if (antes !== ' ') continue; // el token debe ser una palabra suelta al final, no parte de otra
        filasProveedor.set(i, { token, textoLimpio: texto.slice(0, texto.length - token.length).trim() });
        break;
      }
    }

    if (filasProveedor.size > 0 || filasPrecio.size > 0) {
      resultadoPorColumna.set(campo, { tokensConfirmados, filasProveedor, filasPrecio });
    }
  }

  return resultadoPorColumna;
}

async function validarFilasImportacion(cabecerasOriginales, filasCrudas, opciones) {
  const {
    mapeoFinal, // { campo: columnaIndice }
    modo = 'tolerante', // 'tolerante' | 'estricto'
    conservarExtra = true,
    // { [campo]: { [valorOriginalNormalizado]: valorNuevo } } — resolución de
    // valores de catálogo (ej. unidad_base "UNIDAD" → "Pieza") decidida por
    // el usuario en el paso de Validación (propuesta 1, agrupar por valor).
    // La clave se normaliza igual que unidadesPorNombre (trim+lowercase) para
    // que no importe cómo vino capitalizado el valor original en el archivo.
    valorOverrides = {},
    // { [campo]: { proveedor?: 'proveedor_principal'|'notas'|'descartar', precio?: 'costo'|'notas'|'descartar' } }
    // Decisión del usuario sobre qué hacer con el precio/proveedor
    // detectados pegados al texto (punto 398) — sin esto (default), el
    // texto se deja tal cual, solo se reporta como hallazgo de calidad.
    limpiezaMezcla = {},
  } = opciones;

  const pool = obtenerPool();
  const [unidadesFilas] = await pool.query('SELECT id, nombre FROM unidades_medida');
  const unidadesPorNombre = new Map(unidadesFilas.map((u) => [u.nombre.trim().toLowerCase(), u.id]));
  const deteccionMezcla = detectarDatosMezclados(filasCrudas, mapeoFinal);

  const columnasMapeadas = new Set(Object.values(mapeoFinal));
  const columnasExtra = cabecerasOriginales
    .map((original, idx) => ({
      indice: idx,
      original,
      normalizada: normalizarCabecera(original),
      // Comparación SIN el recorte de guiones bajos de normalizarCabecera()
      // a propósito: "__proto__" normalizado a secas queda "proto" (el
      // recorte de guiones al inicio/fin lo neutraliza), lo que dejaría
      // esta cabecera pasar el filtro de abajo sin disparar nunca el
      // rechazo — el guardado real (§34.4) sí debe usar la clave colapsada
      // (es la que se persiste), pero la DETECCIÓN de la clave peligrosa
      // necesita ver los guiones bajos originales.
      claveParaVerificarProhibicion: String(original || '').trim().toLowerCase(),
    }))
    .filter((c) => !columnasMapeadas.has(c.indice) && c.normalizada);

  const skusVistos = new Set();
  const skuAPrimeraFila = new Map();
  const filasValidas = [];
  const errores = [];
  let abortado = false;
  let motivoAborto = null;

  // Hallazgos de calidad de datos (§34, ampliación "sanitización en
  // validación") — informativos, NUNCA bloquean una fila (a diferencia de
  // erroresFila): datos mezclados por columna (de deteccionMezcla, arriba)
  // y precio de venta en $0.00. El de "ya existe en el catálogo" se calcula
  // aparte, después del loop, con una sola consulta en lote.
  let precioCero = { count: 0, filasEjemplo: [] };

  for (let i = 0; i < filasCrudas.length; i++) {
    if (abortado) break;
    const filaCruda = filasCrudas[i];
    const numeroFilaVisible = i + 2; // fila 1 = encabezados, datos empiezan en 2 (convención estándar de hojas de cálculo)
    const obtener = (campo) => {
      const idx = mapeoFinal[campo];
      if (idx === undefined || idx === null) return '';
      const valor = filaCruda[idx];
      let texto = valor === undefined || valor === null ? '' : String(valor).trim();
      if (!texto) return texto;
      const overridesCampo = valorOverrides[campo];
      if (overridesCampo) {
        const reemplazo = overridesCampo[texto.toLowerCase()];
        if (reemplazo !== undefined && reemplazo !== null && reemplazo !== '') return String(reemplazo);
      }
      // Punto 398: si el usuario decidió QUÉ HACER con el precio/proveedor
      // detectados pegados a este campo (moverlos a otro campo o
      // descartarlos), el texto queda limpio de ese momento en adelante —
      // sin decisión tomada, el texto se deja exactamente como vino.
      const mezcla = deteccionMezcla.get(campo);
      const decisionCampo = limpiezaMezcla[campo];
      if (mezcla && decisionCampo && (decisionCampo.precio || decisionCampo.proveedor)) {
        const info = mezcla.filasPrecio.get(i) || mezcla.filasProveedor.get(i);
        if (info) texto = info.textoLimpio;
      }
      return texto;
    };

    const erroresFila = [];
    const sku = sanitizeText(obtener('sku'), 60);
    if (!sku) erroresFila.push({ columna: 'sku', valor: '', motivo: 'SKU vacío.' });
    else if (skusVistos.has(sku)) erroresFila.push({ columna: 'sku', valor: sku, motivo: 'SKU duplicado dentro del archivo.' });
    else { skusVistos.add(sku); skuAPrimeraFila.set(sku, numeroFilaVisible); }

    const nombre = sanitizeText(obtener('nombre'), 200);
    if (!nombre) erroresFila.push({ columna: 'nombre', valor: '', motivo: 'Nombre vacío.' });

    // Punto 179: la carga masiva es SOLO para productos. Un servicio
    // (unidad fija en horas, sin código de barras/stock) siempre se da de
    // alta a mano desde "Nuevo producto" — no vía CSV/XLSX. Se rechaza la
    // fila completa aquí, con el mismo mecanismo de error que el resto de
    // validaciones, para que quede claro en el resultado por qué no entró.
    const tipo = normalizarTipoProducto(obtener('tipo'));
    if (tipo === 'servicio') {
      erroresFila.push({
        columna: 'tipo',
        valor: obtener('tipo') || 'servicio',
        motivo: 'INV_IMPORT_SERVICIO_NO_PERMITIDO: los servicios no se importan de forma masiva — se dan de alta manualmente desde "Nuevo producto".',
      });
    }

    const unidadTexto = obtener('unidad_base') || UNIDAD_BASE_DEFECTO;
    const unidadId = unidadesPorNombre.get(unidadTexto.trim().toLowerCase());
    if (!unidadId) {
      erroresFila.push({ columna: 'unidad_base', valor: unidadTexto, motivo: `Unidad de medida desconocida: "${unidadTexto}" (no se crean unidades implícitas).` });
    }

    const numeros = {};
    for (const campoNum of CAMPOS_NUMERICOS) {
      const crudo = obtener(campoNum);
      const { valor, nota } = parsearNumeroTolerante(crudo);
      if (crudo && Number.isNaN(valor)) {
        erroresFila.push({ columna: campoNum, valor: crudo, motivo: 'Número inválido.' });
      } else {
        numeros[campoNum] = valor;
        if (nota) numeros[`${campoNum}_nota`] = nota;
      }
    }
    if (Number.isFinite(numeros.existencia_inicial) && numeros.existencia_inicial < 0) {
      erroresFila.push({ columna: 'existencia_inicial', valor: String(numeros.existencia_inicial), motivo: 'La existencia inicial no puede ser negativa.' });
    }
    if (numeros.precio === 0) {
      precioCero.count += 1;
      if (precioCero.filasEjemplo.length < 10) precioCero.filasEjemplo.push(numeroFilaVisible);
    }

    const extra = {};
    if (conservarExtra) {
      for (const col of columnasExtra) {
        const valorCrudo = filaCruda[col.indice];
        if (valorCrudo === undefined || valorCrudo === null || String(valorCrudo).trim() === '') continue;
        if (CLAVES_EXTRA_PROHIBIDAS.has(col.normalizada) || CLAVES_EXTRA_PROHIBIDAS.has(col.claveParaVerificarProhibicion)) {
          erroresFila.push({
            columna: col.original,
            valor: String(valorCrudo),
            motivo: `INV_EXTRA_CLAVE_PROHIBIDA: la cabecera "${col.original}" no puede usarse como dato extra.`,
          });
          continue;
        }
        extra[col.normalizada] = String(valorCrudo).trim();
      }
    }

    if (erroresFila.length > 0) {
      if (modo === 'estricto') {
        abortado = true;
        motivoAborto = erroresFila[0].motivo;
        errores.push(...erroresFila.map((e) => ({ fila: numeroFilaVisible, ...e })));
        break;
      }
      errores.push(...erroresFila.map((e) => ({ fila: numeroFilaVisible, ...e })));
      continue;
    }

    // Punto 398: precio/proveedor detectados pegados al texto, SOLO si el
    // usuario pidió moverlos a un campo (limpiezaMezcla) — nunca de oficio.
    // El dato YA mapeado por el usuario desde una columna real del archivo
    // siempre gana sobre el extraído (nunca se sobreescribe algo explícito
    // con algo inferido).
    let costoExtraido = null;
    let proveedorExtraido = null;
    const notasExtraidas = [];
    for (const [campoConMezcla, mezcla] of deteccionMezcla.entries()) {
      const decisionCampo = limpiezaMezcla[campoConMezcla];
      if (!decisionCampo) continue;
      const infoPrecio = mezcla.filasPrecio.get(i);
      const infoProveedor = mezcla.filasProveedor.get(i);
      if (infoPrecio && decisionCampo.precio === 'costo') costoExtraido = infoPrecio.valor;
      if (infoPrecio && decisionCampo.precio === 'notas') notasExtraidas.push(`Precio detectado en "${campoConMezcla}": $${infoPrecio.valor}`);
      if (infoProveedor && decisionCampo.proveedor === 'proveedor_principal') proveedorExtraido = infoProveedor.token;
      if (infoProveedor && decisionCampo.proveedor === 'notas') notasExtraidas.push(`Proveedor detectado en "${campoConMezcla}": ${infoProveedor.token}`);
    }
    const costoMapeado = Number.isFinite(numeros.costo) ? numeros.costo : null;
    const proveedorMapeado = sanitizeText(obtener('proveedor_principal'), 200) || null;
    const notasMapeadas = sanitizeTextoLibre(obtener('notas'), 2000) || null;

    filasValidas.push({
      fila: numeroFilaVisible,
      sku,
      nombre,
      codigo_barras: sanitizeText(obtener('codigo_barras'), 60) || null,
      categoria: sanitizeText(obtener('categoria'), 100) || null,
      unidad_id: unidadId,
      tipo,
      costo: costoMapeado !== null ? costoMapeado : costoExtraido,
      precio: Number.isFinite(numeros.precio) ? numeros.precio : null,
      stock_minimo: Number.isFinite(numeros.stock_minimo) ? numeros.stock_minimo : null,
      stock_maximo: Number.isFinite(numeros.stock_maximo) ? numeros.stock_maximo : null,
      punto_reorden: Number.isFinite(numeros.punto_reorden) ? numeros.punto_reorden : null,
      proveedor_principal: proveedorMapeado || proveedorExtraido,
      notas: [notasMapeadas, ...notasExtraidas].filter(Boolean).join(' — ') || null,
      estado: normalizarEstadoProducto(obtener('estado')),
      existencia_inicial: Number.isFinite(numeros.existencia_inicial) ? numeros.existencia_inicial : null,
      extra: Object.keys(extra).length > 0 ? extra : null,
    });
  }

  // "Ya existe en el catálogo" (§34, ampliación): distinto del "SKU
  // duplicado dentro del archivo" de arriba (ese compara el archivo contra
  // sí mismo) — este cruza contra `productos` real. No es un error, es
  // información (el upsert de ejecutarFilasImportacion() los ACTUALIZA a
  // propósito, nunca los rechaza) — el aviso es para que el usuario sepa
  // que va a sobreescribir productos existentes antes de confirmar.
  let hallazgoDuplicadosCatalogo = null;
  if (skusVistos.size > 0) {
    const [existentes] = await pool.query('SELECT sku FROM productos WHERE sku IN (?)', [Array.from(skusVistos)]);
    if (existentes.length > 0) {
      hallazgoDuplicadosCatalogo = {
        tipo: 'duplicado_catalogo',
        severidad: 'media',
        titulo: `${existentes.length} SKU ya existen en tu catálogo`,
        descripcion: 'Se actualizarán en vez de crearse como productos nuevos — revisa si es lo esperado.',
        count: existentes.length,
        filasEjemplo: existentes.slice(0, 10).map((f) => skuAPrimeraFila.get(f.sku)).filter((f) => f !== undefined),
      };
    }
  }

  const hallazgosCalidad = [];
  if (hallazgoDuplicadosCatalogo) hallazgosCalidad.push(hallazgoDuplicadosCatalogo);
  // Punto 398: una vez que el usuario ya decidió qué hacer con el
  // precio/proveedor de una columna (limpiezaMezcla), el hallazgo deja de
  // listarse como pendiente — mismo criterio que los grupos de unidad_base
  // resueltos (propuesta 1): resuelto = desaparece, no queda "fantasma".
  for (const [columna, mezcla] of deteccionMezcla.entries()) {
    if (limpiezaMezcla[columna]) continue;
    const totalProveedor = mezcla.filasProveedor.size;
    const totalPrecio = mezcla.filasPrecio.size;
    if (totalProveedor === 0 && totalPrecio === 0) continue;
    const primerPrecio = mezcla.filasPrecio.values().next().value;
    const tokensOrdenados = Array.from(mezcla.tokensConfirmados.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    // Conteo de valores de precio detectados, mismo criterio que
    // tokensConfirmados (más frecuente primero) — para mostrar unos cuantos
    // ejemplos en el UI y que el usuario juzgue si de verdad es un precio
    // antes de decidir qué hacer con él (mover/descartar/ignorar).
    const preciosConteo = new Map();
    for (const info of mezcla.filasPrecio.values()) {
      preciosConteo.set(info.valor, (preciosConteo.get(info.valor) || 0) + 1);
    }
    const preciosOrdenados = Array.from(preciosConteo.entries()).sort((a, b) => b[1] - a[1]).map(([v]) => v);
    const filasCombinadas = Array.from(new Set([...mezcla.filasProveedor.keys(), ...mezcla.filasPrecio.keys()]))
      .sort((a, b) => a - b)
      .slice(0, 10)
      .map((idxFila) => idxFila + 2);
    const partes = [];
    if (totalPrecio > 0) partes.push(`un precio (ej. "$${primerPrecio.valor}")`);
    if (totalProveedor > 0) partes.push(`un posible proveedor (${tokensOrdenados.length} distinto(s): ${tokensOrdenados.slice(0, 5).join(', ')}${tokensOrdenados.length > 5 ? '…' : ''})`);
    hallazgosCalidad.push({
      tipo: 'datos_mezclados',
      severidad: 'media',
      columna,
      titulo: `${Math.max(totalProveedor, totalPrecio)} fila(s) con datos mezclados en "${columna}"`,
      descripcion: `Se detectó ${partes.join(' y ')} pegados al texto — ¿los separo a su propio campo?`,
      count: Math.max(totalProveedor, totalPrecio),
      filasEjemplo: filasCombinadas,
      tienePrecio: totalPrecio > 0,
      tieneProveedor: totalProveedor > 0,
      totalPrecio,
      totalProveedor,
      ejemplosProveedor: tokensOrdenados.slice(0, 8),
      ejemplosPrecio: preciosOrdenados.slice(0, 8),
    });
  }
  if (precioCero.count > 0) {
    hallazgosCalidad.push({
      tipo: 'precio_cero',
      severidad: 'info',
      titulo: `${precioCero.count} fila(s) con precio de venta en $0.00`,
      descripcion: 'No bloquea la importación, solo aviso — confirma que sea intencional.',
      count: precioCero.count,
      filasEjemplo: precioCero.filasEjemplo,
    });
  }

  return {
    filasValidas,
    errores,
    erroresAgrupados: agruparErroresPorValor(errores),
    hallazgosCalidad,
    totalFilas: filasCrudas.length,
    filasOk: filasValidas.length,
    filasError: abortado ? filasCrudas.length - filasValidas.length : new Set(errores.map((e) => e.fila)).size,
    abortado,
    motivoAborto,
  };
}

// Agrupa errores idénticos (misma columna + mismo valor + mismo motivo) en
// una sola entrada con su conteo real — propuesta 1 del punto 397: un
// archivo real puede traer 11,552 filas con el MISMO valor de catálogo sin
// resolver ("UNIDAD" no existe) — listarlas una por una no ayuda a
// corregir nada, agrupadas sí (corrige el valor una vez, se aplica a
// todas). Se ordena por conteo descendente: la causa más grande primero.
function agruparErroresPorValor(errores) {
  const grupos = new Map();
  for (const e of errores) {
    const clave = JSON.stringify([e.columna, e.valor, e.motivo]);
    if (!grupos.has(clave)) {
      grupos.set(clave, { columna: e.columna, valor: e.valor, motivo: e.motivo, count: 0, filasEjemplo: [] });
    }
    const grupo = grupos.get(clave);
    grupo.count += 1;
    if (grupo.filasEjemplo.length < 5) grupo.filasEjemplo.push(e.fila);
  }
  return Array.from(grupos.values()).sort((a, b) => b.count - a.count).slice(0, 100);
}

// ---------------------------------------------------------------------
// Categorías: auto-resuelve o crea por nombre (a diferencia de unidades,
// que nunca se crean implícitas — 34.3/34.5 solo restringe eso a unidades).
// ---------------------------------------------------------------------

async function resolverOCrearCategoriaPorNombre(nombre) {
  if (!nombre) return null;
  const pool = obtenerPool();
  const [existente] = await pool.query(
    'SELECT id FROM categorias_inventario WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
    [nombre]
  );
  if (existente.length > 0) return existente[0].id;
  const slug = generarSlugCategoriaInventario(nombre);
  const ahora = new Date();
  let slugFinal = slug;
  let sufijo = 2;
  // eslint-disable-next-line no-await-in-loop
  while ((await pool.query('SELECT id FROM categorias_inventario WHERE slug = ? LIMIT 1', [slugFinal]))[0].length > 0) {
    slugFinal = `${slug.slice(0, 56)}_${sufijo}`;
    sufijo += 1;
  }
  const [resultado] = await pool.query(
    `INSERT INTO categorias_inventario (slug, nombre, activa, orden, creado_en, actualizado_en)
     VALUES (?, ?, 1, 999, ?, ?)`,
    [slugFinal, nombre, ahora, ahora]
  );
  return resultado.insertId;
}

// ---------------------------------------------------------------------
// Ejecución: upsert por SKU (§34.6) + existencia inicial (§34.7).
// Atomicidad producto+entrada vía COMPENSACIÓN (revertir el producto si el
// movimiento falla) — MISMO patrón ya usado en D8/Ventas
// (POST /api/admin/ordenes-compra en server.js): registrarMovimiento()
// abre y cierra su propia transacción, así que no se puede envolver junto
// con el INSERT/UPDATE de producto en una transacción SQL única.
// ---------------------------------------------------------------------

async function procesarFilaImportacion(fila, opciones) {
  const { almacenId, usuario, importacionId, sobrescribirVacios } = opciones;
  const pool = obtenerPool();

  const [existentes] = await pool.query('SELECT * FROM productos WHERE sku = ? LIMIT 1', [fila.sku]);
  const productoExistente = existentes[0] || null;
  const categoriaId = await resolverOCrearCategoriaPorNombre(fila.categoria);
  const ahora = new Date();

  let productoId;
  let esNuevo = false;
  let snapshotPrevio = null;

  const columnas = ['nombre', 'codigo_barras', 'categoria_id', 'unidad_id', 'tipo', 'costo', 'precio', 'stock_minimo', 'stock_maximo', 'punto_reorden', 'proveedor_principal', 'notas', 'estado', 'extra'];
  const valoresFila = {
    nombre: fila.nombre,
    codigo_barras: fila.codigo_barras,
    categoria_id: categoriaId,
    unidad_id: fila.unidad_id,
    tipo: fila.tipo,
    costo: fila.costo,
    precio: fila.precio,
    stock_minimo: fila.stock_minimo,
    stock_maximo: fila.stock_maximo,
    punto_reorden: fila.punto_reorden,
    proveedor_principal: fila.proveedor_principal,
    notas: fila.notas,
    estado: fila.estado,
    extra: fila.extra ? JSON.stringify(fila.extra) : null,
  };

  if (productoExistente) {
    productoId = productoExistente.id;
    snapshotPrevio = productoExistente;
    const sets = [];
    const params = [];
    for (const columna of columnas) {
      const valorNuevo = valoresFila[columna];
      const vacio = valorNuevo === null || valorNuevo === undefined || valorNuevo === '';
      if (vacio && !sobrescribirVacios) continue; // §34.6: un vacío nunca borra dato existente salvo el checkbox
      sets.push(`${columna} = ?`);
      params.push(vacio ? null : valorNuevo);
    }
    // Un SKU con un producto en papelera sigue "ocupado" (uq_productos_sku
    // no distingue eliminado_en) — sin esto, re-importar el mismo archivo
    // actualizaba los campos pero el producto seguía invisible en la
    // papelera, un estado inconsistente. Traerlo de vuelta a activo es el
    // comportamiento esperado de una migración real. Bug real encontrado
    // en la validación visual del segmento 6 (2026-08-25).
    if (productoExistente.eliminado_en) {
      sets.push('eliminado_en = NULL');
    }
    if (sets.length > 0) {
      sets.push('actualizado_en = ?');
      params.push(ahora, productoId);
      await pool.query(`UPDATE productos SET ${sets.join(', ')} WHERE id = ?`, params);
    }
  } else {
    esNuevo = true;
    const [insercion] = await pool.query(
      `INSERT INTO productos
        (sku, codigo_barras, nombre, categoria_id, unidad_id, tipo, costo, costo_promedio, precio,
         stock_minimo, stock_maximo, punto_reorden, proveedor_principal, notas, estado, extra,
         creado_en, actualizado_en)
       VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?)`,
      [
        fila.sku, valoresFila.codigo_barras, valoresFila.nombre, valoresFila.categoria_id, valoresFila.unidad_id,
        valoresFila.tipo, valoresFila.costo, valoresFila.precio, valoresFila.stock_minimo, valoresFila.stock_maximo,
        valoresFila.punto_reorden, valoresFila.proveedor_principal, valoresFila.notas, valoresFila.estado,
        valoresFila.extra, ahora, ahora,
      ]
    );
    productoId = insercion.insertId;
  }

  // Existencia inicial (§34.7): solo tipo "producto", solo si > 0, y solo si
  // el producto no tiene YA movimientos (§34.6: impide duplicar el
  // inventario inicial en una re-importación del mismo archivo).
  if (fila.tipo === 'producto' && fila.existencia_inicial && fila.existencia_inicial > 0) {
    const yaTieneMovimientos = await productoTieneMovimientos(productoId);
    if (yaTieneMovimientos) {
      return { productoId, esNuevo, existenciaIgnorada: true };
    }
    const resultadoMovimiento = await registrarMovimiento({
      productoId,
      almacenId,
      tipo: 'inventario_inicial',
      cantidad: fila.existencia_inicial,
      costoUnitario: fila.costo || 0,
      documentoOrigen: `IMP-${String(importacionId).padStart(6, '0')}`,
      usuario,
      motivo: 'Importación masiva — inventario inicial',
    });
    if (resultadoMovimiento.error) {
      // Revierte SU producto Y SU entrada juntos (§34.7) — compensación,
      // no rollback de transacción SQL (ver nota arriba del bloque).
      if (esNuevo) {
        await pool.query('DELETE FROM productos WHERE id = ?', [productoId]);
      } else if (snapshotPrevio) {
        await pool.query(
          `UPDATE productos SET nombre=?, codigo_barras=?, categoria_id=?, unidad_id=?, tipo=?, costo=?, precio=?,
             stock_minimo=?, stock_maximo=?, punto_reorden=?, proveedor_principal=?, notas=?, estado=?, extra=?,
             actualizado_en=? WHERE id=?`,
          [
            snapshotPrevio.nombre, snapshotPrevio.codigo_barras, snapshotPrevio.categoria_id, snapshotPrevio.unidad_id,
            snapshotPrevio.tipo, snapshotPrevio.costo, snapshotPrevio.precio, snapshotPrevio.stock_minimo,
            snapshotPrevio.stock_maximo, snapshotPrevio.punto_reorden, snapshotPrevio.proveedor_principal,
            snapshotPrevio.notas, snapshotPrevio.estado, snapshotPrevio.extra, snapshotPrevio.actualizado_en, productoId,
          ]
        );
      }
      return { error: resultadoMovimiento.error, mensaje: resultadoMovimiento.mensaje, fila: fila.fila };
    }
  }

  return { productoId, esNuevo };
}

// Reprocesa el conjunto COMPLETO de filas válidas en cada llamada — es
// naturalmente idempotente (upsert por SKU + guardia anti-doble-stock-
// inicial de arriba), así que un reintento tras un fallo parcial "completa
// lo faltante" (§34.8) sin necesitar una marca de progreso por fila:
// re-aplicar la misma fila sobre un producto ya migrado no cambia nada.
const TAMANO_CHUNK = 500;

async function ejecutarFilasImportacion(importacionId, filasValidas, opciones) {
  const pool = obtenerPool();
  let creados = 0;
  let actualizados = 0;
  let ignorados = 0;
  const erroresEjecucion = [];

  for (let inicio = 0; inicio < filasValidas.length; inicio += TAMANO_CHUNK) {
    const chunk = filasValidas.slice(inicio, inicio + TAMANO_CHUNK);
    for (const fila of chunk) {
      // eslint-disable-next-line no-await-in-loop
      const resultado = await procesarFilaImportacion(fila, { ...opciones, importacionId });
      if (resultado.error) {
        erroresEjecucion.push({ fila: fila.fila, columna: 'existencia_inicial', valor: String(fila.existencia_inicial), motivo: resultado.mensaje });
      } else {
        if (resultado.esNuevo) creados += 1;
        else actualizados += 1;
        if (resultado.existenciaIgnorada) ignorados += 1;
      }
    }
    const procesadas = Math.min(inicio + TAMANO_CHUNK, filasValidas.length);
    const progreso = filasValidas.length > 0 ? Math.round((procesadas / filasValidas.length) * 100) : 100;
    // eslint-disable-next-line no-await-in-loop
    await pool.query(
      'UPDATE imp_importaciones SET progreso = ?, productos_creados = ?, productos_actualizados = ?, actualizado_en = ? WHERE id = ?',
      [progreso, creados, actualizados, new Date(), importacionId]
    );
  }

  return { creados, actualizados, ignorados, erroresEjecucion };
}

// ---------------------------------------------------------------------
// Perfiles de mapeo guardados por tenant (§34.3.2)
// ---------------------------------------------------------------------

async function listarPerfilesMapeo() {
  const [filas] = await obtenerPool().query(
    'SELECT id, nombre, creado_por, creado_en, usado_ultima_vez FROM inv_perfiles_mapeo ORDER BY usado_ultima_vez DESC, creado_en DESC'
  );
  return filas;
}

async function crearPerfilMapeo({ nombre, cabecerasOriginales, mapeoFinal, creadoPor }) {
  const nombreLimpio = sanitizeText(nombre, 100) || 'Sin nombre';
  const mapeoNormalizado = {};
  for (const [campo, idx] of Object.entries(mapeoFinal)) {
    if (idx === null || idx === undefined) continue;
    const original = cabecerasOriginales[idx];
    if (original === undefined) continue;
    mapeoNormalizado[campo] = normalizarCabecera(original);
  }
  const firma = firmaCabeceras(cabecerasOriginales);
  const ahora = new Date();
  const [resultado] = await obtenerPool().query(
    `INSERT INTO inv_perfiles_mapeo (nombre, firma_cabeceras, mapeo_json, creado_por, creado_en, usado_ultima_vez)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nombreLimpio, firma, JSON.stringify(mapeoNormalizado), creadoPor ? sanitizeText(creadoPor, 100) : null, ahora, ahora]
  );
  return { id: resultado.insertId, nombre: nombreLimpio };
}

async function eliminarPerfilMapeo(id) {
  const [resultado] = await obtenerPool().query('DELETE FROM inv_perfiles_mapeo WHERE id = ?', [id]);
  return resultado.affectedRows > 0;
}

// Coincidencia completa (misma firma exacta) o parcial (una o dos columnas
// de diferencia — 34.3.2): en el caso parcial, solo se pre-mapean las
// cabeceras del perfil que SÍ están presentes en el archivo nuevo; el resto
// sigue el flujo normal (exacto→sinónimo→difuso) en sugerirMapeoCompleto().
async function buscarPerfilParaCabeceras(cabecerasOriginales) {
  const pool = obtenerPool();
  const cabecerasNorm = cabecerasOriginales.map(normalizarCabecera);
  const firma = firmaCabeceras(cabecerasOriginales);

  const [exacto] = await pool.query(
    'SELECT * FROM inv_perfiles_mapeo WHERE firma_cabeceras = ? ORDER BY usado_ultima_vez DESC LIMIT 1',
    [firma]
  );
  if (exacto.length > 0) {
    const mapeoJson = typeof exacto[0].mapeo_json === 'string' ? JSON.parse(exacto[0].mapeo_json) : exacto[0].mapeo_json;
    return { perfilId: exacto[0].id, nombre: exacto[0].nombre, mapeoAplicable: mapeoJson, coincidenciaCompleta: true };
  }

  const [candidatos] = await pool.query('SELECT * FROM inv_perfiles_mapeo ORDER BY usado_ultima_vez DESC LIMIT 20');
  let mejor = null;
  let mejorConteo = 0;
  for (const fila of candidatos) {
    const mapeoJson = typeof fila.mapeo_json === 'string' ? JSON.parse(fila.mapeo_json) : fila.mapeo_json;
    const coincidencias = Object.values(mapeoJson).filter((c) => cabecerasNorm.includes(c)).length;
    if (coincidencias > mejorConteo) {
      mejorConteo = coincidencias;
      mejor = { fila, mapeoJson };
    }
  }
  // Umbral mínimo para que valga la pena ofrecer un pre-mapeo parcial —
  // 1 sola columna en común es demasiado poco para ser información real.
  if (mejor && mejorConteo >= 2) {
    const mapeoParcial = {};
    for (const [campo, cabNorm] of Object.entries(mejor.mapeoJson)) {
      if (cabecerasNorm.includes(cabNorm)) mapeoParcial[campo] = cabNorm;
    }
    return { perfilId: mejor.fila.id, nombre: mejor.fila.nombre, mapeoAplicable: mapeoParcial, coincidenciaCompleta: false };
  }
  return null;
}

async function marcarPerfilUsado(id) {
  await obtenerPool().query('UPDATE inv_perfiles_mapeo SET usado_ultima_vez = ? WHERE id = ?', [new Date(), id]);
}

// ---------------------------------------------------------------------
// Plantilla descargable (§34.3.4) y exportación con protección CSV (§35)
// ---------------------------------------------------------------------

// OWASP CSV Injection: una celda que empiece con = + - @ tab o CR se abre
// como fórmula en Excel/Sheets con los permisos de quien la abre. Se
// antepone un apóstrofo — mismo criterio ya aplicado en §35 del documento,
// aquí se reutiliza para el CSV de errores de esta misma pantalla.
function protegerCeldaCSV(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) return `'${texto}`;
  return texto;
}

function filaACSV(valores) {
  return valores
    .map((v) => {
      const protegido = protegerCeldaCSV(v);
      return /[",\n]/.test(protegido) ? `"${protegido.replace(/"/g, '""')}"` : protegido;
    })
    .join(',');
}

// Punto 179: la carga masiva es SOLO para productos — un servicio siempre
// se da de alta a mano desde "Nuevo producto" (unidad fija en horas, sin
// código de barras/stock/punto de reorden). Por eso la plantilla ya no
// trae un ejemplo de fila "servicio" ni permite elegirlo en el
// desplegable de "tipo" del XLSX (ver idxTipo más abajo).
const EJEMPLOS_PLANTILLA = [
  ['DEMO-001', 'Playera Azul Talla M', '7501234567890', '', '', '', '', '', 'Ropa', 'Pieza', 'producto', '120.00', '250.00', '5', '50', '10', 'Proveedor Ejemplo SA', '20', 'activo', 'Producto de ejemplo — bórralo antes de importar tu catálogo real.'],
  ['DEMO-002', 'Aceite de motor 1L', '', '', '', '', '', '', 'Refacciones', 'Litro', 'producto', '85.00', '150.00', '', '', '', '', '', 'activo', ''],
];

function generarPlantillaCSV() {
  const cabeceras = CAMPOS_IMPORTABLES.map((c) => c.campo);
  const filas = [cabeceras, ...EJEMPLOS_PLANTILLA];
  return filas.map(filaACSV).join('\r\n');
}

async function generarPlantillaXLSX() {
  const pool = obtenerPool();
  const [unidades] = await pool.query('SELECT nombre FROM unidades_medida ORDER BY nombre ASC');
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet('Plantilla');
  const cabeceras = CAMPOS_IMPORTABLES.map((c) => c.campo);
  hoja.addRow(cabeceras);
  hoja.getRow(1).font = { bold: true };
  for (const ejemplo of EJEMPLOS_PLANTILLA) hoja.addRow(ejemplo);

  const idxUnidad = cabeceras.indexOf('unidad_base') + 1; // 1-based en exceljs
  const idxTipo = cabeceras.indexOf('tipo') + 1;
  const idxEstado = cabeceras.indexOf('estado') + 1;
  const listaUnidades = unidades.map((u) => u.nombre);
  for (let fila = 2; fila <= 200; fila++) {
    if (listaUnidades.length > 0) {
      hoja.getCell(fila, idxUnidad).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`"${listaUnidades.join(',')}"`],
      };
    }
    hoja.getCell(fila, idxTipo).dataValidation = { type: 'list', allowBlank: true, formulae: ['"producto"'] };
    hoja.getCell(fila, idxEstado).dataValidation = { type: 'list', allowBlank: true, formulae: ['"activo,inactivo"'] };
  }
  hoja.columns.forEach((col) => { col.width = 22; });
  return workbook.xlsx.writeBuffer();
}

function generarCSVErrores(errores) {
  const cabeceras = ['fila', 'columna', 'valor', 'motivo'];
  const filas = [cabeceras, ...errores.map((e) => [e.fila, e.columna, e.valor, e.motivo])];
  return filas.map(filaACSV).join('\r\n');
}

module.exports = {
  CLAVES_EXTRA_PROHIBIDAS,
  normalizarCabecera,
  similitud,
  sugerirMapeoCompleto,
  firmaCabeceras,
  parsearArchivoCSV,
  listarHojasXLSX,
  parsearArchivoXLSX,
  listarHojasXLS,
  parsearArchivoXLS,
  parsearNumeroTolerante,
  normalizarTipoProducto,
  normalizarEstadoProducto,
  validarFilasImportacion,
  detectarDatosMezclados,
  ejecutarFilasImportacion,
  listarPerfilesMapeo,
  crearPerfilMapeo,
  eliminarPerfilMapeo,
  buscarPerfilParaCabeceras,
  marcarPerfilUsado,
  generarPlantillaCSV,
  generarPlantillaXLSX,
  generarCSVErrores,
  protegerCeldaCSV,
  TAMANO_CHUNK,
};
