// E2E del módulo Pedidos (kanban de cotizaciones, PROJECT_STATE.md punto
// 508, Segmento 7) — verifica contra Docker/MySQL reales el flujo
// completo: alta manual, mover entre columnas, cancelar, pestaña de
// Reportes, tarjetas gateadas de Resumen financiero y la categoría del
// Centro de conocimiento — más el candado por plan (pedidos depende de
// Ventas) en los 4 puntos donde se expone.
//
// No existe en esta base de datos un tenant fijo "t1" como el que usa
// admin-plan-gating.spec.ts (se perdió en algún reset de Docker anterior
// a este punto) — se usan 2 tenants reales ya existentes en el entorno
// de desarrollo en vez de crear uno nuevo:
//   - "panes" (PAN): ventas_habilitado=1, inventarios_habilitado=1,
//     pedidos_habilitado=1 → módulo completo visible.
//   - "prueba-cancel-8" (PBC8): ventas_habilitado=0,
//     pedidos_habilitado=1 (heredado del backfill "activo para todos"
//     del punto 508) → caso real de un plan viejo con el flag propio en
//     1 pero su dependencia (Ventas) apagada; sirve para probar el
//     candado AND, no solo el flag suelto.
// Mismo criterio que el spec de t1: la contraseña de ambas cuentas se
// fija UNA VEZ antes de la corrida (nunca dentro de un test, nunca con
// root — usuario "app", mismo privilegio con el que corre el backend) y
// el spec no vuelve a tocarla. Formato real salt:hash de
// backend/utils/authUsuario.js:hashPassword — nunca tocar así una
// contraseña de un tenant de producción.

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test.describe.configure({ mode: 'serial' });

const E2E_PASSWORD_HASH =
  '0e15f300fa19630463a897541e7b6fef:254dd5987f430bca24c8badc3eccebce3695e4747ae07f7a9b72e5522dbb05f824cd29737bdaab38a36c87904bf20f84d619c1bd26a40c98b8035f6d339d7394';
const E2E_PASSWORD = 'ClarvoE2E2026!';
const REPO_ROOT = path.resolve(__dirname, '../..');

test.beforeAll(() => {
  const base = 'docker compose exec -T mysql mysql -u app -pchangeme_app_password';
  execSync(
    `${base} -D tenant_panes -e "UPDATE usuarios SET password_hash='${E2E_PASSWORD_HASH}' WHERE rfc='PAN';"`,
    { cwd: REPO_ROOT, stdio: 'pipe' }
  );
  execSync(
    `${base} -D "tenant_prueba-cancel-8" -e "UPDATE usuarios SET password_hash='${E2E_PASSWORD_HASH}' WHERE rfc='PBC8';"`,
    { cwd: REPO_ROOT, stdio: 'pipe' }
  );
});

