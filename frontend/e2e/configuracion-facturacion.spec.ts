/**
 * E2E — Pantalla Configuración Facturación Electrónica
 *
 * Todos los endpoints se mockean para que los tests sean herméticos.
 * No requieren SUNAT/Mifact real ni DB en estado particular.
 *
 * Tests:
 *  1. GET vacío (sin config) → form vacío, token obligatorio
 *  2. GET con config → form prellenado, token muestra "configurado" con botón Editar
 *  3. Validación: RUC inválido → error inline, submit deshabilitado
 *  4. UBIGEO autocomplete: búsqueda "miraflo" → resultados → selección setea valor
 */
import { test, expect, type Page } from '@playwright/test';
import { login, gotoY, fillEstable, esperarToast } from './helpers';

const URL_CONFIG = '/configuracion/facturacion-electronica';
const API_PATTERN = '**/api/v1/configuracion-facturacion**';
const UBIGEO_PATTERN = '**/api/v1/catalogos/ubigeos**';

// ─── Datos mock ───────────────────────────────────────────────────────────────

const CONFIG_COMPLETA = {
  ruc: '20123456789',
  razonSocial: 'Mi Tienda S.A.C.',
  nombreComercial: 'Mi Tienda',
  direccionFiscal: 'Av. Principal 123, Cusco',
  ubigeoFiscalCodigo: '080101',
  mifactBaseUrl: 'https://demo.mifact.net.pe/api',
  tokenConfigurado: true,
  enviarAutomaticoASunat: true,
  retornarPdf: true,
  retornarXmlEnvio: false,
  retornarXmlCdr: false,
  formatoImpresion: '001',
};

const UBIGEOS_MIRAFLO = [
  {
    codigo: '150122',
    departamento: 'LIMA',
    provincia: 'LIMA',
    distrito: 'MIRAFLORES',
  },
  {
    codigo: '040306',
    departamento: 'APURIMAC',
    provincia: 'CHINCHEROS',
    distrito: 'MIRAFLORES',
  },
];

// ─── Helpers de mock ──────────────────────────────────────────────────────────

async function mockGetConfig(page: Page, datos: unknown) {
  await page.route(API_PATTERN, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos }),
    });
  });
}

async function mockPutConfig(page: Page, respuesta: unknown = CONFIG_COMPLETA) {
  await page.route(API_PATTERN, async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos: respuesta, mensaje: 'Configuración de facturación guardada' }),
    });
  });
}

async function mockUbigeos(page: Page, datos: unknown[]) {
  await page.route(UBIGEO_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ datos }),
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Configuración Facturación Electrónica', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ─── 1. GET vacío: form aparece vacío, token obligatorio (primera config) ─

  test('sin config: form vacío con defaults y token requerido', async ({ page }) => {
    await mockGetConfig(page, null);
    await mockUbigeos(page, []);
    await gotoY(page, URL_CONFIG);

    // Página cargó
    await expect(page.getByRole('heading', { name: 'Facturación Electrónica' })).toBeVisible({ timeout: 10_000 });

    // Campos vacíos
    const inputRuc = page.getByTestId('input-ruc');
    await expect(inputRuc).toBeVisible();
    await expect(inputRuc).toHaveValue('');

    const inputRazonSocial = page.getByTestId('input-razon-social');
    await expect(inputRazonSocial).toHaveValue('');

    // El campo de token está visible y editable (primera configuración)
    const inputToken = page.getByTestId('input-token');
    await expect(inputToken).toBeVisible();

    // Botón "Guardar configuración" presente
    await expect(page.getByRole('button', { name: /guardar configuración/i })).toBeVisible();
  });

  // ─── 2. GET con config: form prellenado, token muestra "configurado" ──────

  test('con config: form prellenado y token muestra badge de configurado con botón Editar', async ({
    page,
  }) => {
    await mockGetConfig(page, CONFIG_COMPLETA);
    await mockUbigeos(page, []);
    await gotoY(page, URL_CONFIG);

    await expect(page.getByRole('heading', { name: 'Facturación Electrónica' })).toBeVisible({ timeout: 10_000 });

    // RUC prellenado
    await expect(page.getByTestId('input-ruc')).toHaveValue('20123456789');

    // Razón social prellenada
    await expect(page.getByTestId('input-razon-social')).toHaveValue('Mi Tienda S.A.C.');

    // Token configurado muestra badge + botón Editar token
    await expect(page.getByText(/token configurado/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /editar token/i })).toBeVisible();

    // El input de token NO está visible en este estado
    const inputToken = page.getByTestId('input-token');
    await expect(inputToken).not.toBeVisible();
  });

  // ─── 3. Validación: RUC inválido → error inline, submit deshabilitado ─────

  test('validación: RUC inválido muestra error inline', async ({ page }) => {
    await mockGetConfig(page, null);
    await mockUbigeos(page, []);
    await gotoY(page, URL_CONFIG);

    await expect(page.getByRole('heading', { name: 'Facturación Electrónica' })).toBeVisible({ timeout: 10_000 });

    // Ingresar RUC inválido
    const inputRuc = page.getByTestId('input-ruc');
    await fillEstable(page, '[data-testid="input-ruc"]', '123');

    // Submit para triggerar validación
    await page.getByRole('button', { name: /guardar configuración/i }).click();

    // Error de RUC visible
    await expect(page.getByText(/ruc debe tener 11 dígitos/i)).toBeVisible({ timeout: 5_000 });
  });

  // ─── 4. UBIGEO autocomplete: búsqueda → selección setea valor ────────────

  test('UBIGEO autocomplete: buscar "miraflo" selecciona ubigeo y actualiza el campo', async ({
    page,
  }) => {
    // iPhone 17 Pro Max viewport (PWA rule)
    await page.setViewportSize({ width: 440, height: 956 });

    await mockGetConfig(page, null);
    // Mock ubigeos vacíos para el load inicial
    let primeraLlamada = true;
    await page.route(UBIGEO_PATTERN, async (route) => {
      const url = route.request().url();
      const q = new URL(url).searchParams.get('q') ?? '';
      if (!primeraLlamada && q.toLowerCase().includes('miraflo')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ datos: UBIGEOS_MIRAFLO }),
        });
      } else {
        primeraLlamada = false;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ datos: [] }),
        });
      }
    });

    await gotoY(page, URL_CONFIG);
    await expect(page.getByRole('heading', { name: 'Facturación Electrónica' })).toBeVisible({ timeout: 10_000 });

    // Abrir el combobox de ubigeo
    const combobox = page.getByRole('combobox', { name: /seleccionar ubigeo/i });
    await combobox.click();

    // Buscar "miraflo"
    const searchInput = page.getByPlaceholder(/buscar departamento/i);
    await searchInput.fill('miraflo');

    // Esperar resultados
    await expect(page.getByText('MIRAFLORES').first()).toBeVisible({ timeout: 5_000 });

    // Seleccionar el primer resultado
    await page.getByText('MIRAFLORES').first().click();

    // El popover se cierra (data-state="closed") y el trigger muestra el ubigeo seleccionado
    const trigger = page.getByRole('combobox', { name: /seleccionar ubigeo/i });
    await expect(trigger).toHaveAttribute('data-state', 'closed', { timeout: 5_000 });
    await expect(trigger).toContainText(/150122|040306|MIRAFLORES/i);
  });
});
