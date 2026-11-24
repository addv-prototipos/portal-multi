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
//
// El tenant "t1" se perdió en algún reset de Docker previo al punto 508
// (confirmado: no aparecía en `control_tenants.tenants`) — recreado en
// esa misma fecha (PROJECT_STATE.md punto 508, Segmento 7, cierre de
// deuda) vía `/internal/activar-tenant/t1` + `/internal/crear-admin-inicial/t1`
// (mismo mecanismo real de onboarding, nunca el CLI
// `provisionar-tenant.js` — ese script asume que `control_tenants` vive
// en el MISMO servidor MySQL que las bases `tenant_*`, cosa que dejó de
// ser cierta desde el Segmento 9b: hoy son 2 contenedores MySQL
// distintos — correrlo tal cual habría creado una `control_tenants`
// duplicada y desincronizada en el servidor equivocado). La fila de
// `tenants` se insertó a mano con los mismos 3 flags en 0 que este spec
// siempre esperó, cuenta `admin`/`admin` igual que antes.

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function loginAdminTenant(page) {
  // Viewport más alto que el default (720px): con varios overlays de
  // bienvenida agregados en puntos posteriores a este spec (Términos,
  // asistente de facturación, tour), una ventana baja deja encabezados
  // de grupo del sidebar flotando sobre el nav — ruido ajeno a esta
  // prueba, no un bug de gating.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/t1/admin');
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });

  // Overlays de bienvenida/bloqueo agregados en puntos posteriores a este
  // spec (orden real, CLAUDE.md punto 504): Términos → asistente de
  // facturación → tour guiado. "admin"/"t1" es una cuenta fija de
  // fixture — nunca debe quedar marcada como "ya aceptó"/"ya vio el
  // tour" de forma permanente del lado del servidor por accidente, así
  // que se resuelven aquí sin tocar ninguna decisión real de negocio.
  const terminosGate = page.locator('#terminos-gate-overlay');
  if (await terminosGate.isVisible().catch(() => false)) {
    await page.locator('#terminos-gate-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    const nombreField = page.locator('#terminos-gate-nombre-field');
    if (await nombreField.isVisible().catch(() => false)) {
      await page.fill('#terminos-gate-nombre-input', 'E2E Admin T1');
    }
    await expect(page.locator('#terminos-gate-chk')).toBeEnabled({ timeout: 5000 });
    await page.check('#terminos-gate-chk');
    await page.click('#terminos-gate-btn');
    await expect(terminosGate).toBeHidden({ timeout: 10000 });
  }
  const asistenteFacturacion = page.locator('#asistente-facturacion-overlay');
  if (await asistenteFacturacion.isVisible().catch(() => false)) {
    await page.click('#asistente-facturacion-no');
  }
  const tour = page.locator('#onboarding-tour-overlay');
  if (await tour.isVisible().catch(() => false)) {
    await page.click('#btn-onboarding-tour-saltar');
  }
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
    // El grupo "Cuenta" (dueño de Configuraciones) arranca colapsado en
    // una sesión nueva de este fixture — expandirlo antes de clickear,
    // o el botón queda clicado dentro de un acordeón de alto 0 (el nav
    // "intercepta" el clic, ajeno a lo que prueba este spec).
    const grupoCuenta = page.locator('.admin-sidebar-group-header[data-grupo="cuenta"]');
    if ((await grupoCuenta.getAttribute('aria-expanded')) === 'false') {
      await grupoCuenta.click();
    }
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
