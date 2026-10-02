// E2E de "Mi Cuenta" en el portal de cliente (segmento 1 del punto en
// curso — ver conversación del 2026-10-02): autoservicio de
// nombre/telefono/email + cambio de contraseña con verificación de la
// actual. Corre contra el tenant real "t1", creando y limpiando su
// propio usuario de prueba vía la API de /admin (mismo patrón que
// control-planes-wizard.spec.ts con su plan de prueba).

import { test, expect, APIRequestContext } from '@playwright/test';

// RFC propuesto al crear — el backend lo ignora y genera un identificador
// interno si el tenant tiene Facturación apagada (punto en curso), así
// que este spec nunca busca/filtra por RFC fijo ni loguea con él —
// identifica y entra siempre por correo (estable sin importar el estado
// real de t1). rfcReal solo se captura para confirmar que la fila se
// creó de verdad.
const RFC_PROPUESTO = 'QAMC900101AB1';
const EMAIL_PRUEBA = 'qa-mi-cuenta-e2e@example.com';
const PASSWORD_INICIAL = 'ClaveQA123';
const PASSWORD_NUEVA = 'ClaveQA456Nueva';
let rfcReal = RFC_PROPUESTO;

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
      telefono: '5500000000',
      email: EMAIL_PRUEBA,
      password: PASSWORD_INICIAL,
      perfil: 'cliente',
    },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`No se pudo crear el usuario de prueba: ${res.status()}`);
  }
  const fila = await buscarPorEmail(request, EMAIL_PRUEBA);
  if (!fila) throw new Error('No se encontró el usuario de prueba recién creado.');
  rfcReal = fila.rfc;
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

async function loginCliente(page, rfc: string, password: string) {
  await page.goto('/t1/login');
  await page.fill('#login-rfc', rfc);
  await page.fill('#login-password', password);
  await page.click('#btn-login');
  await expect(page).toHaveURL(/\/t1\/dashboard$/);
}

test('tile "Mi cuenta" visible en el tablero y navega a la página', async ({ page }) => {
  await loginCliente(page, EMAIL_PRUEBA, PASSWORD_INICIAL);
  const tile = page.locator('a.tile', { hasText: 'Mi cuenta' });
  await expect(tile).toBeVisible();
  await tile.click();
  await expect(page).toHaveURL(/\/t1\/mi-cuenta$/);
  await expect(page.locator('h1')).toHaveText('Mi cuenta');
});

test('carga los datos actuales y permite editar nombre/telefono/email', async ({ page }) => {
  await loginCliente(page, EMAIL_PRUEBA, PASSWORD_INICIAL);
  await page.goto('/t1/mi-cuenta');

  await expect(page.locator('#datos-telefono')).toHaveValue('5500000000');
  await expect(page.locator('#datos-email')).toHaveValue('qa-mi-cuenta-e2e@example.com');

  await page.fill('#datos-nombre', 'Cliente de Prueba E2E');
  await page.click('#btn-datos');
  await expect(page.locator('#toast')).toContainText('actualizaron correctamente');

  // Persistencia real: recarga y confirma que el nombre sigue ahí.
  await page.reload();
  await expect(page.locator('#datos-nombre')).toHaveValue('Cliente de Prueba E2E');
});

test('correo duplicado responde 409 y lo muestra como error de campo', async ({ page, request }) => {
  // Segundo usuario con otro correo, para provocar la colisión real contra la BD.
  const emailSegundo = 'ya-existe-e2e@example.com';
  await request.post('/t1/api/admin/usuarios', {
    headers: auth(),
    data: {
      rfc: 'QAMC900101AB2',
      telefono: '5511111111',
      email: emailSegundo,
      password: PASSWORD_INICIAL,
      perfil: 'cliente',
    },
  });

  await loginCliente(page, EMAIL_PRUEBA, PASSWORD_INICIAL);
  await page.goto('/t1/mi-cuenta');
  await page.fill('#datos-email', emailSegundo);
  await page.click('#btn-datos');
  await expect(page.locator('#error-datos-email')).toContainText('ya está en uso');

  // limpieza del segundo usuario (busca por correo — el RFC real pudo
  // quedar como identificador interno, ver nota al inicio del archivo)
  const filaSegundo = await buscarPorEmail(request, emailSegundo);
  if (filaSegundo) await request.delete(`/t1/api/admin/usuarios/${filaSegundo.id}`, { headers: auth() });
});

test('cambiar contraseña: rechaza la actual incorrecta y acepta la correcta', async ({ page }) => {
  await loginCliente(page, EMAIL_PRUEBA, PASSWORD_INICIAL);
  await page.goto('/t1/mi-cuenta');

  await page.fill('#password-actual', 'ClaveIncorrectaXYZ1');
  await page.fill('#password-nueva', PASSWORD_NUEVA);
  await page.fill('#password-confirmar', PASSWORD_NUEVA);
  await page.click('#btn-password');
  await expect(page.locator('#error-password-actual')).toContainText('no es correcta');

  await page.fill('#password-actual', PASSWORD_INICIAL);
  await page.click('#btn-password');
  await expect(page.locator('#toast')).toContainText('actualizada correctamente');
});

test('login real con la nueva contraseña funciona de punta a punta', async ({ page }) => {
  await loginCliente(page, EMAIL_PRUEBA, PASSWORD_NUEVA);
  // La prueba anterior ya guardó un nombre en Mi Cuenta — el header lo
  // prefiere sobre el RFC/identificador interno (ver portal.js), así que
  // a estas alturas el label esperado es ESE nombre, no el RFC crudo.
  await expect(page.locator('#portal-user-label')).toHaveText('Cliente de Prueba E2E');
});
