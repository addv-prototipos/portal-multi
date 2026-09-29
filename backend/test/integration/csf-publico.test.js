const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

// pdf-parse se mockea igual que en el unit test de pdfExtract.js: el
// parseo real de PDF ya se cubrió ahí a fondo — aquí solo importa que la
// ruta reaccione correctamente al texto que pdf-parse devuelva.
jest.mock('pdf-parse', () => jest.fn(), { virtual: true });

// Segmento 5 del plan multi-tenant (ver PROJECT_STATE.md): el
// almacenamiento de archivos se movió de disco local (fs) a MinIO — se
// mockea backend/utils/storage.js en vez de fs.
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
const { crearTokenSesion } = require('../../utils/authUsuario');
const app = require('../../server');

// Buffer con firma binaria real de PDF (%PDF) — suficiente para pasar la
// verificación de magic number de validate.js sin necesitar un PDF completo.
const PDF_BUFFER_VALIDO = Buffer.from('%PDF-1.4\ncontenido de prueba, no es un PDF real completo');

function mockTextoPdf(texto) {
  const pdfParse = require('pdf-parse');
  pdfParse.mockResolvedValueOnce({ text: texto });
}

const TEXTO_CONSTANCIA_VALIDA =
  'Registro Federal de Contribuyentes: GOMJ800101ABC\nJUAN PEREZ GOMEZ\n' +
  'Constancia de Situacion Fiscal\nCedula de Identificacion Fiscal';

