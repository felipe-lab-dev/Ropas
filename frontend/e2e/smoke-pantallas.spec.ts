// frontend/e2e/smoke-pantallas.spec.ts
//
// Crawler determinista de "pantallas rotas".
// Recorre TODAS las rutas del App Router (auto-discovery) ya logueado y, por
// cada pantalla, recolecta evidencia OBJETIVA: errores de consola, excepciones
// de runtime (error boundary), APIs >= 400 y render vacío. Clasifica el estado
// y escribe un reporte JSON + screenshots en e2e/.reportes/.
//
// Filosofía: la DETECCIÓN es determinista (esto). La INTERPRETACIÓN ("¿falta
// implementar o el backend está caído?") es un paso posterior opcional con IA,
// alimentado por este reporte. No se mezclan.
//
// Cómo correrlo (necesita backend + frontend arriba y E2E_ADMIN_PASSWORD):
//   cd frontend
//   E2E_ADMIN_PASSWORD=... pnpm e2e:smoke
//
// OJO (memoria del proyecto): localhost:3000 pega al backend de PROD. Un
// API_FALLA puede significar "feature no desplegada a prod", no "rota". El
// reporte lo deja anotado; revisá con eso en mente.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { descubrirRutas, type RutaDescubierta } from './descubrir-rutas';

const DIR_REPORTE = join(__dirname, '.reportes');
const DIR_SHOTS = join(DIR_REPORTE, 'screenshots');

type Estado =
  | 'OK'
  | 'API_FALLA'
  | 'RUNTIME_ERROR'
  | 'NO_ENCONTRADA'
  | 'VACIA'
  | 'SIN_DATOS'
  | 'NAVEGACION_FALLIDA';

/** Estados que son "pantalla rota" sin ambigüedad → fallan el test (rojo en CI). */
const ROTAS: Estado[] = ['RUNTIME_ERROR', 'NAVEGACION_FALLIDA', 'NO_ENCONTRADA'];
/** Estados dudosos → se reportan y avisan, pero no fallan salvo SMOKE_ESTRICTO=1. */
const DUDOSAS: Estado[] = ['API_FALLA', 'VACIA', 'SIN_DATOS'];

interface Hallazgo {
  ruta: string;
  estrategia: 'directa' | 'via-lista';
  estado: Estado;
  detalle: string;
  consoleErrors: string[];
  pageErrors: string[];
  apisFallidas: { url: string; status: number }[];
  screenshot: string;
}

/** Engancha listeners, ejecuta la navegación dada, recolecta evidencia y clasifica. */
async function inspeccionar(
  page: Page,
  ruta: string,
  estrategia: Hallazgo['estrategia'],
  // Devuelve el status HTTP del documento si hubo navegación directa (para 404/5xx);
  // undefined cuando se llegó por click (navegación de cliente, sin response de doc).
  navegar: () => Promise<number | undefined>,
): Promise<Hallazgo> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const apisFallidas: { url: string; status: number }[] = [];

  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const onPageError = (err: Error) => pageErrors.push(err.message);
  const onResponse = (res: { url(): string; status(): number }) => {
    const url = res.url();
    const status = res.status();
    // Solo nos importan las llamadas al API (no fuentes/imágenes/HMR).
    if (status >= 400 && /\/api\//.test(url)) apisFallidas.push({ url, status });
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  let falloNavegacion = '';
  let navStatus: number | undefined;
  try {
    navStatus = await navegar();
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  } catch (e) {
    falloNavegacion = (e as Error).message;
  }
  // Margen para que monte el error boundary si la pantalla explota al render.
  await page.waitForTimeout(400);

  // Esta app NO define error.tsx/not-found.tsx propios (verificado): no existe
  // markup `.errorBoundary`. La señal dura de runtime-error es page.on('pageerror');
  // acá sumamos el overlay de error de Next en dev como respaldo visible.
  const tieneRuntimeError = await page
    .locator('nextjs-portal, [data-nextjs-dialog]')
    .count()
    .then((c) => c > 0)
    .catch(() => false);
  // 404: el status del documento (navegación directa) es la señal dura; como
  // respaldo, el texto del 404 por defecto de Next renderizado en cliente.
  const tieneNotFound =
    navStatus === 404 ||
    (await page
      .getByText(/could not be found/i)
      .count()
      .then((c) => c > 0)
      .catch(() => false));

  const textoUtil =
    (await page.locator('main').first().innerText().catch(() => '')) ||
    (await page.locator('body').innerText().catch(() => ''));
  const tieneEstructura = await page
    .locator('main h1, main h2, main table, main form, h1, table, form')
    .count()
    .then((c) => c > 0)
    .catch(() => false);

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);

  const nombreShot = (ruta.replace(/[/[\]]/g, '_').replace(/^_/, '') || 'root') + '.png';
  const screenshot = join(DIR_SHOTS, nombreShot);
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});

  let estado: Estado;
  let detalle = '';
  if (falloNavegacion === 'SIN_DATOS') {
    estado = 'SIN_DATOS';
    detalle = 'La lista padre no tiene filas para abrir el detalle (no es necesariamente un bug).';
  } else if (falloNavegacion) {
    estado = 'NAVEGACION_FALLIDA';
    detalle = falloNavegacion;
  } else if (tieneNotFound) {
    estado = 'NO_ENCONTRADA';
    detalle = navStatus === 404 ? 'El documento devolvió HTTP 404.' : 'Renderizó el 404 por defecto de Next.';
  } else if (navStatus !== undefined && navStatus >= 500) {
    estado = 'RUNTIME_ERROR';
    detalle = `El documento devolvió HTTP ${navStatus} (error de servidor en el render).`;
  } else if (tieneRuntimeError || pageErrors.length > 0) {
    estado = 'RUNTIME_ERROR';
    detalle = pageErrors[0] ?? 'Overlay de runtime error de Next visible.';
  } else if (apisFallidas.length > 0) {
    estado = 'API_FALLA';
    detalle = apisFallidas.map((a) => `${a.status} ${a.url}`).join(' | ');
  } else if (textoUtil.trim().length < 40 && !tieneEstructura) {
    estado = 'VACIA';
    detalle = 'Contenido vacío o placeholder (posible falta de implementación).';
  } else {
    estado = 'OK';
  }

  return { ruta, estrategia, estado, detalle, consoleErrors, pageErrors, apisFallidas, screenshot };
}

