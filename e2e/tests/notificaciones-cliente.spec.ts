// E2E de la campana de notificaciones del portal de cliente (punto en
// curso): une "promoción" (broadcast, compuesta en /admin → Promociones)
// y "pago registrado" (automática, al registrar un cobro en Cuentas por
// cobrar). Usa el tenant real "t2" — en este entorno ya tiene
// cxc_habilitado=1 y promociones_habilitado=1 (ver credito.spec.ts/
// marca-tema-punto210.spec.ts para el resto de specs que usan t2 como el
// tenant de "flujo real", a diferencia de "t1" que es el de gating).

import { test, expect, APIRequestContext } from '@playwright/test';

const EMAIL_PRUEBA = 'qa-notif-cliente-e2e@example.com';
const PASSWORD = 'ClaveNotifE2E1';

function auth() {
  return { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
}

async function buscarUsuarioPorEmail(request: APIRequestContext) {
  const lista = await request.get('/t2/api/admin/usuarios?perfil=cliente', { headers: auth() });
  const data = await lista.json();
  const usuarios = Array.isArray(data) ? data : data.usuarios || [];
  return usuarios.find((u: any) => u.email === EMAIL_PRUEBA);
}

async function crearUsuarioPrueba(request: APIRequestContext) {
  const res = await request.post('/t2/api/admin/usuarios', {
    headers: auth(),
    data: { rfc: 'QANC900101CD4', telefono: '5500000096', email: EMAIL_PRUEBA, password: PASSWORD, perfil: 'cliente' },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`No se pudo crear el usuario de prueba: ${res.status()}`);
  }
}

async function limpiarOrdenesDePrueba(request: APIRequestContext) {
  const lista = await request.get('/t2/api/admin/ordenes-compra', { headers: auth() });
  if (!lista.ok()) return;
  const data = await lista.json();
  const ordenes = (data.ordenes || []).filter((o: any) => o.email === EMAIL_PRUEBA);
  for (const orden of ordenes) {
    // eslint-disable-next-line no-await-in-loop
    await request.delete(`/t2/api/admin/ordenes-compra/${orden.id}`, { headers: auth() });
  }
}

async function eliminarUsuarioPrueba(request: APIRequestContext) {
  const fila = await buscarUsuarioPorEmail(request);
  if (fila) await request.delete(`/t2/api/admin/usuarios/${fila.id}`, { headers: auth() });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await limpiarOrdenesDePrueba(request); // por si quedó de una corrida interrumpida
  await eliminarUsuarioPrueba(request);
  await crearUsuarioPrueba(request);
});

test.afterAll(async ({ request }) => {
  await limpiarOrdenesDePrueba(request);
  await eliminarUsuarioPrueba(request);
});

async function loginAdminTenant(page) {
  await page.goto('/t2/admin');
  const yaDentro = await page.locator('#admin-dashboard:not([hidden])').isVisible().catch(() => false);
  if (yaDentro) return;
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });
}

test('admin: perfil "ventas" no ve "Promociones" en el sidebar (solo administrador/super)', async ({ page, request }) => {
  const rfcVentas = 'ventasnotife2e';
  const passwordVentas = 'ClaveVentasE2E1';
  await request.post('/t2/api/admin/usuarios', {
    headers: auth(),
    data: { rfc: rfcVentas, telefono: '5500000095', email: 'qa-ventas-notif-e2e@example.com', password: passwordVentas, perfil: 'ventas' },
  }).catch(() => {}); // 409 si ya existe de una corrida interrumpida — se reusa igual.

  try {
    await page.goto('/t2/admin');
    await page.fill('#admin-user', rfcVentas);
    await page.fill('#admin-pass', passwordVentas);
    await page.click('#btn-login');
    await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });
    await expect(page.locator('#btn-vista-promociones')).toBeHidden();
  } finally {
    const lista = await request.get('/t2/api/admin/usuarios', { headers: auth() });
    const data = await lista.json();
    const usuarios = Array.isArray(data) ? data : data.usuarios || [];
    const fila = usuarios.find((u: any) => u.rfc === rfcVentas);
    if (fila) await request.delete(`/t2/api/admin/usuarios/${fila.id}`, { headers: auth() });
  }
});

test('admin (t2): enviar una promoción aparece en el historial', async ({ page }) => {
  await loginAdminTenant(page);

  const avisoFiscal = page.locator('#config-fiscal-faltante-overlay');
  if (await avisoFiscal.isVisible().catch(() => false)) {
    await page.click('#btn-config-fiscal-faltante-cerrar');
    const configModal = page.locator('#config-modal-overlay');
    if (await configModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
    }
  }

  const grupoAdministracion = page.locator('.admin-sidebar-group-header[data-grupo="administracion"]');
  if ((await grupoAdministracion.getAttribute('aria-expanded')) !== 'true') {
    await grupoAdministracion.click();
  }
  await page.click('#btn-vista-promociones');
  await expect(page.locator('#vista-promociones')).toBeVisible();

  const titulo = `Promo E2E ${Date.now()}`;
  await page.fill('#promo-titulo', titulo);
  await page.fill('#promo-mensaje', 'Mensaje de prueba E2E — 15% de descuento.');
  await page.click('#btn-enviar-promocion');

  await expect(page.locator('#toast')).toContainText('Promoción enviada', { timeout: 10000 });
  await expect(page.locator('#promociones-grid')).toContainText(titulo, { timeout: 10000 });
  await expect(page.locator('#promociones-grid')).toContainText('Activa');
  // El formulario se limpia después de enviar.
  await expect(page.locator('#promo-titulo')).toHaveValue('');
});

