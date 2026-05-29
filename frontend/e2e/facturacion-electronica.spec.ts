/**
 * E2E — Módulo de Facturación Electrónica (CPE)
 *
 * Estos tests mockean los endpoints de CPE para no requerir
 * configuración SUNAT/Mifact real en el entorno de CI.
 *
 * Endpoints mockeados:
 *   GET  /api/v1/ventas/:id/documento-electronico
 *   POST /api/v1/ventas/:id/emitir-cpe
 *   POST /api/v1/ventas/:id/reintentar-cpe
 *   POST /api/v1/ventas/:id/consultar-estado-cpe
 */
import { test, expect, type Page } from '@playwright/test';
import { login, gotoY, esperarToast } from './helpers';

// ─── Datos de prueba ──────────────────────────────────────────────────────────

// UUID fijo de la venta que se usa en todos los tests.
// En CI se necesitaría una venta real seeded; aquí mockeamos todas las
// llamadas relevantes para que los tests sean herméticos.
const VENTA_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
// El detalle vive ahora en un drawer dentro de /ventas (deep-link ?ver=<id>),
// no en una ruta /ventas/[id] (eliminada en el rediseño 2026-05-29).
const VENTA_URL = `/ventas?ver=${VENTA_ID}`;

function crearDocumentoAceptado() {
  return {
    id: 'doc-uuid-001',
    ventaId: VENTA_ID,
    tipoCpe: 'factura',
    serie: 'F001',
    correlativo: '00000032',
    estadoSunat: 'aceptado',
    codigoHash: '7AC3F0DEADBEEF12',
    cadenaQr: '20100100100|01|F001|00000032|...',
    mensajeSunat: 'La Factura numero F001-00000032, ha sido aceptada',
    xmlEnviadoUrl: 'https://demo.mifact.net.pe/xml/F001-32.xml',
    cdrUrl: 'https://demo.mifact.net.pe/cdr/F001-32.xml',
    pdfUrl: 'https://demo.mifact.net.pe/pdf/F001-32.pdf',
    numIntentos: 1,
    ultimoErrorTexto: null,
    enviadoEn: '2026-05-27T14:32:00.000Z',
    aceptadoEn: '2026-05-27T14:32:10.000Z',
    creadoEn: '2026-05-27T14:32:00.000Z',
    actualizadoEn: '2026-05-27T14:32:10.000Z',
  };
}

function crearDocumentoRechazado() {
  return {
    ...crearDocumentoAceptado(),
    estadoSunat: 'rechazado',
    codigoHash: null,
    cadenaQr: null,
    mensajeSunat: 'El RUC del emisor no está habilitado.',
    xmlEnviadoUrl: null,
    cdrUrl: null,
    pdfUrl: null,
    ultimoErrorTexto: 'SUNAT rechazó con código 2335: El RUC del emisor no está habilitado.',
    aceptadoEn: null,
  };
}

// ─── Helpers de route mock ────────────────────────────────────────────────────

/** Mocka el GET documento-electronico para que devuelva `datos`. */
async function mockGetDocumento(page: Page, datos: unknown) {
  await page.route(
    `**/api/v1/ventas/${VENTA_ID}/documento-electronico`,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exito: true, datos }),
      });
    },
  );
}

