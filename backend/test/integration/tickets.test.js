const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
  // Punto 347: solo las pruebas de cuota de disco mandan X-Tenant-Slug —
  // el resto de este archivo corre sin header (no-op), así que estos
  // mocks no afectan ninguna prueba existente.
  obtenerPoolControl: jest.fn(),
  obtenerPoolTenant: jest.fn(() => ({ query: jest.fn(), getConnection: jest.fn() })),
  ejecutarComoTenant: jest.fn((tenantPool, fn) => fn()),
  cerrarTodosLosPoolsTenant: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

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
    res.end(Buffer.from('contenido-simulado-de-factura'));
    return Promise.resolve();
  }),
}));

const { pool, obtenerPoolControl } = require('../../db');
const { invalidarCacheTenant } = require('../../utils/tenantContext');
const { crearTokenSesion } = require('../../utils/authUsuario');
const app = require('../../server');

const RFC = 'GOMJ800101ABC';
const COOKIE = `sesion_usuario=${crearTokenSesion(RFC)}`;

// Firma binaria real de JPEG (0xFF 0xD8 0xFF) — suficiente para pasar la
// verificación de magic number de validate.js sin necesitar una foto real.
const JPEG_BUFFER_VALIDO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

function configGlobalConOrdenesDeshabilitadas() {
  return [[{ valor: JSON.stringify({ ordenes_compra_habilitado: false }) }]];
}

// Cada test que llega hasta el INSERT exitoso dispara, sin esperarlo
// (fire-and-forget), notificarNuevoTicketAlContador -> getConfigSmtp() ->
// una consulta más a pool.query. No se espera en el handler, así que
// puede resolverse antes o después de que termine el test — encolarle
// una respuesta vacía evita que se quede sin mock (lo que la haría
// rechazar internamente) y que esa cola sin consumir se filtre al
// siguiente test.
function mockNotificacionContadorSinConfigurar() {
  pool.query.mockResolvedValueOnce([[]]);
}

