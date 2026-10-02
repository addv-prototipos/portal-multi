// E2E de "Login con RFC o correo" (segmento 2 del punto en curso, ver
// conversación del 2026-10-02). El correo ya es obligatorio para
// cualquier cliente desde su creación — este cambio solo amplía la
// consulta del login (WHERE rfc = ? OR email = ?), sin tocar el alta.
// Corre contra el tenant real "t1", creando y limpiando su propio
// usuario de prueba vía la API de /admin.

import { test, expect, APIRequestContext } from '@playwright/test';

// RFC propuesto al crear — el backend lo ignora y genera un identificador
// interno si el tenant tiene Facturación apagada (punto en curso), así
// que el spec NUNCA asume cuál quedó guardado: lo lee de vuelta después
// de crear (ver rfcReal) y usa ESE valor para login/aserciones. Así el
// mismo spec pasa sin tocarlo sin importar el estado real de t1.
const RFC_PROPUESTO = 'QALG900101AB3';
const EMAIL_PRUEBA = 'qa-login-rfc-correo-e2e@example.com';
const PASSWORD = 'ClaveLoginE2E1';
let rfcReal = RFC_PROPUESTO;

// El header nunca muestra un identificador interno (ver
// generarIdentificadorSinFiscal en el backend + portal.js) — si el valor
// no tiene forma de RFC real, se espera el label genérico en su lugar.
function labelHeaderEsperado(rfc: string) {
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc) ? rfc : 'Mi cuenta';
}

async function auth() {
  return { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };
}

async function buscarUsuarioPorEmail(request: APIRequestContext) {
  const headers = await auth();
  const lista = await request.get('/t1/api/admin/usuarios?perfil=cliente', { headers });
  const data = await lista.json();
  const usuarios = Array.isArray(data) ? data : data.usuarios || [];
  return usuarios.find((u: any) => u.email === EMAIL_PRUEBA);
}

async function crearUsuarioPrueba(request: APIRequestContext) {
  const res = await request.post('/t1/api/admin/usuarios', {
    headers: await auth(),
    data: { rfc: RFC_PROPUESTO, telefono: '5500000002', email: EMAIL_PRUEBA, password: PASSWORD, perfil: 'cliente' },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`No se pudo crear el usuario de prueba: ${res.status()}`);
  }
  const fila = await buscarUsuarioPorEmail(request);
  if (!fila) throw new Error('No se encontró el usuario de prueba recién creado.');
  rfcReal = fila.rfc;
}

async function eliminarUsuarioPrueba(request: APIRequestContext) {
  const headers = await auth();
  const fila = await buscarUsuarioPorEmail(request);
  if (fila) await request.delete(`/t1/api/admin/usuarios/${fila.id}`, { headers });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await eliminarUsuarioPrueba(request); // por si quedó de una corrida interrumpida
  await crearUsuarioPrueba(request);
});

test.afterAll(async ({ request }) => {
  await eliminarUsuarioPrueba(request);
});

test('el campo de login dice "RFC o correo"', async ({ page }) => {
  await page.goto('/t1/login');
  await expect(page.locator('label[for="login-rfc"]')).toContainText('RFC o correo');
});

test('login con el RFC real sigue funcionando (sin regresión)', async ({ page }) => {
  // Si t1 tiene Facturación apagada ahora mismo, el usuario de prueba
  // recibió un identificador interno (nunca un RFC real tecleable por un
  // humano) — este caso ya queda cubierto por el login vía correo de la
  // siguiente prueba. No es una falla, es una precondición que no aplica
  // en este estado del tenant (mismo criterio que admin-plan-gating.spec.ts).
  test.skip(!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfcReal), 't1 no tiene Facturación activa ahora mismo — sin RFC real que probar.');
  await page.goto('/t1/login');
  await page.fill('#login-rfc', rfcReal);
  await page.fill('#login-password', PASSWORD);
  await page.click('#btn-login');
  await expect(page).toHaveURL(/\/t1\/dashboard$/);
  await expect(page.locator('#portal-user-label')).toHaveText(labelHeaderEsperado(rfcReal));
});

test('login con el correo entra a la misma cuenta y la sesión queda anclada al RFC real', async ({ page }) => {
  await page.goto('/t1/login');
  await page.fill('#login-rfc', EMAIL_PRUEBA);
  await page.fill('#login-password', PASSWORD);
  await page.click('#btn-login');
  await expect(page).toHaveURL(/\/t1\/dashboard$/);
  // La sesión se abre con el RFC de la fila, nunca con el correo tecleado
  // — así el header, los folios y "Solicitar aclaraciones" siguen viendo
  // un RFC real, se haya entrado por RFC o por correo.
  await expect(page.locator('#portal-user-label')).toHaveText(labelHeaderEsperado(rfcReal));
});

test('correo con mayúsculas/minúsculas distintas a como se guardó también entra', async ({ page }) => {
  await page.goto('/t1/login');
  await page.fill('#login-rfc', EMAIL_PRUEBA.toUpperCase());
  await page.fill('#login-password', PASSWORD);
  await page.click('#btn-login');
  await expect(page).toHaveURL(/\/t1\/dashboard$/);
});

test('credenciales incorrectas por correo responden con el mismo error genérico', async ({ page }) => {
  await page.goto('/t1/login');
  await page.fill('#login-rfc', EMAIL_PRUEBA);
  await page.fill('#login-password', 'ClaveIncorrectaXYZ1');
  await page.click('#btn-login');
  await expect(page.locator('#login-error-general')).toContainText('RFC, correo o contraseña incorrectos');
});
