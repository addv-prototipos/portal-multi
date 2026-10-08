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
    `SELECT id, slug, nombre_empresa, estado, db_host, db_name, db_user, marca, marca_logo_url, tema_json, grupo_sucursal_id, contacto_email, marca_lookfeel_habilitado, max_usuarios, facturacion_habilitada, facturacion_pausada, portal_clientes_habilitado, portal_clientes_pausado, sucursales_habilitado, disco_cuota_mb, disco_bytes_usados_cache, ventas_habilitado, gastos_habilitado, inventarios_habilitado, auditoria_habilitado, cxc_habilitado, resumen_financiero_habilitado, reportes_por_reporte_habilitado, reportes_cortes_habilitado, reportes_eliminados_habilitado, reportes_estado_inventario_habilitado, reportes_estado_tickets_habilitado
     FROM tenants WHERE slug = ? AND estado = 'activo' LIMIT 1`,
    [slug]
  );
  const tenant = filas[0] || null;
  cacheResolucion.set(slug, { tenant, resueltoEn: Date.now() });
  return tenant;
}

// Punto 375: valor EFECTIVO de "portal de clientes" a partir de una fila
// cruda de `tenants` (plan AND !pausado) — compartido entre
// resolverTenantMiddleware (arriba) y GET /api/tema/:slug en server.js,
// que lee la fila directo con resolverTenantPorSlug() sin pasar por el
// middleware. Un solo lugar, para que las dos capas nunca diverjan.
function portalClientesEfectivo(tenant) {
  if (!tenant) return true;
  const planHabilitado = tenant.portal_clientes_habilitado !== 0 && tenant.portal_clientes_habilitado !== false;
  const pausado = tenant.portal_clientes_pausado === 1 || tenant.portal_clientes_pausado === true;
  return planHabilitado && !pausado;
}

