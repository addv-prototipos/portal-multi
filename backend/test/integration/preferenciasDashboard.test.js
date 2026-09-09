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

// Misma técnica que resumenFinanciero.test.js/gastos.test.js: perfil
// concreto salta directo a la 3ra capa de requireAdminAuth con una sola
// consulta.
function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('Admin: preferencias de dashboard (Modo dashboard, punto 119)', () => {
  afterEach(() => {
    pool.query.mockReset();
    pool.getConnection.mockReset();
  });

  test('sin credenciales responde 401 (GET y PUT)', async () => {
    const resGet = await request(app).get('/api/admin/preferencias-dashboard/resumen-financiero');
    expect(resGet.status).toBe(401);
    const resPut = await request(app)
      .put('/api/admin/preferencias-dashboard/resumen-financiero')
      .send({ layout: [] });
    expect(resPut.status).toBe(401);
  });

  test('perfil "fiscal" no tiene acceso (403)', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
    const res = await request(app)
      .get('/api/admin/preferencias-dashboard/resumen-financiero')
      .auth(usuario, password);
    expect(res.status).toBe(403);
  });

  test('vista desconocida responde 404', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    const res = await request(app)
      .get('/api/admin/preferencias-dashboard/vista-inexistente')
      .auth(usuario, password);
    expect(res.status).toBe(404);
  });

  test('GET sin preferencia guardada devuelve layout null', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([[]]); // sin filas en preferencias_dashboard

    const res = await request(app)
      .get('/api/admin/preferencias-dashboard/resumen-financiero')
      .auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ layout: null });
  });

  test('PUT guarda un layout válido y lo devuelve normalizado', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // INSERT ... ON DUPLICATE KEY UPDATE

    const layout = [
      { id: 'kpi-balance', span: 3 },
      { id: 'kpi-facturado', span: 3 },
      { id: 'utilidad', span: 12 },
      { id: 'proveedores', span: 6 },
    ];
    const res = await request(app)
      .put('/api/admin/preferencias-dashboard/resumen-financiero')
      .auth(usuario, password)
      .send({ layout });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, layout });
    // Se persistió como JSON serializado con la clave del usuario y vista.
    const llamadaInsert = pool.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO preferencias_dashboard'));
    expect(llamadaInsert).toBeDefined();
    const [sqlInsert, paramsInsert] = llamadaInsert;
    expect(paramsInsert[0]).toBe(usuario);
    expect(paramsInsert[1]).toBe('resumen-financiero');
    expect(JSON.parse(paramsInsert[2])).toEqual(layout);
  });

  test('PUT guarda un layout con "height" (resize vertical) y lo devuelve normalizado', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const layout = [
      { id: 'utilidad', span: 6, height: 320 },
      // Sin "height": se queda en alto automático, sigue siendo válido.
      { id: 'proveedores', span: 6 },
    ];
    const res = await request(app)
      .put('/api/admin/preferencias-dashboard/resumen-financiero')
      .auth(usuario, password)
      .send({ layout });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, layout });
  });

  test('PUT rechaza layouts inválidos con 400 (id desconocido, duplicado, span fuera de rango, height fuera de rango, no-array)', async () => {
    const casos = [
      [{ id: 'tarjeta-inventada', span: 6 }],
      [
        { id: 'utilidad', span: 12 },
        { id: 'utilidad', span: 6 },
      ],
      [{ id: 'utilidad', span: 2 }],
      [{ id: 'utilidad', span: 13 }],
      [{ id: 'utilidad', span: 6.5 }],
      [{ id: 'utilidad', span: 6, height: 100 }], // debajo de heightMin (160)
      [{ id: 'utilidad', span: 6, height: 1000 }], // arriba de heightMax (900)
      [{ id: 'utilidad', span: 6, height: 300.5 }],
      'no-soy-un-arreglo',
    ];
    for (const layout of casos) {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .put('/api/admin/preferencias-dashboard/resumen-financiero')
        .auth(usuario, password)
        .send({ layout });
      expect(res.status).toBe(400);
      // Nada debe haberse escrito a la BD.
      expect(pool.query.mock.calls.filter(([sql]) => sql.includes('preferencias_dashboard'))).toHaveLength(0);
    }
  });

  test('GET normaliza un layout viejo de la BD filtrando elementos fuera de la whitelist vigente', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([
      [
        {
          // mysql2 entrega columnas JSON ya parseadas; aquí viene una fila
          // "vieja" con un elemento que ya no existe en la vista.
          layout_json: [
            { id: 'utilidad', span: 12 },
            { id: 'elemento-eliminado', span: 6 },
          ],
        },
      ],
    ]);

    const res = await request(app)
      .get('/api/admin/preferencias-dashboard/resumen-financiero')
      .auth(usuario, password);

    expect(res.status).toBe(200);
    // El elemento desconocido invalida el layout completo (se rechaza en
    // bloque para que el frontend nunca aplique layouts a medias).
    expect(res.body).toEqual({ layout: null });
  });

  test('DELETE elimina la preferencia del usuario (volver al layout por defecto)', async () => {
    const { usuario, password } = mockUsuarioAdministrativo('administrador');
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .delete('/api/admin/preferencias-dashboard/resumen-financiero')
      .auth(usuario, password);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const llamadaDelete = pool.query.mock.calls.find(([sql]) => sql.includes('DELETE FROM preferencias_dashboard'));
    expect(llamadaDelete).toBeDefined();
    expect(llamadaDelete[1]).toEqual([usuario, 'resumen-financiero']);
  });
});
