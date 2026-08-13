// Reglas de slug de tenant — duplicado de backend/utils/tenant.js
// (segmento 9c, ver PROJECT_STATE.md). control/ es un contexto de build
// de Docker completamente aparte de backend/ y no puede importarlo en
// producción, así que esta pequeña regla se duplica en vez de compartirse
// (mismo principio ya usado para otras piezas chicas movidas al segmento
// 9b). Si cambia en backend/utils/tenant.js, cambiar aquí también.

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

const SLUGS_RESERVADOS = new Set([
  'admin', 'api', 'dashboard', 'tickets', 'login', 'csf', 'mantenimiento',
  'health', 'uploads', 'static', 'assets', 'control', 'www',
  'favicon.ico', 'robots.txt',
]);

const PREFIJO_DB_TENANT = 'tenant_';

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
