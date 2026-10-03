import { test, expect } from '@playwright/test';

test.describe('Cuentas por cobrar - venta pendiente', () => {
  test('registrar venta pendiente genera entrada en CxC y permite cobro', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });

    await page.goto('/admin');
    await page.fill('#admin-user', 'admin');
    await page.fill('#admin-pass', 'admin');
    await page.click('#btn-login');
    await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });

    // Atajo global "Registrar venta" (header) — visible en cualquier vista,
    // no hace falta navegar a Ventas primero.
    await page.click('#btn-header-registrar-venta');
    await page.waitForSelector('#orden-registrar-modal-overlay:not([hidden])', { timeout: 5000 });

    // Paso 1: Productos
    await page.fill('#orden-producto-concepto', 'Prueba CxC Playwright');
    await page.fill('#orden-producto-precio', '100');
    await page.fill('#orden-producto-cantidad', '2');
    await page.click('#btn-agregar-producto-orden');
    await page.waitForTimeout(500);
    // Verificar que producto aparece
    const listaBody = await page.locator('#orden-productos-lista-body').innerHTML();
    console.log('listaBody', listaBody.slice(0, 500));
    expect(listaBody.length).toBeGreaterThan(0);

    // En desktop los 3 pasos se ven juntos, en móvil hay wizard con Siguiente
    // Si el botón Siguiente es visible (móvil), navegar por el wizard
    const siguienteVisible = await page.locator('#btn-orden-paso-siguiente').isVisible().catch(() => false);
    if (siguienteVisible) {
      await page.click('#btn-orden-paso-siguiente');
      await page.waitForTimeout(300);
      const totalPreview = await page.textContent('#orden-total-preview');
      console.log('totalPreview paso2', totalPreview);
      await page.click('#btn-orden-paso-siguiente');
      await page.waitForTimeout(300);
    }
    const totalPreview2 = await page.textContent('#orden-total-preview');
    console.log('totalPreview', totalPreview2);
    expect(totalPreview2).toContain('232');

    // Cambiar a Pendiente (visible en paso 3, que en desktop ya está visible)
    await page.click('#btn-orden-pago-pendiente');
    await page.waitForTimeout(200);
    // Verificar que vencimiento aparece
    await expect(page.locator('#orden-pago-pendiente-wrap')).toBeVisible();
    // Poner vencimiento futuro
    const futuro = new Date(Date.now() + 10*24*60*60*1000).toISOString().slice(0,10);
    await page.fill('#orden-fecha-vencimiento', futuro);
    await page.fill('#orden-notas-cobro', 'Credito playwright');

    // Elegir cliente ya registrado
    // Esperar que el select tenga opciones (más de 1, incluye "Selecciona")
    await page.waitForSelector('#orden-email', { timeout: 5000 });
    await page.waitForFunction(() => document.querySelectorAll('#orden-email option').length > 1, null, { timeout: 5000 });
    const opciones = await page.locator('#orden-email option').count();
    console.log('opciones email', opciones);
    // Seleccionar el primer correo válido (no vacío)
    await page.selectOption('#orden-email', { index: 1 });
    await page.waitForTimeout(300);

    // Registrar venta
    // Interceptar la petición
    let requestBody: any = null;
    let responseStatus: number | null = null;
    let responseBody: any = null;
    page.on('request', (req) => {
      if (req.url().includes('/api/admin/ordenes-compra') && req.method() === 'POST') {
        try { requestBody = req.postDataJSON(); } catch { requestBody = req.postData(); }
        console.log('REQUEST BODY', JSON.stringify(requestBody));
      }
    });
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/admin/ordenes-compra') && resp.request().method() === 'POST') {
        responseStatus = resp.status();
        try { responseBody = await resp.json(); } catch { responseBody = await resp.text(); }
        console.log('RESPONSE', responseStatus, JSON.stringify(responseBody).slice(0, 2000));
      }
    });
    await page.click('#btn-registrar-orden');
    // Esperar éxito (aparece 1300ms y luego se oculta, así que verificar dentro de 2s)
    await expect(page.locator('#orden-form-exito')).toBeVisible({ timeout: 3000 });
    const errorGeneral = await page.textContent('#orden-error-general');
    console.log('orden-error-general', errorGeneral);
    const fieldErrors = await page.evaluate(() => {
      const els = document.querySelectorAll('.field-error');
      return Array.from(els).map((e: any) => e.id + ':' + (e.textContent||'').trim()).filter((s) => s.split(':')[1]);
    });
    console.log('fieldErrors', fieldErrors);
    const exitoVisible = await page.locator('#orden-form-exito').isVisible();
    console.log('exitoVisible', exitoVisible);
    console.log('requestBody', requestBody);
    console.log('responseBody', responseBody);
    // Verificar que no hay error y sí éxito
    expect(errorGeneral?.trim() || '').toBe('');
    expect(exitoVisible).toBeTruthy();
    expect(errors, 'sin errores JS').toEqual([]);
    // Esperar a que el éxito se oculte y el formulario se resetee (1300ms + buffer)
    await page.waitForTimeout(1500);
    await expect(page.locator('#orden-form-exito')).toBeHidden();

    // Cerrar modal
    await page.click('#btn-cerrar-orden-modal');
    await page.waitForTimeout(500);

    // Ir a CxC y verificar que aparece como pendiente
    await page.click('#btn-vista-cxc');
    await page.waitForSelector('#vista-cxc:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(1500);
    const cxcCount = await page.textContent('#cxc-count');
    console.log('cxcCount', cxcCount);
    const cxcBody = await page.locator('#cxc-table-body').innerHTML();
    console.log('cxcBody', cxcBody.slice(0, 2000));
    // Concepto no se muestra en CxC, se muestra No. Venta y email; verificar por email y badge
    expect(cxcBody).toContain('antoniopradoo@gmail.com');
    expect(cxcBody).toContain('$232.00');
    // Verificar que tiene badge Pendiente
    expect(cxcBody).toContain('Pendiente');

    // Probar registrar cobro
    // Click en el botón de cobro (primer fila)
    const btnCobro = page.locator('#cxc-table-body tr').first().locator('button[data-tooltip="Registrar cobro"]');
    await btnCobro.click();
    await page.waitForSelector('#cxc-cobro-modal-overlay:not([hidden])', { timeout: 3000 });
    const saldoText = await page.textContent('#cxc-cobro-saldo');
    console.log('saldo', saldoText);
    // Monto parcial
    await page.fill('#cxc-cobro-monto', '50');
    await page.click('#btn-cxc-cobro-guardar');
    await page.waitForTimeout(1000);
    const errMonto = await page.textContent('#error-cxc-cobro-monto');
    console.log('errMonto', errMonto);
    expect((errMonto||'').trim()).toBe('');
    // Esperar que modal se cierre y tabla se actualice
    await expect(page.locator('#cxc-cobro-modal-overlay')).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(1000);
    // Verificar que ahora el saldo cambió (debe seguir pendiente pero con monto_cobrado 50)
    const cxcBody2 = await page.locator('#cxc-table-body').innerHTML();
    console.log('cxcBody2 after abono', cxcBody2.slice(0, 2000));
    expect(errors, 'sin errores JS tras cobro').toEqual([]);
  });
});
