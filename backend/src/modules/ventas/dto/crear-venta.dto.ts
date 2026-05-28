import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
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
  @IsInt() @Min(1) cantidad!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) precioUnitario?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) descuento?: number;
}

export class CrearVentaPagoDto {
  @IsEnum(['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'pix', 'transferencia', 'yape', 'plin', 'otro'] as const)
  medio!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) monto!: number;
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

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) descuento?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) impuestos?: number;
  @IsOptional() @IsString() notas?: string;

  /** Código del cupón a aplicar (case-insensitive). El backend valida y calcula el descuento. */
  @IsOptional() @IsString() codigoCupon?: string;

  /**
   * Si true, la venta se registra como "nota de venta" interna: NO se asigna
   * serie/correlativo SUNAT, NO se emite CPE, NO se envía a Mifact. Útil para
   * ventas que el comerciante quiere mantener fuera de facturación electrónica.
   * Default false → flujo normal (boleta/factura según cliente).
   */
  @IsOptional() @IsBoolean() esNotaDeVenta?: boolean;
}
