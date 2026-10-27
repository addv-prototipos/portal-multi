// Recordatorios de activación — para borradores que quedaron con un pago
// pendiente u fallido (nunca para los que ya se convirtieron en tenant).
// Config global vía ajustes_globales (mismo patrón que ajustesGlobales.js,
// punto 370): frecuencia, tope de intentos, y el ángulo de neuroventas del
// correo (ver propuesta ya aprobada — 4 ángulos). Caso especial, decisión
// ya confirmada en el flujo "cobrar primero": OXXO/SPEI SIEMPRE se
// recuerda cada 24h, sin importar la frecuencia global configurada —
// esos métodos expiran rápido (la ficha OXXO vence a los 3 días, ver
// DOCS/confStripe.html paso 8), no tiene sentido esperar una semana.

const { obtenerPool } = require('../db');
const { enviarCorreoBase } = require('./notificarBackend');

const CLAVE_FRECUENCIA_HORAS = 'recordatorio_frecuencia_horas';
const CLAVE_MAX_INTENTOS = 'recordatorio_max_intentos';
const CLAVE_ANGULO = 'recordatorio_angulo';

const FRECUENCIAS_VALIDAS = [24, 72, 168];
const MAX_INTENTOS_VALIDOS = [3, 5, 10];
const ANGULOS_VALIDOS = ['compromiso', 'perdida', 'social'];
const ANGULO_DEFAULT = 'compromiso';
const FRECUENCIA_OXXO_SPEI_HORAS = 24;

async function getConfigRecordatorios(db = obtenerPool()) {
  const [filas] = await db.query(
    'SELECT clave, valor FROM ajustes_globales WHERE clave IN (?, ?, ?)',
    [CLAVE_FRECUENCIA_HORAS, CLAVE_MAX_INTENTOS, CLAVE_ANGULO]
  );
  const porClave = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  const frecuenciaHoras = FRECUENCIAS_VALIDAS.includes(Number(porClave[CLAVE_FRECUENCIA_HORAS])) ? Number(porClave[CLAVE_FRECUENCIA_HORAS]) : 72;
  const maxIntentos = MAX_INTENTOS_VALIDOS.includes(Number(porClave[CLAVE_MAX_INTENTOS])) ? Number(porClave[CLAVE_MAX_INTENTOS]) : 5;
  const angulo = ANGULOS_VALIDOS.includes(porClave[CLAVE_ANGULO]) ? porClave[CLAVE_ANGULO] : ANGULO_DEFAULT;
  return { frecuenciaHoras, maxIntentos, angulo };
}

