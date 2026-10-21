// Pruebas de scripts/ensureSchema.js — misma lógica que
// backend/scripts/lib/controlDb.js:asegurarColumnasCicloVidaTenant()
// duplicada aquí (segmento 9b/9c, ver PROJECT_STATE.md). Conexión mockeada
// a mano, sin mockear ningún módulo — la función recibe la conexión como
// parámetro explícito, mismo patrón que backend/test/unit/controlDb.test.js.

const {
  asegurarColumnasCicloVidaTenant,
  asegurarTablasSucursales,
  asegurarTablaPlanes,
  COLUMNAS_NUEVAS,
  COLUMNAS_PLANES_NUEVAS,
} = require('../../scripts/ensureSchema');

function mockDb() {
  return { query: jest.fn() };
}

// Derivado de COLUMNAS_NUEVAS (fuente real en ensureSchema.js), nunca una
// copia a mano — hallazgo N-02 (sonar_1.1.html): una lista duplicada aquí
// se desincronizó 2 veces ya cada vez que se agregó una columna nueva.
const TODAS_LAS_COLUMNAS = [
  { COLUMN_NAME: 'id' },
  { COLUMN_NAME: 'slug' },
  ...COLUMNAS_NUEVAS.map(({ nombre }) => ({ COLUMN_NAME: nombre })),
];

