# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-aplicar-en-venta.spec.ts >> Cupones · aplicación end-to-end en venta >> código inexistente: el POS muestra error claro
- Location: e2e\03-aplicar-en-venta.spec.ts:50:7

# Error details

```
TimeoutError: locator.waitFor: Timeout 8000ms exceeded.
Call log:
  - waiting for locator('button[class*="rounded-lg"]').filter({ hasText: /Talla/i }).first() to be visible

```

# Page snapshot

```yaml
- generic:
  - generic [ref=e5] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e6]:
      - img [ref=e7]
    - generic [ref=e10]:
      - button "Open issues overlay" [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: "0"
          - generic [ref=e14]: "1"
        - generic [ref=e15]: Issue
      - button "Collapse issues badge" [ref=e16]:
        - img [ref=e17]
  - generic:
    - generic:
      - complementary:
        - generic:
          - generic:
            - img
          - generic:
            - generic: Ropas
            - generic: ERP
        - navigation:
          - generic:
            - generic: Resumen
            - link:
              - /url: /bienvenida/
              - img
              - generic: Inicio
            - link:
              - /url: /dashboard/
              - img
              - generic: Dashboard
            - link:
              - /url: /reportes/
              - img
              - generic: Reportes
          - generic:
            - generic: Operación
            - link:
              - /url: /pos/
              - img
              - generic: Punto de Venta
            - link:
              - /url: /ventas/
              - img
              - generic: Ventas
            - link:
              - /url: /notas-credito/
              - img
              - generic: Notas de crédito
            - link:
              - /url: /caja/
              - img
              - generic: Caja
            - link:
              - /url: /caja/historial/
              - img
              - generic: Historial de caja
          - generic:
            - generic: Catálogo
            - link:
              - /url: /productos/
              - img
              - generic: Productos
            - link:
              - /url: /inventario/
              - img
              - generic: Inventario
          - generic:
            - generic: Abastecimiento
            - link:
              - /url: /proveedores/
              - img
              - generic: Proveedores
            - link:
              - /url: /compras/
              - img
              - generic: Compras
          - generic:
            - generic: Promociones
            - link:
              - /url: /cupones/
              - img
              - generic: Cupones
          - generic:
            - generic: Gestión
            - link:
              - /url: /clientes/
              - img
              - generic: Clientes
            - link:
              - /url: /sucursales/
              - img
              - generic: Sucursales
        - generic:
          - link:
            - /url: /configuracion/
            - img
            - generic: Configuración
          - generic:
            - generic: A
            - generic:
              - generic: Administrador
              - generic: Administrador
        - button:
          - img
    - generic:
      - banner:
        - generic:
          - generic: Ropas
          - img
          - generic: Punto de Venta
        - button:
          - img
          - generic: Buscar módulos, productos, ventas…
          - generic: Ctrl K
        - generic:
          - generic:
            - generic: Mi Tienda
            - generic: Local Dev
          - button:
            - generic:
              - img
          - button:
            - img
      - main:
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - img
                - generic:
                  - heading [level=1]: Punto de Venta
                  - paragraph: "Atajo: / para enfocar la búsqueda"
                - generic: POS
              - generic:
                - img
                - generic:
                  - paragraph: No hay sesión de caja abierta
                  - paragraph:
                    - text: Las ventas no quedarán asociadas al cierre de caja.
                    - link:
                      - /url: /caja/
                      - text: Abrir caja
              - generic:
                - generic:
                  - img
                  - textbox:
                    - /placeholder: Buscar producto por nombre, SKU o escanear código de barras…
                    - text: a
                - button:
                  - img
                  - text: Escanear
              - generic:
                - generic:
                  - generic:
                    - img
                    - paragraph: Carrito vacío. Buscá productos arriba.
            - generic:
              - generic:
                - generic:
                  - generic:
                    - paragraph: Total a cobrar
                    - generic: S/ 0.00
                    - paragraph: 0 items · 0 unidades
                - generic:
                  - paragraph:
                    - img
                    - text: Cliente
                  - generic:
                    - generic:
                      - textbox:
                        - /placeholder: DNI, RUC, nombre…
                      - link:
                        - /url: /clientes/
                        - img
                - generic:
                  - paragraph:
                    - img
                    - text: Descuento manual
                  - generic:
                    - spinbutton
                    - generic: monto
                - generic:
                  - paragraph:
                    - img
                    - text: Cupón
                  - generic:
                    - textbox [disabled]:
                      - /placeholder: Código del cupón
                    - button [disabled]: Aplicar
                - generic:
                  - paragraph: Medio de pago
                  - generic:
                    - button:
                      - img
                      - text: Efectivo
                    - button:
                      - img
                      - text: Tarjeta
                    - button:
                      - img
                      - text: Yape/Plin
                - button [disabled]: Cobrar S/ 0.00
  - region "Notifications alt+T"
  - alert
  - dialog "¡Bienvenido a Ropas!" [ref=e20]:
    - generic [ref=e21]:
      - generic [ref=e22]:
        - img [ref=e24]
        - generic [ref=e26]:
          - heading "¡Bienvenido a Ropas!" [level=2] [ref=e27]
          - paragraph [ref=e28]: Paso 1 de 4
      - button "Cerrar" [active] [ref=e29]:
        - img [ref=e30]
    - generic [ref=e33]:
      - generic [ref=e34]:
        - paragraph [ref=e35]: Tu ERP para tienda de ropa. Vendé más rápido, controlá tu tienda. Te mostramos lo esencial en 4 pasos.
        - generic [ref=e36]:
          - generic [ref=e37]:
            - img [ref=e39]
            - generic [ref=e41]: Catálogo con variantes
          - generic [ref=e42]:
            - img [ref=e44]
            - generic [ref=e46]: POS rápido
          - generic [ref=e47]:
            - img [ref=e49]
            - generic [ref=e51]: Inventario multi-sucursal
          - generic [ref=e52]:
            - img [ref=e54]
            - generic [ref=e56]: Reportes en tiempo real
        - generic [ref=e57]:
          - img [ref=e58]
          - generic [ref=e64]:
            - text: "Tip: en"
            - link "Configuración" [ref=e65] [cursor=pointer]:
              - /url: /configuracion
            - text: podés elegir entre 7 paletas y modo claro/oscuro.
      - generic [ref=e66]:
        - button "Ir al paso 1" [ref=e67]
        - button "Ir al paso 2" [ref=e68]
        - button "Ir al paso 3" [ref=e69]
        - button "Ir al paso 4" [ref=e70]
    - generic [ref=e72]:
      - button "Saltar tour" [ref=e73]
      - generic [ref=e74]:
        - button "Atrás" [disabled]:
          - img
          - text: Atrás
        - button "Siguiente" [ref=e75]:
          - text: Siguiente
          - img
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { codigoCuponUnico, gotoY, login } from './helpers';
  3  | 
  4  | test.describe('Cupones · aplicación end-to-end en venta', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await login(page);
  7  |   });
  8  | 
  9  |   test('crea cupón → aplica en POS → confirma venta → ve canje en detalle', async ({ page }) => {
  10 |     const codigo = codigoCuponUnico('VTA');
  11 | 
  12 |     // 1. Crear cupón de 20% sin condiciones
  13 |     await gotoY(page,'/cupones/nuevo');
  14 |     await page.locator('input[name="codigo"]').fill(codigo);
  15 |     await page.locator('input[name="nombre"]').fill('Cupón aplicar-en-venta');
  16 |     await page.locator('input[name="valorDescuento"]').fill('20');
  17 |     await page.getByTestId('cupon-guardar').click();
  18 |     await page.waitForURL(/\/cupones\/[a-f0-9-]{36}$/);
  19 |     const cuponId = page.url().split('/').pop()!;
  20 | 
  21 |     // 2. Ir al POS, agregar un producto al carrito
  22 |     await gotoY(page,'/pos');
  23 |     await expect(page.getByText('Punto de Venta')).toBeVisible();
  24 | 
  25 |     // Buscar cualquier producto del seed
  26 |     await page.getByPlaceholder(/buscar producto/i).fill('a');
  27 |     // Esperar resultados y hacer click al primer producto/variante
  28 |     const primerResultado = page.locator('button[class*="rounded-lg"]').filter({ hasText: /Talla/i }).first();
  29 |     await primerResultado.waitFor({ state: 'visible', timeout: 8_000 });
  30 |     await primerResultado.click();
  31 | 
  32 |     // 3. Aplicar el cupón
  33 |     await page.getByTestId('pos-codigo-cupon').fill(codigo);
  34 |     await page.getByTestId('pos-validar-cupon').click();
  35 | 
  36 |     // Debe aparecer el chip verde con el código
  37 |     await expect(page.locator('body')).toContainText(/Cup[oó]n aplicado/i, { timeout: 8_000 });
  38 | 
  39 |     // 4. Cobrar
  40 |     await page.getByRole('button', { name: /^Cobrar /i }).click();
  41 |     await expect(page.locator('body')).toContainText(/Venta V-\d+ registrada/i, { timeout: 10_000 });
  42 | 
  43 |     // 5. Volver al detalle del cupón y verificar que aparece el uso
  44 |     await gotoY(page,`/cupones/${cuponId}`);
  45 |     await expect(page.locator('body')).toContainText('1', { timeout: 5_000 }); // al menos un canje
  46 |     // En la tabla "Historial de canjes" debe haber al menos una fila V-xxxxxx
  47 |     await expect(page.locator('a').filter({ hasText: /^V-\d+$/ }).first()).toBeVisible({ timeout: 5_000 });
  48 |   });
  49 | 
  50 |   test('código inexistente: el POS muestra error claro', async ({ page }) => {
  51 |     await gotoY(page,'/pos');
  52 |     // Agregar al menos un producto al carrito (sin él no se habilita el input)
  53 |     await page.getByPlaceholder(/buscar producto/i).fill('a');
  54 |     const primerResultado = page.locator('button[class*="rounded-lg"]').filter({ hasText: /Talla/i }).first();
> 55 |     await primerResultado.waitFor({ state: 'visible', timeout: 8_000 });
     |                           ^ TimeoutError: locator.waitFor: Timeout 8000ms exceeded.
  56 |     await primerResultado.click();
  57 | 
  58 |     await page.getByTestId('pos-codigo-cupon').fill('NOEXISTE-XYZ');
  59 |     await page.getByTestId('pos-validar-cupon').click();
  60 |     await expect(page.locator('body')).toContainText(/no existe/i, { timeout: 8_000 });
  61 |   });
  62 | });
  63 | 
```