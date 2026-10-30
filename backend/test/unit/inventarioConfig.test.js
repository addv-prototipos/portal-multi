const { pool } = require('../../db');
const {
  CLAVES,
  obtenerConfigInventario,
  obtenerValorConfig,
  inventarioActivo,
  negativoPermitido,
  soloServiciosActivo,
  validarValorConfig,
  setValorConfig,
} = require('../../utils/inventarioConfig');

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
}));

describe('inventarioConfig.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('obtenerValorConfig', () => {
    test('retorna null si la clave no está en CLAVES', async () => {
      const resultado = await obtenerValorConfig('clave_inventada');
      expect(resultado).toBeNull();
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('sin fila guardada, el default de inventario_activo depende de si el plan lo incluye', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      expect(await obtenerValorConfig('inventario_activo')).toBe('1'); // planIncluyeInventarios default: true
      pool.query.mockResolvedValueOnce([[]]);
      expect(await obtenerValorConfig('inventario_activo', { planIncluyeInventarios: false })).toBe('0');
    });

    test('una fila ya guardada gana siempre sobre el default del plan', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '0' }]]);
      expect(await obtenerValorConfig('inventario_activo', { planIncluyeInventarios: true })).toBe('0');
    });

    test('retorna el valor guardado si existe', async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '1' }]]);
      const resultado = await obtenerValorConfig('inventario_activo');
      expect(resultado).toBe('1');
    });
  });

  describe('obtenerConfigInventario', () => {
    test('trae todas las claves del catálogo, una consulta por clave', async () => {
      pool.query.mockResolvedValue([[]]);
      const resultado = await obtenerConfigInventario();
      expect(Object.keys(resultado).sort()).toEqual(Object.keys(CLAVES).sort());
      expect(pool.query).toHaveBeenCalledTimes(Object.keys(CLAVES).length);
      expect(resultado.inventario_activo).toBe('1'); // sin fila guardada + plan lo incluye (default)
      expect(resultado.inv_imagen_max_mb).toBe('5');
    });

    test('con planIncluyeInventarios:false, inventario_activo cae a \'0\' sin fila guardada', async () => {
      pool.query.mockResolvedValue([[]]);
      const resultado = await obtenerConfigInventario({ planIncluyeInventarios: false });
      expect(resultado.inventario_activo).toBe('0');
    });
  });

  describe('inventarioActivo / negativoPermitido / soloServiciosActivo', () => {
    test("inventarioActivo es true solo cuando el valor guardado es '1'", async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '1' }]]);
      expect(await inventarioActivo()).toBe(true);
      pool.query.mockResolvedValueOnce([[{ valor: '0' }]]);
      expect(await inventarioActivo()).toBe(false);
    });

    test('inventarioActivo sin fila guardada: sigue el default según el plan', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      expect(await inventarioActivo()).toBe(true); // planIncluyeInventarios default: true
      pool.query.mockResolvedValueOnce([[]]);
      expect(await inventarioActivo({ planIncluyeInventarios: false })).toBe(false);
    });

    test("negativoPermitido es true solo cuando el valor guardado es '1'", async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '1' }]]);
      expect(await negativoPermitido()).toBe(true);
      pool.query.mockResolvedValueOnce([[]]);
      expect(await negativoPermitido()).toBe(false); // default '0'
    });

    test("soloServiciosActivo es true solo cuando el valor guardado es '1'", async () => {
      pool.query.mockResolvedValueOnce([[{ valor: '1' }]]);
      expect(await soloServiciosActivo()).toBe(true);
      pool.query.mockResolvedValueOnce([[{ valor: '0' }]]);
      expect(await soloServiciosActivo()).toBe(false);
    });
  });

  describe('validarValorConfig', () => {
    test('rechaza una clave no reconocida', () => {
      const resultado = validarValorConfig('clave_inventada', '1');
      expect(resultado.error).toMatch(/no reconocida/);
    });

    test('booleano01: acepta solo "0" o "1"', () => {
      expect(validarValorConfig('inventario_activo', '1')).toEqual({ valor: '1' });
      expect(validarValorConfig('inventario_activo', '0')).toEqual({ valor: '0' });
      expect(validarValorConfig('inventario_activo', '2').error).toMatch(/debe ser '0' o '1'/);
      expect(validarValorConfig('inventario_activo', 'true').error).toBeDefined();
    });

    test('entero: rechaza fuera de rango', () => {
      const resultado = validarValorConfig('inv_imagen_max_mb', '999');
      expect(resultado.error).toMatch(/entre 1 y 20/);
    });

    test('entero: rechaza no-entero (decimal, texto)', () => {
      expect(validarValorConfig('inv_imagen_max_mb', '3.5').error).toBeDefined();
      expect(validarValorConfig('inv_imagen_max_mb', 'abc').error).toBeDefined();
    });

    test('entero: acepta dentro de rango y normaliza a string', () => {
      const resultado = validarValorConfig('inv_imagen_max_mb', '10');
      expect(resultado).toEqual({ valor: '10' });
    });

    test('entero: acepta los límites min y max exactos', () => {
      expect(validarValorConfig('inv_import_max_mb', '1')).toEqual({ valor: '1' });
      expect(validarValorConfig('inv_import_max_mb', '50')).toEqual({ valor: '50' });
      expect(validarValorConfig('inv_import_max_mb', '0').error).toBeDefined();
      expect(validarValorConfig('inv_import_max_mb', '51').error).toBeDefined();
    });
  });

  describe('setValorConfig', () => {
    test('si la validación falla, no toca la BD y retorna el error', async () => {
      const resultado = await setValorConfig('inventario_activo', '9');
      expect(resultado.error).toBeDefined();
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('si la validación pasa, hace upsert y retorna clave/valor normalizados', async () => {
      pool.query.mockResolvedValueOnce([{}]);
      const resultado = await setValorConfig('inv_imagen_max_mb', '12');
      expect(resultado).toEqual({ clave: 'inv_imagen_max_mb', valor: '12' });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON DUPLICATE KEY UPDATE'),
        ['inv_imagen_max_mb', '12']
      );
    });
  });
});
