// Ajuste incremental de disco_bytes_usados_cache (propuesta A5): hasta
// ahora ese caché solo se recalculaba a mano con "Recalcular" en
// /control (escaneo completo del bucket, caro) — esto lo mantiene al
// día en cada subida nueva de los 3 puntos ya gateados por cuota (foto
// de ticket, CSF, imagen de producto), sin tener que escanear nada.
//
// Alcance a propósito, documentado (no silencioso): esto solo SUMA en
// cada subida nueva — no resta cuando una imagen de producto se
// reemplaza o se borra (no hay ninguna columna que guarde el tamaño de
// un archivo ya subido para poder restarlo después). El caché puede ir
// quedando por encima del uso real con el tiempo; "Recalcular" en
// /control sigue siendo la fuente de verdad para corregirlo — mismo rol
// que ya tenía antes de este cambio, ahora como reconciliación periódica
// en vez de única fuente del dato.

const { obtenerPoolControl } = require('../db');

async function ajustarUsoDisco(tenant, deltaBytes) {
  if (!tenant || !tenant.slug || !deltaBytes) return;
  try {
    await obtenerPoolControl().query(
      `UPDATE tenants
          SET disco_bytes_usados_cache = GREATEST(0, COALESCE(disco_bytes_usados_cache, 0) + ?),
              disco_cache_actualizado_en = ?
        WHERE slug = ?`,
      [deltaBytes, new Date(), tenant.slug]
    );
  } catch (err) {
    // Fire-and-forget a propósito (mismo criterio que
    // notificarInvalidacionCache en control/): un fallo al ajustar el
    // contador nunca debe tumbar una subida que de otro modo fue exitosa.
    console.error(`No se pudo ajustar el uso de disco de "${tenant.slug}":`, err.message);
  }
}

module.exports = { ajustarUsoDisco };
