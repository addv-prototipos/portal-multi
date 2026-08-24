const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Portal ADDV — API Control (super-only)',
    version: '1.0.0',
    description: 'API de la app de control cross-tenant. Todo bajo `/api/control/*` vía `frontend/nginx.conf.template` → `control:4001`. Solo `ADMIN_USERS` super. Ver `control/server.js`.',
  },
  servers: [
    { url: 'http://localhost:8088', description: 'Local (FRONTEND_PORT=8088)' },
    { url: 'http://192.168.68.75:8088', description: 'LAN' },
  ],
  components: {
    securitySchemes: {
      basicAuth: { type: 'http', scheme: 'basic' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Clave API por empresa (generada en /control → Credenciales API). Autoriza uso de las APIs como esta clave API por empresa.' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'api_key' },
    },
    schemas: {
      Tenant: { type: 'object', properties: { slug: { type: 'string' }, nombre_empresa: { type: 'string' }, estado: { type: 'string', enum: ['provisioning', 'activo', 'suspendido', 'baja'] } } },
    },
  },
  tags: [{ name: 'Control', description: 'Tenants lifecycle, marca, tema' }],
  paths: {
    '/api/control/tenants': {
      get: { tags: ['Control'], summary: 'Listar tenants', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } },
      post: { tags: ['Control'], summary: 'Alta provisioning', security: [{ basicAuth: [] }], responses: { 201: { description: 'creado' } } },
    },
    '/api/control/tenants/{slug}': { put: { tags: ['Control'], summary: 'Editar tenant', security: [{ basicAuth: [] }], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'ok' } } } },
    '/api/control/tenants/{slug}/marca': { put: { tags: ['Control'], summary: 'Actualizar marca/logo', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } } },
    '/api/control/tenants/{slug}/tema': { put: { tags: ['Control'], summary: 'Actualizar tema/favicon', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } } },
    '/api/control/tenants/{slug}/credenciales': {
      get: { tags: ['Control'], summary: 'Listar credenciales API por empresa', security: [{ basicAuth: [] }], responses: { 200: { description: 'ok' } } },
      post: { tags: ['Control'], summary: 'Generar credencial API (para Swagger y consumo)', security: [{ basicAuth: [] }], responses: { 201: { description: 'creado' } } },
    },
    '/api/control/tenants/{slug}/credenciales/{id}/rotar': { post: { tags: ['Control'], summary: 'Rotar contraseña API', security: [{ basicAuth: [] }], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }, { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'ok' } } } },
    '/api/control/tenants/{slug}/credenciales/{id}': { delete: { tags: ['Control'], summary: 'Revocar credencial API', security: [{ basicAuth: [] }], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }, { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'ok' } } } },
    '/api/control/docs': { get: { tags: ['Control'], summary: 'Swagger UI Control', responses: { 200: { description: 'html' } } } },
  },
};

const swaggerSpec = swaggerJSDoc({ definition: swaggerDefinition, apis: ['./server.js'] });
module.exports = { swaggerSpec };