/** Mocka un POST endpoint CPE para que devuelva `datos`. */
async function mockPostCpe(page: Page, sufijo: string, datos: unknown) {
  await page.route(`**/api/v1/ventas/${VENTA_ID}/${sufijo}`, async (route) => {
    if (route.request().method() !== 'POST') {
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

/**
 * Mocka el GET de la venta para evitar un 404 real.
 * Usamos un objeto mínimo que la UI necesita para renderizar.
 */
async function mockGetVenta(page: Page) {
  await page.route(`**/api/v1/ventas/${VENTA_ID}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        exito: true,
        datos: {
          id: VENTA_ID,
          numero: 'V-0032',
          estado: 'pagada',
          subtotal: '100.00',
          descuento: '0.00',
          descuentoCupon: '0.00',
          impuestos: '18.00',
          total: '118.00',
          totalPagado: '118.00',
          notas: null,
          creadoEn: '2026-05-27T14:30:00.000Z',
          anuladaEn: null,
          motivoAnulacion: null,
          cuponCodigo: null,
          sucursal: { id: 'suc-01', nombre: 'Principal' },
          vendedor: { id: 'vend-01', nombre: 'Admin', email: 'admin@test.com' },
          cliente: {
            id: 'cli-01',
            nombre: 'EMPRESA TEST SAC',
            documento: '20100200300',
            tipoDocumento: 'ruc',
          },
          items: [],
          pagos: [],
          cupon: null,
          notasCredito: [],
        },
      }),
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Facturación Electrónica — Sección CPE en detalle de venta', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ─── 1. Sin documento: muestra botón Emitir CPE ───────────────────────────

  test('sin documento: muestra botón "Emitir CPE" y al hacer click emite y muestra badge aceptado', async ({
    page,
  }) => {
    // Mock: GET devuelve null (sin documento)
    await mockGetVenta(page);
    await mockGetDocumento(page, null);

    // Mock: POST emitir devuelve documento aceptado
    const docAceptado = crearDocumentoAceptado();
    await mockPostCpe(page, 'emitir-cpe', docAceptado);

    // Mock: GET posterior a invalidación devuelve documento aceptado
    let primeraLlamada = true;
    await page.route(`**/api/v1/ventas/${VENTA_ID}/documento-electronico`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      if (primeraLlamada) {
        primeraLlamada = false;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ exito: true, datos: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ exito: true, datos: docAceptado }),
        });
      }
    });

    await gotoY(page, VENTA_URL);

    // La sección CPE existe
    const seccion = page.getByTestId('seccion-cpe');
    await expect(seccion).toBeVisible({ timeout: 10_000 });

    // Mensaje "no emitido" + botón emitir
    await expect(page.getByTestId('cpe-sin-documento')).toBeVisible();
    const btnEmitir = page.getByTestId('btn-emitir-cpe');
    await expect(btnEmitir).toBeVisible();

    // Click para emitir
    await btnEmitir.click();

    // Toast de éxito
    await esperarToast(page, /Comprobante emitido/i);

    // Badge "Aceptado" visible
    await expect(page.getByTestId('estado-cpe-badge')).toContainText('Aceptado', {
      timeout: 8_000,
    });
  });

  // ─── 2. Documento aceptado: badge verde + links ───────────────────────────

  test('documento aceptado: muestra badge verde y links a PDF/XML/CDR', async ({ page }) => {
    await mockGetVenta(page);
    await mockGetDocumento(page, crearDocumentoAceptado());

    await gotoY(page, VENTA_URL);

    const seccion = page.getByTestId('seccion-cpe');
    await expect(seccion).toBeVisible({ timeout: 10_000 });

    // Badge "Aceptado"
    const badge = page.getByTestId('estado-cpe-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Aceptado');
    await expect(badge).toHaveAttribute('data-estado', 'aceptado');

    // Links disponibles
    await expect(page.getByTestId('cpe-links')).toBeVisible();
    await expect(page.getByTestId('link-pdf')).toBeVisible();
    await expect(page.getByTestId('link-xml')).toBeVisible();
    await expect(page.getByTestId('link-cdr')).toBeVisible();

    // Serie y correlativo visible
    await expect(seccion).toContainText('F001-00000032');
  });

  // ─── 3. Documento rechazado: badge rojo + botón Reintentar ───────────────

  test('documento rechazado: muestra badge rojo, mensaje de error y botón reintentar', async ({
    page,
    // viewport iPhone 17 Pro Max para validar mobile
  }) => {
    await page.setViewportSize({ width: 440, height: 956 });

    await mockGetVenta(page);
    await mockGetDocumento(page, crearDocumentoRechazado());

    // Mock reintentar devuelve documento aceptado
    await mockPostCpe(page, 'reintentar-cpe', crearDocumentoAceptado());

    await gotoY(page, VENTA_URL);

    const seccion = page.getByTestId('seccion-cpe');
    await expect(seccion).toBeVisible({ timeout: 10_000 });

    // Badge "Rechazado"
    const badge = page.getByTestId('estado-cpe-badge');
    await expect(badge).toContainText('Rechazado');
    await expect(badge).toHaveAttribute('data-estado', 'rechazado');

    // Mensaje de error SUNAT
    await expect(seccion).toContainText('SUNAT rechazó con código');

    // Botón Reintentar visible y clickeable
    const btnReintentar = page.getByTestId('btn-reintentar-cpe');
    await expect(btnReintentar).toBeVisible();

    // Click reintentar
    await btnReintentar.click();

    // Toast de éxito
    await esperarToast(page, /Comprobante reenviado/i);
  });
});
