import { test, expect } from '@playwright/test';
import { gotoY, login } from './helpers';

test.describe('Cupones · plantillas destacadas + render PDF/PNG', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('aplica plantilla "flash_sale", pre-llena el formulario y permite guardar', async ({ page }) => {
    await gotoY(page,'/cupones/nuevo?wizard=plantillas');
    await expect(page.getByText('Plantillas destacadas')).toBeVisible();

    // Las 5 plantillas deben estar visibles
    for (const id of ['bienvenida_vip', 'reactivacion_urgente', 'cumpleanios', 'recompra_inteligente', 'flash_sale']) {
      await expect(page.getByTestId(`plantilla-${id}`)).toBeVisible();
    }

    // Aplicar flash_sale
    await page.getByTestId('plantilla-flash_sale').click();

    // Debe pasar a vista libre con datos pre-cargados
    await expect(page.getByText('Nuevo cupón')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('input[name="codigo"]')).toHaveValue(/.+/);
    await expect(page.locator('input[name="nombre"]')).toHaveValue(/FLASH/i);
    await expect(page.locator('input[name="valorDescuento"]')).toHaveValue('35');

    // Vista previa debe usar el emoji ⚡
    await expect(page.getByTestId('cupon-preview')).toContainText('⚡');

    // Guardar
    await page.getByTestId('cupon-guardar').click();
    await expect(page).toHaveURL(/\/cupones\/[a-f0-9-]{36}\/?$/, { timeout: 15_000 });
  });

  test('descarga PDF y PNG de un cupón', async ({ page }) => {
    // Crear primero un cupón sencillo
    await gotoY(page,'/cupones/nuevo');
    await page.locator('input[name="codigo"]').fill(`PDF-${Date.now().toString(36).toUpperCase()}`);
    await page.locator('input[name="nombre"]').fill('Cupón render PDF/PNG');
    await page.locator('input[name="valorDescuento"]').fill('10');
    await page.getByTestId('cupon-guardar').click();
    await page.waitForURL(/\/cupones\/[a-f0-9-]{36}\/?$/);

    // Descargar PDF
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('descargar-pdf').click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/i);

    // Descargar PNG
    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('descargar-png').click(),
    ]);
    expect(pngDownload.suggestedFilename()).toMatch(/\.png$/i);
  });
});
