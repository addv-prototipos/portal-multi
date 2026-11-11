// Evalúa el % de capacidad de disco comprometida (ver discoCapacidad.js)
// contra el umbral y, si corresponde, dispara el correo de alerta.
// Histéresis (DISCO_ALERTA_UMBRAL_PCT=80 / DISCO_ALERTA_HISTERESIS_PCT=70,
// ver ajustesGlobales.js): el correo se manda UNA VEZ al cruzar hacia
// arriba del 80%, no se repite mientras siga por encima de 70% — evita
// mandar un correo nuevo en cada recálculo mientras la situación no
// cambia de verdad. Si no hay correo configurado, el semáforo (calculado
// en discoCapacidad.js, consumido por el frontend) sigue siendo la señal
// real — este archivo solo decide si TAMBIÉN se manda un correo.
//
// Fire-and-forget en todos los call sites (mismo criterio que
// notificarInvalidacionCache): un fallo al evaluar o enviar la alerta
// nunca debe tumbar el guardado de un tenant ni el scheduler.

const { calcularResumenCapacidad, obtenerEstadoAlerta } = require('./discoCapacidad');
const { setDiscoAlertaEstado, DISCO_ALERTA_UMBRAL_PCT, DISCO_ALERTA_HISTERESIS_PCT } = require('./ajustesGlobales');
const { enviarCorreoBase } = require('./notificarBackend');

async function evaluarYEnviarAlertaCapacidadDisco() {
  const resumen = await calcularResumenCapacidad();
  if (resumen.porcentaje === null) {
    return { evaluado: false, motivo: 'sin_capacidad_configurada' };
  }

  const { alertaEmail, alertaEstado } = await obtenerEstadoAlerta();

  if (resumen.porcentaje >= DISCO_ALERTA_UMBRAL_PCT && alertaEstado !== 'alertado') {
    let alertaEnviada = false;
    if (alertaEmail) {
      try {
        // Homologado al diseño del ticket de venta (auditoría de correos
        // de salida, punto en curso): antes salía en texto plano sin logo
        // ni marca — aviso interno al operador, pero mismo criterio de
        // consistencia de marca que el resto de los correos del sitio.
        await enviarCorreoBase({
          destinatario: alertaEmail,
          asunto: `Clarvo — capacidad de disco al ${resumen.porcentaje}%`,
          eyebrow: 'Alerta operativa',
          titulo: `Capacidad de disco al ${resumen.porcentaje}%`,
          parrafos: [
            `La capacidad de disco comprometida entre todos los tenants llegó al ${resumen.porcentaje}% (${resumen.comprometidoMb.toLocaleString('es-MX')} MB de ${resumen.capacidadTotalMb.toLocaleString('es-MX')} MB configurados).`,
            `Disponible para seguir asignando: ${resumen.disponibleMb.toLocaleString('es-MX')} MB.`,
            'Revisa /control → Seguridad y sistema → Super Admins → Capacidad de disco.',
          ],
        });
        alertaEnviada = true;
      } catch (err) {
        console.error('No se pudo enviar el correo de alerta de capacidad de disco:', err.message);
      }
    }
    await setDiscoAlertaEstado('alertado', new Date());
    return { evaluado: true, alertaEnviada, ...resumen };
  }

  if (resumen.porcentaje < DISCO_ALERTA_HISTERESIS_PCT && alertaEstado === 'alertado') {
    await setDiscoAlertaEstado('ok');
  }

  return { evaluado: true, alertaEnviada: false, ...resumen };
}

module.exports = { evaluarYEnviarAlertaCapacidadDisco };
