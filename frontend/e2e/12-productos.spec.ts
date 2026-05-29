import { test, expect } from '@playwright/test';
import {
  apiContext,
  esperarToast,
  gotoY,
  login,
  sufijoAleatorio,
} from './helpers';

test.describe('Productos · Listado + Insights + Importar/Exportar + Kardex', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('lista productos del catálogo y muestra al menos 1 fila', async ({ page }) => {
    await gotoY(page, '/productos');
    await expect(page.getByRole('heading', { name: /productos/i })).toBeVisible();

    const filas = page.locator('[data-testid="data-table-row"]');
    await expect(filas.first()).toBeVisible({ timeout: 10_000 });
    expect(await filas.count()).toBeGreaterThan(0);
  });

  test('click en fila despliega panel de insights con foto + 3 cards', async ({ page }) => {
    await gotoY(page, '/productos');
    const primeraFila = page.locator('[data-testid="data-table-row"]').first();
    await expect(primeraFila).toBeVisible({ timeout: 10_000 });

    // Click en una celda no interactiva (la columna producto/nombre)
    await primeraFila.locator('td').nth(2).click();

    const panel = page.locator('[data-testid="panel-insights-producto"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Las 3 cards aparecen cuando GET /insights resuelve
    await expect(panel.locator('[data-testid="card-rotacion"]')).toBeVisible({ timeout: 10_000 });
    await expect(panel.locator('[data-testid="card-ventas"]')).toBeVisible();
    await expect(panel.locator('[data-testid="card-margen"]')).toBeVisible();

    // Re-click cierra el panel
    await primeraFila.locator('td').nth(2).click();
    await expect(panel).toHaveCount(0, { timeout: 5_000 });
  });

  test('modal Importar/Exportar abre con tabs Importar y Historial', async ({ page }) => {
    await gotoY(page, '/productos');

    await page.locator('[data-testid="btn-importar-exportar"]').click();

    const modal = page.locator('[data-testid="modal-importar-exportar"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    await expect(modal.locator('[data-testid="tab-importar"]')).toBeVisible();
    await expect(modal.locator('[data-testid="tab-historial"]')).toBeVisible();
    await expect(modal.locator('[data-testid="btn-exportar-catalogo"]')).toBeVisible();
    await expect(modal.locator('[data-testid="btn-descargar-plantilla"]')).toBeVisible();
  });

  test('descarga plantilla CSV con cabeceras correctas', async ({ page }) => {
    await gotoY(page, '/productos');
    await page.locator('[data-testid="btn-importar-exportar"]').click();
    await expect(page.locator('[data-testid="modal-importar-exportar"]')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-descargar-plantilla"]').click(),
    ]);

    expect(download.suggestedFilename()).toBe('plantilla-productos.csv');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const ch of stream) chunks.push(ch as Buffer);
    const contenido = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '');
    expect(contenido).toMatch(/^sku,codigo,nombre,categoria,marca,precioVenta,precioCompra,unidadMedida,descripcion/);
  });

  test('exporta catálogo a CSV con productos reales', async ({ page }) => {
    await gotoY(page, '/productos');
    await page.locator('[data-testid="btn-importar-exportar"]').click();
    await expect(page.locator('[data-testid="modal-importar-exportar"]')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="btn-exportar-catalogo"]').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^productos-\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const ch of stream) chunks.push(ch as Buffer);
    const contenido = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '');
    const lineas = contenido.split(/\r?\n/).filter(l => l.trim());
    expect(lineas.length).toBeGreaterThan(1); // header + al menos 1 producto
    expect(lineas[0]).toMatch(/^sku,codigo,nombre,categoria/);

    await esperarToast(page, /exportaci[oó]n lista/i);
  });

  test('importa CSV con producto nuevo, muestra resultado y aparece en historial', async ({ page }) => {
    // Resolver una categoría válida del tenant vía API para evitar romper por nombre.
    const api = await apiContext();
    const resCat = await api.get('/api/v1/categorias');
    expect(resCat.ok()).toBeTruthy();
    const respCat = (await resCat.json()) as { datos: Array<{ nombre: string }> };
    expect(respCat.datos?.length ?? 0).toBeGreaterThan(0);
    const categoria = respCat.datos[0]!.nombre;

    const skuE2E = `E2E-${sufijoAleatorio(6)}`;
    const nombre = `Producto E2E ${sufijoAleatorio(4)}`;
    const csv =
      'sku,codigo,nombre,categoria,marca,precioVenta,precioCompra,unidadMedida,descripcion\r\n' +
      `${skuE2E},,${nombre},${categoria},,49.90,20.00,NIU,Producto creado por E2E\r\n`;

    await gotoY(page, '/productos');
    await page.locator('[data-testid="btn-importar-exportar"]').click();
    await expect(page.locator('[data-testid="modal-importar-exportar"]')).toBeVisible();

    // Subir el CSV via setInputFiles
    await page.locator('[data-testid="input-archivo-csv"]').setInputFiles({
      name: 'productos-e2e.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8'),
    });

    await page.locator('[data-testid="btn-importar"]').click();

    const resultado = page.locator('[data-testid="resultado-importacion"]');
    await expect(resultado).toBeVisible({ timeout: 15_000 });
    await expect(resultado).toContainText(/importaci[oó]n/i);

    // Pasar al historial y validar la entrada más reciente
    await page.locator('[data-testid="tab-historial"]').click();
    const filasHistorial = page
      .locator('[data-testid="modal-importar-exportar"] table tbody tr');
    await expect(filasHistorial.first()).toBeVisible({ timeout: 10_000 });
    await expect(filasHistorial.first()).toContainText('productos-e2e.csv');

    // Cleanup: borrar el producto E2E vía API para no contaminar tenant
    const resProd = await api.get(`/api/v1/productos?buscar=${encodeURIComponent(nombre)}&limite=5`);
    if (resProd.ok()) {
      const lista = (await resProd.json()) as { datos: Array<{ id: string; sku: string }> };
      const target = lista.datos?.find(p => p.sku === skuE2E);
      if (target) {
        await api.delete(`/api/v1/productos/${target.id}`);
      }
    }
  });

  test('kardex de primer producto carga movimientos con default 12 meses', async ({ page }) => {
    const api = await apiContext();
    const resProd = await api.get('/api/v1/productos?limite=1');
    expect(resProd.ok()).toBeTruthy();
    const lista = (await resProd.json()) as { datos: Array<{ id: string; nombre: string }> };
    expect(lista.datos.length).toBeGreaterThan(0);
    const productoId = lista.datos[0]!.id;

    await gotoY(page, `/productos/kardex?id=${productoId}`);
    await expect(page.getByRole('heading', { name: /kardex/i })).toBeVisible({ timeout: 10_000 });

    // El default ahora es últimos 12 meses → debería traer ≥ 0 filas sin error.
    // Si el primer producto tiene kardex, vemos filas; si no, "sin movimientos".
    const hayResultados = await Promise.race([
      page.locator('table tbody tr').first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false),
      page.getByText(/sin movimientos/i).first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false),
    ]);
    expect(hayResultados).toBe(true);
  });
});
