import { test, expect } from '@playwright/test';
import {
  apiContext,
  esperarToast,
  fillEstable,
  gotoY,
  login,
  rucAleatorio,
  seedProveedor,
  sufijoAleatorio,
} from './helpers';

/**
 * Suite complementaria de Proveedores. Cubre lo nuevo de la sesión:
 *  - Autocomplete RUC vía json.pe (botón "SUNAT" + auto-consulta al pegar)
 *  - DataTable refactorizada: orden por columna + filtro por columna + N°
 *  - LinkWhatsApp en columna Teléfono
 *
 * Para la consulta json.pe usamos `page.route()` para mockear el backend y
 * no consumir cuota real ni depender de la red.
 */

const MOCK_RUC = '20100070970';
const MOCK_RAZON = 'EMPRESA E2E SAC MOCK';
const MOCK_DIR = 'AV. AREQUIPA 123, LIMA - LIMA - MIRAFLORES';
const MOCK_PROVINCIA = 'LIMA';

test.describe('Proveedores · json.pe RUC autocomplete + tabla DIH', () => {
  test.beforeEach(async ({ page }) => {
    // Mock del endpoint backend para no pegarle a json.pe real (cuota + red).
    await page.route('**/api/v1/utilidades/ruc/**', route => {
      const url = route.request().url();
      const ruc = url.split('/').pop()?.split('?')[0] ?? '';
      if (ruc === MOCK_RUC) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            exito: true,
            datos: {
              ruc: MOCK_RUC,
              razonSocial: MOCK_RAZON,
              nombreComercial: null,
              estado: 'ACTIVO',
              direccion: MOCK_DIR,
              departamento: 'LIMA',
              provincia: MOCK_PROVINCIA,
              distrito: 'MIRAFLORES',
              ubigeo: '150122',
            },
          }),
        });
      }
      if (ruc === '99999999999') {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ exito: false, mensaje: 'Documento no encontrado en la fuente oficial' }),
        });
      }
      return route.continue();
    });

    await login(page);
  });

  test('botón SUNAT autocompleta razón social, dirección y ciudad', async ({ page }) => {
    await gotoY(page, '/proveedores/nuevo');

    await page.locator('[data-testid="select-tipo-doc-proveedor"]').selectOption('ruc');
    await fillEstable(page, '[data-testid="input-documento-proveedor"]', MOCK_RUC);

    await page.locator('[data-testid="btn-consultar-ruc"]').click();
    await esperarToast(page, /encontrado/i);

    await expect(page.locator('[data-testid="input-razon-social-proveedor"]')).toHaveValue(
      MOCK_RAZON,
      { timeout: 5_000 },
    );
    await expect(page.locator('input[name="direccion"]')).toHaveValue(MOCK_DIR);
    await expect(page.locator('input[name="ciudad"]')).toHaveValue(MOCK_PROVINCIA);
  });

  test('botón SUNAT queda deshabilitado hasta tener 11 dígitos', async ({ page }) => {
    await gotoY(page, '/proveedores/nuevo');

    await page.locator('[data-testid="select-tipo-doc-proveedor"]').selectOption('ruc');
    const btn = page.locator('[data-testid="btn-consultar-ruc"]');
    await expect(btn).toBeDisabled();
    await fillEstable(page, '[data-testid="input-documento-proveedor"]', '20100070');
    await expect(btn).toBeDisabled();
    await fillEstable(page, '[data-testid="input-documento-proveedor"]', MOCK_RUC);
    await expect(btn).toBeEnabled();
  });

  test('RUC inexistente: 404 muestra error sin sobrescribir el formulario', async ({ page }) => {
    await gotoY(page, '/proveedores/nuevo');
    await page.locator('[data-testid="select-tipo-doc-proveedor"]').selectOption('ruc');
    await fillEstable(page, '[data-testid="input-documento-proveedor"]', '99999999999');
    await page.locator('[data-testid="btn-consultar-ruc"]').click();
    await esperarToast(page, /no encontrado/i);
    // Razón social sigue vacía
    await expect(page.locator('[data-testid="input-razon-social-proveedor"]')).toHaveValue('');
  });

  test('tabla muestra los 5 proveedores sembrados con WhatsApp logo en teléfono', async ({ page }) => {
    await gotoY(page, '/proveedores');

    // Los 5 RUC del seed
    const rucsSeed = [
      '20512345671', // TEXTILES ANDINOS
      '20512345672', // GAMARRA EXPRESS
      '20512345673', // ASIA MODA
      '20512345674', // EL SUR
      '20512345675', // LIMA NORTE
    ];
    for (const ruc of rucsSeed) {
      await expect(page.getByText(ruc, { exact: false }).first()).toBeVisible({ timeout: 8_000 });
    }

    // Cada uno tiene un link a wa.me — verifico al menos uno usando el aria-label genérico.
    const linkWhatsapp = page.locator('a[href*="wa.me"]').first();
    await expect(linkWhatsapp).toBeVisible();
    const href = await linkWhatsapp.getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/51\d{9}$/);
  });

  test('filtro por columna razón social oculta filas que no coinciden', async ({ page }) => {
    await gotoY(page, '/proveedores');

    // El popover de filtro vive dentro del header de "Razón social".
    // Busco el botón con title="Filtrar columna" dentro del <th> que tiene "razón social".
    const headerRazonSocial = page.locator('th').filter({ hasText: /razón social/i }).first();
    await headerRazonSocial.locator('button[title*="Filtrar"]').click();

    // Aparece un input dentro del popover (placeholder "Contiene…")
    const inputFiltro = page.locator('input[placeholder="Contiene…"]').first();
    await inputFiltro.waitFor({ state: 'visible' });
    await inputFiltro.fill('GAMARRA');

    // Sólo GAMARRA queda visible; TEXTILES y los demás desaparecen
    await expect(page.getByText('CONFECCIONES GAMARRA E.I.R.L.', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('TEXTILES ANDINOS S.A.C.', { exact: false })).toHaveCount(0);
  });

  test('orden por razón social asc → desc invierte el orden', async ({ page }) => {
    await gotoY(page, '/proveedores');

    // El estado default ya viene con sort razonSocial asc.
    const headerSort = page.locator('th').filter({ hasText: /razón social/i }).locator('button').first();

    // Razón social vive en la 3ra celda (después de las columnas N° y Código).
    // Capturo el texto del nombre en la 1ra fila en ASC vs DESC.
    const primeraFila = page.locator('tbody tr').first();
    await expect(primeraFila).toBeVisible({ timeout: 8_000 });
    const celdaRazonAsc = primeraFila.locator('td').nth(2);
    const primeraAsc = (await celdaRazonAsc.innerText()).trim().split('\n')[0]?.trim() ?? '';

    // Cambiar a DESC clickeando el header (asc → desc).
    await headerSort.click();
    await page.waitForTimeout(600);
    const primeraDesc = (await celdaRazonAsc.innerText()).trim().split('\n')[0]?.trim() ?? '';

    expect(primeraAsc.length).toBeGreaterThan(0);
    expect(primeraDesc.length).toBeGreaterThan(0);
    expect(primeraAsc).not.toEqual(primeraDesc);
  });

  test('Shift+Space sobre buscador limpia búsqueda Y filtros', async ({ page }) => {
    await gotoY(page, '/proveedores');

    // Aplicar filtro de columna + búsqueda
    const buscar = page.locator('[data-busqueda]');
    await buscar.fill('GAMARRA');
    await page.waitForTimeout(400);

    const headerRazonSocial = page.locator('th').filter({ hasText: /razón social/i }).first();
    await headerRazonSocial.locator('button[title*="Filtrar"]').click();
    const inputFiltro = page.locator('input[placeholder="Contiene…"]').first();
    await inputFiltro.waitFor({ state: 'visible' });
    await inputFiltro.fill('ASIA');
    // Cerrar popover clicando afuera
    await page.locator('body').click({ position: { x: 10, y: 10 } });

    // Trigger Shift+Space con foco en buscador
    await buscar.focus();
    await page.keyboard.press('Shift+Space');
    await page.waitForTimeout(400);

    await expect(buscar).toHaveValue('');
    // Los proveedores semilla deberían volver a estar visibles
    await expect(page.getByText('TEXTILES ANDINOS S.A.C.', { exact: false }).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Proveedores · interop con suite previa', () => {
  test('seedProveedor por API sigue apareciendo en la tabla refactorizada', async ({ page }) => {
    const api = await apiContext();
    const seed = await seedProveedor(api, {
      razonSocial: `INTEROP E2E ${sufijoAleatorio(4)}`,
    });
    await api.dispose();

    await login(page);
    await gotoY(page, '/proveedores');
    await page.locator('[data-busqueda]').fill(seed.documento);
    await expect(page.getByText(seed.razonSocial, { exact: false }).first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
