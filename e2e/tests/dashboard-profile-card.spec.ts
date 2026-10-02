// E2E de la card "Tu perfil" del dashboard (punto 358 — Propuesta 3
// aprobada por el usuario): la card solo se muestra cuando el cliente
// aún NO tiene nombre capturado; con nombre guardado desaparece. Corre
// contra el tenant real "t1", creando y limpiando su propio usuario de
// prueba vía la API de /admin (mismo patrón que mi-cuenta.spec.ts).

import { test, expect, APIRequestContext } from '@playwright/test';

const RFC_PROPUESTO = 'QAPC900101AB1';
const EMAIL_PRUEBA = 'qa-profile-card-e2e@example.com';
const PASSWORD_PRUEBA = 'ClaveQA123';
const NOMBRE_PRUEBA = 'Cliente Card Perfil E2E';

function auth() {
  return { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
}

async function buscarPorEmail(request: APIRequestContext, email: string) {
  const lista = await request.get('/t1/api/admin/usuarios?perfil=cliente', { headers: auth() });
  const data = await lista.json();
  const usuarios = Array.isArray(data) ? data : data.usuarios || [];
  return usuarios.find((u: any) => u.email === email);
}

async function crearUsuarioPrueba(request: APIRequestContext) {
  const res = await request.post('/t1/api/admin/usuarios', {
    headers: auth(),
    data: {
      rfc: RFC_PROPUESTO,
      telefono: '5522222222',
      email: EMAIL_PRUEBA,
      password: PASSWORD_PRUEBA,
      perfil: 'cliente',
    },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`No se pudo crear el usuario de prueba: ${res.status()}`);
  }
  const fila = await buscarPorEmail(request, EMAIL_PRUEBA);
  if (!fila) throw new Error('No se encontró el usuario de prueba recién creado.');
}

async function eliminarUsuarioPrueba(request: APIRequestContext) {
  const fila = await buscarPorEmail(request, EMAIL_PRUEBA);
  if (fila) {
    await request.delete(`/t1/api/admin/usuarios/${fila.id}`, { headers: auth() });
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await eliminarUsuarioPrueba(request); // por si quedó de una corrida interrumpida
  await crearUsuarioPrueba(request);
});

test.afterAll(async ({ request }) => {
  await eliminarUsuarioPrueba(request);
});

async function loginCliente(page) {
  await page.goto('/t1/login');
  await page.fill('#login-rfc', EMAIL_PRUEBA);
  await page.fill('#login-password', PASSWORD_PRUEBA);
  await page.click('#btn-login');
  await expect(page).toHaveURL(/\/t1\/dashboard$/);
}

test('sin nombre: la card de perfil se muestra con status y anillo 50%', async ({ page }) => {
  await loginCliente(page);

  const card = page.locator('#profile-card');
  await expect(card).toBeVisible();

  await expect(page.locator('#profile-name')).toHaveText('Usuario');
  await expect(page.locator('.profile-status')).toContainText('Perfil incompleto');
  await expect(page.locator('.completion-text')).toHaveText('50%');
  await expect(page.locator('#profile-action')).toContainText('Agregar nombre');

  // sin errores de consola durante la carga del dashboard
  const errores: string[] = [];
  page.on('pageerror', (err) => errores.push(String(err)));
  await page.reload();
  await expect(card).toBeVisible();
  expect(errores).toEqual([]);
});

test('botón "Agregar nombre" lleva a Mi cuenta y al guardar, la card desaparece', async ({ page }) => {
  await loginCliente(page);
  await expect(page.locator('#profile-card')).toBeVisible();

  await page.click('#profile-action');
  await expect(page).toHaveURL(/\/t1\/mi-cuenta$/);

  await page.fill('#datos-nombre', NOMBRE_PRUEBA);
  await page.click('#btn-datos');
  await expect(page.locator('#toast')).toContainText('actualizaron correctamente');

  await page.goto('/t1/dashboard');
  await expect(page.locator('#profile-card')).toBeHidden();
  await expect(page.locator('#portal-user-label')).toHaveText(NOMBRE_PRUEBA);
});
