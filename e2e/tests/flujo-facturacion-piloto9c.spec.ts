// Prueba funcional del flujo completo de facturación en el tenant real
// "piloto9c" (validación manual en navegador — corre con --headed):
//
//   PARTE 1 — SOLICITUD DE FACTURA (portal del cliente):
//     1. Registro de cuenta (RFC + correo + teléfono + contraseña).
//     2. Subida de Constancia de Situación Fiscal (CSF, PDF real que
//        pdf-parse puede leer y que contiene los indicadores SAT).
//     3. El admin crea una orden de compra a nombre del correo del
//        cliente (la config de piloto9c exige orden de compra para
//        facturar, y fecha/hora/total deben coincidir con la orden).
//     4. Solicitud de factura: sube imagen del comprobante + datos de
//        la orden (número, fecha, hora, total) + uso CFDI + tipo pago.
//     5. Se genera el folio TK-… y el ticket queda "pendiente".
//
//   PARTE 2 — GENERACIÓN DE LA FACTURA (panel admin del tenant):
//     6. Login admin (admin:admin, cuenta de respaldo del tenant).
//     7. Vista de tickets → abre el ticket → sube el ZIP de la factura
//        (PDF + XML) → el ticket queda "listo".
//     8. El cliente ve el ticket "listo" en su dashboard y descarga la
//        factura.
//
// Los fixtures viven en e2e/fixtures/: constancia.pdf (CSF de
// AAMA850101HDF con indicadores SAT), imagen-ticket.jpg (comprobante
// JPG real) y factura.zip (factura PDF + XML, directorio central
// válido). El spec usa dos contextos de navegador (cliente con cookie
// de sesión, admin con Basic Auth en localStorage) porque la sesión
// del portal y la del panel son mecanismos separados.

import { test, expect } from '@playwright/test';
import { join } from 'path';

const SLUG = 'piloto9c';
const RFC_CLIENTE = 'AAMA850101HDF';
const EMAIL_CLIENTE = 'aama850101hdf@e2e.com';
const PASSWORD_CLIENTE = 'ClaveCliente1';
const TELEFONO = '5512345678';
const FIX = join(__dirname, '..', 'fixtures');

test.describe.configure({ mode: 'serial' });

let folioTicket = '';
let numeroCompra = '';
let totalCompra = '';
let fechaCompra = '';
let horaCompra = '';

const AUTH_ADMIN = 'Basic ' + Buffer.from('admin:admin').toString('base64');

// Limpieza de datos residuales de corridas anteriores: borra de forma
// permanente todos los tickets del tenant (activos y de papelera) para
// que cada corrida arranque limpia y el modal de "tickets pendientes sin
// correo de contador" no bloquee el panel del admin.
test.beforeAll(async ({ request }) => {
  const headers = { Authorization: AUTH_ADMIN };
  for (const papelera of [false, true]) {
    const ruta = `/${SLUG}/api/admin/tickets${papelera ? '?papelera=true' : ''}`;
    const res = await request.get(ruta, { headers });
    if (!res.ok()) return;
    const data = await res.json();
    for (const t of data.tickets ?? []) {
      await request.delete(`/${SLUG}/api/admin/tickets/${t.id}/permanente`, { headers });
    }
  }
});

// La notificación de tickets pendientes sin correo de contador aparece al
// cargar el dashboard del admin y bloquea la UI — se cierra si aparece.
async function cerrarNotifTickets(page: import('@playwright/test').Page) {
  const notifOverlay = page.locator('#notif-tickets-overlay');
  await notifOverlay.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await notifOverlay.isVisible()) {
    await page.click('#btn-notif-tickets-cerrar');
  }
}

