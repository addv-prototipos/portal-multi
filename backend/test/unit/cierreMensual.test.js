const { pool, ejecutarComoTenant, obtenerPoolControl, obtenerPoolTenant } = require('../../db');
const { getConfiguracionGlobal } = require('../../utils/config');
const { generarYEnviarReporte } = require('../../utils/reportes');
const {
  ejecutarCierreMensualParaDB,
  ejecutarCierresMensualesParaTodos,
  periodoMesAnterior,
  fechaLocal,
  esDia1EnZona,
  ordenAItemArchivado,
} = require('../../utils/cierreMensual');

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
  // OJO: `ejecutarComoTenant` recibe un POOL real (objeto), nunca el slug
  // — pasar el slug crudo fue exactamente el bug que esta suite atrapa
  // (ver el assert de "se llama con el pool de obtenerPoolTenant" abajo).
  ejecutarComoTenant: jest.fn((tenantPool, fn) => fn()),
  obtenerPoolControl: jest.fn(),
  obtenerPoolTenant: jest.fn((cfg) => ({ __poolTenantMock: cfg.slug })),
}));

jest.mock('../../utils/config', () => ({
  getConfiguracionGlobal: jest.fn(),
}));

jest.mock('../../utils/reportes', () => ({
  generarYEnviarReporte: jest.fn(),
}));

const ordenBase = {
  id: 1,
  numero_compra: 'OC-000001',
  email: 'cliente@test.com',
  concepto: 'Venta de prueba',
  total: 500,
  fecha_compra: '2026-08-15 10:00:00',
};

const gastoBase = {
  id: 7,
  proveedor: 'Proveedor X',
  concepto: 'Papelería',
  monto: 120,
  categoria: 'oficina',
  fecha: '2026-08-10',
};

describe('cierreMensual — cálculo de fechas por zona horaria (punto 158)', () => {
  test('esDia1EnZona: 2026-09-01 07:30 UTC es día 1 en America/Mexico_City (UTC-6, sin DST)', () => {
    expect(esDia1EnZona('America/Mexico_City', new Date('2026-09-01T07:30:00Z'))).toBe(true);
  });

  test('esDia1EnZona: 2026-08-31 23:30 UTC todavía es 31 en America/Mexico_City', () => {
    expect(esDia1EnZona('America/Mexico_City', new Date('2026-08-31T23:30:00Z'))).toBe(false);
  });

  test('esDia1EnZona depende de la zona: mismo instante, distinta zona da distinto resultado', () => {
    // 2026-09-01T06:30:00Z: Mexico_City (UTC-6) => 00:30 día 1; Tijuana (UTC-7, PDT) => 23:30 día 31.
    const instante = new Date('2026-09-01T06:30:00Z');
    expect(esDia1EnZona('America/Mexico_City', instante)).toBe(true);
    expect(esDia1EnZona('America/Tijuana', instante)).toBe(false);
  });

  test('periodoMesAnterior: calcula el mes calendario anterior en la zona dada', () => {
    expect(periodoMesAnterior('America/Mexico_City', new Date('2026-09-01T08:00:00Z'))).toBe('2026-08');
  });

  test('periodoMesAnterior: cruza año correctamente (enero -> diciembre del año previo)', () => {
    expect(periodoMesAnterior('America/Mexico_City', new Date('2026-01-01T08:00:00Z'))).toBe('2025-12');
  });

  test('fechaLocal: separa año/mes/día sin depender de la hora UTC', () => {
    expect(fechaLocal('America/Mexico_City', new Date('2026-08-31T23:30:00Z'))).toEqual({ anio: 2026, mes: 8, dia: 31 });
  });
});

