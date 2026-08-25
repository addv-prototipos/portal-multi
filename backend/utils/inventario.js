// Módulo "Inventarios" — motor de existencias (ver inventarios.md, segmento
// v1). Este archivo centraliza lo que comparten el esquema (backend/db.js),
// las rutas del CRUD (segmento 2, backend/server.js) y el script de
// verificación (backend/scripts/verificar-inventario.js): folios, tipos de
// movimiento válidos, y sobre todo `registrarMovimiento()` — la ÚNICA forma
// permitida de alterar una existencia (D6/§48 regla 1: nunca modificar
// existencia sin movimiento). También trae el CRUD de categorías, mismo
// patrón que backend/utils/gastos.js (slug estable, activa=0 en vez de
// borrar si ya tiene productos) — pero sin "protegida": Inventarios no
// tiene una categoría de respaldo del sistema como "otro" en Gastos.
//
// require() perezoso de '../db' dentro de cada función (no a nivel de
// módulo): mismo motivo que backend/utils/gastos.js — db.js importa este
// archivo antes de terminar de armar su module.exports.
function obtenerPool() {
  return require('../db').pool;
}

const { sanitizeText, sanitizeTextoLibre } = require('./validate');
const { negativoPermitido } = require('./inventarioConfig');

// Unidades de medida sembradas por ensureSchema() la primera vez (§9 de
// inventarios.md) — cubren pieza, volumen y peso para que líquidos y
// gramaje no necesiten campos adicionales (decisión D11).
const UNIDADES_SEED = [
  ['Pieza', 'pz'],
  ['Caja', 'caja'],
  ['Paquete', 'paq'],
  ['Bolsa', 'bolsa'],
  ['Kilogramo', 'kg'],
  ['Gramo', 'g'],
  ['Litro', 'L'],
  ['Mililitro', 'ml'],
  ['Metro', 'm'],
  ['Centímetro', 'cm'],
  ['Metro cuadrado', 'm2'],
  ['Metro cúbico', 'm3'],
  ['Par', 'par'],
  ['Juego', 'juego'],
  ['Rollo', 'rollo'],
  ['Tarima', 'tarima'],
];

const UNIDAD_BASE_DEFECTO = 'Pieza';

// Código del almacén único auto-provisionado (D2 — multi-almacén preparado,
// no operativo en v1).
const ALMACEN_DEFECTO_CODIGO = 'ALM-1';
const ALMACEN_DEFECTO_NOMBRE = 'Almacén principal';

// 4 tipos de entrada + 4 de salida (P4, cerrada 2026-08-24 — ver §0.6.1 de
// inventarios.md). Cualquier otro tipo mencionado en el documento
// (transferencia, producción, consignación, devolución a proveedor...)
// queda diferido a Fase 2/3 — ver §0.4.1.
const TIPOS_ENTRADA = ['compra', 'devolucion_cliente', 'inventario_inicial', 'ajuste_positivo'];
const TIPOS_SALIDA = ['venta', 'consumo_interno', 'merma', 'ajuste_negativo'];
const TIPOS_VALIDOS = [...TIPOS_ENTRADA, ...TIPOS_SALIDA];

// Folios EN-000001 / SA-000001 / AJU-000001 — mismo padStart(6,'0') que
// OC-/TK- ya usa el resto del proyecto (server.js: generarFolio/
// generarNumeroCompra). Los ajustes (positivo y negativo) comparten
// prefijo AJU- (§0.3 punto 8 de inventarios.md).
function prefijoParaTipo(tipo) {
  if (tipo === 'ajuste_positivo' || tipo === 'ajuste_negativo') return 'AJU';
  if (TIPOS_ENTRADA.includes(tipo)) return 'EN';
  if (TIPOS_SALIDA.includes(tipo)) return 'SA';
  return null;
}

function generarFolioMovimiento(tipo, id) {
  const prefijo = prefijoParaTipo(tipo);
  if (!prefijo) return null;
  return `${prefijo}-${String(id).padStart(6, '0')}`;
}

