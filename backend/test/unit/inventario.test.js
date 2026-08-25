jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
}));

const { pool } = require('../../db');
const {
  TIPOS_ENTRADA,
  TIPOS_SALIDA,
  TIPOS_VALIDOS,
  UNIDADES_SEED,
  ALMACEN_DEFECTO_CODIGO,
  prefijoParaTipo,
  generarFolioMovimiento,
  registrarMovimiento,
} = require('../../utils/inventario');
const { validarValorConfig, CLAVES } = require('../../utils/inventarioConfig');

describe('utils/inventario — datos base', () => {
  test('4 tipos de entrada y 4 de salida (P4 cerrada 2026-08-24)', () => {
    expect(TIPOS_ENTRADA).toEqual(['compra', 'devolucion_cliente', 'inventario_inicial', 'ajuste_positivo']);
    expect(TIPOS_SALIDA).toEqual(['venta', 'consumo_interno', 'merma', 'ajuste_negativo']);
    expect(TIPOS_VALIDOS.length).toBe(8);
  });

  test('unidades sembradas cubren pieza, peso y volumen (D11) — al menos 16', () => {
    expect(UNIDADES_SEED.length).toBeGreaterThanOrEqual(16);
    const nombres = UNIDADES_SEED.map(([nombre]) => nombre);
    expect(nombres).toContain('Pieza');
    expect(nombres).toContain('Kilogramo');
    expect(nombres).toContain('Litro');
  });

  test('almacén único v1 usa el código ALM-1 (D2)', () => {
    expect(ALMACEN_DEFECTO_CODIGO).toBe('ALM-1');
  });
});

describe('prefijoParaTipo / generarFolioMovimiento', () => {
  test('entradas usan prefijo EN-', () => {
    TIPOS_ENTRADA.filter((t) => t !== 'ajuste_positivo').forEach((tipo) => {
      expect(prefijoParaTipo(tipo)).toBe('EN');
    });
  });

  test('salidas usan prefijo SA-', () => {
    TIPOS_SALIDA.filter((t) => t !== 'ajuste_negativo').forEach((tipo) => {
      expect(prefijoParaTipo(tipo)).toBe('SA');
    });
  });

  test('ajuste_positivo y ajuste_negativo comparten prefijo AJU- (§0.3 punto 8)', () => {
    expect(prefijoParaTipo('ajuste_positivo')).toBe('AJU');
    expect(prefijoParaTipo('ajuste_negativo')).toBe('AJU');
  });

  test('tipo desconocido no genera folio', () => {
    expect(prefijoParaTipo('transferencia')).toBeNull();
    expect(generarFolioMovimiento('transferencia', 1)).toBeNull();
  });

  test('folio usa el mismo padStart(6,"0") que OC-/TK-', () => {
    expect(generarFolioMovimiento('compra', 1)).toBe('EN-000001');
    expect(generarFolioMovimiento('venta', 42)).toBe('SA-000042');
    expect(generarFolioMovimiento('ajuste_negativo', 123456)).toBe('AJU-123456');
  });
});

