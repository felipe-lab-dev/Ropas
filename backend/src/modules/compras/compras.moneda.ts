import { ErrorValidacion } from '../../core/errors/errores';

/**
 * Conversión de moneda para compras. Regla única e invariante:
 * **PEN se deriva multiplicando por el tipo de cambio. NUNCA dividiendo.**
 * El TC es "soles por dólar" (TC venta SUNAT), p.ej. 3.7560.
 *
 * La `Compra` guarda los montos en su moneda original; PEN se deriva solo
 * donde se necesita (costo de inventario, asiento contable, deuda del proveedor).
 */

const MONEDAS_PERMITIDAS = ['PEN', 'USD'] as const;
export type MonedaCompra = (typeof MONEDAS_PERMITIDAS)[number];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Importe monetario final convertido a PEN (2 decimales). */
export function aPEN(monto: number, tipoCambio: number): number {
  return round2(monto * tipoCambio);
}

/**
 * Costo unitario convertido a PEN con alta precisión (4 decimales). Se usa
 * `round4` porque este valor se va a PROMEDIAR (costo promedio ponderado);
 * redondear a 2 antes de promediar acumula error en cada compra.
 */
export function costoUnitarioPEN(costo: number, tipoCambio: number): number {
  return round4(costo * tipoCambio);
}

/**
 * Normaliza y valida moneda + tipo de cambio de una compra.
 * - `PEN` → `tipoCambio` forzado a 1 (se ignora lo recibido).
 * - Otra moneda → `tipoCambio` obligatorio y > 0.
 * - Moneda fuera de la whitelist → error.
 */
export function normalizarMoneda(input: {
  moneda?: string;
  tipoCambio?: number;
}): { moneda: MonedaCompra; tipoCambio: number } {
  const moneda = (input.moneda ?? 'PEN').toUpperCase();
  if (!MONEDAS_PERMITIDAS.includes(moneda as MonedaCompra)) {
    throw new ErrorValidacion(
      `Moneda no soportada: ${moneda}. Use ${MONEDAS_PERMITIDAS.join(' o ')}.`,
    );
  }
  if (moneda === 'PEN') {
    return { moneda: 'PEN', tipoCambio: 1 };
  }
  if (input.tipoCambio == null || input.tipoCambio <= 0) {
    throw new ErrorValidacion(
      `Para moneda ${moneda} el tipo de cambio es obligatorio y debe ser mayor a 0`,
    );
  }
  return { moneda: moneda as MonedaCompra, tipoCambio: input.tipoCambio };
}
