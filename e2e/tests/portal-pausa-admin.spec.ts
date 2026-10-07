// E2E del Punto 375 (ver PROJECT_STATE.md): "Portal de clientes" en Mi
// Cuenta — antes decorativo (pendiente 269), ahora real. El propio
// administrador (tenant o sitio base) puede pausar/reanudar su portal de
// clientes sin pasar por /control; si el PLAN ya lo tiene apagado desde
// /control, el switch se bloquea. Usa "t1"/"t2" (tenant) y el sitio base
// (sin slug) — todos restaurados a su estado original al final de cada
// test para que la suite sea re-ejecutable.

import { test, expect } from '@playwright/test';

const AUTH_CONTROL = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };

async function loginAdmin(page, slug: string | null) {
  await page.goto(slug ? `/${slug}/admin` : '/admin');
  // La sesión persiste entre navegaciones en la MISMA page (Basic Auth +
  // cookie de admin.js) — una segunda visita en el mismo test ya aterriza
  // directo en el dashboard, sin formulario de login que llenar.
  const yaDentro = await page.locator('#admin-dashboard:not([hidden])').isVisible().catch(() => false);
  if (yaDentro) return;
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });
}

async function abrirMiCuenta(page) {
  // El aviso fiscal tapa todo el sidebar si aparece — se cierra primero.
  // Si lo cierra, puede aterrizar directo en Configuraciones (mismo
  // comportamiento visto en marca-tema-punto210.spec.ts) en vez de Mi
  // Cuenta — por eso el click a Mi Cuenta sigue siendo necesario después.
  // El aviso aparece async (después de que carga /api/admin/login) — un
  // isVisible() inmediato puede llegar antes de que exista, dejándolo sin
  // cerrar y bloqueando todo lo de abajo. Se le da una ventana corta para
  // aparecer; si no aparece en ese tiempo, de verdad no hay nada que cerrar.
  const avisoFiscal = page.locator('#config-fiscal-faltante-overlay');
  try {
    await avisoFiscal.waitFor({ state: 'visible', timeout: 2500 });
    await page.click('#btn-config-fiscal-faltante-cerrar');
    await expect(avisoFiscal).toBeHidden({ timeout: 10000 });
    // Si el aviso abrió el modal de Configuraciones, hay que cerrarlo
    // para volver al sidebar normal antes de navegar a Mi Cuenta.
    const configModal = page.locator('#config-modal-overlay');
    if (await configModal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(configModal).toBeHidden({ timeout: 10000 });
    }
  } catch (_) {
    // No apareció — nada que cerrar.
  }
  // "Mi Cuenta" vive en el grupo colapsable "Cuenta" del sidebar — en el
  // primer render solo el grupo de la vista activa ("Inicio") queda
  // expandido.
  const grupoCuenta = page.locator('.admin-sidebar-group-header[data-grupo="cuenta"]');
  if ((await grupoCuenta.getAttribute('aria-expanded')) !== 'true') {
    await grupoCuenta.click();
  }
  await page.click('#btn-vista-mi-cuenta');
  // #micuenta-empresa-card se destapa recién cuando resuelve el fetch de
  // GET /api/admin/mi-cuenta (async, separado del cambio de vista) — se
  // espera esa tarjeta primero para no competir con esa carrera.
  await expect(page.locator('#micuenta-empresa-card')).toBeVisible({ timeout: 15000 });
  // .control-switch oculta el <input> real visualmente a propósito (mismo
  // patrón ya usado en todo el sitio, ver control-editar-empresa.spec.ts:
  // "el checkbox está oculto visualmente, se interactúa con su label") —
  // se comprueba visibilidad sobre el LABEL, nunca sobre el input.
  await expect(page.locator('#micuenta-portal-clientes-label')).toBeVisible({ timeout: 10000 });
}

// El checkbox real está oculto visualmente (ver comentario arriba) —
// togglear/leer su estado pasa por el LABEL para el clic, y por el
// propio input (su atributo checked/disabled es legible aunque no sea
// visible) para las aserciones de estado.
function portalClientesSwitch(page) {
  return {
    input: page.locator('#micuenta-portal-clientes-switch'),
    async click() {
      await page.locator('#micuenta-portal-clientes-label').click();
    },
  };
}

test.describe.configure({ mode: 'serial' });

// El cliente que visita /login nunca comparte navegador con el admin que
// lo pausa desde Mi Cuenta — se usa un contexto de navegador APARTE para
// esa parte de cada test, no solo por realismo: GET /api/tema/:slug tiene
// Cache-Control: max-age=300 mientras el portal está activo, y si se
// reutiliza la MISMA page que acaba de visitar /admin (que también carga
// theme.js y pega al mismo /t2/api/tema/t2), el navegador sirve esa
// respuesta vieja cacheada ("activo") en vez de pedirla de nuevo — nada
// que ver con el feature, es nada más que la poisoning de caché HTTP
// normal entre dos páginas que llaman la misma URL en la misma sesión.
async function visitarComoCliente(browser, url: string) {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  await pagina.goto(url);
  return { pagina, contexto };
}

