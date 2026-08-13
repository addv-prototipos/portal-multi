// Captura (intake) de la intención de dar de alta una empresa nueva
// (segmento 9c, ver PROJECT_STATE.md): guarda la fila con
// estado='provisioning' en control_tenants.tenants SIN necesidad de
// privilegios root de MySQL (el contenedor control solo tiene
// SELECT/INSERT/UPDATE/CREATE/ALTER sobre control_tenants — ver
// backend/scripts/lib/controlDb.js). El aprovisionamiento físico (CREATE
// DATABASE + esquema + GRANT) sigue siendo backend/scripts/
// provisionar-tenant.js, corrido a mano por un operador; ese script
// detecta estas filas y las completa en vez de rechazarlas como "ya
// existe".
//
// Los campos fiscales son todos OPCIONALES: el intake es especulativo
// (la empresa ni siquiera tiene su propia BD todavía) y nada en la BD de
// control los exige — mismo criterio que la config fiscal de cada tenant
// (backend/utils/config.js, todos nullable).

const { obtenerPool } = require('../db');
const { validarSlug, nombreDbTenant } = require('./tenant');
const { normalizarYValidarDatosFiscales, tieneAlgunDatoFiscal, isValidEmail } = require('./validateFiscal');

// Error tipado para que la capa de rutas distinga "el slug ya está
// registrado" (409) de "los datos no pasan la validación" (400).
class ErrorIntakeTenant extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorIntakeTenant';
    this.codigo = codigo; // 'slug_existe' | 'validacion'
  }
}

async function registrarEvento(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

// A dónde apuntará la BD física del tenant cuando se aprovisione — por
// defecto la misma infraestructura MySQL compartida (mismo servidor al
// que ya se conecta este contenedor, usuario de aplicación "app"). El
// operador puede cambiarlo con TENANT_DB_HOST/TENANT_DB_USER solo si los
// tenants viven en otra instancia de MySQL; provisionar-tenant.js usa
// estos mismos valores al completar la fila (lee los que ya quedaron
// guardados aquí, no los recalcula).
function derivarInfraTenant() {
  return {
    db_host: process.env.TENANT_DB_HOST || process.env.CONTROL_DB_HOST || 'mysql',
    db_user: process.env.TENANT_DB_USER || 'app',
  };
}

function normalizarDatosBase(datos = {}) {
  const normalizado = {};

  const nombreEmpresa = typeof datos.nombreEmpresa === 'string' ? datos.nombreEmpresa.trim() : '';
  if (!nombreEmpresa) {
    throw new Error('El nombre de la empresa es obligatorio.');
  }
  if (nombreEmpresa.length > 255) {
    throw new Error('El nombre de la empresa no puede superar los 255 caracteres.');
  }
  normalizado.nombreEmpresa = nombreEmpresa;

  const slug = typeof datos.slug === 'string' ? datos.slug.trim().toLowerCase() : '';
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    throw new Error(errorSlug);
  }
  normalizado.slug = slug;

  const contactoEmail = typeof datos.contactoEmail === 'string' ? datos.contactoEmail.trim().toLowerCase() : '';
  if (contactoEmail && !isValidEmail(contactoEmail)) {
    throw new Error('El correo de contacto no tiene un formato válido.');
  }
  normalizado.contactoEmail = contactoEmail || null;

  const notas = typeof datos.notas === 'string' ? datos.notas.trim() : '';
  normalizado.notas = notas ? notas.slice(0, 65535) : null;

  return normalizado;
}

// Guarda la fila de "provisioning" completa, con los valores derivados
// (db_name/storage_prefix a partir del slug, infra de la instancia de
// MySQL) ya resueltos — para que provisionar-tenant.js la complete sin
// tener que recalcular nada ni asumir config distinta.
async function crearTenantIntake(datos = {}, { actor, db = obtenerPool() } = {}) {
  let base;
  let fiscales;
  try {
    base = normalizarDatosBase(datos);
    fiscales = normalizarYValidarDatosFiscales(datos);
  } catch (err) {
    throw new ErrorIntakeTenant(err.message, 'validacion');
  }

  const [existentes] = await db.query('SELECT id FROM tenants WHERE slug = ?', [base.slug]);
  if (existentes.length > 0) {
    throw new ErrorIntakeTenant(
      `El slug "${base.slug}" ya está registrado. Elige otro o completa el alta pendiente en vez de duplicarlo.`,
      'slug_existe'
    );
  }

  const { db_host, db_user } = derivarInfraTenant();
  const db_name = nombreDbTenant(base.slug);

  let tenantId;
  try {
    const [insertResult] = await db.query(
      `INSERT INTO tenants
        (slug, nombre_empresa, estado, db_host, db_name, db_user, storage_prefix,
         contacto_email, notas, creado_en,
         rfc_compania, razon_social_compania, regimen_fiscal_compania,
         tipo_persona_compania, clave_sat, link_codigos_sat, correo_reportes)
       VALUES (?, ?, 'provisioning', ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?, ?)`,
      [
        base.slug,
        base.nombreEmpresa,
        db_host,
        db_name,
        db_user,
        base.slug, // storage_prefix = slug (mismo criterio que provisionar-tenant.js)
        base.contactoEmail,
        base.notas,
        new Date(),
        fiscales.rfcCompania,
        fiscales.razonSocialCompania,
        fiscales.regimenFiscalCompania,
        fiscales.tipoPersonaCompania,
        fiscales.claveSat,
        fiscales.linkCodigosSat,
        fiscales.correoReportes,
      ]
    );
    tenantId = insertResult.insertId;
  } catch (err) {
    // Condición de carrera contra otro alta simultánea del mismo slug: la
    // UNIQUE KEY de la tabla lo rechaza con ER_DUP_ENTRY — se traduce al
    // mismo 409 que la consulta previa, con el mismo mensaje.
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new ErrorIntakeTenant(
        `El slug "${base.slug}" ya está registrado. Elige otro o completa el alta pendiente en vez de duplicarlo.`,
        'slug_existe'
      );
    }
    throw err;
  }

  const tieneFiscales = tieneAlgunDatoFiscal(fiscales);
  await registrarEvento(
    db,
    tenantId,
    'alta_solicitada',
    `slug=${base.slug} db=${db_name}${tieneFiscales ? ' con datos fiscales' : ''}`,
    actor || null
  );

  return {
    id: tenantId,
    slug: base.slug,
    nombre_empresa: base.nombreEmpresa,
    estado: 'provisioning',
    db_host,
    db_name,
    db_user,
    storage_prefix: base.slug,
    contacto_email: base.contactoEmail,
    notas: base.notas,
    creado_en: new Date(),
    activado_en: null,
    suspendido_en: null,
    baja_en: null,
    rfc_compania: fiscales.rfcCompania,
    razon_social_compania: fiscales.razonSocialCompania,
    regimen_fiscal_compania: fiscales.regimenFiscalCompania,
    tipo_persona_compania: fiscales.tipoPersonaCompania,
    clave_sat: fiscales.claveSat,
    link_codigos_sat: fiscales.linkCodigosSat,
    correo_reportes: fiscales.correoReportes,
  };
}

module.exports = { ErrorIntakeTenant, crearTenantIntake };