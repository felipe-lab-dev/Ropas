import type { QueryClient } from '@tanstack/react-query';

/**
 * Query keys de todas las vistas que muestran stock/disponible de productos.
 * Fuente única de verdad: si agregás una vista nueva que lee stock, sumá su key
 * acá y todas las mutaciones que mueven inventario la refrescarán sin tocarlas.
 *
 * - `productos`        → lista de productos (columna stockTotal)
 * - `stock`            → módulo Inventario
 * - `buscar-variantes` → buscador de variantes (POS y Nueva compra)
 */
const QUERY_KEYS_STOCK = [['productos'], ['stock'], ['buscar-variantes']] as const;

/**
 * Invalida el cache de toda vista que muestre stock. Llamar en el `onSuccess` de
 * cualquier mutación que mueva inventario (venta, compra, anulación, nota de
 * crédito, ajuste, traslado, merma).
 *
 * Sin esto, el `staleTime` global (30s) + `refetchOnWindowFocus: false` hacen que
 * las vistas sigan mostrando el stock previo a la operación.
 */
export function invalidarStock(qc: QueryClient): void {
  for (const queryKey of QUERY_KEYS_STOCK) {
    void qc.invalidateQueries({ queryKey });
  }
}
