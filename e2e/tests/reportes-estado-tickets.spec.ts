// E2E de Reportes → "Estado de tickets" (punto 360, movido desde "Inicio"
// — ver PROJECT_STATE.md). Corre contra el SITIO BASE (no un tenant): ahí
// Facturación siempre está activa (sin fila en control_tenants.tenants,
// planPermite() siempre permite), así que no hay que tocar la
// configuración real de ningún tenant de prueba para ejercitar este flujo.

import { test, expect } from '@playwright/test';

function auth() {
  return { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
}

async function loginAdmin(page) {
  await page.goto('/admin');
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await expect(page.locator('h1#inicio-titulo-bienvenida')).toBeVisible();
}

test('Inicio queda fijo: solo el saludo, sin KPIs/tabla/dona de tickets', async ({ page }) => {
  await loginAdmin(page);
  await expect(page.locator('#inicio-titulo-bienvenida')).toHaveText(/¡Bienvenido/);
  await expect(page.locator('#inicio-stats-grid')).toHaveCount(0);
  await expect(page.locator('#inicio-main-grid')).toHaveCount(0);
  await expect(page.locator('#reportes-tickets-stats-grid')).toBeHidden();
});

test('Reportes → "Estado de tickets" muestra el mismo resumen que antes vivía en Inicio', async ({ page, request }) => {
  const resTickets = await request.get('/api/admin/tickets', { headers: auth() });
  const dataTickets = await resTickets.json();
  const totalReal = (dataTickets.tickets || []).length;

  await loginAdmin(page);
  // "Reportes" vive dentro del grupo colapsable "Finanzas" del sidebar —
  // hay que expandirlo antes de poder hacer clic en su botón.
  await page.click('.admin-sidebar-group-header[data-grupo="finanzas"]');
  await page.click('#btn-vista-lectura-reportes');
  // Punto en curso: las 5 pestañas de Reportes se movieron al submenú
  // anidado del sidebar en escritorio (#btn-vista-lectura-reportes ya las
  // deja expandidas) — la fila horizontal vieja (#btn-reportes-vista-*)
  // ahora solo existe para móvil (oculta en escritorio vía CSS).
  await page.click('#btn-sidebar-reportes-estado-tickets');

  await expect(page.locator('#reportes-tickets-stats-grid')).toBeVisible();
  await expect(page.locator('#reportes-tickets-stat-total')).toHaveText(String(totalReal));
  await expect(page.locator('#reportes-tickets-donut-total')).toHaveText(String(totalReal));

  // "Ver todas" navega a la vista Tickets completa (mismo botón de siempre,
  // solo reubicado).
  await page.click('#btn-reportes-tickets-ver-todas');
  await expect(page.locator('#vista-tickets')).toBeVisible();
});

test('el perfil "fiscal" entra a Reportes y solo ve "Estado de tickets" (las otras 4 pestañas quedan ocultas)', async ({
  page,
  request,
}) => {
  // Usuario fiscal de prueba — creado y borrado vía API de /admin, mismo
  // patrón que el resto de specs de esta sesión.
  const usuario = 'qa-fiscal-estado-tickets';
  const password = 'ClaveFiscalE2E1';
  await request.post('/api/admin/usuarios', {
    headers: auth(),
    data: { rfc: usuario, telefono: '', email: `${usuario}@example.com`, password, perfil: 'fiscal' },
  });

  // El popup "Tickets nuevos por facturar" llega por un fetch asíncrono y
  // puede aparecer en cualquier momento entre los clics de abajo — un
  // check puntual (isVisible) pierde la carrera si aparece después. Un
  // locator handler lo descarta solo, justo antes de cualquier acción que
  // quedaría bloqueada, sin importar cuándo aparezca.
  await page.addLocatorHandler(page.locator('#notif-tickets-overlay'), async (overlay) => {
    await overlay.locator('#btn-notif-tickets-cerrar').click();
  });

  await page.goto('/admin');
  await page.fill('#admin-user', usuario);
  await page.fill('#admin-pass', password);
  await page.click('#btn-login');
  await expect(page.locator('#inicio-titulo-bienvenida')).toBeVisible();

  // Primer login de esta cuenta de prueba: dispara el tour de onboarding,
  // que bloquea clics en el sidebar hasta saltarlo.
  const btnSaltarTour = page.locator('#btn-onboarding-tour-saltar');
  if (await btnSaltarTour.isVisible().catch(() => false)) {
    await btnSaltarTour.click();
  }

  await page.click('.admin-sidebar-group-header[data-grupo="finanzas"]');
  await page.click('#btn-vista-lectura-reportes');
  // Mismo candado de perfil, ahora sobre los botones del submenú anidado
  // del sidebar (la fila horizontal vieja está oculta en escritorio).
  await expect(page.locator('#btn-sidebar-reportes-estado-tickets')).toBeVisible();
  await expect(page.locator('#btn-sidebar-reportes-por-reporte')).toBeHidden();
  await expect(page.locator('#btn-sidebar-reportes-cortes')).toBeHidden();
  await expect(page.locator('#btn-sidebar-reportes-ledger')).toBeHidden();
  await expect(page.locator('#btn-sidebar-reportes-estado-inventario')).toBeHidden();
  // Se activa sola al entrar — fiscal nunca ve "Por reporte" seleccionada
  // por default sin poder alcanzarla.
  await expect(page.locator('#reportes-tickets-stats-grid')).toBeVisible();

  const lista = await request.get('/api/admin/usuarios?perfil=fiscal', { headers: auth() });
  const data = await lista.json();
  const fila = (Array.isArray(data) ? data : data.usuarios || []).find((u: any) => u.rfc === usuario);
  if (fila) await request.delete(`/api/admin/usuarios/${fila.id}`, { headers: auth() });
});