describe('cierreMensual — ejecutarCierreMensualParaDB (punto 158)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('fuera de la ventana (no es día 1 en la zona de esta DB): no consulta nada más', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T23:30:00Z'));
    getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City' });

    const resultado = await ejecutarCierreMensualParaDB();

    expect(resultado.fueraDeVentana).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('periodoForzado se salta el gate de día 1 (disparo manual/admin)', async () => {
    getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City' });
    pool.query.mockResolvedValueOnce([[{ valor: 'otro-periodo' }]]); // getUltimoCierre
    pool.query.mockResolvedValueOnce([[]]); // ventas
    pool.query.mockResolvedValueOnce([[]]); // gastos
    pool.query.mockResolvedValueOnce([{}]); // setUltimoCierre (nada que archivar)

    const resultado = await ejecutarCierreMensualParaDB('2026-08');

    expect(resultado.fueraDeVentana).toBeUndefined();
    expect(resultado.periodo).toBe('2026-08');
  });

  test('periodo ya cerrado (guard ultimo_cierre_mensual): no reconsulta ventas/gastos', async () => {
    getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City' });
    pool.query.mockResolvedValueOnce([[{ valor: '2026-08' }]]); // getUltimoCierre === periodo forzado

    const resultado = await ejecutarCierreMensualParaDB('2026-08');

    expect(resultado.yaEjecutado).toBe(true);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(generarYEnviarReporte).not.toHaveBeenCalled();
  });

  test('nada que archivar: marca el periodo como cerrado sin generar reporte', async () => {
    getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City' });
    pool.query.mockResolvedValueOnce([[]]); // getUltimoCierre: sin registro previo
    pool.query.mockResolvedValueOnce([[]]); // ventas vacío
    pool.query.mockResolvedValueOnce([[]]); // gastos vacío
    pool.query.mockResolvedValueOnce([{}]); // setUltimoCierre

    const resultado = await ejecutarCierreMensualParaDB('2026-08');

    expect(resultado.nadaQueArchivar).toBe(true);
    expect(generarYEnviarReporte).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test('archiva ventas y gastos del periodo tras generar el reporte, y marca el cierre', async () => {
    getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City' });
    pool.query.mockResolvedValueOnce([[]]); // getUltimoCierre
    pool.query.mockResolvedValueOnce([[ordenBase]]); // ventas
    pool.query.mockResolvedValueOnce([[gastoBase]]); // gastos
    generarYEnviarReporte.mockResolvedValue({ reporteId: 42, correoEnviado: true, errorCorreo: null });
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE ordenes_compra
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE gastos
    pool.query.mockResolvedValueOnce([{}]); // setUltimoCierre

    const resultado = await ejecutarCierreMensualParaDB('2026-08');

    expect(generarYEnviarReporte).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'cierre_mensual',
        items: expect.arrayContaining([
          expect.objectContaining({ tipo_registro: 'orden_compra', accion: 'archivado', identificador: 'OC-000001' }),
          expect.objectContaining({ tipo_registro: 'gasto', accion: 'archivado', identificador: 'G-000007' }),
        ]),
      })
    );
    expect(resultado.archivadasVentas).toBe(1);
    expect(resultado.archivadosGastos).toBe(1);
    expect(resultado.reporteId).toBe(42);

    const updateOrdenes = pool.query.mock.calls.find((c) => c[0].includes('UPDATE ordenes_compra'));
    expect(updateOrdenes[1]).toEqual(expect.arrayContaining(['2026-08', [1]]));
    const updateGastos = pool.query.mock.calls.find((c) => c[0].includes('UPDATE gastos'));
    expect(updateGastos[1]).toEqual(expect.arrayContaining(['2026-08', [7]]));
  });

  test('si generarYEnviarReporte falla, NO archiva nada (sin snapshot no se archiva)', async () => {
    getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City' });
    pool.query.mockResolvedValueOnce([[]]); // getUltimoCierre
    pool.query.mockResolvedValueOnce([[ordenBase]]); // ventas
    pool.query.mockResolvedValueOnce([[]]); // gastos
    generarYEnviarReporte.mockRejectedValue(new Error('SMTP caído'));

    await expect(ejecutarCierreMensualParaDB('2026-08')).rejects.toThrow('SMTP caído');

    const huboUpdate = pool.query.mock.calls.some((c) => c[0].includes('UPDATE') || c[0].includes('INSERT INTO configuracion'));
    expect(huboUpdate).toBe(false);
  });
});

