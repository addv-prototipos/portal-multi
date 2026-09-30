// Invalida la caché de resolución de tenant del backend principal
// (segmento 9b) — antes (cuando /control vivía en el mismo proceso que
// backend) bastaba llamar invalidarCacheTenant() directamente, porque
// era la misma memoria. Ahora son dos procesos/contenedores distintos:
// esta llamada HTTP es el reemplazo, protegida por un secreto compartido
// (INTERNAL_CACHE_SECRET, el mismo valor en ambos contenedores) para que
// no sea un endpoint de invalidación abierto a cualquiera que lo
// encuentre. BACKEND_INTERNAL_URL apunta por defecto al servicio
// "backend" en la misma red Docker, pero puede apuntar a cualquier
// host/dominio si este servicio se despliega en un servidor aparte.

async function notificarInvalidacionCache(slug) {
  const url = process.env.BACKEND_INTERNAL_URL || 'http://backend:4000';
  const secreto = process.env.INTERNAL_CACHE_SECRET;

  await fetch(`${url}/internal/cache-tenant/invalidar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': secreto || '',
    },
    body: JSON.stringify({ slug }),
  });
}

// Completa el aprovisionamiento FÍSICO de un tenant en "provisioning" —
// a diferencia de notificarInvalidacionCache() (fire-and-forget, un fallo
// no revierte nada porque el estado en BD ya es correcto), esta llamada
// SÍ debe esperarse y propagar el error: si el backend no pudo crear la
// base de datos del tenant, control NUNCA debe marcarlo como "activo".
class ErrorActivacionFisica extends Error {}

async function activarTenantFisico(slug) {
  const url = process.env.BACKEND_INTERNAL_URL || 'http://backend:4000';
  const secreto = process.env.INTERNAL_CACHE_SECRET;

  let res;
  try {
    res = await fetch(`${url}/internal/activar-tenant/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { 'X-Internal-Secret': secreto || '' },
    });
  } catch (err) {
    throw new ErrorActivacionFisica('No se pudo conectar con el backend para crear la base de datos del tenant.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ErrorActivacionFisica(data.error || 'No se pudo crear la base de datos del tenant.');
  }
  return data;
}

// Elimina FÍSICAMENTE un tenant (punto 345, "papelera") — DROP DATABASE +
// purga de MinIO, delegado al backend por el mismo motivo que
// activarTenantFisico(): control_app no tiene privilegios para esto
// (angosto a propósito). Igual de estricto que la activación: si el
// backend no pudo borrar la base de datos, control NUNCA debe borrar la
// fila de `tenants` — se propaga el error, nunca se asume éxito.
class ErrorEliminacionFisica extends Error {}

async function eliminarTenantFisico(slug) {
  const url = process.env.BACKEND_INTERNAL_URL || 'http://backend:4000';
  const secreto = process.env.INTERNAL_CACHE_SECRET;

  let res;
  try {
    res = await fetch(`${url}/internal/eliminar-tenant/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { 'X-Internal-Secret': secreto || '' },
    });
  } catch (err) {
    throw new ErrorEliminacionFisica('No se pudo conectar con el backend para eliminar la base de datos del tenant.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ErrorEliminacionFisica(data.error || 'No se pudo eliminar la base de datos del tenant.');
  }
  return data;
}

module.exports = {
  notificarInvalidacionCache,
  activarTenantFisico,
  ErrorActivacionFisica,
  eliminarTenantFisico,
  ErrorEliminacionFisica,
};
