import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearNotaCreditoItemDto {
  /** ID del `VentaItem` a devolver. La variante se infiere de él. */
  @IsUUID() ventaItemId!: string;
  @IsInt() @Min(1) cantidad!: number;
}

export class CrearNotaCreditoDto {
  @IsUUID() ventaId!: string;

  @IsString() @MinLength(3) motivo!: string;

  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true })
  @Type(() => CrearNotaCreditoItemDto)
  items!: CrearNotaCreditoItemDto[];

  /** Si es false, la NC no devuelve stock al inventario (sirve para mermas). Default: true. */
  @IsOptional() @IsBoolean() restituyeStock?: boolean;
}
