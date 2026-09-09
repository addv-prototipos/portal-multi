import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

async function generarCsfTemporal(rfc: string, dest: string) {
  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 60 });
    const stream = fs.createWriteStream(dest);
    doc.pipe(stream);
    doc.fontSize(14).text('Servicio de Administracion Tributaria', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text('Constancia de Situacion Fiscal', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10);
    doc.text('Cedula de Identificacion Fiscal');
    doc.moveDown(0.5);
    doc.text(`Registro Federal de Contribuyentes: ${rfc}`);
    doc.moveDown(0.5);
    doc.text(`Nombre: Usuario Prueba ${rfc.slice(0,4)}`);
    doc.moveDown(0.5);
    doc.text('Domicilio: Calle 123, Codigo Postal: 06600, Ciudad de Mexico');
    doc.moveDown(0.5);
    doc.text('Regimen: Sueldos y Salarios');
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

test.describe('208 — CSF -> Home directo', () => {
  test('subir constancia redirige al dashboard (auto 1.8s y boton inmediato)', async ({ page, browser }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('401')) errors.push('console:' + m.text()); });

    // Crear usuario de prueba aislado — RFC valido 4 letras +6 digitos +3 alfanum
    const suf = String(Date.now()).slice(-6).padStart(6, '0');
    const rfc = `CSFA${suf}AAA`;
    const email = `csf208_${Date.now()}@example.com`;
    const pass = 'Test1234!';

    // Registrar via API para tener sesion
    const apiContext = await browser.newContext();
    const apiPage = await apiContext.newPage();
    // Usar fetch via page para respetar cookies
    await page.goto('/login');
    await page.waitForTimeout(500);

    // Registro directo via API usando fetch del browser
    const regRes = await page.request.post('/api/auth/registro', {
      data: { rfc, password: pass, email, telefono: '5512345678' },
    });
    // Puede dar 201 o 409 si ya existe (reintento improbable)
    expect([201, 409]).toContain(regRes.status());

    // Ya hay sesion tras /auth/registro — ir directo a csf
    await page.goto('/csf');
    await page.waitForSelector('#panel-1.is-active', { timeout: 5000 });

    // Paso 1: llenar datos
    await page.check('input[name="tipo_persona"][value="fisica"]');
    // rfc viene bloqueado desde sesion, no hace falta rellenar
    await page.fill('#email', email);
    await page.click('#form-datos button[type="submit"]');
    await page.waitForSelector('#panel-2.is-active', { timeout: 5000 });

    // Paso 2: subir PDF — generar con RFC coincidente con sesion
    const tmpPdf = path.join(__dirname, '..', `csf208-${Date.now()}.pdf`);
    await generarCsfTemporal(rfc, tmpPdf);
    await page.setInputFiles('#input-archivo', tmpPdf);
    await page.waitForSelector('#dropzone-file:not([hidden])', { timeout: 3000 });

    // Enviar
    await page.click('#btn-submit');
    // Esperar panel 3 con nuevo texto
    await page.waitForSelector('#panel-3.is-active', { timeout: 10000 });
    await expect(page.locator('#panel-3-title')).toHaveText('¡Constancia guardada!');
    await expect(page.locator('#btn-ir-inicio')).toBeVisible();
    await expect(page.locator('#btn-ir-inicio')).toHaveText(/Ir al inicio ahora/);
    // Verificar que el boton viejo ya no existe
    await expect(page.locator('#btn-nuevo-registro')).toHaveCount(0);

    // Test A: clic inmediato debe ir a dashboard sin esperar timeout
    await page.click('#btn-ir-inicio');
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    expect(page.url()).toContain('/dashboard');
    expect(errors, 'sin errores JS').toEqual([]);
  });

  test('auto-redirect 1.8s sin clic', async ({ page }) => {
    const suf2 = String(Date.now()+1).slice(-6).padStart(6, '0');
    const rfc = `CSFB${suf2}BBB`;
    const email = `csf208a_${Date.now()}@example.com`;
    const pass = 'Test1234!';

    await page.goto('/login');
    await page.waitForTimeout(300);
    const regRes = await page.request.post('/api/auth/registro', {
      data: { rfc, password: pass, email, telefono: '5512345678' },
    });
    expect([201, 409]).toContain(regRes.status());
    await page.goto('/csf');
    await page.waitForSelector('#panel-1.is-active', { timeout: 5000 });
    await page.check('input[name="tipo_persona"][value="fisica"]');
    await page.fill('#email', email);
    await page.click('#form-datos button[type="submit"]');
    await page.waitForSelector('#panel-2.is-active', { timeout: 5000 });
    const tmpPdf2 = path.join(__dirname, '..', `csf208a-${Date.now()}.pdf`);
    await generarCsfTemporal(rfc, tmpPdf2);
    await page.setInputFiles('#input-archivo', tmpPdf2);
    await page.waitForSelector('#dropzone-file:not([hidden])', { timeout: 3000 });
    await page.click('#btn-submit');
    await page.waitForSelector('#panel-3.is-active', { timeout: 10000 });
    // No clickear, esperar auto-redirect
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    expect(page.url()).toContain('/dashboard');
  });
});
