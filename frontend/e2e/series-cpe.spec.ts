/**
 * E2E — Pantalla Series de comprobantes (4.C)
 *
 * Todos los endpoints se mockean — hermético, no requiere DB ni SUNAT.
 *
 * Tests:
 *  1. Listar series (mock devuelve 3) — tabla/cards con 3 rows.
 *  2. Crear nueva serie — modal → form → submit → POST → modal cierra + toast.
 *  3. Validación formato serie — input "ABCDE" → error inline "Formato inválido".
 */
import { test, expect, type Page } from '@playwright/test';
import { login, gotoY } from './helpers';

const URL_SERIES_CPE = '/configuracion/series-cpe';
const API_SERIES_PATTERN = '**/api/v1/series-cpe**';

// ─── Datos mock ───────────────────────────────────────────────────────────────

const SUCURSAL_ID = 'aaaa-bbbb-cccc-dddd-eeee11111111';
const SUCURSAL_ID_2 = 'ffff-gggg-hhhh-iiii-jjjj22222222';

function crearSerie(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: `serie-${Math.random().toString(36).slice(2)}`,
    sucursalId: SUCURSAL_ID,
    sucursal: { id: SUCURSAL_ID, nombre: 'Principal' },
    tipoCpe: 'factura',
    aplicaA: null,
    serie: 'F001',
    correlativoActual: 32,
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
    sucursal: { id: SUCURSAL_ID_2, nombre: 'Principal' },
    correlativoActual: 0,
  }),
];

// ─── Helpers de mock ──────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Series CPE', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ─── 1. Listar series (3 items) ───────────────────────────────────────────

  test('listar: tabla con 3 series cuando el mock devuelve 3', async ({ page }) => {
    await mockGetSeries(page, SERIES_MOCK);
    await gotoY(page, URL_SERIES_CPE);

    // Título visible
    await expect(page.getByText('Series de comprobantes electrónicos')).toBeVisible({ timeout: 10_000 });

    // Viewport desktop (por defecto): tabla con rows
    // Verificar que existan las 3 series en la tabla (al menos sus series)
    await expect(page.getByText('F001').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('B001').first()).toBeVisible();
    await expect(page.getByText('F002').first()).toBeVisible();

    // Botón "Nueva serie" visible
    await expect(page.getByTestId('btn-nueva-serie')).toBeVisible();

    // NO debe haber columna de sucursal en el header
    await expect(page.getByRole('columnheader', { name: /sucursal/i })).not.toBeVisible();
  });

  // ─── 2. Crear nueva serie ─────────────────────────────────────────────────

  test('crear nueva serie: abrir modal → llenar form → submit → modal cierra', async ({ page }) => {
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
        // Verificar que el body NO contiene sucursalId
        const body = route.request().postDataJSON() as Record<string, unknown>;
        if ('sucursalId' in body) {
          await route.fulfill({ status: 400, body: 'sucursalId no debe enviarse desde UI' });
          return;
        }
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
    await expect(page.getByText('Series de comprobantes electrónicos')).toBeVisible({ timeout: 10_000 });

    // Abrir modal
    await page.getByTestId('btn-nueva-serie').click();

    // Modal visible
    await expect(page.getByRole('heading', { name: 'Nueva serie' })).toBeVisible({ timeout: 3_000 });

    // NO debe haber dropdown de sucursal en el modal
    await expect(page.getByTestId('select-sucursal')).not.toBeAttached();

    // Llenar tipo CPE (factura ya es default)
    const selectTipo = page.getByTestId('select-tipo-cpe');
    await selectTipo.selectOption('factura');

    // Llenar serie
    const inputSerie = page.getByTestId('input-serie');
    await inputSerie.fill('F001');

    // Submit
    await page.getByTestId('btn-guardar-serie').click();

    // Toast de success
    await expect(page.getByText(/serie F001 creada/i)).toBeVisible({ timeout: 5_000 });

    // Modal cerrado
    await expect(page.getByRole('heading', { name: 'Nueva serie' })).not.toBeVisible({ timeout: 3_000 });
  });

  // ─── 3. Validación formato serie ──────────────────────────────────────────

  test('validación: formato inválido "ABCDE" muestra error inline', async ({ page }) => {
    await mockGetSeries(page, []);
    await gotoY(page, URL_SERIES_CPE);

    await expect(page.getByText('Series de comprobantes electrónicos')).toBeVisible({ timeout: 10_000 });

    // Abrir modal
    await page.getByTestId('btn-nueva-serie').click();
    await expect(page.getByRole('heading', { name: 'Nueva serie' })).toBeVisible({ timeout: 3_000 });

    // Ingresar formato inválido (5 chars — no matchea /^[A-Z]\d{3}$/)
    const inputSerie = page.getByTestId('input-serie');
    await inputSerie.fill('ABCDE');
    await page.getByTestId('btn-guardar-serie').click();

    // Error de formato visible
    await expect(page.getByTestId('error-serie')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId('error-serie')).toContainText(/formato inválido/i);
  });

});
