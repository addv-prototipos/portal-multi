import { test, expect } from '@playwright/test';

// Verifica que el harness de Playwright está correctamente configurado y
// que el sitio responde. Las pruebas funcionales reales de las 6 páginas
// van en el Segmento D.
test('smoke: harness de E2E, sitio responde', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
});
