// Hallazgo N-01 (sonar_1.1.html, 2026-10-19): nginx limitaba el body de
// /api/control/ a 1 MB mientras control acepta logoBase64 hasta ~27 MB en
// base64 (IMAGEN_MAX_MB_MAX=20 MB real) — cualquier logo real por encima
// de ~700 KB nunca llegaba al backend, nginx respondía 413 (disfrazado de
// mantenimiento.html por el error_page 502/503/504 del location). Fix:
// client_max_body_size 1m -> 27m en ese location (frontend/nginx.conf.template
// y su espejo prod/). Esta prueba manda el PUT real por fuera del dropzone
// del navegador (que comprime la imagen a ~250 KB antes de enviarla — ver
// marcaTemaEditor.js:comprimirSiAplica) porque lo que hay que probar es la
// cadena de infraestructura (nginx -> control), no la compresión del
// cliente, que es una feature aparte y correcta.

import { test, expect } from '@playwright/test';
import { crearPngAleatorio } from '../fixtures/pngAleatorio';

test('PUT /api/control/tenants/:slug/marca con un logo de ~1.3MB (por encima del límite viejo de nginx) ya no da 413', async ({ page, request, baseURL }) => {
  await page.goto('/control');
  await page.fill('#control-user', 'admin');
  await page.fill('#control-pass', 'admin');
  await page.click('#control-btn-login');
  await expect(page.locator('#control-dashboard')).toBeVisible();

  const token = await page.evaluate(() => sessionStorage.getItem('control_credenciales'));
  expect(token).toBeTruthy();

  // PNG real (firma binaria válida, no solo bytes con extensión) de
  // ~1.47 MB decodificados (~1.96 MB en base64) — por encima del límite
  // viejo de nginx (1 MB) y del umbral real de ~700 KB que describe el
  // hallazgo, por debajo del default de imagen_max_mb (2 MB).
  const logoBase64 = crearPngAleatorio(700, 700).toString('base64');

  const res = await request.put(`${baseURL}/api/control/tenants/t2/marca`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { logoBase64 },
  });

  // Antes del fix: 413 de nginx (sin cuerpo JSON, página de
  // mantenimiento). Después del fix: la request llega completa a control
  // y responde JSON real (200 con el tenant actualizado, o un 4xx/5xx de
  // negocio real) — lo que nunca debe pasar es 413 ni la respuesta vacía
  // de nginx.
  expect(res.status()).not.toBe(413);
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(200);
  expect(body.tenant?.marca_logo_url).toBeTruthy();
});
