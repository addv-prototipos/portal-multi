// Middleware de resolución de tenant (segmento 3 del plan multi-tenant,
// ver PROJECT_STATE.md). Contrato acordado en el diseño: a partir del
// segmento 4, nginx reescribirá `/<slug>/api/*` → `/api/*` agregando el
// encabezado `X-Tenant-Slug: <slug>`; el backend nunca ve el prefijo en
// la URL, solo este encabezado.
//
// Mientras el segmento 4 no exista, NINGÚN tráfico real trae ese
// encabezado (nginx sigue sin tocarse) — así que este middleware, montado
// globalmente en server.js, es un no-op transparente para toda petición
// real de hoy: `if (!slugCrudo) return next();` es la primera línea.
// Queda completamente implementado y probado (con el encabezado puesto a
// mano, simulando lo que hará nginx) para no repetir este trabajo cuando
// se conecte de verdad.
const crypto = require('crypto');
const { obtenerPoolControl, obtenerPoolTenant, ejecutarComoTenant } = require('../db');
const { validarSlug } = require('./tenant');

// Anti-enumeración de tenants (segmento 7 del plan, ver PROJECT_STATE.md):
// sin esto, un slug inexistente respondería mucho más rápido que uno real
// que sigue adelante a verificar credenciales — un atacante podría usar
// esa diferencia de tiempo para enumerar qué slugs existen, sin necesitar
// ninguna otra información. Se paga un costo artificial equivalente al de
// un scrypt real (mismos parámetros que usa authUsuario.js) antes de
// responder 404, para que "tenant no existe" no sea distinguible por
// temporización de "tenant existe, la request sigue verificando algo más".
function costoArtificialComparable() {
  crypto.scryptSync('costo-artificial-anti-enumeracion', 'sal-artificial', 64);
}

const CACHE_TTL_MS = Number(process.env.TENANT_CACHE_TTL_MS || 45 * 1000);

// slug -> { tenant: fila|null, resueltoEn: number }
// TTL corto y consistencia eventual entre réplicas — decisión ya tomada en
// el plan (alternativa a un bus de invalidación tipo Redis/pub-sub, que no
// existe todavía en este stack): un tenant recién dado de alta puede
// tardar hasta CACHE_TTL_MS en ser visible en una réplica que ya tenía el
// slug en caché como "no encontrado" — aceptable para esta fase.
const cacheResolucion = new Map();

async function resolverTenantPorSlug(slug) {
  const enCache = cacheResolucion.get(slug);
  if (enCache && Date.now() - enCache.resueltoEn < CACHE_TTL_MS) {
    return enCache.tenant;
  }

  const [filas] = await obtenerPoolControl().query(
    `SELECT id, slug, nombre_empresa, estado, db_host, db_name, db_user, marca, marca_logo_url, tema_json, grupo_sucursal_id
     FROM tenants WHERE slug = ? AND estado = 'activo' LIMIT 1`,
    [slug]
  );
  const tenant = filas[0] || null;
  cacheResolucion.set(slug, { tenant, resueltoEn: Date.now() });
  return tenant;
}

// Para la futura app de control (segmento 9): tras dar de alta/suspender
// un tenant, invalidar su entrada (o toda la caché, sin argumento) para
// que el cambio sea visible sin esperar el TTL completo.
function invalidarCacheTenant(slug = null) {
  if (slug) cacheResolucion.delete(slug);
  else cacheResolucion.clear();
}

async function resolverTenantMiddleware(req, res, next) {
  const slugCrudo = req.headers['x-tenant-slug'];
  if (!slugCrudo) return next();

  const slug = String(slugCrudo).toLowerCase();
  const errorFormato = validarSlug(slug);
  if (errorFormato) {
    return res.status(400).json({ error: 'Tenant inválido.' });
  }

  try {
    const tenant = await resolverTenantPorSlug(slug);
    if (!tenant) {
      costoArtificialComparable();
      return res.status(404).json({ error: 'Tenant no encontrado.' });
    }

    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      nombreEmpresa: tenant.nombre_empresa,
      // Marca de la empresa (segmento "marca"): nombre con el que quiere
      // ser reconocida en los correos del portal. Si no la definió, cae al
      // nombre genérico por defecto ("ADDV") en los puntos de uso, no aquí.
      marca: tenant.marca || null,
      marcaLogoUrl: tenant.marca_logo_url || null,
      // Look & Feel (segmento 105): JSON crudo del tema del tenant, sin
      // parsear aquí — los consumidores (ej. los correos de marca, ver
      // coloresCorreoTenant en server.js) lo pasan por
      // parsearTemaDesdeFila() bajo demanda, mismo criterio que ya usa
      // GET /api/tema/:slug.
      temaJson: tenant.tema_json || null,
      // §58: si el tenant pertenece a un grupo de sucursales, requireAdminAuth
      // acepta también las credenciales compartidas de ese grupo (ver
      // utils/auth.js) y GET /api/admin/sucursales-hermanas puede armar el
      // switcher del sidebar.
      grupoSucursalId: tenant.grupo_sucursal_id || null,
    };

    // El pool del tenant se expone en `req.poolTenant` para que las rutas
    // cuyo handler corre FUERA del contexto ALS establecido por
    // `ejecutarComoTenant` de abajo (las de multer/busboy, cuyo stream se
    // procesa en un async resource del HTTP server que no hereda el store)
    // puedan re-entrar al contexto con `reanudarContextoTenant` (ver
    // server.js). Sin esto, el `pool.query(...)` dentro de esos callbacks
    // cae al pool por defecto y escribe en la BD equivocada.
    const tenantPool = obtenerPoolTenant({
      slug: tenant.slug,
      host: tenant.db_host,
      port: Number(process.env.DB_PORT || 3306),
      user: tenant.db_user,
      password: process.env.DB_PASSWORD || '',
      database: tenant.db_name,
    });

    req.poolTenant = tenantPool;

    ejecutarComoTenant(tenantPool, () => next());
  } catch (err) {
    console.error(`Error resolviendo tenant "${slug}":`, err);
    res.status(503).json({ error: 'No se pudo resolver el tenant.' });
  }
}

module.exports = { resolverTenantMiddleware, resolverTenantPorSlug, invalidarCacheTenant };