// Registra UNA mutación de stock (entrada o salida) de forma atómica y a
// prueba de concurrencia — implementación de inventarios.md §0.5:
//   A. Atomicidad: INSERT del movimiento + UPDATE de existencias en UNA
//      transacción.
//   B. Anti-sobrevende: bloqueo de fila (`FOR UPDATE`) antes de decidir.
//   C. Lock de `productos` también, para no perder actualizaciones de
//      `costo_promedio` cuando dos entradas del mismo producto llegan a
//      la vez (lost update — hallazgo de la auditoría 2026-08-24).
//   D. El libro es append-only: el movimiento nunca se edita ni se borra.
//   E. Idempotencia: con `idempotencyKey`, un reintento devuelve la MISMA
//      respuesta sin duplicar el movimiento — nunca hay una ventana de
//      carrera real porque la clave de idempotencia se reclama con un
//      INSERT único DENTRO de la misma transacción del movimiento.
//
// Devuelve { movimientoId, folio, ... } en éxito, o { error, mensaje, ... }
// en cualquier rechazo esperado (nunca lanza para esos casos — el
// llamador de nivel HTTP decide el status code según `error`).
async function registrarMovimiento(opts) {
  const {
    productoId,
    almacenId,
    tipo,
    cantidad,
    costoUnitario = null,
    motivo = null,
    notas = null,
    usuario = null,
    documentoOrigen = null,
    ubicacionNota = null,
    idempotencyKey = null,
  } = opts || {};

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return { error: 'INV_TIPO_INVALIDO', mensaje: `Tipo de movimiento no reconocido: ${tipo}.` };
  }
  const cant = Number(cantidad);
  if (!Number.isFinite(cant) || cant <= 0) {
    return { error: 'INV_CANTIDAD_INVALIDA', mensaje: 'La cantidad debe ser un número mayor a cero.' };
  }
  if (!Number.isInteger(Number(productoId)) || !Number.isInteger(Number(almacenId))) {
    return { error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'Producto o almacén no válido.' };
  }
  let costo = null;
  if (costoUnitario !== null && costoUnitario !== undefined && costoUnitario !== '') {
    costo = Number(costoUnitario);
    if (!Number.isFinite(costo) || costo < 0) {
      return { error: 'INV_CANTIDAD_INVALIDA', mensaje: 'El costo unitario debe ser un número mayor o igual a cero.' };
    }
  }

  const motivoLimpio = motivo ? sanitizeText(motivo, 255) : null;
  const notasLimpias = notas ? sanitizeTextoLibre(notas, 2000) : null;
  const ubicacionLimpia = ubicacionNota ? sanitizeText(ubicacionNota, 255) : null;
  const documentoLimpio = documentoOrigen ? sanitizeText(documentoOrigen, 50) : null;
  const usuarioLimpio = usuario ? sanitizeText(usuario, 100) : null;

  const esEntrada = TIPOS_ENTRADA.includes(tipo);
  const pool = obtenerPool();
  const conexion = await pool.getConnection();
  let placeholderIdempotenciaInsertado = false;

  try {
    await conexion.beginTransaction();
    // Ante contención extrema, responde en vez de colgar la petición
    // (§0.5.B) — vale solo para esta sesión/conexión.
    await conexion.query('SET SESSION innodb_lock_wait_timeout = 5');

    if (idempotencyKey) {
      try {
        await conexion.query(
          'INSERT INTO inv_idempotencia (idempotency_key, respuesta_json, creado_en) VALUES (?, NULL, ?)',
          [idempotencyKey, new Date()]
        );
        placeholderIdempotenciaInsertado = true;
      } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
          await conexion.rollback();
          conexion.release();
          const [previo] = await pool.query(
            'SELECT respuesta_json FROM inv_idempotencia WHERE idempotency_key = ? LIMIT 1',
            [idempotencyKey]
          );
          if (previo.length > 0 && previo[0].respuesta_json) {
            return typeof previo[0].respuesta_json === 'string'
              ? JSON.parse(previo[0].respuesta_json)
              : previo[0].respuesta_json;
          }
          // La otra petición con la misma clave todavía está en vuelo —
          // nunca se duplica el movimiento, se pide reintentar.
          return { error: 'INV_CONCURRENCIA', mensaje: 'Esta operación ya se está procesando, intenta de nuevo en unos segundos.' };
        }
        throw err;
      }
    }

    const [productos] = await conexion.query(
      "SELECT id, tipo AS tipo_producto, costo_promedio FROM productos WHERE id = ? AND eliminado_en IS NULL FOR UPDATE",
      [productoId]
    );
    if (productos.length === 0) {
      await conexion.rollback();
      return { error: 'INV_PRODUCTO_NO_ENCONTRADO', mensaje: 'El producto no existe o fue eliminado.' };
    }
    const producto = productos[0];
    if (producto.tipo_producto === 'servicio') {
      await conexion.rollback();
      return { error: 'INV_PRODUCTO_SERVICIO', mensaje: 'Un servicio no genera movimientos de inventario (D11).' };
    }

    // Asegura que exista la fila de existencia antes de bloquearla — un
    // producto recién creado no tiene existencia todavía en ALM-1.
    await conexion.query(
      `INSERT IGNORE INTO existencias (producto_id, almacen_id, disponible, actualizado_en)
       VALUES (?, ?, 0, ?)`,
      [productoId, almacenId, new Date()]
    );

    const [existenciasFilas] = await conexion.query(
      `SELECT disponible FROM existencias
        WHERE producto_id = ? AND almacen_id = ? AND eliminado_en IS NULL
        FOR UPDATE`,
      [productoId, almacenId]
    );
    if (existenciasFilas.length === 0) {
      await conexion.rollback();
      return { error: 'INV_ALMACEN_NO_ENCONTRADO', mensaje: 'No existe existencia para ese almacén.' };
    }
    const existenciaAnterior = Number(existenciasFilas[0].disponible);

    let existenciaPosterior;
    if (esEntrada) {
      existenciaPosterior = existenciaAnterior + cant;
    } else {
      existenciaPosterior = existenciaAnterior - cant;
      if (existenciaPosterior < 0) {
        // eslint-disable-next-line no-await-in-loop
        const permiteNegativo = await negativoPermitido();
        if (!permiteNegativo) {
          await conexion.rollback();
          return {
            error: 'INV_STOCK_INSUFICIENTE',
            mensaje: `Existencia insuficiente: disponible ${existenciaAnterior}, solicitado ${cant}.`,
            disponible: existenciaAnterior,
          };
        }
      }
    }

    // D5/§0.5.C: recalcular costo_promedio SOLO en entradas con costo
    // informado. La fila de `productos` ya está bloqueada arriba — evita
    // el lost update entre dos entradas simultáneas del mismo producto.
    let costoPromedioResultante = Number(producto.costo_promedio || 0);
    if (esEntrada && costo !== null) {
      const totalAnterior = costoPromedioResultante * existenciaAnterior;
      const totalEntrada = costo * cant;
      const existenciaTotalNueva = existenciaAnterior + cant;
      costoPromedioResultante = existenciaTotalNueva > 0
        ? Math.round(((totalAnterior + totalEntrada) / existenciaTotalNueva) * 100) / 100
        : costo;
      await conexion.query(
        'UPDATE productos SET costo_promedio = ?, ultimo_costo = ?, actualizado_en = ? WHERE id = ?',
        [costoPromedioResultante, costo, new Date(), productoId]
      );
    }

    const ahora = new Date();
    const [insercion] = await conexion.query(
      `INSERT INTO movimientos_inventario
        (folio, producto_id, almacen_id, tipo, cantidad, costo_unitario,
         existencia_anterior, existencia_posterior, motivo, notas,
         ubicacion_nota, documento_origen, usuario, creado_en)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productoId, almacenId, tipo, cant, costo,
        existenciaAnterior, existenciaPosterior, motivoLimpio, notasLimpias,
        ubicacionLimpia, documentoLimpio, usuarioLimpio, ahora,
      ]
    );
    const movimientoId = insercion.insertId;
    const folio = generarFolioMovimiento(tipo, movimientoId);
    await conexion.query('UPDATE movimientos_inventario SET folio = ? WHERE id = ?', [folio, movimientoId]);

    await conexion.query(
      'UPDATE existencias SET disponible = ?, actualizado_en = ? WHERE producto_id = ? AND almacen_id = ?',
      [existenciaPosterior, ahora, productoId, almacenId]
    );

    const respuesta = {
      movimientoId,
      folio,
      tipo,
      productoId,
      almacenId,
      cantidad: cant,
      existenciaAnterior,
      existenciaPosterior,
      costoPromedio: costoPromedioResultante,
    };

    if (idempotencyKey && placeholderIdempotenciaInsertado) {
      await conexion.query(
        'UPDATE inv_idempotencia SET respuesta_json = ? WHERE idempotency_key = ?',
        [JSON.stringify(respuesta), idempotencyKey]
      );
    }

    await conexion.commit();
    return respuesta;
  } catch (err) {
    try {
      await conexion.rollback();
    } catch (_) {
      // La transacción ya pudo haberse cerrado por el propio error — un
      // rollback fallido aquí no debe enmascarar el error real.
    }
    if (err && (err.code === 'ER_LOCK_WAIT_TIMEOUT' || err.errno === 1205)) {
      return { error: 'INV_CONCURRENCIA', mensaje: 'El producto está siendo modificado por otra operación, intenta de nuevo.' };
    }
    throw err;
  } finally {
    conexion.release();
  }
}

// §0.5.F — recomputa cada saldo desde el libro append-only y reporta
// divergencias contra el saldo cacheado en `existencias`. Nunca corrige
// nada por sí solo (regla: una divergencia se corrige ÚNICAMENTE con un
// movimiento compensatorio `AJU-` generado por el administrador).
async function conciliarInventario() {
  const pool = obtenerPool();
  const [existenciasFilas] = await pool.query(
    'SELECT producto_id, almacen_id, disponible FROM existencias WHERE eliminado_en IS NULL'
  );
  const divergencias = [];
  for (const fila of existenciasFilas) {
    // eslint-disable-next-line no-await-in-loop
    const [[suma]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN tipo IN (?) THEN cantidad ELSE -cantidad END), 0) AS saldo
         FROM movimientos_inventario
        WHERE producto_id = ? AND almacen_id = ?`,
      [TIPOS_ENTRADA, fila.producto_id, fila.almacen_id]
    );
    const saldoRecalculado = Number(suma.saldo);
    const saldoCacheado = Number(fila.disponible);
    // Tolerancia mínima de redondeo decimal, no un umbral de negocio.
    if (Math.abs(saldoRecalculado - saldoCacheado) > 0.0005) {
      divergencias.push({
        productoId: fila.producto_id,
        almacenId: fila.almacen_id,
        saldoCacheado,
        saldoRecalculado,
      });
    }
  }
  return divergencias;
}

