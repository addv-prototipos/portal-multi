// Actualización del TEMA / identidad visual de un tenant (segmento
// "Look & Feel", ver PROJECT_STATE.md): paleta de colores, tipografías,
// radio de esquinas y favicon que personalizan el portal de la empresa
// sobre el diseño base ADDV. El tema se guarda como JSON en
// control_tenants.tenants.tema_json (TEXT NULL = diseño base ADDV).
//
// El favicon NO se guarda en la BD de control: se reenvía al backend
// principal por su endpoint interno (POST /internal/favicon/:slug, mismo
// patrón de secreto compartido que el logo de marca — ver
// tenantMarca.js) y el backend lo persiste en MinIO devolviendo la ruta
// pública relativa que se guarda dentro del tema. "Quitar favicon"
// también se delega al backend (DELETE /internal/favicon/:slug).
//
// La validación del tema está DUPLICADA aquí a propósito (control/ es un
// contexto de build aparte que no puede importar backend/utils/
// tenantTema.js — mismo principio que tenantMarca.js con la firma de
// imagen). El catálogo de fuentes/radios debe mantenerse idéntico en
// ambos lados, igual que el cálculo de contraste WCAG 2.1 AA.

const { obtenerPool } = require('../db');
const { validarSlug } = require('./tenant');
const { notificarInvalidacionCache } = require('./notificarBackend');

// ---------- Catálogo (idéntico a backend/utils/tenantTema.js) ----------

const FUENTES = {
  'source-serif-4': { etiqueta: 'Source Serif 4 (serif)', tipo: 'display' },
  inter: { etiqueta: 'Inter (sans)', tipo: 'cuerpo' },
  lora: { etiqueta: 'Lora (serif)', tipo: 'display' },
  'playfair-display': { etiqueta: 'Playfair Display (serif)', tipo: 'display' },
  merriweather: { etiqueta: 'Merriweather (serif)', tipo: 'display' },
  'open-sans': { etiqueta: 'Open Sans (sans)', tipo: 'cuerpo' },
  roboto: { etiqueta: 'Roboto (sans)', tipo: 'cuerpo' },
  'source-sans-3': { etiqueta: 'Source Sans 3 (sans)', tipo: 'cuerpo' },
};

const RADIOS = { sm: 'Sutil', md: 'Medio', lg: 'Redondeado' };

const CLAVES_COLOR = {
  bg: 'Fondo general',
  surface: 'Superficie (tarjetas)',
  border: 'Bordes',
  ink: 'Texto principal',
  inkSoft: 'Texto secundario',
  accent: 'Color de acción principal',
  accentDark: 'Color de acción oscuro',
  accentSoft: 'Fondo suave de acción',
  warn: 'Advertencia',
  warnSoft: 'Fondo suave de advertencia',
  error: 'Error',
  errorSoft: 'Fondo suave de error',
};

const HEX_REGEX = /^#([0-9a-fA-F]{6})$/;
const MAX_FAVICON_MB = 2;

class ErrorTemaTenant extends Error {
  constructor(motivo, codigo) {
    super(motivo);
    this.name = 'ErrorTemaTenant';
    this.codigo = codigo; // 'no_encontrado' | 'validacion' | 'backend'
  }
}

// ---------- Contraste WCAG 2.1 AA (misma fórmula que el backend) ----------

