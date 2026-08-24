const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Portal de Facturación ADDV — API',
    version: '1.0.0',
    description:
      'API del portal (backend). Todas las rutas bajo `/api` pasan por `frontend/nginx.conf.template` → `backend:4000`. ' +
      'Con tenant, prefijo `/<slug>/api/*` + `X-Tenant-Slug`. Autenticación: `Basic ADMIN_USERS` para `/api/admin/*` y `/api/control/*` (super-only), cookie `session` para cliente. Ver `backend/server.js` y `control/server.js` como fuente de verdad.',
  },
  servers: [
    { url: 'http://localhost:8088', description: 'Local (FRONTEND_PORT=8088)' },
    { url: 'http://192.168.68.75:8088', description: 'LAN (IP verificada 2026-08-24)' },
  ],
  components: {
    securitySchemes: {
      basicAuth: { type: 'http', scheme: 'basic' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'session' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Clave API por empresa (gestionada en /control → Credenciales API). También se puede enviar como ?api_key= o cookie api_key.' },
    },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' }, codigo: { type: 'string' } } },
      Health: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, maxFileSizeMb: { type: 'number' } } },
      OrdenCompra: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          numero_compra: { type: 'string', example: 'OC-000001' },
          fecha_compra: { type: 'string', example: '2026-08-24 10:00:00' },
          concepto: { type: 'string' },
          cantidad: { type: 'number' },
          iva_porcentaje: { type: 'number' },
          total: { type: 'number' },
          email: { type: 'string', nullable: true },
        },
      },
      Gasto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          fecha: { type: 'string', example: '2026-08-24' },
          concepto: { type: 'string' },
          categoria: { type: 'string' },
          monto: { type: 'number' },
          tiene_factura: { type: 'boolean' },
        },
      },
      Tenant: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          nombre_empresa: { type: 'string' },
          estado: { type: 'string', enum: ['provisioning', 'activo', 'suspendido', 'baja'] },
        },
      },
    },
  },
  tags: [
    { name: 'Health', description: 'Healthcheck de Docker' },
    { name: 'Auth cliente', description: 'Registro / login RFC' },
    { name: 'Constancias', description: 'CSF — PDF' },
    { name: 'Tickets', description: 'Tickets de cliente' },
    { name: 'Ventas', description: 'Ventas (ordenes_compra)' },
    { name: 'Gastos', description: 'Gastos operativos' },
    { name: 'Resumen financiero', description: 'KPIs y serie mensual' },
    { name: 'Reportes', description: 'Reportes MD / ledger' },
    { name: 'Admin', description: 'Panel admin' },
    { name: 'Control', description: 'App de control cross-tenant (super-only)' },
  ],
  paths: {
    '/api/health': { get: { tags: ['Health'], summary: 'Healthcheck', responses: { 200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } } } } } },
    '/api/registro': { post: { tags: ['Constancias'], summary: 'Subir constancia (multipart)', responses: { 200: { description: 'ok' } } } },
    '/api/auth/registro': { post: { tags: ['Auth cliente'], summary: 'Crear usuario cliente', responses: { 201: { description: 'creado' } } } },
    '/api/auth/login': { post: { tags: ['Auth cliente'], summary: 'Login cliente', responses: { 200: { description: 'ok' } } } },
    '/api/tickets': { post: { tags: ['Tickets'], summary: 'Subir ticket (imagen)', responses: { 201: { description: 'creado' } } }, get: { tags: ['Tickets'], summary: 'Listar tickets del cliente', responses: { 200: { description: 'ok' } } } },
    '/api/admin/registros': { get: { tags: ['Admin'], summary: 'Listar constancias', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } } },
    '/api/admin/tickets': { get: { tags: ['Admin'], summary: 'Listar tickets', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } } },
    '/api/admin/ordenes-compra': {
      get: { tags: ['Ventas'], summary: 'Listar ventas', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } },
      post: { tags: ['Ventas'], summary: 'Crear venta', security: [{ basicAuth: [] }], responses: { 201: { description: 'creado' } } },
    },
    '/api/admin/gastos': {
      get: { tags: ['Gastos'], summary: 'Listar gastos', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } },
      post: { tags: ['Gastos'], summary: 'Crear gasto', security: [{ basicAuth: [] }], responses: { 201: { description: 'creado' } } },
    },
    '/api/admin/resumen-financiero': { get: { tags: ['Resumen financiero'], summary: 'Resumen financiero (KPIs + serie)', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } } },
    '/api/admin/reportes/estadisticas': { get: { tags: ['Reportes'], summary: 'Estadísticas de reportes', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } } },
    '/api/control/tenants': {
      get: { tags: ['Control'], summary: 'Listar tenants (super-only)', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } },
      post: { tags: ['Control'], summary: 'Alta provisioning', security: [{ basicAuth: [] }], responses: { 201: { description: 'creado' } } },
    },
    '/api/docs': { get: { tags: ['Health'], summary: 'Swagger UI', responses: { 200: { description: 'html' } } } },
    '/api/docs.json': { get: { tags: ['Health'], summary: 'OpenAPI JSON', responses: { 200: { description: 'json' } } } },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: ['./server.js', './utils/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = { swaggerSpec, swaggerDefinition };
