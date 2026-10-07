// E2E del segmento "Edición" (ver PROJECT_STATE.md punto 104): edición de
// una empresa existente desde /control — datos + switch "Cambiar slug
// (avanzado)" que dispara la migración de archivos en el backend
// (/internal/renombrar-slug) y deja las URLs nuevas activas.
//
// Usa el tenant de prueba e2e-migracion-destino (creado y aprovisionado
// por la validación manual del punto 104, con archivos reales en MinIO:
// constancias/ticket/factura/logo). El spec es idempotente: el slug
// actual se lee de la fila en cada corrida (no se asume), y el test 2
// restaura el slug original al final. Requiere que el tenant exista;
// si una corrida falló a mitad dejando un slug temporal distinto, el
// test 1 lo detecta igualmente (busca la fila por el nombre).

import { test, expect } from '@playwright/test';

const SLUG_BASE = 'e2e-migracion-destino';
const NOMBRE_BASE = 'Empresa E2E Migracion S.A. de C.V.';
const NOMBRE_EDITADO = 'Empresa E2E Migracion Editada por UI';
const MARCA_BASE = 'Marca Migrada E2E';
const MARCA_EDITADA = 'Marca Editada UI';

let slugActual: string = '';

test.describe.configure({ mode: 'serial' });

async function loginControl(page) {
  await page.goto('/control');
  await page.fill('#control-user', 'admin');
  await page.fill('#control-pass', 'admin');
  await page.click('#control-btn-login');
  await expect(page.locator('#control-dashboard')).toBeVisible();
}

// Encuentra la fila del tenant de prueba por un fragmento del nombre
// (común al nombre base y al editado; el slug puede haber quedado
// temporal de una corrida interrumpida).
async function filaTenant(page) {
  const fila = page.locator('#control-table-body tr', { hasText: 'Empresa E2E Migracion' }).first();
  await expect(fila).toBeVisible({ timeout: 15000 });
  return fila;
}

test('editar datos de una empresa existente sin cambiar el slug', async ({ page }) => {
  await loginControl(page);
  const fila = await filaTenant(page);
  await fila.locator('button[data-tooltip="Editar"]').click();
  await expect(page.locator('#control-editar-modal-overlay')).toBeVisible();
  await expect(page.locator('#control-editar-modal-title')).toHaveText('Editar empresa');

  // El modal viene pre-llenado y el slug está en solo lectura
  await expect(page.locator('#control-editar-nombre')).not.toHaveValue('');
  await expect(page.locator('#control-editar-slug')).not.toHaveValue('');
  await expect(page.locator('#control-editar-slug')).toHaveAttribute('readonly', '');
  await expect(page.locator('#control-editar-slug-switch')).not.toBeChecked();

  // Recordar el slug actual (puede ser el base o un temporal de una
  // corrida interrumpida) para restaurarlo en el test 2.
  slugActual = (await page.locator('#control-editar-slug').inputValue()) as string;

  // Editar nombre (pestaña "General") + marca (pestaña "Identidad visual",
  // Punto 210 — el campo lo renderiza el módulo compartido
  // marcaTemaEditor.js dentro de #control-tema-body) y guardar con el
  // botón general (lee el valor vigente del campo de marca al momento de
  // guardar, sin que el operador tenga que usar el botón propio de esa
  // pestaña).
  await page.fill('#control-editar-nombre', NOMBRE_EDITADO);
  await page.click('.control-edit-tab[data-tab="visual"]');
  await expect(page.locator('#met-marca-nombre')).toBeVisible();
  await page.fill('#met-marca-nombre', MARCA_EDITADA);
  await page.click('.control-edit-tab[data-tab="general"]');
  await page.click('#control-btn-editar-guardar');

  await expect(page.locator('#control-editar-modal-overlay')).toBeHidden();
  await expect(page.locator('#control-toast')).toContainText('guardados');

  // La fila muestra el nombre editado
  await expect(await filaTenant(page)).toContainText(NOMBRE_EDITADO);
});

test('cambiar slug con el switch avanzado migra archivos y URLs', async ({ page, request }) => {
  test.skip(!slugActual, 'correr después del test de edición');
  const slugTemporal = `e2e-migracion-ui${Date.now().toString().slice(-8)}`;

  await loginControl(page);
  const fila = await filaTenant(page);
  await fila.locator('button[data-tooltip="Editar"]').click();
  await expect(page.locator('#control-editar-modal-overlay')).toBeVisible();

  // El slug está en solo lectura hasta que se activa el switch (el
  // checkbox está oculto visualmente: se interactúa con su label)
  const inputSlug = page.locator('#control-editar-slug');
  await expect(inputSlug).toHaveValue(slugActual);
  await expect(inputSlug).toHaveAttribute('readonly', '');
  await page.click('label.control-switch[for="control-editar-slug-switch"]');
  await expect(inputSlug).not.toHaveAttribute('readonly', '');

  // Escribir el slug nuevo y guardar
  await inputSlug.fill(slugTemporal);
  await page.click('#control-btn-editar-guardar');

  // Toast con aviso de que el slug cambió (las URLs antiguas ya no responden)
  await expect(page.locator('#control-editar-modal-overlay')).toBeHidden();
  await expect(page.locator('#control-toast')).toContainText(slugTemporal);
  await expect(page.locator('#control-toast')).toContainText('cambió');

  // La fila muestra el slug nuevo
  const filaNueva = page.locator('#control-table-body tr', { hasText: slugTemporal });
  await expect(filaNueva).toBeVisible();

  // API: el slug nuevo resuelve (200), el viejo ya no (404)
  const apiNuevo = await request.get(`/${slugTemporal}/api/health`);
  expect(apiNuevo.status()).toBe(200);
  const apiViejo = await request.get(`/${slugActual}/api/health`);
  expect(apiViejo.status()).toBe(404);

  // El logo público también se movió al slug nuevo
  const logoNuevo = await request.get(`/api/marca-logo/${slugTemporal}`);
  expect(logoNuevo.status()).toBe(200);
  const logoViejo = await request.get(`/api/marca-logo/${slugActual}`);
  expect(logoViejo.status()).toBe(404);

  // Restaurar el slug original vía la API de control para que la suite
  // sea re-ejecutable (el test 1 vuelve a encontrar la fila).
  const restauracion = await request.put(`/api/control/tenants/${slugTemporal}`, {
    headers: { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') },
    data: { nombreEmpresa: NOMBRE_EDITADO, slug: slugActual },
  });
  expect(restauracion.status()).toBe(200);

  // Tras restaurar: el slug original responde de nuevo y el temporal ya no
  const apiRestaurado = await request.get(`/${slugActual}/api/health`);
  expect(apiRestaurado.status()).toBe(200);
  const apiTemporal = await request.get(`/${slugTemporal}/api/health`);
  expect(apiTemporal.status()).toBe(404);
});