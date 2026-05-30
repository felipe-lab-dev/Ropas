import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MedioPago } from '@prisma/client';

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

  /**
   * Medio por el que se devuelve el dinero al cliente.
   * `null` / ausente = sin devolución de dinero (nota a favor o solo restitución de stock).
   * `'efectivo'` = crea un MovimientoCaja egreso 'devolucion_cliente' en la sesión actual.
   * Otros medios (tarjeta, transferencia, etc.) se guardan en el registro pero no generan
   * movimiento de caja automático (el dinero no sale del cajón).
   */
  @IsOptional() @IsEnum(MedioPago) medioDevolucion?: MedioPago | null;

  /** ID de la sesión de caja abierta. OBLIGATORIO para vincular la NC al turno actual. */
  @IsOptional() @IsUUID() sesionCajaId?: string;
}
