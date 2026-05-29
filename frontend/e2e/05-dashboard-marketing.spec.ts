import { test, expect } from '@playwright/test';
import { codigoCuponUnico, fillEstable, gotoY, login } from './helpers';

test.describe('Cupones · dashboard de marketing destacado', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('lista muestra KPIs por cupón (canjes, tasa, vencimiento)', async ({ page }) => {
    // Crear un cupón con tope de 10
    const codigo = codigoCuponUnico('KPI');
    await gotoY(page,'/cupones/nuevo');
    await fillEstable(page, 'input[name="codigo"]', codigo);
    await fillEstable(page, 'input[name="nombre"]', `Cupón KPIs ${codigo}`);
    await fillEstable(page, 'input[name="valorDescuento"]', '10');
    await fillEstable(page, 'input[name="usosMaximosTotal"]', '10');
    await page.getByTestId('cupon-guardar').click();
    await page.waitForURL(/\/cupones\/detalle\/?\?id=[a-f0-9-]{36}/);

    // Volver a lista, filtrar por código
    await gotoY(page,'/cupones');
    await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
    await expect(page.getByRole('cell').filter({ hasText: new RegExp(codigo) }).first()).toBeVisible({ timeout: 5_000 });

    // Debe mostrar "0 / 10" o similar
    await expect(page.locator('body')).toContainText('0 / 10');
    await expect(page.locator('body')).toContainText('0% canje');
  });

  test('detalle: tabs/KPIs presentes y sección "Historial de canjes"', async ({ page }) => {
    const codigo = codigoCuponUnico('DET');
    await gotoY(page,'/cupones/nuevo');
    await fillEstable(page, 'input[name="codigo"]', codigo);
    await fillEstable(page, 'input[name="nombre"]', `Cupón detalle KPI ${codigo}`);
    await fillEstable(page, 'input[name="valorDescuento"]', '15');
    await page.getByTestId('cupon-guardar').click();
    await page.waitForURL(/\/cupones\/detalle\/?\?id=[a-f0-9-]{36}/);

    // Estamos en detalle: deben aparecer KPIs y la sección histórica
    await expect(page.getByText('Canjes', { exact: true })).toBeVisible();
    await expect(page.getByText('Descuento entregado')).toBeVisible();
    await expect(page.getByText('Ingreso neto')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Historial de canjes' })).toBeVisible();
    await expect(page.getByText('Aún no se canjeó este cupón.')).toBeVisible();
  });

  test('command palette: muestra acceso a cupones y plantillas', async ({ page }) => {
    await gotoY(page,'/cupones'); // página cualquiera del shell
    // Abrir el palette (Ctrl+K o Cmd+K)
    await page.keyboard.press('Control+k');
    // Buscar "cupón"
    await page.getByPlaceholder(/buscar m[oó]dulo/i).fill('cup');
    await expect(page.getByRole('option', { name: /Nuevo cup[oó]n/i })).toBeVisible({ timeout: 4_000 });
<<<<<<< HEAD
    // Reescribimos el filtro para encontrar la plantilla brutal
    await page.getByPlaceholder(/buscar m[oó]dulo/i).fill('plant');
    await expect(page.getByRole('option', { name: /Plantilla brutal/i })).toBeVisible({ timeout: 4_000 });
=======
    await expect(page.getByRole('option', { name: /Plantilla destacada/i })).toBeVisible();
>>>>>>> 65ae9d4c94c89ae1d35f42faf90b8737aa47e1bc
  });

  test('sidebar muestra la sección "Promociones" con Cupones', async ({ page }) => {
    await gotoY(page,'/dashboard');
    // El sidebar siempre está visible
    await expect(page.getByRole('link', { name: /^Cupones$/i }).first()).toBeVisible();
  });
});
