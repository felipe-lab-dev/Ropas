/**
 * Catálogo de categorías de movimiento de caja para Ropas (retail de ropa).
 * Espejo del enum `CategoriaMovimientoCaja` del backend.
 */

export type CategoriaIngreso =
  | 'saldo_anterior'
  | 'adelanto_cliente'
  | 'cobro_credito'
  | 'devolucion_proveedor'
  | 'otro_ingreso';

export type CategoriaEgreso =
  | 'pago_proveedor'
  | 'servicio_basico'
  | 'comision_empleado'
  | 'refrigerio'
  | 'movilidad'
  | 'publicidad'
  | 'devolucion_cliente'
  | 'otro_egreso';

export type CategoriaMovimiento = CategoriaIngreso | CategoriaEgreso;

export interface CategoriaDef {
  valor: CategoriaMovimiento;
  icono: string;
  label: string;
  /** Pista corta que se muestra al lado del input descripción cuando está activa. */
  hint?: string;
}

export const CATEGORIAS_INGRESO: readonly CategoriaDef[] = [
  { valor: 'saldo_anterior', icono: '💰', label: 'Saldo anterior', hint: 'Solo efectivo, una vez por sesión' },
  { valor: 'adelanto_cliente', icono: '🧾', label: 'Adelanto cliente', hint: 'Seña o pago por adelantado' },
  { valor: 'cobro_credito', icono: '💳', label: 'Cobro a crédito', hint: 'Pago de cuota de venta a crédito' },
  { valor: 'devolucion_proveedor', icono: '↩️', label: 'Devolución de proveedor', hint: 'Reintegro recibido' },
  { valor: 'otro_ingreso', icono: '📁', label: 'Otro ingreso' },
] as const;

export const CATEGORIAS_EGRESO: readonly CategoriaDef[] = [
  { valor: 'pago_proveedor', icono: '📦', label: 'Pago a proveedor', hint: 'Factura o boleta de proveedor' },
  { valor: 'servicio_basico', icono: '💡', label: 'Servicios', hint: 'Luz, agua, internet, alquiler…' },
  { valor: 'comision_empleado', icono: '👤', label: 'Comisión / adelanto', hint: 'Empleado de la tienda' },
  { valor: 'refrigerio', icono: '🍽️', label: 'Refrigerio', hint: 'Comidas, viáticos menores' },
  { valor: 'movilidad', icono: '🚖', label: 'Movilidad / delivery', hint: 'Taxis, repartos' },
  { valor: 'publicidad', icono: '📣', label: 'Publicidad', hint: 'Marketing, redes, flyers' },
  { valor: 'devolucion_cliente', icono: '↩️', label: 'Devolución a cliente', hint: 'Reintegro por nota de crédito' },
  { valor: 'otro_egreso', icono: '📦', label: 'Otro egreso' },
] as const;

export const SUB_CATEGORIAS_SERVICIO = [
  { valor: 'luz', label: 'Luz' },
  { valor: 'agua', label: 'Agua' },
  { valor: 'internet', label: 'Internet' },
  { valor: 'telefono', label: 'Teléfono' },
  { valor: 'alquiler', label: 'Alquiler' },
  { valor: 'mantenimiento', label: 'Mantenimiento' },
  { valor: 'seguros', label: 'Seguros' },
  { valor: 'otros', label: 'Otros' },
] as const;

const CAT_MAP: Record<CategoriaMovimiento, CategoriaDef> = Object.fromEntries(
  [...CATEGORIAS_INGRESO, ...CATEGORIAS_EGRESO].map(c => [c.valor, c]),
) as Record<CategoriaMovimiento, CategoriaDef>;

export function categoriaDef(valor: CategoriaMovimiento | null | undefined): CategoriaDef | null {
  if (!valor) return null;
  return CAT_MAP[valor] ?? null;
}

/** Tipo de contraparte que se pide al usuario según la categoría. */
export type TipoContraparte = 'cliente' | 'proveedor' | 'empleado' | 'otro';

export function tipoContraparteDe(cat: CategoriaMovimiento): TipoContraparte | null {
  switch (cat) {
    case 'adelanto_cliente':
    case 'cobro_credito':
    case 'devolucion_cliente':
      return 'cliente';
    case 'pago_proveedor':
    case 'devolucion_proveedor':
      return 'proveedor';
    case 'comision_empleado':
      return 'empleado';
    case 'servicio_basico':
    case 'otro_egreso':
      return 'otro';
    default:
      return null;
  }
}

/** Indica si esa categoría pide N° de comprobante (factura/boleta). */
export function pideComprobante(cat: CategoriaMovimiento): boolean {
  return (
    cat === 'pago_proveedor' ||
    cat === 'servicio_basico' ||
    cat === 'otro_egreso' ||
    cat === 'devolucion_proveedor'
  );
}

/** Categoría bloqueada a efectivo (no se puede pagar con tarjeta). */
export function soloEfectivo(cat: CategoriaMovimiento): boolean {
  return cat === 'saldo_anterior';
}
