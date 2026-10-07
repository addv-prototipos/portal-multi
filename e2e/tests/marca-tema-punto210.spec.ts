// E2E del Punto 210 (ver PROJECT_STATE.md): "Marca e identidad visual"
// editable tanto desde /admin (self-servicio del propio tenant, nuevo)
// como desde /control (super-admin, migrado al mismo módulo compartido
// frontend/marcaTemaEditor.js). Usa tenants ya provisionados en este
// entorno: "t2" (marca_lookfeel_habilitado=1, para probar el flujo real)
// y "t1" (marca_lookfeel_habilitado=0, para probar que la tarjeta se
// oculta — mismo criterio que admin-plan-gating.spec.ts).

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function loginAdminTenant(page, slug: string) {
  await page.goto(`/${slug}/admin`);
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });
}

async function abrirConfiguraciones(page) {
  // El aviso "Falta configurar los datos fiscales" tapa toda la pantalla
  // (incluido el sidebar) si el tenant de prueba no tiene RFC/Clave SAT —
  // su botón de cierre abre Configuraciones directo en "Configuraciones
  // fiscales" (no hace falta navegar ahí aparte en ese caso).
  const avisoFiscal = page.locator('#config-fiscal-faltante-overlay');
  if (await avisoFiscal.isVisible().catch(() => false)) {
    await page.click('#btn-config-fiscal-faltante-cerrar');
    await expect(page.locator('#config-modal-overlay')).toBeVisible();
    return;
  }
  // "Configuraciones" vive dentro del grupo colapsable "Cuenta" del
  // sidebar — en el primer render solo el grupo de la vista activa
  // ("Inicio") queda expandido (aplicarEstadoGruposSidebar), así que hay
  // que abrirlo antes de poder hacer clic en el botón.
  const grupoCuenta = page.locator('.admin-sidebar-group-header[data-grupo="cuenta"]');
  if ((await grupoCuenta.getAttribute('aria-expanded')) !== 'true') {
    await grupoCuenta.click();
  }
  await page.click('#btn-vista-configuraciones');
  await expect(page.locator('#config-modal-overlay')).toBeVisible();
}

test('admin (t1, Marca propia apagada): la tarjeta no aparece en Configuraciones', async ({ page }) => {
  await loginAdminTenant(page, 't1');
  await abrirConfiguraciones(page);
  await expect(page.locator('.config-modal-nav-item[data-tarjeta="marca-tema-card"]')).toBeHidden();
  await expect(page.locator('#marca-tema-card')).toBeHidden();
});

test('admin (t2, self-servicio): editar marca, bloquear por contraste y guardar colores válidos', async ({ page }) => {
  await loginAdminTenant(page, 't2');
  await abrirConfiguraciones(page);

  await page.click('.config-modal-nav-item[data-tarjeta="marca-tema-card"]');
  await expect(page.locator('#marca-tema-card')).toBeVisible();
  await expect(page.locator('#met-marca-nombre')).toBeVisible({ timeout: 10000 });

  // Nombre de marca
  await page.fill('#met-marca-nombre', 'Marca E2E Admin');

  // Contraste inválido a propósito (texto casi igual al fondo) — el botón
  // de guardar debe quedar bloqueado por el aviso en vivo, sin llamar al
  // backend (el backend igual lo rechazaría, pero esto prueba la
  // validación en el cliente del módulo compartido).
  await page.fill('#met-color-bg', '#ffffff');
  await page.fill('#met-color-ink', '#fefefe');
  await expect(page.locator('#met-contraste-aviso')).toHaveAttribute('data-estado', 'bad');

  await page.click('#met-btn-guardar');
  // Sigue en la misma pantalla (no hubo toast de éxito): el error de
  // contraste impidió el guardado.
  await expect(page.locator('#met-error-tema')).not.toHaveText('');

  // Corrige el contraste y guarda de verdad.
  await page.fill('#met-color-ink', '#111111');
  await expect(page.locator('#met-contraste-aviso')).toHaveAttribute('data-estado', 'ok');
  await page.click('#met-btn-guardar');
  await expect(page.locator('#toast')).toContainText('Guardado', { timeout: 10000 });

  // El valor persiste tras recargar.
  await page.reload();
  await abrirConfiguraciones(page);
  await page.click('.config-modal-nav-item[data-tarjeta="marca-tema-card"]');
  await expect(page.locator('#met-marca-nombre')).toHaveValue('Marca E2E Admin', { timeout: 10000 });
});

test('control (t2): la pestaña Identidad visual usa el mismo módulo y persiste la marca', async ({ page }) => {
  await page.goto('/control');
  await page.fill('#control-user', 'admin');
  await page.fill('#control-pass', 'admin');
  await page.click('#control-btn-login');
  await expect(page.locator('#control-dashboard')).toBeVisible();

  const fila = page.locator('#control-table-body tr', { hasText: 'Empresa 2' }).first();
  await expect(fila).toBeVisible({ timeout: 15000 });
  await fila.locator('button[data-tooltip="Editar"]').click();
  await expect(page.locator('#control-editar-modal-overlay')).toBeVisible();

  await page.click('.control-edit-tab[data-tab="visual"]');
  await expect(page.locator('#met-marca-nombre')).toBeVisible({ timeout: 10000 });
  // Trae precargado lo que guardó el test anterior desde /admin — mismo
  // dato (control_tenants.tenants.marca), misma interfaz.
  await expect(page.locator('#met-marca-nombre')).toHaveValue('Marca E2E Admin');

  await page.fill('#met-marca-nombre', 'Marca E2E Control');
  await page.click('.control-edit-tab[data-tab="general"]');
  await page.click('#control-btn-editar-guardar');
  await expect(page.locator('#control-editar-modal-overlay')).toBeHidden();
  await expect(page.locator('#control-toast')).toContainText('guardados');
});
