import { test, expect } from '@playwright/test';
import { codigoCuponUnico, fillEstable, gotoY, login } from './helpers';

test.describe('Cupones · aplicación end-to-end en venta', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea cupón → aplica en POS → confirma venta → ve canje en detalle', async ({ page }) => {
    const codigo = codigoCuponUnico('VTA');

    // 1. Crear cupón de 20% sin condiciones
    await gotoY(page,'/cupones/nuevo');
    await fillEstable(page, 'input[name="codigo"]', codigo);
    await fillEstable(page, 'input[name="nombre"]', `Cupón aplicar ${codigo}`);
    await fillEstable(page, 'input[name="valorDescuento"]', '20');
    await page.getByTestId('btn-guardar').click();
    await page.waitForURL(/\/cupones\/detalle\/?\?id=[a-f0-9-]{36}/);
    const cuponId = new URL(page.url()).searchParams.get('id')!;

    // 2. Ir al POS, agregar un producto al carrito
    await gotoY(page,'/pos');
    await expect(page.getByRole('heading', { name: 'Punto de Venta' })).toBeVisible();

    // Buscar cualquier producto del seed
    await page.getByPlaceholder(/buscar producto/i).fill('po');
    // Esperar resultados; tomamos la primera variante NO disabled (con stock)
    const primerResultado = page.locator('button:not([disabled])').filter({ hasText: /Talla/i }).first();
    await primerResultado.waitFor({ state: 'visible', timeout: 10_000 });
    await primerResultado.click();

    // 3. Aplicar el cupón
    await page.getByTestId('pos-codigo-cupon').fill(codigo);
    await page.getByTestId('pos-validar-cupon').click();

    // Debe aparecer el chip verde con el código
    await expect(page.locator('body')).toContainText(/Cup[oó]n aplicado/i, { timeout: 8_000 });

    // 4. Cobrar
    await page.getByRole('button', { name: /^Cobrar /i }).click();
    await expect(page.locator('body')).toContainText(/Venta V-\d+ registrada/i, { timeout: 10_000 });

    // 5. Volver al detalle del cupón y verificar que aparece el uso
    await gotoY(page,`/cupones/detalle?id=${cuponId}`);
    await expect(page.locator('body')).toContainText('1', { timeout: 5_000 }); // al menos un canje
    // En la tabla "Historial de canjes" debe haber al menos una fila V-xxxxxx
    await expect(page.locator('a').filter({ hasText: /^V-\d+$/ }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('código inexistente: el POS muestra error claro', async ({ page }) => {
    await gotoY(page,'/pos');
    // Agregar al menos un producto al carrito (sin él no se habilita el input)
    await page.getByPlaceholder(/buscar producto/i).fill('po');
    const primerResultado = page.locator('button:not([disabled])').filter({ hasText: /Talla/i }).first();
    await primerResultado.waitFor({ state: 'visible', timeout: 10_000 });
    await primerResultado.click();

    await page.getByTestId('pos-codigo-cupon').fill('NOEXISTE-XYZ');
    await page.getByTestId('pos-validar-cupon').click();
    await expect(page.locator('body')).toContainText(/no existe/i, { timeout: 8_000 });
  });
});
