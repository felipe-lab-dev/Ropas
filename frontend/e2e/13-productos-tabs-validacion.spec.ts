import { test, expect } from '@playwright/test';
import {
  apiContext,
  esperarToast,
  fillEstable,
  gotoY,
  login,
  sufijoAleatorio,
} from './helpers';

test.describe('Productos · Tabs + validación + eliminar con confirm', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('nuevo producto: tabs visibles y navegables', async ({ page }) => {
    await gotoY(page, '/productos/nuevo');
    await expect(page.getByRole('heading', { name: /nuevo producto/i })).toBeVisible();

    await expect(page.locator('[data-testid="tab-general"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-variantes"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-sunat"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-avanzado"]')).toBeVisible();

    // Navegar entre tabs
    await page.locator('[data-testid="tab-sunat"]').click();
    await expect(page.locator('[data-testid="select-unidad-medida"]')).toBeVisible();

    await page.locator('[data-testid="tab-general"]').click();
    await expect(page.locator('#nombre')).toBeVisible();
  });

  test('lista: botón "Nuevo producto" abre el modal con tabs y deep-link', async ({ page }) => {
    await gotoY(page, '/productos');

    await page.getByTestId('btn-abrir-nuevo-producto').click();

    const modal = page.getByTestId('modal-nuevo-producto');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal.getByTestId('tab-general')).toBeVisible();
    await expect(modal.getByTestId('tab-variantes')).toBeVisible();
    // El select de categoría con íconos está presente dentro del modal
    await expect(modal.getByTestId('select-categoria')).toBeVisible();
    // La URL refleja el deep-link ?nuevo=1
    await expect(page).toHaveURL(/[?&]nuevo=1/);
  });

  test('nuevo producto: clic en Crear sin nombre muestra toast y NO navega', async ({ page }) => {
    await gotoY(page, '/productos/nuevo');

    // Asegurarse de estar en tab general con campos vacíos
    await page.locator('[data-testid="tab-general"]').click();

    // Limpiar el nombre por si tiene autofocus o algún valor
    const nombre = page.locator('#nombre');
    await nombre.fill('');

    await page.locator('[data-testid="btn-guardar"]').click();

    await esperarToast(page, /faltan/i);
    // Debe seguir en /productos/nuevo
    await expect(page).toHaveURL(/\/productos\/nuevo/);

    // El campo Nombre debe estar marcado como aria-invalid
    await expect(nombre).toHaveAttribute('aria-invalid', 'true');
  });

  test('nuevo producto: validación abre la tab del primer error', async ({ page }) => {
    await gotoY(page, '/productos/nuevo');

    // Ir a la tab SUNAT para simular que el usuario está en otra tab cuando guarda
    await page.locator('[data-testid="tab-sunat"]').click();
    await expect(page.locator('[data-testid="select-unidad-medida"]')).toBeVisible();

    // Click Guardar con Nombre vacío → debería abrir tab General donde está el error
    await page.locator('[data-testid="btn-guardar"]').click();
    await esperarToast(page, /faltan/i);

    // La tab General debe quedar activa
    const tabGeneral = page.locator('[data-testid="tab-general"]');
    await expect(tabGeneral).toHaveAttribute('data-state', 'active');
  });

  test('asterisco rojo visible en campos requeridos', async ({ page }) => {
    await gotoY(page, '/productos/nuevo');

    // Encontrar el label "Nombre" en la tab General y verificar que su asterisco tiene color rojo
    const labelNombre = page.locator('label[for="nombre"]');
    await expect(labelNombre).toBeVisible();

    const asterisco = labelNombre.locator('span[aria-label="requerido"]');
    await expect(asterisco).toBeVisible();
    await expect(asterisco).toHaveText('*');

    // Verificar color rojo computado
    const color = await asterisco.evaluate(el => getComputedStyle(el).color);
    // ef4444 = rgb(239, 68, 68)
    expect(color).toMatch(/rgb\(\s*239\s*,\s*68\s*,\s*68\s*\)/);
  });

  test('editar producto: muestra tabs y botón Eliminar con confirm dialog', async ({ page }) => {
    const api = await apiContext();
    const resProd = await api.get('/api/v1/productos?limite=1');
    expect(resProd.ok()).toBeTruthy();
    const lista = (await resProd.json()) as { datos: Array<{ id: string }> };
    expect(lista.datos.length).toBeGreaterThan(0);
    const productoId = lista.datos[0]!.id;

    await gotoY(page, `/productos/editar?id=${productoId}`);
    await expect(page.locator('[data-testid="tab-general"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-imagenes"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-variantes"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-sunat"]')).toBeVisible();

    // Botón Eliminar debe estar en FormActions sticky
    const btnEliminar = page.locator('[data-testid="btn-eliminar"]');
    await expect(btnEliminar).toBeVisible();
    await btnEliminar.click();

    // El dialog de confirmación debe abrir
    const dialog = page.locator('[data-testid="delete-confirm-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toContainText(/eliminar producto/i);

    // Cancelar cierra el dialog sin borrar
    await page.locator('[data-testid="btn-cancelar-eliminar"]').click();
    await expect(dialog).toHaveCount(0, { timeout: 5_000 });
  });

  test('editar producto: borrar nombre y guardar muestra error', async ({ page }) => {
    const api = await apiContext();
    const resProd = await api.get('/api/v1/productos?limite=1');
    const lista = (await resProd.json()) as { datos: Array<{ id: string; nombre: string }> };
    const producto = lista.datos[0]!;

    await gotoY(page, `/productos/editar?id=${producto.id}`);
    await page.locator('[data-testid="tab-general"]').click();
    await expect(page.locator('#nombre')).toBeVisible();

    const nombre = page.locator('#nombre');
    await nombre.fill('');

    await page.locator('[data-testid="btn-guardar"]').click();
    // El hook dispara "Nombre: Ingresá un nombre" cuando hay 1 solo error
    await esperarToast(page, /nombre.*ingres[áa]/i);

    // El nombre original NO debe haberse modificado en la API (no submit)
    const resVerify = await api.get(`/api/v1/productos/${producto.id}`);
    const verif = (await resVerify.json()) as { datos: { nombre: string } };
    expect(verif.datos.nombre).toBe(producto.nombre);

    // Restaurar el nombre en el form para no dejar UI rota
    await fillEstable(page, '#nombre', producto.nombre);
  });

  test('crear y eliminar producto E2E completo con confirm dialog', async ({ page }) => {
    const api = await apiContext();
    const resCat = await api.get('/api/v1/categorias');
    const respCat = (await resCat.json()) as { datos: Array<{ nombre: string }> };
    const categoria = respCat.datos[0]!.nombre;

    const nombre = `Tabs E2E ${sufijoAleatorio(5)}`;

    await gotoY(page, '/productos/nuevo');
    await page.locator('[data-testid="tab-general"]').click();

    await fillEstable(page, '#nombre', nombre);
    await fillEstable(page, '#precioVenta', '99.90');
    // Categoría: ahora es un SelectIconos (Radix) — abrir y elegir por nombre.
    // (Igual auto-selecciona la primera categoría al montar; lo hacemos explícito.)
    await page.locator('#categoria').click();
    await page.getByRole('option', { name: categoria, exact: true }).click();

    await page.locator('[data-testid="btn-guardar"]').click();
    await esperarToast(page, /producto creado/i);
    // Redirige a /productos/editar?id=...
    await expect(page).toHaveURL(/\/productos\/editar/, { timeout: 12_000 });

    // Abrir el confirm dialog y eliminar
    const btnEliminar = page.locator('[data-testid="btn-eliminar"]');
    await expect(btnEliminar).toBeVisible({ timeout: 10_000 });
    await btnEliminar.click();

    await expect(page.locator('[data-testid="delete-confirm-dialog"]')).toBeVisible();
    await page.locator('[data-testid="btn-confirmar-eliminar"]').click();

    await esperarToast(page, /producto eliminado/i);
    await expect(page).toHaveURL(/\/productos\/?$/, { timeout: 12_000 });

    // Verificar via API que ya no aparece
    const resVerify = await api.get(`/api/v1/productos?buscar=${encodeURIComponent(nombre)}`);
    const verif = (await resVerify.json()) as { datos: Array<{ nombre: string }> };
    expect(verif.datos.find(p => p.nombre === nombre)).toBeUndefined();
  });
});
