const { pool } = require('../db');
const { esCatalogoValido, normalizarCatalogoDesdeTexto } = require('./catalogoTexto');

const CLAVE_ACTUALIZADO = 'clave_prod_serv_actualizado_en';
const CLAVE_ORIGEN = 'clave_prod_serv_origen';
const ORIGEN_EJEMPLO = 'catálogo de ejemplo (10 claves) — pendiente fuente oficial del SAT';

// Catálogo "Clave de Producto o Servicio" (c_ClaveProdServ) — 10 claves
// reales del SAT, a propósito solo de ejemplo mientras se confirma una
// fuente oficial gratuita verificada (mismo criterio que USO_CFDI_SYNC_URL:
// nunca se adivina un origen externo sin que alguien lo haya revisado).
// El catálogo real completo tiene ~52,000 claves — por eso vive en su
// propia tabla (`catalogo_clave_prod_serv`) en vez del patrón clave-valor
// genérico de "configuracion" que usa Uso de CFDI (ese sí cabe completo
// como un solo JSON, este no).
const CATALOGO_EJEMPLO = [
  { clave: '81112501', descripcion: 'Servicios de diseño gráfico' },
  { clave: '81111804', descripcion: 'Servicios de desarrollo de software o aplicaciones' },
  { clave: '43211508', descripcion: 'Computadoras personales' },
  { clave: '43211500', descripcion: 'Computadoras' },
  { clave: '53102300', descripcion: 'Ropa y accesorios de vestir para dama' },
  { clave: '53101500', descripcion: 'Ropa de niños' },
  { clave: '90101501', descripcion: 'Servicios de restaurante de comida completa' },
  { clave: '84111500', descripcion: 'Servicios de contabilidad' },
  { clave: '80101500', descripcion: 'Servicios de consultoría de negocios' },
  { clave: '73152100', descripcion: 'Servicios de mantenimiento de cómputo' },
];

// Se llama una vez al arrancar el backend (ver server.js:iniciar()) —
// idempotente: si la tabla ya tiene filas (catálogo de ejemplo o el
// oficial ya sincronizado alguna vez), no hace nada.
async function sembrarCatalogoEjemploSiVacio() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM catalogo_clave_prod_serv');
  if (total > 0) return;
  const valores = CATALOGO_EJEMPLO.map((c) => [c.clave, c.descripcion]);
  await pool.query('INSERT INTO catalogo_clave_prod_serv (clave, descripcion) VALUES ?', [valores]);
  await guardarOrigen(ORIGEN_EJEMPLO);
}

async function guardarOrigen(origen) {
  await pool.query(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_ORIGEN, origen]
  );
}

// Búsqueda por texto libre — coincide contra la clave (prefijo/exacta) o
// la descripción (subcadena). Límite fijo de 20 resultados: es un
// autocompletar, no un listado completo, y evita respuestas gigantes
// aunque el catálogo real ya tenga ~52,000 filas.
async function buscarClaveProdServ(termino) {
  const q = String(termino || '').trim();
  if (!q) return [];
  const comodin = `%${q}%`;
  const [filas] = await pool.query(
    `SELECT clave, descripcion FROM catalogo_clave_prod_serv
     WHERE clave LIKE ? OR descripcion LIKE ?
     ORDER BY descripcion ASC
     LIMIT 20`,
    [comodin, comodin]
  );
  return filas;
}

async function contarClaveProdServ() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM catalogo_clave_prod_serv');
  return total;
}

async function getInfoCatalogoClaveProdServ() {
  const [filas] = await pool.query('SELECT clave, valor FROM configuracion WHERE clave IN (?, ?)', [
    CLAVE_ACTUALIZADO,
    CLAVE_ORIGEN,
  ]);
  const mapa = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  return {
    total: await contarClaveProdServ(),
    actualizadoEn: mapa[CLAVE_ACTUALIZADO] || null,
    origen: mapa[CLAVE_ORIGEN] || ORIGEN_EJEMPLO,
    esEjemplo: (mapa[CLAVE_ORIGEN] || ORIGEN_EJEMPLO) === ORIGEN_EJEMPLO,
  };
}

async function guardarCatalogo(catalogo, origen) {
  const ahora = new Date().toISOString();
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query('DELETE FROM catalogo_clave_prod_serv');
    if (catalogo.length > 0) {
      const valores = catalogo.map((c) => [c.clave, c.descripcion]);
      await conexion.query('INSERT INTO catalogo_clave_prod_serv (clave, descripcion) VALUES ?', [valores]);
    }
    const upsert = `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`;
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

// Sincroniza desde CLAVE_PROD_SERV_SYNC_URL (variable de entorno) — NUNCA
// acepta una URL desde la petición HTTP, para no exponer un punto de
// fetch a URLs arbitrarias (mismo criterio de seguridad que
// sincronizarDesdeOrigen() de usoCfdi.js). Por defecto apunta al dump SQL
// público (Unlicense) de phpcfdi/resources-sat-catalogs
// (cfdi_40_productos_servicios, ~52,500 claves reales del SAT) — fuente
// verificada y confirmada por el usuario el 2026-09-04, ver
// PROJECT_STATE.md. Sin esa variable configurada (o si se sobreescribe a
// vacío), el catálogo de ejemplo sigue funcionando normalmente en el
// formulario.
async function sincronizarDesdeOrigen(urlPersonalizada) {
  const url = urlPersonalizada || process.env.CLAVE_PROD_SERV_SYNC_URL;

  if (!url) {
    throw new Error(
      'No hay un origen de sincronización configurado. Define la variable de entorno ' +
        'CLAVE_PROD_SERV_SYNC_URL con una URL que hayas verificado tú mismo (debe responder JSON, ' +
        'CSV con columnas clave,descripcion, o un dump SQL de INSERTs) y reinicia el backend. ' +
        'Mientras tanto, el catálogo de ejemplo sigue funcionando normalmente en el formulario.'
    );
  }

  let respuesta;
  try {
    respuesta = await fetch(url, {
      headers: { 'User-Agent': 'portal-facturacion/1.0' },
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con "${url}". Verifica la URL y la conexión a internet del servidor.`);
  }

  if (!respuesta.ok) {
    throw new Error(
      `"${url}" respondió con error HTTP ${respuesta.status}. Verifica que la URL en ` +
        'CLAVE_PROD_SERV_SYNC_URL siga siendo correcta (el catálogo actual no fue modificado).'
    );
  }

  const texto = await respuesta.text();
  const catalogo = normalizarCatalogoDesdeTexto(texto, {
    claveMaxLen: 10,
    aliasClave: ['c_ClaveProdServ'],
    sqlIndiceClave: 0,
    sqlIndiceDescripcion: 1,
  });
  if (!catalogo) {
    throw new Error(
      `Se recibió una respuesta de "${url}", pero no se pudo interpretar su formato ` +
        '(se esperaba JSON, CSV con columnas clave,descripcion, o un dump SQL de INSERTs). ' +
        'El catálogo actual no fue modificado.'
    );
  }

  await guardarCatalogo(catalogo, url);
  return catalogo;
}

module.exports = {
  CATALOGO_EJEMPLO,
  ORIGEN_EJEMPLO,
  sembrarCatalogoEjemploSiVacio,
  buscarClaveProdServ,
  contarClaveProdServ,
  getInfoCatalogoClaveProdServ,
  sincronizarDesdeOrigen,
  esCatalogoValido, // exportado para pruebas
};
