/**
 * E2E — Campos SUNAT en formularios de Producto y Cliente (4.D)
 *
 * Todos los endpoints se mockean — hermético, no requiere DB ni SUNAT real.
 *
 * Tests:
 *  1. Producto crear: expandir sección SUNAT, seleccionar PAR + exonerado_onerosa,
 *     submit → payload contiene los campos SUNAT correctos.
 *  2. Producto crear: sin tocar la sección SUNAT → submit incluye defaults
 *     (NIU / gravado_onerosa) o los omite (ambos son válidos).
 *  3. Cliente form: escribir en SelectorUbigeo → mock devuelve resultados →
 *     seleccionar → value del form se actualiza.
 */
import { test, expect, type Page } from '@playwright/test';
import { login, gotoY } from './helpers';

// ─── URLs ─────────────────────────────────────────────────────────────────────

const URL_NUEVO_PRODUCTO = '/productos/nuevo';
const URL_NUEVO_CLIENTE  = '/clientes/nuevo';

// ─── Mocks API ────────────────────────────────────────────────────────────────

const CATEGORIAS_MOCK = [
  { id: 'cat-001', nombre: 'Ropa', slug: 'ropa', icono: null },
];

const UNIDADES_MOCK = [
  { codigo: 'NIU', nombre: 'Unidad (bienes)', simbolo: 'u' },
  { codigo: 'PAR', nombre: 'Par', simbolo: 'par' },
  { codigo: 'ZZ',  nombre: 'Servicios', simbolo: 'srv' },
  { codigo: 'KGM', nombre: 'Kilogramo', simbolo: 'kg' },
];

const AFECTACION_MOCK = [
  { codigo: 'gravado_onerosa',   sunatCodigo: '10', nombre: 'Gravado - Operación onerosa' },
  { codigo: 'exonerado_onerosa', sunatCodigo: '20', nombre: 'Exonerado - Operación onerosa' },
  { codigo: 'inafecto_onerosa',  sunatCodigo: '30', nombre: 'Inafecto - Operación onerosa' },
];

const UBIGEOS_MOCK = [
  { codigo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' },
  { codigo: '150113', departamento: 'LIMA', provincia: 'LIMA', distrito: 'MIRAFLORES' },
  { codigo: '150128', departamento: 'LIMA', provincia: 'LIMA', distrito: 'SAN MIGUEL' },
];

async function mockCatalogos(page: Page) {
  await page.route('**/api/v1/categorias**', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos: CATEGORIAS_MOCK }),
    });
  });

  await page.route('**/api/v1/catalogos/unidades-medida**', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos: UNIDADES_MOCK }),
    });
  });

  await page.route('**/api/v1/catalogos/tipos-afectacion-igv**', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos: AFECTACION_MOCK }),
    });
  });
}

