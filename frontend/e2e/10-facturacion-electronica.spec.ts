import { type APIRequestContext, test, expect } from '@playwright/test';
import {
  apiContext,
  esperarToast,
  fillEstable,
  gotoY,
  login,
  seedCliente,
  seedProducto,
  setConfiguracionFE,
  sucursalActivaDelPos,
  sufijoAleatorio,
} from './helpers';

// ── Snapshot+restore ────────────────────────────────────────────────────────
// La config de Facturación Electrónica es UNA fila por tenant. No podemos
// crearla/eliminarla como un proveedor. Por eso: capturamos el estado actual
// en beforeAll y lo restauramos en afterAll. El test puede modificar lo que
// quiera entre medio — el tenant queda exactamente como estaba.

interface ConfigFE {
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccionFiscal: string;
  ubigeoFiscalCodigo: string;
  mifactBaseUrl: string;
  tokenConfigurado: boolean;
  formatoImpresion: '001' | '002' | '004';
}

let snapshot: ConfigFE | null = null;

async function leerConfig(api: APIRequestContext): Promise<ConfigFE | null> {
  const res = await api.get('/api/v1/configuracion-facturacion');
  if (!res.ok()) return null;
  const datos = (await res.json()).datos;
  return datos as ConfigFE | null;
}