function luminanciaRelativa(hex) {
  const valores = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : Math.pow((canal + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * valores[0] + 0.7152 * valores[1] + 0.0722 * valores[2];
}

function ratioContraste(hexA, hexB) {
  const l1 = luminanciaRelativa(hexA);
  const l2 = luminanciaRelativa(hexB);
  const masClaro = Math.max(l1, l2);
  const masOscuro = Math.min(l1, l2);
  return (masClaro + 0.05) / (masOscuro + 0.05);
}

// ---------- Validación ----------

// Valida y normaliza el objeto tema enviado por el administrador.
// Devuelve el tema normalizado listo para JSON.stringify. Lanza
// ErrorTemaTenant('validacion') si algo no pasa.
function normalizarTema(datos = {}) {
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new ErrorTemaTenant('El tema debe ser un objeto.', 'validacion');
  }

  const tema = {};

  // Colores: solo las claves del catálogo, hex de 6 dígitos, y contraste
  // AA sobre los pares completos.
  const coloresEntrada = datos.colores || {};
  if (coloresEntrada !== null && typeof coloresEntrada === 'object' && !Array.isArray(coloresEntrada)) {
    const colores = {};
    for (const clave of Object.keys(CLAVES_COLOR)) {
      const valor = coloresEntrada[clave];
      if (valor === null || valor === undefined || valor === '') continue;
      if (typeof valor !== 'string' || !HEX_REGEX.test(valor)) {
        throw new ErrorTemaTenant(`${CLAVES_COLOR[clave]} debe ser un color hexadecimal (#RRGGBB).`, 'validacion');
      }
      colores[clave] = valor.toLowerCase();
    }
    if (Object.keys(colores).length > 0) tema.colores = colores;

    if (tema.colores) {
      const errores = [];
      const exige = (fondo, texto, minimo, descripcion) => {
        if (!colores[fondo] || !colores[texto]) return;
        const ratio = ratioContraste(colores[fondo], colores[texto]);
        if (ratio < minimo) {
          errores.push(
            `${descripcion} no cumple contraste AA (${ratio.toFixed(2)}:1, mínimo ${minimo}:1).`
          );
        }
      };
      exige('bg', 'ink', 4.5, 'El texto principal sobre el fondo');
      exige('surface', 'ink', 4.5, 'El texto principal sobre las tarjetas');
      exige('surface', 'inkSoft', 4.5, 'El texto secundario sobre las tarjetas');
      exige('bg', 'warn', 4.5, 'El texto de advertencia');
      exige('bg', 'error', 4.5, 'El texto de error');
      exige('accent', '#FFFFFF', 3, 'El texto blanco sobre los botones principales');
      exige('accentDark', '#FFFFFF', 3, 'El texto blanco sobre los botones oscuros');
      exige('surface', 'accent', 3, 'Los enlaces de color de acción');
      exige('accentSoft', 'accentDark', 3, 'El texto de acción sobre su fondo suave');
      if (errores.length > 0) {
        throw new ErrorTemaTenant(errores[0], 'validacion');
      }
    }
  } else if (datos.colores !== undefined) {
    throw new ErrorTemaTenant('"colores" debe ser un objeto.', 'validacion');
  }

  // Tipografía: solo claves del catálogo (nunca texto libre).
  const tipografiaEntrada = datos.tipografia || {};
  if (tipografiaEntrada !== null && typeof tipografiaEntrada === 'object' && !Array.isArray(tipografiaEntrada)) {
    const tipografia = {};
    if (tipografiaEntrada.display) {
      const fuente = FUENTES[tipografiaEntrada.display];
      if (!fuente || fuente.tipo !== 'display') {
        throw new ErrorTemaTenant('La tipografía de títulos no está en el catálogo.', 'validacion');
      }
      tipografia.display = tipografiaEntrada.display;
    }
    if (tipografiaEntrada.cuerpo) {
      const fuente = FUENTES[tipografiaEntrada.cuerpo];
      if (!fuente || fuente.tipo !== 'cuerpo') {
        throw new ErrorTemaTenant('La tipografía de cuerpo no está en el catálogo.', 'validacion');
      }
      tipografia.cuerpo = tipografiaEntrada.cuerpo;
    }
    if (Object.keys(tipografia).length > 0) tema.tipografia = tipografia;
  } else if (datos.tipografia !== undefined) {
    throw new ErrorTemaTenant('"tipografia" debe ser un objeto.', 'validacion');
  }

  // Radio de esquinas.
  if (datos.radio) {
    if (!RADIOS[datos.radio]) {
      throw new ErrorTemaTenant('El radio de esquinas debe ser "sm", "md" o "lg".', 'validacion');
    }
    tema.radio = datos.radio;
  }

  // Favicon: ruta pública del propio tenant (la arma el backend al subir).
  if (datos.faviconUrl !== null && datos.faviconUrl !== undefined && datos.faviconUrl !== '') {
    if (typeof datos.faviconUrl !== 'string' || !/^\/api\/favicon\/[a-z0-9][a-z0-9-]{0,48}$/.test(datos.faviconUrl)) {
      throw new ErrorTemaTenant('El favicon debe ser la ruta pública del tenant.', 'validacion');
    }
    tema.faviconUrl = datos.faviconUrl;
  }

  return tema;
}

// ---------- Favicon (reenvío al backend, patrón del logo de marca) ----------

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

async function subirFaviconAlBackend(slug, buffer) {
  const url = `${process.env.BACKEND_INTERNAL_URL || 'http://backend:4000'}/internal/favicon/${slug}`;
  const secreto = process.env.INTERNAL_CACHE_SECRET;
  const mime = detectarMimeImagen(buffer);
  if (!mime) {
    throw new ErrorTemaTenant('El archivo del favicon no es una imagen válida (JPG, PNG o WEBP).', 'validacion');
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
    throw new ErrorTemaTenant('No se pudo conectar con el servicio de almacenamiento.', 'backend');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ErrorTemaTenant(data.error || 'El servicio de almacenamiento rechazó el favicon.', 'backend');
  }

  const data = await res.json().catch(() => ({}));
  return data.url || null;
}

async function borrarFaviconDelBackend(slug) {
  const url = `${process.env.BACKEND_INTERNAL_URL || 'http://backend:4000'}/internal/favicon/${slug}`;
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
    console.error(`No se pudo borrar el favicon de "${slug}" del almacenamiento:`, err.message);
  }
}

// ---------- Actualización ----------

