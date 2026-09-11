// Valida el contexto de URLs del tenant recién aprovisionado desde
// /control (segmento 9c): el slug capturado en el intake define las URLs
// /<slug> (portal del cliente) y /<slug>/admin (panel admin de esa
// empresa), y nginx debe resolverlas solo con ese contexto. Requiere que
// antes se haya corrido el test de captura (control-alta-empresa.spec.ts)
// y que el operador haya ejecutado provisionar-tenant.js con ese slug.

import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SLUG_FILE = join(__dirname, '..', '.slug-e2e.txt');
const slug = existsSync(SLUG_FILE) ? readFileSync(SLUG_FILE, 'utf8') : '';

test.describe.configure({ mode: 'serial' });

test('el portal del cliente responde en /<slug>', async ({ page }) => {
  test.skip(!slug, 'correr después del test de captura y del aprovisionamiento');

  const response = await page.goto(`/${slug}/login`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/${slug}/login$`));
  // El frontend tenant-aware construye sus rutas con el slug
  await expect(page.locator('body')).not.toBeEmpty();
});

test('el panel admin responde en /<slug>/admin', async ({ page }) => {
  test.skip(!slug, 'correr después del test de captura y del aprovisionamiento');

  const response = await page.goto(`/${slug}/admin`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/${slug}/admin$`));
});

test('la API tenant-aware responde con el contexto del slug (admin del tenant)', async ({ request }) => {
  test.skip(!slug, 'correr después del test de captura y del aprovisionamiento');

  // Basic Auth contra /<slug>/api/admin/login — nginx reescribe el
  // X-Tenant-Slug y requireAdminAuth consulta la BD del tenant (tabla
  // usuarios que siembra provisionar-tenant.js).
  // 200 = la petición se enrutó a la BD correcta; 404 = tenant no
  // resuelto; 401 = credenciales mal (pero el tenant sí se resolvió).
  const response = await request.get(`/${slug}/api/admin/login`, {
    headers: {
      Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64'),
    },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.usuario).toBe('admin');
  expect(body.perfil).toBe('super');
});

test('un slug inexistente no resuelve (404 en API de tenant)', async ({ page }) => {
  test.skip(!slug, 'correr después del test de captura');

  // La API con contexto de un slug que no existe debe dar 404 — nginx
  // reenvía /<slug>inexistente/api/* con X-Tenant-Slug y el backend
  // rechaza el tenant desconocido (anti-enumeración incluida).
  const response = await page.request.get(`/slug-inexistente/api/health`);
  expect(response.status()).toBe(404);
});