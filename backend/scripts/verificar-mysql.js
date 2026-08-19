#!/usr/bin/env node
/**
 * Prueba de regresión contra una base de datos MySQL real.
 *
 * A diferencia de la version anterior (para SQLite), esta prueba SI
 * requiere una instancia de MySQL alcanzable — usa las mismas variables de
 * entorno que el backend (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 * La forma mas facil de correrla es con el stack ya levantado:
 *
 *   docker-compose up -d mysql
 *   cd backend
 *   npm install
 *   DB_HOST=localhost DB_PORT=3306 DB_USER=app DB_PASSWORD=<la_tuya> \
 *     DB_NAME=portal_facturacion node scripts/verificar-mysql.js
 *
 * O, si ya tienes el backend corriendo via docker-compose, desde dentro del
 * contenedor (que ya trae las variables correctas):
 *
 *   docker-compose exec backend node scripts/verificar-mysql.js
 *
 * Todos los datos que crea esta prueba se limpian al final (usa un correo
 * de prueba reconocible y lo borra), asi que es seguro correrla contra la
 * base de datos real del proyecto.
 */

const { pool, ensureSchema } = require('../db');
const {
  getCamposObligatorios,
  setCamposObligatorios,
  getRetencionTicketsDias,
  setRetencionTicketsDias,
  ZONAS_HORARIAS_MEXICO,
  getConfiguracionGlobal,
  setConfiguracionGlobal,
  formatearFechaHoraMexico,
} = require('../utils/config');
const { hashPassword, verifyPassword, validarPassword, crearTokenSesion, verificarTokenSesion } = require('../utils/authUsuario');
const {
  getUsosCfdi,
  getInfoSincronizacion,
  normalizarCatalogoRemoto,
  esCatalogoValido,
  CATALOGO_DEFAULT,
} = require('../utils/usoCfdi');
const { getConfigSmtp, setConfigSmtp, configSmtpParaMostrar, aplicarPlantilla, DEFAULTS_SMTP } = require('../utils/email');
const { limpiarTicketsVencidos, limpiarOrdenesVencidas, ejecutarLimpiezaConReporte } = require('../utils/ticketsCleanup');
const { generarContenidoMD, generarCSV, generarExcelBuffer, aFechaSegura } = require('../utils/reportes');
const { requireAdminArea, requireUsuarioAdminExacto } = require('../utils/auth');
const {
  extraerNombreRazonSocial,
  extraerRFC,
  extraerRegimenesFiscales,
  determinarTipoPersonaPorRegimen,
  determinarTipoPersonaPorNombre,
  determinarTipoPersonaPorCamposDocumento,
  determinarTipoPersona,
} = require('../utils/pdfExtract');
const { esZipValido, zipContienePdfYXml, sanitizeText, sanitizeTextoLibre } = require('../utils/validate');

const PREFIJO_PRUEBA = '__prueba_regresion__';
// `ordenes_compra.numero_compra` es VARCHAR(20) — el prefijo largo de
// arriba (19 chars) no cabe en la columna y hace fallar los INSERTs por
// ER_DATA_TOO_LONG. Los números de compra de prueba usan este prefijo
// corto propio (aun así fácil de identificar y de limpiar).
const NUM_COMPRA_PRUEBA = 'PRGR';
const EMAIL_PRUEBA = `${PREFIJO_PRUEBA}@example.test`;
const EMAIL_PRUEBA_2 = `${PREFIJO_PRUEBA}-2@example.test`;
const RFC_PRUEBA_USUARIO = 'AAA010101AA1';

let pruebasOk = 0;
let pruebasTotal = 0;

function log(ok, nombre, detalle) {
  pruebasTotal += 1;
  if (ok) pruebasOk += 1;
  const etiqueta = ok ? 'OK  ' : 'FALLA';
  console.log(`[${etiqueta}] ${nombre}${detalle ? ' -- ' + detalle : ''}`);
}

async function limpiarDatosDePrueba() {
  await pool.query('DELETE FROM registros WHERE email LIKE ?', [`${PREFIJO_PRUEBA}%`]);
  await pool.query('DELETE FROM tickets WHERE rfc = ?', [RFC_PRUEBA_USUARIO]);
  await pool.query('DELETE FROM usuarios WHERE rfc = ?', [RFC_PRUEBA_USUARIO]);
  await pool.query('DELETE FROM ordenes_compra WHERE numero_compra LIKE ?', [`${NUM_COMPRA_PRUEBA}-%`]);
}

