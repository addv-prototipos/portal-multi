// Regresión del bug de zona horaria en las tarjetas KPI de Inicio
// (Ventas hoy / Movs. de inventario): la ventana "hoy" estaba anclada a
// medianoche UTC, así que todo lo ocurrido a partir de las 18:00 hora
// local (México = UTC−6) quedaba FUERA del día y las tarjetas no se
// actualizaban tras un alta real.
//
// Flujo: lee las tarjetas, registra una venta con producto de inventario
// (eso también genera un movimiento de kardex), registra una entrada de
// inventario y vuelve a leer — exige que los totales suban.
import { test, expect } from '@playwright/test';

async function leerTarjetas(page) {
  return page.evaluate(() => ({
    tickets: (document.getElementById('inicio-kpi-tickets-numero') || {}).textContent,
    ventas: (document.getElementById('inicio-kpi-ventas-numero') || {}).textContent,
    gastos: (document.getElementById('inicio-kpi-gastos-numero') || {}).textContent,
    inventario: (document.getElementById('inicio-kpi-inventario-numero') || {}).textContent,
  }));
}

async function apiResumen(request) {
  const basic = 'Basic ' + Buffer.from('admin:admin').toString('base64');
  const r = await request.get('/api/admin/inicio/resumen', { headers: { Authorization: basic } });
  const j = await r.json();
  return {
    ventas: j.ventas && j.ventas.hoy,
    gastos: j.gastos && j.gastos.hoy,
    inventario: j.inventario && j.inventario.hoy,
    tickets: j.tickets && j.tickets.hoy,
    ultimaVenta: j.ventas && j.ventas.recientes && j.ventas.recientes[0],
    ultimoMov: j.inventario && j.inventario.recientes && j.inventario.recientes[0],
  };
}

async function cerrarAvisos(page) {
  const saltar = page.locator('#btn-onboarding-tour-saltar');
  if (await saltar.isVisible().catch(() => false)) await saltar.click();
  const cerrar = page.locator('#btn-notif-tickets-cerrar');
  if (await cerrar.isVisible().catch(() => false)) await cerrar.click();
}

