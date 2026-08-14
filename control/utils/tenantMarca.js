// Actualización de la MARCA de un tenant (segmento "marca", ver
// PROJECT_STATE.md): el nombre con el que la empresa quiere ser
// reconocida en los correos del portal (en vez del nombre genérico
// "ADDV"), y el logo que lo acompaña si se subió uno.
//
// El logo NO se guarda en la BD de control: el contenedor control no
// tiene SDK de MinIO, así que se reenvía al backend principal por su
// endpoint interno (POST /internal/marca-logo/:slug, mismo patrón de
// secreto compartido que la invalidación de caché — ver
// notificarBackend.js) y el backend lo persiste en MinIO devolviendo la
// ruta pública relativa ("/api/marca-logo/<slug>") que se guarda en la
// fila. "Quitar logo" también se delega al backend (DELETE
// /internal/marca-logo/:slug) para borrar el archivo.

const { obtenerPool } = require('../db');
const { validarSlug } = require('./tenant');
const { notificarInvalidacionCache } = require('./notificarBackend');

const MAX_MARCA_LOGO_MB = Number(process.env.MAX_MARCA_LOGO_MB || 2);
const MAX_MARCA_LOGO_BYTES = MAX_MARCA_LOGO_MB * 1024 * 1024;
const MAX_MARCA_LEN = 255;

// Error tipado para que la capa de rutas distinga "el slug no existe"
// (404) de "los datos no pasan la validación" (400) y de "el backend no
// aceptó el logo" (502).
class ErrorMarcaTenant extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorMarcaTenant';
    this.codigo = codigo; // 'no_encontrado' | 'validacion' | 'backend'
  }
}

async function registrarEvento(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

// Valida que el contenido binario sea una imagen real (firma binaria),
// no solo que el MIME declarado lo parezca — mismo criterio que el
// backend (detectRealImageMimeType). Duplicado mínimo aquí porque
// control/ es un contexto de build aparte que no puede importar código
// de backend/ (mismo principio que asegurarColumnasCicloVidaTenant).
function detectarMimeImagen(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  const firmaPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= firmaPng.length && firmaPng.every((b, i) => buffer[i] === b)) {
    return 'image/png';
  }
  if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

async function subirLogoAlBackend(slug, buffer) {
  const url = `${process.env.BACKEND_INTERNAL_URL || 'http://backend:4000'}/internal/marca-logo/${slug}`;
  const secreto = process.env.INTERNAL_CACHE_SECRET;
  const mime = detectarMimeImagen(buffer);
  if (!mime) {
    throw new ErrorMarcaTenant('El archivo del logo no es una imagen válida (JPG, PNG o WEBP).', 'validacion');
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': secreto || '',
      },
      body: JSON.stringify({ base64: buffer.toString('base64'), mime }),
    });
  } catch (err) {
    throw new ErrorMarcaTenant('No se pudo conectar con el servicio de almacenamiento.', 'backend');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ErrorMarcaTenant(data.error || 'El servicio de almacenamiento rechazó el logo.', 'backend');
  }

  const data = await res.json().catch(() => ({}));
  return data.url || null;
}

async function borrarLogoDelBackend(slug) {
  const url = `${process.env.BACKEND_INTERNAL_URL || 'http://backend:4000'}/internal/marca-logo/${slug}`;
  const secreto = process.env.INTERNAL_CACHE_SECRET;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-Internal-Secret': secreto || '' },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error('El servicio de almacenamiento rechazó el borrado.');
    }
  } catch (err) {
    // Borrar el archivo es secundario: la columna marca_logo_url se
    // limpia igualmente abajo (el logo simplemente deja de referenciarse).
    console.error(`No se pudo borrar el logo de "${slug}" del almacenamiento:`, err.message);
  }
}

// Actualiza marca (y opcionalmente logo) de un tenant existente.
// `datos`:
//   marca: string opcional (<= 255) — vacío/ausente deja la marca actual.
//   logoBase64: string opcional — logo nuevo; si viene, se reemplaza el
//     anterior en MinIO.
//   quitarLogo: boolean — si es true, borra el logo y deja la marca sin
//     logo (solo texto).
// Devuelve la fila completa del tenant después del UPDATE.
async function actualizarMarcaTenant(slug, datos = {}, { actor, db = obtenerPool() } = {}) {
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    throw new ErrorMarcaTenant(errorSlug, 'validacion');
  }

  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  const tenant = filas[0];
  if (!tenant) {
    throw new ErrorMarcaTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  let marca = tenant.marca;
  if (typeof datos.marca === 'string') {
    marca = datos.marca.trim();
    if (marca.length > MAX_MARCA_LEN) {
      throw new ErrorMarcaTenant(`La marca no puede superar los ${MAX_MARCA_LEN} caracteres.`, 'validacion');
    }
    marca = marca || null;
  }

  let marcaLogoUrl = tenant.marca_logo_url;
  let logoAccion = 'sin_cambios';

  if (datos.quitarLogo === true) {
    await borrarLogoDelBackend(slug);
    marcaLogoUrl = null;
    logoAccion = 'quitado';
  } else if (typeof datos.logoBase64 === 'string' && datos.logoBase64.length > 0) {
    let buffer;
    try {
      buffer = Buffer.from(datos.logoBase64, 'base64');
    } catch (err) {
      throw new ErrorMarcaTenant('El contenido del logo no es un base64 válido.', 'validacion');
    }
    if (buffer.length === 0) {
      throw new ErrorMarcaTenant('El logo está vacío.', 'validacion');
    }
    if (buffer.length > MAX_MARCA_LOGO_BYTES) {
      throw new ErrorMarcaTenant(`El logo excede el tamaño máximo permitido de ${MAX_MARCA_LOGO_MB} MB.`, 'validacion');
    }
    marcaLogoUrl = await subirLogoAlBackend(slug, buffer);
    logoAccion = 'subido';
  }

  const [resultado] = await db.query(
    'UPDATE tenants SET marca = ?, marca_logo_url = ? WHERE slug = ?',
    [marca, marcaLogoUrl, slug]
  );
  if (resultado.affectedRows === 0) {
    throw new ErrorMarcaTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  const [filasActualizadas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  const tenantActualizado = filasActualizadas[0];

  await registrarEvento(
    db,
    tenantActualizado.id,
    'marca_actualizada',
    `slug=${slug} logo=${logoAccion}${marca ? ` marca="${marca}"` : ''}`,
    actor || null
  );

  // El backend cachea la resolución de tenant (incluida la marca); se le
  // avisa para que el próximo correo use la marca nueva sin esperar el TTL.
  try {
    await notificarInvalidacionCache(slug);
  } catch (err) {
    console.error(`No se pudo invalidar la caché del backend para "${slug}":`, err.message);
  }

  return tenantActualizado;
}

module.exports = { ErrorMarcaTenant, actualizarMarcaTenant, subirLogoAlBackend, MAX_MARCA_LOGO_MB };
