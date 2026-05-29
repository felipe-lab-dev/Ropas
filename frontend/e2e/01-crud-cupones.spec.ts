import { test, expect } from '@playwright/test';
import { codigoCuponUnico, fillEstable, gotoY, login } from './helpers';

test.describe('Cupones · CRUD básico', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea un cupón desde cero, lo busca en la lista, lo edita, lo pausa y lo elimina', async ({ page }) => {
    const codigo = codigoCuponUnico('CRUD');
    const nombre = `Cupón ${codigo}`; // único por run para evitar choque con runs anteriores

    // 1. Crear
    await gotoY(page,'/cupones/nuevo');
    await expect(page.getByText('Nuevo cupón')).toBeVisible();

    await fillEstable(page, 'input[name="codigo"]', codigo);
    await fillEstable(page, 'input[name="nombre"]', nombre);
    await fillEstable(page, 'input[name="valorDescuento"]', '15');

    // Vista previa en vivo debe reflejar el código
    await expect(page.getByTestId('cupon-preview')).toContainText(codigo);

    await page.getByTestId('cupon-guardar').click();
    await expect(page).toHaveURL(/\/cupones\/detalle\/?\?id=[a-f0-9-]{36}/, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(codigo);

    // 2. Volver a la lista y buscar (por código, único)
    await gotoY(page,'/cupones');
    await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
    await expect(page.getByRole('cell', { name: new RegExp(codigo, 'i') }).first()).toBeVisible({ timeout: 6_000 });
    // Esperar a que el link de edición exista (debounce 250ms + refetch)
    const editarLink = page.getByRole('link', { name: new RegExp(`editar ${codigo}`, 'i') });
    await expect(editarLink).toBeVisible({ timeout: 5_000 });

    // 3. Editar nombre
    await editarLink.click();
    await expect(page).toHaveURL(/\/cupones\/editar\/?\?id=/);
    await fillEstable(page, 'input[name="nombre"]', `${nombre} (editado)`);
    await page.getByTestId('cupon-guardar').click();
    await expect(page).toHaveURL(/\/cupones\/detalle\/?\?id=[a-f0-9-]{36}/, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(`${nombre} (editado)`);

    // 4. Pausar desde la lista
    await gotoY(page,'/cupones');
    await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
    await page.getByRole('button', { name: new RegExp(`pausar ${codigo}`, 'i') }).click();
    // Badge "Pausado" en la fila del cupón (no la <option> del filtro)
    await expect(page.locator('table').getByText('Pausado', { exact: true })).toBeVisible({ timeout: 5_000 });

    // 5. Eliminar
    await page.getByRole('button', { name: new RegExp(`eliminar ${codigo}`, 'i') }).click();
    await expect(page.getByRole('dialog', { name: /eliminar cup[oó]n/i })).toBeVisible();
    await page.getByRole('button', { name: /s[ií], eliminar/i }).click();
    await expect(page.locator('body')).not.toContainText(codigo, { timeout: 6_000 });
  });
});