describe('registrarMovimiento — validación de entrada (sin tocar la BD)', () => {
  test('rechaza un tipo no reconocido', async () => {
    const resultado = await registrarMovimiento({ productoId: 1, almacenId: 1, tipo: 'transferencia', cantidad: 1 });
    expect(resultado.error).toBe('INV_TIPO_INVALIDO');
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('rechaza cantidad cero o negativa', async () => {
    const cero = await registrarMovimiento({ productoId: 1, almacenId: 1, tipo: 'venta', cantidad: 0 });
    const negativa = await registrarMovimiento({ productoId: 1, almacenId: 1, tipo: 'venta', cantidad: -5 });
    expect(cero.error).toBe('INV_CANTIDAD_INVALIDA');
    expect(negativa.error).toBe('INV_CANTIDAD_INVALIDA');
  });

  test('rechaza cantidad no numérica', async () => {
    const resultado = await registrarMovimiento({ productoId: 1, almacenId: 1, tipo: 'venta', cantidad: 'diez' });
    expect(resultado.error).toBe('INV_CANTIDAD_INVALIDA');
  });

  test('rechaza costo unitario negativo', async () => {
    const resultado = await registrarMovimiento({ productoId: 1, almacenId: 1, tipo: 'compra', cantidad: 1, costoUnitario: -10 });
    expect(resultado.error).toBe('INV_CANTIDAD_INVALIDA');
  });

  test('rechaza productoId/almacenId no enteros', async () => {
    const resultado = await registrarMovimiento({ productoId: 'x', almacenId: 1, tipo: 'venta', cantidad: 1 });
    expect(resultado.error).toBe('INV_PRODUCTO_NO_ENCONTRADO');
  });
});

// Simula una conexión real (query/beginTransaction/commit/rollback/release)
// para verificar la SECUENCIA de la transacción del motor — el bloqueo de
// fila real (FOR UPDATE bajo concurrencia genuina) solo lo valida
// scripts/verificar-inventario.js contra MySQL real (ver inventarios.md
// §0.5, "un mock no puede probar locking real").
function crearConexionFalsa({ productoExiste = true, tipoProducto = 'producto', disponibleActual = 10, costoPromedioActual = 0 } = {}) {
  const llamadas = [];
  const conexion = {
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(),
    query: jest.fn(async (sql, params) => {
      llamadas.push({ sql, params });
      const s = sql.trim();
      if (s.startsWith('SET SESSION')) return [{}];
      if (s.startsWith('SELECT id, tipo AS tipo_producto')) {
        return productoExiste
          ? [[{ id: params[0], tipo_producto: tipoProducto, costo_promedio: costoPromedioActual }]]
          : [[]];
      }
      if (s.startsWith('INSERT IGNORE INTO existencias')) return [{}];
      if (s.startsWith('SELECT disponible FROM existencias')) return [[{ disponible: disponibleActual }]];
      if (s.startsWith('UPDATE productos SET costo_promedio')) return [{}];
      if (s.startsWith('INSERT INTO movimientos_inventario')) return [{ insertId: 55 }];
      if (s.startsWith('UPDATE movimientos_inventario SET folio')) return [{}];
      if (s.startsWith('UPDATE existencias SET disponible')) return [{}];
      return [[]];
    }),
  };
  return { conexion, llamadas };
}

describe('registrarMovimiento — camino feliz (transacción simulada)', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.getConnection.mockReset();
  });

  test('entrada exitosa: bloquea producto y existencia, inserta movimiento, actualiza folio y saldo, hace commit', async () => {
    const { conexion, llamadas } = crearConexionFalsa({ disponibleActual: 5, costoPromedioActual: 8 });
    pool.getConnection.mockResolvedValue(conexion);

    const resultado = await registrarMovimiento({
      productoId: 10,
      almacenId: 1,
      tipo: 'compra',
      cantidad: 5,
      costoUnitario: 10,
      usuario: 'admin',
    });

    expect(resultado.error).toBeUndefined();
    expect(resultado.folio).toBe('EN-000055');
    expect(resultado.existenciaAnterior).toBe(5);
    expect(resultado.existenciaPosterior).toBe(10);
    // Promedio ponderado: (8*5 + 10*5) / 10 = 9
    expect(resultado.costoPromedio).toBe(9);
    expect(conexion.commit).toHaveBeenCalledTimes(1);
    expect(conexion.rollback).not.toHaveBeenCalled();
    expect(conexion.release).toHaveBeenCalledTimes(1);

    const sqlEjecutados = llamadas.map((l) => l.sql.trim().split('\n')[0]);
    expect(sqlEjecutados.some((s) => s.startsWith('SELECT id, tipo AS tipo_producto'))).toBe(true);
    expect(sqlEjecutados.some((s) => s.includes('FOR UPDATE') || s.startsWith('SELECT disponible'))).toBe(true);
  });

  test('salida que deja el producto en servicio se rechaza sin llegar a existencias', async () => {
    const { conexion } = crearConexionFalsa({ tipoProducto: 'servicio' });
    pool.getConnection.mockResolvedValue(conexion);

    const resultado = await registrarMovimiento({ productoId: 10, almacenId: 1, tipo: 'venta', cantidad: 1 });

    expect(resultado.error).toBe('INV_PRODUCTO_SERVICIO');
    expect(conexion.rollback).toHaveBeenCalledTimes(1);
    expect(conexion.commit).not.toHaveBeenCalled();
  });

  test('producto inexistente hace rollback y responde INV_PRODUCTO_NO_ENCONTRADO', async () => {
    const { conexion } = crearConexionFalsa({ productoExiste: false });
    pool.getConnection.mockResolvedValue(conexion);

    const resultado = await registrarMovimiento({ productoId: 999, almacenId: 1, tipo: 'venta', cantidad: 1 });

    expect(resultado.error).toBe('INV_PRODUCTO_NO_ENCONTRADO');
    expect(conexion.rollback).toHaveBeenCalledTimes(1);
  });

  test('salida sin stock suficiente (permitir negativo apagado por defecto) se rechaza y hace rollback', async () => {
    const { conexion } = crearConexionFalsa({ disponibleActual: 2 });
    pool.getConnection.mockResolvedValue(conexion);
    // negativoPermitido() lee configuracion vía pool.query — sin filas => default '0'.
    pool.query.mockResolvedValue([[]]);

    const resultado = await registrarMovimiento({ productoId: 10, almacenId: 1, tipo: 'venta', cantidad: 5 });

    expect(resultado.error).toBe('INV_STOCK_INSUFICIENTE');
    expect(resultado.disponible).toBe(2);
    expect(conexion.rollback).toHaveBeenCalledTimes(1);
  });

  test('lock wait timeout real de MySQL se traduce a INV_CONCURRENCIA, nunca se propaga como excepción', async () => {
    const conexion = {
      beginTransaction: jest.fn(async () => {}),
      commit: jest.fn(async () => {}),
      rollback: jest.fn(async () => {}),
      release: jest.fn(),
      query: jest.fn(async (sql) => {
        if (sql.trim().startsWith('SET SESSION')) return [{}];
        const err = new Error('Lock wait timeout exceeded');
        err.code = 'ER_LOCK_WAIT_TIMEOUT';
        err.errno = 1205;
        throw err;
      }),
    };
    pool.getConnection.mockResolvedValue(conexion);

    const resultado = await registrarMovimiento({ productoId: 10, almacenId: 1, tipo: 'venta', cantidad: 1 });

    expect(resultado.error).toBe('INV_CONCURRENCIA');
    expect(conexion.release).toHaveBeenCalledTimes(1);
  });
});

