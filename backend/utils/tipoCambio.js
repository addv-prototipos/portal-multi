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

const SERIE_USD_MXN = 'SF43718';
const URL_DATOS = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${SERIE_USD_MXN}/datos/oportuno`;
const TIMEOUT_MS = 5000;

let cache = { fecha: null, valor: null };

function hoyLocal() {
  return new Date().toISOString().slice(0, 10);
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
    const respuesta = await fetch(`${URL_DATOS}?token=${encodeURIComponent(token)}`, {
      signal: controlador.signal,
      headers: { Accept: 'application/json' },
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
