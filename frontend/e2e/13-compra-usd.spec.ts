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

/**
 * Compra en USD con tipo de cambio. Mockeamos `GET /utilidades/tipo-cambio`
 * con page.route para no depender de json.pe (token/cuota) ni de la red.
 */
test.describe('Compras · moneda USD + tipo de cambio', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea compra USD con TC autocompletado y muestra equivalente en PEN', async ({
    page,
  }) => {
    const api = await apiContext();
    const proveedor = await seedProveedor(api, {
      razonSocial: `PROV USD E2E ${sufijoAleatorio(4)}`,
    });
    const producto = await seedProducto(api, { precioCompra: 50, stockInicial: 0 });
    await api.dispose();

    // El TC oficial lo sirve nuestro mock (json.pe podría no estar configurado en E2E).
    await page.route('**/utilidades/tipo-cambio**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exito: true,
          datos: { venta: 3.75, compra: 3.7, moneda: 'USD', fecha: '2026-05-29' },
        }),
      }),
    );

    const numeroComprobante = sufijoAleatorio(7);

    await gotoY(page, '/compras/nueva');
    await page.locator('[data-testid="select-proveedor-compra"]').selectOption(proveedor.id);
    await fillEstable(page, '[data-testid="input-numero-comprobante-compra"]', numeroComprobante);

    await fillEstable(page, '[data-testid="input-buscar-producto-compra"]', producto.sku);
    const botonAgregar = page
      .locator('[data-testid^="btn-agregar-producto-compra-E2E-"]')
      .first();
    await expect(botonAgregar).toBeVisible({ timeout: 8_000 });
    await botonAgregar.click();

    // Cambiar a USD → dispara autocompletado del TC vía el mock
    await page.locator('[data-testid="btn-moneda-USD"]').click();

    const campoTc = page.locator('[data-testid="campo-tipo-cambio-compra"]');
    await expect(campoTc).toHaveValue('3.75', { timeout: 8_000 });
    await expect(page.getByText(/Oficial SUNAT/i)).toBeVisible();

    // Equivalente en PEN visible (59 USD * 3.75 = 221.25 → S/)
    await expect(page.locator('[data-testid="equivalente-pen-compra"]')).toContainText('S/');

    await page.locator('[data-testid="btn-registrar-compra"]').click();
    await esperarToast(page, /compra registrada/i);
    await expect(page).toHaveURL(/\/compras\/?$/, { timeout: 12_000 });

    // En el listado, la compra debe verse y marcar la moneda USD (US$)
    await page.locator('[data-busqueda]').fill(numeroComprobante);
    await expect(
      page.getByRole('cell', { name: new RegExp(numeroComprobante, 'i') }).first(),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('body')).toContainText(/US\$|USD/);
  });

  test('si json.pe falla, el TC queda manual y la compra igual se registra', async ({
    page,
  }) => {
    const api = await apiContext();
    const proveedor = await seedProveedor(api, {
      razonSocial: `PROV USD MANUAL ${sufijoAleatorio(4)}`,
    });
    const producto = await seedProducto(api, { precioCompra: 40, stockInicial: 0 });
    await api.dispose();

    // Simular json.pe caído (503): el autocompletado no llena el campo.
    await page.route('**/utilidades/tipo-cambio**', route =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ exito: false, mensaje: 'Servicio no disponible' }),
      }),
    );

    const numeroComprobante = sufijoAleatorio(7);
    await gotoY(page, '/compras/nueva');
    await page.locator('[data-testid="select-proveedor-compra"]').selectOption(proveedor.id);
    await fillEstable(page, '[data-testid="input-numero-comprobante-compra"]', numeroComprobante);
    await fillEstable(page, '[data-testid="input-buscar-producto-compra"]', producto.sku);
    const botonAgregar = page
      .locator('[data-testid^="btn-agregar-producto-compra-E2E-"]')
      .first();
    await expect(botonAgregar).toBeVisible({ timeout: 8_000 });
    await botonAgregar.click();

    await page.locator('[data-testid="btn-moneda-USD"]').click();

    // Sin TC, el botón Registrar está deshabilitado
    await expect(page.locator('[data-testid="btn-registrar-compra"]')).toBeDisabled();

    // Tipear TC manual habilita el registro (marca ámbar "manual")
    await fillEstable(page, '[data-testid="campo-tipo-cambio-compra"]', '3.80');
    await expect(page.getByText(/Manual/i)).toBeVisible();
    await expect(page.locator('[data-testid="btn-registrar-compra"]')).toBeEnabled();

    await page.locator('[data-testid="btn-registrar-compra"]').click();
    await esperarToast(page, /compra registrada/i);
  });
});