// Purga idempotency keys vencidas (TTL 24h, §0.5.E). Pensada para
// engancharse al mismo job de limpieza automática por hora que ya usa
// ticketsCleanup.js (segmento 2, cuando existan rutas HTTP que generen
// tráfico real de idempotencia) — expuesta ya desde este segmento para
// no depender de un cambio posterior a este archivo.
async function purgarIdempotenciaVencida() {
  const pool = obtenerPool();
  const [resultado] = await pool.query(
    'DELETE FROM inv_idempotencia WHERE creado_en < (NOW() - INTERVAL 24 HOUR)'
  );
  return resultado.affectedRows || 0;
}

// Genera un slug estable [a-z0-9_] a partir del nombre capturado — MISMA
// lógica que generarSlugCategoria() de gastos.js, sin duplicar el require
// porque ese archivo no exporta la función de forma reutilizable fuera de
// su propio dominio (categorías de Gastos y de Inventarios son conceptos
// separados, con sus propias tablas, aunque el slugging sea idéntico).
function generarSlugCategoriaInventario(nombre) {
  const base = String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return base || 'categoria';
}

async function listarCategoriasInventario() {
  const [filas] = await obtenerPool().query(`
    SELECT c.id, c.slug, c.nombre, c.activa,
      EXISTS(SELECT 1 FROM productos p WHERE p.categoria_id = c.id AND p.eliminado_en IS NULL) AS tiene_productos
    FROM categorias_inventario c
    ORDER BY c.orden ASC, c.nombre ASC
  `);
  return filas.map((f) => ({
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    activa: Boolean(f.activa),
    tieneProductos: Boolean(f.tiene_productos),
  }));
}

