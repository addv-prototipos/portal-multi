// E2E de la Fase 5 del gobierno de funcionalidades (punto 349-350-351,
// ver stitch/gobierno-funcionalidades/NOTAS.md): el sidebar y las
// tarjetas de Configuraciones de /admin deben ocultar lo que el PLAN del
// tenant no trae — no solo bloquearlo en el backend (eso ya lo hace
// requiereFeature() desde la Fase 1).
//
// Usa el tenant real "t1" (multi-tenant, /t1/admin) con 3 flags apagados
// a propósito ANTES de esta corrida (gastos_habilitado, auditoria_habilitado,
// inventarios_habilitado — ver el runbook de validación manual de esta
// fase, PROJECT_STATE.md punto 351): el resto de los flags de t1 quedan
// en su default real (true). Este spec NO apaga/prende flags por sí
// mismo — solo verifica el estado ya preparado, para no pelearse con el
// TTL de 45s de la caché de resolución de tenant (tenantContext.js).

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function loginAdminTenant(page) {
  await page.goto('/t1/admin');
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });
}

test('con gastos/inventarios/auditoría apagados por el plan: esos 3 botones del sidebar quedan ocultos', async ({ page }) => {
  await loginAdminTenant(page);

  await expect(page.locator('#btn-vista-gastos')).toBeHidden();
  await expect(page.locator('#btn-vista-inventarios')).toBeHidden();
  await expect(page.locator('#btn-vista-auditoria')).toBeHidden();

  // Proveedores depende de Inventarios O Gastos — ambos apagados, debe
  // ocultarse también aunque no tenga bandera propia.
  await expect(page.locator('#btn-vista-proveedores')).toBeHidden();

  // El grupo "Catálogo" completo (Inventarios + Proveedores) se queda
  // sin ningún botón visible — su encabezado debe ocultarse solo, mismo
  // criterio ya usado por perfil (aplicarRestriccionesPerfil).
  await expect(page.locator('.admin-sidebar-group-header[data-grupo="catalogo"]')).toBeHidden();

  // Lo que SÍ sigue activo en el plan de t1 debe seguir visible: Ventas,
  // Cuentas por cobrar, Resumen financiero, Reportes, Facturación.
  await expect(page.locator('#btn-vista-ordenes')).toBeVisible();
  await expect(page.locator('#btn-vista-cxc')).toBeVisible();
  await expect(page.locator('#btn-vista-resumen-financiero')).toBeVisible();
  await expect(page.locator('#btn-vista-lectura-reportes')).toBeVisible();
  await expect(page.locator('#btn-vista-tickets')).toBeVisible();
  await expect(page.locator('#btn-vista-constancias')).toBeVisible();

  // "Administración" sigue visible — Usuarios no depende de ningún flag,
  // solo se ocultó el botón de Auditoría dentro del grupo.
  await expect(page.locator('.admin-sidebar-group-header[data-grupo="administracion"]')).toBeVisible();
  await expect(page.locator('#btn-vista-usuarios')).toBeVisible();
});

test('las tarjetas de autoservicio de Configuraciones también reflejan el plan apagado', async ({ page }) => {
  await loginAdminTenant(page);

  // Aviso "Falta configurar los datos fiscales" (independiente de esta
  // fase, dispara si el tenant de prueba no tiene RFC/Clave SAT
  // capturados) puede tapar el botón de Configuraciones — su único botón
  // ya navega directo ahí, así que sirve igual para llegar a la vista.
  const avisoFiscal = page.locator('#config-fiscal-faltante-overlay');
  if (await avisoFiscal.isVisible().catch(() => false)) {
    await page.click('#btn-config-fiscal-faltante-cerrar');
  } else {
    await page.click('#btn-vista-configuraciones');
  }
  await expect(page.locator('#config-modal-overlay')).toBeVisible();

  // "Módulo Ventas" sigue disponible (ventas_habilitado=true en t1).
  const navVentas = page.locator('.config-modal-nav-item[data-tarjeta="ordenes-toggle-card"]');
  await expect(navVentas).toBeVisible();

  // "Módulo Inventarios" y "Módulo Auditoría" deben desaparecer del nav
  // del modal — el plan ni siquiera deja que el tenant se autoconfigure
  // algo que no tiene incluido.
  await expect(page.locator('.config-modal-nav-item[data-tarjeta="inv-toggle-card"]')).toBeHidden();
  await expect(page.locator('.config-modal-nav-item[data-tarjeta="auditoria-toggle-card"]')).toBeHidden();
});
