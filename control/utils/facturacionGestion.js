// Ciclo de vida real de "Solicitar factura" (CFDI vía SAT) — propuesta 3
// (Kanban en Control) de las 9 propuestas simuladas, implementada. El
// tenant solicita desde Mi Cuenta (backend), la solicitud vive aquí
// (Control es quien tiene acceso a la información cross-tenant), y el
// ZIP real sube/baja por backend (storage/Garage, Control nunca toca
// bytes de archivo — ver facturacionArchivos.js).

const { obtenerPool } = require('../db');
const { montoCatalogoTenant } = require('./facturacionClarvo');

class ErrorFacturacionGestion extends Error {
  constructor(message, codigo) {
    super(message);
    this.codigo = codigo;
  }
}

function folioNuevo() {
  const numero = Math.floor(1000 + Math.random() * 9000);
  return `SOL-${numero}-${Date.now().toString(36).toUpperCase()}`;
}

// `monto`: NUNCA se recibe del llamador — el cliente factura al precio
// de CATÁLOGO vigente (plan + upscales, el mismo que ve en el sitio),
// nunca lo que Stripe cobró internamente (prorrateo, comisión). Se
// recalcula aquí siempre (`montoCatalogoTenant`) y se guarda como
// snapshot en la fila, igual que razón social/RFC/régimen — si el
// catálogo cambia después, la solicitud ya enviada conserva el monto
// con el que se generó.
async function crearSolicitud(datos, db = obtenerPool()) {
  const { slug, invoiceId, periodoEtiqueta, razonSocial, rfc, regimenFiscal, codigoPostal } = datos;
  if (!slug || !invoiceId || !razonSocial || !rfc || !regimenFiscal || !codigoPostal) {
    throw new ErrorFacturacionGestion('Faltan datos para crear la solicitud de factura.', 'datos_incompletos');
  }
  const [existente] = await db.query(
    'SELECT id, folio, estado FROM tenant_solicitudes_factura WHERE tenant_slug = ? AND invoice_id = ? LIMIT 1',
    [slug, invoiceId]
  );
  if (existente[0]) {
    if (existente[0].estado === 'rechazada') {
      // Reenviar reutiliza la misma fila — nunca una solicitud nueva por
      // el mismo cobro (ver UNIQUE de ensureSchema.js).
      const folio = existente[0].folio;
      await db.query(
        `UPDATE tenant_solicitudes_factura
            SET estado = 'solicitada', motivo_rechazo = NULL,
                razon_social = ?, rfc = ?, regimen_fiscal = ?, codigo_postal = ?
          WHERE id = ?`,
        [razonSocial, rfc, regimenFiscal, codigoPostal, existente[0].id]
      );
      return { id: existente[0].id, folio, estado: 'solicitada' };
    }
    throw new ErrorFacturacionGestion('Ya existe una solicitud de factura para este cobro.', 'ya_existe');
  }
  const { total: monto } = await montoCatalogoTenant(slug, db);
  const folio = folioNuevo();
  const [resultado] = await db.query(
    `INSERT INTO tenant_solicitudes_factura
       (tenant_slug, folio, invoice_id, periodo_etiqueta, monto, razon_social, rfc, regimen_fiscal, codigo_postal, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'solicitada')`,
    [slug, folio, invoiceId, periodoEtiqueta, monto, razonSocial, rfc, regimenFiscal, codigoPostal]
  );
  return { id: resultado.insertId, folio, estado: 'solicitada' };
}

async function listarSolicitudesPorTenant(slug, db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT id, folio, invoice_id, estado, motivo_rechazo, factura_zip_nombre
       FROM tenant_solicitudes_factura
      WHERE tenant_slug = ?`,
    [slug]
  );
  return filas;
}

async function listarSolicitudesKanban(db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT s.id, s.tenant_slug, s.folio, s.invoice_id, s.periodo_etiqueta, s.monto,
            s.razon_social, s.rfc, s.regimen_fiscal, s.codigo_postal,
            s.estado, s.motivo_rechazo, s.factura_zip_nombre, s.creado_en, s.actualizado_en,
            t.nombre_empresa
       FROM tenant_solicitudes_factura s
       LEFT JOIN tenants t ON t.slug = s.tenant_slug
      WHERE s.estado != 'lista' OR s.actualizado_en >= NOW() - INTERVAL 30 DAY
      ORDER BY s.creado_en DESC`
  );
  return filas.map((f) => ({
    id: f.id,
    tenantSlug: f.tenant_slug,
    nombreEmpresa: f.nombre_empresa || f.tenant_slug,
    folio: f.folio,
    invoiceId: f.invoice_id,
    periodoEtiqueta: f.periodo_etiqueta,
    monto: Number(f.monto),
    razonSocial: f.razon_social,
    rfc: f.rfc,
    regimenFiscal: f.regimen_fiscal,
    codigoPostal: f.codigo_postal,
    estado: f.estado,
    motivoRechazo: f.motivo_rechazo,
    facturaZipNombre: f.factura_zip_nombre,
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
  }));
}

async function obtenerSolicitud(id, db = obtenerPool()) {
  const [filas] = await db.query('SELECT * FROM tenant_solicitudes_factura WHERE id = ? LIMIT 1', [id]);
  return filas[0] || null;
}

async function marcarEnProceso(id, db = obtenerPool()) {
  const sol = await obtenerSolicitud(id, db);
  if (!sol) throw new ErrorFacturacionGestion('Solicitud no encontrada.', 'no_encontrada');
  if (sol.estado !== 'solicitada') {
    throw new ErrorFacturacionGestion('Esta solicitud ya no está en estado "solicitada".', 'estado_invalido');
  }
  await db.query("UPDATE tenant_solicitudes_factura SET estado = 'en_proceso' WHERE id = ?", [id]);
}

async function marcarRechazada(id, motivo, db = obtenerPool()) {
  const sol = await obtenerSolicitud(id, db);
  if (!sol) throw new ErrorFacturacionGestion('Solicitud no encontrada.', 'no_encontrada');
  if (sol.estado === 'lista') {
    throw new ErrorFacturacionGestion('No se puede rechazar una solicitud ya entregada.', 'estado_invalido');
  }
  if (!motivo || !motivo.trim()) {
    throw new ErrorFacturacionGestion('El motivo de rechazo es obligatorio.', 'motivo_requerido');
  }
  await db.query(
    "UPDATE tenant_solicitudes_factura SET estado = 'rechazada', motivo_rechazo = ? WHERE id = ?",
    [motivo.trim(), id]
  );
}

async function marcarLista(id, nombreZip, db = obtenerPool()) {
  const sol = await obtenerSolicitud(id, db);
  if (!sol) throw new ErrorFacturacionGestion('Solicitud no encontrada.', 'no_encontrada');
  if (sol.estado === 'lista') {
    throw new ErrorFacturacionGestion('Esta solicitud ya tiene una factura entregada.', 'estado_invalido');
  }
  await db.query(
    "UPDATE tenant_solicitudes_factura SET estado = 'lista', factura_zip_nombre = ? WHERE id = ?",
    [nombreZip, id]
  );
}

module.exports = {
  ErrorFacturacionGestion,
  crearSolicitud,
  listarSolicitudesPorTenant,
  listarSolicitudesKanban,
  obtenerSolicitud,
  marcarEnProceso,
  marcarRechazada,
  marcarLista,
};
