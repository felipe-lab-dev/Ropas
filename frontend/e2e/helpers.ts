import { type Page, expect, request as playwrightRequest } from '@playwright/test';

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
  // Pequeño respiro para el ciclo StrictMode + framer-motion (250ms transition)
  await page.waitForTimeout(450);
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