async function categoriaInventarioExisteId(id) {
  if (!Number.isInteger(Number(id))) return false;
  const [filas] = await obtenerPool().query('SELECT id FROM categorias_inventario WHERE id = ? LIMIT 1', [id]);
  return filas.length > 0;
}

async function crearCategoriaInventario(nombreCrudo) {
  const nombre = sanitizeText(nombreCrudo, 100);
  if (!nombre) {
    return { error: 'El nombre de la categoría es obligatorio.' };
  }
  let slug = generarSlugCategoriaInventario(nombre);
  const pool = obtenerPool();
  let sufijo = 2;
  // eslint-disable-next-line no-await-in-loop
  while ((await pool.query('SELECT id FROM categorias_inventario WHERE slug = ? LIMIT 1', [slug]))[0].length > 0) {
    slug = `${generarSlugCategoriaInventario(nombre).slice(0, 56)}_${sufijo}`;
    sufijo += 1;
  }
  const ahora = new Date();
  const [resultado] = await pool.query(
    `INSERT INTO categorias_inventario (slug, nombre, activa, orden, creado_en, actualizado_en)
     VALUES (?, ?, 1, 999, ?, ?)`,
    [slug, nombre, ahora, ahora]
  );
  return { id: resultado.insertId, slug, nombre };
}

