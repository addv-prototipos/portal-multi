// E2E del Punto 374 (ver PROJECT_STATE.md): "Portal de clientes
// desactivado" — página de aviso (Aurora profunda, navy/cian, cristal
// Clarvo girando en 3D) que reemplaza las 6 páginas del portal de
// cliente cuando `portalClientesHabilitado` está apagado. Usa el tenant
// de prueba "t2", apagado/restaurado por el propio spec para que sea
// re-ejecutable sin dejar estado sucio.

import { test, expect } from '@playwright/test';

const SLUG = 't2';

const AUTH_CONTROL = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };

// El PUT general de edición exige el objeto completo (nombreEmpresa,
// contactoEmail, etc. son obligatorios) — se lee el tenant actual primero
// y solo se cambia portalClientesHabilitado, igual que haría el modal
// real de /control.
async function ajustarPortalClientes(request, habilitado: boolean) {
  const lista = await request.get('/api/control/tenants', { headers: AUTH_CONTROL });
  expect(lista.ok()).toBeTruthy();
  const datos = await lista.json();
  const tenants = datos.tenants || datos;
  const t = tenants.find((x) => x.slug === SLUG);
  expect(t).toBeTruthy();

  const res = await request.put(`/api/control/tenants/${SLUG}`, {
    headers: AUTH_CONTROL,
    data: {
      nombreEmpresa: t.nombre_empresa,
      contactoEmail: t.contacto_email,
      notas: null,
      maxUsuarios: t.max_usuarios,
      marcaLookfeelHabilitado: Boolean(t.marca_lookfeel_habilitado),
      discoCuotaMb: t.disco_cuota_mb,
      facturacionHabilitada: Boolean(t.facturacion_habilitada),
      portalClientesHabilitado: habilitado,
      sucursalesHabilitado: Boolean(t.sucursales_habilitado),
    },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe.configure({ mode: 'serial' });

test('portal apagado: login/dashboard/tickets/csf muestran el aviso con el correo de contacto real', async ({ page, request }) => {
  await ajustarPortalClientes(request, false);

  for (const ruta of ['login', 'dashboard', 'tickets', 'csf']) {
    await page.goto(`/${SLUG}/${ruta}`);
    await expect(page.locator('h1')).toHaveText('Portal de clientes desactivado', { timeout: 10000 });
    await expect(page.locator('.pd-cristal')).toBeVisible();
    await expect(page.locator('.pd-contacto-email')).toHaveText('empresa@empresa.com');
    // El cuerpo entero se reemplazó — nada de la UI normal de la página
    // original (inputs de login, tablero, etc.) sigue en el DOM.
    await expect(page.locator('input, form')).toHaveCount(0);
  }
});

test('portal apagado: /admin del mismo tenant sigue funcionando normal', async ({ page }) => {
  await page.goto(`/${SLUG}/admin`);
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });
  await expect(page.locator('.pd-cristal')).toHaveCount(0);
});

test('portal reactivado: login vuelve a mostrar el formulario normal', async ({ page, request }) => {
  await ajustarPortalClientes(request, true);
  await page.goto(`/${SLUG}/login`);
  await expect(page.locator('#login-rfc')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.pd-cristal')).toHaveCount(0);
});