describe('CSF público', () => {
  afterEach(() => {
    // mockReset() (no clearAllMocks()) específicamente en pool.query y
    // pdf-parse: son los dos mocks a los que cada test encola valores con
    // mockResolvedValueOnce/mockRejectedValueOnce condicionados a ramas que
    // a veces retornan antes de consumir todos los valores encolados —
    // clearAllMocks() limpia el historial de llamadas pero NO esas colas
    // pendientes, y un sobrante se filtra al siguiente test desalineando
    // sus respuestas (bug real encontrado así: un 409 esperado salía 200
    // porque el test anterior había dejado una cola sin consumir).
    // utils/storage (guardarArchivo/existeArchivo/etc.) NO se resetea
    // aquí a propósito: su mock tiene una implementación por defecto fija
    // para todo el archivo (ver jest.mock('../../utils/storage', ...)
    // arriba), no una cola por test — resetearlo la borraría y rompería
    // todos los tests por igual.
    pool.query.mockReset();
    pool.getConnection.mockReset();
    require('pdf-parse').mockReset();
  });

  describe('GET /api/config/campos-obligatorios', () => {
    test('devuelve los campos obligatorios más el estado de órdenes de compra', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal

      const res = await request(app).get('/api/config/campos-obligatorios');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tipo_persona', true);
      expect(res.body).toHaveProperty('ordenes_compra_habilitado', true);
    });
  });

  describe('GET /api/catalogos/uso-cfdi', () => {
    test('devuelve el catálogo (por defecto si no hay nada guardado)', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/catalogos/uso-cfdi');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.usos)).toBe(true);
      expect(res.body.usos.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/config/tickets-retencion', () => {
    test('devuelve null si no hay retención configurada', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/config/tickets-retencion');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ dias: null });
    });
  });

  describe('GET /api/registro/buscar', () => {
    test('responde 400 sin email ni rfc', async () => {
      const res = await request(app).get('/api/registro/buscar');
      expect(res.status).toBe(400);
    });

    test('responde 400 con email de formato inválido', async () => {
      const res = await request(app).get('/api/registro/buscar').query({ email: 'no-es-correo' });
      expect(res.status).toBe(400);
    });

    test('existe:false cuando no se encuentra ningún registro', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/registro/buscar').query({ rfc: 'GOMJ800101ABC' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ existe: false });
    });

    test('existe:true con el registro encontrado por rfc', async () => {
      const registro = { nombre: 'Juan', rfc: 'GOMJ800101ABC', email: 'juan@x.com' };
      pool.query.mockResolvedValueOnce([[registro]]);
      const res = await request(app).get('/api/registro/buscar').query({ rfc: 'GOMJ800101ABC' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ existe: true, registro });
    });
  });

  describe('GET /api/registro/:email', () => {
    test('responde 400 con correo inválido', async () => {
      const res = await request(app).get('/api/registro/no-es-un-correo');
      expect(res.status).toBe(400);
    });

    test('existe:false si no hay registro para ese correo', async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/registro/cliente@x.com');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ existe: false });
    });
  });

  describe('GET /api/registro/existe', () => {
    // Corregido: esta ruta se declara ahora ANTES que "/api/registro/:email"
    // en server.js (antes era código inalcanzable — ver historial de este
    // archivo/PROJECT_STATE.md para el diagnóstico original).
    test('sin sesión responde 401', async () => {
      const res = await request(app).get('/api/registro/existe');
      expect(res.status).toBe(401);
    });

    test('con sesión, informa si existe un registro para ese rfc', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
      const res = await request(app)
        .get('/api/registro/existe')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ existe: true });
    });
  });

  describe('POST /api/registro (subir constancia)', () => {
    // Auditoría UX 2026-09-29 / petición explícita del usuario: esta ruta
    // dejó de ser pública — ahora exige sesión (requireUserAuth), igual
    // que GET /api/registro/existe arriba. Cada test de aquí en adelante
    // manda una cookie de sesión válida.
    test('sin sesión responde 401', async () => {
      const res = await request(app)
        .post('/api/registro')
        .field('tipo_persona', 'fisica')
        .field('email', 'cliente@x.com')
        .attach('archivo', PDF_BUFFER_VALIDO, { filename: 'constancia.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(401);
    });

    test('responde 400 sin archivo adjunto', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios

      const res = await request(app)
        .post('/api/registro')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`)
        .field('tipo_persona', 'fisica')
        .field('email', 'cliente@x.com');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/adjuntar tu constancia/);
    });

    test('rechaza un archivo que no sea PDF (tipo declarado)', async () => {
      const res = await request(app)
        .post('/api/registro')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`)
        .field('email', 'cliente@x.com')
        .attach('archivo', Buffer.from('texto plano'), { filename: 'archivo.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/formato PDF/);
    });

    test('rechaza si falta tipo_persona (obligatorio por default)', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios

      const res = await request(app)
        .post('/api/registro')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`)
        .field('email', 'cliente@x.com')
        .attach('archivo', PDF_BUFFER_VALIDO, { filename: 'constancia.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Selecciona un tipo de persona/);
    });

    test('rechaza si el contenido no parece una constancia fiscal real', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios
      mockTextoPdf('un documento cualquiera sin relación con el SAT');

      const res = await request(app)
        .post('/api/registro')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`)
        .field('tipo_persona', 'fisica')
        .field('email', 'cliente@x.com')
        .attach('archivo', PDF_BUFFER_VALIDO, { filename: 'constancia.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no parece ser una Constancia/);
    });

    test('registra correctamente una constancia nueva (sin duplicado)', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios
      mockTextoPdf(TEXTO_CONSTANCIA_VALIDA);
      pool.query.mockResolvedValueOnce([[]]); // busca existente por email (el form no manda campo "rfc")
      pool.query.mockResolvedValueOnce([[]]); // busca en papelera por email
      pool.query.mockResolvedValueOnce([{ insertId: 1 }]); // INSERT

      const res = await request(app)
        .post('/api/registro')
        // RFC de la sesión debe coincidir con el de la constancia
        // (TEXTO_CONSTANCIA_VALIDA trae GOMJ800101ABC).
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`)
        .field('tipo_persona', 'fisica')
        .field('email', 'cliente@x.com')
        .attach('archivo', PDF_BUFFER_VALIDO, { filename: 'constancia.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/registrados correctamente/);
    });

    test('responde 409 DUPLICADO si ya existe y no se confirma el reemplazo', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios
      mockTextoPdf(TEXTO_CONSTANCIA_VALIDA);
      pool.query.mockResolvedValueOnce([[{ id: 5, email: 'cliente@x.com', archivo_nombre_guardado: 'viejo.pdf' }]]); // existente por email

      const res = await request(app)
        .post('/api/registro')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`)
        .field('tipo_persona', 'fisica')
        .field('email', 'cliente@x.com')
        .attach('archivo', PDF_BUFFER_VALIDO, { filename: 'constancia.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('DUPLICADO');
    });

    test('con confirmar_reemplazo:true, actualiza el registro existente', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios
      mockTextoPdf(TEXTO_CONSTANCIA_VALIDA);
      pool.query.mockResolvedValueOnce([[{ id: 5, email: 'cliente@x.com', archivo_nombre_guardado: 'viejo.pdf' }]]);
      pool.query.mockResolvedValueOnce([{}]); // UPDATE

      const res = await request(app)
        .post('/api/registro')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('GOMJ800101ABC')}`)
        .field('tipo_persona', 'fisica')
        .field('email', 'cliente@x.com')
        .field('confirmar_reemplazo', 'true')
        .attach('archivo', PDF_BUFFER_VALIDO, { filename: 'constancia.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(res.body.mensaje).toMatch(/actualizados correctamente/);
      expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE registros'), expect.any(Array));
    });

    test('rechaza si el RFC de la constancia no coincide con el RFC de la sesión', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios
      // La constancia trae GOMJ800101ABC, pero la sesión es de otro RFC.
      mockTextoPdf(TEXTO_CONSTANCIA_VALIDA);

      const res = await request(app)
        .post('/api/registro')
        .set('Cookie', `sesion_usuario=${crearTokenSesion('OTRO000000XXX')}`)
        .field('tipo_persona', 'fisica')
        .field('email', 'cliente@x.com')
        .attach('archivo', PDF_BUFFER_VALIDO, { filename: 'constancia.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no coincide con el RFC de tu cuenta/);
    });
  });
});
