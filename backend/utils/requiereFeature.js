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

module.exports = { requiereFeature };