// Punto 377: gemela de portalClientesEfectivo() — plan (solo /control lo
// prende) AND !pausado (el propio admin lo pausa/reanuda desde
// Configuraciones, sin pasar por /control). Se expone bajo la MISMA
// propiedad que ya leían los 31 puntos existentes de server.js
// (req.tenant.facturacionHabilitada) — ninguno de ellos necesita cambiar,
// ahora reciben el valor ya efectivo en vez de solo el techo crudo.
function facturacionEfectiva(tenant) {
  if (!tenant) return true;
  const planHabilitado = tenant.facturacion_habilitada !== 0 && tenant.facturacion_habilitada !== false;
  const pausada = tenant.facturacion_pausada === 1 || tenant.facturacion_pausada === true;
  return planHabilitado && !pausada;
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
      // Punto 170: correo DE LA EMPRESA CLIENTE (obligatorio en altas
      // nuevas desde /control), usado por la burbuja "Solicitar
      // aclaraciones" del portal — null en tenants viejos que no lo
      // llenaron todavía, la burbuja se oculta en ese caso.
      contactoEmail: tenant.contacto_email || null,
      // Punto 244 (mapeo con CLARVO_Planes.md): gate real de marca/Look &
      // Feel — false = el backend ignora marca/temaJson de arriba y cae a
      // la identidad CLARVO por defecto en todos los puntos de uso
      // (correos, portal, favicon). DEFAULT en BD es 1, así que un tenant
      // ya configurado antes de esta columna sigue viéndose igual.
      marcaLookfeelHabilitado: tenant.marca_lookfeel_habilitado !== 0 && tenant.marca_lookfeel_habilitado !== false,
      // Cuota de cuentas de panel (administrador/fiscal/ventas) — null =
      // sin límite. Enforcement real en POST /api/admin/usuarios.
      maxUsuarios: tenant.max_usuarios == null ? null : Number(tenant.max_usuarios),
      // Punto 377: valor EFECTIVO = plan (solo /control lo prende) AND
      // !pausada (el propio admin la pausa/reanuda desde Configuraciones,
      // sin pasar por /control) — mismo criterio de 2 capas que
      // portalClientesHabilitado más abajo. Los 31 puntos existentes que ya
      // leían esta propiedad (requiereFeature + chequeos directos en
      // server.js) no se tocaron, ahora reciben el efectivo sin saberlo.
      facturacionHabilitada: facturacionEfectiva(tenant),
      // Crudos, solo para que Configuraciones sepa si debe mostrar el
      // interruptor (si el plan ya lo tiene apagado, no se dibuja — nunca
      // un switch que no hace nada, ver /control "no aparece nada").
      facturacionHabilitadaPlan: tenant.facturacion_habilitada !== 0 && tenant.facturacion_habilitada !== false,
      facturacionPausada: tenant.facturacion_pausada === 1 || tenant.facturacion_pausada === true,
      // Punto 375: valor EFECTIVO = plan (solo /control lo prende) AND
      // !pausado (el propio admin lo pausa/reanuda desde Mi Cuenta, sin
      // pasar por /control). requiereFeature('portalClientesHabilitado')
      // y GET /api/tema/:slug leen esta propiedad combinada sin saber que
      // hay dos capas detrás — un solo lugar decide el efectivo.
      portalClientesHabilitado: portalClientesEfectivo(tenant),
      // Crudos, solo para que la UI de Mi Cuenta sepa qué mostrar/bloquear
      // (ej. candado + "contacta a soporte" si el plan ya lo tiene apagado,
      // en vez de dejar que el admin le dé a un switch que no hace nada).
      portalClientesHabilitadoPlan: tenant.portal_clientes_habilitado !== 0 && tenant.portal_clientes_habilitado !== false,
      portalClientesPausado: tenant.portal_clientes_pausado === 1 || tenant.portal_clientes_pausado === true,
      // DEFAULT en BD es 0 — a diferencia de las dos de arriba, esta es una
      // feature nueva que nadie tenía antes salvo quien ya esté en un grupo
      // real (ver backfill condicional en control/scripts/ensureSchema.js).
      sucursalesHabilitado: tenant.sucursales_habilitado === 1 || tenant.sucursales_habilitado === true,
      // Cuota de disco en MB impuesta desde /control — null = sin límite.
      discoCuotaMb: tenant.disco_cuota_mb == null ? null : Number(tenant.disco_cuota_mb),
      // Uso real en bytes, calculado async por "Recalcular" en /control —
      // null = nunca se ha calculado (nunca bloquea una subida por falta
      // de dato; solo bloquea cuando SÍ hay un número y supera la cuota).
      discoBytesUsadosCache: tenant.disco_bytes_usados_cache == null ? null : Number(tenant.disco_bytes_usados_cache),
      // Ampliación del gobierno de funcionalidades (punto 349-350, ver
      // stitch/gobierno-funcionalidades/NOTAS.md — 12 reglas de
      // dependencia). DEFAULT en BD es 1 en las 10 — mismo criterio que
      // facturacionHabilitada/portalClientesHabilitado arriba: un tenant
      // ya configurado antes de estas columnas sigue teniendo el módulo
      // igual que siempre.
      ventasHabilitado: tenant.ventas_habilitado !== 0 && tenant.ventas_habilitado !== false,
      gastosHabilitado: tenant.gastos_habilitado !== 0 && tenant.gastos_habilitado !== false,
      inventariosHabilitado: tenant.inventarios_habilitado !== 0 && tenant.inventarios_habilitado !== false,
      auditoriaHabilitado: tenant.auditoria_habilitado !== 0 && tenant.auditoria_habilitado !== false,
      // Cuentas por cobrar: opcional/independiente, no se activa sola
      // aunque Ventas esté encendido (decisión del usuario) — por eso es
      // su propia bandera, no un derivado de ventasHabilitado.
      cxcHabilitado: tenant.cxc_habilitado !== 0 && tenant.cxc_habilitado !== false,
      resumenFinancieroHabilitado: tenant.resumen_financiero_habilitado !== 0 && tenant.resumen_financiero_habilitado !== false,
      // Las 4 pestañas reales de "Reportes" — independientes entre sí y
      // de resumenFinancieroHabilitado (confirmado explícitamente por el
      // usuario, 2026-10-01).
      reportesPorReporteHabilitado: tenant.reportes_por_reporte_habilitado !== 0 && tenant.reportes_por_reporte_habilitado !== false,
      reportesCortesHabilitado: tenant.reportes_cortes_habilitado !== 0 && tenant.reportes_cortes_habilitado !== false,
      reportesEliminadosHabilitado: tenant.reportes_eliminados_habilitado !== 0 && tenant.reportes_eliminados_habilitado !== false,
      reportesEstadoInventarioHabilitado: tenant.reportes_estado_inventario_habilitado !== 0 && tenant.reportes_estado_inventario_habilitado !== false,
      // Punto 360: 5ta pestaña de Reportes — el contenido de tickets que
      // antes vivía en "Inicio" se movió aquí.
      reportesEstadoTicketsHabilitado: tenant.reportes_estado_tickets_habilitado !== 0 && tenant.reportes_estado_tickets_habilitado !== false,
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

module.exports = { resolverTenantMiddleware, resolverTenantPorSlug, invalidarCacheTenant, portalClientesEfectivo, facturacionEfectiva };
