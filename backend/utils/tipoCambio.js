// §57: tipo de cambio USD/MXN para productos en moneda extranjera. Fuente:
// Banxico SIE API (serie SF43718, USD/MXN FIX), publica 1 valor por día
// hábil — se cachea en memoria por fecha para no golpear el servicio en
// cada alta/entrada (mismo valor para todos los tenants, es un dato
// público, sin necesidad de cache por tenant).
//
// Degradación explícita, nunca silenciosa (decisión cerrada del segmento):
// sin BANXICO_TOKEN configurado, con el servicio caído, o sin dato
// publicado todavía hoy, `obtenerTipoCambioUSD()` regresa `valor: null` (o
// el último valor conocido, marcado como "caducado") y el llamador debe
// permitir captura manual — nunca bloquea el alta/entrada.

const { fechaLocalZona, cadenaFecha } = require('./limitesPeriodo');

const SERIE_USD_MXN = 'SF43718';
const URL_DATOS = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${SERIE_USD_MXN}/datos/oportuno`;
const TIMEOUT_MS = 5000;

let cache = { fecha: null, valor: null };

// Hallazgo m-03 (sonar_1.1.html, 2026-10-19): `toISOString().slice(0,10)`
// es la fecha UTC, no la de México — tras las 18:00 hora de CDMX (UTC-6)
// ya es "mañana" en UTC, así que el caché se invalidaba un día antes de
// tiempo y el valor del día se pedía de nuevo a Banxico sin necesidad.
// Esta fecha NO depende del tenant que consulta: Banxico publica 1 valor
// por día hábil en hora de Ciudad de México (zona de publicación real de
// la serie), así que siempre es America/Mexico_City, nunca la zona del
// tenant — es la misma lección del punto 371, aplicada a una fuente
// externa en vez de a datos propios del tenant.
function hoyLocal() {
  const partes = fechaLocalZona('America/Mexico_City');
  return cadenaFecha(partes.anio, partes.mes, partes.dia);
}

// Consulta el tipo de cambio del día. Nunca lanza — cualquier falla
// (sin token, red caída, respuesta inesperada, serie sin dato publicado
// todavía) se traduce a `fuente` para que el llamador decida cómo
// degradar, en vez de que el error se propague hasta la petición HTTP.
async function obtenerTipoCambioUSD() {
  const token = process.env.BANXICO_TOKEN;
  if (!token) {
    return { valor: null, fecha: null, fuente: 'manual_requerido' };
  }

  const hoy = hoyLocal();
  if (cache.fecha === hoy && cache.valor !== null) {
    return { valor: cache.valor, fecha: cache.fecha, fuente: 'banxico' };
  }

  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    // Hallazgo m-03 (sonar_1.1.html, 2026-10-19): el token en query string
    // queda grabado en logs de proxy/nginx/acceso — la API de Banxico
    // SIE acepta el mismo token por header (`Bmx-Token`), que los logs de
    // acceso estándar no registran.
    const respuesta = await fetch(URL_DATOS, {
      signal: controlador.signal,
      headers: { Accept: 'application/json', 'Bmx-Token': token },
    });
    if (!respuesta.ok) {
      throw new Error(`Banxico respondió ${respuesta.status}`);
    }
    const cuerpo = await respuesta.json();
    const serie = cuerpo && cuerpo.bmx && Array.isArray(cuerpo.bmx.series) ? cuerpo.bmx.series[0] : null;
    const dato = serie && Array.isArray(serie.datos) ? serie.datos[0] : null;
    const valor = dato ? Number(dato.dato) : NaN;
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('Banxico no tiene un dato publicado todavía.');
    }
    cache = { fecha: hoy, valor };
    return { valor, fecha: hoy, fuente: 'banxico' };
  } catch (_err) {
    if (cache.valor !== null) {
      return { valor: cache.valor, fecha: cache.fecha, fuente: 'banxico_caducado' };
    }
    return { valor: null, fecha: null, fuente: 'manual_requerido' };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Solo para pruebas: el caché en memoria persiste entre llamadas dentro
// del mismo proceso, lo que rompería la aislación de tests si no se
// pudiera limpiar entre casos.
function _resetCacheParaPruebas() {
  cache = { fecha: null, valor: null };
}

module.exports = { obtenerTipoCambioUSD, _resetCacheParaPruebas };
