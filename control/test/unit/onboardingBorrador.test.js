// Pruebas de utils/onboardingBorrador.js (Segmento A del onboarding
// público, 2026-10-13) — BD mockeada a mano, mismo patrón que
// planes.test.js/sucursales.test.js.

jest.mock('../../db', () => ({ obtenerPool: jest.fn() }));

const {
  ErrorOnboarding,
  crearBorrador,
  obtenerBorrador,
  actualizarBorrador,
  verificarSlugDisponible,
  hashPasswordAdmin,
  validarPasswordAdmin,
} = require('../../utils/onboardingBorrador');

function mockDb() {
  return { query: jest.fn() };
}

function filaBorrador(extra = {}) {
  return {
    token: 'tok123',
    plan_clave: 'controla',
    ciclo: 'mensual',
    nombre_empresa: null,
    slug: null,
    contacto_email: null,
    nombre_comercial: null,
    zona_horaria: 'America/Mexico_City',
    admin_email: null,
    admin_password_hash: null,
    paso_actual: 'plan',
    estado: 'activo',
    creado_en: new Date('2026-10-13'),
    actualizado_en: new Date('2026-10-13'),
    ...extra,
  };
}

describe('utils/onboardingBorrador.js (Segmento A)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('crearBorrador', () => {
    test('plan no reconocido: ErrorOnboarding validacion', async () => {
      const db = mockDb();
      await expect(crearBorrador({ planClave: 'inventado' }, db)).rejects.toMatchObject({
        name: 'ErrorOnboarding',
        codigo: 'validacion',
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    test('plan válido: inserta con ciclo mensual por defecto y regresa token', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);

      const resultado = await crearBorrador({ planClave: 'controla' }, db);

      expect(resultado.planClave).toBe('controla');
      expect(resultado.ciclo).toBe('mensual');
      expect(typeof resultado.token).toBe('string');
      expect(resultado.token.length).toBeGreaterThan(20);
      expect(db.query.mock.calls[0][0]).toMatch(/INSERT INTO onboarding_borradores/);
    });

    test('ciclo anual explícito se respeta', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([{ insertId: 1 }]);
      const resultado = await crearBorrador({ planClave: 'domina', ciclo: 'anual' }, db);
      expect(resultado.ciclo).toBe('anual');
    });
  });

  describe('obtenerBorrador', () => {
    test('token inexistente: ErrorOnboarding no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);
      await expect(obtenerBorrador('no-existe', db)).rejects.toMatchObject({
        name: 'ErrorOnboarding',
        codigo: 'no_encontrado',
      });
    });

    test('token válido: regresa el borrador sin admin_password_hash', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[filaBorrador({ admin_password_hash: 'salt:hash' })]]);
      const borrador = await obtenerBorrador('tok123', db);
      expect(borrador.token).toBe('tok123');
      expect(borrador.tieneContrasena).toBe(true);
      expect(borrador).not.toHaveProperty('adminPasswordHash');
      expect(borrador).not.toHaveProperty('admin_password_hash');
    });
  });

  describe('verificarSlugDisponible', () => {
    test('formato inválido: ErrorOnboarding validacion, no consulta la BD', async () => {
      const db = mockDb();
      await expect(verificarSlugDisponible('Slug Invalido', db)).rejects.toMatchObject({
        name: 'ErrorOnboarding',
        codigo: 'validacion',
      });
      expect(db.query).not.toHaveBeenCalled();
    });

    test('slug ya usado por un tenant: disponible=false', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 5 }]]);
      const disponible = await verificarSlugDisponible('mi-negocio', db);
      expect(disponible).toBe(false);
    });

    test('slug libre: disponible=true', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);
      const disponible = await verificarSlugDisponible('mi-negocio-nuevo', db);
      expect(disponible).toBe(true);
    });
  });

  describe('actualizarBorrador', () => {
    test('token inexistente: ErrorOnboarding no_encontrado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[]]);
      await expect(actualizarBorrador('no-existe', { nombreEmpresa: 'X' }, db)).rejects.toMatchObject({
        codigo: 'no_encontrado',
      });
    });

    test('nombreEmpresa vacío: ErrorOnboarding validacion', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]);
      await expect(actualizarBorrador('tok123', { nombreEmpresa: '   ' }, db)).rejects.toMatchObject({
        codigo: 'validacion',
      });
    });

    test('slug ya tomado por un tenant: ErrorOnboarding slug_tomado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // SELECT existencia del borrador
      db.query.mockResolvedValueOnce([[{ id: 9 }]]); // SELECT tenants WHERE slug = ?
      await expect(actualizarBorrador('tok123', { slug: 'ya-existe' }, db)).rejects.toMatchObject({
        codigo: 'slug_tomado',
      });
    });

    test('correo de contacto inválido: ErrorOnboarding validacion', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]);
      await expect(actualizarBorrador('tok123', { contactoEmail: 'no-es-correo' }, db)).rejects.toMatchObject({
        codigo: 'validacion',
      });
    });

    test('contraseña débil: ErrorOnboarding validacion, nunca llega a hashear', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]);
      await expect(actualizarBorrador('tok123', { adminPassword: 'abc' }, db)).rejects.toMatchObject({
        codigo: 'validacion',
      });
    });

    test('actualización válida: hace UPDATE y regresa el borrador recargado', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]); // existencia
      db.query.mockResolvedValueOnce([{}]); // UPDATE
      db.query.mockResolvedValueOnce([[filaBorrador({ nombre_empresa: 'Mi Negocio' })]]); // recarga

      const borrador = await actualizarBorrador('tok123', { nombreEmpresa: 'Mi Negocio' }, db);

      expect(db.query.mock.calls[1][0]).toMatch(/UPDATE onboarding_borradores SET/);
      expect(borrador.nombreEmpresa).toBe('Mi Negocio');
    });

    test('contraseña de admin: nunca guarda texto plano, solo el hash salt:hash', async () => {
      const db = mockDb();
      db.query.mockResolvedValueOnce([[{ id: 1 }]]);
      db.query.mockResolvedValueOnce([{}]);
      db.query.mockResolvedValueOnce([[filaBorrador({ admin_password_hash: 'salt:hash' })]]);

      await actualizarBorrador('tok123', { adminPassword: 'Abcdef12' }, db);

      const [, valoresUpdate] = db.query.mock.calls[1];
      const valorGuardado = valoresUpdate[valoresUpdate.length - 3];
      expect(valorGuardado).not.toBe('Abcdef12');
      expect(valorGuardado).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    });
  });

  describe('hashPasswordAdmin / validarPasswordAdmin', () => {
    test('hashPasswordAdmin produce formato salt:hash, distinto en cada llamada (salt aleatorio)', () => {
      const h1 = hashPasswordAdmin('Abcdef12');
      const h2 = hashPasswordAdmin('Abcdef12');
      expect(h1).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
      expect(h1).not.toBe(h2);
    });

    test('validarPasswordAdmin exige mínimo 8, número, minúscula y mayúscula', () => {
      expect(validarPasswordAdmin('abc')).toMatch(/al menos 8 caracteres/);
      expect(validarPasswordAdmin('abcdefgh')).toMatch(/al menos un número/);
      expect(validarPasswordAdmin('12345678')).toMatch(/letra minúscula/);
      expect(validarPasswordAdmin('abcdefg1')).toMatch(/letra mayúscula/);
      expect(validarPasswordAdmin('Abcdefg1')).toBeNull();
    });
  });
});
