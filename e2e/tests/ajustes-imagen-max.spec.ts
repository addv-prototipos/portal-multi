// E2E del punto 370 (Ajustes de imágenes, ajuste global de plataforma):
// login en /control → Super Admins → tarjeta "Ajustes de imágenes" →
// cambiar el máximo → confirmar que se guarda, que los 3 hints estáticos
// de intake/editar/favicon se actualizan en vivo, y que el backend de
// /admin (hints de Inventarios/Configuraciones) refleja el nuevo valor
// tras volver a iniciar sesión (confirma que viaja en GET /api/admin/login).

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('Ajustes de imágenes: cambiar el máximo en /control se refleja en /control y en /admin', async ({ page }) => {
  // ---------- /control: login y abrir Super Admins ----------
  await page.goto('/control');
  await page.fill('#control-user', 'admin');
  await page.fill('#control-pass', 'admin');
  await page.click('#control-btn-login');
  await expect(page.locator('#control-dashboard')).toBeVisible();

  await page.click('#btn-vista-control-super');
  await expect(page.locator('#vista-control-super')).toBeVisible();

  // Tarjeta colapsada al inicio, el input ya trae el valor cargado (2 por defecto)
  await expect(page.locator('#imagen-max-config-body')).toBeHidden();
  await page.click('#btn-toggle-imagen-max');
  await expect(page.locator('#imagen-max-config-body')).toBeVisible();
  await expect(page.locator('#imagen-max-mb')).toHaveValue('2');

  // Hints estáticos (fuera de la tarjeta) ya muestran "2" desde showDashboard()
  await expect(page.locator('#intake-logo-limite-mb')).toHaveText('2');
  await expect(page.locator('#favicon-limite-mb')).toHaveText('2');

  // Validación: fuera de rango (21) rechaza sin llamar al backend
  await page.fill('#imagen-max-mb', '21');
  await page.click('#btn-guardar-imagen-max');
  await expect(page.locator('#imagen-max-error')).toContainText('entre 1 y 20');

  // Cambiar a 6 MB — debe guardar y reflejarse en los hints de inmediato
  await page.fill('#imagen-max-mb', '6');
  await page.click('#btn-guardar-imagen-max');
  await expect(page.locator('#imagen-max-info')).toContainText('Guardado');
  await expect(page.locator('#intake-logo-limite-mb')).toHaveText('6');
  await expect(page.locator('#favicon-limite-mb')).toHaveText('6');

  // Reabrir el modal de intake (vive en la vista "Empresas"): el hint de
  // ahí también trae "6"
  await page.click('#btn-vista-control-empresas');
  await expect(page.locator('#vista-control-empresas')).toBeVisible();
  await page.click('#control-btn-nueva-empresa');
  await expect(page.locator('#control-intake-modal-overlay')).toBeVisible();
  await expect(page.locator('#intake-logo-limite-mb')).toHaveText('6');
  await page.click('#control-btn-intake-cancelar');

  // ---------- /admin: el nuevo máximo viaja en GET /api/admin/login ----------
  await page.goto('/admin');
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await expect(page.locator('#admin-dashboard')).toBeVisible();

  // Configuraciones → "Ticket de impresión" trae el hint del logo de ticket.
  // Aviso "Falta configurar los datos fiscales" (sitio base sin RFC/Clave
  // SAT capturados) puede tapar el botón — su único botón ya navega
  // directo a Configuraciones, así que sirve igual para llegar ahí.
  const avisoFiscal = page.locator('#config-fiscal-faltante-overlay');
  if (await avisoFiscal.isVisible().catch(() => false)) {
    await page.click('#btn-config-fiscal-faltante-cerrar');
  } else {
    const grupoCuenta = page.locator('.admin-sidebar-group-header[data-grupo="cuenta"]');
    if ((await grupoCuenta.getAttribute('aria-expanded')) === 'false') {
      await grupoCuenta.click();
    }
    await page.click('#btn-vista-configuraciones');
  }
  await expect(page.locator('#config-modal-overlay')).toBeVisible();
  await page.click('[data-tarjeta="ticket-config-card"]');
  await expect(page.locator('#ticket-logo-limite-mb')).toHaveText('6');

  // ---------- Limpieza: regresar el ajuste a su default (2) ----------
  // La sesión de /control (sessionStorage) sigue viva en este mismo
  // browser context — goto() restaura el dashboard directo, sin login.
  await page.goto('/control');
  await expect(page.locator('#control-dashboard')).toBeVisible();
  await page.click('#btn-vista-control-super');
  await page.click('#btn-toggle-imagen-max');
  await page.fill('#imagen-max-mb', '2');
  await page.click('#btn-guardar-imagen-max');
  await expect(page.locator('#imagen-max-info')).toContainText('Guardado');
});
