// Pruebas de la lógica pura de backend/scripts/cutover-tenant-piloto.js
// (segmento 6 del plan multi-tenant, ver PROJECT_STATE.md) — el script
// completo requiere MySQL/MinIO reales (no disponibles en este entorno),
// así que aquí solo se prueban las piezas que pueden aislarse: el parseo
// de argumentos y `copiarDatosTabla`, con un objeto `root` (conexión
// mysql2) mockeado a mano — no hace falta mockear ningún módulo, la
// función recibe `root` como parámetro explícito.

const { leerArgumentos, copiarDatosTabla, TABLAS_EN_ORDEN } = require('../../scripts/cutover-tenant-piloto');

function mockRoot() {
  return { query: jest.fn() };
}

describe('scripts/cutover-tenant-piloto.js', () => {
  describe('TABLAS_EN_ORDEN', () => {
    test('incluye las 7 tablas que crea ensureSchema(), sin duplicados', () => {
      expect(TABLAS_EN_ORDEN).toEqual([
        'registros',
        'configuracion',
        'usuarios',
        'ordenes_compra',
        'tickets',
        'reportes',
        'reporte_items',
      ]);
      expect(new Set(TABLAS_EN_ORDEN).size).toBe(TABLAS_EN_ORDEN.length);
    });

    test('reportes aparece antes que reporte_items (dependencia de llave foránea)', () => {
      expect(TABLAS_EN_ORDEN.indexOf('reportes')).toBeLessThan(TABLAS_EN_ORDEN.indexOf('reporte_items'));
    });
  });

  describe('leerArgumentos', () => {
    const ARGV_BASE = ['node', 'cutover-tenant-piloto.js', 'Cliente1', 'Empresa Uno S.A.'];

    test('normaliza el slug a minúsculas', () => {
      const { slug } = leerArgumentos(ARGV_BASE);
      expect(slug).toBe('cliente1');
    });

    test('usa DB_NAME del entorno como origen por defecto', () => {
      const antes = process.env.DB_NAME;
      process.env.DB_NAME = 'portal_facturacion_prueba';
      const { origenDb } = leerArgumentos(ARGV_BASE);
      expect(origenDb).toBe('portal_facturacion_prueba');
      if (antes === undefined) delete process.env.DB_NAME;
      else process.env.DB_NAME = antes;
    });

    test('--origen-db= tiene prioridad sobre DB_NAME del entorno', () => {
      const { origenDb } = leerArgumentos([...ARGV_BASE, '--origen-db=otra_base']);
      expect(origenDb).toBe('otra_base');
    });

    test('--contacto-email= se parsea correctamente', () => {
      const { contactoEmail } = leerArgumentos([...ARGV_BASE, '--contacto-email=contacto@empresa.com']);
      expect(contactoEmail).toBe('contacto@empresa.com');
    });

    test('sin --contacto-email, queda null', () => {
      const { contactoEmail } = leerArgumentos(ARGV_BASE);
      expect(contactoEmail).toBeNull();
    });
  });

  describe('copiarDatosTabla', () => {
    test('copia usando la lista de columnas del destino y verifica que el conteo coincida', async () => {
      const root = mockRoot();
      root.query
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'rfc' }]]) // columnas del destino
        .mockResolvedValueOnce([{}]) // INSERT
        .mockResolvedValueOnce([[{ total: 3 }]]) // COUNT origen
        .mockResolvedValueOnce([[{ total: 3 }]]); // COUNT destino

      const total = await copiarDatosTabla(root, 'origen_db', 'destino_db', 'usuarios');

      expect(total).toBe(3);
      expect(root.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO `destino_db`.`usuarios` (`id`, `rfc`)')
      );
    });

    test('lanza un error claro si la tabla no existe en el destino (ensureSchema no corrió)', async () => {
      const root = mockRoot();
      root.query.mockResolvedValueOnce([[]]); // sin columnas

      await expect(copiarDatosTabla(root, 'origen_db', 'destino_db', 'usuarios')).rejects.toThrow(
        /no existe en la base de datos destino/
      );
    });

    test('lanza un error si el conteo de filas no coincide entre origen y destino', async () => {
      const root = mockRoot();
      root.query
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([[{ total: 5 }]]) // origen
        .mockResolvedValueOnce([[{ total: 4 }]]); // destino (discrepancia)

      await expect(copiarDatosTabla(root, 'origen_db', 'destino_db', 'tickets')).rejects.toThrow(
        /Discrepancia copiando "tickets"/
      );
    });
  });
});
