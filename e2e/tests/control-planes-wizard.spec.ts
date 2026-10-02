// E2E del asistente de 4 pasos del catálogo de Planes (punto 349-350-351,
// ver stitch/gobierno-funcionalidades/NOTAS.md — 12 reglas de
// dependencia). Crea un plan de prueba aparte (nunca toca Básico/Pro/
// Enterprise, que son el catálogo real del usuario), lo recorre completo
// y lo archiva al final para no ensuciar el catálogo real.

import { test, expect } from '@playwright/test';

// Nombre único por corrida: control_app no tiene permiso DELETE sobre
// `planes` (mismo criterio de credenciales angostas cross-tenant que el
// resto del proyecto), así que "limpieza" solo archiva, nunca borra. Un
// nombre fijo chocaría con el archivado de la corrida anterior en la
// siguiente ejecución — timestamp lo evita sin acumular lógica de reuso.
const NOMBRE_PLAN = `E2E Asistente Wizard ${Date.now()}`;

async function loginControl(page) {
  await page.goto('/control');
  await page.fill('#control-user', 'admin');
  await page.fill('#control-pass', 'admin');
  await page.click('#control-btn-login');
  await expect(page.locator('#control-dashboard')).toBeVisible();
}

async function irAPlanes(page) {
  await page.click('#btn-vista-control-planes');
  await expect(page.locator('#vista-control-planes')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('crea un plan nuevo recorriendo los 4 pasos, con cascadas y bloqueos reales', async ({ page }) => {
  await loginControl(page);
  await irAPlanes(page);

  // Si quedó un plan de una corrida interrumpida, saltamos directo a la
  // aserción final — no reabrimos su modal (los pasos de abajo asumen
  // "Nuevo plan" desde el paso 1, no "Editar plan").
  const filaPrevia = page.locator('#planes-table-body tr', { hasText: NOMBRE_PLAN });
  const esCorridaLimpia = (await filaPrevia.count()) === 0;
  if (esCorridaLimpia) {
    await page.click('#btn-planes-nuevo');
    await expect(page.locator('#planes-modal-overlay')).toBeVisible();
  }

  if (esCorridaLimpia) {
    // ---------- Paso 1: Datos básicos ----------
    await expect(page.locator('.planes-wizard-step.is-active')).toContainText('Datos básicos');
    await page.fill('#planes-nombre', NOMBRE_PLAN);
    await page.fill('#planes-descripcion', 'Plan de prueba E2E — creado por control-planes-wizard.spec.ts');

    // Atrás debe estar oculto en el paso 1.
    await expect(page.locator('#btn-planes-wizard-atras')).toBeHidden();
    await expect(page.locator('#btn-planes-guardar-label')).toHaveText('Siguiente');
    await page.click('#btn-planes-guardar');

    // ---------- Paso 2: Módulos ----------
    await expect(page.locator('.planes-wizard-step.is-active')).toContainText('Módulos');
    await expect(page.locator('#btn-planes-wizard-atras')).toBeVisible();

    // Activa Ventas — debe auto-activar Resumen financiero (toast) y
    // quedar reflejado como tarjeta seleccionada.
    const tarjetaVentas = page.locator('.planes-wizard-modulo-card[data-modulo="ventas_habilitado"]');
    await tarjetaVentas.click();
    await expect(tarjetaVentas).toHaveClass(/is-selected/);
    await expect(page.locator('#control-toast')).toContainText('Resumen financiero se activó automáticamente');

    await page.click('#btn-planes-guardar'); // -> paso 3

    // ---------- Paso 3: Dependientes ----------
    await expect(page.locator('.planes-wizard-step.is-active')).toContainText('Dependientes');

    // Cuentas por cobrar ya debe estar habilitada (Ventas está ON). El
    // input real va oculto detrás de .control-switch-track (mismo patrón
    // que el resto del sitio) — se interactúa por el label, no por
    // .check() directo (el input nunca es "visible" para Playwright).
    const cxcSwitch = page.locator('[data-dep="cxc_habilitado"]');
    await expect(cxcSwitch).toBeEnabled();
    await cxcSwitch.locator('xpath=..').click();
    await expect(cxcSwitch).toBeChecked();

    // Resumen financiero ya viene encendido (auto-activado en el paso 2).
    const resumenSwitch = page.locator('[data-dep="resumen_financiero_habilitado"]');
    await expect(resumenSwitch).toBeChecked();

    // "Estado del inventario" debe estar INHABILITADO (Inventarios sigue
    // apagado) — con el motivo visible, no solo bloqueado al clic.
    const chkEstadoInv = page.locator('[data-reporte="reportes_estado_inventario_habilitado"]');
    await expect(chkEstadoInv).toBeDisabled();
    await expect(page.locator('.planes-wizard-chk-row', { hasText: 'Estado del inventario' })).toContainText('Requiere Inventarios');

    // "Cortes de ventas" SÍ debe estar habilitado (Ventas está ON).
    const chkCortes = page.locator('[data-reporte="reportes_cortes_habilitado"]');
    await expect(chkCortes).toBeEnabled();
    await chkCortes.check();
    await expect(chkCortes).toBeChecked();

    await page.click('#btn-planes-guardar'); // -> paso 4

    // ---------- Paso 4: Resumen ----------
    await expect(page.locator('.planes-wizard-step.is-active')).toContainText('Resumen');
    const filaVentasResumen = page.locator('#planes-wizard-resumen-body tr', { hasText: 'Ventas' }).first();
    await expect(filaVentasResumen.locator('.planes-chip')).toHaveText('Incluido');
    await expect(page.locator('#btn-planes-guardar-label')).toHaveText('Guardar plan');

    await page.click('#btn-planes-guardar');
    await expect(page.locator('#planes-modal-overlay')).toBeHidden();
    await expect(page.locator('#control-toast')).toContainText('Plan creado');
  }

  // Confirma que el plan quedó en la tabla con los chips correctos.
  const fila = page.locator('#planes-table-body tr', { hasText: NOMBRE_PLAN });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('Ventas');
});

test('reabre el plan creado: la cascada apaga Cuentas por cobrar y Cortes al apagar Ventas', async ({ page }) => {
  await loginControl(page);
  await irAPlanes(page);

  const fila = page.locator('#planes-table-body tr', { hasText: NOMBRE_PLAN });
  await expect(fila).toBeVisible();
  await fila.locator('button.btn-icono-accion[aria-label="Editar"]').click();
  await expect(page.locator('#planes-modal-overlay')).toBeVisible();
  await expect(page.locator('#planes-modal-title')).toHaveText('Editar plan');

  // El plan ya tiene 0 empresas asignadas — el banner de la regla 8 NO
  // debe mostrarse (solo aparece con total_tenants > 0).
  await expect(page.locator('#planes-wizard-banner')).toBeHidden();

  // Avanza a paso 2 y apaga Ventas.
  await page.click('#btn-planes-guardar'); // -> paso 2
  const tarjetaVentas = page.locator('.planes-wizard-modulo-card[data-modulo="ventas_habilitado"]');
  await expect(tarjetaVentas).toHaveClass(/is-selected/);
  await tarjetaVentas.click(); // apaga Ventas
  await expect(tarjetaVentas).not.toHaveClass(/is-selected/);

  // La cascada debe haber avisado sobre Resumen financiero y al menos
  // una de las pestañas de Reportes.
  await expect(page.locator('#control-toast')).toContainText(/Resumen financiero|Cortes|Cuentas por cobrar/);

  await page.click('#btn-planes-guardar'); // -> paso 3
  const cxcSwitch = page.locator('[data-dep="cxc_habilitado"]');
  await expect(cxcSwitch).toBeDisabled();
  await expect(cxcSwitch).not.toBeChecked();
  const chkCortes = page.locator('[data-reporte="reportes_cortes_habilitado"]');
  await expect(chkCortes).toBeDisabled();
  await expect(chkCortes).not.toBeChecked();

  await page.click('#btn-planes-guardar'); // -> paso 4
  await page.click('#btn-planes-guardar'); // guardar
  await expect(page.locator('#planes-modal-overlay')).toBeHidden();
  await expect(page.locator('#control-toast')).toContainText('Plan actualizado');
});

test('limpieza: archiva el plan de prueba', async ({ page }) => {
  await loginControl(page);
  await irAPlanes(page);

  const fila = page.locator('#planes-table-body tr', { hasText: NOMBRE_PLAN });
  if (await fila.count() === 0) return; // ya se limpió en una corrida anterior

  await fila.locator('button.btn-icono-accion[aria-label="Archivar"]').click();
  await expect(page.locator('#control-confirm-modal-overlay')).toBeVisible();
  await page.click('#control-btn-confirm-aceptar');
  await expect(page.locator('#control-toast')).toContainText('Plan archivado');
});
