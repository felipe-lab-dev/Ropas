import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
const ESTADOS = ['activo', 'pausado', 'expirado', 'agotado'] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

export class ActualizarCuponDto {
  @IsOptional() @Transform(trim) @IsString() @Length(3, 160)
  nombre?: string;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 2000)
  descripcion?: string | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  valorDescuento?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  montoMinimoCompra?: number | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  descuentoMaximo?: number | null;

  @IsOptional() @IsDateString()
  fechaInicio?: string;

  @IsOptional() @IsDateString()
  fechaFin?: string;

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

  @IsOptional() @IsEnum(ESTADOS)
  estado?: (typeof ESTADOS)[number];

  @IsOptional() @IsBoolean()
  pausar?: boolean;

  @IsOptional() @IsString() @Length(7, 9)
  disenoColorPrimario?: string;

  @IsOptional() @IsString() @Length(7, 9)
  disenoColorSecundario?: string;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 240)
  disenoMensaje?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 8)
  disenoEmoji?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 60)
  temaEstacional?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 500)
  fondoImagenUrl?: string | null;
}
