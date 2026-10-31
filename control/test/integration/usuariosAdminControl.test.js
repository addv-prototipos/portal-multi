// Punto en curso: pestaña "Usuarios" del modal de edición de /control —
// reasignar la cuenta raíz/maestra de un tenant sin pedir acceso al
// tenant. Alcance mínimo a propósito (decisión del usuario): solo
// lectura de las cuentas perfil administrador + reasignar, nada de
// editar/suspender/eliminar desde aquí, eso sigue siendo exclusivo de
// /admin → Usuarios.
//
// Archivo APARTE de control.test.js a propósito: estas pruebas generan
// varias respuestas no-2xx (401/404/400/502), y `adminCredencialesLimiter`
// es un rate limiter GLOBAL sin prefijo de ruta que cuenta CUALQUIER
// respuesta no-2xx contra un presupuesto compartido de 50/IP/15min —
// reusar la `app` ya cargada de control.test.js agotaría ese presupuesto
// en silencio y tumbaría pruebas completamente ajenas más abajo en ese
// archivo (ver CLAUDE.md, gotcha ya documentado, y docsEnabled.test.js
// para el mismo patrón de aislamiento). Cada test carga su propia `app`
// fresca con jest.resetModules().

const request = require('supertest');

function mockearDependencias() {
  jest.mock('../../db', () => ({
    obtenerPool: jest.fn(),
  }));
  jest.mock('../../utils/notificarBackend', () => {
    const real = jest.requireActual('../../utils/notificarBackend');
    return {
      notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
      activarTenantFisico: jest.fn().mockResolvedValue({ ok: true, dbName: 'tenant_cliente1' }),
      eliminarTenantFisico: jest.fn().mockResolvedValue({ ok: true }),
      calcularUsoDiscoFisico: jest.fn().mockResolvedValue(734003200),
      aplicarLimiteUsuarios: jest.fn().mockResolvedValue([]),
      obtenerUsoUsuarios: jest.fn().mockResolvedValue(3),
      crearAdminInicialFisico: jest.fn().mockResolvedValue({ ok: true }),
      listarUsuariosAdminTenant: jest.fn().mockResolvedValue([]),
      reasignarRaizTenant: jest.fn().mockResolvedValue({ ok: true, mensaje: 'Cuenta raíz/maestra actualizada correctamente.' }),
      ErrorActivacionFisica: real.ErrorActivacionFisica,
      ErrorEliminacionFisica: real.ErrorEliminacionFisica,
      ErrorCalculoDisco: real.ErrorCalculoDisco,
      ErrorReasignarRaiz: real.ErrorReasignarRaiz,
    };
  });
  jest.mock('../../utils/ajustesGlobales', () => ({
    getImagenMaxMb: jest.fn().mockResolvedValue(2),
    setImagenMaxMb: jest.fn().mockResolvedValue(2),
  }));
}

describe('GET /api/control/tenants/:slug/usuarios-admin', () => {
  afterEach(() => {
    jest.resetModules();
  });

  // Timeout explícito (10000ms, no infra) — mismo motivo que
  // docsEnabled.test.js: require() en frío de server.js tras
  // jest.resetModules() ya era lento en baseline (~2.5s).
  test('401 sin credenciales', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { listarUsuariosAdminTenant } = require('../../utils/notificarBackend');

    const res = await request(app).get('/api/control/tenants/cliente1/usuarios-admin');
    expect(res.status).toBe(401);
    expect(listarUsuariosAdminTenant).not.toHaveBeenCalled();
  }, 10000);

  test('responde 200 con la lista de administradores del tenant', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { listarUsuariosAdminTenant } = require('../../utils/notificarBackend');
    listarUsuariosAdminTenant.mockResolvedValueOnce([
      { id: 1, rfc: 'ADMIN1', email: 'a@x.com', es_cuenta_raiz: 1, creado_en: '2026-10-01 10:00:00' },
    ]);

    const res = await request(app).get('/api/control/tenants/cliente1/usuarios-admin').auth('admin', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.usuarios).toHaveLength(1);
    expect(listarUsuariosAdminTenant).toHaveBeenCalledWith('cliente1');
  });

  test('si el backend no responde, 502 (nunca asume lista vacía)', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { listarUsuariosAdminTenant } = require('../../utils/notificarBackend');
    listarUsuariosAdminTenant.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/control/tenants/cliente1/usuarios-admin').auth('admin', 'admin');
    expect(res.status).toBe(502);
  });
});

describe('PUT /api/control/tenants/:slug/usuarios-admin/:id/raiz', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('401 sin credenciales', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { reasignarRaizTenant } = require('../../utils/notificarBackend');

    const res = await request(app).put('/api/control/tenants/cliente1/usuarios-admin/2/raiz');
    expect(res.status).toBe(401);
    expect(reasignarRaizTenant).not.toHaveBeenCalled();
  });

  test('reasigna correctamente', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { reasignarRaizTenant } = require('../../utils/notificarBackend');

    const res = await request(app).put('/api/control/tenants/cliente1/usuarios-admin/2/raiz').auth('admin', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(reasignarRaizTenant).toHaveBeenCalledWith('cliente1', '2');
  });

  test('usuario ya no existe en el tenant (404 del backend): responde 404, nunca 502', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { reasignarRaizTenant, ErrorReasignarRaiz } = require('../../utils/notificarBackend');
    reasignarRaizTenant.mockRejectedValueOnce(new ErrorReasignarRaiz('Usuario no encontrado.', 'no_encontrado'));

    const res = await request(app).put('/api/control/tenants/cliente1/usuarios-admin/99/raiz').auth('admin', 'admin');
    expect(res.status).toBe(404);
  });

  test('perfil distinto de administrador (400 del backend): responde 400', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { reasignarRaizTenant, ErrorReasignarRaiz } = require('../../utils/notificarBackend');
    reasignarRaizTenant.mockRejectedValueOnce(
      new ErrorReasignarRaiz('Solo una cuenta con perfil administrador puede ser la cuenta raíz/maestra.', 'validacion')
    );

    const res = await request(app).put('/api/control/tenants/cliente1/usuarios-admin/2/raiz').auth('admin', 'admin');
    expect(res.status).toBe(400);
  });

  test('si no se pudo conectar con el backend, responde 502', async () => {
    jest.resetModules();
    mockearDependencias();
    const app = require('../../server');
    const { reasignarRaizTenant, ErrorReasignarRaiz } = require('../../utils/notificarBackend');
    reasignarRaizTenant.mockRejectedValueOnce(new ErrorReasignarRaiz('No se pudo conectar con el backend.', 'backend'));

    const res = await request(app).put('/api/control/tenants/cliente1/usuarios-admin/2/raiz').auth('admin', 'admin');
    expect(res.status).toBe(502);
  });
});
