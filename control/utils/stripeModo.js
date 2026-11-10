// Modo de cobro de Stripe — prueba (default seguro) o producción (cobros
// reales). Un solo flag de PLATAFORMA (ajustes_globales, clave
// `stripe_modo_cobro`), nunca por tenant: el checkout del onboarding
// siempre cobra a la cuenta de Stripe de Clarvo, no a la de cada cliente.
//
// Las llaves siguen viviendo en `.env`, sin tocar las que ya funcionan:
//   - STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY -> modo prueba (las de
//     siempre, cero migración).
//   - STRIPE_SECRET_KEY_LIVE / STRIPE_PUBLISHABLE_KEY_LIVE -> modo
//     producción (nuevas, las agrega el operador cuando Stripe activa su
//     cuenta real). Sin configurar, no se puede pasar a producción.
//
// Este módulo solo decide cuál par leer — nunca las guarda, nunca las
// expone completas (ver ultimos4()).

const { getValorTexto, setValorTexto } = require('./ajustesGlobales');

const CLAVE_MODO = 'stripe_modo_cobro';
const MODOS_VALIDOS = ['prueba', 'produccion'];

function credencialesPara(modo) {
  if (modo === 'produccion') {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY_LIVE || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY_LIVE || '',
    };
  }
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  };
}

async function modoActivo() {
  const valor = await getValorTexto(CLAVE_MODO);
  return valor === 'produccion' ? 'produccion' : 'prueba';
}

async function obtenerCredencialesActivas() {
  const modo = await modoActivo();
  return { modo, ...credencialesPara(modo) };
}

function ultimos4(secretKey) {
  if (!secretKey || secretKey.length < 4) return null;
  return secretKey.slice(-4);
}

// Estado para la UI de /control — nunca expone la llave completa, solo
// los últimos 4 caracteres (igual de informativo para confirmar "cuál
// llave está activa" sin poder reconstruir el secreto).
async function estado() {
  const modo = await modoActivo();
  const activa = credencialesPara(modo);
  const live = credencialesPara('produccion');
  return {
    modo,
    llaveActivaUltimos4: ultimos4(activa.secretKey),
    liveConfigurado: Boolean(live.secretKey && live.publishableKey),
  };
}

async function cambiarModo(nuevoModo) {
  if (!MODOS_VALIDOS.includes(nuevoModo)) {
    const err = new Error('Modo inválido — debe ser "prueba" o "produccion".');
    err.codigo = 'modo_invalido';
    throw err;
  }
  if (nuevoModo === 'produccion') {
    const { secretKey, publishableKey } = credencialesPara('produccion');
    if (!secretKey || !publishableKey) {
      const err = new Error(
        'Configura STRIPE_SECRET_KEY_LIVE y STRIPE_PUBLISHABLE_KEY_LIVE en el servidor antes de activar producción.'
      );
      err.codigo = 'live_no_configurado';
      throw err;
    }
  }
  await setValorTexto(CLAVE_MODO, nuevoModo);
  return nuevoModo;
}

module.exports = {
  CLAVE_MODO,
  MODOS_VALIDOS,
  credencialesPara,
  modoActivo,
  obtenerCredencialesActivas,
  estado,
  cambiarModo,
};
