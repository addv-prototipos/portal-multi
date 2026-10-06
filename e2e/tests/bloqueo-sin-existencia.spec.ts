// Pendiente de Ventas "Bloquear agregar producto sin existencia al
// buscar/escanear": hoy el producto se agrega al carrito y el aviso de
// "Existencia insuficiente" (modal ya existente, mostrarErrorRegistrarOrden)
// solo aparecía hasta dar clic en "Registrar venta". El fix valida el
// stock ANTES de insertar, tanto en la búsqueda manual ("+ Agregar
// producto") como en el escaneo de código de barras exacto.
//
// Flujo: crea un producto de prueba sin existencia (recién creado, sin
// fila en `existencias` -> disponible 0/null) con un código de barras
// único, luego ejercita ambas rutas de alta en el modal de "Registrar
// venta" y confirma que ninguna lo agrega al carrito.
import { test, expect } from '@playwright/test';

const sufijo = Date.now().toString().slice(-8);
const NOMBRE = `E2E Sin Existencia ${sufijo}`;
const SKU = `E2E-SE-${sufijo}`;
const BARRAS = `9${sufijo}0`;

async function login(page) {
  await page.goto('/admin');
  if (await page.locator('#admin-user').isVisible().catch(() => false)) {
    await page.fill('#admin-user', 'admin');
    await page.fill('#admin-pass', 'admin');
    await page.click('#btn-login');
  }
  await expect(page.locator('#admin-dashboard')).toBeVisible({ timeout: 15000 });
  const saltar = page.locator('#btn-onboarding-tour-saltar');
  if (await saltar.isVisible().catch(() => false)) await saltar.click();
  const cerrarNotif = page.locator('#btn-notif-tickets-cerrar');
  if (await cerrarNotif.isVisible().catch(() => false)) await cerrarNotif.click();
}

async function irAVista(page, id: string) {
  const btn = page.locator('#' + id);
  const grupo = page.locator('.admin-sidebar-group-header');
  for (let i = 0; i < 6 && !(await btn.isVisible().catch(() => false)); i++) {
    const n = await grupo.count();
    for (let g = 0; g < n; g++) {
      const h = grupo.nth(g);
      if ((await h.getAttribute('aria-expanded').catch(() => null)) === 'false') {
        await h.evaluate((el) => (el as HTMLElement).click());
        await page.waitForTimeout(200);
      }
      if (await btn.isVisible().catch(() => false)) break;
    }
  }
  await expect(btn).toBeVisible({ timeout: 10000 });
  await btn.evaluate((el) => (el as HTMLElement).click());
  await page.waitForTimeout(400);
}

test.describe.configure({ mode: 'serial' });

test('crea el producto de prueba sin existencia', async ({ page }) => {
  test.setTimeout(60000);
  await login(page);
  await irAVista(page, 'btn-vista-inventarios');
  await expect(page.locator('#inv-table-body')).toBeVisible({ timeout: 15000 });

  await page.click('#btn-nuevo-producto');
  await expect(page.locator('#inv-producto-modal-overlay')).toBeVisible();
  await page.fill('#inv-modal-nombre', NOMBRE);
  await page.fill('#inv-modal-sku', SKU);
  // El campo de código de barras puede venir colapsado tras "Opcional".
  const campoBarras = page.locator('#inv-modal-codigo-barras');
  if (!(await campoBarras.isVisible().catch(() => false))) {
    await page.click('#inv-modal-codigo-barras-field .inv-campo-colapsable-toggle, #inv-modal-codigo-barras-field button').catch(() => {});
  }
  await campoBarras.fill(BARRAS);
  await page.waitForFunction(() => (document.querySelectorAll('#inv-modal-unidad option').length) > 0, null, { timeout: 5000 });
  await page.selectOption('#inv-modal-unidad', { index: 0 });
  await page.fill('#inv-modal-precio', '199');
  await page.click('#btn-inv-modal-guardar');
  await expect(page.locator('#inv-producto-modal-overlay')).toBeHidden({ timeout: 10000 });
});

test('búsqueda manual: "+ Agregar producto" bloquea con el modal, no agrega al carrito', async ({ page }) => {
  test.setTimeout(60000);
  await login(page);

  await page.click('#btn-header-registrar-venta');
  await page.waitForSelector('#orden-registrar-modal-overlay:not([hidden])', { timeout: 8000 });

  await page.fill('#orden-inventario-buscar', NOMBRE);
  await page.waitForSelector('#orden-inventario-sugerencias .orden-inventario-sugerencia', { timeout: 10000 });
  await page.locator('#orden-inventario-sugerencias .orden-inventario-sugerencia').first().click();
  await expect(page.locator('#orden-inventario-seleccionado')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#orden-inventario-seleccionado')).toContainText('Disponible: 0');

  await page.click('#btn-agregar-producto-inventario-orden');

  await expect(page.locator('#orden-error-modal-overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#orden-error-modal-title')).toHaveText('Existencia insuficiente');
  await expect(page.locator('#orden-error-modal-producto')).toHaveText(NOMBRE);
  await expect(page.locator('#orden-error-modal-disponible')).toHaveText('0');
  await expect(page.locator('#orden-error-modal-solicitado')).toHaveText('1');
  await page.screenshot({ path: 'capturas/bloqueo-sin-existencia-1-busqueda-manual.png' });

  // NO se agregó al carrito — la lista de productos de la orden sigue vacía.
  const listaVisible = await page.locator('#orden-productos-lista-wrap').isVisible().catch(() => false);
  expect(listaVisible).toBe(false);

  await page.click('#btn-orden-error-modal-cerrar');
  await expect(page.locator('#orden-error-modal-overlay')).toBeHidden();
});

test('escaneo de código de barras exacto: bloquea igual, sin pasar por "+ Agregar producto"', async ({ page }) => {
  test.setTimeout(60000);
  await login(page);

  await page.click('#btn-header-registrar-venta');
  await page.waitForSelector('#orden-registrar-modal-overlay:not([hidden])', { timeout: 8000 });

  await page.fill('#orden-inventario-buscar', BARRAS);
  // El escaneo dispara la búsqueda en "input" (coincidencia exacta de
  // código de barras agrega/bloquea sola, sin necesitar Enter ni clic).
  await expect(page.locator('#orden-error-modal-overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#orden-error-modal-title')).toHaveText('Existencia insuficiente');
  await expect(page.locator('#orden-error-modal-disponible')).toHaveText('0');
  await expect(page.locator('#orden-error-modal-solicitado')).toHaveText('1');
  await page.screenshot({ path: 'capturas/bloqueo-sin-existencia-2-escaneo.png' });

  const listaVisible = await page.locator('#orden-productos-lista-wrap').isVisible().catch(() => false);
  expect(listaVisible).toBe(false);

  await page.click('#btn-orden-error-modal-cerrar');
});

test('limpieza: borra el producto de prueba', async ({ page, request }) => {
  await login(page);
  const authHeader = 'Basic ' + Buffer.from('admin:admin').toString('base64');
  const res = await request.get(`/api/admin/inventarios/productos/buscar?q=${encodeURIComponent(SKU)}`, {
    headers: { Authorization: authHeader },
  });
  const data = await res.json();
  const producto = (data.productos || [])[0];
  if (producto) {
    await request.delete(`/api/admin/inventarios/productos/${producto.id}`, { headers: { Authorization: authHeader } });
  }
});