async function renombrarCategoriaInventario(id, nombreCrudo) {
  const nombre = sanitizeText(nombreCrudo, 100);
  if (!nombre) {
    return { error: 'El nombre de la categoría es obligatorio.' };
  }
  if (!(await categoriaInventarioExisteId(id))) {
    return { error: 'Categoría no encontrada.', status: 404 };
  }
  await obtenerPool().query('UPDATE categorias_inventario SET nombre = ?, actualizado_en = ? WHERE id = ?', [
    nombre,
    new Date(),
    id,
  ]);
  return { id, nombre };
}

// Con productos asociados: solo se desactiva (deja de ofrecerse para
// altas nuevas). Sin productos: se borra de verdad.
async function eliminarCategoriaInventario(id) {
  const pool = obtenerPool();
  const [filas] = await pool.query(
    `SELECT c.id,
       EXISTS(SELECT 1 FROM productos p WHERE p.categoria_id = c.id AND p.eliminado_en IS NULL) AS tiene_productos
     FROM categorias_inventario c WHERE c.id = ? LIMIT 1`,
    [id]
  );
  if (filas.length === 0) {
    return { error: 'Categoría no encontrada.', status: 404 };
  }
  if (filas[0].tiene_productos) {
    await pool.query('UPDATE categorias_inventario SET activa = 0, actualizado_en = ? WHERE id = ?', [new Date(), id]);
    return { desactivada: true };
  }
  await pool.query('DELETE FROM categorias_inventario WHERE id = ?', [id]);
  return { eliminada: true };
}

async function reactivarCategoriaInventario(id) {
  if (!(await categoriaInventarioExisteId(id))) {
    return { error: 'Categoría no encontrada.', status: 404 };
  }
  await obtenerPool().query('UPDATE categorias_inventario SET activa = 1, actualizado_en = ? WHERE id = ?', [new Date(), id]);
  return { reactivada: true };
}

// ---------------------------------------------------------------------
// Productos — helpers puros de datos usados por las rutas de server.js
// (validación de negocio + INSERT/UPDATE quedan en server.js, mismo
// patrón que validarCuerpoGasto()).
// ---------------------------------------------------------------------

async function obtenerProductoPorId(id) {
  if (!Number.isInteger(Number(id))) return null;
  const [filas] = await obtenerPool().query('SELECT * FROM productos WHERE id = ? AND eliminado_en IS NULL LIMIT 1', [id]);
  return filas[0] || null;
}

async function skuEnUso(sku, excluirId = null) {
  const pool = obtenerPool();
  const params = excluirId ? [sku, excluirId] : [sku];
  const [filas] = await pool.query(
    `SELECT id FROM productos WHERE sku = ?${excluirId ? ' AND id != ?' : ''} LIMIT 1`,
    params
  );
  return filas.length > 0;
}

async function codigoBarrasEnUso(codigoBarras, excluirId = null) {
  if (!codigoBarras) return false;
  const pool = obtenerPool();
  const params = excluirId ? [codigoBarras, excluirId] : [codigoBarras];
  const [filas] = await pool.query(
    `SELECT id FROM productos WHERE codigo_barras = ?${excluirId ? ' AND id != ?' : ''} LIMIT 1`,
    params
  );
  return filas.length > 0;
}

async function unidadExisteId(id) {
  if (!Number.isInteger(Number(id))) return false;
  const [filas] = await obtenerPool().query('SELECT id FROM unidades_medida WHERE id = ? LIMIT 1', [id]);
  return filas.length > 0;
}

// §38: un producto con movimientos históricos no debe eliminarse
// físicamente — se conserva en papelera para siempre. Solo un producto
// SIN ningún movimiento puede borrarse de verdad.
async function productoTieneMovimientos(id) {
  const [filas] = await obtenerPool().query('SELECT id FROM movimientos_inventario WHERE producto_id = ? LIMIT 1', [id]);
  return filas.length > 0;
}

module.exports = {
  UNIDADES_SEED,
  UNIDAD_BASE_DEFECTO,
  ALMACEN_DEFECTO_CODIGO,
  ALMACEN_DEFECTO_NOMBRE,
  TIPOS_ENTRADA,
  TIPOS_SALIDA,
  TIPOS_VALIDOS,
  prefijoParaTipo,
  generarFolioMovimiento,
  registrarMovimiento,
  conciliarInventario,
  purgarIdempotenciaVencida,
  generarSlugCategoriaInventario,
  listarCategoriasInventario,
  categoriaInventarioExisteId,
  crearCategoriaInventario,
  renombrarCategoriaInventario,
  eliminarCategoriaInventario,
  reactivarCategoriaInventario,
  obtenerProductoPorId,
  skuEnUso,
  codigoBarrasEnUso,
  unidadExisteId,
  productoTieneMovimientos,
};
