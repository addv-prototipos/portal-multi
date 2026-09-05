// Pruebas de utils/tenantIntake.js (segmento 9c, ver PROJECT_STATE.md) —
// captura de la solicitud de alta de empresa nueva desde /control, sin
// privilegios root de MySQL. Mismo patrón de mock que
// tenantLifecycle.test.js: se mockea `../../db` por completo — aquí solo
// interesa que este módulo valide, derive y arme el INSERT correcto, no
// el comportamiento real de MySQL.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const { crearTenantIntake, ErrorIntakeTenant } = require('../../utils/tenantIntake');

function mockPool() {
  const pool = { query: jest.fn() };
  obtenerPool.mockReturnValue(pool);
  return pool;
}

describe('utils/tenantIntake.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TENANT_DB_HOST;
    delete process.env.TENANT_DB_USER;
    delete process.env.CONTROL_DB_HOST;
  });

  describe('crearTenantIntake', () => {
    test('guarda la fila en estado "provisioning" con los valores derivados y registra el evento', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[]]) // SELECT de duplicado: no existe
        .mockResolvedValueOnce([{ insertId: 41 }]) // INSERT
        .mockResolvedValueOnce([{}]); // registrarEvento

      const resultado = await crearTenantIntake(
        {
          nombreEmpresa: '  Empresa Uno S.A. de C.V.  ',
          slug: 'Empresa-Uno',
          contactoEmail: 'CONTACTO@EMPRESAUNO.COM',
          notas: 'Cliente piloto',
          marca: '  Marca Uno  ',
        },
        { actor: 'admin' }
      );

      // SELECT de duplicado
      const [sqlSelect] = pool.query.mock.calls[0];
      expect(sqlSelect).toMatch(/SELECT id FROM tenants WHERE slug = \?/);
      expect(pool.query.mock.calls[0][1]).toEqual(['empresa-uno']);

      // INSERT completo
      const [sqlInsert, paramsInsert] = pool.query.mock.calls[1];
      expect(sqlInsert).toMatch(/INSERT INTO tenants/);
      expect(sqlInsert).toMatch(/estado/);
      expect(sqlInsert).toMatch(/marca, marca_logo_url/);
      expect(paramsInsert).toContain('empresa-uno'); // slug normalizado
      expect(paramsInsert).toContain('Empresa Uno S.A. de C.V.'); // nombre recortado
      expect(paramsInsert).toContain('contacto@empresauno.com'); // email a minúsculas
      expect(paramsInsert).toContain('mysql'); // db_host por defecto (sin TENANT_DB_HOST)
      expect(paramsInsert).toContain('tenant_empresa-uno'); // db_name derivado
      expect(paramsInsert).toContain('app'); // db_user por defecto
      expect(paramsInsert).toContain('empresa-uno'); // storage_prefix = slug
      expect(paramsInsert).toContain('Marca Uno'); // marca recortada

      // Evento de auditoría
      const [sqlEvento] = pool.query.mock.calls[2];
      expect(sqlEvento).toMatch(/INSERT INTO tenant_eventos/);
      expect(pool.query.mock.calls[2][1]).toEqual([
        41,
        'alta_solicitada',
        expect.stringContaining('slug=empresa-uno db=tenant_empresa-uno'),
        'admin',
        expect.any(Date),
      ]);

      expect(resultado).toMatchObject({
        id: 41,
        slug: 'empresa-uno',
        nombre_empresa: 'Empresa Uno S.A. de C.V.',
        estado: 'provisioning',
        db_name: 'tenant_empresa-uno',
        marca: 'Marca Uno',
      });
    });

    test('la marca vacía se guarda como null y la ruta del logo se valida', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 2 }])
        .mockResolvedValueOnce([{}]);

      const resultado = await crearTenantIntake(
        {
          nombreEmpresa: 'X',
          slug: 'empresa',
          contactoEmail: 'contacto@empresa.com',
          marca: '   ',
          marcaLoGoUrl: 'http://sitio-malicioso.com/logo.png',
        },
        { actor: 'admin' }
      );

      const paramsInsert = pool.query.mock.calls[1][1];
      // marca vacía -> null; URL que no empieza con /api/marca-logo/ -> null
      expect(paramsInsert).toContain(null);
      expect(resultado.marca).toBeNull();
      expect(resultado.marca_logo_url).toBeNull();
    });

    test('la ruta del logo generada por el servidor sí se guarda', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 3 }])
        .mockResolvedValueOnce([{}]);

      const resultado = await crearTenantIntake(
        {
          nombreEmpresa: 'X',
          slug: 'empresa',
          contactoEmail: 'contacto@empresa.com',
          marca: 'Marca X',
          marcaLoGoUrl: '/api/marca-logo/empresa',
        },
        { actor: 'admin' }
      );

      const paramsInsert = pool.query.mock.calls[1][1];
      expect(paramsInsert).toContain('/api/marca-logo/empresa');
      expect(resultado.marca_logo_url).toBe('/api/marca-logo/empresa');
    });

    test('TENANT_DB_HOST/TENANT_DB_USER sobreescriben la infra derivada', async () => {
      process.env.TENANT_DB_HOST = 'mysql-remoto.example.com';
      process.env.TENANT_DB_USER = 'tenant_user';
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([{}]);

      await crearTenantIntake(
        { nombreEmpresa: 'X', slug: 'x', contactoEmail: 'contacto@empresa.com' },
        { actor: 'admin' }
      );

      const paramsInsert = pool.query.mock.calls[1][1];
      expect(paramsInsert).toContain('mysql-remoto.example.com');
      expect(paramsInsert).toContain('tenant_user');
    });

    test('CONTROL_DB_HOST es el fallback de TENANT_DB_HOST', async () => {
      process.env.CONTROL_DB_HOST = 'control-mysql';
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 1 }])
        .mockResolvedValueOnce([{}]);

      await crearTenantIntake(
        { nombreEmpresa: 'X', slug: 'x', contactoEmail: 'contacto@empresa.com' },
        { actor: 'admin' }
      );

      expect(pool.query.mock.calls[1][1]).toContain('control-mysql');
    });

    test('sin nombre de empresa -> ErrorIntakeTenant de validación', async () => {
      const pool = mockPool();
      const error = await crearTenantIntake({ slug: 'empresa' }, { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorIntakeTenant);
      expect(error.codigo).toBe('validacion');
      expect(pool.query).not.toHaveBeenCalled(); // no toca la BD
    });

    test('slug inválido -> ErrorIntakeTenant de validación', async () => {
      const error = await crearTenantIntake(
        { nombreEmpresa: 'X', slug: 'Admin', contactoEmail: 'contacto@empresa.com' },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorIntakeTenant);
      expect(error.codigo).toBe('validacion');
      expect(error.message).toMatch(/reservada/); // "Admin" normaliza a "admin"
    });

    test('slug que ya existe -> ErrorIntakeTenant "slug_existe"', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[{ id: 9 }]]);

      const error = await crearTenantIntake(
        { nombreEmpresa: 'X', slug: 'cliente1', contactoEmail: 'contacto@empresa.com' },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorIntakeTenant);
      expect(error.codigo).toBe('slug_existe');
      expect(pool.query).toHaveBeenCalledTimes(1); // solo el SELECT, sin INSERT
    });

    // Punto 170: el correo de contacto pasa de opcional a obligatorio.
    test('sin correo de contacto -> ErrorIntakeTenant de validación', async () => {
      const pool = mockPool();
      const error = await crearTenantIntake({ nombreEmpresa: 'X', slug: 'empresa' }, { actor: 'admin' }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorIntakeTenant);
      expect(error.codigo).toBe('validacion');
      expect(error.message).toMatch(/correo de contacto/);
      expect(pool.query).not.toHaveBeenCalled(); // no toca la BD
    });

    test('correo de contacto inválido -> ErrorIntakeTenant de validación', async () => {
      const error = await crearTenantIntake({ nombreEmpresa: 'X', slug: 'empresa', contactoEmail: 'no-es-correo' }, {}).catch(
        (e) => e
      );

      expect(error).toBeInstanceOf(ErrorIntakeTenant);
      expect(error.codigo).toBe('validacion');
      expect(error.message).toMatch(/correo/);
    });

    test('colisión de carrera en el INSERT (ER_DUP_ENTRY) -> "slug_existe"', async () => {
      const pool = mockPool();
      const errDuplicado = new Error('Duplicate entry');
      errDuplicado.code = 'ER_DUP_ENTRY';
      pool.query
        .mockResolvedValueOnce([[]]) // SELECT: no existía aún
        .mockRejectedValueOnce(errDuplicado); // INSERT: otro proceso ganó la carrera

      const error = await crearTenantIntake(
        { nombreEmpresa: 'X', slug: 'empresa', contactoEmail: 'contacto@empresa.com' },
        {}
      ).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorIntakeTenant);
      expect(error.codigo).toBe('slug_existe');
    });

    test('un error de BD que no es duplicado se propaga tal cual', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]).mockRejectedValueOnce(new Error('conexión perdida'));

      const error = await crearTenantIntake(
        { nombreEmpresa: 'X', slug: 'empresa', contactoEmail: 'contacto@empresa.com' },
        {}
      ).catch((e) => e);

      expect(error).not.toBeInstanceOf(ErrorIntakeTenant);
      expect(error.message).toBe('conexión perdida');
    });
  });
});