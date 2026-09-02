// Pruebas de integración de GET /api/tema/:slug (segmento "Look & Feel",
// ver PROJECT_STATE.md punto 105): endpoint público que el frontend
// consume en el <head> de todas las páginas para pintar las CSS variables
// del tema del tenant. Siempre 200 con el tema (o vacío si no hay) —
// sin distinguir por código entre tenant sin tema e inexistente.

const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
  obtenerPoolControl: jest.fn(),
  obtenerPoolTenant: jest.fn(() => ({ query: jest.fn(), getConnection: jest.fn() })),
  ejecutarComoTenant: jest.fn((tenantPool, fn) => fn()),
  cerrarTodosLosPoolsTenant: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('../../utils/storage', () => ({
  PREFIJO_DEFECTO: '_default',
  prefijoTenant: jest.fn(() => '_default'),
  guardarArchivo: jest.fn().mockResolvedValue('marca/cliente1/logo'),
  existeArchivo: jest.fn().mockResolvedValue(true),
  eliminarArchivo: jest.fn().mockResolvedValue(undefined),
  copiarPrefijo: jest.fn().mockResolvedValue(2),
  contarObjetosPrefijo: jest.fn().mockResolvedValue(2),
  copiarArchivo: jest.fn().mockResolvedValue('marca/cliente2/logo'),
  eliminarPrefijo: jest.fn().mockResolvedValue(2),
  enviarArchivoARespuesta: jest.fn((prefijo, carpeta, nombreArchivo, res) => {
    res.end(Buffer.from('contenido-simulado'));
    return Promise.resolve();
  }),
  obtenerArchivo: jest.fn().mockResolvedValue({
    stream: require('stream').Readable.from(Buffer.from('contenido-simulado')),
    contentType: 'image/png',
  }),
}));

const { obtenerPoolControl } = require('../../db');
const { invalidarCacheTenant } = require('../../utils/tenantContext');
const app = require('../../server');

function mockControlPool(filas) {
  const poolControl = { query: jest.fn().mockResolvedValue([filas]) };
  obtenerPoolControl.mockReturnValue(poolControl);
  return poolControl;
}

const TENANT_SIN_TEMA = {
  id: 1,
  slug: 'cliente1',
  nombre_empresa: 'Cliente Uno S.A.',
  estado: 'activo',
  db_host: 'mysql',
  db_name: 'tenant_cliente1',
  db_user: 'app',
  marca: null,
  marca_logo_url: null,
  tema_json: null,
};

const TENANT_CON_TEMA = {
  ...TENANT_SIN_TEMA,
  marca: 'Cliente Uno',
  marca_logo_url: '/api/marca-logo/cliente1',
  tema_json: JSON.stringify({
    colores: { accent: '#0F6E5D', ink: '#21261F' },
    tipografia: { display: 'lora', cuerpo: 'open-sans' },
    radio: 'lg',
    faviconUrl: '/api/favicon/cliente1',
  }),
};

describe('GET /api/tema/:slug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidarCacheTenant();
  });

  test('slug inválido responde 404', async () => {
    const res = await request(app).get('/api/tema/NO_VALIDO!');
    expect(res.status).toBe(404);
  });

  test('tenant sin tema responde 200 con tema vacío (diseño base ADDV)', async () => {
    mockControlPool([TENANT_SIN_TEMA]);

    const res = await request(app).get('/api/tema/cliente1');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=300');
    expect(res.body).toEqual({
      slug: 'cliente1',
      marca: null,
      marcaLoGoUrl: null,
      tema: null,
      variables: {},
      fuentesGoogle: [],
      tieneAclaraciones: false,
    });
  });

  test('tenant con contacto_email expone tieneAclaraciones true (punto 170)', async () => {
    mockControlPool([{ ...TENANT_SIN_TEMA, contacto_email: 'contacto@cliente1.com' }]);

    const res = await request(app).get('/api/tema/cliente1');

    expect(res.status).toBe(200);
    expect(res.body.tieneAclaraciones).toBe(true);
  });

  test('tenant con tema responde tema normalizado + variables + fuentes', async () => {
    mockControlPool([TENANT_CON_TEMA]);

    const res = await request(app).get('/api/tema/cliente1');

    console.log('DEBUG JUNTOS:', JSON.stringify(res.body), '|KEYS|', JSON.stringify(Object.keys(res.body)));
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('cliente1');
    expect(res.body.marca).toBe('Cliente Uno');
    expect(res.body.marcaLoGoUrl).toBe('/api/marca-logo/cliente1');
    expect(res.body.tema.colores.accent).toBe('#0f6e5d');
    expect(res.body.tema.faviconUrl).toBe('/api/favicon/cliente1');
    // Tipografía congelada a Inter (2026-08-24)
    expect(res.body.variables['--color-accent']).toBe('#0f6e5d');
    expect(res.body.variables['--font-display']).toContain('Inter');
    expect(res.body.variables['--font-body']).toContain('Inter');
    expect(res.body.variables['--radius-lg']).toBe('20px');
    expect(res.body.fuentesGoogle.length).toBe(2);
  });

  test('tenant inexistente responde 200 con tema vacío (sin enumerar)', async () => {
    mockControlPool([]);

    const res = await request(app).get('/api/tema/no-existe');

    expect(res.status).toBe(200);
    expect(res.body.tema).toBeNull();
    expect(res.body.variables).toEqual({});
  });

  test('tema_json corrupto se degrada al diseño base sin romper la respuesta', async () => {
    const logEspia = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockControlPool([{ ...TENANT_SIN_TEMA, tema_json: '{no es json' }]);

    const res = await request(app).get('/api/tema/cliente1');

    expect(res.status).toBe(200);
    expect(res.body.tema).toBeNull();
    logEspia.mockRestore();
  });
});