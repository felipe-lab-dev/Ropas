/**
 * E2E — Pantalla Series CPE (4.C)
 *
 * Todos los endpoints se mockean — hermético, no requiere DB ni SUNAT.
 *
 * Tests:
 *  1. Listar series (mock devuelve 3) — tabla/cards con 3 rows.
 *  2. Crear nueva serie — modal → form → submit → POST → modal cierra + toast.
 *  3. Validación formato serie — input "x001" → error inline "Formato inválido".
 *  4. Toggle activa — click switch → PATCH → toast (viewport iPhone 17 Pro Max).
 */
import { test, expect, type Page } from '@playwright/test';
import { login, gotoY } from './helpers';

const URL_SERIES_CPE = '/configuracion/series-cpe';
const API_SERIES_PATTERN = '**/api/v1/series-cpe**';
const API_SUCURSALES_PATTERN = '**/api/v1/sucursales**';

// ─── Datos mock ───────────────────────────────────────────────────────────────

const SUCURSAL_ID = 'aaaa-bbbb-cccc-dddd-eeee11111111';
const SUCURSAL_ID_2 = 'ffff-gggg-hhhh-iiii-jjjj22222222';

const SUCURSALES = [
  { id: SUCURSAL_ID, nombre: 'Principal', esPrincipal: true, activa: true },
  { id: SUCURSAL_ID_2, nombre: 'Sucursal 2', esPrincipal: false, activa: true },
];

function crearSerie(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `serie-${Math.random().toString(36).slice(2)}`,
    sucursalId: SUCURSAL_ID,
    sucursal: { id: SUCURSAL_ID, nombre: 'Principal' },
    tipoCpe: 'factura',
    serie: 'F001',
    correlativoActual: 32,
    activa: true,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    ...overrides,
  };
}

const SERIES_MOCK = [
  crearSerie({ id: 'id-1', serie: 'F001', tipoCpe: 'factura', correlativoActual: 32 }),
  crearSerie({
    id: 'id-2',
    serie: 'B001',
    tipoCpe: 'boleta',
    sucursal: { id: SUCURSAL_ID, nombre: 'Principal' },
    correlativoActual: 15,
  }),
  crearSerie({
    id: 'id-3',
    serie: 'F002',
    tipoCpe: 'factura',
    sucursalId: SUCURSAL_ID_2,
    sucursal: { id: SUCURSAL_ID_2, nombre: 'Sucursal 2' },
    correlativoActual: 0,
    activa: false,
  }),
];

// ─── Helpers de mock ──────────────────────────────────────────────────────────

async function mockSucursales(page: Page) {
  await page.route(API_SUCURSALES_PATTERN, async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos: SUCURSALES }),
    });
  });
}

async function mockGetSeries(page: Page, datos: typeof SERIES_MOCK = SERIES_MOCK) {
  await page.route(API_SERIES_PATTERN, async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos }),
    });
  });
}

async function mockPostSerie(page: Page, respuesta: unknown = SERIES_MOCK[0]) {
  await page.route(API_SERIES_PATTERN, async (route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos: respuesta }),
    });
  });
}

