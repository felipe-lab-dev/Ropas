import { z } from 'zod';

export const TIPO_DOC = ['ruc', 'dni', 'cpf', 'cnpj', 'pasaporte', 'otro'] as const;
export const CONDICION_PAGO = [
  'contado',
  'credito_15',
  'credito_30',
  'credito_60',
  'credito_otro',
] as const;

export const CONDICION_LABEL: Record<(typeof CONDICION_PAGO)[number], string> = {
  contado: 'Contado',
  credito_15: 'Crédito 15 días',
  credito_30: 'Crédito 30 días',
  credito_60: 'Crédito 60 días',
  credito_otro: 'Crédito (otro)',
};

const DIAS_POR_CONDICION: Record<(typeof CONDICION_PAGO)[number], number | null> = {
  contado: 0,
  credito_15: 15,
  credito_30: 30,
  credito_60: 60,
  credito_otro: null, // libre
};

export const proveedorSchema = z
  .object({
    tipoDocumento: z.enum(TIPO_DOC, { errorMap: () => ({ message: 'Selecciona un tipo de documento' }) }),
    documento: z
      .string()
      .trim()
      .min(1, 'El documento es obligatorio')
      .max(20, 'Máximo 20 caracteres'),
    razonSocial: z
      .string()
      .trim()
      .min(2, 'La razón social debe tener al menos 2 caracteres')
      .max(200, 'Máximo 200 caracteres'),
    nombreComercial: z.string().trim().max(160).optional().or(z.literal('')),
    contacto: z.string().trim().max(120).optional().or(z.literal('')),
    email: z
      .string()
      .trim()
      .max(160)
      .optional()
      .or(z.literal(''))
      .refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email inválido'),
    telefono: z.string().trim().max(40).optional().or(z.literal('')),
    direccion: z.string().trim().max(240).optional().or(z.literal('')),
    ciudad: z.string().trim().max(120).optional().or(z.literal('')),
    condicionPago: z.enum(CONDICION_PAGO).default('contado'),
    diasCredito: z
      .number({ invalid_type_error: 'Debe ser un número' })
      .int('Sin decimales')
      .min(0, 'No puede ser negativo')
      .max(365, 'Máximo 365 días')
      .default(0),
    cuentaBancaria: z.string().trim().max(60).optional().or(z.literal('')),
    notas: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    const docDigits = v.documento.replace(/\D+/g, '');
    if (v.tipoDocumento === 'ruc' && docDigits.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documento'],
        message: 'El RUC debe tener 11 dígitos',
      });
    }
    if (v.tipoDocumento === 'dni' && docDigits.length !== 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documento'],
        message: 'El DNI debe tener 8 dígitos',
      });
    }
    const dias = DIAS_POR_CONDICION[v.condicionPago];
    if (dias === null && v.diasCredito <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['diasCredito'],
        message: 'Indica los días de crédito',
      });
    }
  });

export type ProveedorFormValues = z.infer<typeof proveedorSchema>;

export const PROVEEDOR_VACIO: ProveedorFormValues = {
  tipoDocumento: 'ruc',
  documento: '',
  razonSocial: '',
  nombreComercial: '',
  contacto: '',
  email: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  condicionPago: 'contado',
  diasCredito: 0,
  cuentaBancaria: '',
  notas: '',
};

/**
 * Sugiere días de crédito coherentes al cambiar la condición de pago.
 * Devuelve null cuando es libre (credito_otro).
 */
export function diasSugeridos(c: (typeof CONDICION_PAGO)[number]): number | null {
  return DIAS_POR_CONDICION[c];
}

/**
 * Normaliza los valores antes de enviarlos al backend:
 * trim, vacíos → null, documento solo dígitos cuando aplica, razón social en MAYÚSCULAS,
 * email en minúsculas.
 */
export function aPayloadApi(v: ProveedorFormValues) {
  const empty = (s?: string | null) => (s && s.trim().length > 0 ? s.trim() : null);
  return {
    tipoDocumento: v.tipoDocumento,
    documento:
      v.tipoDocumento === 'ruc' || v.tipoDocumento === 'dni'
        ? v.documento.replace(/\D+/g, '')
        : v.documento.trim(),
    razonSocial: v.razonSocial.trim().toUpperCase(),
    nombreComercial: empty(v.nombreComercial),
    contacto: empty(v.contacto),
    email: v.email ? v.email.trim().toLowerCase() || null : null,
    telefono: empty(v.telefono),
    direccion: empty(v.direccion),
    ciudad: empty(v.ciudad),
    condicionPago: v.condicionPago,
    diasCredito: v.diasCredito,
    cuentaBancaria: empty(v.cuentaBancaria),
    notas: empty(v.notas),
  };
}
