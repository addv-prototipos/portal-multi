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

// Parseo de JSON/CSV compartido con claveProdServ.js — ver
// utils/catalogoTexto.js. `esCatalogoValido`/`normalizarCatalogoRemoto` se
// re-exportan con la MISMA firma de un solo argumento que ya tenían, para
// no romper los tests existentes ni ningún llamador.
const { esCatalogoValido, normalizarCatalogoDesdeTexto } = require('./catalogoTexto');

function normalizarCatalogoRemoto(texto) {
  return normalizarCatalogoDesdeTexto(texto, { claveMaxLen: 10, aliasClave: ['c_UsoCFDI'] });
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
