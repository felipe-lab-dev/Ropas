import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gotoY, login } from './helpers';

async function descargar(
  page: Page,
  ruta: string,
  triggerTestId: string,
  formatoTestId: string,
) {
  await gotoY(page, ruta);
  await page.getByTestId(triggerTestId).click();
  await expect(page.getByTestId(formatoTestId)).toBeVisible({ timeout: 8_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByTestId(formatoTestId).click(),
  ]);
  const ruta2 = await download.path();
  expect(ruta2).toBeTruthy();
  const buf = await readFile(ruta2!);
  return { download, buf };
}

test.describe('Reportes · exportación Excel/PDF', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('ventas → Excel (.xlsx válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/ventas', 'btn-reportes-ventas', 'btn-reporte-excel');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK'); // xlsx = contenedor ZIP
    expect(download.suggestedFilename()).toMatch(/^reporte-ventas-.*\.xlsx$/);
  });

  test('ventas → PDF (%PDF válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/ventas', 'btn-reportes-ventas', 'btn-reporte-pdf');
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(download.suggestedFilename()).toMatch(/^reporte-ventas-.*\.pdf$/);
  });

  test('compras → Excel (.xlsx válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/compras', 'btn-reportes-compras', 'btn-reporte-excel');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(download.suggestedFilename()).toMatch(/^reporte-compras-.*\.xlsx$/);
  });

  test('compras → PDF (%PDF válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/compras', 'btn-reportes-compras', 'btn-reporte-pdf');
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(download.suggestedFilename()).toMatch(/^reporte-compras-.*\.pdf$/);
  });

  test('inventario → Excel (.xlsx válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/inventario', 'btn-reportes-inventario', 'btn-reporte-excel');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(download.suggestedFilename()).toMatch(/^reporte-inventario-.*\.xlsx$/);
  });

  test('inventario → PDF (%PDF válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/inventario', 'btn-reportes-inventario', 'btn-reporte-pdf');
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(download.suggestedFilename()).toMatch(/^reporte-inventario-.*\.pdf$/);
  });

  test('proveedores → Excel (.xlsx válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/proveedores', 'btn-reportes-proveedores', 'btn-reporte-excel');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(download.suggestedFilename()).toMatch(/^reporte-proveedores-.*\.xlsx$/);
  });

  test('proveedores → PDF (%PDF válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/proveedores', 'btn-reportes-proveedores', 'btn-reporte-pdf');
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(download.suggestedFilename()).toMatch(/^reporte-proveedores-.*\.pdf$/);
  });

  test('clientes → Excel (.xlsx válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/clientes', 'btn-reportes-clientes', 'btn-reporte-excel');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(download.suggestedFilename()).toMatch(/^reporte-clientes-.*\.xlsx$/);
  });

  test('clientes → PDF (%PDF válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/clientes', 'btn-reportes-clientes', 'btn-reporte-pdf');
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(download.suggestedFilename()).toMatch(/^reporte-clientes-.*\.pdf$/);
  });

  test('caja → Excel (.xlsx válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/caja', 'btn-reportes-caja', 'btn-reporte-excel');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(download.suggestedFilename()).toMatch(/^reporte-caja-.*\.xlsx$/);
  });

  test('caja → PDF (%PDF válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/caja', 'btn-reportes-caja', 'btn-reporte-pdf');
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(download.suggestedFilename()).toMatch(/^reporte-caja-.*\.pdf$/);
  });

  test('productos → Excel (.xlsx válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/productos', 'btn-reportes-productos', 'btn-reporte-excel');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(download.suggestedFilename()).toMatch(/^reporte-productos-.*\.xlsx$/);
  });

  test('productos → PDF (%PDF válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/productos', 'btn-reportes-productos', 'btn-reporte-pdf');
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(download.suggestedFilename()).toMatch(/^reporte-productos-.*\.pdf$/);
  });

  test('contabilidad → Excel (.xlsx válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/contabilidad', 'btn-reportes-contabilidad', 'btn-reporte-excel');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(download.suggestedFilename()).toMatch(/^reporte-contabilidad-.*\.xlsx$/);
  });

  test('contabilidad → PDF (%PDF válido)', async ({ page }) => {
    const { download, buf } = await descargar(page, '/contabilidad', 'btn-reportes-contabilidad', 'btn-reporte-pdf');
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(download.suggestedFilename()).toMatch(/^reporte-contabilidad-.*\.pdf$/);
  });
});
