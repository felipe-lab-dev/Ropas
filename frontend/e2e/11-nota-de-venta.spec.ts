/**
 * E2E — Modalidad "Nota de venta" en el POS y devolución interna.
 *
 * Casos cubiertos:
 *   1. Toggle OFF (default) → venta normal aparece SIN badge "NV".
 *   2. Toggle ON → venta nace como nota de venta, aparece con badge "NV"
 *      en la lista y badge "Nota de venta" en el detalle.
 *   3. Devolución sobre una nota de venta → la NC aparece con badge
 *      "interna" en la lista de notas de crédito.
 *
 * Las pruebas usan el flujo real del backend (no mocks) — confirman que el
 * flag esNotaDeVenta viaja end-to-end: POST /ventas → DB → GET /ventas.
 */
import { test, expect } from '@playwright/test';
import {
  apiContext,
  esperarToast,
  fillEstable,
  gotoY,
  login,
  seedProducto,
  sucursalActivaDelPos,
  sufijoAleatorio,
} from './helpers';

test.describe('POS · Nota de venta (modalidad sin SUNAT)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ─── 1. Toggle OFF (default) ────────────────────────────────────────────────

  test('toggle OFF (default): venta normal sin badge "NV" en la lista', async ({ page }) => {
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, {
      precioVenta: 50,
      stockInicial: 3,
      sucursalId,
    });
    await api.dispose();

    await gotoY(page, '/pos');

    // El toggle debe estar visible y OFF por default
    const toggle = page.locator('[data-testid="pos-toggle-nota-venta"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Agregar producto y cobrar
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
    const numero = (await toast.textContent())!.match(/Venta\s+(\S+?)\s+registrada/i)![1]!;

    // En la lista, la fila NO debe tener badge "NV"
    await gotoY(page, '/ventas');
    await page.locator('[data-busqueda]').fill(numero);
    const fila = page.getByRole('row').filter({ hasText: numero }).first();
    await expect(fila).toBeVisible({ timeout: 8_000 });
    await expect(fila.locator('text=/^NV$/')).toHaveCount(0);
  });

  // ─── 2. Toggle ON → nota de venta interna ─────────────────────────────────

  test('toggle ON: venta queda como nota de venta, badge "NV" en lista y "Nota de venta" en detalle', async ({
    page,
  }) => {
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, {
      precioVenta: 80,
      stockInicial: 2,
      sucursalId,
    });
    await api.dispose();

    await gotoY(page, '/pos');

    // Agregar producto
    await fillEstable(page, '[data-testid="pos-buscar-producto"]', producto.sku);
    const resultado = page.locator('[data-testid^="pos-resultado-E2E-V-"]').first();
    await expect(resultado).toBeVisible({ timeout: 8_000 });
    await resultado.click();

    // Activar toggle "Nota de venta"
    const toggle = page.locator('[data-testid="pos-toggle-nota-venta"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // El bloque modalidad debe mostrar "Nota de venta"
    await expect(page.getByText(/Nota de venta/i).first()).toBeVisible();
    await expect(page.getByText(/no se env[ií]a a SUNAT/i).first()).toBeVisible();

    // Cobrar
    await page.locator('[data-testid="btn-cobrar-pos"]').click();
    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /venta\s+\S+\s+registrada/i })
      .first();
    await expect(toast).toBeVisible({ timeout: 12_000 });
    const numero = (await toast.textContent())!.match(/Venta\s+(\S+?)\s+registrada/i)![1]!;

    // Lista de ventas: la fila debe tener badge "NV"
    await gotoY(page, '/ventas');
    await page.locator('[data-busqueda]').fill(numero);
    const fila = page.getByRole('row').filter({ hasText: numero }).first();
    await expect(fila).toBeVisible({ timeout: 8_000 });
    await expect(fila.locator('text=/^NV$/').first()).toBeVisible();

    // Detalle de la venta (drawer): badge "Nota de venta"
    await fila.getByTestId('btn-ver-venta').click();
    await expect(page).toHaveURL(/[?&]ver=/);
    await expect(page.getByText(/Nota de venta/i).first()).toBeVisible({ timeout: 8_000 });
    // El card "Facturación electrónica" no debe estar — en su lugar el aviso "Nota de venta interna"
    await expect(page.getByText(/Nota de venta interna/i).first()).toBeVisible();

    // Verificar vía API que esNotaDeVenta=true se persistió
    const api2 = await apiContext();
    const res = await api2.get('/api/v1/ventas', { params: { buscar: numero, limite: 1 } });
    expect(res.ok()).toBe(true);
    const datos = (await res.json()).datos;
    expect(datos.length).toBeGreaterThan(0);
    expect(datos[0].esNotaDeVenta).toBe(true);
    expect(datos[0].tipoCpe).toBeNull();
    await api2.dispose();
  });

  // ─── 3. Devolución sobre nota de venta → "interna" en NC ──────────────────

  test('devolución sobre nota de venta: la NC aparece con badge "interna"', async ({ page }) => {
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, {
      precioVenta: 60,
      stockInicial: 2,
      sucursalId,
    });
    await api.dispose();

    // Crear venta nota de venta desde el POS
    await gotoY(page, '/pos');
    await fillEstable(page, '[data-testid="pos-buscar-producto"]', producto.sku);
    const resultado = page.locator('[data-testid^="pos-resultado-E2E-V-"]').first();
    await expect(resultado).toBeVisible({ timeout: 8_000 });
    await resultado.click();
    await page.locator('[data-testid="pos-toggle-nota-venta"]').click();
    await page.locator('[data-testid="btn-cobrar-pos"]').click();
    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /venta\s+\S+\s+registrada/i })
      .first();
    await expect(toast).toBeVisible({ timeout: 12_000 });
    const numero = (await toast.textContent())!.match(/Venta\s+(\S+?)\s+registrada/i)![1]!;

    // Ir al detalle de la venta y hacer devolución
    await gotoY(page, '/ventas');
    await page.locator('[data-busqueda]').fill(numero);
    const fila = page.getByRole('row').filter({ hasText: numero }).first();
    await fila.getByTestId('btn-ver-venta').click();

    // Botón "Devolución" debe estar visible (NO "Nota de crédito")
    const btnDevolucion = page.getByRole('button', { name: /devoluci[oó]n/i }).first();
    await expect(btnDevolucion).toBeVisible({ timeout: 8_000 });
    await btnDevolucion.click();

    // El dialog debe llamarse "Devolución interna"
    await expect(page.getByText(/Devoluci[oó]n interna/i).first()).toBeVisible({
      timeout: 5_000,
    });

    // Llenar motivo y cantidad
    await page.getByLabel(/motivo/i).fill('Cliente arrepentido (E2E)');
    // El input de cantidad por item — buscamos el primero numérico en el dialog
    const inputCantidad = page.locator('input[type="number"]').last();
    await inputCantidad.fill('1');

    // Botón "Registrar devolución"
    await page.getByRole('button', { name: /registrar devoluci[oó]n/i }).click();
    await esperarToast(page, /devoluci[oó]n.*registrada/i);

    // Lista de NC: debe aparecer con badge "interna"
    await gotoY(page, '/notas-credito');
    const filaNC = page.getByRole('row').filter({ hasText: /NC-/ }).first();
    await expect(filaNC).toBeVisible({ timeout: 8_000 });
    await expect(filaNC.locator('text=/^interna$/').first()).toBeVisible();
  });
});
