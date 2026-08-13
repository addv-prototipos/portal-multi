// Auditoría de accesos administrativos (segmento 7 del plan multi-tenant,
// ver PROJECT_STATE.md). Target nombrado explícitamente al diseñar el
// segmento 6: ADMIN_USERS es un mecanismo Basic Auth "super admin" que
// ahora abarca TODOS los tenants (antes solo existía un tenant), sin
// ningún rastro de quién lo usó, cuándo, ni sobre qué tenant — esta tabla
// cierra ese hueco.
//
// Vive en la BD de control (`control_tenants`), no en la de cada tenant:
// un acceso "super" es por definición cross-tenant, así que no tendría
// sentido fragmentar su registro por BD de tenant. Se puede crear con las
// credenciales normales de aplicación (usuario `app`) — ya tiene
// ALL PRIVILEGES sobre `control_tenants.*` desde el segmento 1, no
// requiere root.
const { obtenerPoolControl } = require('../db');

async function asegurarTablaAuditoria(db = obtenerPoolControl()) {
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

// Fire-and-forget desde el llamador (mismo patrón que
// notificarNuevoTicketAlContador en server.js): un fallo al auditar no
// debe nunca bloquear ni tumbar la petición real que se está auditando.
async function registrarAccesoAdmin(
  { actor, mecanismo, perfil, tenantSlug, metodo, ruta, estatus, ip },
  db = obtenerPoolControl()
) {
  await db.query(
    `INSERT INTO admin_auditoria
       (ocurrido_en, actor, mecanismo, perfil, tenant_slug, metodo, ruta, resultado_estatus, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [new Date(), actor, mecanismo, perfil, tenantSlug || null, metodo, ruta, estatus, ip || null]
  );
}

async function listarAuditoria({ actor, tenantSlug, desde, hasta, limite = 100 } = {}, db = obtenerPoolControl()) {
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
