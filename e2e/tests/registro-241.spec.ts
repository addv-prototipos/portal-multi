import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

async function generarCsfTemporal(rfc: string, dest: string, tipo: 'fisica' | 'moral' = 'fisica') {
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
    if (tipo === 'fisica') {
      doc.text('Nombre(s): JUAN');
      doc.text('Primer Apellido: PEREZ');
      doc.text('Segundo Apellido: LOPEZ');
      doc.text('Regimen: 612 - Personas Fisicas con Actividades Empresariales');
    } else {
      doc.text('Denominacion o Razon Social: COMERCIALIZADORA EJEMPLO SA DE CV');
      doc.text('Regimen Capital: Variable');
      doc.text('Regimen: 601 - General de Ley Personas Morales');
    }
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

test.describe('241 — Registro con Constancia precargada', () => {
  test('registro con CSF precarga RFC y tipo, guarda constancia y deshabilita radios', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('401') && !m.text().includes('Failed to load')) errors.push('console:' + m.text()); });

    const suf = String(Date.now()).slice(-6).padStart(6, '0');
    const rfc = `REGA${suf}AAA`; // 4 letras +6 digitos +3
    const email = `reg241_${Date.now()}@example.com`;
    const pass = 'Test1234!';
    const tmpPdf = path.join(__dirname, '..', `reg241-${Date.now()}.pdf`);
    await generarCsfTemporal(rfc, tmpPdf, 'fisica');

    await page.goto('/login');
    await page.waitForTimeout(500);
    await page.click('#btn-ir-registro');
    await page.waitForSelector('#panel-registro.is-active', { timeout: 3000 });

    // Subir CSF en registro
    await page.setInputFiles('#registro-csf-input', tmpPdf);
    // Esperar preview
    await page.waitForSelector('#registro-csf-preview:not([hidden])', { timeout: 5000 });
    await expect(page.locator('#registro-csf-rfc')).toContainText(rfc);
    await expect(page.locator('#registro-csf-tipo')).toContainText('Física');
    // RFC debe estar bloqueado
    const rfcInput = page.locator('#registro-rfc');
    await expect(rfcInput).toHaveValue(rfc);
    await expect(rfcInput).toHaveAttribute('readonly', '');
    // Radios deshabilitados y fisica checked
    await expect(page.locator('#registro-tipo-fisica')).toBeChecked();
    await expect(page.locator('#registro-tipo-fisica')).toBeDisabled();
    await expect(page.locator('#registro-tipo-moral')).toBeDisabled();
    await expect(page.locator('#registro-tipo-hint')).toBeVisible();

    // Completar resto
    await page.fill('#registro-email', email);
    await page.fill('#registro-telefono', '5512345678');
    await page.fill('#registro-password', pass);
    await page.fill('#registro-password-confirmar', pass);
    await page.click('#btn-registro');
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    expect(page.url()).toContain('/dashboard');

    // Verificar que la constancia quedó guardada (buscar por rfc)
    const buscarRes = await page.request.get(`/api/registro/buscar?rfc=${rfc}`);
    expect(buscarRes.ok()).toBeTruthy();
    const buscarData = await buscarRes.json();
    expect(buscarData.existe).toBeTruthy();
    expect(buscarData.registro.rfc).toBe(rfc);
    expect(buscarData.registro.tipo_persona).toBe('fisica');

    // Ir a csf y verificar radio deshabilitado con hint
    await page.goto('/csf');
    await page.waitForSelector('#panel-1.is-active', { timeout: 5000 });
    await page.waitForTimeout(1000);
    const fisicaChecked = await page.locator('input[name="tipo_persona"][value="fisica"]').isChecked();
    expect(fisicaChecked).toBeTruthy();
    await expect(page.locator('input[name="tipo_persona"][value="fisica"]')).toBeDisabled();
    await expect(page.locator('input[name="tipo_persona"][value="moral"]')).toBeDisabled();
    await expect(page.locator('#csf-tipo-hint')).toBeVisible();

    // Ir a tickets y verificar hint de tipo persona
    await page.goto('/tickets');
    await page.waitForTimeout(1500);
    await expect(page.locator('#tickets-tipo-persona-info')).toBeVisible();
    await expect(page.locator('#tickets-tipo-persona-valor')).toContainText('Física');

    expect(errors, 'sin errores JS').toEqual([]);
    // cleanup temp
    try { fs.unlinkSync(tmpPdf); } catch {}
  });

  test('parse-csf endpoint tenant y base (mismo contrato)', async ({ page }) => {
    const rfcMoral = `REGB${String(Date.now()+1).slice(-6)}BBB`;
    const tmpPdfMoral = path.join(__dirname, '..', `reg241m-${Date.now()}.pdf`);
    await generarCsfTemporal(rfcMoral, tmpPdfMoral, 'moral');
    const buf = fs.readFileSync(tmpPdfMoral);
    // via page.request (usa API_BASE base)
    const fd = new FormData();
    // Node fetch FormData not trivial via page.request, usar la API directa con multipart
    // Simplificamos: probar que el endpoint existe y responde 200 con rfc/tipo
    // Usamos page.request con multipart
    const res = await page.request.post('/api/auth/parse-csf', {
      multipart: { archivo: { name: 'constancia.pdf', mimeType: 'application/pdf', buffer: buf } },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.rfc).toBe(rfcMoral);
    expect(data.tipo_persona).toBe('moral');
    try { fs.unlinkSync(tmpPdfMoral); } catch {}
  });
});