test('cliente se registra y sube su Constancia de Situación Fiscal', async ({ browser }) => {
  const contextoCliente = await browser.newContext();
  const page = await contextoCliente.newPage();
  test.slow();

  await page.goto(`/${SLUG}/login`);

  // Idempotente: si el RFC ya se registró en una corrida anterior, se
  // hace login directo; si no existe la cuenta, se registra.
  await page.fill('#login-rfc', RFC_CLIENTE);
  await page.fill('#login-password', PASSWORD_CLIENTE);
  await page.click('#btn-login');
  const redirigio = await page
    .waitForURL(new RegExp(`/${SLUG}/dashboard`), { timeout: 4000 })
    .then(() => true)
    .catch(() => false);

  if (!redirigio) {
    await page.click('#btn-ir-registro');
    await page.fill('#registro-rfc', RFC_CLIENTE);
    await page.fill('#registro-email', EMAIL_CLIENTE);
    await page.fill('#registro-telefono', TELEFONO);
    await page.fill('#registro-password', PASSWORD_CLIENTE);
    await page.fill('#registro-password-confirmar', PASSWORD_CLIENTE);
    await page.click('#btn-registro');
    await page.waitForURL(new RegExp(`/${SLUG}/dashboard`));
  }

  // CSF: datos de la constancia (persona física). Con sesión activa el
  // RFC viene pre-llenado y readonly (bloqueado) — solo se elige tipo
  // de persona y el correo (editable o pre-llenado según la cuenta).
  await page.goto(`/${SLUG}/csf`);
  await page.check('input[name="tipo_persona"][value="fisica"]');
  const emailEditable = await page.locator('#email').isEditable();
  if (emailEditable) {
    await page.fill('#email', EMAIL_CLIENTE);
  }
  await page.click('#form-datos button[type="submit"]');
  await page.setInputFiles('#input-archivo', join(FIX, 'constancia-grande.pdf'));
  await page.click('#btn-submit');

  // Idempotente: si ya existe una constancia previa (corridas anteriores)
  // el backend responde DUPLICADO y aparece el modal de reemplazo; hay que
  // confirmarlo antes de que el flujo continúe.
  const mensaje = page.locator('#mensaje-confirmacion');
  const modal = page.locator('#modal-overlay:not([hidden]), .modal-overlay:not([hidden])');
  await Promise.race([
    mensaje.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'mensaje'),
    modal.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'modal'),
  ]).then(async (ganador) => {
    if (ganador === 'modal') {
      await page.click('#btn-modal-confirmar');
      await expect(mensaje).toBeVisible({ timeout: 15000 });
    }
  });
  await contextoCliente.close();
});

test('admin crea la orden de compra del cliente', async ({ browser }) => {
  const contextoAdmin = await browser.newContext();
  const page = await contextoAdmin.newPage();
  test.slow();

  await page.goto(`/${SLUG}/admin`);
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await expect(page.locator('#admin-dashboard')).toBeVisible();

  await cerrarNotifTickets(page);

  await page.click('#btn-vista-ordenes');
  await page.fill('#orden-concepto', 'Servicio de facturación E2E');
  await page.fill('#orden-cantidad', '100.00');

  // El desplegable solo lista correos con constancia activa; el fetch es
  // asíncrono, así que se espera la opción real (state attached: los
  // <option> nunca son "visible" para Playwright).
  await page.waitForSelector(`#orden-email option[value="${EMAIL_CLIENTE}"]`, { state: 'attached', timeout: 15000 });
  await page.selectOption('#orden-email', { label: EMAIL_CLIENTE });
  expect(await page.inputValue('#orden-email')).toBe(EMAIL_CLIENTE);

  const respuesta = page.waitForResponse(
    (r) => r.url().includes('/api/admin/ordenes-compra') && r.request().method() === 'POST'
  );
  await page.click('#btn-registrar-orden');
  const res = await respuesta;
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.numero_compra).toMatch(/^OC-/);

  numeroCompra = body.numero_compra;
  totalCompra = String(body.total);
  fechaCompra = body.fecha_compra.fecha;
  horaCompra = body.fecha_compra.hora;

  await contextoAdmin.close();
});

