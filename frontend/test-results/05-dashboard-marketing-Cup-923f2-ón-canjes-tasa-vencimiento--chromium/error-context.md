# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-dashboard-marketing.spec.ts >> Cupones · dashboard de marketing brutal >> lista muestra KPIs por cupón (canjes, tasa, vencimiento)
- Location: e2e\05-dashboard-marketing.spec.ts:9:7

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
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed

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
                      - textbox: 2026-05-25T05:04
                    - generic:
                      - text: Hasta *
                      - textbox: 2026-06-01T05:04
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
> 17 |     await page.getByTestId('cupon-guardar').click();
     |                                             ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
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
  54 |     await expect(page.getByRole('option', { name: /Plantilla brutal/i })).toBeVisible();
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