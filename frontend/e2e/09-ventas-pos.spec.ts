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

  test('abre el detalle de una venta en drawer (sin redirección) y lo cierra', async ({
    page,
  }) => {
    // ── ARRANGE: vender para tener una venta en la lista ────────────────────
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, { precioVenta: 100, stockInicial: 5, sucursalId });
    await api.dispose();

    await gotoY(page, '/pos');
    await fillEstable(page, '[data-testid="pos-buscar-producto"]', producto.sku);
    const resultado = page.locator('[data-testid^="pos-resultado-E2E-V-"]').first();
    await expect(resultado).toBeVisible({ timeout: 8_000 });
    await resultado.click();
    await page.locator('[data-testid="btn-cobrar-pos"]').click();
    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /venta\s+\S+\s+registrada/i })
      .first();
    await expect(toast).toBeVisible({ timeout: 12_000 });
    const numero = (await toast.textContent())!.match(/venta\s+(\S+?)\s+registrada/i)![1]!;

    // ── ACT: abrir el detalle desde la tabla (drawer, NO navegación) ────────
    await gotoY(page, '/ventas');
    await page.locator('[data-busqueda]').fill(numero);
    const fila = page.getByRole('row').filter({ hasText: numero }).first();
    await expect(fila).toBeVisible({ timeout: 8_000 });
    await fila.getByTestId('btn-ver-venta').click();

    // ── ASSERT: el drawer abre con el detalle + la URL lleva ?ver= ──────────
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible({ timeout: 8_000 });
    await expect(drawer.getByText('Detalle de productos')).toBeVisible();
    await expect(page).toHaveURL(/[?&]ver=/);

    // ── ASSERT: se cierra con Escape y la URL vuelve a /ventas ──────────────
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden({ timeout: 8_000 });
    await expect(page).not.toHaveURL(/[?&]ver=/);
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

  test('boleta > S/700 exige DNI: alerta + Cobrar bloqueado hasta asignar cliente', async ({
    page,
  }) => {
    // ── ARRANGE: producto por encima del umbral SUNAT (S/700) ─────────────
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, {
      precioVenta: 800, // > S/700 → la boleta exige identificar al cliente
      stockInicial: 3,
      sucursalId,
    });
    const cliente = await seedCliente(api, {
      tipoDocumento: 'dni',
      nombre: `POS DNI ${sufijoAleatorio(4)}`,
    });
    await api.dispose();

    await gotoY(page, '/pos');

    // 1. Agregar el producto de S/800 → boleta a consumidor final (sin cliente)
    await fillEstable(page, '[data-testid="pos-buscar-producto"]', producto.sku);
    const resultado = page.locator('[data-testid^="pos-resultado-E2E-V-"]').first();
    await expect(resultado).toBeVisible({ timeout: 8_000 });
    await resultado.click();

    // 2. Sin cliente y total > 700 → alerta visible + Cobrar deshabilitado
    await expect(page.locator('[data-testid="pos-alerta-dni-boleta"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-cobrar-pos"]')).toBeDisabled();

    // 3. Asignar un cliente con DNI desde el popover
    await fillEstable(page, '[data-testid="pos-buscar-cliente"]', cliente.documento);
    const itemPopover = page.getByRole('button').filter({ hasText: cliente.nombre }).first();
    await expect(itemPopover).toBeVisible({ timeout: 8_000 });
    await itemPopover.click();

    // 4. Con DNI identificado → la alerta desaparece y Cobrar se habilita
    await expect(page.locator('[data-testid="pos-alerta-dni-boleta"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-cobrar-pos"]')).toBeEnabled();
  });
});
