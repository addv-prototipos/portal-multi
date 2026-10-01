// Auditoría de accesos a /control (segmento 7, movida a este contenedor
// propio en el segmento 9b — ver PROJECT_STATE.md). Misma tabla
// admin_auditoria de siempre (compartida con el backend principal, que
// registra ahí el acceso a /admin) — vive en control_tenants porque un
// acceso "super" es por definición cross-tenant.
const { obtenerPool } = require('../db');

async function asegurarTablaAuditoria(db = obtenerPool()) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_auditoria (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ocurrido_en DATETIME NOT NULL,
      actor VARCHAR(100) NOT NULL,
      mecanismo ENUM('admin_users','fallback_admin','perfil_bd') NOT NULL,
      perfil VARCHAR(20) NOT NULL,
      tenant_slug VARCHAR(50) NULL,
      metodo VARCHAR(10) NOT NULL,
      ruta VARCHAR(255) NOT NULL,
      resultado_estatus SMALLINT NOT NULL,
      ip VARCHAR(45) NULL,
      KEY idx_admin_auditoria_actor (actor),
      KEY idx_admin_auditoria_tenant (tenant_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// Fire-and-forget desde el llamador: un fallo al auditar no debe nunca
// bloquear ni tumbar la petición real que se está auditando.
async function registrarAccesoAdmin(
  { actor, mecanismo, perfil, tenantSlug, metodo, ruta, estatus, ip },
  db = obtenerPool()
) {
  await db.query(
    `INSERT INTO admin_auditoria
       (ocurrido_en, actor, mecanismo, perfil, tenant_slug, metodo, ruta, resultado_estatus, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [new Date(), actor, mecanismo, perfil, tenantSlug || null, metodo, ruta, estatus, ip || null]
  );
}

// Punto 347 (gobierno de funcionalidades): consulta cross-tenant de
// admin_auditoria — a diferencia del equivalente en backend/utils/
// adminAuditoria.js (que SIEMPRE acota a un solo tenant, nunca cross-
// tenant, por diseño del punto 244), aquí es exactamente lo opuesto: un
// super en /control puede ver accesos de CUALQUIER empresa. `tenantSlug`
// es un filtro opcional, no una restricción obligatoria — sin él, ve
// todo. Mismo criterio de "duplicar código pequeño, no compartir entre
// backend/ y control/" ya usado en el resto del proyecto.
async function listarAuditoria({ actor, tenantSlug, desde, hasta, limite = 100 } = {}, db = obtenerPool()) {
  const condiciones = [];
  const parametros = [];

  if (actor) {
    condiciones.push('actor = ?');
    parametros.push(actor);
  }
  if (tenantSlug) {
    condiciones.push('tenant_slug = ?');
    parametros.push(tenantSlug);
  }
  if (desde) {
    condiciones.push('ocurrido_en >= ?');
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push('ocurrido_en <= ?');
    parametros.push(hasta);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limiteSeguro = Math.min(Math.max(Number(limite) || 100, 1), 500);

  const [filas] = await db.query(
    `SELECT id, ocurrido_en, actor, mecanismo, perfil, tenant_slug, metodo, ruta, resultado_estatus, ip
     FROM admin_auditoria ${where}
     ORDER BY ocurrido_en DESC
     LIMIT ${limiteSeguro}`,
    parametros
  );
  return filas;
}

module.exports = { asegurarTablaAuditoria, registrarAccesoAdmin, listarAuditoria };