async function loginAdminTenant(page, slug: string, usuario: string) {
  // Viewport más alto que el default (720px) — con pocos grupos del
  // sidebar activos (caso de prueba-cancel-8) el layout deja algunos
  // encabezados de grupo flotando sobre el nav en una ventana baja,
  // sin relación con Pedidos; una ventana más alta evita ese ruido.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/${slug}/admin`);
  await page.fill('#admin-user', usuario);
  await page.fill('#admin-pass', E2E_PASSWORD);
  await page.click('#btn-login');
  await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });
  // Orden real de prioridad de los overlays de bienvenida/bloqueo al
  // primer login (CLAUDE.md punto 504): Términos → asistente de
  // facturación → aviso fiscal → tour guiado. Cerrarlos si aparecen, sin
  // tocar ninguna decisión real que ofrezcan.

  // Gate de Términos y Condiciones — exige scroll real hasta el final
  // del documento antes de habilitar el checkbox/botón. Se dispara por
  // cuenta (una vez aceptado, no vuelve) — PBC8 nunca lo había aceptado
  // en este entorno, PAN sí (sesión manual previa).
  const terminosGate = page.locator('#terminos-gate-overlay');
  if (await terminosGate.isVisible().catch(() => false)) {
    await page.locator('#terminos-gate-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    // El nombre (si falta) debe llenarse ANTES de esperar el checkbox
    // habilitado — actualizarEstadoChkTerminos() exige scroll completo Y
    // nombre válido a la vez, nunca solo el primero.
    const nombreField = page.locator('#terminos-gate-nombre-field');
    if (await nombreField.isVisible().catch(() => false)) {
      await page.fill('#terminos-gate-nombre-input', 'E2E Pedidos');
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
  const avisoFiscal = page.locator('#config-fiscal-faltante-overlay');
  if (await avisoFiscal.isVisible().catch(() => false)) {
    await page.click('#btn-config-fiscal-faltante-cerrar');
  }
  // El tour guiado se dispara siempre en un contexto nuevo de Playwright
  // (su "ya visto" vive en localStorage del navegador, no solo en el
  // estado de onboarding del servidor) — saltarlo, nunca completarlo.
  const tour = page.locator('#onboarding-tour-overlay');
  if (await tour.isVisible().catch(() => false)) {
    await page.click('#btn-onboarding-tour-saltar');
  }
}

test.describe('Pedidos — tenant "panes" (ventas + pedidos activos)', () => {
  test('kanban: alta manual, columnas, mover y cancelar', async ({ page }) => {
    await loginAdminTenant(page, 'panes', 'PAN');

    await expect(page.locator('#btn-vista-pedidos')).toBeVisible();
    await page.click('#btn-vista-pedidos');
    await expect(page.locator('#vista-pedidos')).toBeVisible();

    const columnas = ['Pedido', 'En progreso', 'Por confirmar', 'Entregado', 'Cancelado'];
    for (const col of columnas) {
      await expect(page.locator('.pedidos-col-lbl', { hasText: col })).toBeVisible();
    }

    const clienteUno = `E2E Cliente ${Date.now()}`;
    await page.click('#btn-nuevo-pedido');
    await expect(page.locator('#pedido-nuevo-modal-overlay')).toBeVisible();
    await page.fill('#pedido-nuevo-concepto', 'Venta de prueba E2E — 10 bultos de cemento');
    await page.fill('#pedido-nuevo-cantidad', '1500');
    await page.fill('#pedido-nuevo-nombre', clienteUno);
    await page.click('#btn-pedido-nuevo-guardar');
    await expect(page.locator('#pedido-nuevo-modal-overlay')).toBeHidden({ timeout: 10000 });

    const tarjetaUno = page.locator('.pedidos-card', { hasText: clienteUno });
    await expect(tarjetaUno).toBeVisible();
    await expect(
      tarjetaUno.locator('xpath=ancestor::div[contains(@class,"pedidos-col")]//span[contains(@class,"pedidos-col-lbl")]')
    ).toHaveText('Pedido');

    // Mover a "En progreso" con el select de la propia tarjeta.
    await tarjetaUno.locator('select.pedidos-card-mover').selectOption('progreso');
    await page.waitForTimeout(500);
    const tarjetaUnoMovida = page.locator('.pedidos-card', { hasText: clienteUno });
    await expect(
      tarjetaUnoMovida.locator('xpath=ancestor::div[contains(@class,"pedidos-col")]//span[contains(@class,"pedidos-col-lbl")]')
    ).toHaveText('En progreso');

    // Segundo pedido, cancelado con motivo.
    const clienteDos = `E2E Cancelar ${Date.now()}`;
    await page.click('#btn-nuevo-pedido');
    await page.fill('#pedido-nuevo-concepto', 'Pedido que se va a cancelar');
    await page.fill('#pedido-nuevo-cantidad', '300');
    await page.fill('#pedido-nuevo-nombre', clienteDos);
    await page.click('#btn-pedido-nuevo-guardar');
    await expect(page.locator('#pedido-nuevo-modal-overlay')).toBeHidden({ timeout: 10000 });

    const tarjetaDos = page.locator('.pedidos-card', { hasText: clienteDos });
    await tarjetaDos.locator('.btn-icono-accion').click();
    await page.locator('.pedidos-menu button[data-accion="cancelar"]').click();
    await expect(page.locator('#pedido-cancelar-modal-overlay')).toBeVisible();
    await page.fill('#pedido-cancelar-motivo', 'Motivo de prueba E2E');
    await page.click('#btn-pedido-cancelar-confirmar');
    await expect(page.locator('#pedido-cancelar-modal-overlay')).toBeHidden({ timeout: 10000 });

    const tarjetaDosCancelada = page.locator('.pedidos-card', { hasText: clienteDos });
    await expect(
      tarjetaDosCancelada.locator('xpath=ancestor::div[contains(@class,"pedidos-col")]//span[contains(@class,"pedidos-col-lbl")]')
    ).toHaveText('Cancelado');
    await expect(tarjetaDosCancelada.locator('.pedidos-card-pie.is-cancelado')).toHaveText('Motivo de prueba E2E');
  });

  // Punto 513: edición en cualquier momento (desde el detalle) + drag
  // and drop entre columnas, además del <select> de siempre.
  test('detalle: edita tipo, cliente, cantidad y monto de un pedido abierto', async ({ page }) => {
    await loginAdminTenant(page, 'panes', 'PAN');
    await page.click('#btn-vista-pedidos');

    const cliente = `E2E Editar ${Date.now()}`;
    await page.click('#btn-nuevo-pedido');
    await page.fill('#pedido-nuevo-concepto', 'Pedido para editar después');
    await page.fill('#pedido-nuevo-cantidad', '500');
    await page.fill('#pedido-nuevo-nombre', cliente);
    await page.click('#btn-pedido-nuevo-guardar');
    await expect(page.locator('#pedido-nuevo-modal-overlay')).toBeHidden({ timeout: 10000 });

    const tarjeta = page.locator('.pedidos-card', { hasText: cliente });
    await tarjeta.click();
    await expect(page.locator('#pedido-detalle-modal-overlay')).toBeVisible();

    // El formulario de edición real debe estar presente (no solo texto
    // plano como en un pedido ya cerrado).
    await expect(page.locator('#pedido-detalle-concepto')).toBeVisible();
    await expect(page.locator('#pedido-detalle-tipo-pedido')).toBeVisible();

    const clienteEditado = `${cliente} (editado)`;
    await page.click('#pedido-detalle-tipo-pedido');
    await page.fill('#pedido-detalle-nombre', clienteEditado);
    await page.click('#btn-pedido-detalle-cantidad-mas');
    await page.fill('#pedido-detalle-monto', '650');
    await page.click('#btn-pedido-detalle-guardar');
    await expect(page.locator('#pedido-detalle-modal-overlay')).toBeHidden({ timeout: 10000 });

    const tarjetaEditada = page.locator('.pedidos-card', { hasText: clienteEditado });
    await expect(tarjetaEditada).toBeVisible();
    await expect(tarjetaEditada.locator('.pedidos-card-tipo')).toHaveText('Pedido');
    await expect(tarjetaEditada.locator('.pedidos-card-total')).toHaveText('$650.00');
  });

  test('drag and drop: arrastra una tarjeta de "Pedido" a "En progreso"', async ({ page }) => {
    await loginAdminTenant(page, 'panes', 'PAN');
    await page.click('#btn-vista-pedidos');

    const cliente = `E2E Drag ${Date.now()}`;
    await page.click('#btn-nuevo-pedido');
    await page.fill('#pedido-nuevo-concepto', 'Pedido para arrastrar');
    await page.fill('#pedido-nuevo-cantidad', '800');
    await page.fill('#pedido-nuevo-nombre', cliente);
    await page.click('#btn-pedido-nuevo-guardar');
    await expect(page.locator('#pedido-nuevo-modal-overlay')).toBeHidden({ timeout: 10000 });

    const tarjeta = page.locator('.pedidos-card', { hasText: cliente });
    await expect(tarjeta).toBeVisible();

    // Playwright `dragTo()` simula mousedown/mousemove/mouseup — nunca
    // dispara los eventos reales `dragstart/dragover/drop` de la API
    // HTML5 Drag and Drop (`draggable="true"`) que usa el kanban. Mismo
    // criterio ya probado a mano con Chrome DevTools MCP antes de
    // escribir este test: disparar los 4 eventos reales con un
    // `DataTransfer` real es lo único que de verdad ejercita el código
    // de producción (`dragstart` en la tarjeta, `dragover`/`drop` en la
    // columna lateral destino).
    await page.evaluate((clienteTexto) => {
      const card = Array.from(document.querySelectorAll('.pedidos-card')).find((c) => c.textContent?.includes(clienteTexto));
      const columnas = Array.from(document.querySelectorAll('.pedidos-col'));
      const colDestino = columnas.find((c) => c.querySelector('.pedidos-col-lbl')?.textContent === 'En progreso');
      const bodyDestino = colDestino?.querySelector('.pedidos-col-body');
      if (!card || !bodyDestino) throw new Error('No se encontró la tarjeta o la columna destino.');
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
      bodyDestino.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      bodyDestino.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      card.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
    }, cliente);
    await page.waitForTimeout(700);

    const tarjetaMovida = page.locator('.pedidos-card', { hasText: cliente });
    await expect(
      tarjetaMovida.locator('xpath=ancestor::div[contains(@class,"pedidos-col")]//span[contains(@class,"pedidos-col-lbl")]')
    ).toHaveText('En progreso');
  });

  test('reportes: pestaña Pedidos visible y carga sin error', async ({ page }) => {
    await loginAdminTenant(page, 'panes', 'PAN');

    await page.click('#btn-vista-lectura-reportes');
    await expect(page.locator('#btn-sidebar-reportes-pedidos')).toBeVisible();
    await page.click('#btn-sidebar-reportes-pedidos');
    await expect(page.locator('#reportes-vista-pedidos')).toBeVisible();
    await expect(page.locator('#reportes-pedidos-error')).toBeEmpty();
    await expect(page.locator('#reportes-pedidos-resumen')).toBeVisible();
  });

  test('resumen financiero: al menos una tarjeta de Pedidos visible', async ({ page }) => {
    await loginAdminTenant(page, 'panes', 'PAN');

    await page.click('#btn-vista-resumen-financiero');
    await expect(page.locator('#vista-resumen-financiero')).toBeVisible();
    await expect(page.locator('[data-dashboard-id="pedidos-pipeline"]')).toBeVisible({ timeout: 10000 });
  });

  test('centro de conocimiento: categoría Pedidos visible y con contenido', async ({ page }) => {
    await loginAdminTenant(page, 'panes', 'PAN');

    await page.click('#btn-abrir-conocimiento-topbar');
    await expect(page.locator('#conocimiento-modal-overlay')).toBeVisible();
    const navPedidos = page.locator('.conocimiento-nav-item[data-cat="pedidos"]');
    await expect(navPedidos).toBeVisible();
    await navPedidos.click();
    await expect(page.locator('#conocimiento-modal-title')).toHaveText('Pedidos');
    await expect(page.locator('#conocimiento-modal-main-body')).not.toBeEmpty();
  });
});

test.describe('Pedidos — tenant "prueba-cancel-8" (ventas apagado, pedidos_habilitado=1 heredado)', () => {
  test('sin Ventas: Pedidos queda oculto en sidebar, reportes, dashboard y conocimiento', async ({ page }) => {
    await loginAdminTenant(page, 'prueba-cancel-8', 'PBC8');

    // Sidebar: candado real (línea ~3102 de admin.js) ya combinaba
    // ventasHabilitado + pedidosHabilitado — este caso solo confirma que
    // sigue así.
    await expect(page.locator('#btn-vista-pedidos')).toBeHidden();

    // Reportes → pestaña Pedidos: fix de este segmento (pestanaReportesVisible
    // solo miraba pedidosHabilitado, nunca ventasHabilitado).
    await page.click('#btn-vista-lectura-reportes');
    await expect(page.locator('#btn-sidebar-reportes-pedidos')).toBeHidden();

    // Resumen financiero: "prueba-cancel-8" (plan Solicita) tiene esa
    // vista completa apagada por su propio flag
    // (resumenFinancieroHabilitado), independiente de Pedidos — no hay
    // hoy un tenant real con Resumen financiero ON y Ventas OFF para
    // ejercitar el clic. Si la vista es alcanzable, confirma el fix de
    // este segmento (aplicarVisibilidadTarjetasDashboard mismo hueco);
    // si no, la vista oculta ya cubre el caso por completo.
    const btnResumenFinanciero = page.locator('#btn-vista-resumen-financiero');
    if (await btnResumenFinanciero.isVisible().catch(() => false)) {
      await btnResumenFinanciero.click();
      await expect(page.locator('[data-dashboard-id="pedidos-pipeline"]')).toBeHidden();
      await expect(page.locator('[data-dashboard-id="pedidos-saldo-cxc"]')).toBeHidden();
    } else {
      await expect(btnResumenFinanciero).toBeHidden();
    }

    // Centro de conocimiento: fix de este segmento (categoriaConocimientoVisible
    // mismo hueco).
    await page.click('#btn-abrir-conocimiento-topbar');
    await expect(page.locator('#conocimiento-modal-overlay')).toBeVisible();
    await expect(page.locator('.conocimiento-nav-item[data-cat="pedidos"]')).toBeHidden();
  });
});
