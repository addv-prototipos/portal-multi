#!/usr/bin/env node
/**
 * Prueba de regresión del motor de existencias de Inventarios contra una
 * base de datos MySQL real — mismo patrón que scripts/verificar-mysql.js,
 * pero enfocada en lo que un mock de Jest no puede validar de verdad:
 * bloqueo de fila real (`FOR UPDATE`) bajo concurrencia genuina.
 *
 *   docker compose exec backend node scripts/verificar-inventario.js
 *
 * También sirve como el "Verificar integridad" de §0.5.F de
 * inventarios.md: conciliarInventario() recomputa cada saldo desde el
 * libro de movimientos y reporta divergencias contra el saldo cacheado.
 *
 * Todos los datos que crea esta prueba (SKU con prefijo reconocible) se
 * limpian al final — segura de correr contra la base de datos real del
 * proyecto.
 */

const { pool, ensureSchema } = require('../db');
const {
  registrarMovimiento,
  conciliarInventario,
  purgarIdempotenciaVencida,
  generarFolioMovimiento,
  ALMACEN_DEFECTO_CODIGO,
} = require('../utils/inventario');

const PREFIJO_PRUEBA = '__prueba_inventario__';

let pruebasOk = 0;
let pruebasTotal = 0;

function log(ok, nombre, detalle) {
  pruebasTotal += 1;
  if (ok) pruebasOk += 1;
  const etiqueta = ok ? 'OK  ' : 'FALLA';
  console.log(`[${etiqueta}] ${nombre}${detalle ? ' -- ' + detalle : ''}`);
}

async function limpiarDatosDePrueba() {
  const [productos] = await pool.query('SELECT id FROM productos WHERE sku LIKE ?', [`${PREFIJO_PRUEBA}%`]);
  const ids = productos.map((p) => p.id);
  if (ids.length > 0) {
    await pool.query('DELETE FROM movimientos_inventario WHERE producto_id IN (?)', [ids]);
    await pool.query('DELETE FROM existencias WHERE producto_id IN (?)', [ids]);
    await pool.query('DELETE FROM productos WHERE id IN (?)', [ids]);
  }
  await pool.query('DELETE FROM inv_idempotencia WHERE idempotency_key LIKE ?', [`${PREFIJO_PRUEBA}%`]);
}

async function crearProductoPrueba(sufijo, unidadNombre = 'Pieza') {
  const [[unidad]] = await pool.query('SELECT id FROM unidades_medida WHERE nombre = ? LIMIT 1', [unidadNombre]);
  const [[almacen]] = await pool.query('SELECT id FROM almacenes WHERE codigo = ? LIMIT 1', [ALMACEN_DEFECTO_CODIGO]);
  const ahora = new Date();
  const [resultado] = await pool.query(
    `INSERT INTO productos (sku, nombre, unidad_id, tipo, costo_promedio, estado, creado_en, actualizado_en)
     VALUES (?, ?, ?, 'producto', 0, 'activo', ?, ?)`,
    [`${PREFIJO_PRUEBA}${sufijo}`, `Producto de prueba ${sufijo}`, unidad.id, ahora, ahora]
  );
  return { productoId: resultado.insertId, almacenId: almacen.id };
}