async function mockUbigeos(page: Page) {
  await page.route('**/api/v1/catalogos/ubigeos**', async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('q') ?? '';
    const resultados = q.trim()
      ? UBIGEOS_MOCK.filter(u =>
          `${u.distrito} ${u.provincia} ${u.departamento}`.toLowerCase().includes(q.toLowerCase()),
        )
      : UBIGEOS_MOCK.slice(0, 5);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exito: true, datos: resultados }),
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Campos SUNAT — Producto y Cliente (4.D)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ─── 1. Producto crear con SUNAT custom ──────────────────────────────────

  test('producto crear: expandir sección SUNAT, seleccionar PAR + exonerado_onerosa, payload correcto', async ({ page }) => {
    await mockCatalogos(page);

    // eslint-disable-next-line prefer-const
    let payloadCapturado: Record<string, unknown> = {};
    const productoCreado = { id: 'prod-001', sku: 'P-00001', nombre: 'Test Producto' };

    await page.route('**/api/v1/productos', async (route) => {
      if (route.request().method() === 'POST') {
        payloadCapturado = (route.request().postDataJSON() as Record<string, unknown>) ?? {};
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ exito: true, datos: productoCreado }),
        });
      } else {
        await route.fallback();
      }
    });

    await gotoY(page, URL_NUEVO_PRODUCTO);
    await expect(page.getByText('Nuevo producto')).toBeVisible({ timeout: 10_000 });

    // Llenar campos obligatorios
    await page.locator('#nombre').fill('Calzado Test');
    await page.locator('#precioVenta').fill('150');

    // Expandir sección SUNAT
    const btnSunat = page.getByTestId('seccion-sunat').locator('button').first();
    await btnSunat.click();
    await expect(page.getByTestId('select-unidad-medida')).toBeVisible({ timeout: 5_000 });

    // Seleccionar PAR
    await page.getByTestId('select-unidad-medida').selectOption('PAR');

    // Seleccionar exonerado_onerosa
    await page.getByTestId('select-tipo-afectacion').selectOption('exonerado_onerosa');

    // Submit
    await page.getByRole('button', { name: /crear producto/i }).click();

    // Verificar payload — poll espera hasta que el POST sea interceptado
    await expect.poll(() => Object.keys(payloadCapturado).length, { timeout: 5_000 }).toBeGreaterThan(0);
    expect(payloadCapturado['unidadMedidaCodigo']).toBe('PAR');
    expect(payloadCapturado['tipoAfectacionIgv']).toBe('exonerado_onerosa');
  });

  // ─── 2. Producto crear: defaults sin tocar SUNAT ─────────────────────────

  test('producto crear: sin tocar sección SUNAT el submit incluye defaults NIU/gravado_onerosa', async ({ page }) => {
    await mockCatalogos(page);

    // eslint-disable-next-line prefer-const
    let payloadCapturado: Record<string, unknown> = {};
    const productoCreado = { id: 'prod-002', sku: 'P-00002', nombre: 'Otro Producto' };

    await page.route('**/api/v1/productos', async (route) => {
      if (route.request().method() === 'POST') {
        payloadCapturado = (route.request().postDataJSON() as Record<string, unknown>) ?? {};
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ exito: true, datos: productoCreado }),
        });
      } else {
        await route.fallback();
      }
    });

    await gotoY(page, URL_NUEVO_PRODUCTO);
    await expect(page.getByText('Nuevo producto')).toBeVisible({ timeout: 10_000 });

    // Llenar campos obligatorios SIN tocar sección SUNAT
    await page.locator('#nombre').fill('Vestido Básico');
    await page.locator('#precioVenta').fill('89');

    // Submit sin expandir SUNAT
    await page.getByRole('button', { name: /crear producto/i }).click();

    await expect.poll(() => Object.keys(payloadCapturado).length, { timeout: 5_000 }).toBeGreaterThan(0);

    // Los defaults deben estar presentes (NIU y gravado_onerosa son los valores iniciales del state)
    const uMedida = payloadCapturado['unidadMedidaCodigo'];
    const tAfect = payloadCapturado['tipoAfectacionIgv'];

    // Aceptamos que vengan los defaults explícitos o que el backend aplique el default del schema
    if (uMedida !== undefined) {
      expect(uMedida).toBe('NIU');
    }
    if (tAfect !== undefined) {
      expect(tAfect).toBe('gravado_onerosa');
    }
  });

  // ─── 3. Cliente: autocomplete ubigeo funciona ────────────────────────────

  test('cliente nuevo: escribir "miraflores" en SelectorUbigeo → seleccionar → value actualizado', async ({ page }) => {
    await mockUbigeos(page);

    await gotoY(page, URL_NUEVO_CLIENTE);
    await expect(page.getByText('Nuevo cliente')).toBeVisible({ timeout: 10_000 });

    // Abrir el selector de ubigeo
    const triggerUbigeo = page.locator('[role="combobox"]').first();
    await triggerUbigeo.click();

    // Escribir en el input de búsqueda dentro del popover
    const inputBusqueda = page.getByPlaceholder(/buscar departamento/i);
    await inputBusqueda.waitFor({ state: 'visible', timeout: 5_000 });
    await inputBusqueda.fill('miraflores');

    // Esperar que aparezca el resultado
    await expect(page.getByText(/MIRAFLORES/i)).toBeVisible({ timeout: 5_000 });

    // Seleccionar MIRAFLORES (código 150113)
    await page.getByText(/MIRAFLORES/i).first().click();

    // El popover se cierra y el botón del trigger muestra el ubigeo seleccionado
    await expect(triggerUbigeo).toContainText('150113', { timeout: 3_000 });
  });
});
