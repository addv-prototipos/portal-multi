const { pool } = require('../db');

const CLAVE_CATALOGO = 'uso_cfdi_catalogo';
const CLAVE_ACTUALIZADO = 'uso_cfdi_actualizado_en';
const CLAVE_ORIGEN = 'uso_cfdi_origen';

// Catálogo de "Uso de CFDI" (c_UsoCFDI) tal como se conoce para CFDI 4.0.
// Se usa como base al iniciar por primera vez y como respaldo si la
// sincronización con el SAT falla: nunca se deja el catálogo vacío.
// Usa el botón "Actualizar catálogo SAT" en el panel de administración
// para refrescarlo si el SAT publica cambios.
const CATALOGO_DEFAULT = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías' },
  { clave: 'G02', descripcion: 'Devoluciones, descuentos o bonificaciones' },
  { clave: 'G03', descripcion: 'Gastos en general' },
  { clave: 'I01', descripcion: 'Construcciones' },
  { clave: 'I02', descripcion: 'Mobiliario y equipo de oficina por inversiones' },
  { clave: 'I03', descripcion: 'Equipo de transporte' },
  { clave: 'I04', descripcion: 'Equipo de cómputo y accesorios' },
  { clave: 'I05', descripcion: 'Dados, troqueles, moldes, matrices y otros activos' },
  { clave: 'I06', descripcion: 'Comunicaciones telefónicas' },
  { clave: 'I07', descripcion: 'Comunicaciones satelitales' },
  { clave: 'I08', descripcion: 'Otra maquinaria y equipo' },
  { clave: 'D01', descripcion: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { clave: 'D02', descripcion: 'Gastos médicos por incapacidad o discapacidad' },
  { clave: 'D03', descripcion: 'Gastos funerales' },
  { clave: 'D04', descripcion: 'Donativos' },
  { clave: 'D05', descripcion: 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)' },
  { clave: 'D06', descripcion: 'Aportaciones voluntarias al SAR' },
  { clave: 'D07', descripcion: 'Primas por seguros de gastos médicos' },
  { clave: 'D08', descripcion: 'Gastos de transportación escolar obligatoria' },
  { clave: 'D09', descripcion: 'Depósitos en cuentas para el ahorro, pensiones' },
  { clave: 'D10', descripcion: 'Pagos por servicios educativos (colegiaturas)' },
  { clave: 'S01', descripcion: 'Sin efectos fiscales' },
  { clave: 'CP01', descripcion: 'Pagos' },
  { clave: 'CN01', descripcion: 'Nómina' },
];

// No se define una URL por defecto: un origen externo "adivinado" sin
// verificar puede dejar de existir o nunca haber sido correcto (así pasó
// con un intento anterior). El administrador debe configurar
// USO_CFDI_SYNC_URL con una fuente que haya verificado personalmente —
// ver USO_CFDI_SYNC_URL en docker-compose.yml / .env.example.

async function getUsosCfdi() {
  const [filas] = await pool.query('SELECT valor FROM configuracion WHERE clave = ?', [CLAVE_CATALOGO]);
  if (filas.length === 0) return CATALOGO_DEFAULT;
  try {
    const parsed = JSON.parse(filas[0].valor);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return CATALOGO_DEFAULT;
  } catch (e) {
    return CATALOGO_DEFAULT;
  }
}

async function getInfoSincronizacion() {
  const [filas] = await pool.query(
    'SELECT clave, valor FROM configuracion WHERE clave IN (?, ?)',
    [CLAVE_ACTUALIZADO, CLAVE_ORIGEN]
  );
  const mapa = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  return {
    actualizadoEn: mapa[CLAVE_ACTUALIZADO] || null,
    origen: mapa[CLAVE_ORIGEN] || 'catálogo incluido por defecto',
  };
}

async function guardarCatalogo(catalogo, origen) {
  const ahora = new Date().toISOString();
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const upsert = `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`;
    await conexion.query(upsert, [CLAVE_CATALOGO, JSON.stringify(catalogo)]);
    await conexion.query(upsert, [CLAVE_ACTUALIZADO, ahora]);
    await conexion.query(upsert, [CLAVE_ORIGEN, origen]);
    await conexion.commit();
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    conexion.release();
  }
  return ahora;
}

// Valida que la lista tenga forma de catalogo real antes de aceptarla,
// para nunca sobreescribir con datos basura si el origen remoto cambia de
// formato inesperadamente.
function esCatalogoValido(catalogo) {
  if (!Array.isArray(catalogo) || catalogo.length < 5) return false;
  return catalogo.every(
    (item) =>
      item &&
      typeof item.clave === 'string' &&
      item.clave.trim().length > 0 &&
      item.clave.trim().length <= 10 &&
      typeof item.descripcion === 'string' &&
      item.descripcion.trim().length > 0
  );
}

