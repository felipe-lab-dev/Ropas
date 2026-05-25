import { z } from 'zod';

export const TIPO_DESCUENTO = ['porcentaje', 'monto_fijo'] as const;
export const SEGMENTOS = [
  'todos',
  'vip_aa',
  'vip_a',
  'vip_b',
  'vip_c',
  'lista_clientes',
  'nuevos_clientes',
  'reactivacion',
] as const;
export const APLICABLE_A = ['toda_compra', 'categorias', 'productos'] as const;
export const ESTADOS = ['activo', 'pausado', 'expirado', 'agotado'] as const;

export const TIPO_LABEL: Record<(typeof TIPO_DESCUENTO)[number], string> = {
  porcentaje: '% Porcentaje',
  monto_fijo: 'S/ Monto fijo',
};

export const SEGMENTO_LABEL: Record<(typeof SEGMENTOS)[number], string> = {
  todos: 'Todos los clientes',
  vip_aa: 'VIP nivel AA (élite)',
  vip_a: 'VIP nivel A o superior',
  vip_b: 'Nivel B o superior',
  vip_c: 'Nivel C o superior',
  lista_clientes: 'Lista específica de clientes',
  nuevos_clientes: 'Solo nuevos clientes (sin compras)',
  reactivacion: 'Reactivación (sin comprar en 60+ días)',
};

export const APLICABLE_LABEL: Record<(typeof APLICABLE_A)[number], string> = {
  toda_compra: 'Toda la compra',
  categorias: 'Categorías específicas',
  productos: 'Productos específicos',
};

export const ESTADO_LABEL: Record<(typeof ESTADOS)[number], string> = {
  activo: 'Activo',
  pausado: 'Pausado',
  expirado: 'Expirado',
  agotado: 'Agotado',
};

export const cuponSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Código mínimo 3 caracteres')
      .max(40, 'Máximo 40 caracteres')
      .regex(/^[A-Z0-9\-_]+$/, 'Solo letras, números, guion y guion bajo'),
    nombre: z.string().trim().min(3, 'Mínimo 3 caracteres').max(160),
    descripcion: z.string().trim().max(2000).optional().or(z.literal('')),
    tipoDescuento: z.enum(TIPO_DESCUENTO),
    valorDescuento: z
      .number({ invalid_type_error: 'Debe ser un número' })
      .min(0.01, 'Mayor a 0'),
    montoMinimoCompra: z
      .number({ invalid_type_error: 'Debe ser un número' })
      .min(0)
      .nullable()
      .optional(),
    descuentoMaximo: z
      .number({ invalid_type_error: 'Debe ser un número' })
      .min(0)
      .nullable()
      .optional(),
    fechaInicio: z.string().min(1, 'Fecha de inicio obligatoria'),
    fechaFin: z.string().min(1, 'Fecha de fin obligatoria'),
    usosMaximosTotal: z
      .number({ invalid_type_error: 'Debe ser un número' })
      .int()
      .min(1)
      .max(100_000)
      .nullable()
      .optional(),
    usosMaximosPorCliente: z
      .number({ invalid_type_error: 'Debe ser un número' })
      .int()
      .min(1)
      .max(100)
      .default(1),
    segmento: z.enum(SEGMENTOS).default('todos'),
    clientesElegiblesIds: z.array(z.string().uuid()).default([]),
    aplicableA: z.enum(APLICABLE_A).default('toda_compra'),
    categoriasAplicablesIds: z.array(z.string().uuid()).default([]),
    productosAplicablesIds: z.array(z.string().uuid()).default([]),
    campania: z.string().trim().max(120).optional().or(z.literal('')),
    plantilla: z.string().trim().max(60).optional().or(z.literal('')),
    disenoColorPrimario: z
      .string()
      .regex(/^#[0-9a-fA-F]{6,8}$/, 'Color HEX inválido')
      .default('#7c3aed'),
    disenoColorSecundario: z
      .string()
      .regex(/^#[0-9a-fA-F]{6,8}$/, 'Color HEX inválido')
      .default('#1e1b4b'),
    disenoMensaje: z.string().trim().max(240).optional().or(z.literal('')),
    disenoEmoji: z.string().trim().max(8).optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    if (new Date(v.fechaFin) <= new Date(v.fechaInicio)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fechaFin'],
        message: 'La fecha fin debe ser posterior al inicio',
      });
    }
    if (v.tipoDescuento === 'porcentaje' && (v.valorDescuento <= 0 || v.valorDescuento > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valorDescuento'],
        message: 'El porcentaje debe estar entre 1 y 100',
      });
    }
    if (v.aplicableA === 'categorias' && v.categoriasAplicablesIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoriasAplicablesIds'],
        message: 'Selecciona al menos una categoría',
      });
    }
    if (v.aplicableA === 'productos' && v.productosAplicablesIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productosAplicablesIds'],
        message: 'Selecciona al menos un producto',
      });
    }
    if (v.segmento === 'lista_clientes' && v.clientesElegiblesIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clientesElegiblesIds'],
        message: 'Indica al menos un cliente elegible',
      });
    }
  });

export type CuponFormValues = z.infer<typeof cuponSchema>;

export const CUPON_VACIO: CuponFormValues = {
  codigo: '',
  nombre: '',
  descripcion: '',
  tipoDescuento: 'porcentaje',
  valorDescuento: 20,
  montoMinimoCompra: null,
  descuentoMaximo: null,
  fechaInicio: new Date().toISOString().slice(0, 16),
  fechaFin: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 16),
  usosMaximosTotal: null,
  usosMaximosPorCliente: 1,
  segmento: 'todos',
  clientesElegiblesIds: [],
  aplicableA: 'toda_compra',
  categoriasAplicablesIds: [],
  productosAplicablesIds: [],
  campania: '',
  plantilla: '',
  disenoColorPrimario: '#7c3aed',
  disenoColorSecundario: '#1e1b4b',
  disenoMensaje: '',
  disenoEmoji: '',
};

export function aPayloadApi(v: CuponFormValues) {
  const empty = (s?: string | null) => (s && s.trim().length > 0 ? s.trim() : null);
  return {
    codigo: v.codigo.trim().toUpperCase(),
    nombre: v.nombre.trim(),
    descripcion: empty(v.descripcion),
    tipoDescuento: v.tipoDescuento,
    valorDescuento: v.valorDescuento,
    montoMinimoCompra: v.montoMinimoCompra ?? null,
    descuentoMaximo: v.descuentoMaximo ?? null,
    fechaInicio: new Date(v.fechaInicio).toISOString(),
    fechaFin: new Date(v.fechaFin).toISOString(),
    usosMaximosTotal: v.usosMaximosTotal ?? null,
    usosMaximosPorCliente: v.usosMaximosPorCliente,
    segmento: v.segmento,
    clientesElegiblesIds: v.clientesElegiblesIds,
    aplicableA: v.aplicableA,
    categoriasAplicablesIds: v.categoriasAplicablesIds,
    productosAplicablesIds: v.productosAplicablesIds,
    campania: empty(v.campania),
    plantilla: empty(v.plantilla),
    disenoColorPrimario: v.disenoColorPrimario,
    disenoColorSecundario: v.disenoColorSecundario,
    disenoMensaje: empty(v.disenoMensaje),
    disenoEmoji: empty(v.disenoEmoji),
  };
}
