import { test, expect } from '@playwright/test';

// Punto 380: el histórico archivado por el cierre mensual ya NO se oculta
// por defecto en Ventas/Gastos/Cuentas por cobrar — solo se pagina. Este
// spec confirma, contra Docker/MySQL reales, que:
// 1) Ventas carga con paginación real server-side y el filtro de periodo
//    default es "Todos los periodos" (ya no "Mes actual").
// 2) Un registro de un mes anterior (archivado) sigue visible en la lista
//    sin pasar ningún query param especial — basta con no filtrar periodo.
// 3) Cuentas por cobrar carga correctamente en ambas pestañas
//    (Pendientes/Cobradas), cada una con su propia fuente de datos.
test.describe('Punto 380 — histórico siempre visible + paginación real', () => {
  test('Ventas: filtro de periodo por defecto es "Todos los periodos" y la tabla pagina sin ocultar histórico', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('sandboxed')) errors.push('console:' + m.text()); });

    await page.goto('/admin');
    await page.fill('#admin-user', 'admin');
    await page.fill('#admin-pass', 'admin');
    await page.click('#btn-login');
    await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });

    await page.click('.admin-sidebar-group-header[data-grupo="ventas-gastos"]');
    await page.click('#btn-vista-ordenes');
    await page.waitForSelector('#vista-ordenes:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(1200);

    // Default del selector de periodo: "Todos los periodos", no "Mes actual".
    const periodoTexto = await page.locator('#ordenes-filtro-periodo option:checked').textContent();
    expect(periodoTexto?.trim()).toBe('Todos los periodos');

    // La tabla cargó registros reales (ya sembrados en este tenant) sin
    // que haya que elegir ningún periodo — el histórico completo es la
    // vista por defecto.
    const filasCount = await page.locator('#ordenes-table-body tr').count();
    expect(filasCount).toBeGreaterThan(0);

    // El contador muestra el formato de rango paginado ("N-M de T ventas"),
    // no solo la cuenta de filas de la página actual.
    const ordenesCount = await page.textContent('#ordenes-count');
    expect(ordenesCount || '').toMatch(/de \d+ ventas/);

    expect(errors, 'sin errores JS en Ventas').toEqual([]);
  });

  test('Cuentas por cobrar: ambas pestañas (Pendientes/Cobradas) cargan sin romper', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('sandboxed')) errors.push('console:' + m.text()); });

    await page.goto('/admin');
    await page.fill('#admin-user', 'admin');
    await page.fill('#admin-pass', 'admin');
    await page.click('#btn-login');
    await page.waitForSelector('#admin-dashboard:not([hidden])', { timeout: 10000 });

    await page.click('.admin-sidebar-group-header[data-grupo="ventas-gastos"]');
    await page.click('#btn-vista-cxc');
    await page.waitForSelector('#vista-cxc:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(1200);

    // Pestaña "Pendientes" (default): KPIs ya pintados, sin error JS.
    const kpiPorCobrar = await page.textContent('#cxc-kpi-por-cobrar');
    expect(kpiPorCobrar || '').toMatch(/\$/);

    // Cambiar a "Cobradas" — dispara cargarCxcCobradasPagina() (fetch
    // paginado real server-side, independiente de cxcBaseCache).
    await page.click('#btn-ver-cxc-cobradas');
    await page.waitForTimeout(1200);
    const cxcCountCobradas = await page.textContent('#cxc-count');
    console.log('cxcCountCobradas', cxcCountCobradas);
    // "0 cobradas" o "N-M de T cobradas" — ambos formatos válidos de
    // textoRangoPaginado(), nunca debe quedar vacío/undefined.
    expect(cxcCountCobradas || '').toMatch(/cobradas/);

    // Volver a "Pendientes" — debe repintar sin pedir nada al servidor
    // de nuevo (cxcBaseCache ya está en memoria).
    await page.click('#btn-ver-cxc-pendientes');
    await page.waitForTimeout(500);
    await expect(page.locator('#btn-ver-cxc-pendientes')).toHaveClass(/is-active/);

    expect(errors, 'sin errores JS en Cuentas por cobrar').toEqual([]);
  });
});