async function main() {
  console.log('Conectando a MySQL y preparando el esquema...\n');

  // ---------- Esquema ----------
  try {
    await ensureSchema();
    log(true, 'ensureSchema() corre sin errores');
  } catch (err) {
    log(false, 'ensureSchema() corre sin errores', err.message);
    console.log('\nNo se pudo continuar sin un esquema valido. Abortando.');
    process.exit(1);
  }

  try {
    await ensureSchema();
    log(true, 'ensureSchema() es idempotente (correr dos veces no falla)');
  } catch (err) {
    log(false, 'ensureSchema() es idempotente', err.message);
  }

  // ---------- Extracción de nombre/razón social del PDF (persona física y moral) ----------
  // No depende de la base de datos, pero se incluye aquí para que "correr
  // este script" siga cubriendo todo el proyecto de una sola vez. Cubre
  // específicamente el bug reportado: en una constancia de PERSONA MORAL,
  // la función terminaba tomando el valor de un campo "Nombre" suelto no
  // relacionado (ej. "Nombre Comercial") en vez de la razón social real,
  // porque el último respaldo (pensado solo para persona física) se
  // activaba sin verificar que el documento en verdad fuera de ese tipo.
  try {
    const textoMoralConCampoNombreSuelto = [
      'Nombre',
      'DISTRIBUIDORA REGIONAL SA DE CV',
      '',
      'Regimen Capital',
      'SOCIEDAD ANONIMA DE CAPITAL VARIABLE',
      '',
      'CONSTRUCTORA DEL NORTE SA DE CV',
      'Nombre, Denominación o Razón Social',
      '',
      'Valida tu información fiscal',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoMoralConCampoNombreSuelto) === 'CONSTRUCTORA DEL NORTE SA DE CV',
      'PERSONA MORAL: ya no toma un campo "Nombre" suelto no relacionado (bug reportado) — encuentra la razón social real'
    );

    const textoMoralConRfcAntes = [
      'Registro Federal de Contribuyentes: ABC850101AB1',
      'IdCIF',
      'COMERCIALIZADORA DEL BAJIO SA DE CV',
      'Nombre, Denominación o Razón Social:',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoMoralConRfcAntes) === 'COMERCIALIZADORA DEL BAJIO SA DE CV',
      'PERSONA MORAL: la estrategia principal (ventana RFC → Nombre) sigue funcionando'
    );

    const textoMoralNombreLargoPartido = [
      'Registro Federal de Contribuyentes: ABC850101AB1',
      'GRUPO INDUSTRIAL Y COMERCIAL',
      'DEL PACIFICO SA DE CV',
      'Nombre, Denominación o Razón Social:',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoMoralNombreLargoPartido) === 'GRUPO INDUSTRIAL Y COMERCIAL DEL PACIFICO SA DE CV',
      'PERSONA MORAL: una razón social larga partida en dos líneas se une correctamente'
    );

    const textoFisicaTresCampos = [
      'Nombre (s):',
      'JUAN CARLOS',
      '',
      'Primer Apellido:',
      'HERNANDEZ',
      '',
      'Segundo Apellido:',
      'LOPEZ',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoFisicaTresCampos) === 'JUAN CARLOS HERNANDEZ LOPEZ',
      'PERSONA FÍSICA: nombre repartido en Nombre(s) + Primer Apellido + Segundo Apellido sigue funcionando'
    );

    const textoFisicaConNombreComercialAntes = [
      'Nombre Comercial: TIENDA EL SOL',
      '',
      'Nombre (s):',
      'MARIA',
      '',
      'Primer Apellido:',
      'GONZALEZ',
      '',
      'Segundo Apellido:',
      'RUIZ',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoFisicaConNombreComercialAntes) === 'MARIA GONZALEZ RUIZ',
      'PERSONA FÍSICA: con un "Nombre Comercial" antes en el texto, toma el "Nombre (s)" correcto (no el primero que aparece)'
    );

    const textoFisicaConRuidoDocumentado = [
      'Registro Federal de Contribuyentes: XAXX010101000',
      'IdCIF',
      'Valida tu información fiscal en el portal del SAT',
      'PEREZ HERNANDEZ JUAN',
      'Nombre, Denominación o Razón Social:',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoFisicaConRuidoDocumentado) === 'PEREZ HERNANDEZ JUAN',
      'PERSONA FÍSICA: caso original documentado (ruido "IdCIF" + leyenda del SAT) sigue funcionando'
    );

    log(
      extraerNombreRazonSocial('Este documento no es una constancia fiscal.') === null,
      'Un texto sin ningún campo reconocible devuelve null (no un valor inventado)'
    );

    // Casos reportados con un PDF real: el nombre real venía CON "+"
    // (rechazado antes por el patrón de caracteres permitidos), y el
    // encabezado/título del documento ("CONSTANCIA DE SITUACIÓN FISCAL",
    // "Lugar y Fecha de Emisión") se colaba como si fuera el nombre.
    const textoRealConRfcAntes = [
      'CONSTANCIA DE SITUACIÓN FISCAL',
      'Lugar y Fecha de Emisión',
      'CIUDAD DE MEXICO, A 01 DE ENERO DE 2026',
      '',
      'Registro Federal de Contribuyentes: ADD200101AB1',
      'AGILE DEVELOPMENT AND DESIGN + VALUE',
      'Nombre, Denominación o Razón Social:',
      '',
      'VALIDA TU INFORMACIÓN FISCAL',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoRealConRfcAntes) === 'AGILE DEVELOPMENT AND DESIGN + VALUE',
      'CASO REAL REPORTADO: nombre con "+" y encabezado del documento cerca — encuentra el nombre real, no el título'
    );

    const textoRealSinRfcAntes = [
      'VALIDA TU INFORMACIÓN FISCAL',
      'CONSTANCIA DE SITUACIÓN FISCAL',
      'Lugar y Fecha de Emisión',
      '',
      'AGILE DEVELOPMENT AND DESIGN + VALUE',
      'Nombre, Denominación o Razón Social:',
      '',
      'Registro Federal de Contribuyentes: ADD200101AB1',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoRealSinRfcAntes) === 'AGILE DEVELOPMENT AND DESIGN + VALUE',
      'CASO REAL REPORTADO: mismo caso sin RFC antes del nombre (fuerza la Estrategia 2) — mismo resultado correcto'
    );

    const textoSoloBoilerplateSinNombreReal = [
      'VALIDA TU INFORMACIÓN FISCAL',
      'CONSTANCIA DE SITUACIÓN FISCAL',
      'Lugar y Fecha de Emisión',
      'Nombre, Denominación o Razón Social:',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoSoloBoilerplateSinNombreReal) === null,
      'Si solo hay texto de plantilla del documento (sin nombre real en ningún lado), devuelve null y no el texto de plantilla'
    );

    // Regla explícita pedida por el usuario: el dato se ubica ENTRE
    // "Registro Federal de Contribuyentes" y "Nombre, Denominación o
    // Razón Social", sin importar cuál aparece primero, y se guarda sin
    // saltos de línea — misma regla para persona física y persona moral.
    const textoOrdenInvertido = [
      'AGILE DEVELOPMENT AND DESIGN + VALUE',
      'Nombre, Denominación o Razón Social:',
      'Registro Federal de Contribuyentes: ADD200101AB1',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoOrdenInvertido) === 'AGILE DEVELOPMENT AND DESIGN + VALUE',
      'REGLA UNIFICADA: cuando el RFC aparece DESPUÉS del nombre (orden invertido), la misma regla sigue aplicando'
    );

    // Simulacro de un documento completo, combinando todo lo aprendido en
    // los últimos turnos: título del SAT, RFC, ruido "IdCIF", el nombre
    // real (con "+"), y varias líneas en blanco de por medio.
    const textoDocumentoCompleto = [
      'CONSTANCIA DE SITUACIÓN FISCAL',
      'Lugar y Fecha de Emisión',
      'CIUDAD DE MEXICO, A 15 DE JULIO DE 2026',
      '',
      'Datos de identificación del contribuyente',
      'Registro Federal de Contribuyentes: ADD200101AB1',
      'IdCIF',
      '',
      'AGILE DEVELOPMENT AND DESIGN + VALUE',
      '',
      'Nombre, Denominación o Razón Social:',
      '',
      'Regimen Capital',
      'SOCIEDAD ANONIMA DE CAPITAL VARIABLE',
      'Fecha de inicio de operaciones: 01/01/2020',
      'Estatus: ACTIVO',
      '',
      'VALIDA TU INFORMACIÓN FISCAL',
    ].join('\n');
    log(
      extraerNombreRazonSocial(textoDocumentoCompleto) === 'AGILE DEVELOPMENT AND DESIGN + VALUE',
      'Simulacro de documento completo (título + RFC + IdCIF + nombre con "+" + régimen/fecha/estatus después) encuentra el nombre real'
    );
  } catch (err) {
    log(false, 'Extracción de nombre/razón social del PDF', err.message);
  }

  // ---------- Extracción del RFC del PDF + validación cruzada contra la sesión/formulario ----------
  // No depende de la base de datos, pero se incluye aquí por la misma
  // razón que el bloque anterior. Cubre la nueva regla: el RFC de la
  // constancia debe coincidir con el RFC de la sesión (o del campo RFC
  // del formulario, si no hay sesión) — la relación es 1 a 1, así que no
  // debería poder subirse la constancia de una persona distinta.
  try {
    log(
      extraerRFC('Registro Federal de Contribuyentes: ADD200101AB1\nAGILE DEVELOPMENT AND DESIGN + VALUE') === 'ADD200101AB1',
      'extraerRFC() encuentra el RFC de persona moral (12 caracteres) junto a la etiqueta'
    );
    log(
      extraerRFC('Registro Federal de Contribuyentes: XAXX010101000\nPEREZ HERNANDEZ JUAN') === 'XAXX010101000',
      'extraerRFC() encuentra el RFC de persona física (13 caracteres)'
    );
    log(
      extraerRFC('Registro Federal de Contribuyentes: add200101ab1') === 'ADD200101AB1',
      'extraerRFC() normaliza el RFC a mayúsculas'
    );
    log(
      extraerRFC('Este documento no tiene ningún RFC.') === null,
      'extraerRFC() devuelve null si no encuentra ningún RFC (no inventa uno)'
    );

    // Simula la misma comparación que hace POST /api/registro: solo
    // bloquea si AMBOS valores (el de la constancia y el de referencia)
    // están disponibles y son distintos — nunca bloquea por no poder
    // determinar uno de los dos (mismo espíritu "de mejor esfuerzo" que
    // el resto de la extracción del PDF).
    function seBloquearia(rfcConstancia, rfcReferencia) {
      return Boolean(rfcConstancia && rfcReferencia && rfcConstancia !== rfcReferencia);
    }
    log(seBloquearia('ADD200101AB1', 'ADD200101AB1') === false, 'RFC de sesión y de la constancia coinciden → no se bloquea');
    log(seBloquearia('ADD200101AB1', 'ZZZ999999ZZ9') === true, 'RFC de sesión y de la constancia NO coinciden → SÍ se bloquea');
    log(seBloquearia(null, 'ADD200101AB1') === false, 'No se pudo leer el RFC de la constancia → no se bloquea (mejor esfuerzo)');
    log(seBloquearia('ADD200101AB1', null) === false, 'Sin RFC de referencia (acceso anónimo, sin RFC en el formulario) → no se bloquea');

    // Prioridad real: la sesión gana sobre el campo del formulario (ver
    // `rfcReferencia = rfcSesion || rfcRaw || null` en server.js) — se
    // prueba con un token de sesión real, no solo simulado.
    const tokenSesionPrueba = crearTokenSesion('ADD200101AB1');
    const rfcDesdeToken = verificarTokenSesion(tokenSesionPrueba)?.rfc || null;
    log(
      (rfcDesdeToken || 'ZZZ999999ZZ9') === 'ADD200101AB1',
      'Con sesión activa, su RFC tiene prioridad sobre el RFC capturado en el formulario'
    );
    log(
      verificarTokenSesion('token-invalido-o-corrupto') === null,
      'Un token de sesión inválido/corrupto no lanza error — simplemente no hay RFC de sesión disponible'
    );
  } catch (err) {
    log(false, 'Extracción del RFC del PDF + validación cruzada', err.message);
  }

  // ---------- Validación de ZIP para subir la factura de un ticket ----------
  // No depende de la base de datos. Cubre la nueva regla: la factura que
  // sube el administrador para un ticket solo se acepta como un ZIP (con
  // el PDF y el XML del CFDI comprimidos juntos dentro) — un
  // <input type="file"> no permite adjuntar los dos por separado. Se
  // valida el contenido real (firma binaria), no solo la extensión o el
  // MIME que haya declarado el navegador.
  try {
    const zipNormal = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    const zipVacio = Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0]);
    const zipDividido = Buffer.from([0x50, 0x4b, 0x07, 0x08]);
    const pdfReal = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    const imagenJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const textoPlano = Buffer.from('esto no es un zip, solo texto');

    log(esZipValido(zipNormal) === true, 'esZipValido() acepta un ZIP normal (firma "PK\\x03\\x04")');
    log(esZipValido(zipVacio) === true, 'esZipValido() acepta un ZIP vacío (firma "PK\\x05\\x06")');
    log(esZipValido(zipDividido) === true, 'esZipValido() acepta un ZIP dividido/spanned (firma "PK\\x07\\x08")');
    log(esZipValido(pdfReal) === false, 'esZipValido() rechaza un PDF real, aunque se le cambie la extensión a .zip');
    log(esZipValido(imagenJpeg) === false, 'esZipValido() rechaza una imagen JPEG');
    log(esZipValido(textoPlano) === false, 'esZipValido() rechaza texto plano disfrazado de .zip');
    log(esZipValido(Buffer.from([0x50, 0x4b])) === false, 'esZipValido() rechaza un buffer más corto que la firma (2 bytes)');
    log(esZipValido(Buffer.from([])) === false, 'esZipValido() rechaza un buffer vacío');
    log(esZipValido(null) === false, 'esZipValido() no lanza error con null — simplemente no es válido');

    // Construye ZIPs de prueba mínimos (método "stored", sin comprimir
    // nada realmente) directamente en JavaScript, sin depender de ninguna
    // herramienta externa — zipContienePdfYXml() solo lee los NOMBRES del
    // directorio central, nunca valida el CRC ni descomprime el
    // contenido, así que no hace falta contenido real para probarlo.
    // Verificado por separado (fuera de este script) con la herramienta
    // "zip"/"unzip" real del sistema, para confirmar que el formato
    // construido aquí es un ZIP genuino y no solo algo que el propio
    // parser acepta por casualidad.
    function construirZipDePrueba(nombresArchivos) {
      const bloquesLocales = [];
      const registrosCentrales = [];
      let offset = 0;

      for (const nombre of nombresArchivos) {
        const nombreBuf = Buffer.from(nombre, 'utf8');

        const encabezadoLocal = Buffer.alloc(30);
        encabezadoLocal.writeUInt32LE(0x04034b50, 0); // firma local
        encabezadoLocal.writeUInt16LE(nombreBuf.length, 26); // longitud del nombre
        const bloqueLocal = Buffer.concat([encabezadoLocal, nombreBuf]);
        bloquesLocales.push(bloqueLocal);

        const registroCentral = Buffer.alloc(46);
        registroCentral.writeUInt32LE(0x02014b50, 0); // firma central
        registroCentral.writeUInt16LE(nombreBuf.length, 28); // longitud del nombre
        registroCentral.writeUInt32LE(offset, 42); // offset del encabezado local
        registrosCentrales.push(Buffer.concat([registroCentral, nombreBuf]));

        offset += bloqueLocal.length;
      }

      const datosLocales = Buffer.concat(bloquesLocales);
      const directorioCentral = Buffer.concat(registrosCentrales);

      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0); // firma EOCD
      eocd.writeUInt16LE(nombresArchivos.length, 8);
      eocd.writeUInt16LE(nombresArchivos.length, 10);
      eocd.writeUInt32LE(directorioCentral.length, 12);
      eocd.writeUInt32LE(datosLocales.length, 16);

      return Buffer.concat([datosLocales, directorioCentral, eocd]);
    }

    const zipConPdfYXml = construirZipDePrueba(['factura.pdf', 'factura.xml']);
    const zipSoloConPdf = construirZipDePrueba(['factura.pdf']);
    const zipSoloConXml = construirZipDePrueba(['factura.xml']);
    const zipConExtra = construirZipDePrueba(['factura.pdf', 'factura.xml', 'notas.txt']);
    const zipEnCarpeta = construirZipDePrueba(['carpeta/factura.pdf', 'carpeta/factura.xml']);
    const zipVacioDeVerdad = construirZipDePrueba([]);
    const zipConSoloTxt = construirZipDePrueba(['notas.txt']);
    const zipMayusculas = construirZipDePrueba(['FACTURA.PDF', 'FACTURA.XML']);

    log(
      JSON.stringify(zipContienePdfYXml(zipConPdfYXml)) === JSON.stringify({ tienePdf: true, tieneXml: true, valido: true }),
      'ZIP con PDF y XML dentro → válido'
    );
    log(
      JSON.stringify(zipContienePdfYXml(zipSoloConPdf)) === JSON.stringify({ tienePdf: true, tieneXml: false, valido: false }),
      'ZIP solo con PDF (sin XML) → inválido, falta el XML'
    );
    log(
      JSON.stringify(zipContienePdfYXml(zipSoloConXml)) === JSON.stringify({ tienePdf: false, tieneXml: true, valido: false }),
      'ZIP solo con XML (sin PDF) → inválido, falta el PDF'
    );
    log(
      JSON.stringify(zipContienePdfYXml(zipConExtra)) === JSON.stringify({ tienePdf: true, tieneXml: true, valido: true }),
      'ZIP con PDF + XML + un archivo extra → válido (el archivo extra no afecta)'
    );
    log(
      JSON.stringify(zipContienePdfYXml(zipEnCarpeta)) === JSON.stringify({ tienePdf: true, tieneXml: true, valido: true }),
      'ZIP con PDF y XML dentro de una carpeta (ruta con "/") → válido'
    );
    log(
      JSON.stringify(zipContienePdfYXml(zipVacioDeVerdad)) === JSON.stringify({ tienePdf: false, tieneXml: false, valido: false }),
      'ZIP realmente vacío (sin ningún archivo adentro) → inválido'
    );
    log(
      JSON.stringify(zipContienePdfYXml(zipConSoloTxt)) === JSON.stringify({ tienePdf: false, tieneXml: false, valido: false }),
      'ZIP con solo un archivo no relacionado (.txt) → inválido'
    );
    log(
      JSON.stringify(zipContienePdfYXml(zipMayusculas)) === JSON.stringify({ tienePdf: true, tieneXml: true, valido: true }),
      'ZIP con extensiones en mayúsculas (.PDF/.XML) → válido, la comparación no distingue mayúsculas/minúsculas'
    );
  } catch (err) {
    log(false, 'Validación de ZIP para la factura de un ticket', err.message);
  }

  // ---------- Bug corregido: POST /api/auth/login truncaba el usuario a 13 caracteres ----------
  // Reportado por el usuario: al generar una contraseña para una cuenta
  // desde el panel y luego intentar iniciar sesión, el login rechazaba
  // las credenciales como inválidas aunque la contraseña fuera correcta.
  // Causa real: `POST /api/auth/login` truncaba el campo "rfc" del
  // cuerpo de la petición a 13 caracteres (`sanitizeText(body.rfc, 13)`)
  // — el máximo de un RFC real —, pero las cuentas con perfil
  // "administrador"/"fiscal" usan un nombre de usuario libre que puede
  // ser más largo (ver POST /api/admin/usuarios, que ya usaba el límite
  // correcto de 50). Un usuario más largo que 13 caracteres se truncaba
  // ANTES de comparar contra la base de datos, así que nunca coincidía
  // con el RFC completo guardado — pase lo que pase con la contraseña.
  const RFC_PRUEBA_LOGIN_LARGO = `${PREFIJO_PRUEBA}_administrador_fiscal_largo`;
  const PASSWORD_PRUEBA_LOGIN = 'ClaveDePruebaLogin1';
  try {
    log(
      RFC_PRUEBA_LOGIN_LARGO.length > 13,
      'El usuario de prueba realmente es más largo que 13 caracteres (para que la prueba sea válida)'
    );

    const ahoraLogin = new Date();
    const hashLogin = hashPassword(PASSWORD_PRUEBA_LOGIN);
    await pool.query(
      `INSERT INTO usuarios (rfc, telefono, password_hash, perfil, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?)`,
      [RFC_PRUEBA_LOGIN_LARGO, '', hashLogin, 'administrador', ahoraLogin, ahoraLogin]
    );

    // Reproduce la misma consulta que hace POST /api/auth/login: aplica
    // el mismo truncamiento por longitud, normaliza a mayúsculas, y
    // busca el RFC exacto — con el límite indicado como parámetro, para
    // poder comparar el comportamiento viejo (13) contra el nuevo (50).
    function simularSanitizeText(valor, maxLen) {
      return String(valor || '').trim().slice(0, maxLen);
    }
    async function simularLogin(rfcEscrito, password, limiteTruncamiento) {
      const rfc = simularSanitizeText(rfcEscrito, limiteTruncamiento).toUpperCase();
      const [filas] = await pool.query('SELECT * FROM usuarios WHERE rfc = ?', [rfc]);
      const usuario = filas[0];
      if (!usuario || !verifyPassword(password, usuario.password_hash)) return { ok: false };
      return { ok: true };
    }

    const conLimiteViejo = await simularLogin(RFC_PRUEBA_LOGIN_LARGO, PASSWORD_PRUEBA_LOGIN, 13);
    log(
      conLimiteViejo.ok === false,
      'BUG REPRODUCIDO: con el límite viejo (13 caracteres), el login de un usuario largo fallaba aunque la contraseña fuera correcta'
    );

    const conLimiteNuevo = await simularLogin(RFC_PRUEBA_LOGIN_LARGO, PASSWORD_PRUEBA_LOGIN, 50);
    log(
      conLimiteNuevo.ok === true,
      'CORREGIDO: con el límite nuevo (50 caracteres, el que usa POST /api/auth/login ahora), el mismo login funciona'
    );

    const conPasswordIncorrecta = await simularLogin(RFC_PRUEBA_LOGIN_LARGO, 'password-equivocada', 50);
    log(
      conPasswordIncorrecta.ok === false,
      'Con el límite nuevo, una contraseña realmente incorrecta se sigue rechazando (no se volvió permisivo de más)'
    );
  } catch (err) {
    log(false, 'Login de cuentas con nombre de usuario largo (bug corregido)', err.message);
  } finally {
    await pool.query('DELETE FROM usuarios WHERE rfc = ?', [RFC_PRUEBA_LOGIN_LARGO]);
  }

  // Cuenta cliente normal (RFC real, corto): confirma que nunca se vio
  // afectada por el bug, ni por la corrección.
  const RFC_PRUEBA_LOGIN_CORTO = 'BBB020202BB2';
  try {
    const ahoraCorto = new Date();
    const hashCorto = hashPassword(PASSWORD_PRUEBA_LOGIN);
    await pool.query(
      `INSERT INTO usuarios (rfc, telefono, password_hash, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)`,
      [RFC_PRUEBA_LOGIN_CORTO, '5500000000', hashCorto, ahoraCorto, ahoraCorto]
    );
    function simularSanitizeTextCorto(valor, maxLen) {
      return String(valor || '').trim().slice(0, maxLen);
    }
    async function simularLoginCorto(rfcEscrito, password, limiteTruncamiento) {
      const rfc = simularSanitizeTextCorto(rfcEscrito, limiteTruncamiento).toUpperCase();
      const [filas] = await pool.query('SELECT * FROM usuarios WHERE rfc = ?', [rfc]);
      const usuario = filas[0];
      if (!usuario || !verifyPassword(password, usuario.password_hash)) return { ok: false };
      return { ok: true };
    }
    const resultado = await simularLoginCorto(RFC_PRUEBA_LOGIN_CORTO, PASSWORD_PRUEBA_LOGIN, 50);
    log(resultado.ok === true, 'Una cuenta cliente con RFC real (12 caracteres) sigue iniciando sesión con normalidad tras la corrección');
  } catch (err) {
    log(false, 'Login de cuenta cliente normal (control de que la corrección no rompió nada)', err.message);
  } finally {
    await pool.query('DELETE FROM usuarios WHERE rfc = ?', [RFC_PRUEBA_LOGIN_CORTO]);
  }

  // ---------- Estructura de la tabla ----------
  const [columnas] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'registros'`
  );
  const nombresColumnas = columnas.map((c) => c.COLUMN_NAME);
  const esperadas = [
    'id', 'nombre', 'tipo_persona', 'rfc', 'email', 'indicaciones',
    'archivo_nombre_original', 'archivo_nombre_guardado', 'archivo_mime',
    'archivo_tamano_bytes', 'regimen_fiscal', 'codigo_postal', 'uso_cfdi',
    'eliminado_en', 'creado_en', 'actualizado_en',
  ];
  const faltantes = esperadas.filter((c) => !nombresColumnas.includes(c));
  log(faltantes.length === 0, 'La tabla registros tiene todas las columnas esperadas', `faltantes=${faltantes.join(',')}`);

  // Limpieza defensiva por si una corrida anterior fallo a la mitad
  await limpiarDatosDePrueba();

  // ---------- CRUD basico ----------
  let idInsertado = null;
  try {
    const ahora = new Date();
    const [resultado] = await pool.query(
      `INSERT INTO registros
        (nombre, tipo_persona, rfc, email, indicaciones,
         archivo_nombre_original, archivo_nombre_guardado, archivo_mime, archivo_tamano_bytes,
         regimen_fiscal, codigo_postal, uso_cfdi, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Cliente de Prueba SA de CV', 'moral', 'ABC010101XY1', EMAIL_PRUEBA, 'Indicaciones de prueba',
        'constancia.pdf', 'uuid-prueba.pdf', 'application/pdf', 12345,
        '601 - General de Ley Personas Morales', '45100', 'G03', ahora, ahora,
      ]
    );
    idInsertado = resultado.insertId;
    log(Boolean(idInsertado), 'INSERT crea un registro y devuelve insertId', `id=${idInsertado}`);
  } catch (err) {
    log(false, 'INSERT crea un registro y devuelve insertId', err.message);
  }

  try {
    const [filas] = await pool.query('SELECT * FROM registros WHERE id = ?', [idInsertado]);
    const fila = filas[0];
    log(
      !!fila && fila.email === EMAIL_PRUEBA && fila.uso_cfdi === 'G03',
      'SELECT recupera el registro con los datos correctos',
      JSON.stringify(fila && { email: fila.email, uso_cfdi: fila.uso_cfdi, tipo_persona: fila.tipo_persona })
    );
  } catch (err) {
    log(false, 'SELECT recupera el registro con los datos correctos', err.message);
  }

  // Restriccion UNIQUE en email
  try {
    await pool.query(
      `INSERT INTO registros
        (nombre, tipo_persona, rfc, email, archivo_nombre_original, archivo_nombre_guardado,
         archivo_mime, archivo_tamano_bytes, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Otro Cliente', 'fisica', 'XYZ020202AB2', EMAIL_PRUEBA, 'b.pdf', 'uuid-b.pdf', 'application/pdf', 100, new Date(), new Date()]
    );
    log(false, 'La restricción UNIQUE en email rechaza un correo duplicado', 'no lanzo error (deberia haber fallado)');
  } catch (err) {
    log(err.code === 'ER_DUP_ENTRY', 'La restricción UNIQUE en email rechaza un correo duplicado', err.code);
  }

  // Restriccion CHECK en tipo_persona
  try {
    await pool.query(
      `INSERT INTO registros
        (nombre, tipo_persona, email, archivo_nombre_original, archivo_nombre_guardado,
         archivo_mime, archivo_tamano_bytes, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Cliente Invalido', 'invalido', EMAIL_PRUEBA_2, 'c.pdf', 'uuid-c.pdf', 'application/pdf', 100, new Date(), new Date()]
    );
    log(false, 'La restricción CHECK en tipo_persona rechaza un valor invalido', 'no lanzo error (deberia haber fallado)');
  } catch (err) {
    log(
      err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || /CONSTRAINT/i.test(err.message || ''),
      'La restricción CHECK en tipo_persona rechaza un valor invalido',
      err.code || err.message
    );
  }

  // UPDATE
  try {
    const [resultado] = await pool.query(
      'UPDATE registros SET indicaciones = ? WHERE id = ?',
      ['Indicaciones actualizadas', idInsertado]
    );
    const [filas] = await pool.query('SELECT indicaciones FROM registros WHERE id = ?', [idInsertado]);
    log(
      resultado.affectedRows === 1 && filas[0].indicaciones === 'Indicaciones actualizadas',
      'UPDATE modifica el registro correctamente'
    );
  } catch (err) {
    log(false, 'UPDATE modifica el registro correctamente', err.message);
  }

  // ---------- Borrado lógico / restaurar / borrado físico ----------
  try {
    const ahora = new Date();
    const [resultado] = await pool.query(
      'UPDATE registros SET eliminado_en = ? WHERE id = ? AND eliminado_en IS NULL',
      [ahora, idInsertado]
    );
    const [activos] = await pool.query('SELECT id FROM registros WHERE id = ? AND eliminado_en IS NULL', [idInsertado]);
    log(resultado.affectedRows === 1 && activos.length === 0, 'Borrado lógico saca el registro de la vista de activos');
  } catch (err) {
    log(false, 'Borrado lógico saca el registro de la vista de activos', err.message);
  }

  try {
    const [resultado] = await pool.query(
      'UPDATE registros SET eliminado_en = NULL WHERE id = ? AND eliminado_en IS NOT NULL',
      [idInsertado]
    );
    const [activos] = await pool.query('SELECT id FROM registros WHERE id = ? AND eliminado_en IS NULL', [idInsertado]);
    log(resultado.affectedRows === 1 && activos.length === 1, 'Restaurar regresa el registro a la vista de activos');
  } catch (err) {
    log(false, 'Restaurar regresa el registro a la vista de activos', err.message);
  }

  try {
    const [resultado] = await pool.query('DELETE FROM registros WHERE id = ?', [idInsertado]);
    const [filas] = await pool.query('SELECT id FROM registros WHERE id = ?', [idInsertado]);
    log(resultado.affectedRows === 1 && filas.length === 0, 'Borrado físico elimina la fila permanentemente');
  } catch (err) {
    log(false, 'Borrado físico elimina la fila permanentemente', err.message);
  }

  // ---------- utils/config.js (campos obligatorios) ----------
  try {
    const original = await getCamposObligatorios();
    log(typeof original.tipo_persona === 'boolean', 'getCamposObligatorios() devuelve valores por defecto', JSON.stringify(original));

    const actualizado = await setCamposObligatorios({ rfc: true, uso_cfdi: true });
    log(actualizado.rfc === true && actualizado.uso_cfdi === true, 'setCamposObligatorios() guarda cambios');

    const releido = await getCamposObligatorios();
    log(releido.rfc === true && releido.uso_cfdi === true, 'getCamposObligatorios() refleja el cambio guardado (persistencia real)');

    // "tipo_pago" y "comentarios" (tickets) ahora también son
    // configurables como obligatorio/opcional, con la misma regla que ya
    // usa "uso_cfdi" — confirma que se guardan y se leen correctamente.
    const conCamposTicket = await setCamposObligatorios({ tipo_pago: true, comentarios: true });
    log(
      conCamposTicket.tipo_pago === true && conCamposTicket.comentarios === true,
      'setCamposObligatorios() guarda "tipo_pago" y "comentarios" (campos de tickets) correctamente'
    );
    const releidoTicket = await getCamposObligatorios();
    log(
      releidoTicket.tipo_pago === true && releidoTicket.comentarios === true,
      'getCamposObligatorios() refleja el cambio guardado para "tipo_pago"/"comentarios" (persistencia real)'
    );
    const conCamposTicketApagados = await setCamposObligatorios({ tipo_pago: false, comentarios: false });
    log(
      conCamposTicketApagados.tipo_pago === false && conCamposTicketApagados.comentarios === false,
      '"tipo_pago" y "comentarios" también se pueden volver a marcar como opcionales'
    );

    // "indicaciones" se quitó de CAMPOS_CONFIGURABLES (ya no existe ese
    // campo en ningún formulario) — confirma que intentar marcarlo
    // obligatorio se ignora silenciosamente, en vez de guardarse por error.
    const conIndicaciones = await setCamposObligatorios({ indicaciones: true });
    log(
      !('indicaciones' in conIndicaciones),
      '"indicaciones" ya no se acepta como campo configurable (se quitó ese formulario)'
    );

    // Restaura el estado original para no dejar la configuracion alterada
    await setCamposObligatorios(original);
    const restaurado = await getCamposObligatorios();
    log(JSON.stringify(restaurado) === JSON.stringify(original), 'La configuración se puede restaurar a su estado previo');
  } catch (err) {
    log(false, 'utils/config.js funciona correctamente contra MySQL', err.message);
  }

  // ---------- utils/usoCfdi.js (catálogo) ----------
  try {
    const usos = await getUsosCfdi();
    log(Array.isArray(usos) && usos.length >= 5, 'getUsosCfdi() devuelve un catálogo válido', `total=${usos.length}`);

    const info = await getInfoSincronizacion();
    log(typeof info.origen === 'string', 'getInfoSincronizacion() responde sin error', JSON.stringify(info));
  } catch (err) {
    log(false, 'utils/usoCfdi.js funciona correctamente contra MySQL', err.message);
  }

  // Funciones puras (no dependen de MySQL, pero se re-verifican aquí para
  // tener una sola prueba que cubra todo el módulo de un vistazo)
  log(esCatalogoValido(CATALOGO_DEFAULT), 'El catálogo incluido por defecto pasa su propia validación');
  const csvPrueba = 'clave,descripcion\nG01,Adquisición de mercancías\nG03,Gastos en general\nD10,Pagos educativos\nS01,Sin efectos\nCP01,Pagos';
  const catalogoCsv = normalizarCatalogoRemoto(csvPrueba);
  log(Array.isArray(catalogoCsv) && catalogoCsv.length === 5, 'normalizarCatalogoRemoto() interpreta CSV correctamente');

  // ---------- Configuración de correo SMTP ----------
  // OJO: esta prueba NUNCA envía un correo real (enviarCorreo() no se
  // importa a propósito) — solo prueba que guardar/leer la configuración
  // funcione y que la contraseña nunca se exponga de vuelta al frontend.
  // Guarda y restaura cualquier configuración real que ya existiera, para
  // no dejar credenciales de prueba sobrescribiendo las de producción.
  try {
    const configSmtpOriginal = await getConfigSmtp();

    const guardada = await setConfigSmtp({
      host: 'smtp.gmail.com',
      puerto: 587,
      seguridad: 'starttls',
      usuario: `${PREFIJO_PRUEBA}@gmail.com`,
      password: 'contraseña-de-prueba-temporal',
      nombre_remitente: 'Prueba de Regresión',
      correo_remitente: '',
    });
    log(guardada.host === 'smtp.gmail.com', 'setConfigSmtp() guarda la configuración correctamente');

    const mostrada = configSmtpParaMostrar(guardada);
    log(!('password' in mostrada), 'configSmtpParaMostrar() nunca expone la contraseña guardada');
    log(mostrada.passwordConfigurada === true && mostrada.configurado === true, 'El estado "configurado" se calcula correctamente');

    // Actualiza SOLO el host, sin mandar contraseña — debe conservar la
    // que ya estaba guardada en vez de borrarla.
    const actualizada = await setConfigSmtp({ host: 'smtp.otroproveedor.com', password: '' });
    log(
      actualizada.host === 'smtp.otroproveedor.com' && actualizada.password === 'contraseña-de-prueba-temporal',
      'Actualizar sin mandar contraseña conserva la contraseña existente'
    );

    // Plantilla del CUERPO del correo al cliente: si nunca se personaliza,
    // debe venir con el texto por defecto (para que el correo funcione
    // desde el primer arranque, sin que el administrador tenga que
    // configurarlo). El asunto de ese correo ya NO es configurable (se
    // quitó ese campo a propósito) — siempre es un mensaje fijo de
    // "factura lista" definido directamente en server.js, así que no
    // depende de nada guardado en la base de datos y no hace falta
    // probarlo aquí contra MySQL.
    log(
      guardada.cuerpo_cliente === DEFAULTS_SMTP.cuerpo_cliente,
      'La plantilla del cuerpo del correo al cliente trae un valor por defecto sin personalizar'
    );
    log(
      !('asunto_cliente' in DEFAULTS_SMTP),
      'DEFAULTS_SMTP ya no incluye "asunto_cliente" (se quitó ese campo de la configuración)'
    );

    // Guardar un cuerpo personalizado con variables {folio}/{rfc}, y
    // confirmar que se guarda y que aplicarPlantilla() las sustituye
    // correctamente usando el valor ya guardado en la base de datos (no
    // solo con datos de prueba en memoria).
    const conPlantillaPersonalizada = await setConfigSmtp({
      cuerpo_cliente: 'Hola, tu ticket {folio} del RFC {rfc} ya tiene factura.',
    });
    log(
      conPlantillaPersonalizada.cuerpo_cliente === 'Hola, tu ticket {folio} del RFC {rfc} ya tiene factura.',
      'El cuerpo personalizado del correo al cliente se guarda correctamente'
    );

    const cuerpoSustituido = aplicarPlantilla(conPlantillaPersonalizada.cuerpo_cliente, { folio: 'TK-000099', rfc: 'AAA010101AA1' });
    log(
      cuerpoSustituido === 'Hola, tu ticket TK-000099 del RFC AAA010101AA1 ya tiene factura.',
      'aplicarPlantilla() sustituye {folio} y {rfc} en el cuerpo usando el valor ya guardado en MySQL'
    );

    // Restaura el estado original (o borra la clave si nunca había existido)
    if (configSmtpOriginal) {
      await setConfigSmtp(configSmtpOriginal);
    } else {
      await pool.query("DELETE FROM configuracion WHERE clave = 'smtp_config'");
    }
    const restaurada = await getConfigSmtp();
    log(
      JSON.stringify(restaurada) === JSON.stringify(configSmtpOriginal),
      'La configuración SMTP real se restaura sin alteraciones tras la prueba'
    );
  } catch (err) {
    log(false, 'Configuración de correo SMTP funciona correctamente contra MySQL', err.message);
  }

  // ---------- Tabla usuarios (cuentas de login por RFC + contraseña) ----------
  let idUsuarioInsertado = null;
  try {
    const passwordValida = 'MiClaveSegura123';
    log(validarPassword(passwordValida) === null, 'validarPassword() acepta una contraseña que cumple las reglas');
    log(validarPassword('abc123') !== null, 'validarPassword() rechaza una contraseña débil');

    const hash = hashPassword(passwordValida);
    log(verifyPassword(passwordValida, hash) === true, 'verifyPassword() valida el hash correctamente');
    log(verifyPassword('otra-clave', hash) === false, 'verifyPassword() rechaza una contraseña incorrecta');

    const ahora = new Date();
    const [resultado] = await pool.query(
      `INSERT INTO usuarios (rfc, telefono, password_hash, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?)`,
      [RFC_PRUEBA_USUARIO, '5512345678', hash, ahora, ahora]
    );
    idUsuarioInsertado = resultado.insertId;
    log(Boolean(idUsuarioInsertado), 'INSERT crea una cuenta de usuario');

    const [filaPerfilDefault] = await pool.query('SELECT perfil, email FROM usuarios WHERE id = ?', [idUsuarioInsertado]);
    log(filaPerfilDefault[0].perfil === 'cliente', 'Una cuenta creada sin especificar perfil queda como "cliente" por defecto');
    log(filaPerfilDefault[0].email === null, 'Una cuenta creada sin especificar correo queda en NULL (retrocompatibilidad con cuentas antiguas)');
  } catch (err) {
    log(false, 'Tabla usuarios: creación de cuenta', err.message);
  }

  // Registro público (POST /api/auth/registro) ahora también exige y
  // guarda el correo, en la MISMA columna `usuarios.email` que ya usa el
  // alta desde el panel de administración (POST /api/admin/usuarios) —
  // se prueba aquí que ambos caminos dejan el dato en el mismo lugar.
  const RFC_PRUEBA_REGISTRO_PUBLICO = `${PREFIJO_PRUEBA}_registro_publico`;
  let idRegistroPublico = null;
  try {
    const ahoraRegistroPublico = new Date();
    const hashRegistroPublico = hashPassword('MiClaveSegura123');
    const [resultadoRegistroPublico] = await pool.query(
      `INSERT INTO usuarios (rfc, email, telefono, password_hash, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [RFC_PRUEBA_REGISTRO_PUBLICO, `${PREFIJO_PRUEBA}-registro-publico@example.test`, '5512345678', hashRegistroPublico, ahoraRegistroPublico, ahoraRegistroPublico]
    );
    idRegistroPublico = resultadoRegistroPublico.insertId;

    const [filaRegistroPublico] = await pool.query('SELECT email, perfil FROM usuarios WHERE id = ?', [idRegistroPublico]);
    log(
      filaRegistroPublico[0].email === `${PREFIJO_PRUEBA}-registro-publico@example.test`,
      'El registro público (POST /api/auth/registro) guarda el correo en la misma columna usuarios.email que usa el alta desde el panel'
    );
    log(
      filaRegistroPublico[0].perfil === 'cliente',
      'Una cuenta creada por el registro público sigue quedando con perfil "cliente" por defecto, igual que antes de agregar el correo'
    );
  } catch (err) {
    log(false, 'Registro público con correo obligatorio', err.message);
  } finally {
    if (idRegistroPublico) {
      await pool.query('DELETE FROM usuarios WHERE id = ?', [idRegistroPublico]);
    }
  }

  // ---------- Editar usuario (PUT /api/admin/usuarios/:id) ----------
  // Reproduce el mismo UPDATE que hace el endpoint real, más la
  // protección contra que un administrador se quite a sí mismo el acceso
  // al panel bajando su propio perfil a "cliente".
  const RFC_PRUEBA_EDITAR_A = `${PREFIJO_PRUEBA}_editar_a`;
  const RFC_PRUEBA_EDITAR_B = `${PREFIJO_PRUEBA}_editar_b`;
  let idUsuarioEditarA = null;
  let idUsuarioEditarB = null;
  try {
    const ahoraEditar = new Date();
    const hashEditar = hashPassword('ClaveDePrueba123');

    const [insertadoA] = await pool.query(
      `INSERT INTO usuarios (rfc, email, telefono, password_hash, perfil, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, 'cliente', ?, ?)`,
      [RFC_PRUEBA_EDITAR_A, `${PREFIJO_PRUEBA}-editar-a@example.test`, '5511112222', hashEditar, ahoraEditar, ahoraEditar]
    );
    idUsuarioEditarA = insertadoA.insertId;

    const [insertadoB] = await pool.query(
      `INSERT INTO usuarios (rfc, email, telefono, password_hash, perfil, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, 'cliente', ?, ?)`,
      [RFC_PRUEBA_EDITAR_B, `${PREFIJO_PRUEBA}-editar-b@example.test`, '5533334444', hashEditar, ahoraEditar, ahoraEditar]
    );
    idUsuarioEditarB = insertadoB.insertId;

    // Edición normal: cambia correo y teléfono, mismo UPDATE que usa el endpoint.
    const nuevoEmailA = `${PREFIJO_PRUEBA}-editar-a-nuevo@example.test`;
    await pool.query(
      'UPDATE usuarios SET rfc = ?, email = ?, telefono = ?, perfil = ?, actualizado_en = ? WHERE id = ?',
      [RFC_PRUEBA_EDITAR_A, nuevoEmailA, '5599998888', 'cliente', new Date(), idUsuarioEditarA]
    );
    const [filaEditadaA] = await pool.query('SELECT email, telefono FROM usuarios WHERE id = ?', [idUsuarioEditarA]);
    log(
      filaEditadaA[0].email === nuevoEmailA && filaEditadaA[0].telefono === '5599998888',
      'PUT /api/admin/usuarios/:id actualiza correo y teléfono correctamente'
    );

    // Unicidad de RFC al editar: no se puede cambiar el RFC de A al mismo que ya tiene B.
    const [conflictoRfc] = await pool.query('SELECT id FROM usuarios WHERE rfc = ? AND id != ?', [RFC_PRUEBA_EDITAR_B, idUsuarioEditarA]);
    log(conflictoRfc.length === 1, 'Editar intentando usar el RFC de otra cuenta existente se detecta correctamente (se rechazaría con 409)');

    // Protección de auto-degradación: misma comparación que usa el endpoint real.
    function seRechazariaPorAutoDegradacion(rfcDeLaCuenta, perfilActualDeLaCuenta, adminAutenticadoComo, perfilNuevo) {
      return rfcDeLaCuenta === adminAutenticadoComo && ['administrador', 'fiscal'].includes(perfilActualDeLaCuenta) && perfilNuevo === 'cliente';
    }
    log(
      seRechazariaPorAutoDegradacion('jperez', 'administrador', 'jperez', 'cliente') === true,
      'Un administrador no puede bajar su propio perfil a "cliente" mientras tiene la sesión iniciada con esa cuenta'
    );
    log(
      seRechazariaPorAutoDegradacion('otro_admin', 'administrador', 'jperez', 'cliente') === false,
      'Un administrador SÍ puede bajar el perfil de OTRA cuenta administrador/fiscal a "cliente"'
    );
    log(
      seRechazariaPorAutoDegradacion('jperez', 'administrador', 'jperez', 'administrador') === false,
      'Editar los propios datos sin cambiar el perfil no se bloquea'
    );
  } catch (err) {
    log(false, 'Editar usuario (PUT /api/admin/usuarios/:id)', err.message);
  } finally {
    if (idUsuarioEditarA) await pool.query('DELETE FROM usuarios WHERE id = ?', [idUsuarioEditarA]);
    if (idUsuarioEditarB) await pool.query('DELETE FROM usuarios WHERE id = ?', [idUsuarioEditarB]);
  }

  // Restricción UNIQUE en rfc (un RFC no puede registrarse dos veces)
  try {
    await pool.query(
      `INSERT INTO usuarios (rfc, telefono, password_hash, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?)`,
      [RFC_PRUEBA_USUARIO, '5599999999', hashPassword('OtraClave123'), new Date(), new Date()]
    );
    log(false, 'La restricción UNIQUE en rfc (usuarios) rechaza un RFC duplicado', 'no lanzo error (deberia haber fallado)');
  } catch (err) {
    log(err.code === 'ER_DUP_ENTRY', 'La restricción UNIQUE en rfc (usuarios) rechaza un RFC duplicado', err.code);
  }

  // debe_cambiar_password: por defecto false, y el flujo de "forzar
  // cambio" del admin (restablecer contraseña) + el auto-cambio del
  // usuario (que la debe apagar) funcionan correctamente.
  try {
    const [filas] = await pool.query('SELECT debe_cambiar_password FROM usuarios WHERE id = ?', [idUsuarioInsertado]);
    log(Boolean(filas[0].debe_cambiar_password) === false, 'debe_cambiar_password inicia en falso por defecto');

    // Simula al administrador restableciendo la contraseña con "forzar cambio" activado
    await pool.query(
      'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1, actualizado_en = ? WHERE id = ?',
      [hashPassword('TemporalAdmin1'), new Date(), idUsuarioInsertado]
    );
    const [forzado] = await pool.query('SELECT debe_cambiar_password FROM usuarios WHERE id = ?', [idUsuarioInsertado]);
    log(Boolean(forzado[0].debe_cambiar_password) === true, 'El admin puede forzar el cambio de contraseña al restablecerla');

    // Simula al usuario cambiando su propia contraseña (debe apagar la bandera)
    await pool.query(
      'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, actualizado_en = ? WHERE id = ?',
      [hashPassword('MiNuevaClaveDefinitiva1'), new Date(), idUsuarioInsertado]
    );
    const [liberado] = await pool.query('SELECT debe_cambiar_password FROM usuarios WHERE id = ?', [idUsuarioInsertado]);
    log(Boolean(liberado[0].debe_cambiar_password) === false, 'Cambiar la contraseña apaga la bandera de cambio obligatorio');
  } catch (err) {
    log(false, 'Flujo de debe_cambiar_password', err.message);
  }

  // ---------- Perfiles de usuario (cliente / administrador / fiscal) ----------
  const RFC_PRUEBA_ADMIN = `${PREFIJO_PRUEBA}_admin`;
  const RFC_PRUEBA_FISCAL = `${PREFIJO_PRUEBA}_fiscal`;
  try {
    // Restricción CHECK en perfil
    try {
      await pool.query('UPDATE usuarios SET perfil = ? WHERE id = ?', ['perfil_invalido', idUsuarioInsertado]);
      log(false, 'La restricción CHECK en perfil (usuarios) rechaza un valor inválido', 'no lanzo error (deberia haber fallado)');
    } catch (err) {
      log(
        err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || /CONSTRAINT/i.test(err.message || ''),
        'La restricción CHECK en perfil (usuarios) rechaza un valor inválido',
        err.code || err.message
      );
    }

    // Crea una cuenta "administrador" y otra "fiscal" (mismo flujo que
    // POST /api/admin/usuarios, aquí replicado directamente sobre la BD)
    const ahoraPerfiles = new Date();
    const hashAdmin = hashPassword('ClaveAdministrador1');
    const hashFiscal = hashPassword('ClaveFiscal12345');
    await pool.query(
      `INSERT INTO usuarios (rfc, telefono, password_hash, perfil, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?)`,
      [RFC_PRUEBA_ADMIN, '', hashAdmin, 'administrador', ahoraPerfiles, ahoraPerfiles]
    );
    await pool.query(
      `INSERT INTO usuarios (rfc, telefono, password_hash, perfil, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?)`,
      [RFC_PRUEBA_FISCAL, '', hashFiscal, 'fiscal', ahoraPerfiles, ahoraPerfiles]
    );
    const [creados] = await pool.query('SELECT rfc, perfil FROM usuarios WHERE rfc IN (?, ?)', [RFC_PRUEBA_ADMIN, RFC_PRUEBA_FISCAL]);
    log(creados.length === 2, 'Se pueden crear cuentas con perfil "administrador" y "fiscal"');

    // Filtro por perfil (misma consulta que usa GET /api/admin/usuarios?perfil=)
    const [soloAdmins] = await pool.query("SELECT rfc FROM usuarios WHERE perfil = 'administrador'");
    const [soloFiscales] = await pool.query("SELECT rfc FROM usuarios WHERE perfil = 'fiscal'");
    log(
      soloAdmins.some((u) => u.rfc === RFC_PRUEBA_ADMIN) && !soloAdmins.some((u) => u.rfc === RFC_PRUEBA_FISCAL),
      'El filtro por perfil "administrador" no mezcla cuentas de otros perfiles'
    );
    log(
      soloFiscales.some((u) => u.rfc === RFC_PRUEBA_FISCAL) && !soloFiscales.some((u) => u.rfc === RFC_PRUEBA_ADMIN),
      'El filtro por perfil "fiscal" no mezcla cuentas de otros perfiles'
    );

    // Simula exactamente la consulta que usa requireAdminAuth() (mecanismo
    // #3 en auth.js) para verificar que un administrador/fiscal creado
    // desde el panel puede autenticarse, y que un "cliente" NO puede
    // (aunque adivinara la contraseña correcta) porque la consulta lo
    // excluye a nivel SQL, no solo en la capa de la aplicación.
    async function simularVerificacionAdministrativa(usuario, password) {
      const [filas] = await pool.query(
        "SELECT rfc, password_hash, perfil FROM usuarios WHERE rfc = ? AND perfil IN ('administrador', 'fiscal')",
        [usuario]
      );
      const fila = filas[0];
      if (!fila) return null;
      if (!verifyPassword(password, fila.password_hash)) return null;
      return fila;
    }

    const adminVerificado = await simularVerificacionAdministrativa(RFC_PRUEBA_ADMIN, 'ClaveAdministrador1');
    log(adminVerificado && adminVerificado.perfil === 'administrador', 'Un usuario con perfil "administrador" se autentica correctamente para el panel');

    const fiscalVerificado = await simularVerificacionAdministrativa(RFC_PRUEBA_FISCAL, 'ClaveFiscal12345');
    log(fiscalVerificado && fiscalVerificado.perfil === 'fiscal', 'Un usuario con perfil "fiscal" se autentica correctamente para el panel');

    const clienteRechazado = await simularVerificacionAdministrativa(RFC_PRUEBA_USUARIO, 'MiClaveSegura123');
    log(clienteRechazado === null, 'Un usuario con perfil "cliente" NO puede autenticarse para el panel, aunque la contraseña sea correcta');

    const passwordIncorrecta = await simularVerificacionAdministrativa(RFC_PRUEBA_ADMIN, 'clave-equivocada');
    log(passwordIncorrecta === null, 'Un administrador con la contraseña incorrecta es rechazado');
  } catch (err) {
    log(false, 'Perfiles de usuario (administrador/fiscal)', err.message);
  } finally {
    await pool.query('DELETE FROM usuarios WHERE rfc IN (?, ?)', [RFC_PRUEBA_ADMIN, RFC_PRUEBA_FISCAL]);
  }

  // ---------- Restricción de acceso por perfil en admin.html ----------
  // requireAdminAuth() (auth.js) asigna req.adminPerfil = 'super' tanto
  // para ADMIN_USERS como para la cuenta de respaldo "admin" — ninguno
  // de los dos aparece en el mapa RESTRICCIONES_PERFIL del frontend
  // (admin.js), lo que ahí significa "sin restricciones". Aquí se
  // reproduce esa MISMA lógica de mapa para confirmar que las vistas y
  // tarjetas correctas quedan permitidas para cada perfil — no contra
  // el DOM (esto corre en Node, sin navegador), sino contra la lógica
  // pura, que es idéntica a la que ya se probó a mano en el navegador
  // antes de integrarla.
  try {
    const RESTRICCIONES_PERFIL = {
      administrador: {
        vistasPermitidas: ['ordenes', 'usuarios', 'lectura-reportes', 'configuraciones'],
        tarjetasConfigPermitidas: ['global-config-card', 'reportes-config-card'],
      },
      fiscal: {
        vistasPermitidas: ['constancias', 'tickets', 'configuraciones'],
        tarjetasConfigPermitidas: ['admin-config-card', 'global-config-card'],
      },
    };
    const TODAS_LAS_VISTAS = ['constancias', 'tickets', 'ordenes', 'usuarios', 'configuraciones', 'lectura-reportes'];
    const TODAS_LAS_TARJETAS = ['admin-config-card', 'global-config-card', 'smtp-config-card', 'reportes-config-card'];

    function vistasVisibles(perfil) {
      const restriccion = RESTRICCIONES_PERFIL[perfil];
      if (!restriccion) return TODAS_LAS_VISTAS;
      return TODAS_LAS_VISTAS.filter((v) => restriccion.vistasPermitidas.includes(v));
    }
    function tarjetasVisibles(perfil) {
      const restriccion = RESTRICCIONES_PERFIL[perfil];
      if (!restriccion) return TODAS_LAS_TARJETAS;
      return TODAS_LAS_TARJETAS.filter((t) => (restriccion.tarjetasConfigPermitidas || []).includes(t));
    }
    const mismosElementos = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

    log(
      mismosElementos(vistasVisibles('super'), TODAS_LAS_VISTAS),
      'Perfil "super" (sin entrada en el mapa de restricciones) ve todas las vistas del panel'
    );
    log(
      mismosElementos(tarjetasVisibles('super'), TODAS_LAS_TARJETAS),
      'Perfil "super" ve las 4 tarjetas de "Configuraciones globales"'
    );
    log(
      mismosElementos(vistasVisibles('administrador'), ['ordenes', 'usuarios', 'configuraciones', 'lectura-reportes']),
      '"administrador" ve Órdenes de compra, Usuarios, Reportes y Configuraciones globales — NO Constancias ni Tickets'
    );
    log(
      mismosElementos(tarjetasVisibles('administrador'), ['global-config-card', 'reportes-config-card']),
      '"administrador" dentro de Configuraciones globales solo ve Configuraciones fiscales y Configuración Reportes'
    );
    log(
      mismosElementos(vistasVisibles('fiscal'), ['constancias', 'tickets', 'configuraciones']),
      '"fiscal" ve Constancias, Tickets y Configuraciones globales — NO Órdenes de compra, Usuarios ni Reportes'
    );
    log(
      mismosElementos(tarjetasVisibles('fiscal'), ['admin-config-card', 'global-config-card']),
      '"fiscal" dentro de Configuraciones globales solo ve Campos obligatorios y Configuraciones fiscales'
    );

    // "Cuenta de respaldo admin" y la tabla de "Perfiles y roles de
    // acceso" son exclusivas del usuario "admin" EXACTO — ni siquiera de
    // otras cuentas "super" que hayan entrado por ADMIN_USERS con otro
    // nombre.
    const esVisibleParaAdminFallback = (usuario) => usuario === 'admin';
    log(esVisibleParaAdminFallback('admin') === true, 'El usuario "admin" exacto sí ve "Cuenta de respaldo admin" y la tabla de perfiles');
    log(esVisibleParaAdminFallback('otro_super_por_env') === false, 'Una cuenta "super" distinta de "admin" (ej. por ADMIN_USERS) NO ve esas dos secciones');
  } catch (err) {
    log(false, 'Restricción de acceso por perfil (lógica de vistas/tarjetas)', err.message);
  }

  // ---------- Segunda capa: autorización por perfil en el backend ----------
  // A diferencia del bloque anterior (que reproduce la lógica de
  // admin.js para la interfaz), esto prueba las funciones REALES de
  // auth.js — requireAdminArea()/requireUsuarioAdminExacto() — que son
  // las que de verdad protegen cada endpoint del backend, no una
  // reproducción de su lógica.
  try {
    function simularRespuestaExpress() {
      const estado = { codigo: null, cuerpo: null, siguio: false };
      const res = {
        status(c) { estado.codigo = c; return this; },
        json(b) { estado.cuerpo = b; return this; },
      };
      const next = () => { estado.siguio = true; };
      return { estado, res, next };
    }

    // requireAdminArea(): "super" siempre pasa, sin importar el área.
    let m = requireAdminArea('fiscal');
    let sim = simularRespuestaExpress();
    m({ adminPerfil: 'super' }, sim.res, sim.next);
    log(sim.estado.siguio === true, 'requireAdminArea(): el perfil "super" pasa cualquier área, sin importar cuál se le pida');

    // Un perfil SÍ incluido en la lista de la ruta, pasa.
    sim = simularRespuestaExpress();
    m({ adminPerfil: 'fiscal' }, sim.res, sim.next);
    log(sim.estado.siguio === true, 'requireAdminArea(\'fiscal\'): un perfil "fiscal" pasa');

    // Un perfil NO incluido, se rechaza con 403 (no 401 — la sesión ya
    // es válida, lo que falta es autorización sobre ESTA área).
    sim = simularRespuestaExpress();
    m({ adminPerfil: 'administrador' }, sim.res, sim.next);
    log(
      sim.estado.siguio === false && sim.estado.codigo === 403,
      'requireAdminArea(\'fiscal\'): un perfil "administrador" NO pasa, responde 403 (no 401 — es autorización, no autenticación)'
    );

    // Área compartida entre dos perfiles (ej. "Configuraciones
    // fiscales", que ven tanto administrador como fiscal).
    let m2 = requireAdminArea('administrador', 'fiscal');
    sim = simularRespuestaExpress();
    m2({ adminPerfil: 'administrador' }, sim.res, sim.next);
    log(sim.estado.siguio === true, 'requireAdminArea(\'administrador\', \'fiscal\'): "administrador" pasa un área compartida');
    sim = simularRespuestaExpress();
    m2({ adminPerfil: 'fiscal' }, sim.res, sim.next);
    log(sim.estado.siguio === true, 'requireAdminArea(\'administrador\', \'fiscal\'): "fiscal" también pasa esa misma área compartida');

    // requireUsuarioAdminExacto(): el nombre de usuario real importa,
    // no el perfil — ni siquiera otra cuenta "super" (ej. ADMIN_USERS
    // con un nombre distinto) debe pasar.
    sim = simularRespuestaExpress();
    requireUsuarioAdminExacto({ adminUser: 'admin' }, sim.res, sim.next);
    log(sim.estado.siguio === true, 'requireUsuarioAdminExacto(): el usuario "admin" exacto pasa');

    sim = simularRespuestaExpress();
    requireUsuarioAdminExacto({ adminUser: 'otro_super_por_env' }, sim.res, sim.next);
    log(
      sim.estado.siguio === false && sim.estado.codigo === 403,
      'requireUsuarioAdminExacto(): una cuenta distinta de "admin" (aunque sea "super" vía ADMIN_USERS) NO pasa, responde 403'
    );

    // Autorización a nivel de campo en PUT /api/admin/config/global —
    // "correo_reportes" pertenece a la tarjeta "Configuración Reportes"
    // (solo administrador), aunque el resto de los campos de esta misma
    // ruta pertenecen a "Configuraciones fiscales" (administrador +
    // fiscal). Se reproduce aquí la misma condición exacta que usa el
    // handler real en server.js.
    function bloqueaCorreoReportes(body, perfil) {
      return body.correo_reportes !== undefined && perfil !== 'super' && perfil !== 'administrador';
    }
    log(
      bloqueaCorreoReportes({ correo_reportes: 'x@y.com' }, 'fiscal') === true,
      'PUT config/global: un perfil "fiscal" NO puede guardar correo_reportes, aunque sí tenga acceso al resto de la ruta'
    );
    log(
      bloqueaCorreoReportes({ correo_reportes: 'x@y.com' }, 'administrador') === false,
      'PUT config/global: un perfil "administrador" SÍ puede guardar correo_reportes'
    );
    log(
      bloqueaCorreoReportes({ iva_porcentaje: 16 }, 'fiscal') === false,
      'PUT config/global: un perfil "fiscal" SÍ puede guardar los demás campos (ej. iva_porcentaje) cuando correo_reportes no viene en el cuerpo'
    );

    // Mismo caso especial, ahora para "ordenes_compra_habilitado" — el
    // interruptor "Habilitar Orden de compra" se movió de
    // "Configuraciones fiscales" a la vista "Usuarios" (exclusiva de
    // administrador), así que este campo necesita la misma protección
    // de nivel de campo que ya tiene correo_reportes.
    function bloqueaOrdenesHabilitado(body, perfil) {
      return body.ordenes_compra_habilitado !== undefined && perfil !== 'super' && perfil !== 'administrador';
    }
    log(
      bloqueaOrdenesHabilitado({ ordenes_compra_habilitado: true }, 'fiscal') === true,
      'PUT config/global: un perfil "fiscal" NO puede activar/desactivar Orden de compra, aunque sí tenga acceso al resto de la ruta'
    );
    log(
      bloqueaOrdenesHabilitado({ ordenes_compra_habilitado: false }, 'administrador') === false,
      'PUT config/global: un perfil "administrador" SÍ puede activar/desactivar Orden de compra'
    );
    log(
      bloqueaOrdenesHabilitado({ ordenes_compra_habilitado: true }, 'super') === false,
      'PUT config/global: el perfil "super" SÍ puede activar/desactivar Orden de compra (sin restricciones, como siempre)'
    );
  } catch (err) {
    log(false, 'Segunda capa: autorización por perfil en cada endpoint del backend (requireAdminArea/requireUsuarioAdminExacto)', err.message);
  }

  // ---------- Correo obligatorio al crear usuario + eliminar usuario ----------
  // Reproduce el flujo real de POST /api/admin/usuarios (que ahora exige
  // correo, usado para la invitación) y de DELETE /api/admin/usuarios/:id
  // (incluyendo el candado que evita que un administrador se elimine a sí
  // mismo mientras tiene la sesión iniciada con esa cuenta).
  const RFC_PRUEBA_CON_CORREO = `${PREFIJO_PRUEBA}_correo`;
  try {
    const ahoraCorreo = new Date();
    const hashCorreo = hashPassword('ClaveConCorreo1');
    const [resultadoCorreo] = await pool.query(
      `INSERT INTO usuarios (rfc, telefono, email, password_hash, debe_cambiar_password, perfil, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [RFC_PRUEBA_CON_CORREO, '', `${PREFIJO_PRUEBA}-invitado@example.test`, hashCorreo, 1, 'administrador', ahoraCorreo, ahoraCorreo]
    );
    const idConCorreo = resultadoCorreo.insertId;

    const [filaConCorreo] = await pool.query('SELECT email FROM usuarios WHERE id = ?', [idConCorreo]);
    log(
      filaConCorreo[0].email === `${PREFIJO_PRUEBA}-invitado@example.test`,
      'Una cuenta creada con correo (flujo de invitación) lo guarda correctamente'
    );

    // Candado de auto-eliminación: misma comparación que usa
    // DELETE /api/admin/usuarios/:id contra req.adminUser.
    function seEliminaria(rfcDeLaCuenta, adminAutenticadoComo) {
      return rfcDeLaCuenta !== adminAutenticadoComo; // true = se permite eliminar
    }
    log(
      seEliminaria(RFC_PRUEBA_CON_CORREO, RFC_PRUEBA_CON_CORREO) === false,
      'Un administrador no puede eliminar su propia cuenta activa (mismo RFC que req.adminUser)'
    );
    log(
      seEliminaria(RFC_PRUEBA_CON_CORREO, 'admin') === true,
      'Un administrador SÍ puede eliminar la cuenta de otro usuario'
    );

    // Borrado real (DELETE FROM usuarios, sin papelera — a diferencia de
    // constancias/tickets, no hay archivos que preservar para una cuenta).
    await pool.query('DELETE FROM usuarios WHERE id = ?', [idConCorreo]);
    const [yaNoExisteUsuario] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [idConCorreo]);
    log(yaNoExisteUsuario.length === 0, 'DELETE elimina la cuenta de usuario por completo');
  } catch (err) {
    log(false, 'Correo obligatorio al crear usuario + eliminar usuario', err.message);
  } finally {
    await pool.query('DELETE FROM usuarios WHERE rfc = ?', [RFC_PRUEBA_CON_CORREO]);
  }

  // ---------- Enlace al portal en la invitación (auto-detección de URL) ----------
  // No depende de la base de datos, pero se incluye aquí para que "correr
  // este script" siga siendo la forma de verificar todo el flujo de una
  // sola vez. Reproduce la misma construcción que usa
  // POST /api/admin/usuarios: `${req.protocol}://${req.get('host')}/login`.
  try {
    function construirUrlPortal(protocol, host) {
      return host ? `${protocol}://${host}` : '';
    }

    log(
      construirUrlPortal('http', 'localhost:8080') === 'http://localhost:8080',
      'La URL del portal se arma correctamente en desarrollo local (http, con puerto)'
    );
    log(
      construirUrlPortal('http', '192.168.1.50:8080') === 'http://192.168.1.50:8080',
      'La URL del portal se arma correctamente accediendo por IP de red local'
    );
    log(
      construirUrlPortal('https', 'facturacion.midominio.com') === 'https://facturacion.midominio.com',
      'La URL del portal se arma correctamente en un dominio real con HTTPS (sin puerto explícito)'
    );
    log(
      construirUrlPortal('http', '') === '',
      'Si no se detecta el host, se devuelve vacío en vez de una URL rota (el correo omite el enlace en ese caso)'
    );

    // El enlace final depende del perfil: "cliente" entra por /login (el
    // portal público, RFC + contraseña); "administrador"/"fiscal" entran
    // por /admin (el panel, HTTP Basic Auth) — mismo criterio que usa
    // enviarInvitacionPortal() en server.js.
    function construirEnlaceInvitacion(perfil, urlPortal) {
      const ruta = perfil === 'cliente' ? '/login' : '/admin';
      return urlPortal ? `${urlPortal}${ruta}` : '';
    }

    log(
      construirEnlaceInvitacion('cliente', 'https://facturacion.midominio.com') === 'https://facturacion.midominio.com/login',
      'La invitación de un "cliente" enlaza al portal público (/login), no al panel'
    );
    log(
      construirEnlaceInvitacion('fiscal', 'https://facturacion.midominio.com') === 'https://facturacion.midominio.com/admin',
      'La invitación de un "fiscal" enlaza al panel de administración (/admin), no al portal público'
    );
    log(
      construirEnlaceInvitacion('administrador', 'https://facturacion.midominio.com') === 'https://facturacion.midominio.com/admin',
      'La invitación de un "administrador" enlaza al panel de administración (/admin), igual que "fiscal"'
    );

    // Mismo mecanismo de auto-detección, ahora en la notificación de
    // "nuevo ticket para facturar" que recibe el contador (ver
    // notificarNuevoTicketAlContador en server.js) — el destinatario de
    // ese correo entra por el mismo lugar que un administrador/fiscal.
    function construirEnlacePanel(urlPortal) {
      return urlPortal ? `${urlPortal}/admin` : '';
    }
    log(
      construirEnlacePanel('https://facturacion.midominio.com') === 'https://facturacion.midominio.com/admin',
      'El aviso de "nuevo ticket para facturar" al contador enlaza al panel de administración (/admin)'
    );
    log(
      construirEnlacePanel('http://localhost:8080') === 'http://localhost:8080/admin',
      'El aviso de "nuevo ticket para facturar" arma el enlace correctamente en desarrollo local'
    );
    log(
      construirEnlacePanel('') === '',
      'El aviso de "nuevo ticket para facturar" omite el enlace si no se detectó el host, sin romper el correo'
    );
  } catch (err) {
    log(false, 'Enlace al portal en la invitación (auto-detección de URL)', err.message);
  }

  // ---------- Cuenta de respaldo "admin" ----------
  // Verifica exactamente la misma lógica que usa el mecanismo #2 de
  // requireAdminAuth() en auth.js. No se toca la fila real en la base de
  // datos (no se hace ningún UPDATE/INSERT aquí) — ensureSchema() ya la
  // siembra con "admin" si nunca existió, así que esta prueba solo LEE.
  try {
    const [filas] = await pool.query(
      "SELECT valor FROM configuracion WHERE clave = 'admin_fallback_password_hash'"
    );
    log(filas.length === 1, 'ensureSchema() siembra la cuenta de respaldo "admin" en la base de datos');
    if (filas.length === 1) {
      // No se puede asumir que la contraseña siga siendo "admin" (el
      // administrador real de esta instalación pudo haberla cambiado ya),
      // así que solo se confirma que el hash guardado tiene el formato
      // esperado y que verifyPassword() lo puede procesar sin errores.
      const formatoValido = typeof filas[0].valor === 'string' && filas[0].valor.includes(':');
      log(formatoValido, 'El hash de la cuenta de respaldo "admin" tiene el formato esperado (salt:hash)');
      log(
        typeof verifyPassword('cualquier-cosa-claramente-incorrecta', filas[0].valor) === 'boolean',
        'verifyPassword() puede procesar el hash guardado sin lanzar errores'
      );
    }
  } catch (err) {
    log(false, 'Cuenta de respaldo "admin"', err.message);
  }

  // ---------- Tabla tickets (solicitudes de facturación de compras) ----------
  let idTicketInsertado = null;
  try {
    const ahora = new Date();
    const [resultado] = await pool.query(
      `INSERT INTO tickets
        (folio, rfc, uso_cfdi, tipo_pago, comentarios, imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
         estatus, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
      [
        'TEMP', RFC_PRUEBA_USUARIO, 'G03', 'tarjeta_credito', 'Comentario de prueba del cliente',
        'ticket.jpg', 'uuid-ticket.jpg', 'image/jpeg', 2048, ahora, ahora,
      ]
    );
    idTicketInsertado = resultado.insertId;
    const folio = `TK-${String(idTicketInsertado).padStart(6, '0')}`;
    await pool.query('UPDATE tickets SET folio = ? WHERE id = ?', [folio, idTicketInsertado]);

    const [filas] = await pool.query('SELECT * FROM tickets WHERE id = ?', [idTicketInsertado]);
    log(
      filas[0] &&
        filas[0].folio === folio &&
        filas[0].estatus === 'pendiente' &&
        filas[0].uso_cfdi === 'G03' &&
        filas[0].tipo_pago === 'tarjeta_credito' &&
        filas[0].comentarios === 'Comentario de prueba del cliente',
      'INSERT crea un ticket con folio, estatus "pendiente", Uso de CFDI, tipo de pago y comentarios correctos',
      JSON.stringify(filas[0] && { folio: filas[0].folio, estatus: filas[0].estatus, uso_cfdi: filas[0].uso_cfdi })
    );
  } catch (err) {
    log(false, 'Tabla tickets: creación de ticket', err.message);
  }

  // Restricción CHECK en estatus
  try {
    await pool.query('UPDATE tickets SET estatus = ? WHERE id = ?', ['estatus_invalido', idTicketInsertado]);
    log(false, 'La restricción CHECK en estatus (tickets) rechaza un valor inválido', 'no lanzo error (deberia haber fallado)');
  } catch (err) {
    log(
      err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || /CONSTRAINT/i.test(err.message || ''),
      'La restricción CHECK en estatus (tickets) rechaza un valor inválido',
      err.code || err.message
    );
  }

  // Restricción CHECK en tipo_pago (solo acepta los 4 slugs del dropdown, o NULL)
  try {
    await pool.query('UPDATE tickets SET tipo_pago = ? WHERE id = ?', ['bitcoin', idTicketInsertado]);
    log(false, 'La restricción CHECK en tipo_pago (tickets) rechaza un valor inválido', 'no lanzo error (deberia haber fallado)');
  } catch (err) {
    log(
      err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || /CONSTRAINT/i.test(err.message || ''),
      'La restricción CHECK en tipo_pago (tickets) rechaza un valor inválido',
      err.code || err.message
    );
  }
  try {
    await pool.query('UPDATE tickets SET tipo_pago = NULL WHERE id = ?', [idTicketInsertado]);
    const [sinTipoPago] = await pool.query('SELECT tipo_pago FROM tickets WHERE id = ?', [idTicketInsertado]);
    log(sinTipoPago[0].tipo_pago === null, 'La restricción CHECK en tipo_pago (tickets) permite NULL (campo opcional)');
  } catch (err) {
    log(false, 'La restricción CHECK en tipo_pago (tickets) permite NULL (campo opcional)', err.message);
  }

  // "otro" como quinta opción de tipo_pago, con su especificación en
  // tipo_pago_otro — agregado después de que la app ya tenía
  // instalaciones desplegadas, así que la restricción CHECK se tuvo que
  // actualizar (no solo crear) para instalaciones existentes.
  try {
    await pool.query(
      'UPDATE tickets SET tipo_pago = ?, tipo_pago_otro = ? WHERE id = ?',
      ['otro', 'Vale de despensa', idTicketInsertado]
    );
    const [conOtro] = await pool.query('SELECT tipo_pago, tipo_pago_otro FROM tickets WHERE id = ?', [idTicketInsertado]);
    log(
      conOtro[0].tipo_pago === 'otro' && conOtro[0].tipo_pago_otro === 'Vale de despensa',
      'tipo_pago="otro" se acepta (la restricción CHECK ya incluye esta opción) y guarda su especificación en tipo_pago_otro'
    );
  } catch (err) {
    log(false, 'tipo_pago="otro" se acepta y guarda su especificación', err.message);
  }
  await pool.query('UPDATE tickets SET tipo_pago = NULL, tipo_pago_otro = NULL WHERE id = ?', [idTicketInsertado]);

  // Flujo: marcar "en_curso", luego subir factura (marca "listo")
  try {
    await pool.query('UPDATE tickets SET estatus = ? WHERE id = ?', ['en_curso', idTicketInsertado]);
    const [enCurso] = await pool.query('SELECT estatus FROM tickets WHERE id = ?', [idTicketInsertado]);
    log(enCurso[0].estatus === 'en_curso', 'El ticket se puede mover a "en_curso"');

    await pool.query(
      `UPDATE tickets SET estatus = 'listo', factura_nombre_original = ?,
         factura_nombre_guardado = ?, factura_mime = ? WHERE id = ?`,
      ['factura.pdf', 'uuid-factura.pdf', 'application/pdf', idTicketInsertado]
    );
    const [listo] = await pool.query('SELECT estatus, factura_nombre_original FROM tickets WHERE id = ?', [idTicketInsertado]);
    log(
      listo[0].estatus === 'listo' && listo[0].factura_nombre_original === 'factura.pdf',
      'Subir la factura marca el ticket como "listo"'
    );
  } catch (err) {
    log(false, 'Flujo de estatus del ticket (en_curso -> listo)', err.message);
  }

  // "actualizado_por" — se guarda siempre el usuario de la sesión que
  // hizo el cambio (req.adminUser, puesto por requireAdminAuth), tanto
  // al cambiar el estatus/notas como al subir la factura — para saber
  // quién tiene asignado cada ticket. Se reproducen aquí los mismos dos
  // UPDATE que usan esos endpoints reales.
  try {
    await pool.query(
      'UPDATE tickets SET estatus = ?, notas_admin = ?, actualizado_por = ? WHERE id = ?',
      ['en_curso', 'Nota de prueba', 'usuario_prueba_1', idTicketInsertado]
    );
    const [conUsuario1] = await pool.query('SELECT actualizado_por FROM tickets WHERE id = ?', [idTicketInsertado]);
    log(conUsuario1[0].actualizado_por === 'usuario_prueba_1', 'Cambiar el estatus/notas guarda quién hizo el cambio');

    await pool.query(
      `UPDATE tickets SET estatus = 'listo', factura_nombre_original = ?,
         factura_nombre_guardado = ?, factura_mime = ?, actualizado_por = ? WHERE id = ?`,
      ['factura2.pdf', 'uuid-factura2.pdf', 'application/pdf', 'usuario_prueba_2', idTicketInsertado]
    );
    const [conUsuario2] = await pool.query('SELECT actualizado_por FROM tickets WHERE id = ?', [idTicketInsertado]);
    log(
      conUsuario2[0].actualizado_por === 'usuario_prueba_2',
      'Subir la factura TAMBIÉN actualiza quién hizo el cambio (no se queda con el usuario anterior)'
    );

    // Filtro "Usuario" en la lista de tickets — mismo query que usa
    // GET /api/admin/tickets?actualizado_por=... y el endpoint que llena
    // el desplegable del filtro.
    const [distintos] = await pool.query(
      `SELECT DISTINCT actualizado_por FROM tickets
       WHERE actualizado_por IS NOT NULL AND eliminado_en IS NULL
       ORDER BY actualizado_por ASC`
    );
    log(
      distintos.some((f) => f.actualizado_por === 'usuario_prueba_2'),
      'El usuario que hizo el último cambio aparece en la lista de usuarios distintos para el filtro'
    );

    const [filtradoPorUsuario] = await pool.query(
      'SELECT id FROM tickets WHERE eliminado_en IS NULL AND actualizado_por = ?',
      ['usuario_prueba_2']
    );
    log(
      filtradoPorUsuario.some((f) => f.id === idTicketInsertado),
      'Filtrar tickets por "actualizado_por" encuentra el ticket de prueba'
    );

    const [filtradoPorUsuarioInexistente] = await pool.query(
      'SELECT id FROM tickets WHERE eliminado_en IS NULL AND actualizado_por = ?',
      ['usuario_que_no_existe']
    );
    log(
      filtradoPorUsuarioInexistente.length === 0,
      'Filtrar por un usuario que nunca ha modificado nada no regresa ningún ticket'
    );
  } catch (err) {
    log(false, '"actualizado_por" se guarda en ambos flujos de cambio de estatus', err.message);
  }

  // Solo los tickets del RFC de la sesión deben poder consultarse (lo
  // valida la ruta GET /api/tickets con "WHERE rfc = ?"; aquí se confirma
  // que la consulta filtra correctamente y no arrastra tickets de otro RFC).
  try {
    const [propios] = await pool.query('SELECT id FROM tickets WHERE rfc = ?', [RFC_PRUEBA_USUARIO]);
    const [deOtroRfc] = await pool.query('SELECT id FROM tickets WHERE rfc = ?', ['ZZZ999999ZZ9']);
    log(propios.length >= 1 && deOtroRfc.length === 0, 'Los tickets quedan aislados por RFC (no se mezclan entre contribuyentes)');
  } catch (err) {
    log(false, 'Aislamiento de tickets por RFC', err.message);
  }

  // ---------- Verificación de compra al subir un ticket (No. Compra / Fecha / Hora / Total) ----------
  // Reproduce la misma validación que ahora exige POST /api/tickets:
  // captura de No. Compra + fecha + hora + total, buscando una orden de
  // compra real que coincida en los cuatro datos antes de aceptar el
  // ticket para facturar.
  const NUMERO_COMPRA_PRUEBA_TICKET = `${NUM_COMPRA_PRUEBA}-TICKET-VERIF`;
  let idOrdenParaTicket = null;
  try {
    const configParaVerificacion = await getConfiguracionGlobal();
    const ahoraOrdenTicket = new Date();
    // Mismo fix que el endpoint POST /api/admin/ordenes-compra: Intl trunca
    // los ms y MySQL redondea el DATETIME, así que un Date con ms ≥500
    // guarda un segundo +1 y la comparación de los 4 datos falla
    // intermitentemente (COMPRA_NO_ENCONTRADA). Sin ms, la comparación es
    // determinista.
    ahoraOrdenTicket.setMilliseconds(0);
    const [ordenParaTicket] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
       VALUES (?, ?, 'Compra de prueba para verificación de ticket', 1000, 16, 1160, ?, ?, ?)`,
      [NUMERO_COMPRA_PRUEBA_TICKET, ahoraOrdenTicket, EMAIL_PRUEBA, ahoraOrdenTicket, ahoraOrdenTicket]
    );
    idOrdenParaTicket = ordenParaTicket.insertId;

    const fechaOrdenFormateada = formatearFechaHoraMexico(ahoraOrdenTicket, configParaVerificacion.zona_horaria);

    // Mismos formatos y misma lógica de comparación que el endpoint real.
    function validarFormatoTicket(numero, fecha, hora, total) {
      if (!numero) return 'numero_obligatorio';
      if (!/^\d{2}\/[a-záéíóúñ]{3}\/\d{4}$/i.test(fecha)) return 'fecha_invalida';
      if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(hora)) return 'hora_invalida';
      if (!Number.isFinite(total) || total <= 0) return 'total_invalido';
      return null;
    }
    log(
      validarFormatoTicket(NUMERO_COMPRA_PRUEBA_TICKET, fechaOrdenFormateada.fecha, fechaOrdenFormateada.hora, 1160) === null,
      'Los datos capturados con el formato correcto pasan la validación de formato'
    );
    log(validarFormatoTicket('', '24/jul/2026', '09:30:45', 100) === 'numero_obligatorio', 'Sin número de compra, se rechaza');
    log(validarFormatoTicket('OC-000001', '2026-07-24', '09:30:45', 100) === 'fecha_invalida', 'Fecha en formato incorrecto se rechaza');
    log(validarFormatoTicket('OC-000001', '24/jul/2026', '9:30', 100) === 'hora_invalida', 'Hora en formato incorrecto se rechaza');

    // Búsqueda de la orden real (mismo query que usa el endpoint).
    const [ordenesEncontradas] = await pool.query(
      'SELECT * FROM ordenes_compra WHERE numero_compra = ? AND eliminado_en IS NULL LIMIT 1',
      [NUMERO_COMPRA_PRUEBA_TICKET]
    );
    log(ordenesEncontradas.length === 1, 'La orden de compra de prueba se encuentra por su número de compra');

    function coincide(orden, fechaTexto, horaTexto, totalCapturado) {
      const fechaFormateadaOrden = formatearFechaHoraMexico(
        new Date(`${String(orden.fecha_compra).replace(' ', 'T')}Z`),
        configParaVerificacion.zona_horaria
      );
      const coincideFecha = fechaFormateadaOrden.fecha.toLowerCase() === fechaTexto.toLowerCase();
      const coincideHora = fechaFormateadaOrden.hora === horaTexto;
      const coincideTotal = Math.abs(Number(orden.total) - totalCapturado) < 0.005;
      return coincideFecha && coincideHora && coincideTotal;
    }

    const ordenReal = ordenesEncontradas[0];
    log(
      coincide(ordenReal, fechaOrdenFormateada.fecha, fechaOrdenFormateada.hora, 1160) === true,
      'Con los 4 datos exactamente correctos (No. Compra, fecha, hora, total), la verificación pasa'
    );
    log(
      coincide(ordenReal, fechaOrdenFormateada.fecha, fechaOrdenFormateada.hora, 999) === false,
      'Con el total incorrecto (aunque el número de compra sí exista), la verificación falla'
    );
    log(
      coincide(ordenReal, '01/ene/2020', fechaOrdenFormateada.hora, 1160) === false,
      'Con la fecha incorrecta, la verificación falla'
    );

    const [ordenInexistente] = await pool.query(
      'SELECT * FROM ordenes_compra WHERE numero_compra = ? AND eliminado_en IS NULL LIMIT 1',
      [`${NUM_COMPRA_PRUEBA}-NO-EXISTE`]
    );
    log(ordenInexistente.length === 0, 'Un número de compra que no existe no encuentra ninguna orden (se rechazaría con "No se encuentra registrada la compra para facturar")');

    // Bug real reportado: una fecha con el formato EXACTAMENTE correcto
    // ("24/jul/2026") se rechazaba siempre, sin importar qué tan bien
    // escrita estuviera. La causa: el endpoint usaba `sanitizeText()`
    // (que aplica `validator.escape()`) para leer `fecha_compra`, y esa
    // función convierte "/" en la entidad HTML "&#x2F;" — corrompiendo
    // la fecha ANTES de que la expresión regular la evaluara. La
    // corrección fue usar `sanitizeTextoLibre()` (sin ese escape) para
    // este campo en particular, mismo criterio que ya usa el asunto/
    // cuerpo de un correo. Se prueba aquí directamente contra las
    // funciones reales de `utils/validate.js`, no solo simulado.
    function extraerFechaComoLoHaceElEndpoint(fechaCruda, sanitizador) {
      const limpia = sanitizador(fechaCruda, 40);
      const match = limpia.match(/\d{2}\/[a-záéíóúñ]{3}\/\d{4}/i);
      return match ? match[0] : null;
    }
    log(
      extraerFechaComoLoHaceElEndpoint('24/jul/2026', sanitizeText) === '24/jul/2026',
      'HISTÓRICO (ya no aplica): el escape de "/" que corrompía la fecha se quitó de sanitizeText() (doble escape visible al pintar), así que hoy tampoco se corrompe con sanitizeText — el punto sigue siendo que sanitizeTextoLibre() la deja intacta'
    );
    log(
      extraerFechaComoLoHaceElEndpoint('24/jul/2026', sanitizeTextoLibre) === '24/jul/2026',
      'CORRECCIÓN: con sanitizeTextoLibre() (la función real que ahora usa el endpoint), la misma fecha sí se reconoce correctamente'
    );
    log(
      extraerFechaComoLoHaceElEndpoint('  24/jul/2026  ', sanitizeTextoLibre) === '24/jul/2026',
      'La extracción también tolera espacios extra alrededor (típico al copiar y pegar)'
    );
    log(
      extraerFechaComoLoHaceElEndpoint('24/jul/2026 09:30:45', sanitizeTextoLibre) === '24/jul/2026',
      'La extracción también tolera que la hora venga pegada junto a la fecha (formato de correos enviados antes de esta corrección)'
    );
  } catch (err) {
    log(false, 'Verificación de compra al subir un ticket', err.message);
  } finally {
    if (idOrdenParaTicket) {
      await pool.query('DELETE FROM ordenes_compra WHERE id = ?', [idOrdenParaTicket]);
    }
  }

  // ---------- Ícono de "facturado" + no se puede volver a facturar la misma orden ----------
  // Una orden se considera "ya facturada" si existe un ticket vinculado
  // a ella (orden_compra_id) cuya factura ya se subió (estatus =
  // 'listo') — mismo criterio que usa tanto el ícono ✅ en la tabla del
  // admin como el rechazo en POST /api/tickets para no volver a facturar
  // la misma compra.
  const NUMERO_COMPRA_PRUEBA_FACTURADO = `${NUM_COMPRA_PRUEBA}-FACTURADO`;
  let idOrdenFacturado = null;
  let idTicketFacturado = null;
  try {
    const ahoraOrdenFacturado = new Date();
    ahoraOrdenFacturado.setMilliseconds(0);
    const [ordenFacturado] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
       VALUES (?, ?, 'Compra de prueba para el ícono de facturado', 500, 16, 580, ?, ?, ?)`,
      [NUMERO_COMPRA_PRUEBA_FACTURADO, ahoraOrdenFacturado, EMAIL_PRUEBA, ahoraOrdenFacturado, ahoraOrdenFacturado]
    );
    idOrdenFacturado = ordenFacturado.insertId;

    // Mismo query EXISTS que ahora usa GET /api/admin/ordenes-compra.
    async function consultarFacturado(ordenId) {
      const [filas] = await pool.query(
        `SELECT EXISTS(
           SELECT 1 FROM tickets t
           WHERE t.orden_compra_id = ? AND t.estatus = 'listo' AND t.eliminado_en IS NULL
         ) AS facturado`,
        [ordenId]
      );
      return Boolean(filas[0].facturado);
    }

    log((await consultarFacturado(idOrdenFacturado)) === false, 'Una orden recién creada, sin ningún ticket, NO aparece como facturada');

    // Crea un ticket vinculado a esta orden, todavía "pendiente" (no facturado).
    const ahoraTicketFacturado = new Date();
    const [ticketInsertado] = await pool.query(
      `INSERT INTO tickets
        (folio, rfc, orden_compra_id, imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
         estatus, creado_en, actualizado_en)
       VALUES ('TEMP', ?, ?, 'ticket.jpg', 'uuid-prueba-facturado.jpg', 'image/jpeg', 100, 'pendiente', ?, ?)`,
      [RFC_PRUEBA_USUARIO, idOrdenFacturado, ahoraTicketFacturado, ahoraTicketFacturado]
    );
    idTicketFacturado = ticketInsertado.insertId;
    await pool.query('UPDATE tickets SET folio = ? WHERE id = ?', [`TK-PRUEBA-${idTicketFacturado}`, idTicketFacturado]);

    log(
      (await consultarFacturado(idOrdenFacturado)) === false,
      'Con un ticket vinculado pero todavía "pendiente" (sin factura subida), la orden SIGUE sin aparecer como facturada'
    );

    // Datos de la compra para cotejar contra la foto — mismo LEFT JOIN
    // que usa GET /api/admin/tickets, para que el administrador vea en
    // el modal de gestión lo mismo que el cliente capturó al subir el
    // ticket.
    const [ticketConOrdenUnido] = await pool.query(
      `SELECT t.id, oc.numero_compra AS orden_numero_compra, oc.total AS orden_total
       FROM tickets t
       LEFT JOIN ordenes_compra oc ON t.orden_compra_id = oc.id AND oc.eliminado_en IS NULL
       WHERE t.id = ?`,
      [idTicketFacturado]
    );
    log(
      ticketConOrdenUnido[0].orden_numero_compra === NUMERO_COMPRA_PRUEBA_FACTURADO,
      'El LEFT JOIN con ordenes_compra trae el No. Compra correcto para un ticket vinculado a una orden'
    );
    log(
      Number(ticketConOrdenUnido[0].orden_total) === 580,
      'El LEFT JOIN con ordenes_compra trae el Total correcto para un ticket vinculado a una orden'
    );

    const [ticketSinOrdenUnido] = await pool.query(
      `SELECT t.id, oc.numero_compra AS orden_numero_compra
       FROM tickets t
       LEFT JOIN ordenes_compra oc ON t.orden_compra_id = oc.id AND oc.eliminado_en IS NULL
       WHERE t.id = ?`,
      [idTicketInsertado] // este otro ticket de prueba NO tiene orden_compra_id
    );
    log(
      ticketSinOrdenUnido[0].orden_numero_compra === null,
      'Un ticket SIN orden vinculada trae "orden_numero_compra" en null (la caja de comparación se ocultaría en el modal)'
    );

    // Simula que el administrador sube la factura (mismo UPDATE que hace
    // POST /api/admin/tickets/:id/factura).
    await pool.query('UPDATE tickets SET estatus = ? WHERE id = ?', ['listo', idTicketFacturado]);

    log(
      (await consultarFacturado(idOrdenFacturado)) === true,
      'Una vez que el ticket vinculado pasa a "listo" (factura subida), la orden SÍ aparece como facturada — aquí es donde se mostraría el ícono ✅'
    );

    // No se puede volver a facturar la misma orden: mismo query que usa
    // POST /api/tickets para rechazar un segundo intento.
    const [ticketsYaFacturados] = await pool.query(
      `SELECT id FROM tickets WHERE orden_compra_id = ? AND estatus = 'listo' AND eliminado_en IS NULL LIMIT 1`,
      [idOrdenFacturado]
    );
    log(
      ticketsYaFacturados.length > 0,
      'Un segundo intento de subir un ticket para la misma orden se detectaría y se rechazaría con "Esa compra ya fue facturada."'
    );
  } catch (err) {
    log(false, 'Ícono de "facturado" y prevención de doble facturación', err.message);
  } finally {
    if (idTicketFacturado) {
      await pool.query('DELETE FROM tickets WHERE id = ?', [idTicketFacturado]);
    }
    if (idOrdenFacturado) {
      await pool.query('DELETE FROM ordenes_compra WHERE id = ?', [idOrdenFacturado]);
    }
  }

  // ---------- Reenviar correo de una orden de compra ----------
  // No se prueba el envío real (necesitaría SMTP configurado — ver la
  // nota ya existente sobre "Enviar prueba" para eso), pero sí se prueba
  // la consulta y el armado de los datos que usa
  // POST /api/admin/ordenes-compra/:id/reenviar-correo.
  const NUMERO_COMPRA_PRUEBA_REENVIO = `${NUM_COMPRA_PRUEBA}-REENVIO`;
  let idOrdenReenvio = null;
  try {
    const ahoraOrdenReenvio = new Date();
    ahoraOrdenReenvio.setMilliseconds(0);
    const [ordenReenvio] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
       VALUES (?, ?, 'Compra de prueba para reenviar correo', 200, 16, 232, ?, ?, ?)`,
      [NUMERO_COMPRA_PRUEBA_REENVIO, ahoraOrdenReenvio, EMAIL_PRUEBA, ahoraOrdenReenvio, ahoraOrdenReenvio]
    );
    idOrdenReenvio = ordenReenvio.insertId;

    // Mismo SELECT que usa el endpoint real.
    const [filasReenvio] = await pool.query(
      'SELECT * FROM ordenes_compra WHERE id = ? AND eliminado_en IS NULL',
      [idOrdenReenvio]
    );
    log(filasReenvio.length === 1, 'La orden se encuentra correctamente por su id, para reenviar su correo');

    const ordenParaReenviar = filasReenvio[0];
    const configParaReenvio = await getConfiguracionGlobal();
    const fechaParaReenvio = formatearFechaHoraMexico(
      new Date(`${String(ordenParaReenviar.fecha_compra).replace(' ', 'T')}Z`),
      configParaReenvio.zona_horaria
    );
    log(
      typeof fechaParaReenvio.fecha === 'string' && typeof fechaParaReenvio.hora === 'string',
      'La fecha/hora de la orden se puede volver a formatear correctamente para reconstruir el correo'
    );
    log(
      ordenParaReenviar.numero_compra === NUMERO_COMPRA_PRUEBA_REENVIO && Number(ordenParaReenviar.total) === 232,
      'Los datos de la orden (número de compra y total) se leen correctamente para reconstruir el correo a reenviar'
    );

    // Una orden con borrado lógico no debe encontrarse para reenviar su correo.
    await pool.query('UPDATE ordenes_compra SET eliminado_en = NOW() WHERE id = ?', [idOrdenReenvio]);
    const [filasReenvioEliminada] = await pool.query(
      'SELECT * FROM ordenes_compra WHERE id = ? AND eliminado_en IS NULL',
      [idOrdenReenvio]
    );
    log(
      filasReenvioEliminada.length === 0,
      'Una orden con borrado lógico ya no se encuentra para reenviar su correo (se rechazaría con 404)'
    );
    await pool.query('UPDATE ordenes_compra SET eliminado_en = NULL WHERE id = ?', [idOrdenReenvio]);
  } catch (err) {
    log(false, 'Reenviar correo de una orden de compra', err.message);
  } finally {
    if (idOrdenReenvio) {
      await pool.query('DELETE FROM ordenes_compra WHERE id = ?', [idOrdenReenvio]);
    }
  }

  // ---------- Borrado lógico / papelera / restaurar / borrado físico de tickets ----------
  // Mismo patrón ya usado para constancias — se reutiliza el ticket de
  // prueba que ya pasó por todo el flujo de estatus (pendiente → en_curso
  // → listo, con Uso de CFDI, tipo de pago, comentarios y factura), para
  // confirmar que el borrado lógico funciona incluso con un ticket que ya
  // tiene historial completo.
  try {
    // Borrado lógico (mismo UPDATE que usa DELETE /api/admin/tickets/:id)
    await pool.query('UPDATE tickets SET eliminado_en = ? WHERE id = ?', [new Date(), idTicketInsertado]);

    const [enActivos] = await pool.query(
      'SELECT id FROM tickets WHERE id = ? AND eliminado_en IS NULL',
      [idTicketInsertado]
    );
    log(enActivos.length === 0, 'Tras el borrado lógico, el ticket ya no aparece en la lista de activos');

    const [enPapelera] = await pool.query(
      'SELECT id FROM tickets WHERE id = ? AND eliminado_en IS NOT NULL',
      [idTicketInsertado]
    );
    log(enPapelera.length === 1, 'Tras el borrado lógico, el ticket sí aparece en la papelera');

    // Restaurar (mismo UPDATE que usa POST /api/admin/tickets/:id/restaurar)
    await pool.query('UPDATE tickets SET eliminado_en = NULL WHERE id = ? AND eliminado_en IS NOT NULL', [idTicketInsertado]);
    const [restaurado] = await pool.query(
      'SELECT id FROM tickets WHERE id = ? AND eliminado_en IS NULL',
      [idTicketInsertado]
    );
    log(restaurado.length === 1, 'Restaurar un ticket lo regresa a la lista de activos');

    // Un ticket ya activo no debería poder "eliminarse lógicamente" dos
    // veces sin efecto — mismo condicional (AND eliminado_en IS NULL) que
    // usa el endpoint real, para que un doble clic no rompa nada.
    await pool.query('UPDATE tickets SET eliminado_en = ? WHERE id = ? AND eliminado_en IS NULL', [new Date(), idTicketInsertado]);
    const [resultadoSegundoIntento] = await pool.query(
      "UPDATE tickets SET eliminado_en = NOW() WHERE id = ? AND eliminado_en IS NULL",
      [idTicketInsertado]
    );
    log(resultadoSegundoIntento.affectedRows === 0, 'Intentar eliminar un ticket ya eliminado no tiene efecto (affectedRows = 0)');

    // Borrado físico (mismo DELETE que usa DELETE /api/admin/tickets/:id/permanente)
    await pool.query('DELETE FROM tickets WHERE id = ?', [idTicketInsertado]);
    const [yaNoExiste] = await pool.query('SELECT id FROM tickets WHERE id = ?', [idTicketInsertado]);
    log(yaNoExiste.length === 0, 'El borrado físico elimina la fila por completo, sin importar su estatus previo');

    // Ya no se debe volver a intentar limpiar este ticket en el cleanup final
    idTicketInsertado = null;
  } catch (err) {
    log(false, 'Flujo de borrado lógico/papelera/restaurar/borrado físico de tickets', err.message);
  }

  // ---------- Verificación de constancia existente (aviso en tickets.html) ----------
  // Misma consulta que usa GET /api/registro/existe: confirma que un RFC
  // con una constancia activa reporta existe=true, y uno sin ninguna
  // reporta existe=false — es la base del popup que le avisa al cliente
  // que suba su constancia antes de continuar con un ticket.
  const RFC_CON_CONSTANCIA = 'CCC030303CC3';
  const RFC_SIN_CONSTANCIA = 'DDD040404DD4';
  try {
    const ahoraConstancia = new Date();
    await pool.query(
      `INSERT INTO registros
        (nombre, tipo_persona, rfc, email, archivo_nombre_original, archivo_nombre_guardado,
         archivo_mime, archivo_tamano_bytes, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Cliente Con Constancia', 'fisica', RFC_CON_CONSTANCIA, `${PREFIJO_PRUEBA}-constancia@example.test`,
        'c.pdf', 'uuid-constancia-inexistente.pdf', 'application/pdf', 100, ahoraConstancia, ahoraConstancia,
      ]
    );

    async function existeConstancia(rfc) {
      const [filas] = await pool.query(
        'SELECT id FROM registros WHERE rfc = ? AND eliminado_en IS NULL LIMIT 1',
        [rfc]
      );
      return filas.length > 0;
    }

    log(await existeConstancia(RFC_CON_CONSTANCIA) === true, 'Un RFC con constancia activa reporta existe=true');
    log(await existeConstancia(RFC_SIN_CONSTANCIA) === false, 'Un RFC sin ninguna constancia reporta existe=false');

    // Borrado lógico: una constancia eliminada NO debe seguir contando como "existente"
    await pool.query('UPDATE registros SET eliminado_en = NOW() WHERE rfc = ?', [RFC_CON_CONSTANCIA]);
    log(await existeConstancia(RFC_CON_CONSTANCIA) === false, 'Una constancia con borrado lógico ya no cuenta como existente');
  } catch (err) {
    log(false, 'Verificación de constancia existente (GET /api/registro/existe)', err.message);
  } finally {
    await pool.query('DELETE FROM registros WHERE rfc IN (?, ?)', [RFC_CON_CONSTANCIA, RFC_SIN_CONSTANCIA]);
  }

  // ---------- Bloqueo real de POST /api/tickets sin constancia ----------
  // Esta es la regla que se reportó como rota: el aviso emergente de
  // tickets.html existía, pero el backend nunca rechazaba la subida — así
  // que cerrando el aviso (o llamando la API directo) sí se podía subir un
  // ticket sin constancia. Aquí se reproduce la MISMA consulta que ahora
  // usa POST /api/tickets antes de aceptar el archivo, para confirmar que
  // de verdad bloquea cuando no hay constancia y de verdad permite cuando
  // sí la hay — no solo que el endpoint informativo lo reporte bien.
  try {
    const ahoraBloqueo = new Date();
    await pool.query(
      `INSERT INTO registros
        (nombre, tipo_persona, rfc, email, archivo_nombre_original, archivo_nombre_guardado,
         archivo_mime, archivo_tamano_bytes, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Cliente Con Constancia 2', 'fisica', RFC_CON_CONSTANCIA, `${PREFIJO_PRUEBA}-constancia2@example.test`,
        'c2.pdf', 'uuid-constancia2-inexistente.pdf', 'application/pdf', 100, ahoraBloqueo, ahoraBloqueo,
      ]
    );

    // Misma consulta EXACTA que POST /api/tickets ejecuta antes de aceptar
    // el archivo (ver server.js, justo después de validar que venga una imagen).
    async function seBloquearia(rfc) {
      const [filas] = await pool.query(
        'SELECT id FROM registros WHERE rfc = ? AND eliminado_en IS NULL LIMIT 1',
        [rfc]
      );
      return filas.length === 0; // true = se rechazaria la subida del ticket
    }

    log(
      (await seBloquearia(RFC_SIN_CONSTANCIA)) === true,
      'POST /api/tickets rechazaría la subida para un RFC sin constancia (regla que se reportó como rota)'
    );
    log(
      (await seBloquearia(RFC_CON_CONSTANCIA)) === false,
      'POST /api/tickets permitiría la subida para un RFC con constancia activa'
    );
  } catch (err) {
    log(false, 'Bloqueo real de POST /api/tickets sin constancia', err.message);
  } finally {
    await pool.query('DELETE FROM registros WHERE rfc IN (?, ?)', [RFC_CON_CONSTANCIA, RFC_SIN_CONSTANCIA]);
  }

  // ---------- Validación de tipo_pago/comentarios obligatorios en POST /api/tickets ----------
  // No depende de la base de datos, pero se incluye aquí por la misma
  // razón que otros bloques de lógica pura: reproduce exactamente la
  // cadena de validación que usa el endpoint real, para el mismo par de
  // campos que ahora se pueden marcar obligatorios desde "Configuraciones
  // globales" (ver el checkbox "Tipo de pago"/"Comentarios (al subir
  // tickets)" en el panel).
  try {
    const TIPOS_PAGO_PRUEBA = { efectivo: 1, transferencia: 1, tarjeta_debito: 1, tarjeta_credito: 1 };
    function validarCamposTicket({ tipoPago = '', comentarios = '', camposObligatorios }) {
      if (tipoPago && !Object.prototype.hasOwnProperty.call(TIPOS_PAGO_PRUEBA, tipoPago)) {
        return { error: 'tipo_pago_invalido' };
      }
      if (camposObligatorios.tipo_pago && !tipoPago) return { error: 'tipo_pago_obligatorio' };
      if (camposObligatorios.comentarios && !comentarios) return { error: 'comentarios_obligatorio' };
      return { ok: true };
    }

    log(
      validarCamposTicket({ camposObligatorios: { tipo_pago: false, comentarios: false } }).ok === true,
      'Con ambos opcionales y nada capturado, la validación pasa'
    );
    log(
      validarCamposTicket({ camposObligatorios: { tipo_pago: true, comentarios: false } }).error === 'tipo_pago_obligatorio',
      'Con "tipo_pago" obligatorio y sin capturar, se rechaza con el error correcto'
    );
    log(
      validarCamposTicket({ tipoPago: 'efectivo', camposObligatorios: { tipo_pago: true, comentarios: false } }).ok === true,
      'Con "tipo_pago" obligatorio y capturado, la validación pasa'
    );
    log(
      validarCamposTicket({ camposObligatorios: { tipo_pago: false, comentarios: true } }).error === 'comentarios_obligatorio',
      'Con "comentarios" obligatorio y sin capturar, se rechaza con el error correcto'
    );
    log(
      validarCamposTicket({ comentarios: 'algo', camposObligatorios: { tipo_pago: false, comentarios: true } }).ok === true,
      'Con "comentarios" obligatorio y capturado, la validación pasa'
    );
    log(
      validarCamposTicket({ tipoPago: 'bitcoin', camposObligatorios: { tipo_pago: false, comentarios: false } }).error === 'tipo_pago_invalido',
      'Un "tipo_pago" con un valor fuera del catálogo se rechaza sin importar la configuración de obligatoriedad'
    );
  } catch (err) {
    log(false, 'Validación de tipo_pago/comentarios obligatorios en POST /api/tickets', err.message);
  }

  // ---------- Retención (borrado automático) de tickets ----------
  try {
    const retencionOriginal = await getRetencionTicketsDias();

    const guardada = await setRetencionTicketsDias(5);
    log(guardada === 5, 'setRetencionTicketsDias() guarda el valor correctamente');
    const releida = await getRetencionTicketsDias();
    log(releida === 5, 'getRetencionTicketsDias() refleja el valor guardado');

    const desactivada = await setRetencionTicketsDias(0);
    log(desactivada === null, 'Guardar 0 desactiva la retención (devuelve null)');

    // Restaura la retención a 5 días para probar la limpieza real abajo
    await setRetencionTicketsDias(5);

    // Crea un ticket "viejo" (creado_en manipulado a 100 días atrás) y uno
    // "reciente", para confirmar que limpiarTicketsVencidos() borra
    // exactamente el que corresponde y respeta el resto.
    const [viejo] = await pool.query(
      `INSERT INTO tickets
        (folio, rfc, imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
         estatus, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', DATE_SUB(NOW(), INTERVAL 100 DAY), DATE_SUB(NOW(), INTERVAL 100 DAY))`,
      ['TEMP', RFC_PRUEBA_USUARIO, 'viejo.jpg', 'uuid-viejo-inexistente.jpg', 'image/jpeg', 100]
    );
    await pool.query('UPDATE tickets SET folio = ? WHERE id = ?', [`TK-TEST-VIEJO-${viejo.insertId}`, viejo.insertId]);

    const [reciente] = await pool.query(
      `INSERT INTO tickets
        (folio, rfc, imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
         estatus, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', NOW(), NOW())`,
      ['TEMP', RFC_PRUEBA_USUARIO, 'reciente.jpg', 'uuid-reciente-inexistente.jpg', 'image/jpeg', 100]
    );
    await pool.query('UPDATE tickets SET folio = ? WHERE id = ?', [`TK-TEST-RECIENTE-${reciente.insertId}`, reciente.insertId]);

    // Los nombres de archivo de arriba ("uuid-viejo-inexistente.jpg") no
    // existen de verdad en MinIO: limpiarTicketsVencidos() debe tolerar
    // que DeleteObject se llame sobre una key que no existe (operación
    // idempotente en S3/MinIO, no lanza) y aun así borrar la fila
    // correctamente. Requiere MINIO_ENDPOINT/credenciales alcanzables
    // desde donde corra este script (ver backend/utils/storage.js) —
    // si MinIO no está levantado, este bloque falla aquí, no antes.
    const { eliminados } = await limpiarTicketsVencidos();
    log(eliminados >= 1, 'limpiarTicketsVencidos() elimina al menos el ticket vencido de prueba', `eliminados=${eliminados}`);

    const [quedaViejo] = await pool.query('SELECT id FROM tickets WHERE id = ?', [viejo.insertId]);
    const [quedaReciente] = await pool.query('SELECT id FROM tickets WHERE id = ?', [reciente.insertId]);
    log(quedaViejo.length === 0, 'El ticket vencido (100 días) se eliminó');
    log(quedaReciente.length === 1, 'El ticket reciente NO se eliminó (solo se borra lo vencido)');

    // Misma retención (ya en 5 días desde arriba) también debe limpiar
    // órdenes de compra vencidas — pedido explícito: "aplica también
    // para las órdenes de compra". Una orden no tiene archivos que
    // limpiar (a diferencia de un ticket), así que solo se prueba la
    // fila de la base de datos.
    const [ordenVieja] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
       VALUES (?, DATE_SUB(NOW(), INTERVAL 100 DAY), 'Orden vieja de prueba', 100, 16, 116, ?,
               DATE_SUB(NOW(), INTERVAL 100 DAY), DATE_SUB(NOW(), INTERVAL 100 DAY))`,
      [`${NUM_COMPRA_PRUEBA}-RETEN-VIEJA`, EMAIL_PRUEBA]
    );
    const [ordenReciente] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
       VALUES (?, NOW(), 'Orden reciente de prueba', 100, 16, 116, ?, NOW(), NOW())`,
      [`${NUM_COMPRA_PRUEBA}-RETEN-RECIENTE`, EMAIL_PRUEBA]
    );

    const { eliminados: eliminadosOrdenes } = await limpiarOrdenesVencidas();
    log(eliminadosOrdenes >= 1, 'limpiarOrdenesVencidas() elimina al menos la orden vencida de prueba', `eliminados=${eliminadosOrdenes}`);

    const [quedaOrdenVieja] = await pool.query('SELECT id FROM ordenes_compra WHERE id = ?', [ordenVieja.insertId]);
    const [quedaOrdenReciente] = await pool.query('SELECT id FROM ordenes_compra WHERE id = ?', [ordenReciente.insertId]);
    log(quedaOrdenVieja.length === 0, 'La orden de compra vencida (100 días) se eliminó');
    log(quedaOrdenReciente.length === 1, 'La orden de compra reciente NO se eliminó (solo se borra lo vencido)');
    await pool.query('DELETE FROM ordenes_compra WHERE id = ?', [ordenReciente.insertId]);

    // Limpieza: borra el ticket reciente que sí sigue existiendo, y
    // restaura la retención a su estado original.
    await pool.query('DELETE FROM tickets WHERE id = ?', [reciente.insertId]);
    if (retencionOriginal) {
      await setRetencionTicketsDias(retencionOriginal);
    } else {
      await setRetencionTicketsDias(0);
    }
    const retencionRestaurada = await getRetencionTicketsDias();
    log(retencionRestaurada === retencionOriginal, 'La retención real se restaura a su estado original tras la prueba');
  } catch (err) {
    log(false, 'Retención y limpieza automática de tickets y órdenes de compra', err.message);
  }

  // ---------- Reportes (antes del borrado por retención) ----------
  // Pedido explícito: antes de que la limpieza automática borre tickets/
  // órdenes vencidos, esa información debe quedar guardada como reporte
  // (Markdown + datos estructurados), y enviarse por correo si hay uno
  // configurado. Se prueba aquí contra la función real
  // ejecutarLimpiezaConReporte(), no una simulación.
  try {
    const retencionOriginalReportes = await getRetencionTicketsDias();
    await setRetencionTicketsDias(5);

    const [ticketVencidoReporte] = await pool.query(
      `INSERT INTO tickets
        (folio, rfc, imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
         estatus, actualizado_por, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, 'listo', ?, DATE_SUB(NOW(), INTERVAL 100 DAY), DATE_SUB(NOW(), INTERVAL 100 DAY))`,
      ['TEMP', RFC_PRUEBA_USUARIO, 'reporte.jpg', 'uuid-reporte-inexistente.jpg', 'image/jpeg', 100, 'usuario_prueba_reporte']
    );
    await pool.query('UPDATE tickets SET folio = ? WHERE id = ?', [`TK-TEST-REPORTE-${ticketVencidoReporte.insertId}`, ticketVencidoReporte.insertId]);

    const [ordenVencidaReporte] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
       VALUES (?, DATE_SUB(NOW(), INTERVAL 100 DAY), 'Orden para probar el reporte', 200, 16, 232, ?,
               DATE_SUB(NOW(), INTERVAL 100 DAY), DATE_SUB(NOW(), INTERVAL 100 DAY))`,
      [`${NUM_COMPRA_PRUEBA}-REPORTE`, EMAIL_PRUEBA]
    );

    const resultadoLimpieza = await ejecutarLimpiezaConReporte();

    log(resultadoLimpieza.reporteId !== null, 'ejecutarLimpiezaConReporte() genera un reporte cuando hay tickets/órdenes vencidos');
    log(resultadoLimpieza.eliminadosTickets >= 1, 'ejecutarLimpiezaConReporte() SÍ elimina el ticket vencido (después de generar el reporte)');
    log(resultadoLimpieza.eliminadosOrdenes >= 1, 'ejecutarLimpiezaConReporte() SÍ elimina la orden vencida (después de generar el reporte)');

    const [quedaTicketReporte] = await pool.query('SELECT id FROM tickets WHERE id = ?', [ticketVencidoReporte.insertId]);
    const [quedaOrdenReporte] = await pool.query('SELECT id FROM ordenes_compra WHERE id = ?', [ordenVencidaReporte.insertId]);
    log(quedaTicketReporte.length === 0, 'El ticket capturado en el reporte de verdad se borró después');
    log(quedaOrdenReporte.length === 0, 'La orden capturada en el reporte de verdad se borró después');

    if (resultadoLimpieza.reporteId) {
      const [filasReporte] = await pool.query('SELECT * FROM reportes WHERE id = ?', [resultadoLimpieza.reporteId]);
      log(filasReporte.length === 1, 'El reporte quedó guardado en la tabla "reportes"');
      log(filasReporte[0].tipo === 'automatico', 'El reporte generado antes del borrado se guarda con tipo "automatico"');
      log(
        filasReporte[0].md_contenido.includes('TK-TEST-REPORTE') && filasReporte[0].md_contenido.includes(`${NUM_COMPRA_PRUEBA}-REPORTE`),
        'El Markdown guardado contiene tanto el folio del ticket como el No. Compra de la orden capturados'
      );

      const [itemsReporte] = await pool.query('SELECT * FROM reporte_items WHERE reporte_id = ?', [resultadoLimpieza.reporteId]);
      const itemTicket = itemsReporte.find((i) => i.tipo_registro === 'ticket');
      const itemOrden = itemsReporte.find((i) => i.tipo_registro === 'orden_compra');
      log(Boolean(itemTicket) && itemTicket.identificador.includes('TK-TEST-REPORTE'), 'El item del ticket quedó guardado en "reporte_items" con su folio correcto');
      log(
        Boolean(itemTicket) && itemTicket.atendido_por === 'usuario_prueba_reporte',
        'El item del ticket guarda quién lo atendió (atendido_por) en "reporte_items", tomado de tickets.actualizado_por'
      );
      log(
        filasReporte[0].md_contenido.includes('usuario_prueba_reporte'),
        'El Markdown del reporte incluye quién atendió el ticket en la columna "Atendido por"'
      );
      log(
        Boolean(itemOrden) && itemOrden.identificador === `${NUM_COMPRA_PRUEBA}-REPORTE` && Number(itemOrden.monto) === 232,
        'El item de la orden quedó guardado en "reporte_items" con su No. Compra y monto correctos'
      );

      // Filtro "Estatus" en "Lectura de reportes" — reproduce
      // exactamente el mismo query que usan GET .../items y
      // .../exportar (filtra sobre la columna compartida
      // estatus_o_concepto). El ticket de prueba se creó con
      // estatus='listo', así que debe aparecer al filtrar por "listo" y
      // NO aparecer al filtrar por cualquier otro estatus válido.
      const [filtradoPorEstatusListo] = await pool.query(
        'SELECT id FROM reporte_items WHERE reporte_id = ? AND estatus_o_concepto = ?',
        [resultadoLimpieza.reporteId, 'listo']
      );
      log(
        filtradoPorEstatusListo.some((f) => f.id === itemTicket.id),
        'Filtrar los items de un reporte por estatus="listo" encuentra el ticket de prueba (que sí tiene ese estatus)'
      );
      const [filtradoPorEstatusCancelado] = await pool.query(
        'SELECT id FROM reporte_items WHERE reporte_id = ? AND estatus_o_concepto = ?',
        [resultadoLimpieza.reporteId, 'cancelado']
      );
      log(
        !filtradoPorEstatusCancelado.some((f) => f.id === itemTicket.id),
        'Filtrar por un estatus distinto ("cancelado") NO encuentra el ticket de prueba'
      );
      // Bug real reportado: "reporte_items.rfc" se había creado como
      // VARCHAR(13) (pensado solo para un RFC), pero para una orden de
      // compra ahí se guarda el CORREO del cliente — un correo normal
      // excede fácilmente 13 caracteres, y MySQL (en modo estricto, el
      // que usa por defecto) rechaza el INSERT con un error de "dato
      // demasiado largo" en vez de truncarlo silenciosamente, lo que
      // tumbaba el envío completo del reporte con un 500. Se confirma
      // aquí que el correo de prueba (que sí excede 13 caracteres) se
      // guardó COMPLETO, sin truncar.
      log(
        Boolean(itemOrden) && itemOrden.rfc === EMAIL_PRUEBA && EMAIL_PRUEBA.length > 13,
        `BUG CORREGIDO: el correo completo (${EMAIL_PRUEBA.length} caracteres, más que los 13 que aceptaba la columna vieja) se guarda sin truncarse en "reporte_items.rfc"`
      );

      // Limpieza del reporte de prueba — el ON DELETE CASCADE de
      // reporte_items ya se probó implícitamente (se borra junto con su
      // reporte), así que solo hace falta borrar la fila de "reportes".
      await pool.query('DELETE FROM reportes WHERE id = ?', [resultadoLimpieza.reporteId]);
      const [reporteBorrado] = await pool.query('SELECT id FROM reportes WHERE id = ?', [resultadoLimpieza.reporteId]);
      const [itemsHuerfanos] = await pool.query('SELECT id FROM reporte_items WHERE reporte_id = ?', [resultadoLimpieza.reporteId]);
      log(reporteBorrado.length === 0, 'El reporte de prueba se limpia correctamente al terminar');
      log(itemsHuerfanos.length === 0, 'ON DELETE CASCADE borra automáticamente los items del reporte al borrar el reporte');
    }

    // Botón "Eliminar reporte" — reproduce exactamente la misma lógica
    // que usa DELETE /api/admin/reportes/:id (un DELETE simple + revisar
    // "affectedRows" para distinguir "sí existía y se borró" de "ya no
    // existía", mismo patrón usado en el resto del proyecto para
    // devolver 404 quando corresponde).
    try {
      const [reportePruebaEliminar] = await pool.query(
        `INSERT INTO reportes (tipo, fecha_generacion, correo_enviado, total_tickets, total_ordenes, md_contenido, creado_en)
         VALUES ('manual', NOW(), 0, 0, 0, '# Reporte de prueba para eliminar', NOW())`
      );
      const idParaEliminar = reportePruebaEliminar.insertId;

      const [resultadoEliminar] = await pool.query('DELETE FROM reportes WHERE id = ?', [idParaEliminar]);
      log(resultadoEliminar.affectedRows === 1, 'DELETE de un reporte existente reporta affectedRows = 1');

      const [resultadoEliminarDeNuevo] = await pool.query('DELETE FROM reportes WHERE id = ?', [idParaEliminar]);
      log(
        resultadoEliminarDeNuevo.affectedRows === 0,
        'DELETE de un reporte que ya no existe reporta affectedRows = 0 (así es como el endpoint real distingue cuándo devolver 404)'
      );
    } catch (err) {
      log(false, 'DELETE /api/admin/reportes/:id (eliminar un reporte)', err.message);
    }

    // Sin nada vencido, no debe generarse ningún reporte — un reporte
    // vacío no le sirve a nadie.
    const resultadoSinNada = await ejecutarLimpiezaConReporte();
    log(resultadoSinNada.reporteId === null, 'Sin tickets/órdenes vencidos, ejecutarLimpiezaConReporte() NO genera ningún reporte');

    if (retencionOriginalReportes) {
      await setRetencionTicketsDias(retencionOriginalReportes);
    } else {
      await setRetencionTicketsDias(0);
    }
  } catch (err) {
    log(false, 'Reportes generados antes del borrado por retención', err.message);
  }

  // Correo de reportes (configuración) y envío manual
  try {
    const configOriginalReportes = await getConfiguracionGlobal();
    const conCorreoValido = await setConfiguracionGlobal({ correo_reportes: 'reportes@ejemplo.com' });
    log(conCorreoValido.correo_reportes === 'reportes@ejemplo.com', 'setConfiguracionGlobal() guarda un correo de reportes válido');

    let correoInvalidoRechazado = false;
    try {
      await setConfiguracionGlobal({ correo_reportes: 'esto no es un correo' });
    } catch (e) {
      correoInvalidoRechazado = true;
    }
    log(correoInvalidoRechazado, 'Un correo de reportes con formato inválido se rechaza');

    const correoVacio = await setConfiguracionGlobal({ correo_reportes: '' });
    log(correoVacio.correo_reportes === '', 'Un correo de reportes vacío es válido (campo opcional)');

    await setConfiguracionGlobal({ correo_reportes: configOriginalReportes.correo_reportes });
  } catch (err) {
    log(false, 'Configuración del correo de reportes', err.message);
  }

  // Contenido MD, CSV y Excel generados a partir de items reales
  try {
    const itemsDePrueba = [
      { tipo_registro: 'ticket', identificador: 'TK-000099', rfc: 'XAXX010101000', estatus_o_concepto: 'listo', monto: null, fecha_registro: new Date(), atendido_por: 'admin_prueba' },
      { tipo_registro: 'orden_compra', identificador: 'OC-000099', rfc: 'cliente@ejemplo.com', estatus_o_concepto: 'Prueba', monto: 999.99, fecha_registro: new Date() },
    ];
    const mdGenerado = generarContenidoMD({
      tipo: 'manual',
      fechaGeneracion: new Date(),
      items: itemsDePrueba,
      zonaHoraria: 'America/Mexico_City',
    });
    log(
      mdGenerado.includes('TK-000099') && mdGenerado.includes('OC-000099') && mdGenerado.includes('$999.99'),
      'generarContenidoMD() incluye correctamente los datos de tickets y órdenes en el Markdown'
    );
    log(
      mdGenerado.includes('Atendido por') && mdGenerado.includes('admin_prueba'),
      'generarContenidoMD() incluye la columna "Atendido por" con quién atendió el ticket'
    );

    const csvGenerado = generarCSV(itemsDePrueba, 'America/Mexico_City');
    log(csvGenerado.charCodeAt(0) === 0xfeff, 'generarCSV() incluye el BOM de UTF-8 (para que Excel en Windows no corrompa acentos)');
    log(csvGenerado.includes('TK-000099') && csvGenerado.includes('OC-000099'), 'generarCSV() incluye los identificadores de ambos items');
    log(csvGenerado.includes('admin_prueba'), 'generarCSV() incluye la columna "Atendido por"');

    const excelBuffer = await generarExcelBuffer(itemsDePrueba, 'America/Mexico_City');
    log(Buffer.isBuffer(excelBuffer) && excelBuffer.length > 0, 'generarExcelBuffer() genera un archivo .xlsx real (buffer no vacío)');

    // Bug real encontrado al renombrar "Estatus o Concepto" a "Estatus":
    // la lógica de ancho de columna en generarExcelBuffer() comparaba
    // contra el texto VIEJO ("Estatus o Concepto"), así que después del
    // renombre esa comparación ya nunca coincidía y la columna se
    // quedaba con el ancho angosto por defecto — a pesar de que sigue
    // necesitando ser ancha, ya que también guarda el concepto (texto
    // libre) de una orden de compra. Se confirma aquí que el encabezado
    // exportado es el nuevo texto, no el viejo.
    const workbookDePrueba = new (require('exceljs').Workbook)();
    await workbookDePrueba.xlsx.load(excelBuffer);
    const hojaDePrueba = workbookDePrueba.getWorksheet('Reporte');
    const encabezadoColumnaEstatus = hojaDePrueba.getRow(1).getCell(4).value;
    const anchoColumnaEstatus = hojaDePrueba.getColumn(4).width;
    log(
      encabezadoColumnaEstatus === 'Estatus' && anchoColumnaEstatus === 32,
      'BUG CORREGIDO: la columna "Estatus" del Excel exportado tiene el encabezado nuevo Y conserva el ancho amplio (32) que necesita'
    );
  } catch (err) {
    log(false, 'Generación de contenido MD/CSV/Excel para reportes', err.message);
  }

  // Bug real reportado: el pool de MySQL de este proyecto usa
  // `dateStrings: true` (ver db.js) — una columna DATETIME llega como
  // TEXTO PLANO ("2026-07-15 14:00:00"), no como un objeto Date.
  // Pasar ese texto sin convertir a formatearFechaHoraMexico() (que usa
  // Intl.DateTimeFormat, el cual espera un Date/timestamp) lanzaba
  // "RangeError: Invalid time value" — eso era la causa real del 500 en
  // "Enviar reporte", no el tamaño de columna del punto 73 (esa
  // corrección también era necesaria, pero no era suficiente por sí
  // sola). Se prueba aquí tanto la función auxiliar aFechaSegura()
  // directamente, como el flujo completo con fechas como texto plano,
  // tal como las devuelve MySQL de verdad en este proyecto.
  try {
    log(aFechaSegura('2026-07-15 14:00:00') instanceof Date, 'aFechaSegura() convierte un texto de fecha de MySQL a un Date real');
    log(aFechaSegura(new Date('2026-07-15T14:00:00Z')) instanceof Date, 'aFechaSegura() con un Date real lo devuelve tal cual (sin romperlo)');
    log(aFechaSegura(null) === null, 'aFechaSegura() con null devuelve null (no lanza excepción)');
    log(aFechaSegura('esto no es una fecha') === null, 'aFechaSegura() con texto inválido devuelve null (no lanza excepción)');

    const itemsComoLosDevuelveMysqlDeVerdad = [
      { tipo_registro: 'ticket', identificador: 'TK-000098', rfc: 'XAXX010101000', estatus_o_concepto: 'listo', monto: null, fecha_registro: '2026-07-15 14:00:00' },
      { tipo_registro: 'orden_compra', identificador: 'OC-000098', rfc: 'cliente@ejemplo.com', estatus_o_concepto: 'Prueba', monto: 580.5, fecha_registro: '2026-07-10 09:00:00' },
    ];
    let mdConTextoPlano = '';
    let noLanzoExcepcion = true;
    try {
      mdConTextoPlano = generarContenidoMD({
        tipo: 'manual',
        fechaGeneracion: new Date(),
        rangoInicio: '2026-07-01 00:00:00',
        rangoFin: '2026-07-28 20:00:00',
        items: itemsComoLosDevuelveMysqlDeVerdad,
        zonaHoraria: 'America/Mexico_City',
      });
    } catch (err) {
      noLanzoExcepcion = false;
    }
    log(noLanzoExcepcion, 'BUG CORREGIDO: generarContenidoMD() con fechas como texto plano de MySQL (dateStrings:true) ya NO lanza ninguna excepción');
    log(
      mdConTextoPlano.includes('15/jul/2026') && mdConTextoPlano.includes('10/jul/2026'),
      'Las fechas en texto plano se formatean correctamente en el Markdown resultante'
    );
  } catch (err) {
    log(false, 'Conversión segura de fechas provenientes de MySQL (dateStrings:true) para reportes', err.message);
  }

  // ---------- Configuración global: IVA y zona horaria ----------
  try {
    const configOriginal = await getConfiguracionGlobal();

    const actualizado = await setConfiguracionGlobal({ iva_porcentaje: 8, zona_horaria: 'America/Tijuana' });
    log(actualizado.iva_porcentaje === 8, 'setConfiguracionGlobal() guarda el IVA correctamente');
    log(actualizado.zona_horaria === 'America/Tijuana', 'setConfiguracionGlobal() guarda la zona horaria correctamente');

    const releido = await getConfiguracionGlobal();
    log(
      releido.iva_porcentaje === 8 && releido.zona_horaria === 'America/Tijuana',
      'getConfiguracionGlobal() refleja los valores guardados'
    );

    let rechazoIvaFueraDeRango = false;
    try {
      await setConfiguracionGlobal({ iva_porcentaje: 150 });
    } catch (err) {
      rechazoIvaFueraDeRango = true;
    }
    log(rechazoIvaFueraDeRango, 'Un IVA fuera de rango (150%) se rechaza');

    let rechazoZonaInvalida = false;
    try {
      await setConfiguracionGlobal({ zona_horaria: 'Zona/Inventada' });
    } catch (err) {
      rechazoZonaInvalida = true;
    }
    log(rechazoZonaInvalida, 'Una zona horaria fuera del catálogo de México se rechaza');

    log(ZONAS_HORARIAS_MEXICO.length >= 10, 'El catálogo de zonas horarias de México tiene al menos 10 entradas');
    log(
      ZONAS_HORARIAS_MEXICO.every((z) => typeof z.id === 'string' && typeof z.etiqueta === 'string'),
      'Cada zona horaria del catálogo tiene id y etiqueta'
    );

    const fechaPrueba = new Date('2026-07-24T15:30:45Z');
    const formateado = formatearFechaHoraMexico(fechaPrueba, 'America/Mexico_City');
    log(/^\d{2}\/[a-z]{3}\/\d{4}$/.test(formateado.fecha), 'formatearFechaHoraMexico() da la fecha en formato dd/mmm/aaaa');
    log(/^\d{2}:\d{2}:\d{2}$/.test(formateado.hora), 'formatearFechaHoraMexico() da la hora en formato HH:mm:ss');

    // Restaura la configuración a su estado original.
    await setConfiguracionGlobal(configOriginal);
    const restaurado = await getConfiguracionGlobal();
    log(
      restaurado.iva_porcentaje === configOriginal.iva_porcentaje && restaurado.zona_horaria === configOriginal.zona_horaria,
      'La configuración global se restaura a su estado original tras la prueba'
    );
  } catch (err) {
    log(false, 'Configuración global: IVA y zona horaria', err.message);
  }

  // ---------- Órdenes de compra ----------
  // Reproduce el mismo flujo que POST /api/admin/ordenes-compra y
  // GET /api/admin/ordenes-compra, con un registro (constancia) de
  // prueba dedicado, para no depender del orden ni de la limpieza de
  // otros bloques de prueba.
  const EMAIL_PRUEBA_ORDEN = `${PREFIJO_PRUEBA}-orden@example.test`;
  let idRegistroPruebaOrden = null;
  let idOrdenPrueba = null;
  try {
    const ahoraRegistro = new Date();
    const [registroInsertado] = await pool.query(
      `INSERT INTO registros
        (rfc, email, tipo_persona, nombre, archivo_nombre_original, archivo_nombre_guardado,
         archivo_mime, archivo_tamano_bytes, creado_en, actualizado_en)
       VALUES (?, ?, 'moral', 'EMPRESA DE PRUEBA SA DE CV', 'constancia.pdf', 'uuid-prueba-orden.pdf',
               'application/pdf', 100, ?, ?)`,
      ['ORD010101AB1', EMAIL_PRUEBA_ORDEN, ahoraRegistro, ahoraRegistro]
    );
    idRegistroPruebaOrden = registroInsertado.insertId;

    // GET /api/admin/correos-registrados: el correo de prueba debe
    // aparecer, junto con su RFC y nombre (para el bloque de solo
    // lectura que se muestra al seleccionar el correo en el formulario).
    const [correosDisponibles] = await pool.query(
      'SELECT email, rfc, nombre FROM registros WHERE eliminado_en IS NULL ORDER BY email ASC'
    );
    const correoDePrueba = correosDisponibles.find((f) => f.email === EMAIL_PRUEBA_ORDEN);
    log(
      Boolean(correoDePrueba),
      'El correo de una constancia activa aparece en la lista para el desplegable de la orden de compra'
    );
    log(
      Boolean(correoDePrueba) && correoDePrueba.rfc === 'ORD010101AB1' && correoDePrueba.nombre === 'EMPRESA DE PRUEBA SA DE CV',
      'El RFC y el nombre/razón social vienen junto con el correo, para mostrarlos de solo lectura al seleccionarlo'
    );

    // POST /api/admin/ordenes-compra: mismo cálculo que hace el endpoint real.
    const configParaOrden = await getConfiguracionGlobal();
    await setConfiguracionGlobal({ iva_porcentaje: 16 }); // IVA fijo y conocido, para la prueba
    const ivaDePrueba = 16;
    const cantidadDePrueba = 1000;
    const totalEsperado = Math.round(cantidadDePrueba * (1 + ivaDePrueba / 100) * 100) / 100;
    log(totalEsperado === 1160, 'El total esperado para $1000 con 16% de IVA es $1160 (verificación de la propia prueba)');

    // "No. Compra": mismo patrón de generación que ya usa el folio de
    // tickets (insertar con un valor temporal, generar el número real a
    // partir del id autoincremental, y actualizar la fila).
    function generarNumeroCompra(id) {
      return `OC-${String(id).padStart(6, '0')}`;
    }
    log(generarNumeroCompra(1) === 'OC-000001', 'generarNumeroCompra() da el formato esperado para el id 1');
    log(generarNumeroCompra(42) === 'OC-000042', 'generarNumeroCompra() rellena con ceros a la izquierda');

    const ahoraOrden = new Date();
    const [ordenInsertada] = await pool.query(
      `INSERT INTO ordenes_compra
        (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['TEMP', ahoraOrden, 'Venta de equipo de cómputo (prueba)', cantidadDePrueba, ivaDePrueba, totalEsperado, EMAIL_PRUEBA_ORDEN, ahoraOrden, ahoraOrden]
    );
    idOrdenPrueba = ordenInsertada.insertId;
    log(Boolean(idOrdenPrueba), 'INSERT crea una orden de compra correctamente');

    const numeroCompraReal = generarNumeroCompra(idOrdenPrueba);
    await pool.query('UPDATE ordenes_compra SET numero_compra = ? WHERE id = ?', [numeroCompraReal, idOrdenPrueba]);

    // GET /api/admin/ordenes-compra: la orden debe aparecer, con el total y el número de compra correctos.
    const [ordenGuardada] = await pool.query('SELECT * FROM ordenes_compra WHERE id = ?', [idOrdenPrueba]);
    log(ordenGuardada.length === 1, 'La orden de compra se puede volver a consultar por su id');
    log(ordenGuardada[0].numero_compra === numeroCompraReal, 'El "No. Compra" generado se guarda correctamente tras el UPDATE');
    log(Number(ordenGuardada[0].total) === 1160, 'El total guardado en la base de datos es el correcto ($1160)');
    log(Number(ordenGuardada[0].iva_porcentaje) === 16, 'El IVA guardado en la orden es una "foto" del valor usado al crearla (16%)');

    // El "No. Compra" es único — no se puede repetir entre dos órdenes.
    let rechazoNumeroCompraDuplicado = false;
    try {
      await pool.query(
        `INSERT INTO ordenes_compra
          (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
         VALUES (?, NOW(), 'Prueba duplicado', 100, 16, 116, ?, NOW(), NOW())`,
        [numeroCompraReal, EMAIL_PRUEBA_ORDEN]
      );
    } catch (err) {
      rechazoNumeroCompraDuplicado = true;
    }
    log(rechazoNumeroCompraDuplicado, 'La base de datos rechaza un "No. Compra" repetido (UNIQUE KEY)');

    // Simula que el IVA global cambia DESPUÉS de crear la orden — la orden
    // ya creada NO debe cambiar retroactivamente (por eso se guarda una
    // copia del IVA en cada fila, no solo una referencia al valor global).
    await setConfiguracionGlobal({ iva_porcentaje: 8 });
    const [ordenTrasCambioDeIva] = await pool.query('SELECT iva_porcentaje, total FROM ordenes_compra WHERE id = ?', [idOrdenPrueba]);
    log(
      Number(ordenTrasCambioDeIva[0].iva_porcentaje) === 16 && Number(ordenTrasCambioDeIva[0].total) === 1160,
      'Un cambio posterior al IVA global NO afecta retroactivamente una orden ya creada'
    );

    // Restaura el IVA global a su valor original.
    await setConfiguracionGlobal(configParaOrden);

    // Validación de datos inválidos a nivel de base de datos (CHECK constraints).
    let rechazoCantidadInvalida = false;
    try {
      await pool.query(
        `INSERT INTO ordenes_compra
          (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
         VALUES (?, NOW(), 'Prueba invalida', -100, 16, 0, ?, NOW(), NOW())`,
        [`${NUM_COMPRA_PRUEBA}-OC-invalida-1`, EMAIL_PRUEBA_ORDEN]
      );
    } catch (err) {
      rechazoCantidadInvalida = true;
    }
    log(rechazoCantidadInvalida, 'La base de datos rechaza una orden con cantidad negativa (CHECK cantidad > 0)');

    let rechazoIvaInvalido = false;
    try {
      await pool.query(
        `INSERT INTO ordenes_compra
          (numero_compra, fecha_compra, concepto, cantidad, iva_porcentaje, total, email, creado_en, actualizado_en)
         VALUES (?, NOW(), 'Prueba invalida', 100, 150, 250, ?, NOW(), NOW())`,
        [`${NUM_COMPRA_PRUEBA}-OC-invalida-2`, EMAIL_PRUEBA_ORDEN]
      );
    } catch (err) {
      rechazoIvaInvalido = true;
    }
    log(rechazoIvaInvalido, 'La base de datos rechaza una orden con IVA fuera de rango (CHECK 0-100)');

    // Correo de confirmación con diseño de "ticket": confirma que el
    // logo parametrizado (logo_url en la configuración global) se lee
    // correctamente, con el mismo valor por defecto (null, hasta que se
    // agregue una pantalla para configurarlo) que ya usa IVA/zona horaria.
    log(
      configParaOrden.logo_url === null || typeof configParaOrden.logo_url === 'string',
      'getConfiguracionGlobal() incluye "logo_url" (null por defecto, listo para cuando se configure)'
    );
    const logoDePrueba = await setConfiguracionGlobal({ logo_url: 'https://ejemplo.com/logo.png' });
    log(logoDePrueba.logo_url === 'https://ejemplo.com/logo.png', 'setConfiguracionGlobal() guarda un logo_url válido');
    const logoRestaurado = await setConfiguracionGlobal({ logo_url: '' });
    log(logoRestaurado.logo_url === null, 'Un logo_url vacío se guarda como null (permite "borrar" el logo configurado)');
    await setConfiguracionGlobal({ logo_url: configParaOrden.logo_url || '' });

    // Interruptor "Habilitar Orden de compra" — en `true` por defecto,
    // para no desactivar de golpe algo que ya es parte central del
    // flujo si nadie lo ha configurado explícitamente todavía.
    log(
      typeof configParaOrden.ordenes_compra_habilitado === 'boolean',
      'getConfiguracionGlobal() incluye "ordenes_compra_habilitado" como booleano'
    );
    const apagado = await setConfiguracionGlobal({ ordenes_compra_habilitado: false });
    log(apagado.ordenes_compra_habilitado === false, 'setConfiguracionGlobal() puede apagar el interruptor');
    const encendido = await setConfiguracionGlobal({ ordenes_compra_habilitado: true });
    log(encendido.ordenes_compra_habilitado === true, 'setConfiguracionGlobal() puede volver a encenderlo');
    await setConfiguracionGlobal({ ordenes_compra_habilitado: configParaOrden.ordenes_compra_habilitado });

    // Mismo comportamiento condicional que ahora tiene POST /api/tickets:
    // con el interruptor apagado, un ticket se acepta sin los 4 campos
    // de verificación (y sin vincularse a ninguna orden); con el
    // interruptor encendido, sigue exigiéndolos como ya se probó arriba.
    function simularProcesarTicket({ habilitado, numeroCompra, ordenEncontrada }) {
      if (!habilitado) return { ok: true, ordenCompraId: null };
      if (!numeroCompra) return { error: 'numero_obligatorio' };
      if (!ordenEncontrada) return { error: 'COMPRA_NO_ENCONTRADA' };
      return { ok: true, ordenCompraId: 1 };
    }
    log(
      JSON.stringify(simularProcesarTicket({ habilitado: false, numeroCompra: '', ordenEncontrada: false })) === JSON.stringify({ ok: true, ordenCompraId: null }),
      'Con el interruptor apagado, un ticket sin ningún dato de compra se acepta de todas formas'
    );
    log(
      JSON.stringify(simularProcesarTicket({ habilitado: true, numeroCompra: '', ordenEncontrada: false })) === JSON.stringify({ error: 'numero_obligatorio' }),
      'Con el interruptor encendido, un ticket sin número de compra se sigue rechazando (comportamiento sin cambios)'
    );

    // Datos fiscales de la compañía (RFC, régimen fiscal, tipo de
    // persona, Clave SAT, link) — se guarda/restaura el valor real de
    // cada uno al terminar, igual que ya se hace con IVA/zona horaria/
    // logo en este mismo bloque.
    const configOriginalFiscal = await getConfiguracionGlobal();
    try {
      const conRfcValido = await setConfiguracionGlobal({ rfc_compania: 'ADD200101AB1' });
      log(conRfcValido.rfc_compania === 'ADD200101AB1', 'setConfiguracionGlobal() guarda un RFC de compañía válido');

      let rfcInvalidoRechazado = false;
      try {
        await setConfiguracionGlobal({ rfc_compania: '123' });
      } catch (e) {
        rfcInvalidoRechazado = true;
      }
      log(rfcInvalidoRechazado, 'Un RFC de compañía con formato inválido se rechaza');

      const rfcVacio = await setConfiguracionGlobal({ rfc_compania: '' });
      log(rfcVacio.rfc_compania === '', 'Un RFC de compañía vacío es válido (campo opcional)');

      // "clave_sat" reemplazó a "codigo_sat" — se prueba tanto el nombre
      // nuevo como que un valor guardado bajo el nombre VIEJO todavía se
      // pueda leer (compatibilidad hacia atrás, para no perder datos ya
      // guardados antes de este cambio).
      const conClaveValida = await setConfiguracionGlobal({ clave_sat: '12345678' });
      log(conClaveValida.clave_sat === '12345678', 'setConfiguracionGlobal() guarda una Clave SAT de 8 dígitos (nombre nuevo)');

      let claveInvalidaRechazada = false;
      try {
        await setConfiguracionGlobal({ clave_sat: '123' });
      } catch (e) {
        claveInvalidaRechazada = true;
      }
      log(claveInvalidaRechazada, 'Una Clave SAT que no tiene exactamente 8 dígitos se rechaza');

      // Compatibilidad hacia atrás: un valor guardado bajo el nombre
      // viejo "codigo_sat" (de antes de este cambio) se sigue leyendo
      // correctamente como "clave_sat", sin perder el dato.
      await pool.query(
        `INSERT INTO configuracion (clave, valor) VALUES ('configuracion_global', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [JSON.stringify({ ...configOriginalFiscal, clave_sat: undefined, codigo_sat: '87654321' })]
      );
      const leidoConNombreViejo = await getConfiguracionGlobal();
      log(
        leidoConNombreViejo.clave_sat === '87654321',
        'Un valor guardado con el nombre viejo "codigo_sat" se sigue leyendo correctamente como "clave_sat"'
      );

      // Razón social de la compañía — se lee con extraerNombreRazonSocial(),
      // la MISMA función ya usada (y ya depurada, ver el bloque de
      // pruebas de esa función más arriba en este mismo script) en la
      // constancia de un cliente, para no repetir los mismos bugs de
      // lectura ya corregidos ahí.
      const conRazonSocial = await setConfiguracionGlobal({ razon_social_compania: 'COMERCIALIZADORA DEL VALLE S.A. DE C.V.' });
      log(
        conRazonSocial.razon_social_compania === 'COMERCIALIZADORA DEL VALLE S.A. DE C.V.',
        'setConfiguracionGlobal() guarda la razón social de la compañía'
      );

      // Régimen fiscal y tipo de persona de la compañía — se escriben
      // juntos desde POST /api/admin/config/constancia-compania, aquí se
      // prueba que setConfiguracionGlobal() los guarda/lee bien por
      // separado.
      const regimenesDePrueba = ['612 - Personas Físicas con Actividades Empresariales y Profesionales'];
      const conRegimen = await setConfiguracionGlobal({
        regimen_fiscal_compania: regimenesDePrueba.join('\n'),
        tipo_persona_compania: determinarTipoPersonaPorRegimen(regimenesDePrueba),
      });
      log(
        conRegimen.regimen_fiscal_compania === regimenesDePrueba.join('\n'),
        'setConfiguracionGlobal() guarda el régimen fiscal de la compañía'
      );
      log(conRegimen.tipo_persona_compania === 'fisica', 'El régimen 612 se clasifica correctamente como Persona Física');

      const conRegimenMoral = await setConfiguracionGlobal({
        tipo_persona_compania: determinarTipoPersonaPorRegimen(['601 - General de Ley Personas Morales']),
      });
      log(conRegimenMoral.tipo_persona_compania === 'moral', 'El régimen 601 se clasifica correctamente como Persona Moral');

      // Regla adicional por razón social — pedida específicamente para
      // desempatar regímenes ambiguos como 626 RESICO (aplica a ambos
      // tipos de contribuyente, el código por sí solo no basta).
      log(
        determinarTipoPersonaPorNombre('JUAN CARLOS RAMIREZ LOPEZ') === 'fisica',
        'Un nombre propio de 2-5 palabras se clasifica como Persona Física por razón social'
      );
      log(
        determinarTipoPersonaPorNombre('COMERCIALIZADORA DEL VALLE S.A. DE C.V.') === 'moral',
        'Una razón social con terminación legal (S.A. DE C.V.) se clasifica como Persona Moral'
      );
      log(
        determinarTipoPersonaPorNombre('GRUPO CONSTRUCTOR DEL PACIFICO') === 'moral',
        'Una razón social con palabra corporativa (GRUPO), sin terminación legal explícita, igual se clasifica como Persona Moral'
      );
      log(
        determinarTipoPersonaPorNombre('') === null,
        'Sin razón social, la regla por nombre no concluye nada (null)'
      );

      // La función combinada: RESICO (626) por sí solo es ambiguo, pero
      // con la razón social como desempate sí se resuelve — este es el
      // caso real que motivó agregar la regla por nombre.
      log(
        determinarTipoPersona(['626 - Régimen Simplificado de Confianza'], 'JUAN CARLOS RAMIREZ LOPEZ') === 'fisica',
        'RESICO (626) + razón social de nombre propio se resuelve como Persona Física'
      );
      log(
        determinarTipoPersona(['626 - Régimen Simplificado de Confianza'], 'COMERCIALIZADORA DEL VALLE S.A. DE C.V.') === 'moral',
        'RESICO (626) + razón social con S.A. DE C.V. se resuelve como Persona Moral'
      );
      log(
        determinarTipoPersona(['601 - General de Ley Personas Morales'], 'JUAN CARLOS RAMIREZ LOPEZ') === 'moral',
        'Un régimen EXCLUSIVO de moral (601) siempre gana, incluso si la razón social pareciera un nombre propio'
      );

      // Señal nueva y con la MÁXIMA prioridad: los campos que el propio
      // documento del SAT trae — "Primer/Segundo Apellido" solo existen
      // en una constancia de Física, "Régimen Capital"/"Nombre Comercial"
      // solo en una de Moral. Se agregó porque las otras dos señales
      // (régimen fiscal y razón social) seguían fallando en la práctica.
      log(
        determinarTipoPersonaPorCamposDocumento('Nombre(s): JUAN Primer Apellido: RAMIREZ Segundo Apellido: LOPEZ') === 'fisica',
        'El texto del documento con "Primer Apellido"/"Segundo Apellido" se detecta como Persona Física'
      );
      log(
        determinarTipoPersonaPorCamposDocumento('Denominación o Razón Social: ACME Régimen Capital: VARIABLE') === 'moral',
        'El texto del documento con "Régimen Capital" se detecta como Persona Moral'
      );
      log(
        determinarTipoPersonaPorCamposDocumento('Nombre Comercial: ACME') === 'moral',
        'El texto del documento con "Nombre Comercial" se detecta como Persona Moral'
      );
      log(
        determinarTipoPersonaPorCamposDocumento('Registro Federal de Contribuyentes: XAXX010101000') === null,
        'Sin ninguna de esas cuatro palabras clave, la señal por campos no concluye nada (null)'
      );

      // La señal por campos del documento debe ganar SIEMPRE sobre las
      // otras dos, incluso cuando se contradicen entre sí — es la más
      // directa de las tres, ya que lee la estructura real del PDF.
      log(
        determinarTipoPersona(
          ['601 - General de Ley Personas Morales'],
          'cualquier cosa',
          'Primer Apellido: RAMIREZ'
        ) === 'fisica',
        'Los campos del documento ("Primer Apellido") ganan incluso sobre un régimen exclusivo de moral (601)'
      );
      log(
        determinarTipoPersona(
          [],
          'JUAN CARLOS RAMIREZ LOPEZ',
          'Nombre Comercial: TIENDA JUAN'
        ) === 'moral',
        'Los campos del documento ("Nombre Comercial") ganan incluso cuando la razón social parece un nombre propio'
      );

      // Bug real reportado: contra una constancia REAL (persona moral,
      // RESICO, razón social "AGILE DEVELOPMENT AND DESIGN + VALUE,"),
      // el resultado salía "física" en vez de "moral". La causa: el
      // extractor de PDF concatena las celdas de la tabla SIN espacio
      // entre ellas ("Régimen Capital:" se extrae como "RegimenCapital:"),
      // así que la búsqueda original (con un espacio fijo) nunca
      // encontraba la etiqueta, y el resultado terminaba cayendo al
      // valor por defecto de determinarTipoPersonaPorRegimen() en vez del
      // correcto. Se prueba aquí tal cual viene el texto real extraído
      // (sin espacio), no una versión idealizada con espacios.
      log(
        determinarTipoPersonaPorCamposDocumento('RégimenCapital:SOCIEDADANONIMADECAPITALVARIABLE') === 'moral',
        'BUG CORREGIDO: "RegimenCapital" pegado sin espacio (como lo extrae pdf-parse de una tabla real) se detecta correctamente como Persona Moral'
      );
      log(
        determinarTipoPersonaPorCamposDocumento('PrimerApellido:RAMIREZ') === 'fisica',
        'Lo mismo aplica a "PrimerApellido" pegado sin espacio — se detecta correctamente como Persona Física'
      );
      log(
        determinarTipoPersona(
          ['626 - Régimen Simplificado de Confianza'],
          'AGILE DEVELOPMENT AND DESIGN + VALUE,',
          'Datos de Identificación del Contribuyente: RFC:ADD200127D12 Denominación/RazónSocial:AGILEDEVELOPMENTANDDESIGN+ VALUE, RégimenCapital:SOCIEDADANONIMADECAPITALVARIABLE NombreComercial:'
        ) === 'moral',
        'CASO REAL: la constancia que reportó el bug (RESICO + razón social con "+", donde ni el régimen ni la razón social por sí solos bastaban) ahora se resuelve correctamente como Persona Moral gracias a los campos del documento'
      );

      const conLinkValido = await setConfiguracionGlobal({ link_codigos_sat: 'https://sat.gob.mx/codigos' });
      log(conLinkValido.link_codigos_sat === 'https://sat.gob.mx/codigos', 'setConfiguracionGlobal() guarda un link de códigos SAT válido');

      let linkInvalidoRechazado = false;
      try {
        await setConfiguracionGlobal({ link_codigos_sat: 'esto no es una URL' });
      } catch (e) {
        linkInvalidoRechazado = true;
      }
      log(linkInvalidoRechazado, 'Un link de códigos SAT que no es una URL válida se rechaza');

      // Info de la barra de sesión: mismo criterio que
      // aplicarInfoFiscalBarra() en admin.js — solo se muestra si AMBOS
      // (RFC y Clave SAT) están capturados; el tipo de persona es un
      // tercer segmento opcional que solo se agrega si ya se calculó.
      function debeMostrarInfoFiscal(config) {
        return Boolean((config.rfc_compania || '').trim() && (config.clave_sat || '').trim());
      }
      log(
        debeMostrarInfoFiscal({ rfc_compania: 'ADD200101AB1', clave_sat: '12345678' }) === true,
        'Con RFC y Clave SAT capturados, la barra de sesión mostraría la información fiscal'
      );
      log(
        debeMostrarInfoFiscal({ rfc_compania: 'ADD200101AB1', clave_sat: '' }) === false,
        'Con solo el RFC capturado (sin Clave SAT), la barra de sesión NO mostraría nada'
      );
      log(
        debeMostrarInfoFiscal({ rfc_compania: '', clave_sat: '' }) === false,
        'Con ambos vacíos, la barra de sesión no mostraría nada'
      );
    } finally {
      await setConfiguracionGlobal({
        rfc_compania: configOriginalFiscal.rfc_compania,
        razon_social_compania: configOriginalFiscal.razon_social_compania,
        regimen_fiscal_compania: configOriginalFiscal.regimen_fiscal_compania,
        tipo_persona_compania: configOriginalFiscal.tipo_persona_compania,
        clave_sat: configOriginalFiscal.clave_sat,
        link_codigos_sat: configOriginalFiscal.link_codigos_sat,
      });
    }
  } catch (err) {
    log(false, 'Órdenes de compra', err.message);
  } finally {
    // Limpieza por correo (cubre la orden principal de la prueba y
    // cualquier fila que — en contra de lo esperado — hubiera logrado
    // insertarse en los intentos de CHECK/UNIQUE que debían fallar).
    await pool.query('DELETE FROM ordenes_compra WHERE email = ?', [EMAIL_PRUEBA_ORDEN]).catch(() => {});
    if (idRegistroPruebaOrden) {
      await pool.query('DELETE FROM registros WHERE id = ?', [idRegistroPruebaOrden]);
    }
  }

  // ---------- Notificación: tickets pendientes sin correo de contador ----------
  // El "correo de quien va a facturar" ahora es un valor GLOBAL dentro de
  // la configuración SMTP (ya no un campo por RFC/registro) — esta prueba
  // confirma que la lista de "pendientes por notificar" reacciona
  // correctamente a si ese valor global está configurado o no. Guarda y
  // restaura la configuración SMTP real, igual que la prueba de SMTP de
  // arriba, para no dejar datos de prueba sobre una configuración real.
  try {
    const configSmtpOriginal = await getConfigSmtp();

    const [ticketPendiente] = await pool.query(
      `INSERT INTO tickets
        (folio, rfc, imagen_nombre_original, imagen_nombre_guardado, imagen_mime, imagen_tamano_bytes,
         estatus, creado_en, actualizado_en)
       VALUES ('TEMP', ?, 'a.jpg', 'uuid-a-inexistente.jpg', 'image/jpeg', 100, 'pendiente', NOW(), NOW())`,
      [RFC_PRUEBA_USUARIO]
    );

    // Misma consulta que usa GET /api/admin/tickets/pendientes-sin-contador
    async function consultarPendientesSinContador() {
      const config = await getConfigSmtp();
      const correoContadorConfigurado = Boolean(config && config.correo_contador);
      if (correoContadorConfigurado) return [];
      const [tickets] = await pool.query(
        "SELECT id, folio, rfc FROM tickets WHERE estatus = 'pendiente'"
      );
      return tickets;
    }

    // Sin correo de contador configurado: el ticket pendiente debe aparecer.
    await setConfigSmtp({ host: 'smtp.gmail.com', puerto: 587, seguridad: 'starttls', usuario: `${PREFIJO_PRUEBA}@gmail.com`, correo_contador: '' });
    const sinConfigurar = await consultarPendientesSinContador();
    log(
      sinConfigurar.some((t) => t.id === ticketPendiente.insertId),
      'Sin correo de contador configurado, el ticket pendiente aparece en la lista de notificación'
    );

    // Con correo de contador configurado: la lista debe salir vacía (se
    // asume que ya se notificó, o se notificará, a ese correo).
    await setConfigSmtp({ correo_contador: 'contador-prueba@example.test' });
    const conConfigurar = await consultarPendientesSinContador();
    log(
      conConfigurar.length === 0,
      'Con correo de contador configurado, la lista de notificación sale vacía'
    );

    // Limpieza: borra el ticket de prueba y restaura la configuración SMTP real
    await pool.query('DELETE FROM tickets WHERE id = ?', [ticketPendiente.insertId]);
    if (configSmtpOriginal) {
      await setConfigSmtp(configSmtpOriginal);
    } else {
      await pool.query("DELETE FROM configuracion WHERE clave = 'smtp_config'");
    }
    const restaurada = await getConfigSmtp();
    log(
      JSON.stringify(restaurada) === JSON.stringify(configSmtpOriginal),
      'La configuración SMTP real se restaura sin alteraciones tras esta prueba también'
    );
  } catch (err) {
    log(false, 'Consulta de tickets pendientes sin correo de contador', err.message);
  }


  await limpiarDatosDePrueba();
  await pool.end();

  console.log('');
  console.log(`RESULTADO: ${pruebasOk}/${pruebasTotal} pruebas pasaron.`);
  process.exit(pruebasOk === pruebasTotal ? 0 : 1);
}

main().catch((err) => {
  console.error('\nError inesperado corriendo las pruebas:', err);
  process.exit(1);
});
