import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  apiContext,
  gotoY,
  login,
  seedProducto,
  sucursalActivaDelPos,
} from './helpers';

/** Crea una venta vía API y devuelve { id, numero }. */
async function seedVenta(
  api: APIRequestContext,
  input: { sucursalId: string; varianteId: string; cantidad?: number },
): Promise<{ id: string; numero: string }> {
  const res = await api.post('/api/v1/ventas', {
    data: {
      sucursalId: input.sucursalId,
      esNotaDeVenta: true, // nota de venta interna: no dispara CPE en el test
      items: [{ varianteId: input.varianteId, cantidad: input.cantidad ?? 1 }],
    },
  });
  if (!res.ok()) {
    throw new Error(`seedVenta falló (${res.status()}): ${await res.text()}`);
  }
  const datos = (await res.json()).datos;
  return { id: datos.id, numero: datos.numero };
}

test.describe('Ventas · rentabilidad', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('el listado muestra la columna Rentabilidad con el margen de la venta', async ({ page }) => {
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    // precioVenta 100, precioCompra 60 → margen (100−60)/100 = 40% → "saludable"
    const producto = await seedProducto(api, {
      precioVenta: 100,
      precioCompra: 60,
      stockInicial: 5,
      sucursalId,
    });
    const venta = await seedVenta(api, { sucursalId, varianteId: producto.varianteId });
    await api.dispose();

    await gotoY(page, '/ventas');
    await page.locator('[data-busqueda]').fill(venta.numero);

    // La fila de la venta aparece…
    await expect(
      page.getByRole('cell', { name: new RegExp(venta.numero, 'i') }).first(),
    ).toBeVisible({ timeout: 8_000 });

    // …y muestra el margen calculado (+40%).
    await expect(page.getByText('+40%').first()).toBeVisible({ timeout: 8_000 });
  });

  test('el detalle muestra el resumen de rentabilidad y el margen por línea', async ({ page }) => {
    const api = await apiContext();
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, {
      precioVenta: 100,
      precioCompra: 60,
      stockInicial: 5,
      sucursalId,
    });
    const venta = await seedVenta(api, { sucursalId, varianteId: producto.varianteId });
    await api.dispose();

    await gotoY(page, `/ventas/${venta.id}`);

    // Tarjeta resumen de rentabilidad
    await expect(page.getByRole('heading', { name: 'Rentabilidad' })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Ganancia').first()).toBeVisible();
    // Columna Margen en la tabla de ítems
    await expect(page.getByRole('columnheader', { name: 'Margen' })).toBeVisible();
    await expect(page.getByText('+40%').first()).toBeVisible();
  });

  test('la columna Sucursal solo aparece si el tenant tiene más de una sucursal', async ({ page }) => {
    const api = await apiContext();
    const res = await api.get('/api/v1/sucursales');
    const sucursales = res.ok() ? ((await res.json()).datos ?? []) : [];
    await api.dispose();

    await gotoY(page, '/ventas');

    const headerSucursal = page.getByRole('columnheader', { name: 'Sucursal' });
    if (Array.isArray(sucursales) && sucursales.length > 1) {
      await expect(headerSucursal).toBeVisible({ timeout: 8_000 });
    } else {
      await expect(headerSucursal).toHaveCount(0);
    }
  });
});
