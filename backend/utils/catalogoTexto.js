// Interpretación genérica de un catálogo remoto tipo "clave,descripción"
// (JSON o CSV/TSV) — extraído de usoCfdi.js para que también lo use
// claveProdServ.js sin duplicar la lógica de parseo. Ambos catálogos del
// SAT se publican en el mismo par de formatos, así que un solo parser
// parametrizado (alias de campos, longitud máxima de la clave) cubre los
// dos sin repetir código.

// Valida que la lista tenga forma de catálogo real antes de aceptarla,
// para nunca sobreescribir con datos basura si el origen remoto cambia de
// formato inesperadamente.
function esCatalogoValido(catalogo, claveMaxLen = 10) {
  if (!Array.isArray(catalogo) || catalogo.length < 5) return false;
  return catalogo.every(
    (item) =>
      item &&
      typeof item.clave === 'string' &&
      item.clave.trim().length > 0 &&
      item.clave.trim().length <= claveMaxLen &&
      typeof item.descripcion === 'string' &&
      item.descripcion.trim().length > 0
  );
}

// Divide una línea CSV/TSV respetando campos entre comillas (para que una
// descripción con una coma no se corte a la mitad). Soporta comillas
// dobles escapadas ("") dentro del campo.
function dividirLineaCsv(linea, separador) {
  const columnas = [];
  let actual = '';
  let dentroDeComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const char = linea[i];
    if (char === '"') {
      if (dentroDeComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        dentroDeComillas = !dentroDeComillas;
      }
    } else if (char === separador && !dentroDeComillas) {
      columnas.push(actual.trim());
      actual = '';
    } else {
      actual += char;
    }
  }
  columnas.push(actual.trim());
  return columnas;
}

// Divide el cuerpo entre paréntesis de un "INSERT ... VALUES (...)" en sus
// valores posicionales, respetando comillas simples (con '' como comilla
// escapada dentro del texto, estilo SQLite/Postgres) y valores sin comillas
// (numéricos). No hay nombres de columna en un dump SQL, por eso el
// resultado se lee por posición (ver `sqlIndiceClave`/`sqlIndiceDescripcion`).
function dividirTuplaSql(cuerpo) {
  const valores = [];
  let i = 0;
  const n = cuerpo.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(cuerpo[i])) i += 1;
    if (i >= n) break;
    if (cuerpo[i] === "'") {
      i += 1;
      let valor = '';
      while (i < n) {
        if (cuerpo[i] === "'" && cuerpo[i + 1] === "'") {
          valor += "'";
          i += 2;
        } else if (cuerpo[i] === "'") {
          i += 1;
          break;
        } else {
          valor += cuerpo[i];
          i += 1;
        }
      }
      valores.push(valor);
    } else {
      let valor = '';
      while (i < n && cuerpo[i] !== ',') {
        valor += cuerpo[i];
        i += 1;
      }
      valores.push(valor.trim());
    }
  }
  return valores;
}

// Interpreta un dump SQL de tipo "INSERT INTO tabla VALUES ('a','b',...);"
// (el formato en que phpcfdi/resources-sat-catalogs publica los catálogos
// del SAT en SQLite) — sin nombres de columna, se leen por posición.
function normalizarCatalogoDesdeInsertsSql(texto, { claveMaxLen, sqlIndiceClave, sqlIndiceDescripcion }) {
  const regexInsert = /INSERT INTO[^(]*\(([\s\S]*?)\);/gi;
  const filas = [];
  let match = regexInsert.exec(texto);
  while (match !== null) {
    const valores = dividirTuplaSql(match[1]);
    const clave = valores[sqlIndiceClave];
    const descripcion = valores[sqlIndiceDescripcion];
    if (clave != null && descripcion != null) {
      filas.push({ clave: String(clave).trim(), descripcion: String(descripcion).trim() });
    }
    match = regexInsert.exec(texto);
  }
  return esCatalogoValido(filas, claveMaxLen) ? filas : null;
}

// Intenta interpretar el texto como JSON (varias formas conocidas), como un
// dump SQL de INSERTs, o como CSV/TSV con encabezado y al menos 2 columnas
// (clave, descripcion) — las tres formas en que se han visto publicados
// estos catálogos. `aliasClave`/`aliasDescripcion` son nombres de campo
// adicionales a probar en el JSON (cada catálogo del SAT usa una convención
// distinta, ej. "c_UsoCFDI" o "c_ClaveProdServ"); `sqlIndiceClave`/
// `sqlIndiceDescripcion` son las posiciones (0-based) de esas columnas en un
// dump SQL, que no trae nombres de columna.
function normalizarCatalogoDesdeTexto(
  texto,
  { claveMaxLen = 10, aliasClave = [], aliasDescripcion = [], sqlIndiceClave = 0, sqlIndiceDescripcion = 1 } = {}
) {
  const contenido = String(texto || '').trim();
  if (!contenido) return null;

  const camposClave = ['clave', 'value', 'id', 'codigo', ...aliasClave];
  const camposDescripcion = ['descripcion', 'text', 'nombre', 'label', 'name', ...aliasDescripcion];

  // Intento 1: JSON (array directo, o { data: [...] })
  try {
    const data = JSON.parse(contenido);
    const lista = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : null;
    if (lista) {
      const normalizado = lista
        .map((item) => {
          const clave = camposClave.reduce((acc, campo) => (acc != null ? acc : item[campo]), null);
          const descripcion = camposDescripcion.reduce((acc, campo) => (acc != null ? acc : item[campo]), null);
          if (clave == null || descripcion == null) return null;
          return { clave: String(clave).trim(), descripcion: String(descripcion).trim() };
        })
        .filter(Boolean);
      if (esCatalogoValido(normalizado, claveMaxLen)) return normalizado;
    }
  } catch (e) {
    // No era JSON valido; se intenta como dump SQL o CSV/TSV abajo.
  }

  // Intento 2: dump SQL de INSERTs (INSERT INTO tabla VALUES (...);)
  if (/INSERT INTO\s+\S+[\s\S]*?VALUES\s*\(/i.test(contenido)) {
    const normalizado = normalizarCatalogoDesdeInsertsSql(contenido, { claveMaxLen, sqlIndiceClave, sqlIndiceDescripcion });
    if (normalizado) return normalizado;
  }

  // Intento 3: CSV/TSV con encabezado en la primera línea
  const lineas = contenido.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lineas.length > 1) {
    const separador = lineas[0].includes('\t') ? '\t' : ',';
    const filas = lineas.slice(1);
    const normalizado = filas
      .map((linea) => {
        const columnas = dividirLineaCsv(linea, separador);
        if (columnas.length < 2) return null;
        const [clave, descripcion] = columnas;
        if (!clave || !descripcion) return null;
        return { clave, descripcion };
      })
      .filter(Boolean);
    if (esCatalogoValido(normalizado, claveMaxLen)) return normalizado;
  }

  return null;
}

module.exports = { esCatalogoValido, dividirLineaCsv, dividirTuplaSql, normalizarCatalogoDesdeTexto };
