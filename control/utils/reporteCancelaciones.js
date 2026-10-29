// Reporte de cancelaciones (Sección E, propuesta E1 aprobada) — motivos
// agregados + detalle con comentarios de `cancelaciones_encuesta`
// (ver ensureSchema.js), llenada SIEMPRE antes de confirmar una
// cancelación en Mi Cuenta (ver cancelacionSuscripcion.js). Sin tope
// silencioso: el detalle se corta a 200 filas más recientes y lo dice
// explícito en la respuesta (`truncado`), nunca se oculta.

const { obtenerPool } = require('../db');

const LIMITE_DETALLE = 200;

async function listarReporteCancelaciones(db = obtenerPool()) {
  const [motivos] = await db.query(
    `SELECT motivo, COUNT(*) AS total FROM cancelaciones_encuesta GROUP BY motivo ORDER BY total DESC`
  );
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM cancelaciones_encuesta');
  // JOIN a tenants para la propuesta de retención por correo: solo se
  // ofrece si la empresa nunca usó el descuento de retención (A2) — ver
  // cancelacionSuscripcion.js:enviarPropuestaRetencion.
  const [detalle] = await db.query(
    `SELECT ce.id, ce.slug, ce.motivo, ce.comentario, ce.creado_en, ce.propuesta_enviada_en,
            t.suscripcion_descuento_retencion_usado
       FROM cancelaciones_encuesta ce
       LEFT JOIN tenants t ON t.id = ce.tenant_id
      ORDER BY ce.creado_en DESC LIMIT ${LIMITE_DETALLE}`
  );

  const totalMotivos = motivos.reduce((s, m) => s + m.total, 0) || 1;
  return {
    total,
    motivos: motivos.map((m) => ({ motivo: m.motivo, total: m.total, porcentaje: Math.round((m.total / totalMotivos) * 100) })),
    detalle,
    truncado: total > LIMITE_DETALLE,
    limiteDetalle: LIMITE_DETALLE,
  };
}

module.exports = { listarReporteCancelaciones };