test('@smoke barrido de pantallas rotas', async ({ page }) => {
  test.setTimeout(5 * 60 * 1_000); // barrer todo el shell puede tardar
  mkdirSync(DIR_SHOTS, { recursive: true });

  const rutas = descubrirRutas();
  const hallazgos: Hallazgo[] = [];
  const omitidas: RutaDescubierta[] = [];

  for (const r of rutas) {
    if (!r.requiereId) {
      // Deep-link directo: páginas y listas que se bancan navegación por URL.
      hallazgos.push(
        await inspeccionar(page, r.ruta, 'directa', async () => {
          const res = await page.goto(r.ruta);
          return res?.status();
        }),
      );
    } else if (r.esDinamica && r.listaPadre) {
      // Detalle [id]: se llega por click desde la lista (esquiva la muerte por
      // deep-link del static export). Mismo selector que ventas.spec.ts.
      const listaPadre = r.listaPadre;
      hallazgos.push(
        await inspeccionar(page, r.ruta, 'via-lista', async () => {
          await page.goto(listaPadre);
          await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
          const link = page.getByRole('row').nth(1).getByRole('link').first();
          if ((await link.count()) === 0) throw new Error('SIN_DATOS');
          await link.click();
          return undefined; // navegación de cliente: no hay response de documento
        }),
      );
    } else {
      // Ruta que requiere id (p.ej. /editar) sin estrategia de navegación aún.
      // NO se oculta: se reporta para que alguien le agregue estrategia.
      omitidas.push(r);
    }
  }

  const porEstado = hallazgos.reduce<Record<string, number>>((acc, h) => {
    acc[h.estado] = (acc[h.estado] ?? 0) + 1;
    return acc;
  }, {});

  const reporte = {
    generadoEn: new Date().toISOString(),
    baseUrl: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    nota: 'localhost:3000 pega al backend de PROD: un API_FALLA puede significar "no desplegado", no "roto".',
    total: hallazgos.length,
    porEstado,
    omitidasSinEstrategia: omitidas.map((o) => o.ruta),
    hallazgos,
  };
  writeFileSync(join(DIR_REPORTE, 'pantallas-rotas.json'), JSON.stringify(reporte, null, 2));

  // Resumen legible en consola.
  const etiqueta: Record<Estado, string> = {
    OK: '✅ OK',
    API_FALLA: '🟠 API_FALLA',
    RUNTIME_ERROR: '🔴 RUNTIME',
    NO_ENCONTRADA: '🔴 404',
    VACIA: '🟡 VACIA',
    SIN_DATOS: '⚪ SIN_DATOS',
    NAVEGACION_FALLIDA: '🔴 NAV',
  };
  console.log('\n── Barrido de pantallas ──');
  for (const h of hallazgos) {
    console.log(`${etiqueta[h.estado].padEnd(14)} ${h.ruta}${h.detalle ? `  — ${h.detalle}` : ''}`);
  }
  if (omitidas.length) {
    console.log('\nOmitidas (requieren estrategia de navegación con id):');
    for (const o of omitidas) console.log(`  ⏭️  ${o.ruta}`);
  }
  console.log(`\nReporte: ${join(DIR_REPORTE, 'pantallas-rotas.json')}\n`);

  // Política de fallo: las ROTAS siempre revientan el test. Las DUDOSAS solo
  // con SMOKE_ESTRICTO=1 (porque local pega a prod y puede haber "no desplegado").
  const estricto = process.env.SMOKE_ESTRICTO === '1';
  const aFallar = hallazgos.filter(
    (h) => ROTAS.includes(h.estado) || (estricto && DUDOSAS.includes(h.estado)),
  );
  const mensaje = aFallar.map((f) => `  ${f.estado}  ${f.ruta} — ${f.detalle}`).join('\n');
  expect(aFallar, `Pantallas rotas detectadas:\n${mensaje}`).toHaveLength(0);
});
