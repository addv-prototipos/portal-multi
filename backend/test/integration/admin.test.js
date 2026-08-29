const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

const { pool } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const app = require('../../server');

// requireAdminAuth prueba, en orden, ADMIN_USERS -> cuenta de respaldo
// "admin" en MySQL -> usuarios con perfil administrador/fiscal en MySQL.
// Para probar un perfil específico (fiscal/administrador) se usa un
// nombre de usuario distinto de "admin" para saltar directo a la 3ra
// capa (una sola consulta a pool.query), con un hash real verificable.
function mockUsuarioAdministrativo(perfil, { usuario = 'fiscal1', password = 'ClaveFiscal1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('Admin', () => {
  afterEach(() => {
    // Ver la nota en csf-publico.test.js: mockReset() (no clearAllMocks())
    // porque pool.query se encola por test y varias rutas de administración
    // tienen ramas que retornan antes de consumir todo lo encolado.
    pool.query.mockReset();
  });

  describe('GET /api/admin/login (verificación de credenciales)', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).get('/api/admin/login');
      expect(res.status).toBe(401);
    });

    test('credenciales admin:admin (ADMIN_USERS por defecto) autentican con perfil super', async () => {
      const res = await request(app).get('/api/admin/login').auth('admin', 'admin');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, usuario: 'admin', perfil: 'super' });
    });

    test('credenciales incorrectas responden 401', async () => {
      pool.query.mockResolvedValueOnce([[]]); // cuenta de respaldo: sin fila
      pool.query.mockResolvedValueOnce([[]]); // usuarios administrativos: sin fila
      const res = await request(app).get('/api/admin/login').auth('admin', 'incorrecta');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/config/smtp (requireAdminArea() sin perfiles = solo "super")', () => {
    test('perfil "fiscal" NO tiene acceso (403), aunque esté autenticado', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app).get('/api/admin/config/smtp').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('perfil "super" (admin:admin) sí tiene acceso', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfigSmtp -> sin configurar
      const res = await request(app).get('/api/admin/config/smtp').auth('admin', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.configurado).toBe(false);
    });
  });

  describe('GET/PUT /api/admin/config/global', () => {
    test('perfil "fiscal" puede leer la configuración global', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      const res = await request(app).get('/api/admin/config/global').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.iva_porcentaje).toBe(16);
    });

    test('perfil "fiscal" puede cambiar el IVA pero NO correo_reportes (403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app)
        .put('/api/admin/config/global')
        .auth(usuario, password)
        .send({ correo_reportes: 'reportes@x.com' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/correo de reportes/);
    });

    test('perfil "administrador" sí puede cambiar correo_reportes', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[]]); // setConfiguracionGlobal: getConfiguracionGlobal interno
      pool.query.mockResolvedValueOnce([{}]); // INSERT/UPDATE

      const res = await request(app)
        .put('/api/admin/config/global')
        .auth(usuario, password)
        .send({ correo_reportes: 'reportes@x.com' });

      expect(res.status).toBe(200);
      expect(res.body.correo_reportes).toBe('reportes@x.com');
    });

    test('valor inválido responde 400 con el mensaje de config.js', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal interno

      const res = await request(app)
        .put('/api/admin/config/global')
        .auth(usuario, password)
        .send({ iva_porcentaje: 500 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/entre 0 y 100/);
    });
  });

  describe('/api/admin/usuarios', () => {
    test('GET requiere perfil administrador (fiscal responde 403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app).get('/api/admin/usuarios').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('GET con perfil administrador lista los usuarios', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[{ id: 1, rfc: 'GOMJ800101ABC', perfil: 'cliente' }]]);

      const res = await request(app).get('/api/admin/usuarios').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    test('POST crea un cliente válido', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[]]); // sin rfc existente
      pool.query.mockResolvedValueOnce([{ insertId: 9 }]); // INSERT

      const res = await request(app)
        .post('/api/admin/usuarios')
        .auth(usuario, password)
        .send({
          perfil: 'cliente',
          rfc: 'GOMJ800101ABC',
          telefono: '5512345678',
          email: 'nuevo@x.com',
          password: 'Abcdefg1',
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
    });

    test('POST rechaza perfil inválido antes de tocar la base de datos', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });

      const res = await request(app)
        .post('/api/admin/usuarios')
        .auth(usuario, password)
        .send({ perfil: 'superadmin' });

      expect(res.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(1); // solo la autenticación, nada de la ruta en sí
    });

    test('DELETE impide que un administrador se elimine a sí mismo', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[{ rfc: 'admin1' }]]); // SELECT rfc: coincide con quien hace la petición

      const res = await request(app).delete('/api/admin/usuarios/1').auth(usuario, password);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no puedes eliminar tu propia cuenta/i);
    });

    test('DELETE elimina correctamente a otro usuario', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[{ rfc: 'OTRO000000XXX' }]]);
      pool.query.mockResolvedValueOnce([{}]); // DELETE

      const res = await request(app).delete('/api/admin/usuarios/2').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('/api/admin/reportes', () => {
    test('GET requiere perfil administrador (fiscal responde 403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app).get('/api/admin/reportes').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('GET lista los reportes ya generados', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[{ id: 1, tipo: 'manual' }]]);

      const res = await request(app).get('/api/admin/reportes').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.reportes).toHaveLength(1);
    });

    test('POST /enviar genera el reporte y responde ok aunque no haya correo configurado', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[]]); // tickets del mes
      pool.query.mockResolvedValueOnce([[]]); // ordenes del mes
      pool.query.mockResolvedValueOnce([[]]); // generarYEnviarReporte -> getConfiguracionGlobal (sin correo_reportes)
      pool.query.mockResolvedValueOnce([{ insertId: 5 }]); // guardarReporte: INSERT reportes

      const res = await request(app).post('/api/admin/reportes/enviar').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.reporteId).toBe(5);
      expect(res.body.correoEnviado).toBe(false);
    });

    test('DELETE responde 404 si el reporte no existe', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const res = await request(app).delete('/api/admin/reportes/999').auth(usuario, password);

      expect(res.status).toBe(404);
    });

    test('DELETE elimina correctamente un reporte existente', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const res = await request(app).delete('/api/admin/reportes/1').auth(usuario, password);

      expect(res.status).toBe(200);
      expect(res.body.eliminado).toBe(true);
    });

    test('GET /:id/items?tipo_registro=gasto SÍ filtra (punto 158: whitelist incluye gasto)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[{ id: 1, tipo_registro: 'gasto' }]]);

      const res = await request(app)
        .get('/api/admin/reportes/3/items?tipo_registro=gasto')
        .auth(usuario, password);

      expect(res.status).toBe(200);
      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('FROM reporte_items'));
      expect(llamadaItems[0]).toMatch(/AND tipo_registro = \?/);
      expect(llamadaItems[1]).toContain('gasto');
    });

    test('GET /timeline/gasto/:identificador acepta "gasto" (punto 158)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .get('/api/admin/reportes/timeline/gasto/G-000007')
        .auth(usuario, password);

      expect(res.status).toBe(200);
    });
  });

  describe('/api/admin/config/smtp/prueba', () => {
    test('requiere destinatario válido antes de intentar enviar', async () => {
      const res = await request(app)
        .post('/api/admin/config/smtp/prueba')
        .auth('admin', 'admin')
        .send({ destinatario: 'no-es-correo', asunto: 'a', cuerpo: 'b' });

      expect(res.status).toBe(400);
    });

    test('responde 502 si el envío falla (SMTP no configurado)', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfigSmtp -> null (sin configurar)

      const res = await request(app)
        .post('/api/admin/config/smtp/prueba')
        .auth('admin', 'admin')
        .send({ destinatario: 'cliente@x.com', asunto: 'Prueba', cuerpo: 'Cuerpo de prueba' });

      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/no está configurado/);
    });
  });
});
