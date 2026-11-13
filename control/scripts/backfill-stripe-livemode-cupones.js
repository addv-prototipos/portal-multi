// Backfill de stripe_livemode en onboarding_borradores — punto en curso
// (cupones prueba vs producción). Clasifica contra Stripe REAL (nunca a
// ojo, nunca por formato del id) cada fila vieja que ya tiene
// stripe_promotion_code pero no tiene stripe_livemode (columna agregada
// después de que esas filas ya existieran).
//
// Método: por cada promotion_code id, intentar resolverlo primero con la
// llave LIVE (producción) y, si no existe ahí, con la llave de PRUEBA —
// Stripe separa los namespaces de id por modo, así que un id solo resuelve
// con la llave del modo en el que de verdad se creó/usó. Sin dependencias
// nuevas: usa el mismo paquete `stripe` ya instalado en control/.
//
// Uso (mismo patrón que los scripts de backend/scripts/ — dry-run por
// default, solo escribe con --confirmar):
//   node control/scripts/backfill-stripe-livemode-cupones.js
//   node control/scripts/backfill-stripe-livemode-cupones.js --confirmar
//
// Variables de entorno requeridas (las mismas que usa control/db.js):
//   CONTROL_DB_HOST, CONTROL_DB_PORT, CONTROL_DB_USER, CONTROL_DB_PASSWORD,
//   CONTROL_DB_NAME
// Y las llaves de Stripe de ambos modos:
//   STRIPE_SECRET_KEY (prueba), STRIPE_SECRET_KEY_LIVE (producción)

const mysql = require('mysql2/promise');
const Stripe = require('stripe');

const CONFIRMAR = process.argv.includes('--confirmar');

async function obtenerPool() {
  return mysql.createPool({
    host: process.env.CONTROL_DB_HOST || 'mysql',
    port: Number(process.env.CONTROL_DB_PORT || 3306),
    user: process.env.CONTROL_DB_USER || 'control_app',
    password: process.env.CONTROL_DB_PASSWORD || '',
    database: process.env.CONTROL_DB_NAME || 'control_tenants',
    connectionLimit: 3,
    dateStrings: true,
  });
}

// Devuelve 1 (vive en LIVE), 0 (vive en PRUEBA), o null (no se encontró
// en ninguna de las 2 — cupón borrado hace tiempo en ambos modos, por
// ejemplo; se deja sin clasificar, nunca se inventa un valor).
async function clasificar(promotionCodeId, stripeLive, stripeTest) {
  try {
    await stripeLive.promotionCodes.retrieve(promotionCodeId);
    return 1;
  } catch (errLive) {
    if (errLive.code !== 'resource_missing') {
      console.error(`  aviso: error inesperado consultando LIVE para ${promotionCodeId}: ${errLive.message}`);
    }
  }
  try {
    await stripeTest.promotionCodes.retrieve(promotionCodeId);
    return 0;
  } catch (errTest) {
    if (errTest.code !== 'resource_missing') {
      console.error(`  aviso: error inesperado consultando PRUEBA para ${promotionCodeId}: ${errTest.message}`);
    }
  }
  return null;
}

async function main() {
  const liveKey = process.env.STRIPE_SECRET_KEY_LIVE || '';
  const testKey = process.env.STRIPE_SECRET_KEY || '';
  if (!liveKey || !testKey) {
    console.error('Faltan STRIPE_SECRET_KEY y/o STRIPE_SECRET_KEY_LIVE en el entorno — no se puede clasificar nada.');
    process.exit(1);
  }
  const stripeLive = new Stripe(liveKey);
  const stripeTest = new Stripe(testKey);

  const db = await obtenerPool();
  const [filas] = await db.query(
    `SELECT id, token, stripe_promotion_code
       FROM onboarding_borradores
      WHERE stripe_promotion_code IS NOT NULL AND stripe_livemode IS NULL`
  );

  console.log(`${filas.length} fila(s) con stripe_promotion_code sin clasificar.`);
  if (!CONFIRMAR) console.log('Modo dry-run (sin --confirmar) — no se escribe nada.\n');

  let countLive = 0;
  let countPrueba = 0;
  let countSinClasificar = 0;

  for (const fila of filas) {
    const modo = await clasificar(fila.stripe_promotion_code, stripeLive, stripeTest);
    if (modo === 1) {
      countLive++;
      console.log(`id=${fila.id} token=${fila.token} code=${fila.stripe_promotion_code} -> LIVE (producción, se conserva)`);
    } else if (modo === 0) {
      countPrueba++;
      console.log(`id=${fila.id} token=${fila.token} code=${fila.stripe_promotion_code} -> PRUEBA (se excluye del reporte)`);
    } else {
      countSinClasificar++;
      console.log(`id=${fila.id} token=${fila.token} code=${fila.stripe_promotion_code} -> SIN CLASIFICAR (no existe en ningún modo, se deja NULL)`);
      continue;
    }
    if (CONFIRMAR) {
      await db.query('UPDATE onboarding_borradores SET stripe_livemode = ? WHERE id = ?', [modo, fila.id]);
    }
  }

  console.log(`\nResumen: ${countLive} en LIVE, ${countPrueba} en PRUEBA, ${countSinClasificar} sin clasificar.`);
  if (!CONFIRMAR && filas.length > 0) {
    console.log('Vuelve a correr con --confirmar para aplicar los cambios.');
  }
  await db.end();
}

main().catch((err) => {
  console.error('Fallo el backfill:', err);
  process.exit(1);
});
