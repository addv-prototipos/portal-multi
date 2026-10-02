// Pruebas de scripts/ensureSchema.js — misma lógica que
// backend/scripts/lib/controlDb.js:asegurarColumnasCicloVidaTenant()
// duplicada aquí (segmento 9b/9c, ver PROJECT_STATE.md). Conexión mockeada
// a mano, sin mockear ningún módulo — la función recibe la conexión como
// parámetro explícito, mismo patrón que backend/test/unit/controlDb.test.js.

const {
  asegurarColumnasCicloVidaTenant,
  asegurarTablasSucursales,
  asegurarTablaPlanes,
} = require('../../scripts/ensureSchema');

function mockDb() {
  return { query: jest.fn() };
}

const TODAS_LAS_COLUMNAS = [
  { COLUMN_NAME: 'id' },
  { COLUMN_NAME: 'slug' },
  { COLUMN_NAME: 'baja_en' },
  { COLUMN_NAME: 'rfc_compania' },
  { COLUMN_NAME: 'razon_social_compania' },
  { COLUMN_NAME: 'regimen_fiscal_compania' },
  { COLUMN_NAME: 'tipo_persona_compania' },
  { COLUMN_NAME: 'clave_sat' },
  { COLUMN_NAME: 'link_codigos_sat' },
  { COLUMN_NAME: 'correo_reportes' },
  { COLUMN_NAME: 'marca' },
  { COLUMN_NAME: 'marca_logo_url' },
  { COLUMN_NAME: 'tema_json' },
  { COLUMN_NAME: 'marca_lookfeel_habilitado' },
  { COLUMN_NAME: 'max_usuarios' },
  { COLUMN_NAME: 'plan_id' },
  { COLUMN_NAME: 'plan_actualizado_en' },
  { COLUMN_NAME: 'facturacion_habilitada' },
  { COLUMN_NAME: 'portal_clientes_habilitado' },
  { COLUMN_NAME: 'sucursales_habilitado' },
  { COLUMN_NAME: 'disco_cuota_mb' },
  { COLUMN_NAME: 'disco_bytes_usados_cache' },
  { COLUMN_NAME: 'disco_cache_actualizado_en' },
  // Punto 349-350 — gobierno de funcionalidades ampliado (ver
  // stitch/gobierno-funcionalidades/NOTAS.md).
  { COLUMN_NAME: 'ventas_habilitado' },
  { COLUMN_NAME: 'gastos_habilitado' },
  { COLUMN_NAME: 'inventarios_habilitado' },
  { COLUMN_NAME: 'auditoria_habilitado' },
  { COLUMN_NAME: 'cxc_habilitado' },
  { COLUMN_NAME: 'resumen_financiero_habilitado' },
  { COLUMN_NAME: 'reportes_por_reporte_habilitado' },
  { COLUMN_NAME: 'reportes_cortes_habilitado' },
  { COLUMN_NAME: 'reportes_eliminados_habilitado' },
  { COLUMN_NAME: 'reportes_estado_inventario_habilitado' },
];

