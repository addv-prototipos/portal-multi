// E2E del flujo de alta de empresa nueva desde /control (segmento 9c,
// ver PROJECT_STATE.md punto 101): login → "Nueva empresa" → modal con
// preview de URLs → captura → fila "Provisionando" en la tabla. El slug
// se genera único por corrida y se guarda en test-results/slug.txt para
// que el paso de aprovisionamiento (script CLI, fuera de Playwright) y la
// validación de URLs puedan usarlo. La sección "Datos fiscales
// (opcional)" se quitó del modal — este spec ya no la ejercita.

import { test, expect } from '@playwright/test';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SLUG_FILE = join(__dirname, '..', '.slug-e2e.txt');
const slug = `e2e9c${Date.now().toString().slice(-8)}`;

test.describe.configure({ mode: 'serial' });

test('alta de empresa desde /control: login, modal, captura', async ({ page }) => {
  await page.goto('/control');

  // Login con ADMIN_USERS (default admin:admin)
  await page.fill('#control-user', 'admin');
  await page.fill('#control-pass', 'admin');
  await page.click('#control-btn-login');
  await expect(page.locator('#control-dashboard')).toBeVisible();

  // Abrir el modal de alta
  await page.click('#control-btn-nueva-empresa');
  await expect(page.locator('#control-intake-modal-overlay')).toBeVisible();
  await expect(page.locator('#control-intake-modal-title')).toHaveText('Nueva empresa');

  // Preview de URLs: vacío al inicio
  await expect(page.locator('#control-intake-url-preview')).toHaveText('');

  // Llenar datos base — la preview debe actualizarse en vivo con el slug
  await page.fill('#control-intake-nombre', 'Empresa E2E 9c S.A. de C.V.');
  await page.fill('#control-intake-slug', slug);
  await expect(page.locator('#control-intake-url-preview')).toContainText(`/${slug}`);
  await expect(page.locator('#control-intake-url-preview')).toContainText(`/${slug}/admin`);

  await page.fill('#control-intake-email', `contacto-${slug}@e2e.com`);
  await page.fill('#control-intake-notas', 'Alta capturada por test E2E del segmento 9c');

  // Enviar
  await page.click('#control-btn-intake-guardar');

  // La respuesta 201 cierra el modal y muestra toast de éxito
  await expect(page.locator('#control-intake-modal-overlay')).toBeHidden();
  await expect(page.locator('#control-toast')).toBeVisible();
  await expect(page.locator('#control-toast')).toContainText(slug);

  // La fila nueva aparece en la tabla con estado "Provisionando"
  const fila = page.locator(`#control-table-body tr`, { hasText: slug });
  await expect(fila).toBeVisible();
  await expect(fila.locator('.estatus-badge')).toHaveText('Provisionando');

  // Guardar el slug para los pasos siguientes (aprovisionamiento + URLs)
  writeFileSync(SLUG_FILE, slug, 'utf8');
});

test('validación: slug duplicado se rechaza con 409 y mensaje en el modal', async ({ page }) => {
  test.skip(!existsSync(SLUG_FILE), 'correr después del test de captura');

  await page.goto('/control');
  await page.fill('#control-user', 'admin');
  await page.fill('#control-pass', 'admin');
  await page.click('#control-btn-login');
  await expect(page.locator('#control-dashboard')).toBeVisible();

  await page.click('#control-btn-nueva-empresa');
  await page.fill('#control-intake-nombre', 'Duplicado E2E');
  await page.fill('#control-intake-slug', readFileSync(SLUG_FILE, 'utf8'));
  await page.click('#control-btn-intake-guardar');

  // El modal permanece abierto con el error de slug existente
  await expect(page.locator('#control-intake-modal-overlay')).toBeVisible();
  await expect(page.locator('#control-intake-error')).toContainText('ya está registrado');
});