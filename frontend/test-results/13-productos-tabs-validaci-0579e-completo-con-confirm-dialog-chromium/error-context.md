# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 13-productos-tabs-validacion.spec.ts >> Productos · Tabs + validación + eliminar con confirm >> crear y eliminar producto E2E completo con confirm dialog
- Location: e2e\13-productos-tabs-validacion.spec.ts:156:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sonner-toast]').filter({ hasText: /producto creado/i }).first()
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for locator('[data-sonner-toast]').filter({ hasText: /producto creado/i }).first()

```

```yaml
- complementary:
  - img
  - text: Ropas ERP
  - navigation:
    - text: Resumen
    - link "Inicio":
      - /url: /bienvenida/
      - img
      - text: Inicio
    - link "Dashboard":
      - /url: /dashboard/
      - img
      - text: Dashboard
    - link "Reportes":
      - /url: /reportes/
      - img
      - text: Reportes
    - text: Operación
    - link "Punto de Venta":
      - /url: /pos/
      - img
      - text: Punto de Venta
    - link "Ventas":
      - /url: /ventas/
      - img
      - text: Ventas
    - link "Notas de crédito":
      - /url: /notas-credito/
      - img
      - text: Notas de crédito
    - link "Caja":
      - /url: /caja/
      - img
      - text: Caja
    - link "Historial de caja":
      - /url: /caja/historial/
      - img
      - text: Historial de caja
    - text: Catálogo
    - link "Productos":
      - /url: /productos/
      - img
      - text: Productos
    - link "Inventario":
      - /url: /inventario/
      - img
      - text: Inventario
    - text: Abastecimiento
    - link "Proveedores":
      - /url: /proveedores/
      - img
      - text: Proveedores
    - link "Compras":
      - /url: /compras/
      - img
      - text: Compras
    - text: Finanzas
    - link "Contabilidad":
      - /url: /contabilidad/
      - img
      - text: Contabilidad
    - text: Promociones
    - link "Cupones":
      - /url: /cupones/
      - img
      - text: Cupones
    - text: Gestión
    - link "Clientes":
      - /url: /clientes/
      - img
      - text: Clientes
    - link "Sucursales":
      - /url: /sucursales/
      - img
      - text: Sucursales
    - link "Usuarios":
      - /url: /usuarios/
      - img
      - text: Usuarios
    - link "Accesos":
      - /url: /accesos/
      - img
      - text: Accesos
    - link "Logs de Sistema":
      - /url: /configuracion/logs-sistema/
      - img
      - text: Logs de Sistema
  - link "Configuración":
    - /url: /configuracion/
    - img
    - text: Configuración
  - text: LF Luis Felipe Herrera Huamán Administrador
  - button "Colapsar":
    - img
- banner:
  - text: Ropas
  - img
  - text: Productos
  - button "Buscar módulos, productos, ventas… Ctrl K":
    - img
    - text: Buscar módulos, productos, ventas… Ctrl K
  - text: Lorem Store full
  - button "Cambiar tema":
    - img
  - button "Cerrar sesión":
    - img