describe('scripts/ensureSchema.js', () => {
  describe('asegurarColumnasCicloVidaTenant', () => {
    test('agrega todas las columnas de ciclo de vida y fiscales si no existen', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'slug' }]]);

      await asegurarColumnasCicloVidaTenant(db);

      // 1 SELECT + 31 ALTER (COLUMNAS_NUEVAS) + 1 UPDATE de backfill
      // (sucursales_habilitado se agregó en esta misma corrida).
      expect(db.query).toHaveBeenCalledTimes(33);
      expect(db.query.mock.calls[1][0]).toMatch(/ALTER TABLE tenants ADD COLUMN baja_en DATETIME NULL/);
      expect(db.query.mock.calls[2][0]).toMatch(/ALTER TABLE tenants ADD COLUMN rfc_compania VARCHAR\(13\) NULL/);
      expect(db.query.mock.calls[3][0]).toMatch(/ALTER TABLE tenants ADD COLUMN razon_social_compania VARCHAR\(255\) NULL/);
      expect(db.query.mock.calls[4][0]).toMatch(/ALTER TABLE tenants ADD COLUMN regimen_fiscal_compania VARCHAR\(255\) NULL/);
      expect(db.query.mock.calls[5][0]).toMatch(/ALTER TABLE tenants ADD COLUMN tipo_persona_compania ENUM\('fisica','moral'\) NULL/);
      expect(db.query.mock.calls[6][0]).toMatch(/ALTER TABLE tenants ADD COLUMN clave_sat VARCHAR\(8\) NULL/);
      expect(db.query.mock.calls[7][0]).toMatch(/ALTER TABLE tenants ADD COLUMN link_codigos_sat VARCHAR\(500\) NULL/);
      expect(db.query.mock.calls[8][0]).toMatch(/ALTER TABLE tenants ADD COLUMN correo_reportes VARCHAR\(200\) NULL/);
      expect(db.query.mock.calls[9][0]).toMatch(/ALTER TABLE tenants ADD COLUMN marca VARCHAR\(255\) NULL/);
      expect(db.query.mock.calls[10][0]).toMatch(/ALTER TABLE tenants ADD COLUMN marca_logo_url VARCHAR\(500\) NULL/);
      expect(db.query.mock.calls[11][0]).toMatch(/ALTER TABLE tenants ADD COLUMN tema_json TEXT NULL/);
      expect(db.query.mock.calls[12][0]).toMatch(/ALTER TABLE tenants ADD COLUMN marca_lookfeel_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[13][0]).toMatch(/ALTER TABLE tenants ADD COLUMN max_usuarios INT NULL/);
      expect(db.query.mock.calls[14][0]).toMatch(/ALTER TABLE tenants ADD COLUMN plan_id INT NULL/);
      expect(db.query.mock.calls[15][0]).toMatch(/ALTER TABLE tenants ADD COLUMN plan_actualizado_en DATETIME NULL/);
      expect(db.query.mock.calls[16][0]).toMatch(/ALTER TABLE tenants ADD COLUMN facturacion_habilitada TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[17][0]).toMatch(/ALTER TABLE tenants ADD COLUMN portal_clientes_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[18][0]).toMatch(/ALTER TABLE tenants ADD COLUMN sucursales_habilitado TINYINT\(1\) NOT NULL DEFAULT 0/);
      expect(db.query.mock.calls[19][0]).toMatch(/ALTER TABLE tenants ADD COLUMN disco_cuota_mb INT NULL/);
      expect(db.query.mock.calls[20][0]).toMatch(/ALTER TABLE tenants ADD COLUMN disco_bytes_usados_cache BIGINT NULL/);
      expect(db.query.mock.calls[21][0]).toMatch(/ALTER TABLE tenants ADD COLUMN disco_cache_actualizado_en DATETIME NULL/);
      // Punto 349-350: las 10 columnas nuevas de gobierno de funcionalidades.
      expect(db.query.mock.calls[22][0]).toMatch(/ALTER TABLE tenants ADD COLUMN ventas_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[23][0]).toMatch(/ALTER TABLE tenants ADD COLUMN gastos_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[24][0]).toMatch(/ALTER TABLE tenants ADD COLUMN inventarios_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[25][0]).toMatch(/ALTER TABLE tenants ADD COLUMN auditoria_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[26][0]).toMatch(/ALTER TABLE tenants ADD COLUMN cxc_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[27][0]).toMatch(/ALTER TABLE tenants ADD COLUMN resumen_financiero_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[28][0]).toMatch(/ALTER TABLE tenants ADD COLUMN reportes_por_reporte_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[29][0]).toMatch(/ALTER TABLE tenants ADD COLUMN reportes_cortes_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[30][0]).toMatch(/ALTER TABLE tenants ADD COLUMN reportes_eliminados_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[31][0]).toMatch(/ALTER TABLE tenants ADD COLUMN reportes_estado_inventario_habilitado TINYINT\(1\) NOT NULL DEFAULT 1/);
      expect(db.query.mock.calls[32][0]).toMatch(
        /UPDATE tenants SET sucursales_habilitado = 1\s+WHERE grupo_sucursal_id IS NOT NULL AND sucursales_habilitado = 0/
      );
    });

    test('backfillea sucursales_habilitado=1 solo para tenants que ya están en un grupo, solo cuando la columna se acaba de agregar', async () => {
      const db = mockDb();
      // Todas las columnas existen EXCEPTO sucursales_habilitado.
      db.query.mockResolvedValueOnce([
        TODAS_LAS_COLUMNAS.filter((c) => c.COLUMN_NAME !== 'sucursales_habilitado'),
      ]);

      await asegurarColumnasCicloVidaTenant(db);

      // 1 SELECT + 1 ALTER (sucursales_habilitado) + 1 UPDATE backfill.
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
    });

    test('no agrega ninguna columna si todas existen (idempotente)', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([TODAS_LAS_COLUMNAS]);

      await asegurarColumnasCicloVidaTenant(db);

      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('agrega solo las columnas que faltan', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([
        [TODAS_LAS_COLUMNAS[0], TODAS_LAS_COLUMNAS[1], TODAS_LAS_COLUMNAS[2], TODAS_LAS_COLUMNAS[3]],
      ]);

      await asegurarColumnasCicloVidaTenant(db);

      // 1 SELECT + 29 ALTER (31 de COLUMNAS_NUEVAS, menos baja_en y
      // rfc_compania que ya existían) + 1 UPDATE backfill = 31.
      expect(db.query).toHaveBeenCalledTimes(31);
      expect(db.query.mock.calls[1][0]).toMatch(/ADD COLUMN razon_social_compania/);
      expect(db.query.mock.calls[2][0]).toMatch(/ADD COLUMN regimen_fiscal_compania/);
      expect(db.query.mock.calls[3][0]).toMatch(/ADD COLUMN tipo_persona_compania/);
      expect(db.query.mock.calls[4][0]).toMatch(/ADD COLUMN clave_sat/);
      expect(db.query.mock.calls[5][0]).toMatch(/ADD COLUMN link_codigos_sat/);
      expect(db.query.mock.calls[6][0]).toMatch(/ADD COLUMN correo_reportes/);
      expect(db.query.mock.calls[7][0]).toMatch(/ADD COLUMN marca/);
      expect(db.query.mock.calls[8][0]).toMatch(/ADD COLUMN marca_logo_url/);
      expect(db.query.mock.calls[9][0]).toMatch(/ADD COLUMN tema_json/);
      expect(db.query.mock.calls[29][0]).toMatch(/ADD COLUMN reportes_estado_inventario_habilitado/);
      expect(db.query.mock.calls[30][0]).toMatch(/UPDATE tenants SET sucursales_habilitado = 1/);
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
    const COLUMNAS_PLANES_NUEVAS_NOMBRES = [
      'ventas_habilitado',
      'gastos_habilitado',
      'inventarios_habilitado',
      'auditoria_habilitado',
      'cxc_habilitado',
      'resumen_financiero_habilitado',
      'reportes_por_reporte_habilitado',
      'reportes_cortes_habilitado',
      'reportes_eliminados_habilitado',
      'reportes_estado_inventario_habilitado',
    ];

    test('crea la tabla, agrega las 10 columnas nuevas de gobierno de funcionalidades e inserta los 3 planes semilla si el catálogo está vacío', async () => {
      const db = mockDb();
      db.query.mockImplementation((sql) => {
        if (/SELECT COUNT\(\*\) AS total FROM planes/.test(sql)) return Promise.resolve([[{ total: 0 }]]);
        if (/CREATE TABLE IF NOT EXISTS planes/.test(sql)) return Promise.resolve([{}]);
        if (/SELECT COLUMN_NAME FROM INFORMATION_SCHEMA\.COLUMNS[\s\S]*'planes'/.test(sql)) return Promise.resolve([COLUMNAS_PLANES_BASE]);
        return Promise.resolve([{}]);
      });

      await asegurarTablaPlanes(db);

      // 1 CREATE TABLE + 1 SELECT columnas + 10 ALTER (las nuevas, ninguna
      // existía) + 1 SELECT COUNT + 1 INSERT = 14.
      expect(db.query).toHaveBeenCalledTimes(14);
      expect(db.query.mock.calls[0][0]).toMatch(/CREATE TABLE IF NOT EXISTS planes/);
      expect(db.query.mock.calls[1][0]).toMatch(/SELECT COLUMN_NAME FROM INFORMATION_SCHEMA\.COLUMNS/);
      COLUMNAS_PLANES_NUEVAS_NOMBRES.forEach((nombre, i) => {
        expect(db.query.mock.calls[2 + i][0]).toMatch(new RegExp(`ALTER TABLE planes ADD COLUMN ${nombre} TINYINT\\(1\\) NOT NULL DEFAULT 0`));
      });
      expect(db.query.mock.calls[12][0]).toMatch(/SELECT COUNT\(\*\) AS total FROM planes/);
      const [sqlInsert, params] = db.query.mock.calls[13];
      expect(sqlInsert).toMatch(/INSERT INTO planes/);
      expect(sqlInsert).toMatch(/ventas_habilitado, gastos_habilitado, inventarios_habilitado/);
      expect(params[0]).toHaveLength(3);
      expect(params[0].map((fila) => fila[0])).toEqual(['Básico', 'Pro', 'Enterprise']);
      // Cada fila semilla trae ya los 24 valores (14 originales + 10
      // nuevos + activo/orden/creado_en/actualizado_en) — Básico no
      // incluye ningún módulo nuevo, Pro y Enterprise sí.
      expect(params[0][0]).toHaveLength(24);
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
