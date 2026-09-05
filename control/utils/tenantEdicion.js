// Edición de los datos de una empresa existente desde /control (segmento
// "edición", ver PROJECT_STATE.md punto 104): los MISMOS campos que se
// capturan en el alta (nombre, contacto, notas, marca y logo)
// más el slug — que solo puede cambiar si el operador lo habilita
// explícitamente (switch "Cambiar slug (avanzado)" en la UI).
//
// El slug es la identidad pública del tenant (URLs /<slug>/... y prefijo
// de archivos en MinIO), así que cambiarlo dispara una migración real
// ANTES de tocar la fila: el backend principal mueve TODOS los objetos
// del tenant (`<slug_viejo>/...` y `marca/<slug_viejo>/logo`) al slug
// nuevo por su endpoint interno /internal/renombrar-slug. nginx no
// necesita nada (sus rutas de tenant son regex dinámicas); la BD física
// del tenant NO se renombra (el backend se conecta por db_name guardado
// en la fila): en tenants ya aprovisionados db_name se conserva, y solo
// en estado 'provisioning' (BD todavía no creada) se regenera con el slug
// nuevo (provisionar-tenant.js usa el db_name de la fila).

const { obtenerPool } = require('../db');
const { validarSlug, nombreDbTenant } = require('./tenant');
const { normalizarDatosBase } = require('./tenantIntake');
const { subirLogoAlBackend, borrarLogoDelBackend, MAX_MARCA_LOGO_MB } = require('./tenantMarca');
const { notificarInvalidacionCache } = require('./notificarBackend');

// Error tipado para que la capa de rutas distinga: slug inexistente (404),
// datos inválidos (400), slug nuevo duplicado (409) y migración rechazada
// por el backend (502).
class ErrorEdicionTenant extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorEdicionTenant';
    this.codigo = codigo; // 'no_encontrado' | 'validacion' | 'slug_existe' | 'backend'
  }
}

async function registrarEvento(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

// Delega al backend la migración de todos los archivos del tenant al slug
// nuevo (prefijo + logo de marca). Lanza ErrorEdicionTenant 'backend' si
// el backend no puede alcanzarse o rechaza la migración.
async function migrarSlugEnBackend(slugAnterior, slugNuevo) {
  const url = `${process.env.BACKEND_INTERNAL_URL || 'http://backend:4000'}/internal/renombrar-slug`;
  const secreto = process.env.INTERNAL_CACHE_SECRET;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secreto || '',
      },
      body: JSON.stringify({ slugAnterior, slugNuevo }),
    });
  } catch (err) {
    throw new ErrorEdicionTenant('No se pudo conectar con el servicio de almacenamiento.', 'backend');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ErrorEdicionTenant(data.error || 'El servicio de almacenamiento rechazó el cambio de slug.', 'backend');
  }
}

// Devuelve el detalle de qué campos cambiaron (para el evento de
// auditoría), comparando la fila actual contra los valores normalizados.
function construirDetalleCambios(tenant, base, slugNuevo, logoAccion) {
  const cambios = [];
  if (slugNuevo) cambios.push(`slug: ${tenant.slug} -> ${slugNuevo}`);
  if (base.nombreEmpresa !== tenant.nombre_empresa) cambios.push(`nombre: "${tenant.nombre_empresa}" -> "${base.nombreEmpresa}"`);
  if (base.contactoEmail !== (tenant.contacto_email || null)) cambios.push('contacto_email');
  if (base.notas !== (tenant.notas || null)) cambios.push('notas');
  if (base.marca !== (tenant.marca || null)) cambios.push('marca');
  if (logoAccion === 'subido') cambios.push('logo: subido');
  if (logoAccion === 'quitado') cambios.push('logo: quitado');
  return cambios.length > 0 ? cambios.join(', ') : 'sin cambios';
}

