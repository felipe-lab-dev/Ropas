# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-plantillas-y-render.spec.ts >> Cupones · plantillas brutales + render PDF/PNG >> descarga PDF y PNG de un cupón
- Location: e2e\02-plantillas-y-render.spec.ts:35:7

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByTestId('cupon-guardar')
    - locator resolved to <button type="button" data-testid="cupon-guardar" class="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] bg-[hsl(var(--brand-primary))] text-white shadow-md hover:bg-[h…>…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-[hsl(265_50%_4%)]/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-[hsl(265_50%_4%)]/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    28 × waiting for element to be visible, enabled and stable
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
                - heading [level=1]: Nuevo cupón
                - paragraph: Configurá el cupón al detalle. Vista previa en vivo a la derecha.
              - generic:
                - generic:
                  - link:
                    - /url: /cupones/
                    - img
                    - text: Volver
                  - button:
                    - img
                    - text: Plantillas
                  - button:
                    - img
                    - text: Desde cero
            - generic:
              - generic:
                - generic:
                  - generic:
                    - heading [level=3]: Identidad
                    - paragraph: Cómo aparece el cupón al cliente y en el sistema.
                  - generic:
                    - generic:
                      - text: Código *
                      - textbox:
                        - /placeholder: VERANO25
                    - generic:
                      - text: Nombre *
                      - textbox:
                        - /placeholder: Verano 2026 — 25% en toda la tienda
                  - generic:
                    - text: Descripción interna
                    - textbox:
                      - /placeholder: A quién va dirigido, qué buscás lograr, condiciones especiales…
                  - generic:
                    - text: Campaña (etiqueta)
                    - textbox:
                      - /placeholder: Black Friday 2026
                - generic:
                  - generic:
                    - heading [level=3]: Descuento
                    - paragraph: Cuánto regalás y bajo qué condiciones.
                  - generic:
                    - generic:
                      - text: Tipo *
                      - generic:
                        - combobox
                        - img
                    - generic:
                      - text: Porcentaje *
                      - spinbutton: "20"
                    - generic:
                      - text: Descuento máx. S/
                      - spinbutton
                  - generic:
                    - text: Compra mínima S/
                    - spinbutton
                - generic:
                  - generic:
                    - heading [level=3]: Vigencia y límites
                    - paragraph: Cuándo es válido y cuántas veces puede usarse.
                  - generic:
                    - generic:
                      - text: Desde *
                      - textbox: 2026-05-25T05:02
                    - generic:
                      - text: Hasta *
                      - textbox: 2026-06-01T05:02
                  - generic:
                    - generic:
                      - text: Usos totales
                      - spinbutton
                    - generic:
                      - text: Usos por cliente *
                      - spinbutton: "1"
                - generic:
                  - generic:
                    - heading [level=3]: Segmento
                    - paragraph: A qué clientes va dirigido.
                  - generic:
                    - text: Segmento objetivo *
                    - generic:
                      - combobox
                      - img
                - generic:
                  - generic:
                    - heading [level=3]: Aplicabilidad
                    - paragraph: Sobre qué se aplica el descuento.
                  - generic:
                    - text: Aplica a *
                    - generic:
                      - combobox
                      - img
                - generic:
                  - generic:
                    - heading [level=3]: Diseño visual
                    - paragraph: Cómo se ve el voucher en PDF, PNG y pantalla.
                  - generic:
                    - generic:
                      - text: Color primario
                      - generic:
                        - textbox: "#7c3aed"
                        - textbox: "#7c3aed"
                    - generic:
                      - text: Color secundario
                      - generic:
                        - textbox: "#1e1b4b"
                        - textbox: "#1e1b4b"
                  - generic:
                    - text: Paletas brutales
                    - generic:
                      - button: Violeta noche
                      - button: Rojo urgente
                      - button: Ámbar flash
                      - button: Cyan ROI
                      - button: Rosa cumple
                      - button: Verde ganancia
                  - generic:
                    - text: Emoji decorativo
                    - generic:
                      - button: 🔥
                      - button: ⚡
                      - button: 🎉
                      - button: 👑
                      - button: 💀
                      - button: 🎂
                      - button: 🛒
                      - button: ⏳
                      - button: 💎
                      - button: 🛍️
                      - textbox:
                        - /placeholder: otro
                  - generic:
                    - text: Mensaje (copy de impacto)
                    - textbox:
                      - /placeholder: Solo por 72 horas — vence y no se renueva
                - generic:
                  - button: Cancelar
                  - button:
                    - img
                    - text: Crear cupón
              - generic:
                - generic:
                  - img
                  - text: Vista previa en vivo
                - generic:
                  - generic:
                    - generic:
                      - generic:
                        - generic: MI TIENDA
                    - generic:
                      - generic: 20%
                      - generic: DE DESCUENTO
                    - generic:
                      - generic: Nombre del cupón
                    - generic:
                      - generic:
                        - generic: XXXXXX
                        - generic:
                          - generic: "Vence: 01-jun."
                - paragraph: Así verá el cupón el cliente en PDF, imagen WhatsApp y pantalla. El QR final se genera al guardar con el código real.
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
  2  | import { gotoY, login } from './helpers';
  3  | 
  4  | test.describe('Cupones · plantillas brutales + render PDF/PNG', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await login(page);
  7  |   });
  8  | 
  9  |   test('aplica plantilla "flash_sale", pre-llena el formulario y permite guardar', async ({ page }) => {
  10 |     await gotoY(page,'/cupones/nuevo?wizard=plantillas');
  11 |     await expect(page.getByText('Plantillas brutales')).toBeVisible();
  12 | 
  13 |     // Las 5 plantillas deben estar visibles
  14 |     for (const id of ['bienvenida_vip', 'reactivacion_urgente', 'cumpleanios', 'recompra_inteligente', 'flash_sale']) {
  15 |       await expect(page.getByTestId(`plantilla-${id}`)).toBeVisible();
  16 |     }
  17 | 
  18 |     // Aplicar flash_sale
  19 |     await page.getByTestId('plantilla-flash_sale').click();
  20 | 
  21 |     // Debe pasar a vista libre con datos pre-cargados
  22 |     await expect(page.getByText('Nuevo cupón')).toBeVisible({ timeout: 5_000 });
  23 |     await expect(page.locator('input[name="codigo"]')).toHaveValue(/.+/);
  24 |     await expect(page.locator('input[name="nombre"]')).toHaveValue(/FLASH/i);
  25 |     await expect(page.locator('input[name="valorDescuento"]')).toHaveValue('35');
  26 | 
  27 |     // Vista previa debe usar el emoji ⚡
  28 |     await expect(page.getByTestId('cupon-preview')).toContainText('⚡');
  29 | 
  30 |     // Guardar
  31 |     await page.getByTestId('cupon-guardar').click();
  32 |     await expect(page).toHaveURL(/\/cupones\/[a-f0-9-]{36}$/, { timeout: 15_000 });
  33 |   });
  34 | 
  35 |   test('descarga PDF y PNG de un cupón', async ({ page }) => {
  36 |     // Crear primero un cupón sencillo
  37 |     await gotoY(page,'/cupones/nuevo');
  38 |     await page.locator('input[name="codigo"]').fill(`PDF-${Date.now().toString(36).toUpperCase()}`);
  39 |     await page.locator('input[name="nombre"]').fill('Cupón render PDF/PNG');
  40 |     await page.locator('input[name="valorDescuento"]').fill('10');
> 41 |     await page.getByTestId('cupon-guardar').click();
     |                                             ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  42 |     await page.waitForURL(/\/cupones\/[a-f0-9-]{36}$/);
  43 | 
  44 |     // Descargar PDF
  45 |     const [pdfDownload] = await Promise.all([
  46 |       page.waitForEvent('download'),
  47 |       page.getByTestId('descargar-pdf').click(),
  48 |     ]);
  49 |     expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/i);
  50 | 
  51 |     // Descargar PNG
  52 |     const [pngDownload] = await Promise.all([
  53 |       page.waitForEvent('download'),
  54 |       page.getByTestId('descargar-png').click(),
  55 |     ]);
  56 |     expect(pngDownload.suggestedFilename()).toMatch(/\.png$/i);
  57 |   });
  58 | });
  59 | 
```