describe('Tickets', () => {
  afterEach(() => {
    // mockReset() (no clearAllMocks()) por el mismo motivo documentado en
    // csf-publico.test.js: pool.query se encola por test con ramas
    // condicionales que a veces retornan antes de consumir todo lo
    // encolado, y clearAllMocks() no limpia esas colas pendientes.
    pool.query.mockReset();
  });

  describe('POST /api/tickets', () => {
    test('sin sesión responde 401', async () => {
      const res = await request(app).post('/api/tickets');
      expect(res.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('sin imagen adjunta responde 400', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // registro (constancia) existe
      pool.query.mockResolvedValueOnce(configGlobalConOrdenesDeshabilitadas());

      const res = await request(app).post('/api/tickets').set('Cookie', COOKIE);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/adjuntar una foto/);
    });

    test('rechaza un archivo que no sea imagen permitida (tipo declarado)', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', COOKIE)
        .attach('imagen', Buffer.from('no es una imagen'), { filename: 'x.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/JPG, PNG o WEBP/);
    });

    test('sin constancia de situación fiscal registrada, responde 400 con código SIN_CONSTANCIA', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[]]); // sin registro para este RFC

      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', COOKIE)
        .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('SIN_CONSTANCIA');
    });

    // Punto 347 (gobierno de funcionalidades): cuota de disco impuesta
    // desde /control. Única prueba de este describe que manda
    // X-Tenant-Slug — las demás corren sin tenant (sitio base), donde el
    // candado es no-op por diseño.
    describe('cuota de disco (punto 347)', () => {
      function tenantFilaConDisco(extra = {}) {
        return {
          id: 1,
          slug: 'norte',
          nombre_empresa: 'Norte S.A.',
          estado: 'activo',
          db_host: 'mysql',
          db_name: 'tenant_norte',
          db_user: 'app',
          marca: null,
          marca_logo_url: null,
          tema_json: null,
          grupo_sucursal_id: null,
          contacto_email: null,
          marca_lookfeel_habilitado: 1,
          max_usuarios: null,
          facturacion_habilitada: 1,
          portal_clientes_habilitado: 1,
          sucursales_habilitado: 0,
          disco_cuota_mb: 500,
          disco_bytes_usados_cache: null,
          ...extra,
        };
      }

      let poolControl;

      beforeEach(() => {
        poolControl = { query: jest.fn() };
        obtenerPoolControl.mockReturnValue(poolControl);
      });

      afterEach(() => {
        invalidarCacheTenant();
      });

      test('caché en/sobre la cuota: responde 413 DISCO_CUOTA_EXCEDIDA antes de buscar la constancia', async () => {
        poolControl.query.mockResolvedValueOnce([[tenantFilaConDisco({ disco_bytes_usados_cache: 500 * 1024 * 1024 })]]);
        const cookieTenant = `sesion_usuario=${crearTokenSesion(RFC, 'norte')}`;

        const res = await request(app)
          .post('/api/tickets')
          .set('X-Tenant-Slug', 'norte')
          .set('Cookie', cookieTenant)
          .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(413);
        expect(res.body.error).toBe('DISCO_CUOTA_EXCEDIDA');
        expect(pool.query).not.toHaveBeenCalled();
      });

      test('caché por debajo de la cuota: sigue el flujo normal, no bloquea', async () => {
        poolControl.query.mockResolvedValueOnce([[tenantFilaConDisco({ disco_bytes_usados_cache: 10 * 1024 * 1024 })]]);
        pool.query.mockResolvedValueOnce([[]]); // sin registro para este RFC (SIN_CONSTANCIA)
        const cookieTenant = `sesion_usuario=${crearTokenSesion(RFC, 'norte')}`;

        const res = await request(app)
          .post('/api/tickets')
          .set('X-Tenant-Slug', 'norte')
          .set('Cookie', cookieTenant)
          .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

        // Pasó el candado de cuota y llegó a la validación de constancia
        // (que sí rechaza, sin registro) — nunca 413.
        expect(res.status).toBe(400);
        expect(res.body.codigo).toBe('SIN_CONSTANCIA');
      });
    });

    test('con órdenes de compra deshabilitadas, sube el ticket sin pedir datos de compra', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // registro (constancia) existe
      pool.query.mockResolvedValueOnce(configGlobalConOrdenesDeshabilitadas());
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios
      pool.query.mockResolvedValueOnce([[]]); // getUsosCfdi
      pool.query.mockResolvedValueOnce([{ insertId: 7 }]); // INSERT tickets
      pool.query.mockResolvedValueOnce([{}]); // UPDATE folio
      mockNotificacionContadorSinConfigurar();

      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', COOKIE)
        .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.folio).toBe('TK-000007');
    });

    test('con órdenes de compra habilitadas (default), exige numero_compra/fecha/hora/total', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // registro (constancia) existe
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults (ordenes_compra_habilitado: true)

      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', COOKIE)
        .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/número de venta es obligatorio/);
    });

    test('con orden de compra no encontrada, responde con código COMPRA_NO_ENCONTRADA', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // registro existe
      pool.query.mockResolvedValueOnce([[]]); // config global defaults
      pool.query.mockResolvedValueOnce([[]]); // sin orden de compra coincidente

      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', COOKIE)
        .field('numero_compra', 'OC-000099')
        .field('fecha_compra', '24/jul/2026')
        .field('hora_compra', '09:30:45')
        .field('total_compra', '100.00')
        .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('COMPRA_NO_ENCONTRADA');
    });

    test('con orden de compra pendiente por cobrar, responde con código PAGO_PENDIENTE', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // registro existe
      pool.query.mockResolvedValueOnce([[]]); // config global defaults
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 55,
            numero_compra: 'OC-000099',
            fecha_compra: '2026-07-24 15:30:45', // UTC; America/Mexico_City (UTC-6) por defecto -> 09:30:45 local
            total: 100,
            estado_pago: 'pendiente',
          },
        ],
      ]); // orden de compra coincidente, sin liquidar

      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', COOKIE)
        .field('numero_compra', 'OC-000099')
        .field('fecha_compra', '24/jul/2026')
        .field('hora_compra', '09:30:45')
        .field('total_compra', '100.00')
        .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('PAGO_PENDIENTE');
      // No debe llegar a consultar si ya fue facturada ni a insertar el ticket.
      expect(pool.query).toHaveBeenCalledTimes(4);
    });

    // Bug real corregido (2026-09-02, punto 183): antes se buscaba un
    // ticket 'listo' en vivo — si la retención lo purgaba, la orden
    // "olvidaba" que ya se había facturado y dejaba re-facturar. Ahora
    // depende de `ordenes_compra.facturado_en` (hecho permanente).
    test('con orden de compra ya facturada (facturado_en fijo), responde COMPRA_YA_FACTURADA', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // registro existe
      pool.query.mockResolvedValueOnce([[]]); // config global defaults
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 57,
            numero_compra: 'OC-000101',
            fecha_compra: '2026-07-24 15:30:45',
            total: 100,
            estado_pago: 'pagada',
            facturado_en: '2026-07-25 10:00:00',
          },
        ],
      ]); // orden de compra coincidente, YA facturada antes

      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', COOKIE)
        .field('numero_compra', 'OC-000101')
        .field('fecha_compra', '24/jul/2026')
        .field('hora_compra', '09:30:45')
        .field('total_compra', '100.00')
        .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('COMPRA_YA_FACTURADA');
      // No debe consultar tickets en vivo ni insertar uno nuevo — la
      // respuesta sale del campo ya traído en la fila de la orden.
      expect(pool.query).toHaveBeenCalledTimes(4);
    });

    test('con orden de compra pagada, sigue aceptando el ticket (sin regresión)', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // registro existe
      pool.query.mockResolvedValueOnce([[]]); // config global defaults
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 56,
            numero_compra: 'OC-000100',
            fecha_compra: '2026-07-24 15:30:45', // UTC; America/Mexico_City (UTC-6) por defecto -> 09:30:45 local
            total: 100,
            estado_pago: 'pagada',
          },
        ],
      ]); // orden de compra coincidente, liquidada, sin facturado_en (no requiere query aparte, ver punto 183)
      pool.query.mockResolvedValueOnce([[]]); // getCamposObligatorios
      pool.query.mockResolvedValueOnce([[]]); // getUsosCfdi
      pool.query.mockResolvedValueOnce([{ insertId: 8 }]); // INSERT tickets
      pool.query.mockResolvedValueOnce([{}]); // UPDATE folio
      mockNotificacionContadorSinConfigurar();

      const res = await request(app)
        .post('/api/tickets')
        .set('Cookie', COOKIE)
        .field('numero_compra', 'OC-000100')
        .field('fecha_compra', '24/jul/2026')
        .field('hora_compra', '09:30:45')
        .field('total_compra', '100.00')
        .attach('imagen', JPEG_BUFFER_VALIDO, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.folio).toBe('TK-000008');
    });
  });

  describe('GET /api/tickets', () => {
    test('sin sesión responde 401', async () => {
      const res = await request(app).get('/api/tickets');
      expect(res.status).toBe(401);
    });

    test('devuelve solo los tickets del rfc de la sesión', async () => {
      const ticket = { id: 1, folio: 'TK-000001', estatus: 'pendiente' };
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[ticket]]);

      const res = await request(app).get('/api/tickets').set('Cookie', COOKIE);

      expect(res.status).toBe(200);
      expect(res.body.tickets).toEqual([ticket]);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE rfc = ?'), [RFC]);
    });
  });

  describe('GET /api/tickets/:id/factura', () => {
    test('sin sesión responde 401', async () => {
      const res = await request(app).get('/api/tickets/1/factura');
      expect(res.status).toBe(401);
    });

    test('id no numérico responde 400', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      const res = await request(app).get('/api/tickets/abc/factura').set('Cookie', COOKIE);
      expect(res.status).toBe(400);
    });

    test('ticket inexistente (o de otro rfc) responde 404', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/tickets/1/factura').set('Cookie', COOKIE);
      expect(res.status).toBe(404);
    });

    test('ticket sin factura lista responde 409', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([[{ id: 1, estatus: 'pendiente', factura_nombre_guardado: null }]]);
      const res = await request(app).get('/api/tickets/1/factura').set('Cookie', COOKIE);
      expect(res.status).toBe(409);
    });

    test('con factura lista, la transmite con las cabeceras correctas', async () => {
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal (requiereFacturacionActiva, sin tenant)
      pool.query.mockResolvedValueOnce([
        [
          {
            id: 1,
            estatus: 'listo',
            factura_nombre_guardado: 'factura.zip',
            factura_mime: 'application/zip',
            factura_nombre_original: 'Factura Original.zip',
            folio: 'TK-000001',
          },
        ],
      ]);

      const res = await request(app).get('/api/tickets/1/factura').set('Cookie', COOKIE);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.headers['content-disposition']).toContain('Factura Original.zip');
    });
  });
});