test('cliente solicita la factura (ticket con imagen y datos de la orden)', async ({ browser }) => {
  const contextoCliente = await browser.newContext();
  const page = await contextoCliente.newPage();
  test.slow();

  await page.goto(`/${SLUG}/login`);
  await page.fill('#login-rfc', RFC_CLIENTE);
  await page.fill('#login-password', PASSWORD_CLIENTE);
  await page.click('#btn-login');
  await page.waitForURL(new RegExp(`/${SLUG}/dashboard`));

  await page.goto(`/${SLUG}/tickets`);

  // La sección de orden de compra está visible (config lo exige)
  await expect(page.locator('#compra-verificacion-seccion')).toBeVisible();

  await page.fill('#ticket-numero-compra', numeroCompra);
  await page.fill('#ticket-total-compra', totalCompra);
  await page.fill('#ticket-fecha-compra', fechaCompra);
  await page.fill('#ticket-hora-compra', horaCompra);
  await page.selectOption('#ticket-uso-cfdi', { index: 1 });
  await page.selectOption('#ticket-tipo-pago', 'transferencia');
  await page.fill('#ticket-comentarios', 'Solicitud de factura del flujo E2E funcional');

  await page.setInputFiles('#input-imagen', join(FIX, 'imagen-ticket.jpg'));
  await page.click('#btn-subir-ticket');

  await expect(page.locator('#folio-generado')).toBeVisible({ timeout: 15000 });
  folioTicket = (await page.locator('#folio-generado').textContent()).trim();
  expect(folioTicket).toMatch(/^TK-/);

  await contextoCliente.close();
});

test('admin abre el ticket y sube la factura (ZIP con PDF+XML) → "listo"', async ({ browser }) => {
  const contextoAdmin = await browser.newContext();
  const page = await contextoAdmin.newPage();
  test.slow();

  await page.goto(`/${SLUG}/admin`);
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await expect(page.locator('#admin-dashboard')).toBeVisible();

  await cerrarNotifTickets(page);

  await page.click('#btn-vista-tickets');

  // Busca la fila del ticket recién creado y abre su modal con "Gestionar"
  const fila = page.locator('#tickets-table-body tr', { hasText: folioTicket });
  await expect(fila).toBeVisible({ timeout: 15000 });
  await fila.locator('.btn-ver').click();

  await expect(page.locator('#ticket-modal-overlay')).toBeVisible();
  await expect(page.locator('#ticket-modal-title')).toContainText(folioTicket);

  await page.setInputFiles('#ticket-modal-factura-input', join(FIX, 'factura.zip'));
  await page.click('#btn-ticket-subir-factura');

  // El backend valida el ZIP (firma PK + contiene .pdf y .xml) y marca "listo"
  await expect(page.locator('#ticket-toast, .toast')).toContainText('Factura cargada', {
    timeout: 15000,
  });
  await expect(page.locator('#ticket-modal-overlay')).toBeHidden();

  // La fila ahora muestra estatus "listo"
  await expect(fila.locator('.estatus-badge')).toHaveText('Listo', { timeout: 15000 });

  await contextoAdmin.close();
});

test('el cliente ve la factura "lista" y la descarga desde el dashboard', async ({ browser }) => {
  const contextoCliente = await browser.newContext();
  const page = await contextoCliente.newPage();
  test.slow();

  await page.goto(`/${SLUG}/login`);
  await page.fill('#login-rfc', RFC_CLIENTE);
  await page.fill('#login-password', PASSWORD_CLIENTE);
  await page.click('#btn-login');
  await page.waitForURL(new RegExp(`/${SLUG}/dashboard`));

  const fila = page.locator('#solicitudes-tbody tr', { hasText: folioTicket });
  await expect(fila).toBeVisible({ timeout: 15000 });
  await expect(fila.locator('.estatus-badge, .status-badge')).toHaveText('Listo');

  const descarga = page.waitForEvent('download');
  await fila.locator('.btn-descargar-factura').click();
  const descargado = await descarga;
  expect(descargado.suggestedFilename()).toMatch(/factura|\.zip/i);

  await contextoCliente.close();
});