// Tema / identidad visual de un tenant (segmento "Look & Feel", ver
// PROJECT_STATE.md punto 105): valida y normaliza el JSON de tema que
// guarda control_tenants.tenants.tema_json, y calcula el contraste
// WCAG 2.1 AA de la paleta. NULL = identidad base "ADDV" (la que define
// frontend/style.css); el tema solo agrega valores para las variables
// que el tenant quiera personalizar.
//
// Formato del tema (todas las claves opcionales; las que falten las
// cubre el diseño base):
// {
//   "colores": {
//     "bg", "surface", "border", "ink", "inkSoft",
//     "accent", "accentDark", "accentSoft",
//     "warn", "warnSoft", "error", "errorSoft"
//   },
//   "tipografia": { "display": "source-serif-4", "cuerpo": "inter" },
//   "radio": "md",            // "sm" | "md" | "lg"
//   "faviconUrl": "/api/favicon/<slug>" | null
// }
//
// Los nombres de fuentes NO son texto libre: son claves del catálogo
// FUENTES (con la URL de Google Fonts y el nombre real de la familia),
// para que el frontend no tenga que validar una string arbitraria ni
// haya riesgo de inyección en el <link> dinámico.

const FUENTES = {
  // Display / cuerpo — el par por defecto del diseño base ADDV.
  'source-serif-4': {
    etiqueta: 'Source Serif 4 (serif)',
    familia: 'Source Serif 4',
    urlGoogle: 'https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&display=swap',
    tipo: 'display',
  },
  inter: {
    etiqueta: 'Inter (sans)',
    familia: 'Inter',
    urlGoogle: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    tipo: 'cuerpo',
  },
  // Alternativas del catálogo de personalización.
  lora: {
    etiqueta: 'Lora (serif)',
    familia: 'Lora',
    urlGoogle: 'https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&display=swap',
    tipo: 'display',
  },
  'playfair-display': {
    etiqueta: 'Playfair Display (serif)',
    familia: 'Playfair Display',
    urlGoogle: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap',
    tipo: 'display',
  },
  merriweather: {
    etiqueta: 'Merriweather (serif)',
    familia: 'Merriweather',
    urlGoogle: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
    tipo: 'display',
  },
  'open-sans': {
    etiqueta: 'Open Sans (sans)',
    familia: 'Open Sans',
    urlGoogle: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap',
    tipo: 'cuerpo',
  },
  roboto: {
    etiqueta: 'Roboto (sans)',
    familia: 'Roboto',
    urlGoogle: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    tipo: 'cuerpo',
  },
  'source-sans-3': {
    etiqueta: 'Source Sans 3 (sans)',
    familia: 'Source Sans 3',
    urlGoogle: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap',
    tipo: 'cuerpo',
  },
};

const RADIOS = {
  sm: { etiqueta: 'Sutil', sm: '4px', md: '8px', lg: '12px' },
  md: { etiqueta: 'Medio', sm: '6px', md: '10px', lg: '16px' },
  lg: { etiqueta: 'Redondeado', sm: '10px', md: '14px', lg: '20px' },
};

// Claves de color que acepta un tema, y su propósito (para mensajes de
// error legibles y para saber qué pares de contraste validar).
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

// ---------- Contraste WCAG 2.1 ----------

