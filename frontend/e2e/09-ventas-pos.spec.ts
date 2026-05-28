import { test, expect } from '@playwright/test';
import {
  apiContext,
  esperarToast,
  fillEstable,
  gotoY,
  login,
  seedCliente,
  seedProducto,
  sucursalActivaDelPos,
  sufijoAleatorio,
} from './helpers';

test.describe('Ventas POS · cobrar', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('vende un producto desde el POS sin cliente y la venta aparece en /ventas', async ({
    page,
  }) => {
    // ── ARRANGE ───────────────────────────────────────────────────────────
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, {
      precioVenta: 100,
      stockInicial: 5,
      sucursalId, // <- garantizamos que el stock esté en la sucursal del POS
    });
    await api.dispose();

    // ── ACT ───────────────────────────────────────────────────────────────
    await gotoY(page, '/pos');

    await fillEstable(page, '[data-testid="pos-buscar-producto"]', producto.sku);

    const resultado = page.locator('[data-testid^="pos-resultado-E2E-V-"]').first();
    await expect(resultado).toBeVisible({ timeout: 8_000 });
    await resultado.click();

    // El carrito debe mostrar el producto (panel izquierdo)
    await expect(page.locator('body')).toContainText(producto.nombre);

    // Cobrar (efectivo es el medio default)
    const cobrar = page.locator('[data-testid="btn-cobrar-pos"]');
    await expect(cobrar).toBeEnabled();
    await cobrar.click();

    // ── ASSERT: toast con el número de venta + presencia en /ventas ───────
    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /venta\s+\S+\s+registrada/i })
      .first();
    await expect(toast).toBeVisible({ timeout: 12_000 });
    const texto = (await toast.textContent()) ?? '';
    const match = texto.match(/Venta\s+(\S+?)\s+registrada/i);
    expect(match, `Toast no tuvo el formato esperado. Texto: "${texto}"`).toBeTruthy();
    const numero = match![1]!;

    await gotoY(page, '/ventas');
    await page.locator('[data-busqueda]').fill(numero);
    await expect(
      page.getByRole('cell', { name: new RegExp(numero, 'i') }).first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('vende con cliente asignado desde el popover', async ({ page }) => {
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, {
      precioVenta: 80,
      stockInicial: 3,
      sucursalId,
    });
    const cliente = await seedCliente(api, {
      nombre: `POS CLIENTE ${sufijoAleatorio(4)}`,
    });
    await api.dispose();

    await gotoY(page, '/pos');

    // 1. Agregar producto al carrito
    await fillEstable(page, '[data-testid="pos-buscar-producto"]', producto.sku);
    const resultado = page.locator('[data-testid^="pos-resultado-E2E-V-"]').first();
    await expect(resultado).toBeVisible({ timeout: 8_000 });
    await resultado.click();

    // 2. Asignar cliente buscando por documento
    await fillEstable(page, '[data-testid="pos-buscar-cliente"]', cliente.documento);

    // El popover muestra resultados — clickeamos el botón con el nombre del cliente
    const itemPopover = page.getByRole('button').filter({ hasText: cliente.nombre }).first();
    await expect(itemPopover).toBeVisible({ timeout: 8_000 });
    await itemPopover.click();

    // El bloque "Cliente" del panel derecho debe mostrar al cliente asignado
    await expect(
      page.locator('div').filter({ hasText: cliente.nombre }).first(),
    ).toBeVisible();

    // 3. Cobrar y validar toast
    await page.locator('[data-testid="btn-cobrar-pos"]').click();
    await esperarToast(page, /venta\s+\S+\s+registrada/i);
  });

  test('el botón Cobrar está deshabilitado mientras el carrito está vacío', async ({
    page,
  }) => {
    await gotoY(page, '/pos');
    await expect(page.locator('[data-testid="btn-cobrar-pos"]')).toBeDisabled();
  });
});
