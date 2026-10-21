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

    test('el usuario de aplicación compartido sigue recibiendo su GRANT sobre ambos ámbitos (ahora angosto, sin ALL PRIVILEGES)', async () => {
      const root = mockRoot();

      await asegurarControlYPrivilegios(root, 'app', 'ClaveControlLarga123');

      const llamadas = root.query.mock.calls.map((c) => c[0]);
      expect(llamadas.some((sql) => sql.includes("TO `app`@'%'") && sql.includes('control_tenants'))).toBe(true);
      expect(llamadas.some((sql) => sql.includes("TO `app`@'%'") && sql.includes('tenant\\_%'))).toBe(true);
    });

    // Hallazgo M-14 (sonar.html, 2026-10-15): "app" ya NO recibe GRANT
    // ALL PRIVILEGES sobre control_tenants ni tenant_* — una inyección
    // SQL o RCE real a través de esa credencial ya no podría DROP
    // DATABASE. El único DROP real del proyecto vive en un usuario
    // aparte ("app_tenant_drop", ver más abajo).
    describe('M-14 — grant angosto de "app" (sin DROP ni GRANT OPTION)', () => {
      test('el GRANT de "app" nunca usa ALL PRIVILEGES, en ninguno de los 2 ámbitos', async () => {
        const root = mockRoot();

        await asegurarControlYPrivilegios(root, 'app');

        const grants = root.query.mock.calls
          .map((c) => c[0])
          .filter((sql) => sql.startsWith('GRANT') && sql.includes("TO `app`@'%'"));

        expect(grants.length).toBe(2);
        grants.forEach((sql) => expect(sql).not.toMatch(/ALL PRIVILEGES/));
      });

      test('el GRANT de "app" incluye el CRUD + CREATE/ALTER que de verdad usa, nunca DROP', async () => {
        const root = mockRoot();

        await asegurarControlYPrivilegios(root, 'app');

        const grantTenant = root.query.mock.calls
          .map((c) => c[0])
          .find((sql) => sql.startsWith('GRANT') && sql.includes("TO `app`@'%'") && sql.includes('tenant\\_%'));

        expect(grantTenant).toMatch(/SELECT/);
        expect(grantTenant).toMatch(/INSERT/);
        expect(grantTenant).toMatch(/UPDATE/);
        expect(grantTenant).toMatch(/DELETE/);
        expect(grantTenant).toMatch(/CREATE\b/);
        expect(grantTenant).toMatch(/ALTER\b/);
        expect(grantTenant).not.toMatch(/\bDROP\b/);
        expect(grantTenant).not.toMatch(/GRANT OPTION/);
      });

      test('revoca explícitamente DROP y GRANT OPTION en ambos ámbitos (idempotente — angosta una instalación con el GRANT viejo)', async () => {
        const root = mockRoot();

        await asegurarControlYPrivilegios(root, 'app');

        const revokes = root.query.mock.calls
          .map((c) => c[0])
          .filter((sql) => sql.startsWith('REVOKE') && sql.includes("FROM `app`@'%'"));

        expect(revokes.length).toBe(2);
        revokes.forEach((sql) => {
          expect(sql).toMatch(/\bDROP\b/);
          expect(sql).toMatch(/GRANT OPTION/);
        });
        expect(revokes.some((sql) => sql.includes('control_tenants'))).toBe(true);
        expect(revokes.some((sql) => sql.includes('tenant\\_%'))).toBe(true);
      });

      test('un REVOKE que falla (privilegio nunca otorgado, instalación nueva) no tumba la función', async () => {
        const root = {
          query: jest.fn((sql) => {
            if (sql.startsWith('REVOKE')) return Promise.reject(new Error("ERROR 1141: There is no such grant defined"));
            return Promise.resolve([{}]);
          }),
        };

        await expect(asegurarControlYPrivilegios(root, 'app')).resolves.not.toThrow();
      });
    });

    // Hallazgo M-14: usuario "app_tenant_drop" — mismo criterio OPCIONAL
    // que controlAppPassword, pero para el único DROP DATABASE real del
    // proyecto (backend/db.js:eliminarBaseDeDatosTenant()).
    describe('M-14 — usuario "app_tenant_drop" (DROP-only sobre tenant_*)', () => {
      test('sin appDropPassword, NO crea ni otorga nada a app_tenant_drop', async () => {
        const root = mockRoot();

        await asegurarControlYPrivilegios(root, 'app', 'ClaveControlLarga123');

        const llamadas = root.query.mock.calls.map((c) => c[0]);
        expect(llamadas.some((sql) => sql.includes('app_tenant_drop'))).toBe(false);
      });

      test('con appDropPassword, crea/rota el usuario y otorga SOLO DROP sobre tenant_*', async () => {
        const root = mockRoot();

        await asegurarControlYPrivilegios(root, 'app', 'ClaveControlLarga123', 'ClaveDropLarga456');

        const llamadas = root.query.mock.calls;
        const crea = llamadas.find(([sql]) => sql.includes('CREATE USER IF NOT EXISTS') && sql.includes('app_tenant_drop'));
        const rota = llamadas.find(([sql]) => sql.includes('ALTER USER') && sql.includes('app_tenant_drop'));
        const otorga = llamadas.find(([sql]) => sql.includes('GRANT') && sql.includes('app_tenant_drop'));

        expect(crea[1]).toEqual(['ClaveDropLarga456']);
        expect(rota[1]).toEqual(['ClaveDropLarga456']);
        expect(otorga[0]).toMatch(/^GRANT DROP ON `tenant\\_%`\.\* TO 'app_tenant_drop'@'%'$/);
        // Nunca sobre control_tenants — este usuario es exclusivo de tenant_*.
        expect(otorga[0]).not.toMatch(/control_tenants/);
      });
    });
  });
});