// Actualiza los datos editables de un tenant existente.
// `datos` (todos opcionales salvo nombreEmpresa):
//   nombreEmpresa, contactoEmail, notas, marca, logoBase64?, quitarLogo?
//   slug?: solo se aplica si viene un slug distinto al actual y el
//     operador lo pidió explícitamente (validado como slug nuevo: formato
//     + no reservado + no duplicado). Dispara la migración de archivos en
//     el backend antes del UPDATE.
// Devuelve la fila completa del tenant después del UPDATE.
async function actualizarDatosTenant(slug, datos = {}, { actor, db = obtenerPool() } = {}) {
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    throw new ErrorEdicionTenant(errorSlug, 'validacion');
  }

  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  const tenant = filas[0];
  if (!tenant) {
    throw new ErrorEdicionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  let base;
  try {
    base = normalizarDatosBase({ ...datos, slug: tenant.slug });
  } catch (err) {
    throw new ErrorEdicionTenant(err.message, 'validacion');
  }

  // Slug nuevo (opcional): solo si viene un valor distinto al actual.
  let slugNuevo = null;
  if (typeof datos.slug === 'string' && datos.slug.trim() && datos.slug.trim().toLowerCase() !== tenant.slug) {
    const slugPropuesto = datos.slug.trim().toLowerCase();
    const errorSlugNuevo = validarSlug(slugPropuesto);
    if (errorSlugNuevo) {
      throw new ErrorEdicionTenant(errorSlugNuevo, 'validacion');
    }
    const [duplicados] = await db.query('SELECT id FROM tenants WHERE slug = ? AND id <> ?', [slugPropuesto, tenant.id]);
    if (duplicados.length > 0) {
      throw new ErrorEdicionTenant(
        `El slug "${slugPropuesto}" ya está registrado por otra empresa. Elige otro.`,
        'slug_existe'
      );
    }
    slugNuevo = slugPropuesto;
  }

  // Logo: misma semántica que actualizarMarcaTenant — nuevo logo (se sube
  // al slug FINAL, después de la migración, para que no lo pise), o
  // quitarLogo (se borra del slug final).
  let marcaLogoUrl = tenant.marca_logo_url;
  let logoAccion = 'sin_cambios';
  const slugLogo = slugNuevo || tenant.slug;

  if (slugNuevo) {
    await migrarSlugEnBackend(tenant.slug, slugNuevo);
    // Con slug nuevo, la ruta guardada siempre apunta al slug nuevo; la
    // migración ya movió el archivo (si existía).
    marcaLogoUrl = marcaLogoUrl ? `/api/marca-logo/${slugNuevo}` : null;
  }

  if (datos.quitarLogo === true) {
    await borrarLogoDelBackend(slugLogo);
    marcaLogoUrl = null;
    logoAccion = 'quitado';
  } else if (typeof datos.logoBase64 === 'string' && datos.logoBase64.length > 0) {
    let buffer;
    try {
      buffer = Buffer.from(datos.logoBase64, 'base64');
    } catch (err) {
      throw new ErrorEdicionTenant('El contenido del logo no es un base64 válido.', 'validacion');
    }
    if (buffer.length === 0) {
      throw new ErrorEdicionTenant('El logo está vacío.', 'validacion');
    }
    if (buffer.length > MAX_MARCA_LOGO_MB * 1024 * 1024) {
      throw new ErrorEdicionTenant(`El logo excede el tamaño máximo permitido de ${MAX_MARCA_LOGO_MB} MB.`, 'validacion');
    }
    marcaLogoUrl = await subirLogoAlBackend(slugLogo, buffer);
    logoAccion = 'subido';
  }

  // La BD física del tenant NO se renombra: db_name se conserva tal cual
  // en tenants ya aprovisionados; solo en 'provisioning' (BD aún no
  // creada) se regenera con el slug nuevo para que provisionar-tenant.js
  // cree la BD con el nombre correcto.
  const dbNameFinal =
    slugNuevo && tenant.estado === 'provisioning' ? nombreDbTenant(slugNuevo) : tenant.db_name;
  const storagePrefixFinal = slugNuevo || tenant.storage_prefix;

  // Tema (segmento "Look & Feel"): con slug nuevo, la ruta del favicon
  // dentro de tema_json debe apuntar al slug nuevo (la migración de
  // /internal/renombrar-slug ya movió el archivo a marca/<nuevo>/favicon);
  // el resto del tema viaja con la fila sin cambios.
  let temaJsonFinal = tenant.tema_json;
  if (slugNuevo && typeof temaJsonFinal === 'string' && temaJsonFinal.trim()) {
    try {
      const temaParseado = JSON.parse(temaJsonFinal);
      if (temaParseado && typeof temaParseado.faviconUrl === 'string') {
        const faviconNuevo = `/api/favicon/${slugNuevo}`;
        if (temaParseado.faviconUrl !== faviconNuevo) {
          temaParseado.faviconUrl = faviconNuevo;
          temaJsonFinal = JSON.stringify(temaParseado);
        }
      }
    } catch (err) {
      // tema_json corrupto: se conserva tal cual (el backend lo degrada
      // al diseño base al leerlo y lo loguea para corregirlo).
    }
  }

  const [resultado] = await db.query(
    `UPDATE tenants SET
       slug = ?, nombre_empresa = ?, contacto_email = ?, notas = ?,
       db_name = ?, storage_prefix = ?,
       marca = ?, marca_logo_url = ?, tema_json = ?
     WHERE id = ?`,
    [
      slugNuevo || tenant.slug,
      base.nombreEmpresa,
      base.contactoEmail,
      base.notas,
      dbNameFinal,
      storagePrefixFinal,
      base.marca,
      marcaLogoUrl,
      temaJsonFinal,
      tenant.id,
    ]
  );
  if (resultado.affectedRows === 0) {
    throw new ErrorEdicionTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  const [filasActualizadas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slugNuevo || tenant.slug]);
  const tenantActualizado = filasActualizadas[0];

  await registrarEvento(
    db,
    tenantActualizado.id,
    slugNuevo ? 'slug_cambiado' : 'datos_actualizados',
    slugNuevo ? `slug: ${tenant.slug} -> ${slugNuevo}` : construirDetalleCambios(tenant, base, null, logoAccion),
    actor || null
  );

  // El backend cachea la resolución de tenant por slug: invalidar el slug
  // viejo (si cambió) y el actual para que las URLs nuevas funcionen ya.
  const slugsAInvalidar = slugNuevo ? [tenant.slug, slugNuevo] : [tenant.slug];
  for (const s of slugsAInvalidar) {
    try {
      await notificarInvalidacionCache(s);
    } catch (err) {
      console.error(`No se pudo invalidar la caché del backend para "${s}":`, err.message);
    }
  }

  return tenantActualizado;
}

module.exports = { ErrorEdicionTenant, actualizarDatosTenant };