async function setConfigRecordatorios({ frecuenciaHoras, maxIntentos, angulo }, db = obtenerPool()) {
  if (!FRECUENCIAS_VALIDAS.includes(Number(frecuenciaHoras))) {
    const err = new Error('Frecuencia inválida.');
    err.codigo = 'validacion';
    throw err;
  }
  if (!MAX_INTENTOS_VALIDOS.includes(Number(maxIntentos))) {
    const err = new Error('Tope de intentos inválido.');
    err.codigo = 'validacion';
    throw err;
  }
  if (!ANGULOS_VALIDOS.includes(angulo)) {
    const err = new Error('Ángulo de mensaje inválido.');
    err.codigo = 'validacion';
    throw err;
  }
  await db.query(
    `INSERT INTO ajustes_globales (clave, valor) VALUES (?, ?), (?, ?), (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [CLAVE_FRECUENCIA_HORAS, String(frecuenciaHoras), CLAVE_MAX_INTENTOS, String(maxIntentos), CLAVE_ANGULO, angulo]
  );
  return { frecuenciaHoras: Number(frecuenciaHoras), maxIntentos: Number(maxIntentos), angulo };
}

async function listarEnSeguimiento(db = obtenerPool()) {
  const [filas] = await db.query(
    `SELECT token, nombre_empresa, plan_clave, pago_estado, metodo_pago, ultimo_recordatorio_en, intentos_recordatorio, creado_en
       FROM onboarding_borradores
      WHERE estado = 'activo' AND pago_estado IN ('pendiente','fallido')
      ORDER BY creado_en DESC`
  );
  return filas;
}

function asuntoYCuerpo(angulo, { nombreEmpresa, metodoPago, destinoCorreo }) {
  const metodoTxt = metodoPago === 'oxxo' ? 'tu ficha OXXO' : metodoPago === 'spei' ? 'tu SPEI' : 'tu pago';
  const empresa = nombreEmpresa || 'tu negocio';
  if (angulo === 'perdida') {
    return {
      asunto: 'Tu URL en Clarvo está a punto de liberarse',
      cuerpo: `Hola,\n\nConfiguramos "${empresa}" en Clarvo, pero ${metodoTxt} sigue sin confirmarse. Tu URL se reserva solo unos días más — después queda disponible para alguien más.\n\nCompleta tu pago para no perder tu progreso.\n\n— Clarvo`,
    };
  }
  if (angulo === 'social') {
    return {
      asunto: 'Negocios como el tuyo ya operan en Clarvo',
      cuerpo: `Hola,\n\n+500 negocios ya facturan y controlan sus ventas con Clarvo. "${empresa}" ya está lista — solo falta confirmar ${metodoTxt} para unirte.\n\nProcesado de forma segura por Stripe.\n\n— Clarvo`,
    };
  }
  // 'compromiso' (default)
  return {
    asunto: 'Tu cuenta Clarvo está a un paso de activarse',
    cuerpo: `Hola,\n\n"${empresa}" ya está configurada por completo en Clarvo — empresa, administrador, todo listo. Solo falta confirmar ${metodoTxt}.\n\nTermina lo que empezaste.\n\n— Clarvo`,
  };
}

// Corre periódicamente (ver iniciarRecordatoriosAutomaticos en server.js).
// Nunca lanza — un fallo en un borrador no debe tumbar el resto del
// barrido ni el proceso.
async function procesarRecordatoriosPendientes(db = obtenerPool()) {
  const config = await getConfigRecordatorios(db);
  const candidatos = await listarEnSeguimiento(db);
  let enviados = 0;
  let archivados = 0;

  for (const borrador of candidatos) {
    try {
      if (borrador.intentos_recordatorio >= config.maxIntentos) {
        await db.query(`UPDATE onboarding_borradores SET estado = 'abandonado', actualizado_en = ? WHERE token = ?`, [new Date(), borrador.token]);
        archivados++;
        continue;
      }

      const esOxxoSpei = borrador.metodo_pago === 'oxxo' || borrador.metodo_pago === 'spei';
      const frecuenciaEfectiva = esOxxoSpei ? FRECUENCIA_OXXO_SPEI_HORAS : config.frecuenciaHoras;
      const horasDesdeUltimo = borrador.ultimo_recordatorio_en
        ? (Date.now() - new Date(borrador.ultimo_recordatorio_en).getTime()) / 3600000
        : Infinity;
      if (horasDesdeUltimo < frecuenciaEfectiva) continue;

      const [[fila]] = await db.query('SELECT admin_email, contacto_email FROM onboarding_borradores WHERE token = ?', [borrador.token]);
      const destinoCorreo = fila.admin_email || fila.contacto_email;
      if (!destinoCorreo) continue;

      const { asunto, cuerpo } = asuntoYCuerpo(config.angulo, {
        nombreEmpresa: borrador.nombre_empresa,
        metodoPago: borrador.metodo_pago,
      });
      await enviarCorreoBase({ destinatario: destinoCorreo, asunto, cuerpo });

      await db.query(
        `UPDATE onboarding_borradores SET ultimo_recordatorio_en = ?, intentos_recordatorio = intentos_recordatorio + 1, actualizado_en = ? WHERE token = ?`,
        [new Date(), new Date(), borrador.token]
      );
      enviados++;
    } catch (err) {
      console.error(`No se pudo procesar el recordatorio del borrador "${borrador.token}":`, err.message);
    }
  }

  return { enviados, archivados, revisados: candidatos.length };
}

module.exports = {
  FRECUENCIAS_VALIDAS,
  MAX_INTENTOS_VALIDOS,
  ANGULOS_VALIDOS,
  getConfigRecordatorios,
  setConfigRecordatorios,
  listarEnSeguimiento,
  procesarRecordatoriosPendientes,
};
