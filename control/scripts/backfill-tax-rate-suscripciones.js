// Backfill de IVA (16%) en las Subscription Items de Stripe ya
// existentes — punto 516. El Tax Rate real que agrega el 16% solo se
// aplica a Subscription Items NUEVOS (checkout de onboarding/reactivación,
// upscale nuevo, cambio de plan) desde el día en que se implementó ese
// punto. Cualquier tenant con una suscripción YA ACTIVA de antes sigue
// renovando SIN IVA para siempre — Stripe no re-deriva el tax_rate de un
// item en cada renovación, lo conserva tal cual quedó — hasta que algo
// (este script, o un cambio de plan futuro) se lo agregue explícito.
//
// Seguro de correr en cualquier momento: `subscriptionItems.update(id,
// {tax_rates:[...]})` SIN `price_data` no dispara ninguna proración ni
// cobro inmediato — confirmado real contra Stripe test mode antes de
// escribir este script (ver PROJECT_STATE.md punto 516, addendum). Solo
// cambia qué IVA se calculará en la SIGUIENTE factura (renovación o
// próximo cambio), nunca re-factura lo ya cobrado.
//
// Idempotente: salta cualquier item que YA tenga el Tax Rate correcto
// (de re-correrlo, no hace nada en los tenants ya migrados).
//
// Uso (dry-run por default, igual que los demás scripts de esta carpeta):
//   docker exec clrv-control node scripts/backfill-tax-rate-suscripciones.js
//   docker exec clrv-control node scripts/backfill-tax-rate-suscripciones.js --confirmar
//
// Corre con las mismas env vars que ya tiene el contenedor de control
// (CONTROL_DB_*, STRIPE_SECRET_KEY[_LIVE], stripe_modo_cobro en
// ajustes_globales) — reusa el código real de la app
// (obtenerStripe/obtenerTaxRateIva), nunca reimplementa la resolución de
// la llave de Stripe ni el cálculo del Tax Rate en este archivo.

const CONFIRMAR = process.argv.includes('--confirmar');

const { obtenerPool } = require('../db');
const { obtenerStripe, obtenerTaxRateIva } = require('../utils/stripePagos');
const { modoActivo } = require('../utils/stripeModo');

async function main() {
  const db = obtenerPool();
  const modo = await modoActivo();
  const stripe = await obtenerStripe();
  const taxRateId = await obtenerTaxRateIva(stripe);

  console.log(`Modo activo: ${modo} — Tax Rate real: ${taxRateId}`);
  console.log(CONFIRMAR ? 'Modo: ESCRITURA (--confirmar)' : 'Modo: DRY-RUN (sin --confirmar, no se escribe nada)');
  console.log('');

  const [tenants] = await db.query(
    `SELECT id, slug, stripe_subscription_id FROM tenants WHERE stripe_subscription_id IS NOT NULL`
  );

  let totalTenants = 0;
  let totalItems = 0;
  let itemsActualizados = 0;
  let itemsYaCorrectos = 0;
  let tenantsConError = 0;

  for (const tenant of tenants) {
    totalTenants += 1;
    let items;
    try {
      const lista = await stripe.subscriptionItems.list({ subscription: tenant.stripe_subscription_id, limit: 100 });
      items = lista.data;
    } catch (err) {
      tenantsConError += 1;
      console.error(`[${tenant.slug}] no se pudo leer la suscripción ${tenant.stripe_subscription_id}: ${err.message}`);
      continue;
    }

    for (const item of items) {
      totalItems += 1;
      const yaTieneTaxRate = Array.isArray(item.tax_rates) && item.tax_rates.some((t) => t.id === taxRateId);
      const descripcion = item.price?.nickname || item.price?.product || item.id;
      if (yaTieneTaxRate) {
        itemsYaCorrectos += 1;
        continue;
      }
      console.log(`[${tenant.slug}] item ${item.id} (${descripcion}) sin IVA — ${CONFIRMAR ? 'actualizando' : 'se actualizaría'}`);
      if (CONFIRMAR) {
        try {
          await stripe.subscriptionItems.update(item.id, { tax_rates: [taxRateId] });
          itemsActualizados += 1;
        } catch (err) {
          console.error(`  error actualizando ${item.id}: ${err.message}`);
        }
      } else {
        itemsActualizados += 1; // contado como "se habría actualizado"
      }
    }
  }

  console.log('');
  console.log(`Tenants con suscripción real: ${totalTenants} (${tenantsConError} con error de lectura)`);
  console.log(`Subscription Items revisados: ${totalItems}`);
  console.log(`Ya tenían el Tax Rate correcto: ${itemsYaCorrectos}`);
  console.log(`${CONFIRMAR ? 'Actualizados' : 'Se actualizarían'}: ${itemsActualizados}`);
  if (!CONFIRMAR && itemsActualizados > 0) {
    console.log('');
    console.log('Vuelve a correr con --confirmar para aplicar de verdad.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