// Recarga completa: garantiza que Inicio vuelva a pedir
// /api/admin/inicio/resumen en lugar de reusar lo que ya tenía en pantalla.
async function abrirInicio(page) {
  await page.goto('/admin');
  if (await page.locator('#admin-user').isVisible().catch(() => false)) {
    await page.fill('#admin-user', 'admin');
    await page.fill('#admin-pass', 'admin');
    await page.click('#btn-login');
  }
  await expect(page.locator('#inicio-kpi-ventas')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(900);
  await cerrarAvisos(page);
}

async function irAVista(page, id: string) {
  const btn = page.locator('#' + id);
  const grupo = page.locator('.admin-sidebar-group-header');
  for (let i = 0; i < 6 && !(await btn.isVisible().catch(() => false)); i++) {
    const n = await grupo.count();
    let abrio = false;
    for (let g = 0; g < n; g++) {
      const h = grupo.nth(g);
      if ((await h.getAttribute('aria-expanded').catch(() => null)) === 'false') {
        await h.evaluate((el) => (el as HTMLElement).click());
        await page.waitForTimeout(250);
        abrio = true;
      }
      if (await btn.isVisible().catch(() => false)) break;
    }
    if (!abrio) break;
  }
  await expect(btn).toBeVisible({ timeout: 10000 });
  // click() por coordenadas choca con el scroll del sidebar en este
  // viewport; se dispara el handler directamente sobre el elemento.
  await btn.evaluate((el) => (el as HTMLElement).click());
  await page.waitForTimeout(600);
}

test('Inicio: las tarjetas suben tras registrar una venta y un movimiento', async ({ page, request }) => {
  test.setTimeout(240000);
  const etapa = (n: string) => `INICIO-KPI[${n}]`;

  await abrirInicio(page);

  const apiAntes = await apiResumen(request);
  const antes = await leerTarjetas(page);
  console.log(`${etapa('antes')} tarjetas=${JSON.stringify(antes)} api=${JSON.stringify(apiAntes)}`);
  await page.locator('#inicio-resumen-kpis').screenshot({ path: 'capturas/inicio-actualiza-1-antes.png' });

  // Venta con producto de inventario: descuenta existencia y genera el
  // movimiento de kardex, o sea que debe mover DOS tarjetas a la vez.
  await page.click('#btn-header-registrar-venta');
  await page.waitForSelector('#orden-registrar-modal-overlay:not([hidden])', { timeout: 8000 });
  await page.fill('#orden-inventario-buscar', 'Toner');
  await page.waitForSelector('#orden-inventario-sugerencias .orden-inventario-sugerencia', { timeout: 10000 });
  await page.locator('#orden-inventario-sugerencias .orden-inventario-sugerencia').first().click();
  await page.waitForSelector('#orden-inventario-seleccionado:not([hidden])', { timeout: 5000 });
  if (!(await page.inputValue('#orden-inventario-precio'))) await page.fill('#orden-inventario-precio', '999');
  await page.fill('#orden-inventario-unidades', '1');
  await page.click('#btn-agregar-producto-inventario-orden');
  await page.waitForSelector('#orden-productos-lista-wrap:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.click('#btn-registrar-orden');
  await expect(page.locator('#orden-form-exito')).toBeVisible({ timeout: 8000 });
  console.log(`${etapa('venta')} registrada: ${JSON.stringify(apiAntes.ultimaVenta)}`);
  await page.waitForTimeout(2000);
  await page.click('#btn-cerrar-orden-modal');
  await page.waitForFunction(() => document.getElementById('orden-registrar-modal-overlay').hidden, null, { timeout: 8000 });

  await abrirInicio(page);
  const apiVenta = await apiResumen(request);
  const despuesVenta = await leerTarjetas(page);
  console.log(`${etapa('despues-venta')} tarjetas=${JSON.stringify(despuesVenta)} api=${JSON.stringify(apiVenta)}`);
  await page.locator('#inicio-resumen-kpis').screenshot({ path: 'capturas/inicio-actualiza-2-despues-venta.png' });

  expect(apiVenta.ultimaVenta.numeroCompra).not.toBe(apiAntes.ultimaVenta.numeroCompra);
  expect(apiVenta.ventas.total).toBeGreaterThan(apiAntes.ventas.total);
  expect(apiVenta.ventas.count).toBeGreaterThan(apiAntes.ventas.count);
  expect(apiVenta.inventario.total).toBeGreaterThan(apiAntes.inventario.total);

  // Entrada manual de inventario: solo debe mover la tarjeta de movimientos.
  await irAVista(page, 'btn-vista-inventarios');
  await expect(page.locator('#inv-table-body')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const btnMov = page.locator('button[data-tooltip="Registrar entrada"]').first();
  await expect(btnMov).toBeVisible({ timeout: 15000 });
  await btnMov.click();
  await page.waitForSelector('#inv-movimiento-modal-overlay:not([hidden])', { timeout: 8000 });
  await page.waitForFunction(() => document.querySelectorAll('#inv-mov-tipo option').length > 0, null, { timeout: 5000 });
  await page.selectOption('#inv-mov-tipo', { index: 0 });
  await page.fill('#inv-mov-cantidad', '3');
  await page.fill('#inv-mov-motivo', 'Regresión tarjetas de Inicio');
  await page.click('#btn-inv-mov-guardar');
  await page.waitForFunction(() => document.getElementById('inv-movimiento-modal-overlay').hidden, null, { timeout: 8000 });
  await page.waitForTimeout(800);

  await abrirInicio(page);
  const apiMov = await apiResumen(request);
  const despuesMov = await leerTarjetas(page);
  console.log(`${etapa('despues-mov')} tarjetas=${JSON.stringify(despuesMov)} api=${JSON.stringify(apiMov)}`);
  await page.locator('#inicio-resumen-kpis').screenshot({ path: 'capturas/inicio-actualiza-3-despues-mov.png' });

  expect(apiMov.inventario.total).toBeGreaterThan(apiVenta.inventario.total);
  expect(apiMov.inventario.entradas).toBeGreaterThan(apiVenta.inventario.entradas);
  // Los gastos no cambian en este flujo: la tarjeta no debe moverse.
  expect(apiMov.gastos.total).toBe(apiAntes.gastos.total);
});
