// Pruebas de integración de POST /api/aclaraciones (punto 170): burbuja
// "Solicitar aclaraciones" del portal de cliente. Sin persistencia en BD
// a propósito — el correo es el único registro — así que el endpoint
// espera el envío (a diferencia del resto de correos de la app, que son
// fire-and-forget porque ya tienen una fila en BD de respaldo).

const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
  obtenerPoolControl: jest.fn(),
  obtenerPoolTenant: jest.fn(() => ({ query: jest.fn(), getConnection: jest.fn() })),
  ejecutarComoTenant: jest.fn((tenantPool, fn) => fn()),
  cerrarTodosLosPoolsTenant: jest.fn(),
}));

const mockSendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

jest.mock('../../utils/storage', () => ({
  PREFIJO_DEFECTO: '_default',
  prefijoTenant: jest.fn(() => '_default'),
}));

const { pool, obtenerPoolControl } = require('../../db');
const { crearTokenSesion } = require('../../utils/authUsuario');
const { invalidarCacheTenant } = require('../../utils/tenantContext');
const app = require('../../server');

const RFC = 'GOMJ800101ABC';
const SLUG = 'cliente1';
const COOKIE = `sesion_usuario=${crearTokenSesion(RFC, SLUG)}`;

const TENANT_CON_CONTACTO = {
  id: 1,
  slug: SLUG,
  nombre_empresa: 'Cliente Uno S.A.',
  estado: 'activo',
  db_host: 'mysql',
  db_name: 'tenant_cliente1',
  db_user: 'app',
  marca: null,
  marca_logo_url: null,
  tema_json: null,
  grupo_sucursal_id: null,
  contacto_email: 'contacto@cliente1.com',
};

function mockControlPool(filas) {
  const poolControl = { query: jest.fn().mockResolvedValue([filas]) };
  obtenerPoolControl.mockReturnValue(poolControl);
  return poolControl;
}

function configGlobalDefault() {
  return [[]];
}

function smtpConfigurado() {
  return [[{ valor: JSON.stringify({ host: 'smtp.test.com', puerto: 587, usuario: 'a@test.com', password: 'x' }) }]];
}

