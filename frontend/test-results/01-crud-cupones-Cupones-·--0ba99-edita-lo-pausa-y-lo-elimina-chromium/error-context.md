# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-crud-cupones.spec.ts >> Cupones · CRUD básico >> crea un cupón desde cero, lo busca en la lista, lo edita, lo pausa y lo elimina
- Location: e2e\01-crud-cupones.spec.ts:9:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Nuevo cupón')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('Nuevo cupón')

```

```yaml
- navigation:
  - button "previous" [disabled]:
    - img "previous"
  - text: 1/1
  - button "next" [disabled]:
    - img "next"
- img
- img
- text: Next.js 16.2.6 Turbopack
- img
- dialog "Runtime Error":
  - text: Runtime Error
  - button "Copy Error Info":
    - img
  - button "No related documentation found" [disabled]:
    - img
  - button "Attach Node.js inspector":
    - img
  - text: "An unexpected Turbopack error occurred. Please see the output of `next dev` for more details."
  - paragraph: Call Stack 2
  - button "Show 2 ignore-listed frame(s)":
    - text: Show 2 ignore-listed frame(s)
    - img
- contentinfo:
  - region "Error feedback":
    - paragraph:
      - link "Was this helpful?":
        - /url: https://nextjs.org/telemetry#error-feedback
    - button "Mark as helpful"
    - button "Mark as not helpful"
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- button "Collapse issues badge":
  - img
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { codigoCuponUnico, fillEstable, gotoY, login } from './helpers';
  3  | 
  4  | test.describe('Cupones · CRUD básico', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await login(page);
  7  |   });
  8  | 
  9  |   test('crea un cupón desde cero, lo busca en la lista, lo edita, lo pausa y lo elimina', async ({ page }) => {
  10 |     const codigo = codigoCuponUnico('CRUD');
  11 |     const nombre = `Cupón ${codigo}`; // único por run para evitar choque con runs anteriores
  12 | 
  13 |     // 1. Crear
  14 |     await gotoY(page,'/cupones/nuevo');
> 15 |     await expect(page.getByText('Nuevo cupón')).toBeVisible();
     |                                                 ^ Error: expect(locator).toBeVisible() failed
  16 | 
  17 |     await fillEstable(page, 'input[name="codigo"]', codigo);
  18 |     await fillEstable(page, 'input[name="nombre"]', nombre);
  19 |     await fillEstable(page, 'input[name="valorDescuento"]', '15');
  20 | 
  21 |     // Vista previa en vivo debe reflejar el código
  22 |     await expect(page.getByTestId('cupon-preview')).toContainText(codigo);
  23 | 
  24 |     await page.getByTestId('cupon-guardar').click();
  25 |     await expect(page).toHaveURL(/\/cupones\/[a-f0-9-]{36}\/?$/, { timeout: 15_000 });
  26 |     await expect(page.locator('body')).toContainText(codigo);
  27 | 
  28 |     // 2. Volver a la lista y buscar (por código, único)
  29 |     await gotoY(page,'/cupones');
  30 |     await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
  31 |     await expect(page.getByRole('cell', { name: new RegExp(codigo, 'i') }).first()).toBeVisible({ timeout: 6_000 });
  32 |     // Esperar a que el link de edición exista (debounce 250ms + refetch)
  33 |     const editarLink = page.getByRole('link', { name: new RegExp(`editar ${codigo}`, 'i') });
  34 |     await expect(editarLink).toBeVisible({ timeout: 5_000 });
  35 | 
  36 |     // 3. Editar nombre
  37 |     await editarLink.click();
  38 |     await expect(page).toHaveURL(/\/cupones\/editar\/?\?id=/);
  39 |     await fillEstable(page, 'input[name="nombre"]', `${nombre} (editado)`);
  40 |     await page.getByTestId('cupon-guardar').click();
  41 |     await expect(page).toHaveURL(/\/cupones\/[a-f0-9-]{36}\/?$/, { timeout: 15_000 });
  42 |     await expect(page.locator('body')).toContainText(`${nombre} (editado)`);
  43 | 
  44 |     // 4. Pausar desde la lista
  45 |     await gotoY(page,'/cupones');
  46 |     await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
  47 |     await page.getByRole('button', { name: new RegExp(`pausar ${codigo}`, 'i') }).click();
  48 |     await expect(page.getByText(/Pausado/i).first()).toBeVisible({ timeout: 5_000 });
  49 | 
  50 |     // 5. Eliminar
  51 |     await page.getByRole('button', { name: new RegExp(`eliminar ${codigo}`, 'i') }).click();
  52 |     await expect(page.getByRole('dialog', { name: /eliminar cup[oó]n/i })).toBeVisible();
  53 |     await page.getByRole('button', { name: /s[ií], eliminar/i }).click();
  54 |     await expect(page.locator('body')).not.toContainText(codigo, { timeout: 6_000 });
  55 |   });
  56 | });
  57 | 
```