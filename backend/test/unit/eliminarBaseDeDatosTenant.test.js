// Hallazgo M-14 (sonar.html, 2026-10-15): eliminarBaseDeDatosTenant()
// (el único DROP DATABASE real del proyecto) debe usar la credencial
// NUEVA y separada DB_DROP_USER/DB_DROP_PASSWORD — nunca DB_USER/
// DB_PASSWORD (la credencial compartida con las ~90 rutas parametrizadas
// del día a día, que ya NO tiene privilegio DROP, ver
// backend/scripts/lib/controlDb.js). Mockea mysql2/promise para
// inspeccionar con qué credenciales se abre cada conexión, sin una BD
// real. Módulo cargado una sola vez por test (jest.resetModules()) para
// poder variar las variables de entorno entre pruebas.

function mockMysql() {
  return {
    createPool: jest.fn(() => ({
      query: jest.fn(),
      getConnection: jest.fn(),
      execute: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
    })),
    createConnection: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue([{}]),
      end: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

describe('backend/db.js — credenciales de eliminarBaseDeDatosTenant/crearBaseDeDatosTenant (M-14)', () => {
  const ENV_ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    jest.resetModules();
  });

  test('eliminarBaseDeDatosTenant usa DB_DROP_USER/DB_DROP_PASSWORD, nunca DB_USER/DB_PASSWORD', async () => {
    jest.resetModules();
    jest.doMock('mysql2/promise', () => mockMysql());
    process.env.DB_USER = 'app';
    process.env.DB_PASSWORD = 'claveAppNormal';
    process.env.DB_DROP_USER = 'app_tenant_drop';
    process.env.DB_DROP_PASSWORD = 'claveDropAparte';

    const db = require('../../db');
    const mysql = require('mysql2/promise');

    await db.eliminarBaseDeDatosTenant('tenant_prueba');

    expect(mysql.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'app_tenant_drop', password: 'claveDropAparte' })
    );
  });

  test('eliminarBaseDeDatosTenant sin DB_DROP_USER/DB_DROP_PASSWORD configuradas: usa el default "app_tenant_drop" con password vacío (nunca cae a DB_USER/DB_PASSWORD)', async () => {
    jest.resetModules();
    jest.doMock('mysql2/promise', () => mockMysql());
    process.env.DB_USER = 'app';
    process.env.DB_PASSWORD = 'claveAppNormal';
    delete process.env.DB_DROP_USER;
    delete process.env.DB_DROP_PASSWORD;

    const db = require('../../db');
    const mysql = require('mysql2/promise');

    await db.eliminarBaseDeDatosTenant('tenant_prueba');

    expect(mysql.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'app_tenant_drop', password: '' })
    );
  });

  test('crearBaseDeDatosTenant SIGUE usando DB_USER/DB_PASSWORD (sin regresión — ese sí necesita CREATE, que "app" conserva)', async () => {
    jest.resetModules();
    jest.doMock('mysql2/promise', () => mockMysql());
    process.env.DB_USER = 'app';
    process.env.DB_PASSWORD = 'claveAppNormal';
    process.env.DB_DROP_USER = 'app_tenant_drop';
    process.env.DB_DROP_PASSWORD = 'claveDropAparte';

    const db = require('../../db');
    const mysql = require('mysql2/promise');

    await db.crearBaseDeDatosTenant('tenant_prueba');

    expect(mysql.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'app', password: 'claveAppNormal' })
    );
  });
});
