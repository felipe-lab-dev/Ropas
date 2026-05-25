# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-dashboard-marketing.spec.ts >> Cupones · dashboard de marketing brutal >> command palette: muestra acceso a cupones y plantillas
- Location: e2e\05-dashboard-marketing.spec.ts:47:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('option', { name: /Plantilla brutal/i })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('option', { name: /Plantilla brutal/i })

```

```yaml
- region "Notifications alt+T"
- dialog:
  - img
  - combobox [expanded]: cup
  - listbox "Suggestions":
    - group "Acciones rápidas":
      - option "Nuevo cupón" [selected]:
        - img
        - text: Nuevo cupón
      - option "Canjear cupón":
        - img
        - text: Canjear cupón
    - group "Navegación":
      - option "Cupones y promociones":
        - img
        - text: Cupones y promociones
  - button "Cerrar":
    - img
    - text: Cerrar
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { codigoCuponUnico, gotoY, login } from './helpers';
  3  | 
  4  | test.describe('Cupones · dashboard de marketing brutal', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await login(page);
  7  |   });
  8  | 
  9  |   test('lista muestra KPIs por cupón (canjes, tasa, vencimiento)', async ({ page }) => {
  10 |     // Crear un cupón con tope de 10
  11 |     const codigo = codigoCuponUnico('KPI');
  12 |     await gotoY(page,'/cupones/nuevo');
  13 |     await page.locator('input[name="codigo"]').fill(codigo);
  14 |     await page.locator('input[name="nombre"]').fill('Cupón KPIs');
  15 |     await page.locator('input[name="valorDescuento"]').fill('10');
  16 |     await page.locator('input[name="usosMaximosTotal"]').fill('10');
  17 |     await page.getByTestId('cupon-guardar').click();
  18 |     await page.waitForURL(/\/cupones\/[a-f0-9-]{36}$/);
  19 | 
  20 |     // Volver a lista, filtrar por código
  21 |     await gotoY(page,'/cupones');
  22 |     await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
  23 |     await expect(page.getByRole('cell').filter({ hasText: 'Cupón KPIs' })).toBeVisible({ timeout: 5_000 });
  24 | 
  25 |     // Debe mostrar "0 / 10" o similar
  26 |     await expect(page.locator('body')).toContainText('0 / 10');
  27 |     await expect(page.locator('body')).toContainText('0% canje');
  28 |   });
  29 | 
  30 |   test('detalle: tabs/KPIs presentes y sección "Historial de canjes"', async ({ page }) => {
  31 |     const codigo = codigoCuponUnico('DET');
  32 |     await gotoY(page,'/cupones/nuevo');
  33 |     await page.locator('input[name="codigo"]').fill(codigo);
  34 |     await page.locator('input[name="nombre"]').fill('Cupón detalle KPI');
  35 |     await page.locator('input[name="valorDescuento"]').fill('15');
  36 |     await page.getByTestId('cupon-guardar').click();
  37 |     await page.waitForURL(/\/cupones\/[a-f0-9-]{36}$/);
  38 | 
  39 |     // Estamos en detalle: deben aparecer KPIs y la sección histórica
  40 |     await expect(page.getByText('Canjes')).toBeVisible();
  41 |     await expect(page.getByText('Descuento entregado')).toBeVisible();
  42 |     await expect(page.getByText('Ingreso neto')).toBeVisible();
  43 |     await expect(page.getByText('Historial de canjes')).toBeVisible();
  44 |     await expect(page.getByText('Aún no se canjeó este cupón.')).toBeVisible();
  45 |   });
  46 | 
  47 |   test('command palette: muestra acceso a cupones y plantillas', async ({ page }) => {
  48 |     await gotoY(page,'/cupones'); // página cualquiera del shell
  49 |     // Abrir el palette (Ctrl+K o Cmd+K)
  50 |     await page.keyboard.press('Control+k');
  51 |     // Buscar "cupón"
  52 |     await page.getByPlaceholder(/buscar m[oó]dulo/i).fill('cup');
  53 |     await expect(page.getByRole('option', { name: /Nuevo cup[oó]n/i })).toBeVisible({ timeout: 4_000 });
> 54 |     await expect(page.getByRole('option', { name: /Plantilla brutal/i })).toBeVisible();
     |                                                                           ^ Error: expect(locator).toBeVisible() failed
  55 |   });
  56 | 
  57 |   test('sidebar muestra la sección "Promociones" con Cupones', async ({ page }) => {
  58 |     await gotoY(page,'/dashboard');
  59 |     // El sidebar siempre está visible
  60 |     await expect(page.getByRole('link', { name: /^Cupones$/i }).first()).toBeVisible();
  61 |   });
  62 | });
  63 | 
```