test.describe('Configuración · Facturación Electrónica (Modo A — sin tocar SUNAT)', () => {
  test.beforeAll(async () => {
    const api = await apiContext();
    snapshot = await leerConfig(api);
    await api.dispose();
  });

  test.afterAll(async () => {
    if (!snapshot) return; // tenant nuevo sin config previa → no restauramos
    const api = await apiContext();
    await setConfiguracionFE(api, {
      ruc: snapshot.ruc,
      razonSocial: snapshot.razonSocial,
      direccionFiscal: snapshot.direccionFiscal,
      ubigeoFiscalCodigo: snapshot.ubigeoFiscalCodigo,
      mifactBaseUrl: snapshot.mifactBaseUrl,
      formatoImpresion: snapshot.formatoImpresion,
      // mifactToken NO se envía: el backend mantiene el actual.
    });
    await api.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('persiste config completa: RUC + razón social + dirección + ubigeo + formato Ticket', async ({
    page,
  }) => {
    await gotoY(page, '/configuracion/facturacion-electronica');

    // Esperar a que el form esté hidratado (no más skeleton)
    await expect(
      page.getByRole('button', { name: /guardar configuraci[oó]n/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Pequeño respiro para que el reset() de react-hook-form termine
    await page.waitForTimeout(400);

    // 1. Datos del emisor
    await fillEstable(page, '[data-testid="input-ruc"]', '20100100100');
    await fillEstable(page, '[data-testid="input-razon-social"]', 'TIENDA E2E PRUEBA SAC');
    await fillEstable(page, '[data-testid="input-direccion"]', 'Av. La Marina 123');

    // 2. UBIGEO (Lima/Lima/Lima = 150101)
    await page.getByRole('combobox').click();
    await page.getByPlaceholder(/buscar departamento/i).fill('150101');
    await page.waitForTimeout(400); // debounce 200ms + fetch
    // El CommandItem renderiza el código como texto — clickeamos el primero
    await page.getByText('150101').first().click();

    // 3. Formato Ticket 80mm
    await page.getByRole('button', { name: /ticket 80mm/i }).click();

    // 4. Guardar
    await page.getByRole('button', { name: /guardar configuraci[oó]n/i }).click();
    await esperarToast(page, /configuraci[oó]n guardada/i);

    // 5. Verificar persistencia vía API (sin depender del estado visual post-save)
    const api = await apiContext();
    const guardado = await leerConfig(api);
    await api.dispose();

    expect(guardado).not.toBeNull();
    expect(guardado!.ruc).toBe('20100100100');
    expect(guardado!.razonSocial).toBe('TIENDA E2E PRUEBA SAC');
    expect(guardado!.direccionFiscal).toBe('Av. La Marina 123');
    expect(guardado!.ubigeoFiscalCodigo).toBe('150101');
    expect(guardado!.formatoImpresion).toBe('004'); // Ticket 80mm

    // 6. Reload completo y verificar que la UI refleja lo guardado
    await page.reload();
    await expect(page.locator('[data-testid="input-ruc"]')).toHaveValue('20100100100', {
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="input-razon-social"]')).toHaveValue(
      'TIENDA E2E PRUEBA SAC',
    );
    // El botón de Ticket 80mm tiene estado "seleccionado" visual — verificamos
    // que el formato persistió chequeando el aria-pressed o data-state, pero
    // el componente RadioFormato no expone esto, así que ya validamos por API.
  });

  test('alterna entre los 3 formatos (A4 → A5 → Ticket) y cada uno persiste', async ({
    page,
  }) => {
    await gotoY(page, '/configuracion/facturacion-electronica');
    await expect(
      page.getByRole('button', { name: /guardar configuraci[oó]n/i }),
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(400);

    for (const [label, codigo] of [
      ['A4', '001'],
      ['A5', '002'],
      ['Ticket 80mm', '004'],
    ] as const) {
      await page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).click();
      await page.getByRole('button', { name: /guardar configuraci[oó]n/i }).click();
      await esperarToast(page, /configuraci[oó]n guardada/i);
      await page.waitForTimeout(400);

      const api = await apiContext();
      const guardado = await leerConfig(api);
      await api.dispose();
      expect(guardado!.formatoImpresion, `falló para formato ${label}`).toBe(codigo);
    }
  });
});

test.describe('Configuración · Series CPE', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('crea una serie F001 (Factura) y aparece en la tabla', async ({ page }) => {
    // Usamos un sufijo aleatorio en correlativo inicial para evitar chocar con
    // otras corridas que ya hayan creado F001 — el backend rechaza duplicados.
    const serie = `F${sufijoAleatorio(3)}`;

    await gotoY(page, '/configuracion/series-cpe');
    await page.locator('[data-testid="btn-nueva-serie"]').click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('[data-testid="select-tipo-cpe"]').selectOption('factura');
    await fillEstable(page, '[data-testid="input-serie"]', serie);
    await fillEstable(page, '[data-testid="input-correlativo-inicial"]', '0');

    await page.locator('[data-testid="btn-guardar-serie"]').click();
    await esperarToast(page, new RegExp(`serie ${serie} creada`, 'i'));

    // La fila debe aparecer en la tabla con el código de la serie
    await expect(
      page.locator('code', { hasText: serie }).first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Facturación Electrónica (Modo B — emisión real a SUNAT vía MiFact sandbox)', () => {
  // Modo B solo corre si E2E_MIFACT_SANDBOX=true.
  // Requiere: token MiFact válido en config, serie F001 activa, RUC del emisor
  // válido en SUNAT, y conectividad al sandbox. Si alguna falla, el test te
  // dice qué falta — no es un test "verde-mágico", es un health-check real.
  test.skip(
    process.env.E2E_MIFACT_SANDBOX !== 'true',
    'Modo B desactivado. Activa con E2E_MIFACT_SANDBOX=true cuando tengas el token MiFact configurado.',
  );

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('venta con cliente RUC → CPE emitido y aceptado por SUNAT', async ({ page }) => {
    const api = await apiContext();

    // 1. Asegurar config FE (formato A4 para sandbox). El envío a SUNAT es
    //    siempre síncrono; la emisión NO solicita PDF/XML/CDR — esos documentos
    //    se descargan on-demand (flujo de botón, pendiente de implementar).
    await setConfiguracionFE(api, {
      formatoImpresion: '001', // A4 para sandbox
    });

    // 2. Seed producto + cliente con RUC válido
    const sucursalId = await sucursalActivaDelPos(api);
    const producto = await seedProducto(api, {
      precioVenta: 100,
      stockInicial: 2,
      sucursalId,
    });
    const cliente = await seedCliente(api, {
      tipoDocumento: 'ruc',
      nombre: `CLIENTE RUC E2E ${sufijoAleatorio(4)}`,
    });
    await api.dispose();

    // 3. Vender desde el POS
    await gotoY(page, '/pos');
    await fillEstable(page, '[data-testid="pos-buscar-producto"]', producto.sku);
    const resultado = page.locator('[data-testid^="pos-resultado-E2E-V-"]').first();
    await expect(resultado).toBeVisible({ timeout: 8_000 });
    await resultado.click();

    await fillEstable(page, '[data-testid="pos-buscar-cliente"]', cliente.documento);
    const itemCliente = page.getByRole('button').filter({ hasText: cliente.nombre }).first();
    await expect(itemCliente).toBeVisible({ timeout: 8_000 });
    await itemCliente.click();

    await page.locator('[data-testid="btn-cobrar-pos"]').click();
    const toast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /venta\s+\S+\s+registrada/i })
      .first();
    await expect(toast).toBeVisible({ timeout: 15_000 });

    // 4. Obtener la venta más reciente y verificar que el documento electrónico
    //    quedó EMITIDO y ACEPTADO por SUNAT. Las URLs de PDF/XML/CDR ya NO se
    //    devuelven en la emisión — se obtienen on-demand (flujo futuro).
    const api2 = await apiContext();
    const ventas = await api2.get('/api/v1/ventas?limite=1&orderBy=-createdAt');
    expect(ventas.ok()).toBe(true);
    const ventaId = ((await ventas.json()).datos?.[0]?.id) as string | undefined;
    expect(ventaId, 'No se encontró la venta recién creada').toBeTruthy();

    // Polling: el listener de emisión es async — esperamos hasta 30s al estado SUNAT.
    const ACEPTADO = new Set(['aceptado', 'aceptado_observado']);
    let documento: { estadoSunat?: string } | null = null;
    for (let i = 0; i < 15; i++) {
      const docRes = await api2.get(`/api/v1/ventas/${ventaId}/documento-electronico`);
      if (docRes.ok()) {
        const datos = (await docRes.json()).datos;
        if (datos?.estadoSunat && ACEPTADO.has(datos.estadoSunat)) {
          documento = datos;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    await api2.dispose();

    expect(documento, 'CPE no fue aceptado por SUNAT en 30s').not.toBeNull();
    expect(ACEPTADO.has(documento!.estadoSunat as string)).toBe(true);
  });
});
