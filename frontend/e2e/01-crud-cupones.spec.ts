import { test, expect } from '@playwright/test';
import { codigoCuponUnico, gotoY, login } from './helpers';

test.describe('Cupones · CRUD básico', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea un cupón desde cero, lo busca en la lista, lo edita, lo pausa y lo elimina', async ({ page }) => {
    const codigo = codigoCuponUnico('CRUD');

    // 1. Crear
    await gotoY(page,'/cupones/nuevo');
    await expect(page.getByText('Nuevo cupón')).toBeVisible();

    await page.locator('input[name="codigo"]').fill(codigo);
    await page.locator('input[name="nombre"]').fill('Cupón CRUD E2E');
    await page.locator('input[name="valorDescuento"]').fill('15');

    // Vista previa en vivo debe reflejar el código
    await expect(page.getByTestId('cupon-preview')).toContainText(codigo);

    await page.getByTestId('cupon-guardar').click();
    await expect(page).toHaveURL(/\/cupones\/[a-f0-9-]{36}$/, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(codigo);

    // 2. Volver a la lista y buscar
    await gotoY(page,'/cupones');
    await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
    await expect(page.getByRole('cell', { name: 'Cupón CRUD E2E' })).toBeVisible({ timeout: 6_000 });

    // 3. Editar nombre
    await page.getByRole('link', { name: new RegExp(`editar ${codigo}`, 'i') }).click();
    await expect(page).toHaveURL(/\/cupones\/editar\?id=/);
    const nombreInput = page.locator('input[name="nombre"]');
    await nombreInput.fill('Cupón CRUD E2E (editado)');
    await page.getByTestId('cupon-guardar').click();
    await expect(page).toHaveURL(/\/cupones\/[a-f0-9-]{36}$/, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Cupón CRUD E2E (editado)');

    // 4. Pausar desde la lista
    await gotoY(page,'/cupones');
    await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
    await page.getByRole('button', { name: new RegExp(`pausar ${codigo}`, 'i') }).click();
    await expect(page.getByText(/Pausado/i).first()).toBeVisible({ timeout: 5_000 });

    // 5. Eliminar
    await page.getByRole('button', { name: new RegExp(`eliminar ${codigo}`, 'i') }).click();
    await expect(page.getByRole('dialog', { name: /eliminar cup[oó]n/i })).toBeVisible();
    await page.getByRole('button', { name: /s[ií], eliminar/i }).click();
    await expect(page.locator('body')).not.toContainText(codigo, { timeout: 6_000 });
  });
});
