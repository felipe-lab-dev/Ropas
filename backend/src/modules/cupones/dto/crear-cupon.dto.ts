import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const TIPO_DESCUENTO = ['porcentaje', 'monto_fijo'] as const;
const SEGMENTOS = [
  'todos',
  'vip_aa',
  'vip_a',
  'vip_b',
  'vip_c',
  'lista_clientes',
  'nuevos_clientes',
  'reactivacion',
] as const;
const APLICABLE_A = ['toda_compra', 'categorias', 'productos'] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

export class CrearCuponDto {
  @Transform(upper)
  @IsString()
  @Length(3, 40, { message: 'El código debe tener entre 3 y 40 caracteres' })
  @Matches(/^[A-Z0-9\-_]+$/, {
    message: 'El código solo admite letras, números, guion y guion bajo (mayúsculas)',
  })
  codigo!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 160, { message: 'El nombre debe tener entre 3 y 160 caracteres' })
  nombre!: string;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 2000)
  descripcion?: string | null;

  @IsEnum(TIPO_DESCUENTO, { message: 'Tipo de descuento inválido' })
  tipoDescuento!: (typeof TIPO_DESCUENTO)[number];

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor de descuento inválido' })
  @Min(0.01, { message: 'El descuento debe ser mayor a 0' })
  valorDescuento!: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  montoMinimoCompra?: number | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  descuentoMaximo?: number | null;

  @IsDateString({}, { message: 'Fecha de inicio inválida' })
  fechaInicio!: string;

  @IsDateString({}, { message: 'Fecha de fin inválida' })
  fechaFin!: string;

  @IsOptional() @IsInt() @Min(1) @Max(100_000)
  usosMaximosTotal?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  usosMaximosPorCliente?: number;

  @IsOptional() @IsEnum(SEGMENTOS)
  segmento?: (typeof SEGMENTOS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  clientesElegiblesIds?: string[];

  @IsOptional() @IsEnum(APLICABLE_A)
  aplicableA?: (typeof APLICABLE_A)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  categoriasAplicablesIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  productosAplicablesIds?: string[];

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 120)
  campania?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 60)
  plantilla?: string | null;

  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6,8}$/, { message: 'Color primario inválido (HEX)' })
  disenoColorPrimario?: string;

  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6,8}$/, { message: 'Color secundario inválido (HEX)' })
  disenoColorSecundario?: string;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 240)
  disenoMensaje?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 8)
  disenoEmoji?: string | null;
}
