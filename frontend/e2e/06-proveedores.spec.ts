import { test, expect } from '@playwright/test';
import {
  apiContext,
  esperarToast,
  fillEstable,
  gotoY,
  login,
  rucAleatorio,
  seedProveedor,
  sufijoAleatorio,
} from './helpers';

test.describe('Proveedores · CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea desde UI, busca, edita y elimina un proveedor', async ({ page }) => {
    const ruc = rucAleatorio();
    const razonSocial = `PROVEEDOR E2E ${sufijoAleatorio(4)}`;

    // 1. Crear
    await gotoY(page, '/proveedores/nuevo');
    await expect(page.getByRole('heading', { name: /nuevo proveedor/i })).toBeVisible();

    await page.locator('[data-testid="select-tipo-doc-proveedor"]').selectOption('ruc');
    await fillEstable(page, '[data-testid="input-documento-proveedor"]', ruc);
    await fillEstable(page, '[data-testid="input-razon-social-proveedor"]', razonSocial);

    await page.locator('[data-testid="btn-guardar-proveedor"]').click();
    await esperarToast(page, /registrado/i);
    await expect(page).toHaveURL(/\/proveedores\/?$/, { timeout: 12_000 });

    // 2. Buscar (debounce 250ms + refetch)
    await page.locator('[data-busqueda]').fill(ruc);
    await expect(page.getByText(razonSocial, { exact: false }).first()).toBeVisible({
      timeout: 8_000,
    });

    // 3. Editar → cambiar nombre comercial
    await page.getByRole('link', { name: new RegExp(`editar ${razonSocial}`, 'i') }).click();
    await expect(page).toHaveURL(/\/proveedores\/editar\/?\?id=/);

    const nombreComercial = `NC ${sufijoAleatorio(3)}`;
    await fillEstable(
      page,
      '[data-testid="input-nombre-comercial-proveedor"]',
      nombreComercial,
    );
    await page.locator('[data-testid="btn-guardar-proveedor"]').click();
    await esperarToast(page, /actualizado/i);

    // 4. Eliminar desde la lista
    await gotoY(page, '/proveedores');
    await page.locator('[data-busqueda]').fill(ruc);
    await expect(page.getByText(razonSocial, { exact: false }).first()).toBeVisible({
      timeout: 8_000,
    });
    await page
      .getByRole('button', { name: new RegExp(`eliminar ${razonSocial}`, 'i') })
      .click();
    await expect(page.getByRole('dialog', { name: /eliminar proveedor/i })).toBeVisible();
    await page.getByRole('button', { name: /s[ií], eliminar/i }).click();
    await esperarToast(page, /eliminado/i);

    // Verificar que ya no aparece (forzar refetch limpiando+rescribiendo el buscador)
    await page.locator('[data-busqueda]').fill('');
    await page.waitForTimeout(400);
    await page.locator('[data-busqueda]').fill(ruc);
    await page.waitForTimeout(800);
    await expect(page.getByText(razonSocial)).toHaveCount(0);
  });

  test('rechaza RUC con formato inválido sin navegar', async ({ page }) => {
    await gotoY(page, '/proveedores/nuevo');

    await page.locator('[data-testid="select-tipo-doc-proveedor"]').selectOption('ruc');
    await fillEstable(page, '[data-testid="input-documento-proveedor"]', '123');
    await fillEstable(page, '[data-testid="input-razon-social-proveedor"]', 'INVALIDO SAC');
    await page.locator('[data-testid="btn-guardar-proveedor"]').click();

    // Sigue en /nuevo (no hubo POST exitoso)
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/proveedores\/nuevo/);
    // El mensaje de error de Zod menciona los 11 dígitos
    await expect(page.getByText(/11 d[ií]gitos/i).first()).toBeVisible();
  });

  test('seeder vía API: crea proveedor sin pasar por la UI y aparece en la lista', async ({
    page,
  }) => {
    const api = await apiContext();
    const seed = await seedProveedor(api, {
      razonSocial: `SEED API ${sufijoAleatorio(4)}`,
    });
    await api.dispose();

    await gotoY(page, '/proveedores');
    await page.locator('[data-busqueda]').fill(seed.documento);
    await expect(page.getByText(seed.razonSocial, { exact: false }).first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
