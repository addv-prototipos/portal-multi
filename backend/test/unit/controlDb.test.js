// Pruebas de backend/scripts/lib/controlDb.js — asegurarControlYPrivilegios()
// y su bloque condicional de credencial "control_app" (segmento 9b, ver
// PROJECT_STATE.md). Conexión mockeada a mano, sin mockear ningún módulo —
// la función recibe la conexión como parámetro explícito, mismo patrón que
// cutover-tenant-piloto.test.js.

const { asegurarControlYPrivilegios } = require('../../scripts/lib/controlDb');

function mockRoot() {
  return { query: jest.fn().mockResolvedValue([{}]) };
}

describe('scripts/lib/controlDb.js', () => {
  describe('asegurarControlYPrivilegios', () => {
    test('sin controlAppPassword, NO crea ni otorga nada al usuario control_app', async () => {
      const root = mockRoot();

      await asegurarControlYPrivilegios(root, 'app');

      const llamadas = root.query.mock.calls.map((c) => c[0]);
      expect(llamadas.some((sql) => sql.includes('control_app'))).toBe(false);
    });

    test('con controlAppPassword, crea/rota el usuario y otorga solo lo necesario sobre control_tenants', async () => {
      const root = mockRoot();

      await asegurarControlYPrivilegios(root, 'app', 'ClaveControlLarga123');

      const llamadas = root.query.mock.calls;
      const crea = llamadas.find(([sql]) => sql.includes('CREATE USER IF NOT EXISTS') && sql.includes('control_app'));
      const rota = llamadas.find(([sql]) => sql.includes('ALTER USER') && sql.includes('control_app'));
      const otorga = llamadas.find(([sql]) => sql.includes('GRANT') && sql.includes('control_app'));

      expect(crea[1]).toEqual(['ClaveControlLarga123']);
      expect(rota[1]).toEqual(['ClaveControlLarga123']);
      expect(otorga[0]).toMatch(/GRANT SELECT, INSERT, UPDATE, CREATE, ALTER ON `control_tenants`\.\*/);
      // Aislamiento deliberado: sin DELETE y sin ningún privilegio sobre tenant_*.
      expect(otorga[0]).not.toMatch(/DELETE/);
      expect(otorga[0]).not.toMatch(/tenant\\_%/);
    });

    test('el usuario de aplicación compartido sigue recibiendo su GRANT amplio de siempre', async () => {
      const root = mockRoot();

      await asegurarControlYPrivilegios(root, 'app', 'ClaveControlLarga123');

      const llamadas = root.query.mock.calls.map((c) => c[0]);
      expect(llamadas.some((sql) => sql.includes("TO `app`@'%'") && sql.includes('control_tenants'))).toBe(true);
      expect(llamadas.some((sql) => sql.includes("TO `app`@'%'") && sql.includes('tenant\\_%'))).toBe(true);
    });
  });
});