describe('scripts/ensureSchema.js', () => {
  describe('asegurarColumnasCicloVidaTenant', () => {
    test('agrega todas las columnas de ciclo de vida y fiscales si no existen', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'slug' }]]);

      await asegurarColumnasCicloVidaTenant(db);

      // 1 SELECT + 33 ALTER (COLUMNAS_NUEVAS, incluida portal_clientes_pausado
      // 1 SELECT + un ALTER por cada entrada de COLUMNAS_NUEVAS (todas
      // faltan) + 1 UPDATE por cada backfill condicional que nace en esta
      // corrida (sucursales_habilitado y ticket_impresion_habilitado).
      // Derivado de la fuente real (COLUMNAS_NUEVAS), nunca un número a
      // mano — ver nota de N-02 arriba.
      const alters = db.query.mock.calls.filter(([sql]) => /^ALTER TABLE tenants ADD COLUMN/.test(sql));
      expect(alters).toHaveLength(COLUMNAS_NUEVAS.length);
      for (const { nombre, definicion } of COLUMNAS_NUEVAS) {
        const esperado = new RegExp(
          `ALTER TABLE tenants ADD COLUMN ${nombre} ${definicion.replace(/[().]/g, '\\$&')}`
        );
        expect(alters.some(([sql]) => esperado.test(sql))).toBe(true);
      }
      expect(db.query.mock.calls.some(([sql]) =>
        /UPDATE tenants SET sucursales_habilitado = 1\s+WHERE grupo_sucursal_id IS NOT NULL AND sucursales_habilitado = 0/.test(sql)
      )).toBe(true);
      expect(db.query.mock.calls.some(([sql]) =>
        /UPDATE tenants SET ticket_impresion_habilitado = marca_lookfeel_habilitado/.test(sql)
      )).toBe(true);
      // 1 SELECT + alters + 2 backfills (sucursales + ticket_impresion).
      expect(db.query).toHaveBeenCalledTimes(1 + COLUMNAS_NUEVAS.length + 2);
    });

    test('backfillea sucursales_habilitado=1 solo para tenants que ya están en un grupo, solo cuando la columna se acaba de agregar', async () => {
      const db = mockDb();
      // Todas las columnas existen EXCEPTO sucursales_habilitado.
      db.query.mockResolvedValueOnce([
        TODAS_LAS_COLUMNAS.filter((c) => c.COLUMN_NAME !== 'sucursales_habilitado'),
      ]);

      await asegurarColumnasCicloVidaTenant(db);

      // 1 SELECT + 1 ALTER (sucursales_habilitado) + 1 UPDATE backfill.
      // ticket_impresion_habilitado ya existe en este mock, así que su
      // backfill no dispara.
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query.mock.calls[1][0]).toMatch(/ALTER TABLE tenants ADD COLUMN sucursales_habilitado/);
      expect(db.query.mock.calls[2][0]).toMatch(
        /UPDATE tenants SET sucursales_habilitado = 1\s+WHERE grupo_sucursal_id IS NOT NULL AND sucursales_habilitado = 0/
      );
    });

    test('NO repite el backfill de sucursales_habilitado si la columna ya existía (nunca pisa una excepción ya guardada)', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([TODAS_LAS_COLUMNAS]);

      await asegurarColumnasCicloVidaTenant(db);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls.some(([sql]) => /UPDATE tenants SET sucursales_habilitado/.test(sql))).toBe(false);
      expect(db.query.mock.calls.some(([sql]) => /UPDATE tenants SET ticket_impresion_habilitado/.test(sql))).toBe(false);
    });

    test('no agrega ninguna columna si todas existen (idempotente)', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([TODAS_LAS_COLUMNAS]);

      await asegurarColumnasCicloVidaTenant(db);

      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('agrega solo las columnas que faltan', async () => {
      const db = mockDb();
      // Solo quedan presentes las primeras 4 (id, slug, baja_en, rfc_compania).
      db.query.mockResolvedValueOnce([
        [TODAS_LAS_COLUMNAS[0], TODAS_LAS_COLUMNAS[1], TODAS_LAS_COLUMNAS[2], TODAS_LAS_COLUMNAS[3]],
      ]);

      await asegurarColumnasCicloVidaTenant(db);

      const faltantes = COLUMNAS_NUEVAS.filter(({ nombre }) => !['baja_en', 'rfc_compania'].includes(nombre));
      const alters = db.query.mock.calls.filter(([sql]) => /^ALTER TABLE tenants ADD COLUMN/.test(sql));
      expect(alters).toHaveLength(faltantes.length);
      expect(alters.some(([sql]) => /ADD COLUMN razon_social_compania/.test(sql))).toBe(true);
      expect(alters.some(([sql]) => /ADD COLUMN baja_en/.test(sql))).toBe(false);
      expect(alters.some(([sql]) => /ADD COLUMN rfc_compania /.test(sql))).toBe(false);
      // sucursales_habilitado y ticket_impresion_habilitado faltan ambas →
      // los 2 backfills disparan.
      expect(db.query.mock.calls.some(([sql]) => /UPDATE tenants SET sucursales_habilitado = 1/.test(sql))).toBe(true);
      expect(db.query.mock.calls.some(([sql]) => /UPDATE tenants SET ticket_impresion_habilitado/.test(sql))).toBe(true);
      expect(db.query).toHaveBeenCalledTimes(1 + faltantes.length + 2);
    });
  });

  describe('asegurarTablasSucursales (§58)', () => {
    test('crea grupos_sucursal, agrega grupo_sucursal_id a tenants si falta, y crea usuarios_sucursal', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([{}]) // CREATE TABLE grupos_sucursal
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'nombre' }, { COLUMN_NAME: 'activo' }]]) // SELECT columnas grupos_sucursal (ya trae "activo")
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'slug' }]]) // SELECT columnas tenants
        .mockResolvedValueOnce([{}]) // ALTER ADD COLUMN grupo_sucursal_id
        .mockResolvedValueOnce([{}]) // ALTER ADD KEY
        .mockResolvedValueOnce([{}]); // CREATE TABLE usuarios_sucursal

      await asegurarTablasSucursales(db);

      // Sin FOREIGN KEY a propósito — control_app no tiene privilegio
      // REFERENCES (validado contra MySQL real, ver comentario en
      // ensureSchema.js).
      expect(db.query).toHaveBeenCalledTimes(6);
      expect(db.query.mock.calls[0][0]).toMatch(/CREATE TABLE IF NOT EXISTS grupos_sucursal/);
      expect(db.query.mock.calls[3][0]).toMatch(/ALTER TABLE tenants ADD COLUMN grupo_sucursal_id INT NULL/);
      expect(db.query.mock.calls[4][0]).toMatch(/ADD KEY idx_tenants_grupo_sucursal/);
      expect(db.query.mock.calls[5][0]).toMatch(/CREATE TABLE IF NOT EXISTS usuarios_sucursal/);
      expect(db.query.mock.calls.some(([sql]) => /FOREIGN KEY/.test(sql))).toBe(false);
    });

    // Instalación que ya tenía `grupos_sucursal` de un intento anterior de
    // este mismo segmento, de antes de que `activo` existiera.
    test('agrega la columna "activo" a grupos_sucursal si una instalación previa no la tenía', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([{}]) // CREATE TABLE grupos_sucursal (no-op, ya existe)
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'nombre' }]]) // sin "activo" todavía
        .mockResolvedValueOnce([{}]) // ALTER ADD COLUMN activo
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'grupo_sucursal_id' }]]) // tenants ya tiene la columna
        .mockResolvedValueOnce([{}]); // CREATE TABLE usuarios_sucursal

      await asegurarTablasSucursales(db);

      expect(db.query.mock.calls[2][0]).toMatch(/ALTER TABLE grupos_sucursal ADD COLUMN activo TINYINT\(1\) NOT NULL DEFAULT 1/);
    });

    test('no agrega grupo_sucursal_id si ya existe (idempotente)', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([{}]) // CREATE TABLE grupos_sucursal
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'activo' }]]) // grupos_sucursal ya tiene "activo"
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'grupo_sucursal_id' }]]) // ya existe
        .mockResolvedValueOnce([{}]); // CREATE TABLE usuarios_sucursal

      await asegurarTablasSucursales(db);

      expect(db.query).toHaveBeenCalledTimes(4);
    });
  });

  describe('asegurarTablaPlanes', () => {
    const COLUMNAS_PLANES_BASE = [
      { COLUMN_NAME: 'id' },
      { COLUMN_NAME: 'nombre' },
      { COLUMN_NAME: 'descripcion' },
      { COLUMN_NAME: 'precio_mensual' },
      { COLUMN_NAME: 'precio_anual' },
      { COLUMN_NAME: 'max_usuarios' },
      { COLUMN_NAME: 'sucursales_habilitado' },
      { COLUMN_NAME: 'facturacion_habilitada' },
      { COLUMN_NAME: 'portal_clientes_habilitado' },
      { COLUMN_NAME: 'marca_lookfeel_habilitado' },
      { COLUMN_NAME: 'disco_cuota_mb' },
      { COLUMN_NAME: 'activo' },
      { COLUMN_NAME: 'orden' },
      { COLUMN_NAME: 'creado_en' },
      { COLUMN_NAME: 'actualizado_en' },
    ];
    // Derivado de COLUMNAS_PLANES_NUEVAS (fuente real), nunca una copia a
    // mano — mismo motivo que TODAS_LAS_COLUMNAS arriba (N-02, sonar_1.1).
    const COLUMNAS_PLANES_NUEVAS_NOMBRES = COLUMNAS_PLANES_NUEVAS.map(({ nombre }) => nombre);

    test('crea la tabla, agrega las 11 columnas nuevas de gobierno de funcionalidades e inserta los 3 planes semilla si el catálogo está vacío', async () => {
      const db = mockDb();
      db.query.mockImplementation((sql) => {
        if (/SELECT COUNT\(\*\) AS total FROM planes/.test(sql)) return Promise.resolve([[{ total: 0 }]]);
        if (/CREATE TABLE IF NOT EXISTS planes/.test(sql)) return Promise.resolve([{}]);
        if (/SELECT COLUMN_NAME FROM INFORMATION_SCHEMA\.COLUMNS[\s\S]*'planes'/.test(sql)) return Promise.resolve([COLUMNAS_PLANES_BASE]);
        return Promise.resolve([{}]);
      });

      await asegurarTablaPlanes(db);

      // 1 CREATE TABLE + 1 SELECT columnas + un ALTER por cada entrada de
      // COLUMNAS_PLANES_NUEVAS (ninguna existía) + 1 UPDATE (backfill de
      // ticket_impresion_habilitado, que nace en esta misma corrida) +
      // 1 SELECT COUNT + 1 INSERT. Derivado de la fuente real, nunca un
      // número a mano (N-02).
      const totalEsperado = 2 + COLUMNAS_PLANES_NUEVAS_NOMBRES.length + 1 + 2;
      expect(db.query).toHaveBeenCalledTimes(totalEsperado);
      expect(db.query.mock.calls[0][0]).toMatch(/CREATE TABLE IF NOT EXISTS planes/);
      expect(db.query.mock.calls[1][0]).toMatch(/SELECT COLUMN_NAME FROM INFORMATION_SCHEMA\.COLUMNS/);
      COLUMNAS_PLANES_NUEVAS_NOMBRES.forEach((nombre, i) => {
        expect(db.query.mock.calls[2 + i][0]).toMatch(new RegExp(`ALTER TABLE planes ADD COLUMN ${nombre} TINYINT\\(1\\) NOT NULL DEFAULT 0`));
      });
      expect(db.query.mock.calls.some(([sql]) =>
        /UPDATE planes SET ticket_impresion_habilitado = marca_lookfeel_habilitado/.test(sql)
      )).toBe(true);
      const idxCount = 2 + COLUMNAS_PLANES_NUEVAS_NOMBRES.length + 1;
      expect(db.query.mock.calls[idxCount][0]).toMatch(/SELECT COUNT\(\*\) AS total FROM planes/);
      const [sqlInsert, params] = db.query.mock.calls[idxCount + 1];
      expect(sqlInsert).toMatch(/INSERT INTO planes/);
      expect(sqlInsert).toMatch(/ventas_habilitado, gastos_habilitado, inventarios_habilitado/);
      expect(params[0]).toHaveLength(3);
      expect(params[0].map((fila) => fila[0])).toEqual(['Básico', 'Pro', 'Enterprise']);
      // La fila semilla NO incluye promociones_habilitado ni
      // ticket_impresion_habilitado a propósito (quedan en su DEFAULT 0 —
      // ver comentario de asegurarTablaPlanes en ensureSchema.js): 25
      // valores = 14 columnas originales + 11 flags de gobierno "legacy" +
      // activo/orden/creado_en/actualizado_en. Si se agrega un flag nuevo
      // al INSERT real, este número cambia a propósito — no derivarlo de
      // COLUMNAS_PLANES_NUEVAS.length (son conjuntos distintos).
      expect(params[0][0]).toHaveLength(25);
    });

    test('no agrega columnas ni reinserta la semilla si el catálogo ya está migrado y tiene planes (el operador ya es dueño del catálogo)', async () => {
      const db = mockDb();
      const columnasYaMigradas = COLUMNAS_PLANES_BASE.concat(
        COLUMNAS_PLANES_NUEVAS_NOMBRES.map((nombre) => ({ COLUMN_NAME: nombre }))
      );
      db.query.mockImplementation((sql) => {
        if (/SELECT COUNT\(\*\) AS total FROM planes/.test(sql)) return Promise.resolve([[{ total: 2 }]]);
        if (/CREATE TABLE IF NOT EXISTS planes/.test(sql)) return Promise.resolve([{}]);
        if (/SELECT COLUMN_NAME FROM INFORMATION_SCHEMA\.COLUMNS[\s\S]*'planes'/.test(sql)) return Promise.resolve([columnasYaMigradas]);
        return Promise.resolve([{}]);
      });

      await asegurarTablaPlanes(db);

      // 1 CREATE TABLE + 1 SELECT columnas (todas ya existen, 0 ALTER) +
      // 1 SELECT COUNT = 3. Sin INSERT.
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query.mock.calls.some(([sql]) => /ALTER TABLE planes/.test(sql))).toBe(false);
      expect(db.query.mock.calls.some(([sql]) => /INSERT INTO planes/.test(sql))).toBe(false);
    });
  });
});
