/**
 * Cálculo de rentabilidad (margen / utilidad) de una venta y sus líneas.
 *
 * Fuente única de verdad usada por `VentasService.listar()` y `.obtener()`.
 * Sin dependencias de Prisma ni de I/O → 100% testeable como función pura.
 *
 * Definiciones:
 *   ingresoNeto = Σ subtotal de ítems − descuento global − descuento de cupón
 *   costoTotal  = Σ (cantidad × costoUnitario) de los ítems con costo conocido
 *   ganancia    = ingresoNeto − costoTotal
 *   margen %    = ganancia / ingresoNeto × 100   (relativo a la venta)
 *   markup %    = ganancia / costoTotal × 100    (relativo al costo)
 *
 * Niveles (alineados con DIH ERP):
 *   sin_datos  → ningún ítem tiene costo
 *   parcial    → algunos ítems sin costo (margen no fiable)
 *   saludable  → margen ≥ 30 %
 *   aceptable  → 15 % ≤ margen < 30 %
 *   bajo       → 5 % ≤ margen < 15 %
 *   perdida    → margen < 5 % (incluye negativo)
 */

export type NivelRentabilidad =
  | 'saludable'
  | 'aceptable'
  | 'bajo'
  | 'perdida'
  | 'sin_datos'
  | 'parcial';

/** Acepta number | string | Prisma.Decimal | null. */
type Numerico = number | string | { toString(): string } | null | undefined;

export interface ItemRentabilidadInput {
  cantidad: number;
  /** Subtotal de la línea (precioUnitario × cantidad − descuento del ítem). */
  subtotal: Numerico;
  /** Costo congelado por unidad. Null = sin costo conocido. */
  costoUnitario: Numerico;
}

export interface RentabilidadVentaInput {
  items: ItemRentabilidadInput[];
  descuento?: Numerico;
  descuentoCupon?: Numerico;
}

export interface RentabilidadVenta {
  ingresoNeto: number;
  costoTotal: number;
  ganancia: number;
  /** % margen sobre el ingreso. Null si no se puede calcular. */
  margenPct: number | null;
  /** % markup sobre el costo. Null si no se puede calcular. */
  markupPct: number | null;
  itemsTotal: number;
  itemsConCosto: number;
  /** true cuando TODOS los ítems tienen costo conocido. */
  confiable: boolean;
  nivel: NivelRentabilidad;
}

export interface RentabilidadItem {
  costoUnitario: number | null;
  ingreso: number;
  costoTotal: number;
  ganancia: number | null;
  margenPct: number | null;
  nivel: NivelRentabilidad;
}

function aNumero(valor: Numerico): number {
  if (valor === null || valor === undefined) return 0;
  const n = typeof valor === 'number' ? valor : parseFloat(valor.toString());
  return Number.isFinite(n) ? n : 0;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clasifica un margen ya calculado (sobre ítems con costo) en su nivel. */
function clasificarPorMargen(margenPct: number): NivelRentabilidad {
  if (margenPct >= 30) return 'saludable';
  if (margenPct >= 15) return 'aceptable';
  if (margenPct >= 5) return 'bajo';
  return 'perdida';
}

/** Rentabilidad de una línea individual. */
export function calcularRentabilidadItem(
  item: ItemRentabilidadInput,
): RentabilidadItem {
  const ingreso = redondear(aNumero(item.subtotal));
  const tieneCosto = item.costoUnitario !== null && item.costoUnitario !== undefined;
  if (!tieneCosto) {
    return {
      costoUnitario: null,
      ingreso,
      costoTotal: 0,
      ganancia: null,
      margenPct: null,
      nivel: 'sin_datos',
    };
  }
  const costoUnitario = aNumero(item.costoUnitario);
  const costoTotal = redondear(costoUnitario * item.cantidad);
  const ganancia = redondear(ingreso - costoTotal);
  const margenPct = ingreso > 0 ? redondear((ganancia / ingreso) * 100) : null;
  return {
    costoUnitario,
    ingreso,
    costoTotal,
    ganancia,
    margenPct,
    nivel: margenPct === null ? 'sin_datos' : clasificarPorMargen(margenPct),
  };
}

/** Rentabilidad agregada de una venta. */
export function calcularRentabilidadVenta(
  input: RentabilidadVentaInput,
): RentabilidadVenta {
  const itemsTotal = input.items.length;
  const itemsConCosto = input.items.filter(
    i => i.costoUnitario !== null && i.costoUnitario !== undefined,
  ).length;

  const sumaSubtotales = input.items.reduce((s, i) => s + aNumero(i.subtotal), 0);
  const descuento = aNumero(input.descuento);
  const descuentoCupon = aNumero(input.descuentoCupon);
  const ingresoNeto = redondear(sumaSubtotales - descuento - descuentoCupon);

  const costoTotal = redondear(
    input.items.reduce(
      (s, i) =>
        i.costoUnitario !== null && i.costoUnitario !== undefined
          ? s + aNumero(i.costoUnitario) * i.cantidad
          : s,
      0,
    ),
  );

  const ganancia = redondear(ingresoNeto - costoTotal);
  const margenPct =
    ingresoNeto > 0 && itemsConCosto > 0
      ? redondear((ganancia / ingresoNeto) * 100)
      : null;
  const markupPct =
    costoTotal > 0 ? redondear((ganancia / costoTotal) * 100) : null;

  const confiable = itemsTotal > 0 && itemsConCosto === itemsTotal;

  let nivel: NivelRentabilidad;
  if (itemsTotal === 0 || itemsConCosto === 0) {
    nivel = 'sin_datos';
  } else if (!confiable) {
    nivel = 'parcial';
  } else if (margenPct === null) {
    nivel = 'sin_datos';
  } else {
    nivel = clasificarPorMargen(margenPct);
  }

  return {
    ingresoNeto,
    costoTotal,
    ganancia,
    margenPct,
    markupPct,
    itemsTotal,
    itemsConCosto,
    confiable,
    nivel,
  };
}