async function main() {
  console.log('Conectando a MySQL y preparando el esquema de Inventarios...\n');

  try {
    await ensureSchema();
    log(true, 'ensureSchema() corre sin errores (incluye Inventarios)');
  } catch (err) {
    log(false, 'ensureSchema() corre sin errores', err.message);
    console.log('\nNo se pudo continuar sin un esquema válido. Abortando.');
    process.exit(1);
  }

  try {
    await ensureSchema();
    log(true, 'ensureSchema() es idempotente (correr dos veces no falla)');
  } catch (err) {
    log(false, 'ensureSchema() es idempotente', err.message);
  }

  const [[almacenDefecto]] = await pool.query('SELECT id, nombre FROM almacenes WHERE codigo = ? LIMIT 1', [
    ALMACEN_DEFECTO_CODIGO,
  ]);
  log(Boolean(almacenDefecto), `Almacén ${ALMACEN_DEFECTO_CODIGO} auto-provisionado (D2)`, almacenDefecto && almacenDefecto.nombre);

  const [unidadesSembradas] = await pool.query('SELECT COUNT(*) AS total FROM unidades_medida');
  log(unidadesSembradas[0].total >= 16, 'Al menos 16 unidades de medida sembradas (§9)', `total=${unidadesSembradas[0].total}`);

  // ---------- Folio ----------
  log(generarFolioMovimiento('compra', 1) === 'EN-000001', 'Folio de entrada usa prefijo EN- con padStart(6,"0")');
  log(generarFolioMovimiento('venta', 1) === 'SA-000001', 'Folio de salida usa prefijo SA-');
  log(generarFolioMovimiento('ajuste_positivo', 7) === 'AJU-000007', 'Folio de ajuste usa prefijo AJU-');

  // ---------- D4: inventario negativo prohibido ----------
  try {
    const { productoId, almacenId } = await crearProductoPrueba('d4');
    const salida = await registrarMovimiento({
      productoId,
      almacenId,
      tipo: 'venta',
      cantidad: 5,
      documentoOrigen: 'OC-000001',
    });
    log(salida.error === 'INV_STOCK_INSUFICIENTE', 'D4: salida sin existencia se rechaza con INV_STOCK_INSUFICIENTE', JSON.stringify(salida));

    const entrada = await registrarMovimiento({ productoId, almacenId, tipo: 'inventario_inicial', cantidad: 3, costoUnitario: 10 });
    log(entrada.folio === 'EN-' + String(entrada.movimientoId).padStart(6, '0'), 'Entrada genera folio EN- correcto');

    const salidaExcesiva = await registrarMovimiento({ productoId, almacenId, tipo: 'venta', cantidad: 100 });
    log(salidaExcesiva.error === 'INV_STOCK_INSUFICIENTE' && salidaExcesiva.disponible === 3, 'D4: salida mayor al disponible se rechaza reportando la existencia real');
  } catch (err) {
    log(false, 'Bloque D4', err.message);
  }

  // ---------- Concurrencia: anti-sobrevende (§0.5.B) ----------
  try {
    const { productoId, almacenId } = await crearProductoPrueba('concurrencia-salida');
    await registrarMovimiento({ productoId, almacenId, tipo: 'inventario_inicial', cantidad: 10, costoUnitario: 5 });

    const N = 20;
    const resultados = await Promise.all(
      Array.from({ length: N }, () => registrarMovimiento({ productoId, almacenId, tipo: 'venta', cantidad: 1 }))
    );
    const exitosos = resultados.filter((r) => !r.error).length;
    const rechazadosPorStock = resultados.filter((r) => r.error === 'INV_STOCK_INSUFICIENTE').length;
    const contencionExtrema = resultados.filter((r) => r.error === 'INV_CONCURRENCIA').length;
    const otrosErrores = resultados.filter((r) => r.error && r.error !== 'INV_STOCK_INSUFICIENTE' && r.error !== 'INV_CONCURRENCIA');

    const [[existenciaFinal]] = await pool.query('SELECT disponible FROM existencias WHERE producto_id = ? AND almacen_id = ?', [
      productoId,
      almacenId,
    ]);

    // Invariante real de §0.5.B: NUNCA sobrevende (exitosos jamás supera
    // el stock inicial), el saldo final es exactamente 10 − exitosos
    // (aritmética exacta, sin drift), y todo resultado cae en una de las
    // 3 categorías documentadas — nunca cuelga, nunca lanza, nunca
    // corrompe. Bajo contención extrema real (N=20 peticiones contra
    // UNA fila, con el pool de conexiones y el lock_wait_timeout de ~5s
    // ambos deliberadamente angostos, §0.5.B) es esperado y correcto que
    // ALGUNAS peticiones reciban INV_CONCURRENCIA en vez de una decisión
    // de stock — no es una falla del motor, es la salida "reintentable"
    // documentada explícitamente para ese escenario.
    const saldoExacto = Number(existenciaFinal.disponible) === 10 - exitosos;
    const totalCuadra = exitosos + rechazadosPorStock + contencionExtrema === N;
    const nuncaSobrevende = exitosos <= 10;

    log(
      saldoExacto && totalCuadra && nuncaSobrevende && otrosErrores.length === 0,
      `Concurrencia (${N} ventas simultáneas sobre 10 unidades): cero sobreventa, saldo final exacto, todo resultado cae en OK/INV_STOCK_INSUFICIENTE/INV_CONCURRENCIA`,
      `exitosos=${exitosos} rechazadosPorStock=${rechazadosPorStock} contencionExtrema=${contencionExtrema} saldoFinal=${existenciaFinal.disponible}`
    );
  } catch (err) {
    log(false, 'Bloque de concurrencia anti-sobrevende', err.message);
  }

  // ---------- Concurrencia: costo_promedio sin lost update (§0.5.C) ----------
  try {
    const { productoId, almacenId } = await crearProductoPrueba('concurrencia-costo');
    // 10 entradas simultáneas de 1 unidad a $10 cada una: el promedio
    // ponderado final debe ser exactamente $10, sin importar el orden de
    // ejecución — si el lock de `productos` fallara, alguna actualización
    // se perdería y el promedio quedaría en un valor menor/mayor a $10 o
    // la existencia final sería menor a 10.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        registrarMovimiento({ productoId, almacenId, tipo: 'compra', cantidad: 1, costoUnitario: 10 })
      )
    );
    const [[productoFinal]] = await pool.query('SELECT costo_promedio FROM productos WHERE id = ?', [productoId]);
    const [[existenciaFinal]] = await pool.query('SELECT disponible FROM existencias WHERE producto_id = ? AND almacen_id = ?', [
      productoId,
      almacenId,
    ]);
    log(
      Number(productoFinal.costo_promedio) === 10 && Number(existenciaFinal.disponible) === 10,
      'Concurrencia (10 entradas simultáneas a $10): costo_promedio final = $10.00 exacto, existencia final = 10 (cero lost update)',
      `costo_promedio=${productoFinal.costo_promedio} disponible=${existenciaFinal.disponible}`
    );
  } catch (err) {
    log(false, 'Bloque de concurrencia costo_promedio', err.message);
  }

  // ---------- Idempotencia (§0.5.E) ----------
  try {
    const { productoId, almacenId } = await crearProductoPrueba('idempotencia');
    await registrarMovimiento({ productoId, almacenId, tipo: 'inventario_inicial', cantidad: 20, costoUnitario: 1 });

    const key = `${PREFIJO_PRUEBA}-key-1`;
    const primero = await registrarMovimiento({ productoId, almacenId, tipo: 'venta', cantidad: 5, idempotencyKey: key });
    const segundo = await registrarMovimiento({ productoId, almacenId, tipo: 'venta', cantidad: 5, idempotencyKey: key });

    log(
      !primero.error && segundo.movimientoId === primero.movimientoId && segundo.folio === primero.folio,
      'Idempotencia: reenviar la misma Idempotency-Key devuelve la MISMA respuesta sin duplicar el movimiento'
    );

    const [[conteoMovimientos]] = await pool.query('SELECT COUNT(*) AS total FROM movimientos_inventario WHERE producto_id = ?', [productoId]);
    log(Number(conteoMovimientos.total) === 2, 'Idempotencia: solo 2 movimientos reales (el inicial + UNA venta, no dos)', `total=${conteoMovimientos.total}`);

    // Reintentos concurrentes con la MISMA key: ninguno debe duplicar.
    const key2 = `${PREFIJO_PRUEBA}-key-2`;
    const concurrentes = await Promise.all(
      Array.from({ length: 5 }, () => registrarMovimiento({ productoId, almacenId, tipo: 'venta', cantidad: 1, idempotencyKey: key2 }))
    );
    const idsUnicos = new Set(concurrentes.filter((r) => !r.error).map((r) => r.movimientoId));
    log(idsUnicos.size <= 1, 'Idempotencia bajo concurrencia real: nunca se genera más de un movimiento para la misma clave', `movimientosDistintos=${idsUnicos.size}`);

    const purgados = await purgarIdempotenciaVencida();
    log(typeof purgados === 'number', 'purgarIdempotenciaVencida() corre sin errores', `purgados=${purgados}`);
  } catch (err) {
    log(false, 'Bloque de idempotencia', err.message);
  }

  // ---------- Conciliación (§0.5.F) ----------
  try {
    const { productoId, almacenId } = await crearProductoPrueba('conciliacion');
    await registrarMovimiento({ productoId, almacenId, tipo: 'inventario_inicial', cantidad: 8, costoUnitario: 2 });

    const antesDeCorromper = await conciliarInventario();
    const divergenciaPrevia = antesDeCorromper.some((d) => d.productoId === productoId && d.almacenId === almacenId);
    log(!divergenciaPrevia, 'Conciliación: sin corromper nada, el producto de prueba no aparece como divergente');

    // Corrompe el saldo cacheado a mano (fuera de registrarMovimiento) —
    // exactamente lo que la regla D6/§48 prohíbe en producción, aquí a
    // propósito para confirmar que el verificador SÍ lo detecta.
    await pool.query('UPDATE existencias SET disponible = 999 WHERE producto_id = ? AND almacen_id = ?', [productoId, almacenId]);

    const despuesDeCorromper = await conciliarInventario();
    const divergencia = despuesDeCorromper.find((d) => d.productoId === productoId && d.almacenId === almacenId);
    log(
      Boolean(divergencia) && divergencia.saldoCacheado === 999 && divergencia.saldoRecalculado === 8,
      'Conciliación: un saldo corrompido a mano se detecta y reporta (cacheado vs. recalculado desde el kardex)',
      divergencia ? JSON.stringify(divergencia) : 'no detectado'
    );

    // Restaura antes de la limpieza final (no es estrictamente necesario
    // porque el producto se borra de todas formas, pero deja el estado
    // consistente si algo más lee esta fila entre medio).
    await pool.query('UPDATE existencias SET disponible = 8 WHERE producto_id = ? AND almacen_id = ?', [productoId, almacenId]);
  } catch (err) {
    log(false, 'Bloque de conciliación', err.message);
  }

  // ---------- D11: un servicio no genera movimientos ----------
  try {
    const [[unidad]] = await pool.query("SELECT id FROM unidades_medida WHERE nombre = 'Pieza' LIMIT 1");
    const [[almacen]] = await pool.query('SELECT id FROM almacenes WHERE codigo = ? LIMIT 1', [ALMACEN_DEFECTO_CODIGO]);
    const ahora = new Date();
    const [servicio] = await pool.query(
      `INSERT INTO productos (sku, nombre, unidad_id, tipo, estado, creado_en, actualizado_en)
       VALUES (?, 'Servicio de prueba', ?, 'servicio', 'activo', ?, ?)`,
      [`${PREFIJO_PRUEBA}servicio`, unidad.id, ahora, ahora]
    );
    const resultado = await registrarMovimiento({ productoId: servicio.insertId, almacenId: almacen.id, tipo: 'venta', cantidad: 1 });
    log(resultado.error === 'INV_PRODUCTO_SERVICIO', 'D11: un producto tipo "servicio" rechaza cualquier movimiento de inventario');
  } catch (err) {
    log(false, 'Bloque D11 (servicio)', err.message);
  }

  await limpiarDatosDePrueba();
  await pool.end();

  console.log('');
  console.log(`RESULTADO: ${pruebasOk}/${pruebasTotal} pruebas pasaron.`);
  process.exit(pruebasOk === pruebasTotal ? 0 : 1);
}

main().catch((err) => {
  console.error('\nError inesperado corriendo las pruebas:', err);
  process.exit(1);
});
