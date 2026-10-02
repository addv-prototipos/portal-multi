// E2E de "Gestión de crédito" en Mi Cuenta (segmento 3 del punto en
// curso, ver conversación del 2026-10-02): visibilidad de CxC + historial
// real de abonos para el cliente logueado, vinculado por correo. Corre
// contra el tenant real "t1" (Ventas/CxC activos por defecto, Facturación
// apagada — sin relación con este módulo), creando y limpiando su propio
// usuario + ventas + abono vía la API de /admin.

import { test, expect, APIRequestContext } from '@playwright/test';

const EMAIL_PRUEBA = 'qa-mi-cuenta-credito-e2e@example.com';
const PASSWORD = 'ClaveCreditoE2E1';

function auth() {
  return { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
}

async function buscarUsuarioPorEmail(request: APIRequestContext) {
  const lista = await request.get('/t1/api/admin/usuarios?perfil=cliente', { headers: auth() });
  const data = await lista.json();
  const usuarios = Array.isArray(data) ? data : data.usuarios || [];
  return usuarios.find((u: any) => u.email === EMAIL_PRUEBA);
}

async function crearUsuarioPrueba(request: APIRequestContext) {
  const res = await request.post('/t1/api/admin/usuarios', {
    headers: auth(),
    data: { rfc: 'QACR900101CD2', telefono: '5500000098', email: EMAIL_PRUEBA, password: PASSWORD, perfil: 'cliente' },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`No se pudo crear el usuario de prueba: ${res.status()}`);
  }
}

// Venta pendiente + abono parcial — crea el escenario real que la UI debe
// reflejar (resumen con saldo pendiente, 1 venta pendiente, 1 abono).
async function crearVentaConAbono(request: APIRequestContext): Promise<number> {
  const venta = await request.post('/t1/api/admin/ordenes-compra', {
    headers: auth(),
    data: {
      concepto: 'Venta E2E crédito',
      cantidad: 500,
      email: EMAIL_PRUEBA,
      es_cliente_nuevo: true,
      estado_pago: 'pendiente',
    },
  });
  if (!venta.ok()) throw new Error(`No se pudo crear la venta de prueba: ${venta.status()}`);
  const ventaData = await venta.json();

  const cobro = await request.put(`/t1/api/admin/ordenes-compra/${ventaData.id}/cobro`, {
    headers: auth(),
    data: { monto: 150, notas_cobro: 'Abono E2E' },
  });
  if (!cobro.ok()) throw new Error(`No se pudo registrar el abono de prueba: ${cobro.status()}`);

  return ventaData.id;
}

async function limpiarOrdenesDePrueba(request: APIRequestContext) {
  const lista = await request.get('/t1/api/admin/ordenes-compra', { headers: auth() });
  if (!lista.ok()) return;
  const data = await lista.json();
  const ordenes = (data.ordenes || []).filter((o: any) => o.email === EMAIL_PRUEBA);
  for (const orden of ordenes) {
    // eslint-disable-next-line no-await-in-loop
    await request.delete(`/t1/api/admin/ordenes-compra/${orden.id}`, { headers: auth() });
  }
}

async function eliminarUsuarioPrueba(request: APIRequestContext) {
  const fila = await buscarUsuarioPorEmail(request);
  if (fila) await request.delete(`/t1/api/admin/usuarios/${fila.id}`, { headers: auth() });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await limpiarOrdenesDePrueba(request); // por si quedó de una corrida interrumpida
  await eliminarUsuarioPrueba(request);
  await crearUsuarioPrueba(request);
  await crearVentaConAbono(request);
});

test.afterAll(async ({ request }) => {
  await limpiarOrdenesDePrueba(request);
  await eliminarUsuarioPrueba(request);
});

test('Gestión de crédito muestra resumen, venta pendiente y abono reales', async ({ page }) => {
  await page.goto('/t1/login');
  await page.fill('#login-rfc', EMAIL_PRUEBA);
  await page.fill('#login-password', PASSWORD);
  await page.click('#btn-login');
  await expect(page).toHaveURL(/\/t1\/dashboard$/);

  await page.goto('/t1/mi-cuenta');
  const seccion = page.locator('#credito-section');
  await expect(seccion).toBeVisible();

  await expect(page.locator('#credito-kpi-total')).toHaveText('$580.00');
  await expect(page.locator('#credito-kpi-pagado')).toHaveText('$150.00');
  await expect(page.locator('#credito-kpi-saldo')).toHaveText('$430.00');

  await expect(page.locator('#credito-ventas-body tr')).toHaveCount(1);
  await expect(page.locator('#credito-ventas-body')).toContainText('$430.00');

  await expect(page.locator('#credito-abonos-body tr')).toHaveCount(1);
  await expect(page.locator('#credito-abonos-body')).toContainText('$150.00');
  await expect(page.locator('#credito-abonos-body')).toContainText('Abono E2E');
});

test('Cliente sin ventas ve el estado vacío, no la sección oculta', async ({ page, request }) => {
  const emailVacio = 'qa-mi-cuenta-credito-vacio-e2e@example.com';
  const passwordVacio = 'ClaveCreditoVacioE2E1';
  await request.post('/t1/api/admin/usuarios', {
    headers: auth(),
    data: { rfc: 'QACR900101CD3', telefono: '5500000097', email: emailVacio, password: passwordVacio, perfil: 'cliente' },
  });

  await page.goto('/t1/login');
  await page.fill('#login-rfc', emailVacio);
  await page.fill('#login-password', passwordVacio);
  await page.click('#btn-login');
  await expect(page).toHaveURL(/\/t1\/dashboard$/);

  await page.goto('/t1/mi-cuenta');
  await expect(page.locator('#credito-section')).toBeVisible();
  await expect(page.locator('#credito-kpi-total')).toHaveText('$0.00');
  await expect(page.locator('#credito-ventas-empty')).toBeVisible();
  await expect(page.locator('#credito-abonos-empty')).toBeVisible();

  const listaUsuarios = await request.get('/t1/api/admin/usuarios?perfil=cliente', { headers: auth() });
  const data = await listaUsuarios.json();
  const fila = (Array.isArray(data) ? data : data.usuarios || []).find((u: any) => u.email === emailVacio);
  if (fila) await request.delete(`/t1/api/admin/usuarios/${fila.id}`, { headers: auth() });
});