- main:
  - heading "Nuevo producto" [level=1]
  - paragraph: Datos esenciales primero. Las variantes son opcionales.
  - tablist:
    - tab "General" [selected]
    - tab "Variantes"
    - tab "SUNAT"
    - tab "Avanzado"
  - tabpanel "General":
    - text: Código
    - textbox "Código":
      - /placeholder: Opcional
    - paragraph: Opcional. SKU se genera automático.
    - text: Nombre *
    - textbox "Nombre requerido": Tabs E2E 45584
    - text: Categoría *
    - combobox "Categoría requerido":
      - img
      - text: Camisas
    - text: Precio venta (S/) *
    - spinbutton "Precio venta (S/) requerido": "99.90"
    - text: Costo (S/)
    - spinbutton "Costo (S/)"
    - text: Género
    - combobox "Género":
      - img
      - text: Mujer
    - text: Material
    - combobox "Material":
      - text: Seleccioná o escribí…
      - img
  - button "Cancelar" [disabled]:
    - img
    - text: Cancelar
  - button "Guardando…" [disabled]:
    - img
    - text: Guardando…
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  34  |   return sesionCache!;
  35  | }
  36  | 
  37  | /**
  38  |  * Login vía API + addInitScript: inyecta el localStorage ANTES de
  39  |  * que Next.js cargue cualquier script, garantizando que zustand+persist
  40  |  * lo hidrate correctamente en el primer render del shell layout.
  41  |  */
  42  | export async function login(page: Page): Promise<void> {
  43  |   const sesion = await obtenerSesion();
  44  |   // addInitScript se ejecuta en CADA page nueva antes de cualquier script de la app
  45  |   await page.addInitScript((payload: typeof sesionCache) => {
  46  |     if (!payload) return;
  47  |     window.localStorage.setItem(
  48  |       'ropas.sesion',
  49  |       JSON.stringify({
  50  |         state: {
  51  |           accessToken: payload.accessToken,
  52  |           refreshToken: payload.refreshToken,
  53  |           usuario: payload.usuario,
  54  |         },
  55  |         version: 0,
  56  |       }),
  57  |     );
  58  |     // Saltar onboarding (su overlay full-screen intercepta clicks de Playwright)
  59  |     window.localStorage.setItem('ropas.onboarding.completado', 'true');
  60  |   }, sesion);
  61  | 
  62  |   await page.goto('/bienvenida');
  63  |   await page.waitForURL(/\/(bienvenida|dashboard|cupones|ventas|pos)/, { timeout: 15_000 });
  64  |   await page.waitForLoadState('networkidle').catch(() => undefined);
  65  |   await page.waitForTimeout(450);
  66  | }
  67  | 
  68  | /**
  69  |  * Navega y espera a que la página esté estable.
  70  |  *
  71  |  * Necesario porque la app corre con React StrictMode (double-mount en dev)
  72  |  * y framer-motion con `key={pathname}` que remonta el árbol al transicionar.
  73  |  * Combinado, esto detecta el elemento como "detached from the DOM, retrying"
  74  |  * cuando un fill ocurre en el momento exacto del re-mount.
  75  |  *
  76  |  * El waitForLoadState + timeout asegura que el ciclo StrictMode termine
  77  |  * y la animación de entrada del shell layout haya terminado.
  78  |  */
  79  | export async function gotoY(page: Page, url: string): Promise<void> {
  80  |   await page.goto(url);
  81  |   await page.waitForLoadState('domcontentloaded');
  82  |   await page.waitForLoadState('networkidle').catch(() => undefined);
  83  |   // Respiro generoso para ciclo StrictMode (double-mount en dev)
  84  |   // + framer-motion 250ms + hidratación del shell.
  85  |   await page.waitForTimeout(900);
  86  | }
  87  | 
  88  | /**
  89  |  * Fill resiliente a re-renders de React StrictMode (double-mount en dev).
  90  |  * Reintenta hasta 3 veces si el value no quedó persistido.
  91  |  */
  92  | export async function fillEstable(
  93  |   page: Page,
  94  |   selector: string,
  95  |   value: string,
  96  | ): Promise<void> {
  97  |   const loc = page.locator(selector).first();
  98  |   await loc.waitFor({ state: 'visible', timeout: 10_000 });
  99  | 
  100 |   for (let intento = 0; intento < 3; intento++) {
  101 |     await loc.fill(''); // limpiar
  102 |     await loc.fill(value);
  103 |     // Pequeño settle: deja que React procese el onChange y settee state
  104 |     await page.waitForTimeout(120);
  105 |     const actual = await loc.inputValue();
  106 |     if (actual === value) return; // ✓ persistió
  107 |     // Si no quedó, esperar un poco más y reintentar
  108 |     await page.waitForTimeout(300);
  109 |   }
  110 |   // Último intento usando pressSequentially char-por-char + blur explícito
  111 |   await loc.click({ clickCount: 3 });
  112 |   await page.keyboard.press('Delete');
  113 |   await loc.pressSequentially(value, { delay: 25 });
  114 |   await loc.blur();
  115 |   await page.waitForTimeout(120);
  116 |   await expect(loc).toHaveValue(value, { timeout: 5_000 });
  117 | }
  118 | 
  119 | /**
  120 |  * Genera un código aleatorio único de cupón para no chocar entre runs.
  121 |  */
  122 | export function codigoCuponUnico(prefijo = 'E2E'): string {
  123 |   const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  124 |   const sufijo = Array.from({ length: 6 }, () =>
  125 |     chars[Math.floor(Math.random() * chars.length)],
  126 |   ).join('');
  127 |   return `${prefijo}-${sufijo}`;
  128 | }
  129 | 
  130 | /**
  131 |  * Helper para esperar y leer el toast más reciente (sonner).
  132 |  */
  133 | export async function esperarToast(page: Page, texto: RegExp | string): Promise<void> {
> 134 |   await expect(page.locator('[data-sonner-toast]').filter({ hasText: texto }).first()).toBeVisible({
      |                                                                                        ^ Error: expect(locator).toBeVisible() failed
  135 |     timeout: 8_000,
  136 |   });
  137 | }
  138 | 
  139 | // ════════════════════════════════════════════════════════════════════════════
  140 | // SEEDERS vía API — para fixtures que no dependan de la UI.
  141 | // ════════════════════════════════════════════════════════════════════════════
  142 | 
  143 | /**
  144 |  * Devuelve un APIRequestContext con headers de tenant + Bearer token listos.
  145 |  * Usar para llamar endpoints autenticados desde tests.
  146 |  */
  147 | export async function apiContext(): Promise<APIRequestContext> {
  148 |   const sesion = await obtenerSesion();
  149 |   return playwrightRequest.newContext({
  150 |     baseURL: API_URL,
  151 |     extraHTTPHeaders: {
  152 |       'X-Tenant-Code': TENANT_CODE,
  153 |       Authorization: `Bearer ${sesion.accessToken}`,
  154 |     },
  155 |   });
  156 | }
  157 | 
  158 | /**
  159 |  * Devuelve la sucursal que va a tener seleccionada el POS por defecto:
  160 |  * - usuario.sucursalDefecto si existe
  161 |  * - sino, la primera de GET /sucursales
  162 |  *
  163 |  * Útil para sembrar stock en la sucursal correcta antes de un test del POS.
  164 |  */
  165 | export async function sucursalActivaDelPos(api: APIRequestContext): Promise<string> {
  166 |   const sesion = await obtenerSesion();
  167 |   if (sesion.usuario.sucursalDefecto) return sesion.usuario.sucursalDefecto;
  168 |   const res = await api.get('/api/v1/sucursales');
  169 |   if (!res.ok()) throw new Error(`GET /sucursales falló: ${await res.text()}`);
  170 |   const sucursales = (await res.json()).datos ?? [];
  171 |   if (!Array.isArray(sucursales) || sucursales.length === 0) {
  172 |     throw new Error('No hay sucursales en el tenant.');
  173 |   }
  174 |   return sucursales[0].id;
  175 | }
  176 | 
  177 | /**
  178 |  * Sufijo aleatorio para evitar choque entre corridas (RUC, SKU, etc.).
  179 |  */
  180 | export function sufijoAleatorio(largo = 6): string {
  181 |   const chars = '0123456789';
  182 |   return Array.from({ length: largo }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  183 | }
  184 | 
  185 | /**
  186 |  * RUC válido para SUNAT (11 dígitos, primer dígito 1 o 2).
  187 |  * No verifica dígito verificador — suficiente para tests, no para producción.
  188 |  */
  189 | export function rucAleatorio(): string {
  190 |   const prefijo = Math.random() < 0.5 ? '10' : '20';
  191 |   return prefijo + sufijoAleatorio(9);
  192 | }
  193 | 
  194 | export function dniAleatorio(): string {
  195 |   // DNI Perú: 8 dígitos, no empieza en 0
  196 |   return String(Math.floor(Math.random() * 9) + 1) + sufijoAleatorio(7);
  197 | }
  198 | 
  199 | interface SeedProveedorInput {
  200 |   tipoDocumento?: 'ruc' | 'dni';
  201 |   documento?: string;
  202 |   razonSocial?: string;
  203 |   email?: string;
  204 |   condicionPago?: 'contado' | 'credito_15' | 'credito_30' | 'credito_60';
  205 | }
  206 | 
  207 | interface ProveedorSeed {
  208 |   id: string;
  209 |   razonSocial: string;
  210 |   documento: string;
  211 | }
  212 | 
  213 | export async function seedProveedor(
  214 |   api: APIRequestContext,
  215 |   input: SeedProveedorInput = {},
  216 | ): Promise<ProveedorSeed> {
  217 |   const documento = input.documento ?? rucAleatorio();
  218 |   const tipoDocumento = input.tipoDocumento ?? 'ruc';
  219 |   const razonSocial = input.razonSocial ?? `PROVEEDOR E2E ${sufijoAleatorio(4)}`;
  220 |   const body = {
  221 |     tipoDocumento,
  222 |     documento,
  223 |     razonSocial,
  224 |     email: input.email,
  225 |     condicionPago: input.condicionPago ?? 'contado',
  226 |     diasCredito: 0,
  227 |   };
  228 |   const res = await api.post('/api/v1/proveedores', { data: body });
  229 |   if (!res.ok()) {
  230 |     throw new Error(`seedProveedor falló (${res.status()}): ${await res.text()}`);
  231 |   }
  232 |   const json = await res.json();
  233 |   // Algunos endpoints devuelven { exito, datos } y otros { datos } — soportamos ambos.
  234 |   const datos = json.datos ?? json;
```