function luminanciaRelativa(hex) {
  const valores = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : Math.pow((canal + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * valores[0] + 0.7152 * valores[1] + 0.0722 * valores[2];
}

// Ratio de contraste entre dos colores hex (1 a 21).
function ratioContraste(hexA, hexB) {
  const l1 = luminanciaRelativa(hexA);
  const l2 = luminanciaRelativa(hexB);
  const masClaro = Math.max(l1, l2);
  const masOscuro = Math.min(l1, l2);
  return (masClaro + 0.05) / (masOscuro + 0.05);
}

// ---------- Validación ----------

// Valida que `hex` sea un color hexadecimal de 6 dígitos. Devuelve el
// error o null.
function validarColor(hex, clave) {
  if (typeof hex !== 'string' || !HEX_REGEX.test(hex)) {
    return `${CLAVES_COLOR[clave] || clave} debe ser un color hexadecimal (#RRGGBB).`;
  }
  return null;
}

// Pares de contraste que el piso de accesibilidad exige en AA:
//  - texto normal (ink, inkSoft, warn, error) sobre su fondo
//  - texto blanco sobre accent/accentDark (botones principales)
//  - accent como texto sobre surface (enlaces)
//  - accentDark como texto sobre accentSoft (badges)
// El ratio mínimo depende del tamaño: 4.5:1 para texto normal, 3:1 para
// texto grande (>=18.66px bold o >=24px) y elementos de UI. Aquí se exige
// 4.5 para texto y 3 para UI, igual que el default del diseño base.
function validarContraste(tema, colores) {
  const errores = [];
  const exige = (fondo, texto, claveTexto, minimo, descripcion) => {
    if (!colores[fondo] || !colores[texto]) return;
    const ratio = ratioContraste(colores[fondo], colores[texto]);
    if (ratio < minimo) {
      errores.push(
        `${descripcion} no cumple contraste AA (${ratio.toFixed(2)}:1, mínimo ${minimo}:1). ` +
          `Revisa ${CLAVES_COLOR[texto]} y ${CLAVES_COLOR[fondo]}.`
      );
    }
  };

  exige('bg', 'ink', 'ink', 4.5, 'El texto principal sobre el fondo');
  exige('surface', 'ink', 'ink', 4.5, 'El texto principal sobre las tarjetas');
  exige('surface', 'inkSoft', 'inkSoft', 4.5, 'El texto secundario sobre las tarjetas');
  exige('bg', 'warn', 'warn', 4.5, 'El texto de advertencia');
  exige('bg', 'error', 'error', 4.5, 'El texto de error');
  exige('accent', '#FFFFFF', 'accent', 3, 'El texto blanco sobre los botones principales');
  exige('accentDark', '#FFFFFF', 'accentDark', 3, 'El texto blanco sobre los botones oscuros');
  exige('surface', 'accent', 'accent', 3, 'Los enlaces de color de acción sobre el fondo');
  exige('accentSoft', 'accentDark', 'accentDark', 3, 'El texto de acción sobre su fondo suave');

  return errores;
}

// Valida y normaliza un objeto tema (parcial). Devuelve el tema completo
// normalizado (solo las claves válidas presentes). Lanza Error con el
// mensaje si algún valor no pasa (el caller decide el código HTTP).
function normalizarTema(datos = {}) {
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new Error('El tema debe ser un objeto.');
  }

  const tema = {};

  // --- Colores ---
  const coloresEntrada = datos.colores || {};
  if (coloresEntrada !== null && typeof coloresEntrada === 'object' && !Array.isArray(coloresEntrada)) {
    const colores = {};
    for (const clave of Object.keys(CLAVES_COLOR)) {
      const valor = coloresEntrada[clave];
      if (valor === null || valor === undefined || valor === '') continue; // no personaliza
      const error = validarColor(valor, clave);
      if (error) throw new Error(error);
      colores[clave] = valor.toLowerCase();
    }
    if (Object.keys(colores).length > 0) tema.colores = colores;

    // Contraste AA solo sobre los pares completos (fondo y texto ambos definidos).
    if (tema.colores) {
      const errores = validarContraste(tema, colores);
      if (errores.length > 0) {
        throw new Error(errores[0]);
      }
    }
  } else if (datos.colores !== undefined) {
    throw new Error('"colores" debe ser un objeto.');
  }

  // --- Tipografía ---
  const tipografiaEntrada = datos.tipografia || {};
  if (tipografiaEntrada !== null && typeof tipografiaEntrada === 'object' && !Array.isArray(tipografiaEntrada)) {
    const tipografia = {};
    const display = tipografiaEntrada.display;
    if (display !== null && display !== undefined && display !== '') {
      const fuente = FUENTES[display];
      if (!fuente || fuente.tipo !== 'display') {
        throw new Error('La tipografía de títulos no está en el catálogo.');
      }
      tipografia.display = display;
    }
    const cuerpo = tipografiaEntrada.cuerpo;
    if (cuerpo !== null && cuerpo !== undefined && cuerpo !== '') {
      const fuente = FUENTES[cuerpo];
      if (!fuente || fuente.tipo !== 'cuerpo') {
        throw new Error('La tipografía de cuerpo no está en el catálogo.');
      }
      tipografia.cuerpo = cuerpo;
    }
    if (Object.keys(tipografia).length > 0) tema.tipografia = tipografia;
  } else if (datos.tipografia !== undefined) {
    throw new Error('"tipografia" debe ser un objeto.');
  }

  // --- Radio de esquinas ---
  if (datos.radio !== null && datos.radio !== undefined && datos.radio !== '') {
    if (!RADIOS[datos.radio]) {
      throw new Error('El radio de esquinas debe ser "sm", "md" o "lg".');
    }
    tema.radio = datos.radio;
  }

  // --- Favicon (ruta relativa pública, solo acepta la de este tenant) ---
  if (datos.faviconUrl !== null && datos.faviconUrl !== undefined && datos.faviconUrl !== '') {
    if (typeof datos.faviconUrl !== 'string' || !/^\/api\/favicon\/[a-z0-9][a-z0-9-]{0,48}$/.test(datos.faviconUrl)) {
      throw new Error('El favicon debe ser la ruta pública del tenant.');
    }
    tema.faviconUrl = datos.faviconUrl;
  }

  return tema;
}

// Convierte el tema normalizado a las CSS variables que el frontend
// pinta en :root (solo las presentes). null = sin tema = no se pinta nada.
function temaAVariables(tema) {
  const t = tema || {};
  const variables = {};
  const colores = t.colores || {};
  for (const [clave, valor] of Object.entries(colores)) {
    variables[`--color-${clave}`] = valor;
  }
  // Tipografía congelada a Inter (regla 2026-08-24): todo como menú/botones,
  // incluso si el tema guardado trae otra clave del catálogo histórico.
  if (t.tipografia) {
    const display = FUENTES[t.tipografia.display];
    const cuerpo = FUENTES[t.tipografia.cuerpo];
    if (display) variables['--font-display'] = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    if (cuerpo) variables['--font-body'] = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  }
  if (t.radio) {
    const radios = RADIOS[t.radio];
    variables['--radius-sm'] = radios.sm;
    variables['--radius-md'] = radios.md;
    variables['--radius-lg'] = radios.lg;
  }
  return variables;
}

// URLs de Google Fonts que el frontend debe cargar para este tema.
// null = sin tema = sin URLs extra.
function fuentesAUrlGoogle(tema) {
  const t = tema || {};
  const urls = [];
  if (t.tipografia) {
    if (t.tipografia.display && FUENTES[t.tipografia.display]) {
      urls.push(FUENTES[t.tipografia.display].urlGoogle);
    }
    if (t.tipografia.cuerpo && FUENTES[t.tipografia.cuerpo]) {
      urls.push(FUENTES[t.tipografia.cuerpo].urlGoogle);
    }
  }
  return urls;
}

// Intenta parsear el tema_json de una fila de tenants. Devuelve null si
// no hay tema (NULL/vacío/JSON inválido — un JSON corrupto NO rompe el
// portal, se degrada al diseño base y se loguea para corregirlo).
function parsearTemaDesdeFila(tenant) {
  const crudo = tenant && typeof tenant.tema_json === 'string' && tenant.tema_json.trim() ? tenant.tema_json : null;
  if (!crudo) return null;
  try {
    const tema = JSON.parse(crudo);
    return normalizarTema(tema); // re-valida al leer, por si cambió el catálogo
  } catch (err) {
    console.error(`tema_json inválido en el tenant "${tenant && tenant.slug}":`, err.message);
    return null;
  }
}

module.exports = {
  FUENTES,
  RADIOS,
  CLAVES_COLOR,
  normalizarTema,
  temaAVariables,
  fuentesAUrlGoogle,
  parsearTemaDesdeFila,
  ratioContraste,
  luminanciaRelativa,
};
