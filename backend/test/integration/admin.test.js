const request = require('supertest');
const zlib = require('zlib');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

// La subida de factura de un ticket usa MinIO (mismo criterio que
// gastos.test.js/csf-publico.test.js) — sin mockear, estas llamadas
// intentarían una conexión real.
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

// Construye un ZIP real (encabezado local + datos + directorio central +
// EOCD con offsets correctos) — mismo helper que
// test/unit/validate.test.js, duplicado aquí porque son contextos de
// prueba distintos (unit vs. integración con supertest).
function construirZipConArchivos(archivos) {
  const partesLocales = [];
  const entradasCentral = [];
  let offset = 0;

  archivos.forEach(({ nombre, contenido, comprimir }) => {
    const nombreBuf = Buffer.from(nombre, 'utf8');
    const datos = comprimir ? zlib.deflateRawSync(contenido) : contenido;
    const metodo = comprimir ? 8 : 0;

    const localHeader = Buffer.alloc(30);
    localHeader.write('PK\x03\x04', 0, 'binary');
    localHeader.writeUInt16LE(metodo, 8);
    localHeader.writeUInt32LE(datos.length, 18);
    localHeader.writeUInt32LE(contenido.length, 22);
    localHeader.writeUInt16LE(nombreBuf.length, 26);

    const localOffset = offset;
    const entradaLocal = Buffer.concat([localHeader, nombreBuf, datos]);
    partesLocales.push(entradaLocal);
    offset += entradaLocal.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.write('PK\x01\x02', 0, 'binary');
    centralHeader.writeUInt16LE(metodo, 10);
    centralHeader.writeUInt32LE(datos.length, 20);
    centralHeader.writeUInt16LE(nombreBuf.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    entradasCentral.push(Buffer.concat([centralHeader, nombreBuf]));
  });

  const datosLocales = Buffer.concat(partesLocales);
  const central = Buffer.concat(entradasCentral);

  const eocd = Buffer.alloc(22);
  eocd.write('PK\x05\x06', 0, 'binary');
  eocd.writeUInt16LE(archivos.length, 10);
  eocd.writeUInt32LE(datosLocales.length, 16);

  return Buffer.concat([datosLocales, central, eocd]);
}

const PDF_FACTURA_BUFFER = Buffer.from('%PDF-1.4 contenido simulado de factura');

function zipFacturaConTotal(total) {
  const xml = Buffer.from(
    `<cfdi:Comprobante Version="4.0" SubTotal="0.00" Total="${total}"></cfdi:Comprobante>`,
    'utf8'
  );
  return construirZipConArchivos([
    { nombre: 'factura.pdf', contenido: PDF_FACTURA_BUFFER, comprimir: false },
    { nombre: 'factura.xml', contenido: xml, comprimir: true },
  ]);
}

function zipFacturaSinTotal() {
  const xml = Buffer.from('<cfdi:Comprobante Version="4.0"></cfdi:Comprobante>', 'utf8');
  return construirZipConArchivos([
    { nombre: 'factura.pdf', contenido: PDF_FACTURA_BUFFER, comprimir: false },
    { nombre: 'factura.xml', contenido: xml, comprimir: true },
  ]);
}

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
    storage.eliminarArchivo.mockClear();
    storage.guardarArchivo.mockClear();
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

  describe('GET /api/admin/tickets (Inicio del perfil administrador, 2026-09-04)', () => {
    test('perfil "fiscal" tiene acceso (200)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([[]]); // SELECT tickets
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
      const res = await request(app).get('/api/admin/tickets').auth(usuario, password);
      expect(res.status).toBe(200);
    });

    test('perfil "administrador" ahora también tiene acceso — Inicio le muestra el resumen de tickets', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[]]); // SELECT tickets
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal
      const res = await request(app).get('/api/admin/tickets').auth(usuario, password);
      expect(res.status).toBe(200);
    });

    test('perfil "ventas" sigue sin acceso (403) — Inicio/Tickets no son parte de su alcance', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
      const res = await request(app).get('/api/admin/tickets').auth(usuario, password);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/catalogo-clave-sat/buscar (autocompletar de Clave SAT, 2026-09-04)', () => {
    test('sin credenciales responde 401', async () => {
      const res = await request(app).get('/api/admin/catalogo-clave-sat/buscar?q=diseno');
      expect(res.status).toBe(401);
    });

    test('perfil "ventas" no tiene acceso (403) — no edita Configuraciones fiscales', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
      const res = await request(app).get('/api/admin/catalogo-clave-sat/buscar?q=diseno').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('perfil "fiscal" busca y recibe resultados', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([[{ clave: '81112501', descripcion: 'Servicios de diseño gráfico' }]]);
      const res = await request(app).get('/api/admin/catalogo-clave-sat/buscar?q=diseno').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.resultados).toEqual([{ clave: '81112501', descripcion: 'Servicios de diseño gráfico' }]);
    });

    test('perfil "administrador" también puede buscar', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/api/admin/catalogo-clave-sat/buscar?q=xyz').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.resultados).toEqual([]);
    });
  });

  describe('GET /api/admin/catalogo-clave-sat/info', () => {
    test('perfil "fiscal" ve que el catálogo sigue siendo el de ejemplo', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([[]]); // SELECT configuracion
      pool.query.mockResolvedValueOnce([[{ total: 10 }]]); // COUNT
      const res = await request(app).get('/api/admin/catalogo-clave-sat/info').auth(usuario, password);
      expect(res.status).toBe(200);
      expect(res.body.esEjemplo).toBe(true);
      expect(res.body.total).toBe(10);
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

    test('perfil "ventas" puede LEER la configuración global (punto 190, IVA/zona horaria para Registrar venta)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
      pool.query.mockResolvedValueOnce([[]]); // getConfiguracionGlobal -> defaults
      const res = await request(app).get('/api/admin/config/global').auth(usuario, password);
      expect(res.status).toBe(200);
    });

    test('perfil "ventas" NO puede ESCRIBIR la configuración global (403, punto 190)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
      const res = await request(app)
        .put('/api/admin/config/global')
        .auth(usuario, password)
        .send({ iva_porcentaje: 8 });
      expect(res.status).toBe(403);
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

  describe('PUT /api/admin/config/contacto-cliente (punto 186)', () => {
    test('perfil "fiscal" no tiene acceso (403), misma regla que correo_reportes', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app)
        .put('/api/admin/config/contacto-cliente')
        .auth(usuario, password)
        .send({ contacto_email: 'contacto@empresa.com' });

      expect(res.status).toBe(403);
    });

    test('sin contexto de tenant (sitio base) responde 400', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('administrador', { usuario: 'admin1' });
      const res = await request(app)
        .put('/api/admin/config/contacto-cliente')
        .auth(usuario, password)
        .send({ contacto_email: 'contacto@empresa.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/tenant/);
    });
  });

  describe('/api/admin/usuarios', () => {
    test('GET requiere perfil administrador (fiscal responde 403)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app).get('/api/admin/usuarios').auth(usuario, password);
      expect(res.status).toBe(403);
    });

    test('GET requiere perfil administrador (ventas responde 403, punto 190)', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('ventas', { usuario: 'ventas1' });
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

  describe('POST /api/admin/config/smtp/preview (punto 214)', () => {
    test('perfil "fiscal" NO tiene acceso (403), mismo gate que el resto de config/smtp', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      const res = await request(app)
        .post('/api/admin/config/smtp/preview')
        .auth(usuario, password)
        .send({ tipo: 'invitacion', texto: 'Hola' });
      expect(res.status).toBe(403);
    });

    test('tipo no reconocido responde 400', async () => {
      const res = await request(app)
        .post('/api/admin/config/smtp/preview')
        .auth('admin', 'admin')
        .send({ tipo: 'no-existe', texto: 'Hola' });
      expect(res.status).toBe(400);
    });

    test('tipo "invitacion" arma el HTML real con el texto capturado', async () => {
      const res = await request(app)
        .post('/api/admin/config/smtp/preview')
        .auth('admin', 'admin')
        .send({ tipo: 'invitacion', texto: 'Texto de prueba de la plantilla' });
      expect(res.status).toBe(200);
      expect(res.body.html).toContain('Texto de prueba de la plantilla');
      expect(res.body.html).toContain('Tu cuenta ya está lista');
    });

    test('sustituye variables de ejemplo en el texto (aviso al contador: {rfc}/{folio})', async () => {
      const res = await request(app)
        .post('/api/admin/config/smtp/preview')
        .auth('admin', 'admin')
        .send({ tipo: 'aviso_contador', texto: 'RFC: {rfc}, folio: {folio}' });
      expect(res.status).toBe(200);
      expect(res.body.html).toContain('RFC: XAXX010101000, folio: TK-000123');
    });

    test('escapa HTML del texto capturado (sin permitir inyectar markup)', async () => {
      const res = await request(app)
        .post('/api/admin/config/smtp/preview')
        .auth('admin', 'admin')
        .send({ tipo: 'reporte', texto: '<script>alert(1)</script>' });
      expect(res.status).toBe(200);
      expect(res.body.html).not.toContain('<script>');
      expect(res.body.html).toContain('&lt;script&gt;');
    });
  });

  describe('POST /api/admin/tickets/:id/factura (monto de la factura, negocios sin venta que verificar)', () => {
    test('con Total leíble en el XML, factura con monto_factura_origen "xml"', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([
        [{ id: 5, rfc: 'AAA010101AAA', folio: 'TK-000005', factura_nombre_guardado: null, orden_compra_id: null }],
      ]); // SELECT ticket
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE tickets

      const res = await request(app)
        .post('/api/admin/tickets/5/factura')
        .auth(usuario, password)
        .attach('factura', zipFacturaConTotal('16240.00'), 'factura.zip');

      expect(res.status).toBe(200);
      expect(res.body.monto_factura).toBe(16240);
      expect(res.body.monto_factura_origen).toBe('xml');

      const paramsUpdate = pool.query.mock.calls[2][1];
      expect(paramsUpdate).toContain(16240);
      expect(paramsUpdate).toContain('xml');
    });

    test('sin Total en el XML y sin monto manual, responde 400 FACTURA_MONTO_REQUERIDO', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([
        [{ id: 6, rfc: 'AAA010101AAA', folio: 'TK-000006', factura_nombre_guardado: null, orden_compra_id: null }],
      ]); // SELECT ticket

      const res = await request(app)
        .post('/api/admin/tickets/6/factura')
        .auth(usuario, password)
        .attach('factura', zipFacturaSinTotal(), 'factura.zip');

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('FACTURA_MONTO_REQUERIDO');
    });

    test('sin Total en el XML, con monto manual válido, factura con monto_factura_origen "manual"', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([
        [{ id: 7, rfc: 'AAA010101AAA', folio: 'TK-000007', factura_nombre_guardado: null, orden_compra_id: null }],
      ]); // SELECT ticket
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE tickets

      const res = await request(app)
        .post('/api/admin/tickets/7/factura')
        .auth(usuario, password)
        .field('montoFacturaManual', '5000.75')
        .attach('factura', zipFacturaSinTotal(), 'factura.zip');

      expect(res.status).toBe(200);
      expect(res.body.monto_factura).toBe(5000.75);
      expect(res.body.monto_factura_origen).toBe('manual');

      const paramsUpdate = pool.query.mock.calls[2][1];
      expect(paramsUpdate).toContain(5000.75);
      expect(paramsUpdate).toContain('manual');
    });

    test('monto manual en cero o negativo, sin Total en el XML, responde 400 FACTURA_MONTO_REQUERIDO', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([
        [{ id: 8, rfc: 'AAA010101AAA', folio: 'TK-000008', factura_nombre_guardado: null, orden_compra_id: null }],
      ]); // SELECT ticket

      const res = await request(app)
        .post('/api/admin/tickets/8/factura')
        .auth(usuario, password)
        .field('montoFacturaManual', '0')
        .attach('factura', zipFacturaSinTotal(), 'factura.zip');

      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('FACTURA_MONTO_REQUERIDO');
    });

    test('un monto manual capturado se IGNORA si el XML sí trae un Total real (no es "corregible")', async () => {
      const { usuario, password } = mockUsuarioAdministrativo('fiscal');
      pool.query.mockResolvedValueOnce([
        [{ id: 9, rfc: 'AAA010101AAA', folio: 'TK-000009', factura_nombre_guardado: null, orden_compra_id: null }],
      ]); // SELECT ticket
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE tickets

      const res = await request(app)
        .post('/api/admin/tickets/9/factura')
        .auth(usuario, password)
        .field('montoFacturaManual', '1.00')
        .attach('factura', zipFacturaConTotal('16240.00'), 'factura.zip');

      expect(res.status).toBe(200);
      expect(res.body.monto_factura).toBe(16240);
      expect(res.body.monto_factura_origen).toBe('xml');
    });
  });
});