test('tenant (t2): pausar desde Mi Cuenta muestra el aviso en login, reanudar lo quita', async ({ page, browser }) => {
  await loginAdmin(page, 't2');
  await abrirMiCuenta(page);

  let sw = portalClientesSwitch(page);
  await expect(sw.input).toBeChecked();
  await sw.click();
  await expect(page.locator('#toast')).toContainText('apagado', { timeout: 10000 });

  let { pagina: cliente, contexto } = await visitarComoCliente(browser, '/t2/login');
  // Esperar primero el cristal (selector no ambiguo): login.html trae
  // varios <h1> ocultos (registro/recuperar/etc.) que siguen en el DOM
  // hasta que theme.js reemplaza document.body — afirmar sobre 'h1' antes
  // de que eso pase choca en "strict mode" (resuelve a 4 elementos).
  await expect(cliente.locator('.pd-cristal')).toBeVisible({ timeout: 10000 });
  await expect(cliente.locator('h1')).toHaveText('Portal de clientes desactivado');
  await contexto.close();

  // Reanudar
  await loginAdmin(page, 't2');
  await abrirMiCuenta(page);
  sw = portalClientesSwitch(page);
  await expect(sw.input).not.toBeChecked();
  await sw.click();
  await expect(page.locator('#toast')).toContainText('activado', { timeout: 10000 });

  ({ pagina: cliente, contexto } = await visitarComoCliente(browser, '/t2/login'));
  await expect(cliente.locator('#login-rfc')).toBeVisible({ timeout: 10000 });
  await expect(cliente.locator('.pd-cristal')).toHaveCount(0);
  await contexto.close();
});

test('sitio base: pausar desde Mi Cuenta muestra el aviso en / y /login (sin slug), reanudar lo quita', async ({ page, browser }) => {
  await loginAdmin(page, null);
  await abrirMiCuenta(page);

  let sw = portalClientesSwitch(page);
  await expect(sw.input).toBeChecked();
  await sw.click();
  await expect(page.locator('#toast')).toContainText('apagado', { timeout: 10000 });

  let { pagina: cliente, contexto } = await visitarComoCliente(browser, '/login');
  await expect(cliente.locator('.pd-cristal')).toBeVisible({ timeout: 10000 });
  await expect(cliente.locator('h1')).toHaveText('Portal de clientes desactivado');
  await contexto.close();

  // Bug real encontrado por el usuario: "/" pelado (sin /login) sirve el
  // mismo login.html vía el catch-all de nginx ("location / { try_files
  // ... /login.html; }"), pero tiene 0 segmentos en la URL — theme.js no
  // lo contaba como "página de portal de cliente" y se saltaba el aviso.
  ({ pagina: cliente, contexto } = await visitarComoCliente(browser, '/'));
  await expect(cliente.locator('.pd-cristal')).toBeVisible({ timeout: 10000 });
  await expect(cliente.locator('h1')).toHaveText('Portal de clientes desactivado');
  await contexto.close();

  // Reanudar
  await loginAdmin(page, null);
  await abrirMiCuenta(page);
  sw = portalClientesSwitch(page);
  await expect(sw.input).not.toBeChecked();
  await sw.click();
  await expect(page.locator('#toast')).toContainText('activado', { timeout: 10000 });

  ({ pagina: cliente, contexto } = await visitarComoCliente(browser, '/login'));
  await expect(cliente.locator('#login-rfc')).toBeVisible({ timeout: 10000 });
  await expect(cliente.locator('.pd-cristal')).toHaveCount(0);
  await contexto.close();
});

test('tenant (t1) con el plan apagado desde /control: el switch de Mi Cuenta se bloquea', async ({ page, request }) => {
  // Apaga portal_clientes_habilitado a nivel plan para t1 (PUT general,
  // objeto completo — mismo patrón que marca-tema-punto210.spec.ts).
  const lista = await request.get('/api/control/tenants', { headers: AUTH_CONTROL });
  const tenants = (await lista.json()).tenants;
  const t1 = tenants.find((t) => t.slug === 't1');

  async function ajustarPlan(habilitado: boolean) {
    const res = await request.put(`/api/control/tenants/t1`, {
      headers: AUTH_CONTROL,
      data: {
        nombreEmpresa: t1.nombre_empresa,
        contactoEmail: t1.contacto_email,
        maxUsuarios: t1.max_usuarios,
        marcaLookfeelHabilitado: Boolean(t1.marca_lookfeel_habilitado),
        discoCuotaMb: t1.disco_cuota_mb,
        facturacionHabilitada: Boolean(t1.facturacion_habilitada),
        portalClientesHabilitado: habilitado,
        sucursalesHabilitado: Boolean(t1.sucursales_habilitado),
      },
    });
    expect(res.ok()).toBeTruthy();
  }

  await ajustarPlan(false);
  try {
    await loginAdmin(page, 't1');
    await abrirMiCuenta(page);
    const sw = page.locator('#micuenta-portal-clientes-switch');
    await expect(sw).toBeDisabled();
    await expect(sw).not.toBeChecked();
    await expect(page.locator('#micuenta-portal-clientes-hint')).toContainText('plan no incluye');
  } finally {
    await ajustarPlan(true);
  }
});
