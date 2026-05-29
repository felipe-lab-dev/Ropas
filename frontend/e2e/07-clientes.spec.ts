import { test, expect } from '@playwright/test';
import {
  apiContext,
  dniAleatorio,
  esperarToast,
  fillEstable,
  gotoY,
  login,
  seedCliente,
  sufijoAleatorio,
} from './helpers';

test.describe('Clientes · CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea desde UI, busca, edita y elimina un cliente', async ({ page }) => {
    const dni = dniAleatorio();
    const nombre = `Cliente E2E ${sufijoAleatorio(4)}`;
    const email = `e2e-${sufijoAleatorio(6).toLowerCase()}@example.com`;

    // 1. Crear
    await gotoY(page, '/clientes/nuevo');
    await expect(page.getByRole('heading', { name: /nuevo cliente/i })).toBeVisible();

    await page.locator('[data-testid="select-tipo-doc-cliente"]').selectOption('dni');
    await fillEstable(page, '[data-testid="input-documento-cliente"]', dni);
    await fillEstable(page, '[data-testid="input-nombre-cliente"]', nombre);
    await fillEstable(page, '[data-testid="input-email-cliente"]', email);

    await page.locator('[data-testid="btn-guardar-cliente"]').click();
    await esperarToast(page, /creado/i);
    // El nuevo cliente redirige a la edición (ruta estática, export-safe): /clientes/editar/?id={uuid}
    await expect(page).toHaveURL(/\/clientes\/editar\/?\?id=[a-f0-9-]{36}/, { timeout: 12_000 });

    // 2. Volver a la lista y buscarlo por documento
    await gotoY(page, '/clientes');
    await page.locator('[data-busqueda]').fill(dni);
    await expect(page.getByRole('cell', { name: nombre }).first()).toBeVisible({
      timeout: 8_000,
    });

    // 3. Click en el ícono de editar (único por fila) → edición
    await page
      .locator('[data-testid="data-table-row"]', { hasText: nombre })
      .first()
      .locator('a[href^="/clientes/editar"]')
      .click();
    await expect(page).toHaveURL(/\/clientes\/editar\/?\?id=[a-f0-9-]{36}/);

    // En el detalle: cambiar teléfono y guardar
    const telefono = `9${sufijoAleatorio(8)}`;
    await fillEstable(page, 'input#telefono', telefono);
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await esperarToast(page, /actualizado/i);

    // 4. Eliminar desde el detalle
    await page.getByRole('button', { name: /eliminar cliente/i }).click();
    // La confirmación expone dos botones — clickeamos el de confirmar
    await page.getByRole('button', { name: /s[ií], eliminar/i }).click();
    await esperarToast(page, /eliminado/i);

    // Debe redirigir a la lista y el cliente no debe aparecer
    await expect(page).toHaveURL(/\/clientes\/?$/, { timeout: 8_000 });
    await page.locator('[data-busqueda]').fill(dni);
    await page.waitForTimeout(800);
    await expect(page.getByText(nombre)).toHaveCount(0);
  });

  test('rechaza creación si falta el nombre', async ({ page }) => {
    await gotoY(page, '/clientes/nuevo');

    // No tocamos el nombre — el resto sí (para forzar que el error sea por nombre)
    await page.locator('[data-testid="select-tipo-doc-cliente"]').selectOption('dni');
    await fillEstable(page, '[data-testid="input-documento-cliente"]', dniAleatorio());
    await page.locator('[data-testid="btn-guardar-cliente"]').click();

    // El validador del componente emite un toast.error('Nombre requerido')
    await esperarToast(page, /nombre requerido/i);
    // No navegó
    await expect(page).toHaveURL(/\/clientes\/nuevo/);
  });

  test('seeder vía API: crea cliente sin pasar por la UI y aparece en la lista', async ({
    page,
  }) => {
    const api = await apiContext();
    const seed = await seedCliente(api, {
      nombre: `SEED API ${sufijoAleatorio(4)}`,
    });
    await api.dispose();

    await gotoY(page, '/clientes');
    await page.locator('[data-busqueda]').fill(seed.documento);
    await expect(page.getByRole('cell', { name: seed.nombre }).first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
