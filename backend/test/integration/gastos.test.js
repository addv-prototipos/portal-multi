const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

// El módulo "Gastos" usa MinIO para los comprobantes (carpeta
// 'comprobantes'), igual que tickets/constancias — se mockea
// backend/utils/storage.js igual que en csf-publico.test.js.
jest.mock('../../utils/storage', () => ({
  PREFIJO_DEFECTO: '_default',
  prefijoTenant: jest.fn(() => '_default'),
  guardarArchivo: jest.fn().mockResolvedValue(undefined),
  existeArchivo: jest.fn().mockResolvedValue(true),
  eliminarArchivo: jest.fn().mockResolvedValue(undefined),
  enviarArchivoARespuesta: jest.fn((prefijo, carpeta, nombreArchivo, res) => {
    res.end(Buffer.from('contenido-simulado'));
    return Promise.resolve();
  }),
}));

const { pool } = require('../../db');
const { hashPassword } = require('../../utils/authUsuario');
const storage = require('../../utils/storage');
const app = require('../../server');

// Firma binaria real de PDF (%PDF) — suficiente para pasar la verificación
// de magic number de validate.js sin necesitar un PDF completo.
const PDF_BUFFER_VALIDO = Buffer.from('%PDF-1.4\ncontenido de prueba, no es un PDF real completo');
// Firma binaria real de ZIP ("PK\x03\x04", archivo local).
const ZIP_BUFFER_VALIDO = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

// Misma técnica que admin.test.js: se usa un usuario de perfil concreto
// (no "admin") para saltar directo a la 3ra capa de requireAdminAuth —
// una sola consulta a pool.query con un hash real verificable.
function mockUsuarioAdministrativo(perfil, { usuario = 'admin1', password = 'ClaveAdmin1' } = {}) {
  pool.query.mockResolvedValueOnce([[{ rfc: usuario, password_hash: hashPassword(password), perfil }]]);
  return { usuario, password };
}

