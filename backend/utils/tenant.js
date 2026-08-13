// Reglas de slug de tenant, compartidas entre el script de aprovisionamiento
// (backend/scripts/provisionar-tenant.js) y, a partir del segmento 3 del
// plan multi-tenant (middleware de resolución de tenant en server.js), el
// backend en tiempo de request — una sola definición evita que las dos
// partes del sistema acepten/rechacen slugs distintos entre sí.

// Mismas reglas que un subdominio DNS válido (minúsculas, números, guion,
// sin guion al inicio/final, máximo 50 caracteres): así el slug también
// sirve como nombre de base de datos (`tenant_<slug>`, dentro del límite de
// 64 caracteres de MySQL) sin necesitar una segunda validación de formato.
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

// Nombres de ruta que ya usa la aplicación (páginas estáticas, prefijos de
// API, archivos especiales de nginx) — un tenant con uno de estos slugs
// haría que su URL colisionara con una ruta existente.
const SLUGS_RESERVADOS = new Set([
  'admin', 'api', 'dashboard', 'tickets', 'login', 'csf', 'mantenimiento',
  'health', 'uploads', 'static', 'assets', 'control', 'www',
  'favicon.ico', 'robots.txt',
]);

const PREFIJO_DB_TENANT = 'tenant_';

// Devuelve null si el slug es válido, o un mensaje de error en español listo
// para mostrarse/registrarse si no lo es.
function validarSlug(slug) {
  if (typeof slug !== 'string' || !SLUG_REGEX.test(slug)) {
    return 'El slug debe ser minúsculas, números y guiones (1-50 caracteres), sin empezar ni terminar en guion.';
  }
  if (SLUGS_RESERVADOS.has(slug)) {
    return `"${slug}" es una ruta reservada de la aplicación y no puede usarse como slug de cliente.`;
  }
  return null;
}

function nombreDbTenant(slug) {
  return `${PREFIJO_DB_TENANT}${slug}`;
}

module.exports = { SLUG_REGEX, SLUGS_RESERVADOS, PREFIJO_DB_TENANT, validarSlug, nombreDbTenant };
