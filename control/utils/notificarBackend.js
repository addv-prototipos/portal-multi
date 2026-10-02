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

// Punto 347 (gobierno de funcionalidades): pide al backend que sume los
// bytes reales en MinIO bajo el prefijo de un tenant — control_app no
// tiene credenciales de MinIO (solo backend las tiene montadas), mismo
// motivo que activarTenantFisico()/eliminarTenantFisico(). Se propaga el
// error en vez de asumir 0: un fallo de red nunca debe escribirse como
// "uso de disco: 0 bytes" en la fila del tenant.
class ErrorCalculoDisco extends Error {}

async function calcularUsoDiscoFisico(slug) {
  const url = process.env.BACKEND_INTERNAL_URL || 'http://backend:4000';
  const secreto = process.env.INTERNAL_CACHE_SECRET;

  let res;
  try {
    res = await fetch(`${url}/internal/disco-uso/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { 'X-Internal-Secret': secreto || '' },
    });
  } catch (err) {
    throw new ErrorCalculoDisco('No se pudo conectar con el backend para calcular el uso de disco.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ErrorCalculoDisco(data.error || 'No se pudo calcular el uso de disco.');
  }
  return data.bytes;
}

// Punto 349-350-351 (regla 9, ver stitch/gobierno-funcionalidades/
// NOTAS.md): al guardar un max_usuarios nuevo (directo o vía plan), pide
// al backend que suspenda usuarios no-administradores si la empresa
// queda por encima del nuevo límite — la BD del tenant vive ahí, no
// aquí (mismo motivo que activarTenantFisico/calcularUsoDiscoFisico).
//
// A propósito NO propaga el error (a diferencia de activarTenantFisico/
// eliminarTenantFisico): a esta altura la fila de `tenants` YA se
// guardó correctamente — la suspensión es un efecto secundario, nunca
// debe revertir una edición que de por sí ya es válida y ya quedó
// guardada. Un fallo de red aquí se resuelve corrigiéndose solo la
// próxima vez que alguien edite el límite de esa empresa, no bloqueando
// la operación actual. Devuelve `null` si no se pudo confirmar (en vez
// de asumir `[]` = "nadie se suspendió", que sería una afirmación falsa
// que el llamador no puede verificar).
async function aplicarLimiteUsuarios(slug, maxUsuarios) {
  if (maxUsuarios === null || maxUsuarios === undefined) return [];

  const url = process.env.BACKEND_INTERNAL_URL || 'http://backend:4000';
  const secreto = process.env.INTERNAL_CACHE_SECRET;

  try {
    const res = await fetch(`${url}/internal/aplicar-limite-usuarios/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secreto || '' },
      body: JSON.stringify({ maxUsuarios }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && Array.isArray(data.suspendidos) ? data.suspendidos : null;
  } catch (err) {
    return null;
  }
}

// Punto 349-350-351 (regla 8 extendida, Fase 7): solo lectura, para el
// banner PREVENTIVO en "Editar empresa → Plan y funciones" — a
// diferencia de aplicarLimiteUsuarios() (se llama después de guardar,
// nunca lanza porque ya no hay nada que revertir), esta se llama ANTES
// de guardar, mientras el admin todavía está decidiendo. Tampoco lanza:
// si el backend no responde, el banner simplemente no puede calcular un
// número exacto — eso no debe impedir seguir editando el resto del
// formulario. Devuelve el total (entero) en éxito, o `null` si no se
// pudo confirmar.
async function obtenerUsoUsuarios(slug) {
  const url = process.env.BACKEND_INTERNAL_URL || 'http://backend:4000';
  const secreto = process.env.INTERNAL_CACHE_SECRET;

  try {
    const res = await fetch(`${url}/internal/uso-usuarios/${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { 'X-Internal-Secret': secreto || '' },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && Number.isInteger(data.total) ? data.total : null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  notificarInvalidacionCache,
  activarTenantFisico,
  ErrorActivacionFisica,
  eliminarTenantFisico,
  ErrorEliminacionFisica,
  calcularUsoDiscoFisico,
  ErrorCalculoDisco,
  aplicarLimiteUsuarios,
  obtenerUsoUsuarios,
};