// Intenta interpretar la respuesta remota como JSON (varias formas
// conocidas) o como CSV/TSV con encabezado y al menos 2 columnas
// (clave, descripcion), que es como suelen publicarse estos catálogos.
function normalizarCatalogoRemoto(texto) {
  const contenido = String(texto || '').trim();
  if (!contenido) return null;

  // Intento 1: JSON (array directo, o { data: [...] })
  try {
    const data = JSON.parse(contenido);
    const lista = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : null;
    if (lista) {
      const normalizado = lista
        .map((item) => {
          const clave = item.clave ?? item.value ?? item.c_UsoCFDI ?? item.id ?? item.codigo;
          const descripcion = item.descripcion ?? item.text ?? item.nombre ?? item.label ?? item.name;
          if (clave == null || descripcion == null) return null;
          return { clave: String(clave).trim(), descripcion: String(descripcion).trim() };
        })
        .filter(Boolean);
      if (esCatalogoValido(normalizado)) return normalizado;
    }
  } catch (e) {
    // No era JSON valido; se intenta como CSV/TSV abajo.
  }

  // Intento 2: CSV/TSV con encabezado en la primera linea
  const lineas = contenido.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lineas.length > 1) {
    const separador = lineas[0].includes('\t') ? '\t' : ',';
    const filas = lineas.slice(1);
    const normalizado = filas
      .map((linea) => {
        const columnas = dividirLineaCsv(linea, separador);
        if (columnas.length < 2) return null;
        const [clave, descripcion] = columnas;
        if (!clave || !descripcion) return null;
        return { clave, descripcion };
      })
      .filter(Boolean);
    if (esCatalogoValido(normalizado)) return normalizado;
  }

  return null;
}

// Divide una linea CSV/TSV respetando campos entre comillas (para que una
// descripcion como "Intereses reales, efectivamente pagados" no se corte
// en la coma). Soporta comillas dobles escapadas ("") dentro del campo.
function dividirLineaCsv(linea, separador) {
  const columnas = [];
  let actual = '';
  let dentroDeComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const char = linea[i];
    if (char === '"') {
      if (dentroDeComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        dentroDeComillas = !dentroDeComillas;
      }
    } else if (char === separador && !dentroDeComillas) {
      columnas.push(actual.trim());
      actual = '';
    } else {
      actual += char;
    }
  }
  columnas.push(actual.trim());
  return columnas;
}

async function sincronizarDesdeOrigen(urlPersonalizada) {
  const url = urlPersonalizada || process.env.USO_CFDI_SYNC_URL;

  // No se asume una URL por defecto: un origen externo "adivinado" puede
  // dejar de existir o nunca haber sido correcto (por eso este mensaje es
  // explícito en vez de intentar una URL sin verificar).
  if (!url) {
    throw new Error(
      'No hay un origen de sincronización configurado. Define la variable de entorno ' +
        'USO_CFDI_SYNC_URL con una URL que hayas verificado tú mismo (debe responder JSON o ' +
        'CSV con columnas clave,descripcion) y reinicia el backend. Mientras tanto, el catálogo ' +
        'incluido por defecto sigue funcionando normalmente en el formulario.'
    );
  }

  let respuesta;
  try {
    respuesta = await fetch(url, {
      headers: { 'User-Agent': 'portal-facturacion/1.0' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con "${url}". Verifica la URL y la conexión a internet del servidor.`);
  }

  if (!respuesta.ok) {
    throw new Error(
      `"${url}" respondió con error HTTP ${respuesta.status}. Verifica que la URL en ` +
        'USO_CFDI_SYNC_URL siga siendo correcta (el catálogo actual no fue modificado).'
    );
  }

  const texto = await respuesta.text();
  const catalogo = normalizarCatalogoRemoto(texto);
  if (!catalogo) {
    throw new Error(
      `Se recibió una respuesta de "${url}", pero no se pudo interpretar su formato ` +
        '(se esperaba JSON o CSV con columnas clave,descripcion). El catálogo actual no fue modificado.'
    );
  }

  await guardarCatalogo(catalogo, url);
  return catalogo;
}

module.exports = {
  CATALOGO_DEFAULT,
  getUsosCfdi,
  getInfoSincronizacion,
  sincronizarDesdeOrigen,
  normalizarCatalogoRemoto, // exportado para pruebas
  esCatalogoValido, // exportado para pruebas
};
