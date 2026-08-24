const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

const { pool } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const app = require('../../server');

// Misma técnica que gastos.test.js/ordenes-compra.test.js: un usuario de
// perfil concreto salta directo a la 3ra capa de requireAdminAuth con una
// sola consulta a pool.query.
function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('Admin: Categorías de gastos (editables, ver PROJECT_STATE.md)', () => {
  afterEach(() => {
    pool.query.mockReset();
  });

  describe('GET /api/admin/gastos/categorias', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).get('/api/admin/gastos/categorias');
      expect(res.status).toBe(401);
    });

    test('perfil "fiscal" no tiene acceso (403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
      const res = await request(app).get('/api/admin/gastos/categorias').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('lista categorías con activa/protegida/tieneGastos normalizados a booleano', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [
          { id: 1, slug: 'renta', etiqueta: 'Renta', activa: 1, protegida: 0, tiene_gastos: 1 },
          { id: 10, slug: 'otro', etiqueta: 'Otro', activa: 1, protegida: 1, tiene_gastos: 0 },
        ],
      ]);
      const res = await request(app).get('/api/admin/gastos/categorias').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.categorias).toEqual([
        { id: 1, slug: 'renta', etiqueta: 'Renta', activa: true, protegida: false, tieneGastos: true },
        { id: 10, slug: 'otro', etiqueta: 'Otro', activa: true, protegida: true, tieneGastos: false },
      ]);
    });
  });

  describe('POST /api/admin/gastos/categorias', () => {
    test('etiqueta vacía responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/gastos/categorias')
        .auth(usuario, password)
        .send({ etiqueta: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/nombre/i);
    });

    test('crea una categoría nueva con su slug generado', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // categoriaGastoExiste('mantenimiento') -> no existe
      pool.query.mockResolvedValueOnce([{ insertId: 55, affectedRows: 1 }]); // INSERT
      const res = await request(app)
        .post('/api/admin/gastos/categorias')
        .auth(usuario, password)
        .send({ etiqueta: 'Mantenimiento' });
      expect(res.status).toBe(201);
      expect(res.body.categoria).toEqual({ id: 55, slug: 'mantenimiento', etiqueta: 'Mantenimiento' });
    });

    test('colisión de slug agrega un sufijo numérico automáticamente', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // 'cafe' ya existe
      pool.query.mockResolvedValueOnce([[]]); // 'cafe_2' libre
      pool.query.mockResolvedValueOnce([{ insertId: 56, affectedRows: 1 }]); // INSERT
      const res = await request(app)
        .post('/api/admin/gastos/categorias')
        .auth(usuario, password)
        .send({ etiqueta: 'Café' });
      expect(res.status).toBe(201);
      expect(res.body.categoria.slug).toBe('cafe_2');
    });
  });

  describe('PUT /api/admin/gastos/categorias/:id', () => {
    test('categoría no encontrada responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app)
        .put('/api/admin/gastos/categorias/999')
        .auth(usuario, password)
        .send({ etiqueta: 'Nueva etiqueta' });
      expect(res.status).toBe(404);
    });

    test('categoría protegida no se puede renombrar', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 10, protegida: 1 }]]);
      const res = await request(app)
        .put('/api/admin/gastos/categorias/10')
        .auth(usuario, password)
        .send({ etiqueta: 'Ya no es Otro' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/respaldo/i);
    });

    test('renombra una categoría existente sin cambiar su slug', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 6, protegida: 0 }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
      const res = await request(app)
        .put('/api/admin/gastos/categorias/6')
        .auth(usuario, password)
        .send({ etiqueta: 'Papelería y oficina' });
      expect(res.status).toBe(200);
      expect(res.body.categoria).toEqual({ id: 6, etiqueta: 'Papelería y oficina' });
    });
  });

  describe('DELETE /api/admin/gastos/categorias/:id', () => {
    test('categoría no encontrada responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).delete('/api/admin/gastos/categorias/999').auth(usuario, password);
      expect(res.status).toBe(404);
    });

    test('categoría protegida no se puede eliminar', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 10, protegida: 1, tiene_gastos: 0 }]]);
      const res = await request(app).delete('/api/admin/gastos/categorias/10').auth(usuario, password);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/respaldo/i);
    });

    test('con gastos asociados, solo se desactiva', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 1, protegida: 0, tiene_gastos: 1 }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE activa=0
      const res = await request(app).delete('/api/admin/gastos/categorias/1').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/desactivada/i);
      expect(pool.query).toHaveBeenLastCalledWith(expect.stringMatching(/UPDATE categorias_gastos SET activa = 0/), [
        expect.any(Date),
        1,
      ]);
    });

    test('sin gastos asociados, se elimina de verdad', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 7, protegida: 0, tiene_gastos: 0 }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE
      const res = await request(app).delete('/api/admin/gastos/categorias/7').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/eliminada/i);
      expect(pool.query).toHaveBeenLastCalledWith(expect.stringMatching(/DELETE FROM categorias_gastos/), [7]);
    });
  });

  describe('POST /api/admin/gastos/categorias/:id/reactivar', () => {
    test('categoría no encontrada responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).post('/api/admin/gastos/categorias/999/reactivar').auth(usuario, password);
      expect(res.status).toBe(404);
    });

    test('reactiva una categoría previamente desactivada', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 1, protegida: 0 }]]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE activa=1
      const res = await request(app).post('/api/admin/gastos/categorias/1/reactivar').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/reactivada/i);
      expect(pool.query).toHaveBeenLastCalledWith(expect.stringMatching(/UPDATE categorias_gastos SET activa = 1/), [
        expect.any(Date),
        1,
      ]);
    });
  });
});
