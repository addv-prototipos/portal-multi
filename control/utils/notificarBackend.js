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

module.exports = { notificarInvalidacionCache };
