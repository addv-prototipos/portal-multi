// Pruebas de scripts/ensureSchema.js — misma lógica que
// backend/scripts/lib/controlDb.js:asegurarColumnasCicloVidaTenant()
// duplicada aquí (segmento 9b/9c, ver PROJECT_STATE.md). Conexión mockeada
// a mano, sin mockear ningún módulo — la función recibe la conexión como
// parámetro explícito, mismo patrón que backend/test/unit/controlDb.test.js.

const { asegurarColumnasCicloVidaTenant } = require('../../scripts/ensureSchema');

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
];

describe('scripts/ensureSchema.js', () => {
  describe('asegurarColumnasCicloVidaTenant', () => {
    test('agrega todas las columnas de ciclo de vida y fiscales si no existen', async () => {
      const db = mockDb();
      db.query
        .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'slug' }]]);

      await asegurarColumnasCicloVidaTenant(db);

      expect(db.query).toHaveBeenCalledTimes(11);
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

      expect(db.query).toHaveBeenCalledTimes(9);
      expect(db.query.mock.calls[1][0]).toMatch(/ADD COLUMN razon_social_compania/);
      expect(db.query.mock.calls[2][0]).toMatch(/ADD COLUMN regimen_fiscal_compania/);
      expect(db.query.mock.calls[3][0]).toMatch(/ADD COLUMN tipo_persona_compania/);
      expect(db.query.mock.calls[4][0]).toMatch(/ADD COLUMN clave_sat/);
      expect(db.query.mock.calls[5][0]).toMatch(/ADD COLUMN link_codigos_sat/);
      expect(db.query.mock.calls[6][0]).toMatch(/ADD COLUMN correo_reportes/);
      expect(db.query.mock.calls[7][0]).toMatch(/ADD COLUMN marca/);
      expect(db.query.mock.calls[8][0]).toMatch(/ADD COLUMN marca_logo_url/);
    });
  });
});