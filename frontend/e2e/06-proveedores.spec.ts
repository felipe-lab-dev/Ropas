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

test.describe('Proveedores · CRUD (modal)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea desde modal, busca, edita y elimina un proveedor', async ({ page }) => {
    const ruc = rucAleatorio();
    const razonSocial = `PROVEEDOR E2E ${sufijoAleatorio(4)}`;

    // 1. Abrir modal "Nuevo proveedor" desde el listado
    await gotoY(page, '/proveedores');
    await page.locator('[data-testid="btn-abrir-nuevo-proveedor"]').click();

    const modalNuevo = page.locator('[data-testid="modal-nuevo-proveedor"]');
    await expect(modalNuevo).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/[?&]nuevo=1/);

    // Completar el formulario
    await modalNuevo.locator('[data-testid="select-tipo-doc-proveedor"]').selectOption('ruc');
    await fillEstable(page, '[data-testid="input-documento-proveedor"]', ruc);
    await fillEstable(page, '[data-testid="input-razon-social-proveedor"]', razonSocial);

    await modalNuevo.locator('[data-testid="btn-guardar-proveedor"]').click();
    await esperarToast(page, /registrado/i);

    // El modal cierra y se queda en /proveedores
    await expect(modalNuevo).toBeHidden({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/proveedores\/?(?:\?|$)/);

    // 2. Buscar
    await page.locator('[data-busqueda]').fill(ruc);
    await expect(page.getByText(razonSocial, { exact: false }).first()).toBeVisible({
      timeout: 8_000,
    });

    // 3. Click "Editar" → abre modal-editar (NO navega)
    await page
      .getByRole('button', { name: new RegExp(`editar ${razonSocial}`, 'i') })
      .click();

    const modalEditar = page.locator('[data-testid="modal-editar-proveedor"]');
    await expect(modalEditar).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/[?&]editar=/);

    const nombreComercial = `NC ${sufijoAleatorio(3)}`;
    await fillEstable(
      page,
      '[data-testid="input-nombre-comercial-proveedor"]',
      nombreComercial,
    );
    await modalEditar.locator('[data-testid="btn-guardar-proveedor"]').click();
    await esperarToast(page, /actualizado/i);

    // El modal cierra
    await expect(modalEditar).toBeHidden({ timeout: 8_000 });

    // 4. Eliminar desde la lista
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

    // Verificar que ya no aparece
    await page.locator('[data-busqueda]').fill('');
    await page.waitForTimeout(400);
    await page.locator('[data-busqueda]').fill(ruc);
    await page.waitForTimeout(800);
    await expect(page.getByText(razonSocial)).toHaveCount(0);
  });

  test('rechaza RUC con formato inválido sin cerrar el modal', async ({ page }) => {
    await gotoY(page, '/proveedores');
    await page.locator('[data-testid="btn-abrir-nuevo-proveedor"]').click();

    const modal = page.locator('[data-testid="modal-nuevo-proveedor"]');
    await expect(modal).toBeVisible({ timeout: 8_000 });

    await modal.locator('[data-testid="select-tipo-doc-proveedor"]').selectOption('ruc');
    await fillEstable(page, '[data-testid="input-documento-proveedor"]', '123');
    await fillEstable(page, '[data-testid="input-razon-social-proveedor"]', 'INVALIDO SAC');
    await modal.locator('[data-testid="btn-guardar-proveedor"]').click();

    // El modal sigue visible (no hubo POST exitoso)
    await page.waitForTimeout(500);
    await expect(modal).toBeVisible();
    // Mensaje de error de Zod menciona los 11 dígitos
    await expect(modal.getByText(/11 d[ií]gitos/i).first()).toBeVisible();
  });

  test('ruta legacy /proveedores/nuevo redirige a ?nuevo=1 y abre modal', async ({ page }) => {
    await gotoY(page, '/proveedores/nuevo');
    await expect(page).toHaveURL(/\/proveedores\/?\?nuevo=1/, { timeout: 8_000 });
    await expect(page.locator('[data-testid="modal-nuevo-proveedor"]')).toBeVisible({
      timeout: 8_000,
    });
  });

  test('ruta legacy /proveedores/editar?id=X redirige a ?editar=X y abre modal', async ({ page }) => {
    // Sembrar primero un proveedor para tener un id real
    const api = await apiContext();
    const seed = await seedProveedor(api, {
      razonSocial: `LEGACY EDIT ${sufijoAleatorio(4)}`,
    });
    await api.dispose();

    await gotoY(page, `/proveedores/editar/?id=${seed.id}`);
    await expect(page).toHaveURL(new RegExp(`/proveedores/?\\?editar=${seed.id}`), {
      timeout: 8_000,
    });
    await expect(page.locator('[data-testid="modal-editar-proveedor"]')).toBeVisible({
      timeout: 8_000,
    });
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