describe('POST /api/aclaraciones', () => {
  beforeEach(() => {
    invalidarCacheTenant();
  });

  afterEach(() => {
    pool.query.mockReset();
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({});
  });

  test('sin sesión responde 401', async () => {
    mockControlPool([TENANT_CON_CONTACTO]);
    const res = await request(app).post('/api/aclaraciones').set('X-Tenant-Slug', SLUG);
    expect(res.status).toBe(401);
  });

  test('sin tenant resuelto (sitio base) y sin correo de contacto configurado responde 404', async () => {
    pool.query.mockResolvedValueOnce(configGlobalDefault()); // getConfiguracionGlobal (sitio base)
    const cookieSinTenant = `sesion_usuario=${crearTokenSesion(RFC, null)}`;
    const res = await request(app).post('/api/aclaraciones').set('Cookie', cookieSinTenant);
    expect(res.status).toBe(404);
  });

  test('sin tenant resuelto (sitio base) con correo de contacto configurado: envía y responde 200', async () => {
    pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ contacto_email_cliente: 'contacto@base.com' }) }]]); // getConfiguracionGlobal (destino, reusado también para logoUrlDelTenant)
    pool.query.mockResolvedValueOnce(smtpConfigurado()); // getConfigSmtp (dentro de enviarCorreo)
    const cookieSinTenant = `sesion_usuario=${crearTokenSesion(RFC, null)}`;

    const res = await request(app)
      .post('/api/aclaraciones')
      .set('Cookie', cookieSinTenant)
      .send({ nombre: 'Juan Pérez', telefono: '5512345678', detalle: 'Duda del sitio base.' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const correoEnviado = mockSendMail.mock.calls[0][0];
    expect(correoEnviado.to).toBe('contacto@base.com');
  });

  test('tenant sin correo de contacto configurado responde 404', async () => {
    mockControlPool([{ ...TENANT_CON_CONTACTO, contacto_email: null }]);

    const res = await request(app)
      .post('/api/aclaraciones')
      .set('X-Tenant-Slug', SLUG)
      .set('Cookie', COOKIE);

    expect(res.status).toBe(404);
  });

  test('faltando nombre/telefono/detalle responde 400', async () => {
    mockControlPool([TENANT_CON_CONTACTO]);

    const res = await request(app)
      .post('/api/aclaraciones')
      .set('X-Tenant-Slug', SLUG)
      .set('Cookie', COOKIE)
      .send({ nombre: '', telefono: '', detalle: '' });

    expect(res.status).toBe(400);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('datos válidos: envía el correo al contacto del tenant y responde con folio', async () => {
    mockControlPool([TENANT_CON_CONTACTO]);
    pool.query.mockResolvedValueOnce(configGlobalDefault()); // getConfiguracionGlobal
    pool.query.mockResolvedValueOnce(smtpConfigurado()); // getConfigSmtp (dentro de enviarCorreo)

    const res = await request(app)
      .post('/api/aclaraciones')
      .set('X-Tenant-Slug', SLUG)
      .set('Cookie', COOKIE)
      .send({ nombre: 'Juan Pérez', telefono: '5512345678', detalle: 'No me llegó mi factura de mayo.' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.numero).toContain(RFC);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const correoEnviado = mockSendMail.mock.calls[0][0];
    expect(correoEnviado.to).toBe('contacto@cliente1.com');
    expect(correoEnviado.subject).toContain(res.body.numero);
    expect(correoEnviado.html).toContain('Juan P');
    expect(correoEnviado.html).toContain('No me lleg');
  });

  test('el RFC de la solicitud es el de la sesión, nunca uno mandado en el body', async () => {
    mockControlPool([TENANT_CON_CONTACTO]);
    pool.query.mockResolvedValueOnce(configGlobalDefault());
    pool.query.mockResolvedValueOnce(smtpConfigurado());

    const res = await request(app)
      .post('/api/aclaraciones')
      .set('X-Tenant-Slug', SLUG)
      .set('Cookie', COOKIE)
      .send({ nombre: 'Ana', telefono: '5599998888', detalle: 'Duda', rfc: 'OTRO_RFC_FALSO' });

    expect(res.status).toBe(200);
    expect(res.body.numero).toContain(RFC);
    expect(res.body.numero).not.toContain('OTRO_RFC_FALSO');
    const correoEnviado = mockSendMail.mock.calls[0][0];
    expect(correoEnviado.html).toContain(RFC);
  });

  test('si el envío de correo falla, responde 500 y no revela un folio', async () => {
    mockControlPool([TENANT_CON_CONTACTO]);
    pool.query.mockResolvedValueOnce(configGlobalDefault());
    pool.query.mockResolvedValueOnce(smtpConfigurado());
    mockSendMail.mockRejectedValueOnce(new Error('SMTP caído'));
    const logEspia = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post('/api/aclaraciones')
      .set('X-Tenant-Slug', SLUG)
      .set('Cookie', COOKIE)
      .send({ nombre: 'Ana', telefono: '5599998888', detalle: 'Duda' });

    expect(res.status).toBe(500);
    expect(res.body.numero).toBeUndefined();
    logEspia.mockRestore();
  });
});

describe('GET /api/aclaraciones/disponible', () => {
  afterEach(() => {
    pool.query.mockReset();
  });

  test('sitio base sin correo de contacto: tieneAclaraciones false', async () => {
    pool.query.mockResolvedValueOnce(configGlobalDefault());
    const res = await request(app).get('/api/aclaraciones/disponible');
    expect(res.status).toBe(200);
    expect(res.body.tieneAclaraciones).toBe(false);
  });

  test('sitio base con correo de contacto configurado: tieneAclaraciones true', async () => {
    pool.query.mockResolvedValueOnce([[{ valor: JSON.stringify({ contacto_email_cliente: 'contacto@base.com' }) }]]);
    const res = await request(app).get('/api/aclaraciones/disponible');
    expect(res.status).toBe(200);
    expect(res.body.tieneAclaraciones).toBe(true);
  });

  test('con tenant resuelto: siempre false (ese camino usa /api/tema/:slug, no este)', async () => {
    mockControlPool([TENANT_CON_CONTACTO]);
    const res = await request(app).get('/api/aclaraciones/disponible').set('X-Tenant-Slug', SLUG);
    expect(res.status).toBe(200);
    expect(res.body.tieneAclaraciones).toBe(false);
  });
});