describe('utils/inventarioConfig — validación', () => {
  test('inventario_activo solo acepta "0"/"1"', () => {
    expect(validarValorConfig('inventario_activo', '1')).toEqual({ valor: '1' });
    expect(validarValorConfig('inventario_activo', '0')).toEqual({ valor: '0' });
    expect(validarValorConfig('inventario_activo', 'si').error).toBeDefined();
  });

  test('inv_imagen_max_mb respeta el rango 1-20 (P3 cerrada: default 5)', () => {
    expect(CLAVES.inv_imagen_max_mb.default).toBe('5');
    expect(validarValorConfig('inv_imagen_max_mb', '5')).toEqual({ valor: '5' });
    expect(validarValorConfig('inv_imagen_max_mb', '0').error).toBeDefined();
    expect(validarValorConfig('inv_imagen_max_mb', '21').error).toBeDefined();
  });

  test('inv_imagen_cuota_mb default 500 (P3 cerrada)', () => {
    expect(CLAVES.inv_imagen_cuota_mb.default).toBe('500');
  });

  test('inv_imagen_max_por_producto default 20 (P3 cerrada)', () => {
    expect(CLAVES.inv_imagen_max_por_producto.default).toBe('20');
  });

  test('inv_permitir_negativo default "0", sin UI para cambiarla en v1 (D4)', () => {
    expect(CLAVES.inv_permitir_negativo.default).toBe('0');
  });

  test('clave no reconocida se rechaza', () => {
    expect(validarValorConfig('clave_inventada', '1').error).toBeDefined();
  });
});