test('admin (t2): vigencia + archivar + relanzar + eliminar, ciclo completo', async ({ page }) => {
  await loginAdminTenant(page);

  const avisoFiscal = page.locator('#config-fiscal-faltante-overlay');
  if (await avisoFiscal.isVisible().catch(() => false)) {
    await page.click('#btn-config-fiscal-faltante-cerrar');
    const configModal = page.locator('#config-modal-overlay');
    if (await configModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
    }
  }
  const grupoAdministracion = page.locator('.admin-sidebar-group-header[data-grupo="administracion"]');
  if ((await grupoAdministracion.getAttribute('aria-expanded')) !== 'true') {
    await grupoAdministracion.click();
  }
  await page.click('#btn-vista-promociones');
  await expect(page.locator('#vista-promociones')).toBeVisible();

  // Enviar con vigencia futura (opción "Hasta" + fecha).
  const titulo = `Promo vigencia E2E ${Date.now()}`;
  await page.fill('#promo-titulo', titulo);
  await page.fill('#promo-mensaje', 'Válida unos días.');
  await page.click('#promo-vigencia-con');
  await page.fill('#promo-vigencia-fecha', '2099-12-31');
  await page.click('#btn-enviar-promocion');
  await expect(page.locator('#toast')).toContainText('Promoción enviada', { timeout: 10000 });

  const card = page.locator('.promo-card', { hasText: titulo });
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card.locator('.promo-badge')).toHaveText('Activa');
  await expect(card).toContainText('Hasta');

  // Archivar — pasa a "Archivada", gana el botón "Relanzar".
  await card.locator('[data-accion="archivar"]').click();
  await expect(page.locator('#toast')).toContainText('archivada', { timeout: 10000 });
  await expect(card.locator('.promo-badge')).toHaveText('Archivada', { timeout: 10000 });
  await expect(card.locator('[data-accion="relanzar"]')).toBeVisible();

  // Relanzar — vuelve a "Activa", sin vigencia (default de v1).
  await card.locator('[data-accion="relanzar"]').click();
  await expect(page.locator('#toast')).toContainText('relanzada', { timeout: 10000 });
  await expect(card.locator('.promo-badge')).toHaveText('Activa', { timeout: 10000 });
  await expect(card).toContainText('Sin vigencia');

  // Eliminar — pide confirmación (modal genérico del sitio), luego desaparece.
  await card.locator('[data-accion="eliminar"]').click();
  const confirmModal = page.locator('#confirm-modal-overlay');
  await expect(confirmModal).toBeVisible({ timeout: 10000 });
  await expect(confirmModal).toContainText(titulo);
  await page.click('#btn-confirm-aceptar');
  await expect(page.locator('#toast')).toContainText('eliminada', { timeout: 10000 });
  await expect(page.locator('.promo-card', { hasText: titulo })).toHaveCount(0, { timeout: 10000 });
});

test('cliente (t2): ve la promoción en la campana y, tras un cobro, también "Pago registrado"', async ({ page, request }) => {
  await page.goto('/t2/login');
  await page.fill('#login-rfc', EMAIL_PRUEBA);
  await page.fill('#login-password', PASSWORD);
  await page.click('#btn-login');
  await expect(page).toHaveURL(/\/t2\/dashboard$/);

  const bellBtn = page.locator('#portal-notif-btn');
  await expect(bellBtn).toBeVisible({ timeout: 10000 });
  await bellBtn.click();
  const panel = page.locator('#portal-notif-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Promo E2E', { timeout: 10000 });
  await bellBtn.click(); // cierra el panel

  // Registra una venta + cobro real desde /admin mientras el cliente está
  // logueado en otra pestaña lógica (misma page, otra pestaña del
  // navegador real no es necesaria — el sondeo de 60s no se espera en el
  // test; se recarga la página para forzar el primer sondeo, igual que
  // un refresh real del cliente).
  const venta = await request.post('/t2/api/admin/ordenes-compra', {
    headers: auth(),
    data: { concepto: 'Venta E2E notificaciones', cantidad: 300, email: EMAIL_PRUEBA, es_cliente_nuevo: true, estado_pago: 'pendiente' },
  });
  expect(venta.ok()).toBeTruthy();
  const ventaData = await venta.json();
  const cobro = await request.put(`/t2/api/admin/ordenes-compra/${ventaData.id}/cobro`, {
    headers: auth(),
    data: { monto: 300 },
  });
  expect(cobro.ok()).toBeTruthy();

  await page.reload();
  await expect(bellBtn).toBeVisible({ timeout: 10000 });
  await bellBtn.click();
  await expect(panel).toContainText('Pago registrado', { timeout: 10000 });
  await expect(panel).toContainText('$300.00', { timeout: 10000 });

  // Clic en "Pago registrado" navega a la página de Crédito.
  await page.locator('.portal-notif-item[data-tipo="pago_registrado"]').first().click();
  await expect(page).toHaveURL(/\/t2\/credito$/);
});
