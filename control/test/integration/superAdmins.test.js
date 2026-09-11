// Punto 247 — CRUD de "Super Admins" (ADMIN_USERS) desde /control.
// Solo se mockean las partes de adminEnv.js que tocan disco/red
// (leerAdminUsersDeEnv/guardarAdminUsersEnEnv/notificarBackendRecarga) —
// parsearAdminUsers/validarUsuario/validarPassword corren REALES, para
// que estas pruebas cubran también sus reglas. `recargarAdminUsers` (real,
// de control/utils/auth.js) se restaura a "admin:admin" después de cada
// prueba para no filtrar estado entre tests (mismo módulo en memoria).
// El ciclo end-to-end real (contra Docker + backend) se validó por HTTP,
// ver PROJECT_STATE.md punto 247 — incluye el bug real de EACCES/EBUSY
// encontrado y corregido en el bind mount de .env, que ningún mock puede
// reproducir.

const request = require('supertest');

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/notificarBackend', () => ({
  notificarInvalidacionCache: jest.fn().mockResolvedValue(undefined),
  activarTenantFisico: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock('../../utils/adminEnv', () => ({
  ...jest.requireActual('../../utils/adminEnv'),
  leerAdminUsersDeEnv: jest.fn(),
  guardarAdminUsersEnEnv: jest.fn(),
  notificarBackendRecarga: jest.fn().mockResolvedValue(undefined),
  listarSuperAdmins: jest.fn(),
}));

const { obtenerPool } = require('../../db');
const adminEnv = require('../../utils/adminEnv');
const { recargarAdminUsers } = require('../../utils/auth');
const app = require('../../server');

describe('Control: Super Admins (ADMIN_USERS en .env, punto 247)', () => {
  beforeEach(() => {
    obtenerPool.mockReturnValue({ query: jest.fn() });
    jest.clearAllMocks();
    adminEnv.notificarBackendRecarga.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Nunca dejar "contaminado" el Map en memoria de requireAdminAuth para
    // el resto de la suite — mismo criterio de aislamiento que el resto
    // de los tests de este archivo.
    recargarAdminUsers('admin:admin');
  });

  describe('GET /api/control/super-admins', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).get('/api/control/super-admins');
      expect(res.status).toBe(401);
    });

    test('con admin:admin devuelve la lista real (mockeada)', async () => {
      adminEnv.listarSuperAdmins.mockReturnValue(['admin', 'otro']);
      const res = await request(app).get('/api/control/super-admins').auth('admin', 'admin');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ superAdmins: ['admin', 'otro'] });
    });
  });

  describe('POST /api/control/super-admins', () => {
    test('usuario inválido responde 400 (validarUsuario real)', async () => {
      const res = await request(app)
        .post('/api/control/super-admins')
        .auth('admin', 'admin')
        .send({ usuario: 'ab', password: 'ClaveValida9' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/mínimo 3 caracteres/);
    });

    test('contraseña inválida responde 400 (validarPassword real)', async () => {
      const res = await request(app)
        .post('/api/control/super-admins')
        .auth('admin', 'admin')
        .send({ usuario: 'nuevo_super', password: '123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/mínimo 6 caracteres/);
    });

    test('usuario ya existente responde 409', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'admin:admin,otro:pass' });
      const res = await request(app)
        .post('/api/control/super-admins')
        .auth('admin', 'admin')
        .send({ usuario: 'otro', password: 'ClaveValida9' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Ese usuario super ya existe.');
      expect(adminEnv.guardarAdminUsersEnEnv).not.toHaveBeenCalled();
    });

    test('alta exitosa guarda en .env, recarga en memoria y notifica al backend', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'admin:admin' });
      adminEnv.guardarAdminUsersEnEnv.mockReturnValue({ envPath: '/x/.env' });

      const res = await request(app)
        .post('/api/control/super-admins')
        .auth('admin', 'admin')
        .send({ usuario: 'nuevo_super', password: 'ClaveValida9' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ ok: true, superAdmins: ['admin', 'nuevo_super'] });
      expect(adminEnv.guardarAdminUsersEnEnv).toHaveBeenCalledWith('admin:admin,nuevo_super:ClaveValida9');
      expect(adminEnv.notificarBackendRecarga).toHaveBeenCalledWith('admin:admin,nuevo_super:ClaveValida9');
    });

    test('si guardarAdminUsersEnEnv lanza (ej. EACCES/EBUSY reales), responde 500 con el mensaje', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'admin:admin' });
      adminEnv.guardarAdminUsersEnEnv.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const res = await request(app)
        .post('/api/control/super-admins')
        .auth('admin', 'admin')
        .send({ usuario: 'nuevo_super', password: 'ClaveValida9' });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/EACCES/);
    });
  });

  describe('PUT /api/control/super-admins/:usuario', () => {
    test('usuario inexistente responde 404', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'admin:admin' });
      const res = await request(app)
        .put('/api/control/super-admins/noexiste')
        .auth('admin', 'admin')
        .send({ password: 'ClaveNueva9' });
      expect(res.status).toBe(404);
    });

    test('cambia la contraseña, conserva los demás usuarios intactos', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'admin:admin,otro:viejo' });
      adminEnv.guardarAdminUsersEnEnv.mockReturnValue({ envPath: '/x/.env' });

      const res = await request(app)
        .put('/api/control/super-admins/otro')
        .auth('admin', 'admin')
        .send({ password: 'ClaveNueva9' });

      expect(res.status).toBe(200);
      expect(adminEnv.guardarAdminUsersEnEnv).toHaveBeenCalledWith('admin:admin,otro:ClaveNueva9');
    });
  });

  describe('DELETE /api/control/super-admins/:usuario', () => {
    test('usuario inexistente responde 404', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'admin:admin' });
      const res = await request(app).delete('/api/control/super-admins/noexiste').auth('admin', 'admin');
      expect(res.status).toBe(404);
    });

    test('no permite eliminar la propia cuenta autenticada', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'admin:admin,otro:pass' });
      const res = await request(app).delete('/api/control/super-admins/admin').auth('admin', 'admin');
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/propia cuenta/);
    });

    test('no permite dejar el .env sin ningún super admin', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'otro:pass' });
      const res = await request(app).delete('/api/control/super-admins/otro').auth('admin', 'admin');
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/al menos un super admin/);
    });

    test('elimina un usuario distinto al propio, conservando al menos uno', async () => {
      adminEnv.leerAdminUsersDeEnv.mockReturnValue({ valor: 'admin:admin,otro:pass' });
      adminEnv.guardarAdminUsersEnEnv.mockReturnValue({ envPath: '/x/.env' });

      const res = await request(app).delete('/api/control/super-admins/otro').auth('admin', 'admin');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, superAdmins: ['admin'] });
      expect(adminEnv.guardarAdminUsersEnEnv).toHaveBeenCalledWith('admin:admin');
    });
  });
});