describe('Admin: Gastos', () => {
  afterEach(() => {
    // mockReset() (no clearAllMocks()) porque pool.query se encola por test
    // y varias rutas tienen ramas que retornan antes de consumir todo lo
    // encolado (ver la nota en csf-publico.test.js). utils/storage solo se
    // limpia el historial (mockClear), su implementación por defecto se
    // conserva para todo el archivo.
    pool.query.mockReset();
    pool.getConnection.mockReset();
    storage.eliminarArchivo.mockClear();
    storage.guardarArchivo.mockClear();
  });

  describe('GET /api/admin/gastos', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).get('/api/admin/gastos');
      expect(res.status).toBe(401);
    });

    test('perfil "fiscal" no tiene acceso (403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal', { usuario: 'fiscal1' });
      const res = await request(app).get('/api/admin/gastos').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('lista gastos activos con resumen de KPIs (perfil administrador)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ total: 1 }]]); // COUNT
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            fecha: '2026-08-19',
            concepto: 'Renta del local',
            proveedor: null,
            categoria: 'renta',
            monto: '1000.00',
            iva_incluido: 1,
            tiene_factura: 1,
            recurrente: 1,
            notas: null,
            creado_por: 'admin1',
            eliminado_en: null,
            comprobante_nombre_original: 'factura.pdf',
            comprobante_nombre_guardado: 'abc.pdf',
            comprobante_mime: 'application/pdf',
            creado_en: '2026-08-19 12:00:00',
            actualizado_en: '2026-08-19 12:00:00',
          },
        ],
      ]); // filas
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([
        [{ mes_actual: '1000', con_factura: '1000', sin_factura: '0', mes_anterior: '500', cantidad: 1 }],
      ]); // resumen

      const res = await request(app).get('/api/admin/gastos').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.gastos[0]).toMatchObject({
        concepto: 'Renta del local',
        categoria: 'renta',
        monto: 1000,
        iva_incluido: true,
        tiene_factura: true,
        recurrente: true,
        comprobante_nombre_original: 'factura.pdf',
      });
      expect(res.body.resumen).toEqual({
        mes_actual: 1000,
        con_factura: 1000,
        sin_factura: 0,
        mes_anterior: 500,
        cantidad: 1,
      });
    });

    test('los filtros viajan a la consulta (categoría, factura, recurrente)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ total: 0 }]]); // COUNT
      pool.query.mockResolvedValueOnce([[]]); // filas
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      pool.query.mockResolvedValueOnce([
        [{ mes_actual: '0', con_factura: '0', sin_factura: '0', mes_anterior: '0', cantidad: 0 }],
      ]); // resumen

      const res = await request(app)
        .get('/api/admin/gastos?categoria=renta&tiene_factura=1&recurrente=1')
        .auth(usuario, password);
      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE 1=1 AND categoria = \? AND tiene_factura = \? AND recurrente = \? AND eliminado_en IS NULL/),
        ['renta', '1', '1']
      );
    });

    test('papelera=true no incluye resumen de KPIs', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ total: 0 }]]); // COUNT
      pool.query.mockResolvedValueOnce([[]]); // filas
      const res = await request(app).get('/api/admin/gastos?papelera=true').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.resumen).toBeNull();
    });
  });

  describe('POST /api/admin/gastos', () => {
    test('registra un gasto válido', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // categoriaGastoExiste
      pool.query.mockResolvedValueOnce([{ insertId: 42, affectedRows: 1 }]); // INSERT
      const res = await request(app)
        .post('/api/admin/gastos')
        .auth(usuario, password)
        .send({
          fecha: '2026-08-19',
          concepto: 'Renta del local',
          proveedor: 'Inmobiliaria X',
          categoria: 'renta',
          monto: 1500,
          iva_incluido: true,
          tiene_factura: true,
          recurrente: true,
          notas: 'Con factura del mes',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(42);
    });

    test('fecha inválida responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/gastos')
        .auth(usuario, password)
        .send({ fecha: '19/08/2026', concepto: 'Renta', categoria: 'renta', monto: 1500 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/fecha/);
    });

    test('concepto vacío responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/gastos')
        .auth(usuario, password)
        .send({ fecha: '2026-08-19', concepto: '   ', categoria: 'renta', monto: 1500 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/concepto/);
    });

    test('categoría fuera de la lista cerrada responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // categoriaGastoExiste: no existe
      const res = await request(app)
        .post('/api/admin/gastos')
        .auth(usuario, password)
        .send({ fecha: '2026-08-19', concepto: 'Renta', categoria: 'hackeada', monto: 1500 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/categoría/);
    });

    test('monto no numérico responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // categoriaGastoExiste
      const res = await request(app)
        .post('/api/admin/gastos')
        .auth(usuario, password)
        .send({ fecha: '2026-08-19', concepto: 'Renta', categoria: 'renta', monto: 'abc' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/monto/);
    });
  });

  describe('PUT /api/admin/gastos/:id', () => {
    test('actualiza un gasto existente', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            fecha: '2026-08-19',
            concepto: 'Viejo',
            proveedor: null,
            categoria: 'renta',
            monto: '100.00',
            iva_incluido: 0,
            tiene_factura: 0,
            recurrente: 0,
            notas: null,
            comprobante_nombre_original: null,
            comprobante_nombre_guardado: null,
            comprobante_mime: null,
          },
        ],
      ]); // SELECT gasto
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // categoriaGastoExiste
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
      const res = await request(app)
        .put('/api/admin/gastos/1')
        .auth(usuario, password)
        .send({ fecha: '2026-08-20', concepto: 'Nuevo', categoria: 'servicios', monto: 200, tiene_factura: false });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('cambiar a "sin factura" borra el comprobante del almacenamiento', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            fecha: '2026-08-19',
            concepto: 'X',
            proveedor: null,
            categoria: 'renta',
            monto: '100.00',
            iva_incluido: 0,
            tiene_factura: 1,
            recurrente: 0,
            notas: null,
            comprobante_nombre_original: 'factura.pdf',
            comprobante_nombre_guardado: 'abc.pdf',
            comprobante_mime: 'application/pdf',
          },
        ],
      ]); // SELECT gasto
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // categoriaGastoExiste
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
      const res = await request(app)
        .put('/api/admin/gastos/1')
        .auth(usuario, password)
        .send({ fecha: '2026-08-19', concepto: 'X', categoria: 'renta', monto: 100, tiene_factura: false });
      expect(res.status).toBe(200);
      expect(storage.eliminarArchivo).toHaveBeenCalledWith('_default', 'comprobantes', 'abc.pdf');
    });

    test('gasto inexistente responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // SELECT gasto: sin fila
      const res = await request(app)
        .put('/api/admin/gastos/999')
        .auth(usuario, password)
        .send({ fecha: '2026-08-19', concepto: 'X', categoria: 'renta', monto: 100, tiene_factura: false });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/gastos/:id (papelera)', () => {
    test('mueve el gasto a la papelera (borrado lógico)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 1, concepto: 'Renta' }]]); // SELECT gasto
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE eliminado_en
      const res = await request(app).delete('/api/admin/gastos/1').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/papelera/);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SET eliminado_en = ?'), expect.anything());
    });

    test('gasto inexistente responde 404', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[]]); // SELECT gasto: sin fila
      const res = await request(app).delete('/api/admin/gastos/999').auth(usuario, password);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/gastos/:id/restaurar', () => {
    test('restaura un gasto que estaba en la papelera', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([[{ id: 1, concepto: 'Renta' }]]); // SELECT en papelera
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE eliminado_en = NULL
      const res = await request(app).post('/api/admin/gastos/1/restaurar').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/restaurado/);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SET eliminado_en = NULL'), expect.anything());
    });
  });

  describe('DELETE /api/admin/gastos/:id/permanente', () => {
    test('elimina la fila y borra el comprobante del almacenamiento', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 1, concepto: 'Renta', comprobante_nombre_guardado: 'abc.pdf' }],
      ]); // SELECT en papelera
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE fila
      const res = await request(app).delete('/api/admin/gastos/1/permanente').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(storage.eliminarArchivo).toHaveBeenCalledWith('_default', 'comprobantes', 'abc.pdf');
    });
  });

  describe('POST /api/admin/gastos/:id/comprobante', () => {
    test('sube un comprobante PDF válido', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 1, tiene_factura: 1, comprobante_nombre_guardado: null }],
      ]); // SELECT gasto
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE comprobante
      const res = await request(app)
        .post('/api/admin/gastos/1/comprobante')
        .auth(usuario, password)
        .attach('comprobante', PDF_BUFFER_VALIDO, { filename: 'factura.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(storage.guardarArchivo).toHaveBeenCalled();
    });

    test('sube un comprobante ZIP válido (par PDF + XML de un CFDI)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 2, tiene_factura: 1, comprobante_nombre_guardado: null }],
      ]); // SELECT gasto
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE comprobante
      const res = await request(app)
        .post('/api/admin/gastos/2/comprobante')
        .auth(usuario, password)
        .attach('comprobante', ZIP_BUFFER_VALIDO, { filename: 'cfdi.zip', contentType: 'application/zip' });
      expect(res.status).toBe(200);
      expect(storage.guardarArchivo).toHaveBeenCalledWith(
        '_default',
        'comprobantes',
        expect.stringMatching(/\.zip$/),
        ZIP_BUFFER_VALIDO,
        'application/zip'
      );
    });

    test('rechaza contenido que no es PDF ni ZIP aunque la extensión diga .pdf', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      // La verificación de contenido binario pasa DESPUÉS del SELECT (existe
      // el gasto y tiene_factura = 1), así que esa consulta hay que encolarla.
      pool.query.mockResolvedValueOnce([
        [{ id: 1, tiene_factura: 1, comprobante_nombre_guardado: null }],
      ]); // SELECT gasto
      const res = await request(app)
        .post('/api/admin/gastos/1/comprobante')
        .auth(usuario, password)
        .attach('comprobante', Buffer.from('esto no es un pdf de verdad'), {
          filename: 'factura.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/contenido/);
    });

    test('rechaza extensión no permitida en el filtro de multer', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      const res = await request(app)
        .post('/api/admin/gastos/1/comprobante')
        .auth(usuario, password)
        .attach('comprobante', PDF_BUFFER_VALIDO, { filename: 'factura.exe', contentType: 'application/octet-stream' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/PDF|ZIP/);
    });
  });

  describe('GET /api/admin/gastos/:id/comprobante', () => {
    test('descarga el comprobante con su nombre original', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            comprobante_nombre_original: 'factura.pdf',
            comprobante_nombre_guardado: 'abc.pdf',
            comprobante_mime: 'application/pdf',
          },
        ],
      ]); // SELECT gasto
      const res = await request(app).get('/api/admin/gastos/1/comprobante').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toContain('factura.pdf');
      // Respuesta binaria: supertest la deja en res.body (Buffer), no en res.text.
      expect(res.body).toEqual(Buffer.from('contenido-simulado'));
    });

    test('gasto sin comprobante responde 409', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 1, comprobante_nombre_original: null, comprobante_nombre_guardado: null, comprobante_mime: null }],
      ]); // SELECT gasto
      const res = await request(app).get('/api/admin/gastos/1/comprobante').auth(usuario, password);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/comprobante/);
    });
  });

  describe('DELETE /api/admin/gastos/:id/comprobante', () => {
    test('quita el comprobante y limpia los campos', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador');
      pool.query.mockResolvedValueOnce([
        [{ id: 1, comprobante_nombre_guardado: 'abc.pdf' }],
      ]); // SELECT gasto
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE comprobante = NULL
      const res = await request(app).delete('/api/admin/gastos/1/comprobante').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(storage.eliminarArchivo).toHaveBeenCalledWith('_default', 'comprobantes', 'abc.pdf');
    });
  });
});