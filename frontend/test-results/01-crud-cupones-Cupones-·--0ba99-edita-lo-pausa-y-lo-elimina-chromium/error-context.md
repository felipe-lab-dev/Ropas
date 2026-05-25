# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-crud-cupones.spec.ts >> Cupones · CRUD básico >> crea un cupón desde cero, lo busca en la lista, lo edita, lo pausa y lo elimina
- Location: e2e\01-crud-cupones.spec.ts:9:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('cupon-preview')
Expected substring: "CRUD-Q7A7DD"
Received string:    "MI TIENDA20%DE DESCUENTONombre del cupónXXXXXXVence: 01-jun."
Timeout: 10000ms

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for getByTestId('cupon-preview')
    24 × locator resolved to <div data-testid="cupon-preview" class="relative overflow-hidden rounded-2xl shadow-2xl w-[420px] h-[260px] text-white">…</div>
       - unexpected value "MI TIENDA20%DE DESCUENTONombre del cupónXXXXXXVence: 01-jun."

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
                      - textbox: 2026-05-25T05:01
                    - generic:
                      - text: Hasta *
                      - textbox: 2026-06-01T05:01
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
  4  | test.describe('Cupones · CRUD básico', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await login(page);
  7  |   });
  8  | 
  9  |   test('crea un cupón desde cero, lo busca en la lista, lo edita, lo pausa y lo elimina', async ({ page }) => {
  10 |     const codigo = codigoCuponUnico('CRUD');
  11 | 
  12 |     // 1. Crear
  13 |     await gotoY(page,'/cupones/nuevo');
  14 |     await expect(page.getByText('Nuevo cupón')).toBeVisible();
  15 | 
  16 |     await page.locator('input[name="codigo"]').fill(codigo);
  17 |     await page.locator('input[name="nombre"]').fill('Cupón CRUD E2E');
  18 |     await page.locator('input[name="valorDescuento"]').fill('15');
  19 | 
  20 |     // Vista previa en vivo debe reflejar el código
> 21 |     await expect(page.getByTestId('cupon-preview')).toContainText(codigo);
     |                                                     ^ Error: expect(locator).toContainText(expected) failed
  22 | 
  23 |     await page.getByTestId('cupon-guardar').click();
  24 |     await expect(page).toHaveURL(/\/cupones\/[a-f0-9-]{36}$/, { timeout: 15_000 });
  25 |     await expect(page.locator('body')).toContainText(codigo);
  26 | 
  27 |     // 2. Volver a la lista y buscar
  28 |     await gotoY(page,'/cupones');
  29 |     await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
  30 |     await expect(page.getByRole('cell', { name: 'Cupón CRUD E2E' })).toBeVisible({ timeout: 6_000 });
  31 | 
  32 |     // 3. Editar nombre
  33 |     await page.getByRole('link', { name: new RegExp(`editar ${codigo}`, 'i') }).click();
  34 |     await expect(page).toHaveURL(/\/cupones\/editar\?id=/);
  35 |     const nombreInput = page.locator('input[name="nombre"]');
  36 |     await nombreInput.fill('Cupón CRUD E2E (editado)');
  37 |     await page.getByTestId('cupon-guardar').click();
  38 |     await expect(page).toHaveURL(/\/cupones\/[a-f0-9-]{36}$/, { timeout: 15_000 });
  39 |     await expect(page.locator('body')).toContainText('Cupón CRUD E2E (editado)');
  40 | 
  41 |     // 4. Pausar desde la lista
  42 |     await gotoY(page,'/cupones');
  43 |     await page.getByPlaceholder(/c[oó]digo, nombre/i).fill(codigo);
  44 |     await page.getByRole('button', { name: new RegExp(`pausar ${codigo}`, 'i') }).click();
  45 |     await expect(page.getByText(/Pausado/i).first()).toBeVisible({ timeout: 5_000 });
  46 | 
  47 |     // 5. Eliminar
  48 |     await page.getByRole('button', { name: new RegExp(`eliminar ${codigo}`, 'i') }).click();
  49 |     await expect(page.getByRole('dialog', { name: /eliminar cup[oó]n/i })).toBeVisible();
  50 |     await page.getByRole('button', { name: /s[ií], eliminar/i }).click();
  51 |     await expect(page.locator('body')).not.toContainText(codigo, { timeout: 6_000 });
  52 |   });
  53 | });
  54 | 
```