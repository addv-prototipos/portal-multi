// Pruebas de scripts/ensureSchema.js — misma lógica que
// backend/scripts/lib/controlDb.js:asegurarColumnasCicloVidaTenant()
// duplicada aquí (segmento 9b/9c, ver PROJECT_STATE.md). Conexión mockeada
// a mano, sin mockear ningún módulo — la función recibe la conexión como
// parámetro explícito, mismo patrón que backend/test/unit/controlDb.test.js.

const { asegurarColumnasCicloVidaTenant, asegurarTablasSucursales } = require('../../scripts/ensureSchema');

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
];

describe('scripts/ensureSchema.js', () => {
  describe('asegurarColumnasCicloVidaTenant', () => {
    test('agrega todas las columnas de ciclo de vida y fiscales si no existen', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'slug' }]]);

      await asegurarColumnasCicloVidaTenant(db);

      expect(db.query).toHaveBeenCalledTimes(14);
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

      expect(db.query).toHaveBeenCalledTimes(12);
      expect(db.query.mock.calls[1][0]).toMatch(/ADD COLUMN razon_social_compania/);
      expect(db.query.mock.calls[2][0]).toMatch(/ADD COLUMN regimen_fiscal_compania/);
      expect(db.query.mock.calls[3][0]).toMatch(/ADD COLUMN tipo_persona_compania/);
      expect(db.query.mock.calls[4][0]).toMatch(/ADD COLUMN clave_sat/);
      expect(db.query.mock.calls[5][0]).toMatch(/ADD COLUMN link_codigos_sat/);
      expect(db.query.mock.calls[6][0]).toMatch(/ADD COLUMN correo_reportes/);
      expect(db.query.mock.calls[7][0]).toMatch(/ADD COLUMN marca/);
      expect(db.query.mock.calls[8][0]).toMatch(/ADD COLUMN marca_logo_url/);
      expect(db.query.mock.calls[9][0]).toMatch(/ADD COLUMN tema_json/);
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
    // este mismo segmento, de antes de que existiera `activo`.
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
});