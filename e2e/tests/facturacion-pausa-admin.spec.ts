// E2E del punto en curso (pausa de Facturación desde Configuraciones):
// el propio administrador (tenant o sitio base) puede pausar/reanudar
// Facturación sin pasar por /control — mismo patrón ya probado en
// portal-pausa-admin.spec.ts, pero el switch vive en Configuraciones
// ("Módulo Facturación", admin.html) en vez de Mi Cuenta, con su propio
// endpoint dedicado PUT /api/admin/config/facturacion. Si el PLAN ya lo
// tiene apagado desde /control, el switch se bloquea (igual que Portal
// de clientes). Usa "t2" (tenant con facturacion_habilitada=1 a nivel
// plan, mismo tenant que marca-tema-punto210.spec.ts/portal-pausa-admin.spec.ts
// para flujos de autoservicio reales) para pausar/reanudar, "t1"
// (facturacion_habilitada=0 real en este entorno — el tenant de gating,
// ver admin-plan-gating.spec.ts) para el caso de plan bloqueado, y el
// sitio base (sin slug).

import { test, expect } from '@playwright/test';

const AUTH_CONTROL = { Authorization: 'Basic ' + Buffer.from('admin:admin').toString('base64') };

test.describe.configure({ mode: 'serial' });

async function loginAdmin(page, slug: string | null) {
  await page.goto(slug ? `/${slug}/admin` : '/admin');
  const yaDentro = await page.locator('#admin-dashboard:not([hidden])').isVisible().catch(() => false);
  if (yaDentro) return;
  await page.fill('#admin-user', 'admin');
  await page.fill('#admin-pass', 'admin');
  await page.click('#btn-login');
  await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });
}

async function abrirFacturacionEnConfiguraciones(page) {
  // Mismo criterio que marca-tema-punto210.spec.ts/portal-pausa-admin.spec.ts:
  // el aviso fiscal, si aparece, ya abre Configuraciones directo.
  const avisoFiscal = page.locator('#config-fiscal-faltante-overlay');
  if (await avisoFiscal.isVisible().catch(() => false)) {
    await page.click('#btn-config-fiscal-faltante-cerrar');
  } else {
    const grupoCuenta = page.locator('.admin-sidebar-group-header[data-grupo="cuenta"]');
    if ((await grupoCuenta.getAttribute('aria-expanded')) !== 'true') {
      await grupoCuenta.click();
    }
    await page.click('#btn-vista-configuraciones');
  }
  await expect(page.locator('#config-modal-overlay')).toBeVisible();
  await page.click('.config-modal-nav-item[data-tarjeta="facturacion-toggle-card"]');
  await expect(page.locator('#facturacion-toggle-card')).toBeVisible();
  // El cuerpo colapsable abre solo al hacer clic en el header de la
  // tarjeta (mismo patrón que auditoria-toggle-card/ordenes-toggle-card).
  const cuerpo = page.locator('#facturacion-toggle-body');
  if (await cuerpo.isHidden()) {
    await page.click('#btn-toggle-facturacion-card');
  }
  await expect(page.locator('#facturacion-habilitada-label')).toBeVisible({ timeout: 10000 });
}

// El checkbox real está oculto visualmente (switch-toggle, ver style.css)
// — togglear pasa por el LABEL, leer estado por el propio input.
function facturacionSwitch(page) {
  return {
    input: page.locator('#config-facturacion-habilitada'),
    async click() {
      await page.locator('#facturacion-habilitada-label').click();
    },
  };
}

test('tenant (t2): pausar y reanudar Facturación desde Configuraciones persiste tras recargar', async ({ page }) => {
  await loginAdmin(page, 't2');
  await abrirFacturacionEnConfiguraciones(page);

  let sw = facturacionSwitch(page);
  await expect(sw.input).toBeChecked();

  await sw.click();
  await expect(page.locator('#facturacion-habilitada-autoguardado')).toHaveAttribute('data-estado', 'guardado', { timeout: 10000 });

  await page.reload();
  await loginAdmin(page, 't2');
  await abrirFacturacionEnConfiguraciones(page);
  sw = facturacionSwitch(page);
  await expect(sw.input).not.toBeChecked();

  // Reanudar — deja t2 en su estado original.
  await sw.click();
  await expect(page.locator('#facturacion-habilitada-autoguardado')).toHaveAttribute('data-estado', 'guardado', { timeout: 10000 });

  await page.reload();
  await loginAdmin(page, 't2');
  await abrirFacturacionEnConfiguraciones(page);
  sw = facturacionSwitch(page);
  await expect(sw.input).toBeChecked();
});

test('sitio base: pausar y reanudar Facturación persiste tras recargar', async ({ page }) => {
  await loginAdmin(page, null);
  await abrirFacturacionEnConfiguraciones(page);

  let sw = facturacionSwitch(page);
  await expect(sw.input).toBeChecked();

  await sw.click();
  await expect(page.locator('#facturacion-habilitada-autoguardado')).toHaveAttribute('data-estado', 'guardado', { timeout: 10000 });

  await page.reload();
  await loginAdmin(page, null);
  await abrirFacturacionEnConfiguraciones(page);
  sw = facturacionSwitch(page);
  await expect(sw.input).not.toBeChecked();

  // Reanudar — deja el sitio base en su estado original.
  await sw.click();
  await expect(page.locator('#facturacion-habilitada-autoguardado')).toHaveAttribute('data-estado', 'guardado', { timeout: 10000 });

  await page.reload();
  await loginAdmin(page, null);
  await abrirFacturacionEnConfiguraciones(page);
  sw = facturacionSwitch(page);
  await expect(sw.input).toBeChecked();
});

test('tenant (t1) con el plan apagado desde /control: el switch de Configuraciones se bloquea', async ({ page, request }) => {
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
        facturacionHabilitada: habilitado,
        portalClientesHabilitado: Boolean(t1.portal_clientes_habilitado),
        sucursalesHabilitado: Boolean(t1.sucursales_habilitado),
      },
    });
    expect(res.ok()).toBeTruthy();
  }

  await ajustarPlan(false);
  try {
    await loginAdmin(page, 't1');
    await abrirFacturacionEnConfiguraciones(page);
    const sw = page.locator('#config-facturacion-habilitada');
    await expect(sw).toBeDisabled();
    await expect(sw).not.toBeChecked();
    await expect(page.locator('#facturacion-habilitada-hint')).toContainText('plan no incluye');
  } finally {
    await ajustarPlan(true);
  }
});
