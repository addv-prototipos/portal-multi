// E2E de "Inicio" con datos reales (punto 362, ver PROJECT_STATE.md) —
// corre contra el sitio base (Ventas/Gastos/Inventarios siempre activos
// ahí, sin tocar la configuración real de ningún tenant de prueba).

import { test, expect } from '@playwright/test';

function auth() {
  return { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
}

async function dismissOverlays(page) {
  const btnSaltarTour = page.locator('#btn-onboarding-tour-saltar');
  if (await btnSaltarTour.isVisible().catch(() => false)) await btnSaltarTour.click();
  const btnCerrarNotifTickets = page.locator('#btn-notif-tickets-cerrar');
  if (await btnCerrarNotifTickets.isVisible().catch(() => false)) await btnCerrarNotifTickets.click();
}

async function loginAdmin(page) {
  await page.goto('/admin');
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await expect(page.locator('h1#inicio-titulo-bienvenida')).toBeVisible();
  await dismissOverlays(page);
}

test('perfil administrador: ve las 4 tarjetas y sus listas de recientes con datos reales', async ({ page, request }) => {
  await loginAdmin(page);

  await expect(page.locator('#inicio-kpi-tickets')).toBeVisible();
  await expect(page.locator('#inicio-kpi-ventas')).toBeVisible();
  await expect(page.locator('#inicio-kpi-gastos')).toBeVisible();
  await expect(page.locator('#inicio-kpi-inventario')).toBeVisible();

  // El número de la tarjeta de tickets debe coincidir con los tickets
  // reales creados hoy (fuente de verdad: GET /api/admin/tickets).
  const resTickets = await request.get('/api/admin/tickets', { headers: auth() });
  const dataTickets = await resTickets.json();
  const hoy = new Date().toISOString().slice(0, 10);
  const creadosHoy = (dataTickets.tickets || []).filter((t: any) => String(t.creado_en).slice(0, 10) === hoy).length;
  await expect(page.locator('#inicio-kpi-tickets-numero')).toHaveText(String(creadosHoy));

  // "Ver todas"/"Ver todos" navegan a la vista real correspondiente.
  await page.click('#btn-inicio-ver-ventas');
  await expect(page.locator('#vista-ordenes')).toBeVisible();
});

test('perfil "fiscal" en Inicio: solo la tarjeta de tickets, nada de Ventas/Gastos/Inventario', async ({ page, request }) => {
  const usuario = 'qa-inicio-fiscal';
  const password = 'ClaveInicioE2E1';
  await request.post('/api/admin/usuarios', {
    headers: auth(),
    data: { rfc: usuario, telefono: '', email: `${usuario}@example.com`, password, perfil: 'fiscal' },
  });

  await page.goto('/admin');
  await page.fill('#admin-user', usuario);
  await page.fill('#admin-pass', password);
  await page.click('#btn-login');
  await expect(page.locator('#inicio-titulo-bienvenida')).toBeVisible();
  await dismissOverlays(page);

  await expect(page.locator('#inicio-kpi-tickets')).toBeVisible();
  await expect(page.locator('#inicio-kpi-ventas')).toBeHidden();
  await expect(page.locator('#inicio-kpi-gastos')).toBeHidden();
  await expect(page.locator('#inicio-kpi-inventario')).toBeHidden();

  const lista = await request.get('/api/admin/usuarios?perfil=fiscal', { headers: auth() });
  const data = await lista.json();
  const fila = (Array.isArray(data) ? data : data.usuarios || []).find((u: any) => u.rfc === usuario.toUpperCase());
  if (fila) await request.delete(`/api/admin/usuarios/${fila.id}`, { headers: auth() });
});

// Punto 190 (preexistente, no tocado esta sesión): el perfil "ventas"
// NUNCA tiene "inicio" en su vistasPermitidas (RESTRICCIONES_PERFIL,
// admin.js) — el botón del sidebar queda oculto y no es alcanzable por
// navegación real, aterriza directo en Ventas al loguearse. La sección
// ventas/gastos de GET /api/admin/inicio/resumen sigue viva para ese
// perfil a nivel de API (consistente con el resto del gating, defensivo
// y correcto aunque hoy no tenga una UI que lo use) — se prueba a nivel
// de API, no de navegación en pantalla.
test('perfil "ventas": el backend SÍ calcula ventas/gastos (API), aunque Inicio no es alcanzable por su sidebar', async ({ request }) => {
  const usuario = 'qa-inicio-ventas';
  const password = 'ClaveInicioE2E2';
  await request.post('/api/admin/usuarios', {
    headers: auth(),
    data: { rfc: usuario, telefono: '', email: `${usuario}@example.com`, password, perfil: 'ventas' },
  });

  const resumen = await request.get('/api/admin/inicio/resumen', {
    headers: { Authorization: 'Basic ' + Buffer.from(`${usuario}:${password}`).toString('base64') },
  });
  expect(resumen.ok()).toBe(true);
  const data = await resumen.json();
  expect(data.ventas).toBeDefined();
  expect(data.gastos).toBeDefined();
  expect(data.tickets).toBeUndefined();
  expect(data.inventario).toBeUndefined();

  const lista = await request.get('/api/admin/usuarios?perfil=ventas', { headers: auth() });
  const data2 = await lista.json();
  const fila = (Array.isArray(data2) ? data2 : data2.usuarios || []).find((u: any) => u.rfc === usuario.toUpperCase());
  if (fila) await request.delete(`/api/admin/usuarios/${fila.id}`, { headers: auth() });
});

test('perfil "inventario" en Inicio: no cambia, sigue siendo "Estado del inventario" reparentado', async ({ page, request }) => {
  const usuario = 'qa-inicio-inventario';
  const password = 'ClaveInicioE2E3';
  await request.post('/api/admin/usuarios', {
    headers: auth(),
    data: { rfc: usuario, telefono: '', email: `${usuario}@example.com`, password, perfil: 'inventario' },
  });

  await page.goto('/admin');
  await page.fill('#admin-user', usuario);
  await page.fill('#admin-pass', password);
  await page.click('#btn-login');
  await dismissOverlays(page);

  await expect(page.locator('#inicio-inventario-slot')).toBeVisible();
  await expect(page.locator('#inicio-resumen')).toBeHidden();

  const lista = await request.get('/api/admin/usuarios?perfil=inventario', { headers: auth() });
  const data = await lista.json();
  const fila = (Array.isArray(data) ? data : data.usuarios || []).find((u: any) => u.rfc === usuario.toUpperCase());
  if (fila) await request.delete(`/api/admin/usuarios/${fila.id}`, { headers: auth() });
});
