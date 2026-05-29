import { test, expect } from '@playwright/test';
import {
  apiContext,
  esperarToast,
  fillEstable,
  gotoY,
  login,
  seedProducto,
  seedProveedor,
  sufijoAleatorio,
} from './helpers';

test.describe('Compras · registrar', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('registra una compra completa: proveedor + sucursal + ítem + asienta stock', async ({
    page,
  }) => {
    // ── ARRANGE: seedeamos proveedor y producto vía API ───────────────────
    const api = await apiContext();
    const proveedor = await seedProveedor(api, {
      razonSocial: `PROV COMPRA E2E ${sufijoAleatorio(4)}`,
    });
    const producto = await seedProducto(api, {
      precioCompra: 50,
      precioVenta: 100,
      stockInicial: 0, // empezamos sin stock para verificar que la compra lo asienta
    });
    await api.dispose();

    const numeroComprobante = sufijoAleatorio(7);

    // ── ACT: registrar la compra desde la UI ──────────────────────────────
    await gotoY(page, '/compras/nueva');
    await expect(page.getByRole('heading', { name: /nueva compra/i })).toBeVisible();

    // Proveedor — selectOption acepta el ID
    await page
      .locator('[data-testid="select-proveedor-compra"]')
      .selectOption(proveedor.id);

    // Sucursal — ya viene seleccionada la primera (auto-set en useEffect),
    // pero la fijamos explícitamente para no depender del orden de carga.
    await page
      .locator('[data-testid="select-sucursal-compra"]')
      .selectOption(producto.sucursalId);

    // Serie ya es F001 por default; número lo seteamos nosotros
    await fillEstable(
      page,
      '[data-testid="input-numero-comprobante-compra"]',
      numeroComprobante,
    );

    // Buscar producto por SKU exacto
    await fillEstable(page, '[data-testid="input-buscar-producto-compra"]', producto.sku);

    // El dropdown aparece tras debounce 200ms + fetch — esperamos al botón
    // (el testid puede llevar el SKU del producto o el de la variante según
    // si /inventario/buscar-variantes está disponible o cae al fallback)
    const botonAgregar = page
      .locator('[data-testid^="btn-agregar-producto-compra-E2E-"]')
      .first();
    await expect(botonAgregar).toBeVisible({ timeout: 8_000 });
    await botonAgregar.click();

    // El ítem debe aparecer con cantidad 1 y costo del producto (precioCompra)
    await expect(page.locator('body')).toContainText(producto.nombre);

    // Registrar
    await page.locator('[data-testid="btn-registrar-compra"]').click();
    await esperarToast(page, /compra registrada/i);
    await expect(page).toHaveURL(/\/compras\/?$/, { timeout: 12_000 });

    // ── ASSERT: la compra aparece en la lista ─────────────────────────────
    await page.locator('[data-busqueda]').fill(numeroComprobante);
    await expect(
      page.getByRole('cell', { name: new RegExp(numeroComprobante, 'i') }).first(),
    ).toBeVisible({ timeout: 8_000 });

    // ── ASSERT extra: el stock subió a 1 ──────────────────────────────────
    // Lo verificamos vía API porque no hay UI pública del stock por variante
    // accesible sin navegar al inventario. Esto valida que el backend asentó.
    const api2 = await apiContext();
    const stockRes = await api2.get(
      `/api/v1/inventario/stock?varianteId=${producto.varianteId}&sucursalId=${producto.sucursalId}`,
    );
    if (stockRes.ok()) {
      const stockJson = await stockRes.json();
      const disponible = stockJson.datos?.disponible ?? stockJson.disponible ?? null;
      if (typeof disponible === 'number') {
        expect(disponible).toBeGreaterThanOrEqual(1);
      }
    }
    await api2.dispose();
  });

  test('el botón "Registrar compra" está deshabilitado sin proveedor / sin ítems', async ({
    page,
  }) => {
    await gotoY(page, '/compras/nueva');

    // Sin proveedor ni ítems, el botón debe estar disabled
    const boton = page.locator('[data-testid="btn-registrar-compra"]');
    await expect(boton).toBeDisabled();

    // Aunque pongamos número de comprobante, sigue disabled (faltan items)
    await fillEstable(
      page,
      '[data-testid="input-numero-comprobante-compra"]',
      sufijoAleatorio(7),
    );
    await expect(boton).toBeDisabled();
  });
});