// Actualiza el tema de un tenant existente. `datos`:
//   tema: objeto con las claves del tema (colores/tipografia/radio)
//   faviconBase64: string opcional — favicon nuevo (se sube a MinIO).
//   quitarFavicon: boolean — borra el favicon actual del tema.
//   restablecer: true — devuelve el tenant a NULL (diseño base ADDV) y
//     borra el favicon si existía.
// Devuelve la fila completa del tenant después del UPDATE.
async function actualizarTemaTenant(slug, datos = {}, { actor, db = obtenerPool() } = {}) {
  const errorSlug = validarSlug(slug);
  if (errorSlug) {
    throw new ErrorTemaTenant(errorSlug, 'validacion');
  }

  const [filas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  const tenant = filas[0];
  if (!tenant) {
    throw new ErrorTemaTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  // Restablecer: NULL (diseño base) y limpieza del favicon en MinIO.
  if (datos.restablecer === true) {
    const temaActual = leerTemaActual(tenant);
    if (temaActual && temaActual.faviconUrl) {
      await borrarFaviconDelBackend(slug);
    }
    await db.query('UPDATE tenants SET tema_json = NULL WHERE slug = ?', [slug]);
    const [filasActualizadas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
    await registrarEvento(db, filasActualizadas[0].id, 'tema_actualizado', 'slug=' + slug + ' accion=restablecer', actor || null);
    try {
      await notificarInvalidacionCache(slug);
    } catch (err) {
      console.error(`No se pudo invalidar la caché del backend para "${slug}":`, err.message);
    }
    return filasActualizadas[0];
  }

  // Tema nuevo (completo o parcial; NULL no se acepta: se usa
  // restablecer para volver al diseño base).
  if (datos.tema === null || datos.tema === undefined || typeof datos.tema !== 'object' || Array.isArray(datos.tema)) {
    throw new ErrorTemaTenant('Falta el tema a guardar.', 'validacion');
  }
  const tema = normalizarTema(datos.tema);
  const temaActual = leerTemaActual(tenant);

  // Favicon: subida nueva o quitar.
  if (datos.quitarFavicon === true) {
    await borrarFaviconDelBackend(slug);
    tema.faviconUrl = null;
  } else if (typeof datos.faviconBase64 === 'string' && datos.faviconBase64.length > 0) {
    let buffer;
    try {
      buffer = Buffer.from(datos.faviconBase64, 'base64');
    } catch (err) {
      throw new ErrorTemaTenant('El contenido del favicon no es un base64 válido.', 'validacion');
    }
    if (buffer.length === 0) {
      throw new ErrorTemaTenant('El favicon está vacío.', 'validacion');
    }
    if (buffer.length > MAX_FAVICON_MB * 1024 * 1024) {
      throw new ErrorTemaTenant(`El favicon excede el tamaño máximo permitido de ${MAX_FAVICON_MB} MB.`, 'validacion');
    }
    tema.faviconUrl = await subirFaviconAlBackend(slug, buffer);
  } else if (temaActual && temaActual.faviconUrl) {
    // Sin favicon nuevo: se conserva el que ya tenía el tenant.
    tema.faviconUrl = temaActual.faviconUrl;
  }

  // Se borra la clave si quedó null (favicon quitado sin tema).
  if (tema.faviconUrl === null) {
    delete tema.faviconUrl;
  }

  const temaJson = Object.keys(tema).length > 0 ? JSON.stringify(tema) : null;

  const [resultado] = await db.query('UPDATE tenants SET tema_json = ? WHERE slug = ?', [temaJson, slug]);
  if (resultado.affectedRows === 0) {
    throw new ErrorTemaTenant(`El tenant "${slug}" no existe.`, 'no_encontrado');
  }

  const [filasActualizadas] = await db.query('SELECT * FROM tenants WHERE slug = ?', [slug]);
  const tenantActualizado = filasActualizadas[0];

  await registrarEvento(
    db,
    tenantActualizado.id,
    'tema_actualizado',
    `slug=${slug} colores=${Object.keys(tema.colores || {}).length} tipografia=${tema.tipografia ? 'si' : 'no'} radio=${tema.radio || 'default'} favicon=${tema.faviconUrl ? 'si' : 'no'}`,
    actor || null
  );

  // El backend cachea la resolución de tenant (incluido el tema); se le
  // avisa para que el portal aplique la identidad nueva sin esperar el TTL.
  try {
    await notificarInvalidacionCache(slug);
  } catch (err) {
    console.error(`No se pudo invalidar la caché del backend para "${slug}":`, err.message);
  }

  return tenantActualizado;
}

function leerTemaActual(tenant) {
  if (!tenant || typeof tenant.tema_json !== 'string' || !tenant.tema_json.trim()) return null;
  try {
    return JSON.parse(tenant.tema_json);
  } catch (err) {
    return null;
  }
}

async function registrarEvento(db, tenantId, tipo, detalle, actor) {
  await db.query(
    `INSERT INTO tenant_eventos (tenant_id, tipo, detalle, actor, creado_en)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, tipo, detalle, actor, new Date()]
  );
}

module.exports = { ErrorTemaTenant, actualizarTemaTenant, normalizarTema, subirFaviconAlBackend, borrarFaviconDelBackend };