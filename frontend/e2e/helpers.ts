import { type APIRequestContext, type Page, expect, request as playwrightRequest } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
export const TENANT_CODE = process.env.E2E_TENANT_CODE ?? 'mi-tienda';
export const ADMIN_DNI = process.env.E2E_ADMIN_DNI ?? '70498300';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

// Cache de sesión: pegamos login API una sola vez por proceso de Playwright
// y reusamos el payload entre tests. Esto acelera y evita rate-limit.
let sesionCache: {
  accessToken: string;
  refreshToken: string;
  usuario: { id: string; nombre: string; email: string; rol: string; permisos: string[]; sucursalDefecto?: string | null };
} | null = null;

async function obtenerSesion() {
  if (sesionCache) return sesionCache;
  if (!ADMIN_PASSWORD) {
    throw new Error('E2E_ADMIN_PASSWORD no está definida.');
  }
  const ctx = await playwrightRequest.newContext({
    extraHTTPHeaders: { 'X-Tenant-Code': TENANT_CODE },
  });
  const res = await ctx.post(`${API_URL}/api/v1/auth/login`, {
    data: { identificador: ADMIN_DNI, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Login API falló (${res.status()}): ${body}`);
  }
  const json = await res.json();
  await ctx.dispose();
  sesionCache = json.datos;
  return sesionCache!;
}

/**
 * Login vía API + addInitScript: inyecta el localStorage ANTES de
 * que Next.js cargue cualquier script, garantizando que zustand+persist
 * lo hidrate correctamente en el primer render del shell layout.
 */
export async function login(page: Page): Promise<void> {
  const sesion = await obtenerSesion();
  // addInitScript se ejecuta en CADA page nueva antes de cualquier script de la app
  await page.addInitScript((payload: typeof sesionCache) => {
    if (!payload) return;
    window.localStorage.setItem(
      'ropas.sesion',
      JSON.stringify({
        state: {
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          usuario: payload.usuario,
        },
        version: 0,
      }),
    );
    // Saltar onboarding (su overlay full-screen intercepta clicks de Playwright)
    window.localStorage.setItem('ropas.onboarding.completado', 'true');
  }, sesion);

  await page.goto('/bienvenida');
  await page.waitForURL(/\/(bienvenida|dashboard|cupones|ventas|pos)/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(450);
}

/**
 * Navega y espera a que la página esté estable.
 *
 * Necesario porque la app corre con React StrictMode (double-mount en dev)
 * y framer-motion con `key={pathname}` que remonta el árbol al transicionar.
 * Combinado, esto detecta el elemento como "detached from the DOM, retrying"
 * cuando un fill ocurre en el momento exacto del re-mount.
 *
 * El waitForLoadState + timeout asegura que el ciclo StrictMode termine
 * y la animación de entrada del shell layout haya terminado.
 */
export async function gotoY(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  // Respiro generoso para ciclo StrictMode (double-mount en dev)
  // + framer-motion 250ms + hidratación del shell.
  await page.waitForTimeout(900);
}

/**
 * Fill resiliente a re-renders de React StrictMode (double-mount en dev).
 * Reintenta hasta 3 veces si el value no quedó persistido.
 */
export async function fillEstable(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout: 10_000 });

  for (let intento = 0; intento < 3; intento++) {
    await loc.fill(''); // limpiar
    await loc.fill(value);
    // Pequeño settle: deja que React procese el onChange y settee state
    await page.waitForTimeout(120);
    const actual = await loc.inputValue();
    if (actual === value) return; // ✓ persistió
    // Si no quedó, esperar un poco más y reintentar
    await page.waitForTimeout(300);
  }
  // Último intento usando pressSequentially char-por-char + blur explícito
  await loc.click({ clickCount: 3 });
  await page.keyboard.press('Delete');
  await loc.pressSequentially(value, { delay: 25 });
  await loc.blur();
  await page.waitForTimeout(120);
  await expect(loc).toHaveValue(value, { timeout: 5_000 });
}

/**
 * Genera un código aleatorio único de cupón para no chocar entre runs.
 */
export function codigoCuponUnico(prefijo = 'E2E'): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const sufijo = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('');
  return `${prefijo}-${sufijo}`;
}

/**
 * Helper para esperar y leer el toast más reciente (sonner).
 */
export async function esperarToast(page: Page, texto: RegExp | string): Promise<void> {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: texto }).first()).toBeVisible({
    timeout: 8_000,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SEEDERS vía API — para fixtures que no dependan de la UI.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Devuelve un APIRequestContext con headers de tenant + Bearer token listos.
 * Usar para llamar endpoints autenticados desde tests.
 */
export async function apiContext(): Promise<APIRequestContext> {
  const sesion = await obtenerSesion();
  return playwrightRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      'X-Tenant-Code': TENANT_CODE,
      Authorization: `Bearer ${sesion.accessToken}`,
    },
  });
}

/**
 * Devuelve la sucursal que va a tener seleccionada el POS por defecto:
 * - usuario.sucursalDefecto si existe
 * - sino, la primera de GET /sucursales
 *
 * Útil para sembrar stock en la sucursal correcta antes de un test del POS.
 */
export async function sucursalActivaDelPos(api: APIRequestContext): Promise<string> {
  const sesion = await obtenerSesion();
  if (sesion.usuario.sucursalDefecto) return sesion.usuario.sucursalDefecto;
  const res = await api.get('/api/v1/sucursales');
  if (!res.ok()) throw new Error(`GET /sucursales falló: ${await res.text()}`);
  const sucursales = (await res.json()).datos ?? [];
  if (!Array.isArray(sucursales) || sucursales.length === 0) {
    throw new Error('No hay sucursales en el tenant.');
  }
  return sucursales[0].id;
}

/**
 * Sufijo aleatorio para evitar choque entre corridas (RUC, SKU, etc.).
 */
export function sufijoAleatorio(largo = 6): string {
  const chars = '0123456789';
  return Array.from({ length: largo }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * RUC válido para SUNAT (11 dígitos, primer dígito 1 o 2).
 * No verifica dígito verificador — suficiente para tests, no para producción.
 */
export function rucAleatorio(): string {
  const prefijo = Math.random() < 0.5 ? '10' : '20';
  return prefijo + sufijoAleatorio(9);
}

export function dniAleatorio(): string {
  // DNI Perú: 8 dígitos, no empieza en 0
  return String(Math.floor(Math.random() * 9) + 1) + sufijoAleatorio(7);
}

interface SeedProveedorInput {
  tipoDocumento?: 'ruc' | 'dni';
  documento?: string;
  razonSocial?: string;
  email?: string;
  condicionPago?: 'contado' | 'credito_15' | 'credito_30' | 'credito_60';
}

interface ProveedorSeed {
  id: string;
  razonSocial: string;
  documento: string;
}

export async function seedProveedor(
  api: APIRequestContext,
  input: SeedProveedorInput = {},
): Promise<ProveedorSeed> {
  const documento = input.documento ?? rucAleatorio();
  const tipoDocumento = input.tipoDocumento ?? 'ruc';
  const razonSocial = input.razonSocial ?? `PROVEEDOR E2E ${sufijoAleatorio(4)}`;
  const body = {
    tipoDocumento,
    documento,
    razonSocial,
    email: input.email,
    condicionPago: input.condicionPago ?? 'contado',
    diasCredito: 0,
  };
  const res = await api.post('/api/v1/proveedores', { data: body });
  if (!res.ok()) {
    throw new Error(`seedProveedor falló (${res.status()}): ${await res.text()}`);
  }
  const json = await res.json();
  // Algunos endpoints devuelven { exito, datos } y otros { datos } — soportamos ambos.
  const datos = json.datos ?? json;
  return { id: datos.id, razonSocial, documento };
}

interface SeedClienteInput {
  tipoDocumento?: 'dni' | 'ruc' | 'pasaporte';
  documento?: string;
  nombre?: string;
  email?: string;
}

interface ClienteSeed {
  id: string;
  nombre: string;
  documento: string;
  tipoDocumento: string;
}

export async function seedCliente(
  api: APIRequestContext,
  input: SeedClienteInput = {},
): Promise<ClienteSeed> {
  const tipoDocumento = input.tipoDocumento ?? 'dni';
  const documento = input.documento ?? (tipoDocumento === 'ruc' ? rucAleatorio() : dniAleatorio());
  const nombre = input.nombre ?? `Cliente E2E ${sufijoAleatorio(4)}`;
  const body = {
    tipoDocumento,
    documento,
    nombre,
    email: input.email,
  };
  const res = await api.post('/api/v1/clientes', { data: body });
  if (!res.ok()) {
    throw new Error(`seedCliente falló (${res.status()}): ${await res.text()}`);
  }
  const json = await res.json();
  const datos = json.datos ?? json;
  return { id: datos.id, nombre, documento, tipoDocumento };
}

interface SeedProductoInput {
  nombre?: string;
  precioVenta?: number;
  precioCompra?: number;
  stockInicial?: number;
  talla?: string;
  color?: string;
  /** Forzar la sucursal donde se carga el stock inicial. Útil para POS:
   *  el POS arranca con `usuario.sucursalDefecto` si existe, no con la primera. */
  sucursalId?: string;
}

interface ProductoSeed {
  id: string;
  nombre: string;
  sku: string;
  varianteId: string;
  varianteSku: string;
  sucursalId: string;
  categoriaId: string;
}

/**
 * Crea un producto con UNA variante y stock inicial en la primera sucursal.
 * Usa la primera categoría disponible.
 */
export async function seedProducto(
  api: APIRequestContext,
  input: SeedProductoInput = {},
): Promise<ProductoSeed> {
  // 1. Resolver categoria + sucursal
  const [catRes, sucRes] = await Promise.all([
    api.get('/api/v1/categorias'),
    api.get('/api/v1/sucursales'),
  ]);
  if (!catRes.ok()) throw new Error(`GET /categorias falló: ${await catRes.text()}`);
  if (!sucRes.ok()) throw new Error(`GET /sucursales falló: ${await sucRes.text()}`);

  const categorias = (await catRes.json()).datos ?? [];
  const sucursales = (await sucRes.json()).datos ?? [];
  if (!Array.isArray(categorias) || categorias.length === 0) {
    throw new Error('No hay categorías sembradas en el tenant.');
  }
  if (!Array.isArray(sucursales) || sucursales.length === 0) {
    throw new Error('No hay sucursales sembradas en el tenant.');
  }
  const categoriaId = categorias[0].id;
  const sucursalId = input.sucursalId ?? sucursales[0].id;

  const sufijo = sufijoAleatorio(5);
  const nombre = input.nombre ?? `Producto E2E ${sufijo}`;
  const body = {
    nombre,
    sku: `E2E-${sufijo}`,
    categoriaId,
    precioVenta: input.precioVenta ?? 100,
    precioCompra: input.precioCompra ?? 60,
    variantes: [
      {
        talla: input.talla ?? 'M',
        color: input.color ?? 'Negro',
        sku: `E2E-V-${sufijo}`,
        stockInicial: input.stockInicial ?? 10,
        sucursalId,
      },
    ],
  };
  const res = await api.post('/api/v1/productos', { data: body });
  if (!res.ok()) {
    throw new Error(`seedProducto falló (${res.status()}): ${await res.text()}`);
  }
  const datos = (await res.json()).datos;
  const variante = datos.variantes?.[0] ?? {};
  const varianteBodyDefault = body.variantes[0]!;
  return {
    id: datos.id,
    nombre,
    sku: datos.sku ?? body.sku,
    varianteId: variante.id,
    varianteSku: variante.sku ?? varianteBodyDefault.sku,
    sucursalId,
    categoriaId,
  };
}

/**
 * Guarda configuración de Facturación Electrónica vía API.
 * Útil para preparar flags antes de probar emisión.
 *
 * Si querés solo cambiar algunos campos, pasá un partial: el seeder hace
 * GET previo y mergea con los valores actuales.
 */
export async function setConfiguracionFE(
  api: APIRequestContext,
  patch: Partial<{
    ruc: string;
    razonSocial: string;
    direccionFiscal: string;
    ubigeoFiscalCodigo: string;
    mifactToken: string;
    mifactBaseUrl: string;
    enviarAutomaticoASunat: boolean;
    retornarPdf: boolean;
    retornarXmlEnvio: boolean;
    retornarXmlCdr: boolean;
    formatoImpresion: '001' | '002' | '004';
  }>,
): Promise<void> {
  const res = await api.get('/api/v1/configuracion-facturacion');
  const actual = res.ok() ? ((await res.json()).datos ?? {}) : {};
  const body = {
    ruc: actual.ruc ?? '20100100100',
    razonSocial: actual.razonSocial ?? 'TIENDA E2E SAC',
    direccionFiscal: actual.direccionFiscal ?? 'Av. La Marina 123',
    ubigeoFiscalCodigo: actual.ubigeoFiscalCodigo ?? '150101',
    mifactBaseUrl: actual.mifactBaseUrl ?? 'https://demo.mifact.net.pe/api',
    enviarAutomaticoASunat: actual.enviarAutomaticoASunat ?? true,
    retornarPdf: actual.retornarPdf ?? true,
    retornarXmlEnvio: actual.retornarXmlEnvio ?? false,
    retornarXmlCdr: actual.retornarXmlCdr ?? false,
    formatoImpresion: actual.formatoImpresion ?? '001',
    ...patch,
  };
  const guardar = await api.put('/api/v1/configuracion-facturacion', { data: body });
  if (!guardar.ok()) {
    // Probar POST por si el endpoint solo acepta uno u otro
    const post = await api.post('/api/v1/configuracion-facturacion', { data: body });
    if (!post.ok()) {
      throw new Error(`setConfiguracionFE falló: PUT (${guardar.status()}) y POST (${post.status()}): ${await post.text()}`);
    }
  }
}
