/**
 * Medios de pago aceptados en el sistema.
 * Fuente de verdad compartida entre POS, pagos de venta y devoluciones de NC.
 */

/** Valores válidos que el backend reconoce como medio de pago. */
export type MedioPago =
  | 'efectivo'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'yape'
  | 'plin'
  | 'transferencia'
  | 'pix'
  | 'otro';

/** Etiquetas legibles para mostrar en la UI. */
export const MEDIO_LABEL: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  tarjeta_debito: 'Tarjeta débito',
  tarjeta_credito: 'Tarjeta crédito',
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia',
  pix: 'PIX',
  otro: 'Otro',
};

/** Todos los medios de pago, en el orden en que deben aparecer en los selectores. */
export const MEDIOS_PAGO: MedioPago[] = [
  'efectivo',
  'tarjeta_debito',
  'tarjeta_credito',
  'yape',
  'plin',
  'transferencia',
  'pix',
  'otro',
];
