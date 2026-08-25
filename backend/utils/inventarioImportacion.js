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

async function validarFilasImportacion(cabecerasOriginales, filasCrudas, opciones) {
  const {
    mapeoFinal, // { campo: columnaIndice }
    modo = 'tolerante', // 'tolerante' | 'estricto'
    conservarExtra = true,
  } = opciones;

  const pool = obtenerPool();
  const [unidadesFilas] = await pool.query('SELECT id, nombre FROM unidades_medida');
  const unidadesPorNombre = new Map(unidadesFilas.map((u) => [u.nombre.trim().toLowerCase(), u.id]));

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
  const filasValidas = [];
  const errores = [];
  let abortado = false;
  let motivoAborto = null;

  for (let i = 0; i < filasCrudas.length; i++) {
    if (abortado) break;
    const filaCruda = filasCrudas[i];
    const numeroFilaVisible = i + 2; // fila 1 = encabezados, datos empiezan en 2 (convención estándar de hojas de cálculo)
    const obtener = (campo) => {
      const idx = mapeoFinal[campo];
      if (idx === undefined || idx === null) return '';
      const valor = filaCruda[idx];
      return valor === undefined || valor === null ? '' : String(valor).trim();
    };

    const erroresFila = [];
    const sku = sanitizeText(obtener('sku'), 60);
    if (!sku) erroresFila.push({ columna: 'sku', valor: '', motivo: 'SKU vacío.' });
    else if (skusVistos.has(sku)) erroresFila.push({ columna: 'sku', valor: sku, motivo: 'SKU duplicado dentro del archivo.' });
    else skusVistos.add(sku);

    const nombre = sanitizeText(obtener('nombre'), 200);
    if (!nombre) erroresFila.push({ columna: 'nombre', valor: '', motivo: 'Nombre vacío.' });

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

    filasValidas.push({
      fila: numeroFilaVisible,
      sku,
      nombre,
      codigo_barras: sanitizeText(obtener('codigo_barras'), 60) || null,
      categoria: sanitizeText(obtener('categoria'), 100) || null,
      unidad_id: unidadId,
      tipo: normalizarTipoProducto(obtener('tipo')),
      costo: Number.isFinite(numeros.costo) ? numeros.costo : null,
      precio: Number.isFinite(numeros.precio) ? numeros.precio : null,
      stock_minimo: Number.isFinite(numeros.stock_minimo) ? numeros.stock_minimo : null,
      stock_maximo: Number.isFinite(numeros.stock_maximo) ? numeros.stock_maximo : null,
      punto_reorden: Number.isFinite(numeros.punto_reorden) ? numeros.punto_reorden : null,
      proveedor_principal: sanitizeText(obtener('proveedor_principal'), 200) || null,
      notas: sanitizeTextoLibre(obtener('notas'), 2000) || null,
      estado: normalizarEstadoProducto(obtener('estado')),
      existencia_inicial: Number.isFinite(numeros.existencia_inicial) ? numeros.existencia_inicial : null,
      extra: Object.keys(extra).length > 0 ? extra : null,
    });
  }

  return {
    filasValidas,
    errores,
    totalFilas: filasCrudas.length,
    filasOk: filasValidas.length,
    filasError: abortado ? filasCrudas.length - filasValidas.length : new Set(errores.map((e) => e.fila)).size,
    abortado,
    motivoAborto,
  };
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

const EJEMPLOS_PLANTILLA = [
  ['DEMO-001', 'Playera Azul Talla M', '7501234567890', '', '', '', '', '', 'Ropa', 'Pieza', 'producto', '120.00', '250.00', '5', '50', '10', 'Proveedor Ejemplo SA', '20', 'activo', 'Producto de ejemplo — bórralo antes de importar tu catálogo real.'],
  ['DEMO-002', 'Servicio de instalación', '', '', '', '', '', '', 'Servicios', 'Pieza', 'servicio', '', '400.00', '', '', '', '', '', 'activo', ''],
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
    hoja.getCell(fila, idxTipo).dataValidation = { type: 'list', allowBlank: true, formulae: ['"producto,servicio"'] };
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
  parsearNumeroTolerante,
  normalizarTipoProducto,
  normalizarEstadoProducto,
  validarFilasImportacion,
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
