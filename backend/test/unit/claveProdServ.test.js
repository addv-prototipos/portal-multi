const { pool } = require('../../db');
const {
  CATALOGO_EJEMPLO,
  ORIGEN_EJEMPLO,
  sembrarCatalogoEjemploSiVacio,
  buscarClaveProdServ,
  contarClaveProdServ,
  getInfoCatalogoClaveProdServ,
  sincronizarDesdeOrigen,
} = require('../../utils/claveProdServ');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
}));

describe('claveProdServ.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
    delete process.env.CLAVE_PROD_SERV_SYNC_URL;
  });

  describe('sembrarCatalogoEjemploSiVacio', () => {
    test('no hace nada si la tabla ya tiene filas', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 5 }]]);
      await sembrarCatalogoEjemploSiVacio();
      expect(pool.query).toHaveBeenCalledTimes(1); // solo el COUNT
    });

    test('inserta el catálogo de ejemplo y guarda el origen si la tabla está vacía', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 0 }]]); // COUNT
      pool.query.mockResolvedValueOnce([{}]); // INSERT catálogo
      pool.query.mockResolvedValueOnce([{}]); // upsert origen
      await sembrarCatalogoEjemploSiVacio();
      expect(pool.query).toHaveBeenCalledTimes(3);
      expect(pool.query.mock.calls[1][0]).toMatch(/INSERT INTO catalogo_clave_prod_serv/);
      expect(pool.query.mock.calls[1][1][0]).toHaveLength(CATALOGO_EJEMPLO.length);
      expect(pool.query.mock.calls[2][1]).toEqual(['clave_prod_serv_origen', ORIGEN_EJEMPLO]);
    });
  });

  describe('buscarClaveProdServ', () => {
    test('sin término, no consulta la base y devuelve arreglo vacío', async () => {
      const resultado = await buscarClaveProdServ('');
      expect(resultado).toEqual([]);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('busca por coincidencia de clave o descripción, con comodines', async () => {
      const filas = [{ clave: '81112501', descripcion: 'Servicios de diseño gráfico' }];
      pool.query.mockResolvedValueOnce([filas]);
      const resultado = await buscarClaveProdServ('diseño');
      expect(resultado).toEqual(filas);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIKE'), ['%diseño%', '%diseño%']);
    });

    test('recorta espacios del término antes de buscar', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await buscarClaveProdServ('  cómputo  ');
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['%cómputo%', '%cómputo%']);
    });
  });

  describe('contarClaveProdServ', () => {
    test('devuelve el total de filas', async () => {
      pool.query.mockResolvedValueOnce([[{ total: 52486 }]]);
      expect(await contarClaveProdServ()).toBe(52486);
    });
  });

  describe('getInfoCatalogoClaveProdServ', () => {
    test('sin sincronización previa, marca esEjemplo:true con el origen por defecto', async () => {
      pool.query.mockResolvedValueOnce([[]]); // SELECT configuracion (vacío)
      pool.query.mockResolvedValueOnce([[{ total: 10 }]]); // COUNT
      const info = await getInfoCatalogoClaveProdServ();
      expect(info).toEqual({ total: 10, actualizadoEn: null, origen: ORIGEN_EJEMPLO, esEjemplo: true });
    });

    test('tras sincronizar desde una URL real, esEjemplo:false', async () => {
      pool.query.mockResolvedValueOnce([
        [
          { clave: 'clave_prod_serv_actualizado_en', valor: '2026-09-04T00:00:00.000Z' },
          { clave: 'clave_prod_serv_origen', valor: 'https://sat.example/catalogo-prodserv' },
        ],
      ]);
      pool.query.mockResolvedValueOnce([[{ total: 52486 }]]);
      const info = await getInfoCatalogoClaveProdServ();
      expect(info.esEjemplo).toBe(false);
      expect(info.origen).toBe('https://sat.example/catalogo-prodserv');
    });
  });

  describe('sincronizarDesdeOrigen', () => {
    test('lanza error claro si no hay URL configurada ni se pasa una', async () => {
      await expect(sincronizarDesdeOrigen()).rejects.toThrow(/CLAVE_PROD_SERV_SYNC_URL/);
      expect(global.fetch).toBeUndefined();
    });

    test('nunca acepta una URL sin verificar por variable de entorno vacía', async () => {
      process.env.CLAVE_PROD_SERV_SYNC_URL = '';
      await expect(sincronizarDesdeOrigen()).rejects.toThrow(/No hay un origen de sincronización configurado/);
    });

    test('lanza error si fetch no puede conectar', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network fail'));
      await expect(sincronizarDesdeOrigen('https://sat.example/catalogo')).rejects.toThrow(/No se pudo conectar/);
    });

    test('lanza error si la respuesta HTTP no es ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
      await expect(sincronizarDesdeOrigen('https://sat.example/catalogo')).rejects.toThrow(/error HTTP 500/);
    });

    test('lanza error si la respuesta no se pudo interpretar como catálogo', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => 'esto no es ni JSON ni CSV valido' });
      await expect(sincronizarDesdeOrigen('https://sat.example/catalogo')).rejects.toThrow(/no se pudo interpretar/);
    });

    test('sincroniza y guarda correctamente con una respuesta válida (borra y reinserta)', async () => {
      const catalogoRemoto = Array.from({ length: 5 }, (_, i) => ({ clave: `0000000${i}`, descripcion: `Producto ${i}` }));
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(catalogoRemoto) });

      const conexionMock = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
      };
      pool.getConnection.mockResolvedValue(conexionMock);

      const resultado = await sincronizarDesdeOrigen('https://sat.example/catalogo');

      expect(resultado).toEqual(catalogoRemoto);
      expect(conexionMock.beginTransaction).toHaveBeenCalled();
      expect(conexionMock.commit).toHaveBeenCalled();
      // DELETE + INSERT catálogo + upsert actualizado + upsert origen
      expect(conexionMock.query).toHaveBeenCalledTimes(4);
      expect(conexionMock.query.mock.calls[0][0]).toMatch(/DELETE FROM catalogo_clave_prod_serv/);
      expect(conexionMock.release).toHaveBeenCalled();
    });

    test('interpreta el alias de campo "c_ClaveProdServ" propio de este catálogo', async () => {
      const catalogoRemoto = [
        { c_ClaveProdServ: '81112501', descripcion: 'Servicios de diseño gráfico' },
        { c_ClaveProdServ: '43211500', descripcion: 'Computadoras' },
        { c_ClaveProdServ: '90101501', descripcion: 'Servicios de restaurante' },
        { c_ClaveProdServ: '84111500', descripcion: 'Servicios de contabilidad' },
        { c_ClaveProdServ: '80101500', descripcion: 'Servicios de consultoría' },
      ];
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(catalogoRemoto) });
      const conexionMock = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
      };
      pool.getConnection.mockResolvedValue(conexionMock);

      const resultado = await sincronizarDesdeOrigen('https://sat.example/catalogo');
      expect(resultado).toEqual([
        { clave: '81112501', descripcion: 'Servicios de diseño gráfico' },
        { clave: '43211500', descripcion: 'Computadoras' },
        { clave: '90101501', descripcion: 'Servicios de restaurante' },
        { clave: '84111500', descripcion: 'Servicios de contabilidad' },
        { clave: '80101500', descripcion: 'Servicios de consultoría' },
      ]);
    });

    test('interpreta un dump SQL de INSERTs (formato real de phpcfdi/resources-sat-catalogs)', async () => {
      const dumpSql =
        "PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n" +
        "INSERT INTO cfdi_40_productos_servicios VALUES('01010101','No existe en el catálogo','','','','2022-01-01','','','Público en general');\n" +
        "INSERT INTO cfdi_40_productos_servicios VALUES('43211508','Computadores personales','','','','2022-01-01','',1,'');\n" +
        "INSERT INTO cfdi_40_productos_servicios VALUES('50321567','Manzana pomme d''api seca','','','','2022-01-01','',1,'');\n" +
        "INSERT INTO cfdi_40_productos_servicios VALUES('84111500','Servicios de contabilidad','','','','2022-01-01','',1,'');\n" +
        "INSERT INTO cfdi_40_productos_servicios VALUES('90101501','Servicios de restaurante','','','','2022-01-01','',1,'');\n" +
        'COMMIT;\n';
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => dumpSql });
      const conexionMock = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
      };
      pool.getConnection.mockResolvedValue(conexionMock);

      const resultado = await sincronizarDesdeOrigen('https://sat.example/dump.sql');
      expect(resultado).toEqual([
        { clave: '01010101', descripcion: 'No existe en el catálogo' },
        { clave: '43211508', descripcion: 'Computadores personales' },
        { clave: '50321567', descripcion: "Manzana pomme d'api seca" },
        { clave: '84111500', descripcion: 'Servicios de contabilidad' },
        { clave: '90101501', descripcion: 'Servicios de restaurante' },
      ]);
    });

    test('usa CLAVE_PROD_SERV_SYNC_URL del entorno si no se pasa una URL explícita', async () => {
      process.env.CLAVE_PROD_SERV_SYNC_URL = 'https://sat.example/desde-env';
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

      await expect(sincronizarDesdeOrigen()).rejects.toThrow(/error HTTP 404/);
      expect(global.fetch).toHaveBeenCalledWith('https://sat.example/desde-env', expect.any(Object));
    });

    test('si el guardado falla, hace rollback y libera la conexión', async () => {
      const catalogoRemoto = Array.from({ length: 5 }, (_, i) => ({ clave: `0000000${i}`, descripcion: `Producto ${i}` }));
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(catalogoRemoto) });

      const conexionMock = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn().mockRejectedValue(new Error('fallo de escritura')),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn(),
      };
      pool.getConnection.mockResolvedValue(conexionMock);

      await expect(sincronizarDesdeOrigen('https://sat.example/catalogo')).rejects.toThrow('fallo de escritura');
      expect(conexionMock.rollback).toHaveBeenCalled();
      expect(conexionMock.release).toHaveBeenCalled();
      expect(conexionMock.commit).not.toHaveBeenCalled();
    });
  });
});