describe('cierreMensual — ejecutarCierresMensualesParaTodos (dual base + tenants)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getConfiguracionGlobal.mockResolvedValue({ zona_horaria: 'America/Mexico_City' });
  });

  test('corre la base ADDV primero (sin ejecutarComoTenant) y luego cada tenant activo', async () => {
    pool.query
      .mockResolvedValueOnce([[{ valor: '2026-08' }]]) // base: getUltimoCierre = ya cerrado
      .mockResolvedValueOnce([[{ valor: '2026-08' }]]) // tenant a: ya cerrado
      .mockResolvedValueOnce([[{ valor: '2026-08' }]]); // tenant b: ya cerrado

    const filasTenants = [
      { slug: 'a', db_host: 'host-a', db_name: 'tenant_a', db_user: 'user_a' },
      { slug: 'b', db_host: 'host-b', db_name: 'tenant_b', db_user: 'user_b' },
    ];
    const poolControlMock = { query: jest.fn().mockResolvedValue([filasTenants]) };
    obtenerPoolControl.mockReturnValue(poolControlMock);

    const resultados = await ejecutarCierresMensualesParaTodos('2026-08');

    expect(resultados).toHaveLength(3);
    expect(resultados[0]).toEqual(expect.objectContaining({ slug: null, base: true, yaEjecutado: true }));
    expect(resultados[1]).toEqual(expect.objectContaining({ slug: 'a', yaEjecutado: true }));
    expect(resultados[2]).toEqual(expect.objectContaining({ slug: 'b', yaEjecutado: true }));
    // Regresión del bug real (Docker/MySQL real, punto 158): ejecutarComoTenant
    // DEBE recibir el objeto pool de obtenerPoolTenant(), nunca el slug crudo
    // — pasar el slug dejaba `pool.query` apuntando a un string y reventaba
    // con "pool.query is not a function" solo contra MySQL real.
    expect(obtenerPoolTenant).toHaveBeenCalledWith(expect.objectContaining({ slug: 'a', host: 'host-a', database: 'tenant_a', user: 'user_a' }));
    expect(obtenerPoolTenant).toHaveBeenCalledWith(expect.objectContaining({ slug: 'b', host: 'host-b', database: 'tenant_b', user: 'user_b' }));
    expect(ejecutarComoTenant).toHaveBeenCalledWith({ __poolTenantMock: 'a' }, expect.any(Function));
    expect(ejecutarComoTenant).toHaveBeenCalledWith({ __poolTenantMock: 'b' }, expect.any(Function));
  });

  test('un tenant que falla no detiene a los demás', async () => {
    pool.query
      .mockResolvedValueOnce([[{ valor: '2026-08' }]]) // base ok
      .mockRejectedValueOnce(new Error('DB del tenant caída')) // tenant roto: getUltimoCierre falla
      .mockResolvedValueOnce([[{ valor: '2026-08' }]]); // tenant sano

    const poolControlMock = {
      query: jest.fn().mockResolvedValue([[
        { slug: 'roto', db_host: 'h', db_name: 'd1', db_user: 'u' },
        { slug: 'sano', db_host: 'h', db_name: 'd2', db_user: 'u' },
      ]]),
    };
    obtenerPoolControl.mockReturnValue(poolControlMock);

    const resultados = await ejecutarCierresMensualesParaTodos('2026-08');

    expect(resultados.find((r) => r.slug === 'roto')).toEqual(
      expect.objectContaining({ slug: 'roto', error: 'DB del tenant caída' })
    );
    expect(resultados.find((r) => r.slug === 'sano')).toEqual(
      expect.objectContaining({ slug: 'sano', yaEjecutado: true })
    );
  });

  test('si no se puede listar tenants de control, regresa solo el resultado de la base', async () => {
    pool.query.mockResolvedValueOnce([[{ valor: '2026-08' }]]); // base ok
    obtenerPoolControl.mockReturnValue({ query: jest.fn().mockRejectedValue(new Error('control caído')) });

    const resultados = await ejecutarCierresMensualesParaTodos('2026-08');

    expect(resultados).toHaveLength(1);
    expect(resultados[0].base).toBe(true);
  });
});

describe('ordenAItemArchivado — punto 320: propaga quién registró la venta', () => {
  test('venta con creado_por: lo copia a atendido_por', () => {
    const item = ordenAItemArchivado({ ...ordenBase, creado_por: 'Laura Méndez' });
    expect(item.atendido_por).toBe('Laura Méndez');
  });

  test('venta histórica sin creado_por (previa a este punto): atendido_por queda null, no undefined', () => {
    const item = ordenAItemArchivado({ ...ordenBase, creado_por: null });
    expect(item.atendido_por).toBeNull();
  });
});
