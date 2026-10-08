// Candado de feature-flag por tenant (ver PROJECT_STATE.md — "Gobierno de
// funcionalidades por tenant desde /control"). Responde 404, nunca 403: un
// tenant sin el módulo debe comportarse exactamente como si la ruta no
// existiera — mismo criterio que la anti-enumeración de tenants de
// tenantContext.js, nunca confirmar "esto existe pero no es para ti".
//
// Corre ANTES de cualquier lógica de negocio: se monta como el primer
// middleware de cada ruta que pertenece a ese módulo (server.js no usa
// routers por módulo — son rutas sueltas en un solo archivo — así que no
// hay un único punto de montaje por prefijo; hay que insertarlo ruta por
// ruta). Para portal de clientes, en cambio, SÍ hay un chokepoint real:
// requireUserAuth (ver utils/authUsuario.js), que ya corre en todas las
// rutas de sesión de cliente — ahí se compone este mismo candado una sola
// vez en vez de repetirlo.
//
// Si req.tenant no existe (tráfico sin X-Tenant-Slug — todo el tráfico
// real hoy, mientras nginx no inyecte ese encabezado) es un no-op: nunca
// bloquea nada fuera del contexto multi-tenant.
//
// `campo` acepta un string (un solo flag) o un arreglo de strings — en
// ese caso es OR: basta que UNO de los flags esté en true para pasar.
// Caso real (punto 349-350): GET /api/admin/periodos-archivados sirve
// tanto a Ventas como a Gastos; debe responder mientras cualquiera de
// los dos módulos siga activo, no solo cuando ambos lo están. Para un AND
// (ej. Cuentas por cobrar requiere Ventas Y CxC) se encadenan dos
// llamadas a requiereFeature en la ruta, cada una con su propio campo —
// eso ya es AND por composición normal de middlewares, no necesita
// soporte especial aquí.
function requiereFeature(campo) {
  const campos = Array.isArray(campo) ? campo : [campo];
  return function requiereFeatureMiddleware(req, res, next) {
    if (!req.tenant) return next();
    const todosDesactivados = campos.every((c) => req.tenant[c] === false);
    if (todosDesactivados) {
      return res.status(404).end();
    }
    next();
  };
}

// Punto 377: candado específico de Facturación — a diferencia de
// requiereFeature() de arriba (que es no-op sin tenant, por diseño: el
// sitio base nunca ha tenido un "plan" que lo gobierne), Facturación sí
// necesita bloquear en el sitio base cuando el propio admin la pausó
// desde Configuraciones (facturacion_pausada en la config global local).
// No se generaliza requiereFeature() para esto — ese cambio afectaría a
// TODOS los demás flags que hoy dependen a propósito de ese no-op
// (ventasHabilitado, gastosHabilitado, etc., que sí siguen siendo
// exclusivos de tenants con plan). Para tenant, el comportamiento es
// idéntico a requiereFeature('facturacionHabilitada') de siempre:
// tenantContext.js ya resuelve req.tenant.facturacionHabilitada como el
// valor EFECTIVO (plan AND !pausada), así que esta función ni siquiera
// necesita saber que existen 2 capas ahí.
function requiereFacturacionActiva(req, res, next) {
  facturacionActivaEnRequest(req)
    .then((activa) => {
      if (!activa) return res.status(404).end();
      next();
    })
    .catch(next);
}

// Versión en función (no middleware) del mismo cálculo — para los pocos
// puntos de server.js que ya necesitaban saber "¿facturación está activa
// aquí?" como un booleano normal dentro de su propia lógica (ej. decidir
// si generar un identificador SINFISCAL), no como un candado de ruta.
// Un solo lugar de verdad para ambos usos, igual que facturacionEfectiva()
// en tenantContext.js es el único lugar que sabe combinar plan+pausada.
async function facturacionActivaEnRequest(req) {
  if (req.tenant) return req.tenant.facturacionHabilitada !== false;
  const { getConfiguracionGlobal } = require('./config');
  const config = await getConfiguracionGlobal();
  return !config.facturacion_pausada;
}

module.exports = { requiereFeature, requiereFacturacionActiva, facturacionActivaEnRequest };