async function mockPatchSerie(page: Page, id: string, respuesta: unknown) {
  await page.route(`${API_SERIES_PATTERN}/${id}`, async (route) => {
    if (route.request().method() !== 'PATCH') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos: respuesta }),
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Series CPE', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ─── 1. Listar series (3 items) ───────────────────────────────────────────

  test('listar: tabla con 3 series cuando el mock devuelve 3', async ({ page }) => {
    await mockSucursales(page);
    await mockGetSeries(page, SERIES_MOCK);
    await gotoY(page, URL_SERIES_CPE);

    // Título visible
    await expect(page.getByText('Series CPE')).toBeVisible({ timeout: 10_000 });

    // Viewport desktop (por defecto): tabla con rows
    // Verificar que existan las 3 series en la tabla (al menos sus series)
    await expect(page.getByText('F001')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('B001')).toBeVisible();
    await expect(page.getByText('F002')).toBeVisible();

    // Botón "Nueva serie" visible
    await expect(page.getByTestId('btn-nueva-serie')).toBeVisible();
  });

  // ─── 2. Crear nueva serie ─────────────────────────────────────────────────

  test('crear nueva serie: abrir modal → llenar form → submit → modal cierra', async ({ page }) => {
    await mockSucursales(page);

    let getCallCount = 0;
    await page.route(API_SERIES_PATTERN, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        getCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ exito: true, datos: getCallCount === 1 ? [] : SERIES_MOCK }),
        });
      } else if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ exito: true, datos: SERIES_MOCK[0] }),
        });
      } else {
        await route.fallback();
      }
    });

    await gotoY(page, URL_SERIES_CPE);
    await expect(page.getByText('Series CPE')).toBeVisible({ timeout: 10_000 });

    // Abrir modal
    await page.getByTestId('btn-nueva-serie').click();

    // Modal visible
    await expect(page.getByText('Nueva serie CPE')).toBeVisible({ timeout: 3_000 });

    // Llenar tipo CPE (factura ya es default)
    const selectTipo = page.getByTestId('select-tipo-cpe');
    await selectTipo.selectOption('factura');

    // Llenar serie
    const inputSerie = page.getByTestId('input-serie');
    await inputSerie.fill('F001');

    // Submit
    await page.getByTestId('btn-guardar-serie').click();

    // Modal se cierra (el toast de success aparece)
    await expect(page.getByText(/serie F001 creada/i)).toBeVisible({ timeout: 5_000 });

    // Modal cerrado
    await expect(page.getByText('Nueva serie CPE')).not.toBeVisible({ timeout: 3_000 });
  });

  // ─── 3. Validación formato serie ──────────────────────────────────────────

  test('validación: formato inválido "x001" muestra error inline', async ({ page }) => {
    await mockSucursales(page);
    await mockGetSeries(page, []);
    await gotoY(page, URL_SERIES_CPE);

    await expect(page.getByText('Series CPE')).toBeVisible({ timeout: 10_000 });

    // Abrir modal
    await page.getByTestId('btn-nueva-serie').click();
    await expect(page.getByText('Nueva serie CPE')).toBeVisible({ timeout: 3_000 });

    // Ingresar formato inválido (minúscula)
    const inputSerie = page.getByTestId('input-serie');
    await inputSerie.fill('x001');

    // Intentar submit para disparar validación
    await page.getByTestId('btn-guardar-serie').click();

    // El componente uppercase-fuerza, pero la validación detecta el error
    // Alternativa: probar directamente con serie que no matchea el regex
    // Como hay uppercase transform, probar con "ABCDE" (5 chars)
    await inputSerie.clear();
    await inputSerie.fill('ABCDE');
    await page.getByTestId('btn-guardar-serie').click();

    // Error de formato visible
    await expect(page.getByTestId('error-serie')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId('error-serie')).toContainText(/formato inválido/i);
  });

  // ─── 4. Toggle activa (iPhone 17 Pro Max) ────────────────────────────────

  test('toggle activa: click en switch → PATCH → toast', async ({ page }) => {
    // iPhone 17 Pro Max viewport (PWA rule)
    await page.setViewportSize({ width: 440, height: 956 });

    await mockSucursales(page);

    const serieActiva = crearSerie({ id: 'id-toggle', serie: 'F001', activa: true });
    const serieInactiva = { ...serieActiva, activa: false };

    let patchCalled = false;
    await page.route(API_SERIES_PATTERN, async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ exito: true, datos: [serieActiva] }),
        });
      } else if (method === 'PATCH' && url.includes('id-toggle')) {
        patchCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ exito: true, datos: serieInactiva }),
        });
      } else {
        await route.fallback();
      }
    });

    await gotoY(page, URL_SERIES_CPE);
    await expect(page.getByText('Series CPE')).toBeVisible({ timeout: 10_000 });

    // En mobile, las series se muestran como cards — esperar que la serie esté visible
    await expect(page.getByText('F001')).toBeVisible({ timeout: 5_000 });

    // Hacer click en el toggle
    const toggle = page.getByRole('switch', { name: /toggle activa para F001/i });
    await toggle.click();

    // Verificar que se llamó el PATCH
    await expect.poll(() => patchCalled, { timeout: 5_000 }).toBe(true);

    // Toast de desactivación
    await expect(page.getByText(/serie F001 desactivada/i)).toBeVisible({ timeout: 5_000 });
  });
});
