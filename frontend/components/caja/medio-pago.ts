export const MEDIOS_PAGO = [
  { valor: 'efectivo', label: 'Efectivo' },
  { valor: 'tarjeta_debito', label: 'Tarjeta débito' },
  { valor: 'tarjeta_credito', label: 'Tarjeta crédito' },
  { valor: 'transferencia', label: 'Transferencia' },
  { valor: 'yape', label: 'Yape' },
  { valor: 'plin', label: 'Plin' },
  { valor: 'pix', label: 'Pix' },
  { valor: 'otro', label: 'Otro' },
] as const;

export type MedioPago = (typeof MEDIOS_PAGO)[number]['valor'];

export const MEDIO_LABEL: Record<MedioPago, string> = Object.fromEntries(
  MEDIOS_PAGO.map(m => [m.valor, m.label]),
) as Record<MedioPago, string>;

export function esMedioFisico(medio: MedioPago): boolean {
  return medio === 'efectivo';
}

export function etiquetaMedio(medio: string): string {
  return MEDIO_LABEL[medio as MedioPago] ?? medio;
}
