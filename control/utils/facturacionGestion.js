// Ciclo de vida real de "Solicitar factura" (CFDI vía SAT) — propuesta 3
// (Kanban en Control) de las 9 propuestas simuladas, implementada. El
// tenant solicita desde Mi Cuenta (backend), la solicitud vive aquí
// (Control es quien tiene acceso a la información cross-tenant), y el
// ZIP real sube/baja por backend (storage/Garage, Control nunca toca
// bytes de archivo — ver facturacionArchivos.js).

const { obtenerPool } = require('../db');
const { montoRealInvoiceTenant } = require('./facturacionClarvo');
const { eliminarFacturaZip, enviarCorreoBase, listarUsuariosAdminTenant } = require('./notificarBackend');

// Mismo patrón que onboardingConversion.js/stripePagos.js/reactivacionTenant.js
// para construir una URL real del panel admin de un tenant.
const APP_BASE_URL = (process.env.PUBLIC_APP_BASE_URL || 'https://clarvo.mx').replace(/\/$/, '');

// Deep-link compartido con el correo/campana de "cobro de suscripción"
// (ver webhooksSuscripcion.js) — ambos llevan al mismo lugar real:
// Mi Cuenta → "Facturación de Clarvo", con scroll automático (frontend/
// admin.js:aplicarDeepLinkDesdeUrlSiAplica()). Único punto que arma esta
// URL para no desincronizar el query param contra el que el frontend
// escucha.
function urlFacturacionClarvo(slug) {
  return `${APP_BASE_URL}/${slug}/admin?ir=facturacion-clarvo`;
}

// Retención de 30 días para solicitudes "lista" (bug real reportado: se
// quedaban indefinidas en el Kanban/Garage, nunca se borraban). Mismo
// valor que backend/server.js usa para tickets — no hay una sola fuente
// compartida entre los 2 servicios (contextos de build separados, ver
// CLAUDE.md), así que se duplica a propósito.
const RETENCION_FACTURA_LISTA_DIAS = 30;

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

// `monto`: NUNCA se recibe del llamador — decisión del usuario (punto 479):
// el CFDI se emite por lo que de verdad LLEGA a la cuenta de Clarvo para
// ESE invoice (`invoiceId`) — ni el precio de catálogo ni lo que el
// cliente pagó (bruto), sino ese bruto menos el descuento (si hubo cupón
// activo, duration:'once' siempre) Y menos la comisión real que Stripe
// retiene por procesar el cobro (`montoRealInvoiceTenant` →
// facturacionClarvo.js:obtenerComisionStripe, Balance Transaction API).
// Se recalcula aquí siempre y se guarda como snapshot en la fila, igual
// que razón social/RFC/régimen.
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
  const monto = await montoRealInvoiceTenant(slug, invoiceId, db);
  if (monto == null) {
    throw new ErrorFacturacionGestion('No se pudo verificar el cobro real en Stripe — intenta de nuevo.', 'invoice_no_encontrado');
  }
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
    `SELECT id, folio, invoice_id, estado, motivo_rechazo, factura_zip_nombre, monto, actualizado_en
       FROM tenant_solicitudes_factura
      WHERE tenant_slug = ? AND eliminado_en IS NULL`,
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
      WHERE s.eliminado_en IS NULL
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
  const [filas] = await db.query('SELECT * FROM tenant_solicitudes_factura WHERE id = ? AND eliminado_en IS NULL LIMIT 1', [id]);
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
  // Bug real reportado: el tenant nunca se enteraba de que su factura ya
  // estaba lista — ni campana (ver backend GET /admin/notificaciones/facturas,
  // que lee directo esta tabla) ni correo. Correo SOLO a la cuenta raíz
  // (quien pidió la factura, "Datos de pago"/"Solicitar factura" son
  // candado de raíz — ver backend:exigirAdminRaizConTenant), nunca a
  // contacto_email (ese es el genérico de la empresa, puede ser otra
  // persona). Fire-and-forget, mismo criterio que el resto de los
  // correos de este archivo/notificarBackend.js: la factura ya quedó
  // guardada, un correo que falla no debe tumbar la respuesta al
  // operador de /control.
  notificarFacturaListaAlTenant(sol.tenant_slug, sol.folio).catch((err) => {
    console.error(`No se pudo notificar al tenant "${sol.tenant_slug}" que su factura (folio ${sol.folio}) ya está lista:`, err.message);
  });
}

async function notificarFacturaListaAlTenant(slug, folio) {
  const usuarios = await listarUsuariosAdminTenant(slug);
  const raiz = Array.isArray(usuarios) ? usuarios.find((u) => u.es_cuenta_raiz) : null;
  if (!raiz || !raiz.email) return;
  await enviarCorreoBase({
    destinatario: raiz.email,
    asunto: 'Tu factura ya está lista',
    eyebrow: 'Facturación de Clarvo',
    titulo: 'Tu factura ya está lista',
    parrafos: [`Tu factura (folio ${folio}) ya está lista para descargar.`],
    cta: { href: urlFacturacionClarvo(slug), texto: 'Ver mi factura' },
  });
}

// Borrado real (soft-delete, control_app no tiene DELETE — ver nota de
// ensureSchema.js) — borra TAMBIÉN el ZIP físico en Garage cuando la
// solicitud ya tenía uno (estado 'lista'); para cualquier otro estado
// solo marca la fila, nunca hay archivo que limpiar. Usado por el botón
// manual de /control Y por la purga automática de 30 días (misma
// función, mismo candado real).
async function eliminarSolicitud(id, db = obtenerPool()) {
  const sol = await obtenerSolicitud(id, db);
  if (!sol) throw new ErrorFacturacionGestion('Solicitud no encontrada.', 'no_encontrada');
  if (sol.estado === 'lista') {
    const { ok } = await eliminarFacturaZip(sol.tenant_slug, sol.invoice_id);
    if (!ok) {
      throw new ErrorFacturacionGestion('No se pudo borrar el archivo en el backend — inténtalo de nuevo.', 'backend_no_disponible');
    }
  }
  await db.query('UPDATE tenant_solicitudes_factura SET eliminado_en = NOW() WHERE id = ?', [id]);
}

// Corre al arrancar `control` y cada 24h (ver server.js) — purga
// solicitudes 'lista' cuyo `actualizado_en` (el momento en que se marcó
// lista, nunca se vuelve a tocar después) ya pasó la ventana de
// retención. Una por una (nunca un UPDATE/DELETE masivo): cada una
// necesita su propia llamada a eliminarFacturaZip antes de poder
// marcarse — si una falla (backend caído), las demás igual se procesan,
// nunca se detiene la purga completa por una sola falla.
async function purgarSolicitudesListasVencidas(db = obtenerPool()) {
  const [vencidas] = await db.query(
    `SELECT id FROM tenant_solicitudes_factura
      WHERE estado = 'lista' AND eliminado_en IS NULL
        AND actualizado_en < NOW() - INTERVAL ? DAY`,
    [RETENCION_FACTURA_LISTA_DIAS]
  );
  let purgadas = 0;
  for (const fila of vencidas) {
    try {
      await eliminarSolicitud(fila.id, db);
      purgadas += 1;
    } catch (err) {
      console.error(`No se pudo purgar la solicitud de factura #${fila.id} (retención 30 días):`, err.message);
    }
  }
  return { purgadas, total: vencidas.length };
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
  eliminarSolicitud,
  purgarSolicitudesListasVencidas,
};
