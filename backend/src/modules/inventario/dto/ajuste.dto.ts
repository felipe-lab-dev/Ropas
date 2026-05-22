import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const TIPOS_AJUSTE_MANUAL = [
  'ingreso_ajuste',
  'egreso_ajuste',
  'ingreso_devolucion',
] as const;

export class AjusteStockDto {
  @IsUUID() varianteId!: string;
  @IsUUID() sucursalId!: string;
  /** Cantidad positiva. Si es egreso, el service lo convierte a negativo según tipo. */
  @IsInt() delta!: number;
  @IsEnum(TIPOS_AJUSTE_MANUAL)
  tipo!: (typeof TIPOS_AJUSTE_MANUAL)[number];
  @IsOptional() @IsString() @MaxLength(240) motivo?: string;
}

export class MermaStockDto {
  @IsUUID() varianteId!: string;
  @IsUUID() sucursalId!: string;
  /** Cantidad positiva a dar de baja. */
  @IsInt() cantidad!: number;
  @IsString() @IsNotEmpty() @MaxLength(240) motivo!: string;
}

export class TrasladoStockDto {
  @IsUUID() varianteId!: string;
  @IsUUID() sucursalOrigenId!: string;
  @IsUUID() sucursalDestinoId!: string;
  @IsInt() cantidad!: number;
  @IsOptional() @IsString() @MaxLength(240) motivo?: string;
}

export class ConteoFisicoItemDto {
  @IsUUID() varianteId!: string;
  @IsInt() cantidadContada!: number;
}

export class ConteoFisicoDto {
  @IsUUID() sucursalId!: string;
  @ValidateNested({ each: true })
  @Type(() => ConteoFisicoItemDto)
  items!: ConteoFisicoItemDto[];
  @IsOptional() @IsString() @MaxLength(240) motivo?: string;
}

export class ActualizarParametrosStockDto {
  @IsOptional() @IsInt() stockMinimo?: number;
  @IsOptional() @IsString() @MaxLength(40) ubicacion?: string;
}
