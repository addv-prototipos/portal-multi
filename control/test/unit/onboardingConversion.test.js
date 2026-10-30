// Pruebas de utils/onboardingConversion.js (Segmento B del onboarding
// público, 13 oct 2026) — BD mockeada a mano, cada dependencia externa
// (intake, activación física, asignación de plan, creación del admin)
// mockeada por separado para probar la orquestación en aislamiento.

jest.mock('../../db', () => ({ obtenerPool: jest.fn() }));

// Cada dependencia se mockea como factory con jest.requireActual para
// conservar las clases de error REALES — onboardingConversion.js usa
// `instanceof ErrorIntakeTenant`/`ErrorTransicionTenant`/
// `ErrorActivacionFisica`, que solo funciona si el test lanza la MISMA
// clase que el código de producción importa (una clase reconstruida a
// mano en el test no pasaría ese `instanceof`).
jest.mock('../../utils/onboardingBorrador', () => {
  const real = jest.requireActual('../../utils/onboardingBorrador');
  return { obtenerBorradorInterno: jest.fn(), ErrorOnboarding: real.ErrorOnboarding };
});
jest.mock('../../utils/tenantIntake', () => {
  const real = jest.requireActual('../../utils/tenantIntake');
  return { crearTenantIntake: jest.fn(), ErrorIntakeTenant: real.ErrorIntakeTenant };
});
jest.mock('../../utils/tenantLifecycle', () => {
  const real = jest.requireActual('../../utils/tenantLifecycle');
  return {
    obtenerTenantPorSlug: jest.fn(),
    activarTenant: jest.fn(),
    ErrorTransicionTenant: real.ErrorTransicionTenant,
  };
});
jest.mock('../../utils/tenantEdicion', () => ({
  actualizarDatosTenant: jest.fn(),
}));
jest.mock('../../utils/notificarBackend', () => {
  const real = jest.requireActual('../../utils/notificarBackend');
  return { crearAdminInicialFisico: jest.fn(), ErrorActivacionFisica: real.ErrorActivacionFisica };
});

const { convertirBorrador } = require('../../utils/onboardingConversion');
const { obtenerBorradorInterno, ErrorOnboarding } = require('../../utils/onboardingBorrador');
const { crearTenantIntake, ErrorIntakeTenant } = require('../../utils/tenantIntake');
const { obtenerTenantPorSlug, activarTenant, ErrorTransicionTenant } = require('../../utils/tenantLifecycle');
const { actualizarDatosTenant } = require('../../utils/tenantEdicion');
const { crearAdminInicialFisico, ErrorActivacionFisica } = require('../../utils/notificarBackend');

function mockDb() {
  return { query: jest.fn() };
}

function filaBorradorCompleta(extra = {}) {
  return {
    token: 'tok123',
    plan_clave: 'controla',
    ciclo: 'mensual',
    nombre_empresa: 'Tacos El Buen Sabor',
    slug: 'tacos-el-buen-sabor',
    contacto_email: 'contacto@tacos.com',
    nombre_comercial: 'Tacos',
    zona_horaria: 'America/Mexico_City',
    admin_email: 'admin@tacos.com',
    admin_password_hash: 'abcd1234:ef567890',
    paso_actual: 'completado',
    estado: 'activo',
    ...extra,
  };
}

function filaTenant(extra = {}) {
  return { id: 1, slug: 'tacos-el-buen-sabor', estado: 'provisioning', plan_id: null, nombre_empresa: 'Tacos El Buen Sabor', contacto_email: 'contacto@tacos.com', ...extra };
}

