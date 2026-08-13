// Pruebas de backend/scripts/lib/controlDb.js — asegurarControlYPrivilegios()
// y su bloque condicional de credencial "control_app" (segmento 9b, ver
// PROJECT_STATE.md), y aplicarConfiguracionFiscalEnProcesoHijo() (segmento
// 9c). Conexión mockeada a mano, sin mockear ningún módulo — la función
// recibe la conexión como parámetro explícito, mismo patrón que
// cutover-tenant-piloto.test.js. La del segmento 9c sí mockea
// child_process (ejecuta el pre-llenado fiscal en un proceso hijo).

jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}));

const { execFileSync } = require('child_process');
const { asegurarControlYPrivilegios, aplicarConfiguracionFiscalEnProcesoHijo } = require('../../scripts/lib/controlDb');

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

  describe('aplicarConfiguracionFiscalEnProcesoHijo', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('corre setConfiguracionGlobal en un proceso hijo apuntando a la BD del tenant, con los datos fiscales en el entorno', () => {
      aplicarConfiguracionFiscalEnProcesoHijo({
        dbHost: 'mysql',
        dbPort: 3306,
        appUser: 'app',
        appPassword: 'secreto',
        dbName: 'tenant_cliente1',
        datosFiscales: { rfc_compania: 'AAA010101AAA', clave_sat: '12345678' },
      });

      expect(execFileSync).toHaveBeenCalledTimes(1);
      const [ejecutable, args, opciones] = execFileSync.mock.calls[0];
      expect(ejecutable).toBe(process.execPath);
      expect(args.join(' ')).toMatch(/require\('\.\/utils\/config'\)\.setConfiguracionGlobal/);
      expect(opciones.cwd).toMatch(/backend$/);
      expect(opciones.env.DB_NAME).toBe('tenant_cliente1');
      expect(opciones.env.DB_HOST).toBe('mysql');
      expect(opciones.env.DATOS_FISCALES_INTENTO).toBe(
        JSON.stringify({ rfc_compania: 'AAA010101AAA', clave_sat: '12345678' })
      );
    });

    test('los datos fiscales se serializan con exactitud (sin perder acentos/null)', () => {
      aplicarConfiguracionFiscalEnProcesoHijo({
        dbHost: 'mysql',
        dbPort: 3306,
        appUser: 'app',
        appPassword: 'secreto',
        dbName: 'tenant_cliente1',
        datosFiscales: { razon_social_compania: 'Empresa Única, S.A. de C.V.', tipo_persona_compania: null },
      });

      const [, , opciones] = execFileSync.mock.calls[0];
      expect(JSON.parse(opciones.env.DATOS_FISCALES_INTENTO)).toEqual({
        razon_social_compania: 'Empresa Única, S.A. de C.V.',
        tipo_persona_compania: null,
      });
    });
  });
});
