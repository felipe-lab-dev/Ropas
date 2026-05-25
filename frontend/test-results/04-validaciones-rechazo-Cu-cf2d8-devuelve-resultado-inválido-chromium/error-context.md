# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-validaciones-rechazo.spec.ts >> Cupones · validaciones y rechazos >> canjear: código inexistente devuelve resultado inválido
- Location: e2e\04-validaciones-rechazo.spec.ts:9:7

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByTestId('canjear-validar')
    - locator resolved to <button type="submit" data-testid="canjear-validar" class="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] bg-[hsl(var(--brand-primary))] text-white shadow-md hover:bg-…>…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="px-6 py-4 bg-gradient-to-br text-white flex items-start justify-between gap-4 relative overflow-hidden from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))]">…</div> from <div role="dialog" tabindex="-1" id="radix-_r_t_" data-state="open" aria-labelledby="radix-_r_u_" aria-describedby="radix-_r_v_" class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))] rounded-2xl overflow-hidden shadow-[0_28px_64px_-12px_hsl(265_50%_4%/0.55)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 da…>…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="px-6 py-4 bg-gradient-to-br text-white flex items-start justify-between gap-4 relative overflow-hidden from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))]">…</div> from <div role="dialog" tabindex="-1" id="radix-_r_t_" data-state="open" aria-labelledby="radix-_r_u_" aria-describedby="radix-_r_v_" class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))] rounded-2xl overflow-hidden shadow-[0_28px_64px_-12px_hsl(265_50%_4%/0.55)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 da…>…</div> subtree intercepts pointer events
  2 × retrying click action
      - waiting 100ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-[hsl(265_50%_4%)]/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events
  7 × retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="px-6 py-4 bg-gradient-to-br text-white flex items-start justify-between gap-4 relative overflow-hidden from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))]">…</div> from <div role="dialog" tabindex="-1" id="radix-_r_t_" data-state="open" aria-labelledby="radix-_r_u_" aria-describedby="radix-_r_v_" class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))] rounded-2xl overflow-hidden shadow-[0_28px_64px_-12px_hsl(265_50%_4%/0.55)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 da…>…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="px-6 py-4 bg-gradient-to-br text-white flex items-start justify-between gap-4 relative overflow-hidden from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))]">…</div> from <div role="dialog" tabindex="-1" id="radix-_r_t_" data-state="open" aria-labelledby="radix-_r_u_" aria-describedby="radix-_r_v_" class="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))] rounded-2xl overflow-hidden shadow-[0_28px_64px_-12px_hsl(265_50%_4%/0.55)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 da…>…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-[hsl(265_50%_4%)]/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-[hsl(265_50%_4%)]/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events
  - retrying click action
    - waiting 500ms

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
                - heading [level=1]: Canjear cupón
                - paragraph: Validá un código antes de aceptarlo en una venta. Para aplicar el descuento, pasalo al POS.
              - generic:
                - link:
                  - /url: /cupones/
                  - img
                  - text: Volver
            - generic:
              - generic:
                - generic:
                  - img
                  - textbox:
                    - /placeholder: Escanea o escribe el código del cupón…
                    - text: FAKE-12345
                - button:
                  - img
                  - text: Validar
              - generic: "Nota: la validación rápida no aplica filtros de carrito (categorías/productos específicos). Para el cálculo exacto del descuento, usá el POS con el carrito real."
            - generic:
              - generic:
                - img
                - text: Cupones vigentes ahora
              - generic:
                - generic: No hay cupones activos ahora mismo.
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
  4  | test.describe('Cupones · validaciones y rechazos', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await login(page);
  7  |   });
  8  | 
  9  |   test('canjear: código inexistente devuelve resultado inválido', async ({ page }) => {
  10 |     await gotoY(page,'/cupones/canjear');
  11 |     await page.getByTestId('canjear-codigo').fill('FAKE-12345');
> 12 |     await page.getByTestId('canjear-validar').click();
     |                                               ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  13 |     const resultado = page.getByTestId('canjear-resultado');
  14 |     await expect(resultado).toBeVisible({ timeout: 8_000 });
  15 |     await expect(resultado).toContainText(/rechazado|no existe/i);
  16 |   });
  17 | 
  18 |   test('formulario: rechaza fecha fin anterior a fecha inicio', async ({ page }) => {
  19 |     await gotoY(page,'/cupones/nuevo');
  20 |     const codigo = codigoCuponUnico('VAL');
  21 |     await page.locator('input[name="codigo"]').fill(codigo);
  22 |     await page.locator('input[name="nombre"]').fill('Cupón fecha mala');
  23 |     // Poner fin antes que inicio
  24 |     const fmt = (d: Date) =>
  25 |       `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  26 |     const fin = new Date(Date.now() - 2 * 86400_000);
  27 |     const inicio = new Date();
  28 |     await page.locator('input[name="fechaInicio"]').fill(fmt(inicio));
  29 |     await page.locator('input[name="fechaFin"]').fill(fmt(fin));
  30 |     await page.locator('input[name="valorDescuento"]').fill('20');
  31 |     await page.getByTestId('cupon-guardar').click();
  32 |     await expect(page.locator('body')).toContainText(/posterior al inicio|fecha fin/i, { timeout: 5_000 });
  33 |   });
  34 | 
  35 |   test('formulario: rechaza porcentaje > 100', async ({ page }) => {
  36 |     await gotoY(page,'/cupones/nuevo');
  37 |     await page.locator('input[name="codigo"]').fill(codigoCuponUnico('PCT'));
  38 |     await page.locator('input[name="nombre"]').fill('Cupón % inválido');
  39 |     await page.locator('input[name="valorDescuento"]').fill('150');
  40 |     await page.getByTestId('cupon-guardar').click();
  41 |     await expect(page.locator('body')).toContainText(/entre 1 y 100/i, { timeout: 5_000 });
  42 |   });
  43 | 
  44 |   test('canjear: cupón vencido no se acepta (creamos uno con fechas pasadas vía formulario y dejamos que backend lo rechace)', async ({ page }) => {
  45 |     // Probamos directo el endpoint: como no podemos forzar fechas pasadas desde el form,
  46 |     // confirmamos al menos que el backend devuelve "no existe" para un código inventado al canjear.
  47 |     await gotoY(page,'/cupones/canjear');
  48 |     await page.getByTestId('canjear-codigo').fill('VENCIDO-2020');
  49 |     await page.getByTestId('canjear-validar').click();
  50 |     await expect(page.getByTestId('canjear-resultado')).toBeVisible({ timeout: 8_000 });
  51 |   });
  52 | });
  53 | 
```