describe('utils/onboardingConversion.js (Segmento B)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('borrador incompleto (sin admin): ErrorOnboarding validacion, no llama a crearTenantIntake', async () => {
    const db = mockDb();
    obtenerBorradorInterno.mockResolvedValueOnce(filaBorradorCompleta({ admin_password_hash: null }));

    await expect(convertirBorrador('tok123', { db })).rejects.toMatchObject({
      name: 'ErrorOnboarding',
      codigo: 'validacion',
    });
    expect(crearTenantIntake).not.toHaveBeenCalled();
  });

  test('flujo feliz completo: intake + activar + plan + admin + marca convertido', async () => {
    const db = mockDb();
    obtenerBorradorInterno.mockResolvedValueOnce(filaBorradorCompleta());
    obtenerTenantPorSlug.mockResolvedValueOnce(null); // no existe todavía
    crearTenantIntake.mockResolvedValueOnce(filaTenant({ estado: 'provisioning' }));
    activarTenant.mockResolvedValueOnce(filaTenant({ estado: 'activo', plan_id: null }));
    db.query.mockResolvedValueOnce([[{ id: 20, portal_clientes_habilitado: 1 }]]); // SELECT ... FROM planes WHERE nombre = 'CLARVO Controla'
    actualizarDatosTenant.mockResolvedValueOnce(filaTenant({ estado: 'activo', plan_id: 20 }));
    crearAdminInicialFisico.mockResolvedValueOnce({ ok: true });
    db.query.mockResolvedValueOnce([{}]); // UPDATE onboarding_borradores

    const resultado = await convertirBorrador('tok123', { db });

    expect(crearTenantIntake).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'tacos-el-buen-sabor', nombreEmpresa: 'Tacos El Buen Sabor' }),
      expect.objectContaining({ db })
    );
    expect(activarTenant).toHaveBeenCalledWith('tacos-el-buen-sabor', expect.anything(), db);
    expect(actualizarDatosTenant).toHaveBeenCalledWith(
      'tacos-el-buen-sabor',
      expect.objectContaining({ planId: 20 }),
      expect.anything()
    );
    expect(crearAdminInicialFisico).toHaveBeenCalledWith(
      'tacos-el-buen-sabor',
      expect.objectContaining({ email: 'admin@tacos.com', passwordHash: 'abcd1234:ef567890', nombreUsuario: 'ADMIN' })
    );
    expect(resultado).toEqual({
      slug: 'tacos-el-buen-sabor',
      urlAdmin: 'https://clarvo.mx/tacos-el-buen-sabor/admin',
      urlPortal: 'https://clarvo.mx/tacos-el-buen-sabor',
    });
    // Última llamada a db.query debe ser el UPDATE que marca convertido.
    const ultimaLlamada = db.query.mock.calls[db.query.mock.calls.length - 1];
    expect(ultimaLlamada[0]).toMatch(/UPDATE onboarding_borradores SET estado = 'convertido'/);
  });

  test('tenant ya existe y ya está activo (reintento): no vuelve a llamar crearTenantIntake ni activarTenant', async () => {
    const db = mockDb();
    obtenerBorradorInterno.mockResolvedValueOnce(filaBorradorCompleta());
    obtenerTenantPorSlug.mockResolvedValueOnce(filaTenant({ estado: 'activo', plan_id: 20 }));
    db.query.mockResolvedValueOnce([[{ id: 20 }]]);
    actualizarDatosTenant.mockResolvedValueOnce(filaTenant({ estado: 'activo', plan_id: 20 }));
    crearAdminInicialFisico.mockResolvedValueOnce({ ok: true, yaExistia: true });
    db.query.mockResolvedValueOnce([{}]);

    await convertirBorrador('tok123', { db });

    expect(crearTenantIntake).not.toHaveBeenCalled();
    expect(activarTenant).not.toHaveBeenCalled();
    expect(crearAdminInicialFisico).toHaveBeenCalled();
  });

  test('slug ya tomado por otro intake simultáneo pero el tenant sí existe al releer: continúa sin fallar', async () => {
    const db = mockDb();
    obtenerBorradorInterno.mockResolvedValueOnce(filaBorradorCompleta());
    obtenerTenantPorSlug
      .mockResolvedValueOnce(null) // primera lectura: no existe
      .mockResolvedValueOnce(filaTenant({ estado: 'activo', plan_id: 20 })); // releer tras colisión
    crearTenantIntake.mockRejectedValueOnce(new ErrorIntakeTenant('slug ya registrado', 'slug_existe'));
    db.query.mockResolvedValueOnce([[{ id: 20 }]]);
    crearAdminInicialFisico.mockResolvedValueOnce({ ok: true });
    db.query.mockResolvedValueOnce([{}]);

    const resultado = await convertirBorrador('tok123', { db });
    expect(resultado.slug).toBe('tacos-el-buen-sabor');
  });

  test('falla el aprovisionamiento físico: ErrorOnboarding codigo aprovisionamiento, nunca crea el admin', async () => {
    const db = mockDb();
    obtenerBorradorInterno.mockResolvedValueOnce(filaBorradorCompleta());
    obtenerTenantPorSlug.mockResolvedValueOnce(null);
    crearTenantIntake.mockResolvedValueOnce(filaTenant({ estado: 'provisioning' }));
    activarTenant.mockRejectedValueOnce(new ErrorTransicionTenant('No se pudo crear la base de datos.', 'error_fisico'));

    await expect(convertirBorrador('tok123', { db })).rejects.toMatchObject({
      name: 'ErrorOnboarding',
      codigo: 'aprovisionamiento',
    });
    expect(crearAdminInicialFisico).not.toHaveBeenCalled();
  });

  test('falla la creación del admin inicial: ErrorOnboarding codigo aprovisionamiento, el borrador no se marca convertido', async () => {
    const db = mockDb();
    obtenerBorradorInterno.mockResolvedValueOnce(filaBorradorCompleta());
    obtenerTenantPorSlug.mockResolvedValueOnce(filaTenant({ estado: 'activo', plan_id: 20 }));
    db.query.mockResolvedValueOnce([[{ id: 20 }]]);
    crearAdminInicialFisico.mockRejectedValueOnce(new ErrorActivacionFisica('No se pudo crear el usuario administrador.'));

    await expect(convertirBorrador('tok123', { db })).rejects.toMatchObject({
      name: 'ErrorOnboarding',
      codigo: 'aprovisionamiento',
    });
    // Ningún UPDATE de estado=convertido debió ejecutarse tras el fallo.
    expect(db.query.mock.calls.some(([sql]) => /estado = 'convertido'/.test(sql))).toBe(false);
  });

  test('falla la asignación de plan (best-effort): no interrumpe la conversión', async () => {
    const db = mockDb();
    obtenerBorradorInterno.mockResolvedValueOnce(filaBorradorCompleta());
    obtenerTenantPorSlug.mockResolvedValueOnce(null);
    crearTenantIntake.mockResolvedValueOnce(filaTenant({ estado: 'provisioning' }));
    activarTenant.mockResolvedValueOnce(filaTenant({ estado: 'activo', plan_id: null }));
    db.query.mockResolvedValueOnce([[{ id: 20 }]]);
    actualizarDatosTenant.mockRejectedValueOnce(new Error('fallo inesperado de BD'));
    crearAdminInicialFisico.mockResolvedValueOnce({ ok: true });
    db.query.mockResolvedValueOnce([{}]);

    const resultado = await convertirBorrador('tok123', { db });
    expect(resultado.slug).toBe('tacos-el-buen-sabor');
    expect(crearAdminInicialFisico).toHaveBeenCalled();
  });
});
