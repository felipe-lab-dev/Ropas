import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearVentaItemDto {
  @IsUUID() varianteId!: string;
  @IsNumber() @Min(1) cantidad!: number;
  @IsOptional() @IsNumber() precioUnitario?: number;
  @IsOptional() @IsNumber() descuento?: number;
}

export class CrearVentaPagoDto {
  @IsEnum(['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'pix', 'transferencia', 'yape', 'plin', 'otro'] as const)
  medio!: string;
  @IsNumber() monto!: number;
  @IsOptional() @IsString() referencia?: string;
}

export class CrearVentaDto {
  @IsUUID() sucursalId!: string;
  @IsOptional() @IsUUID() clienteId?: string;
  @IsOptional() @IsUUID() sesionCajaId?: string;

  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => CrearVentaItemDto)
  items!: CrearVentaItemDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CrearVentaPagoDto)
  pagos?: CrearVentaPagoDto[];

  @IsOptional() @IsNumber() descuento?: number;
  @IsOptional() @IsNumber() impuestos?: number;
  @IsOptional() @IsString() notas?: string;
}
