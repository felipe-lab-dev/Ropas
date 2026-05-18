import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const TIPO_COMP = [
  'factura', 'boleta', 'nota_ingreso', 'guia_remision', 'recibo_honorarios', 'otro',
] as const;
const CONDICION = ['contado', 'credito_15', 'credito_30', 'credito_60', 'credito_otro'] as const;
const MEDIO = ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'pix', 'transferencia', 'yape', 'plin', 'otro'] as const;

export class CrearCompraItemDto {
  @IsUUID() varianteId!: string;
  @IsNumber() @Min(1) cantidad!: number;
  @IsNumber() @Min(0) costoUnitario!: number;
  @IsOptional() @IsNumber() descuento?: number;
}

export class CrearCompraDto {
  @IsUUID() proveedorId!: string;
  @IsUUID() sucursalId!: string;

  @IsEnum(TIPO_COMP) tipoComprobante!: (typeof TIPO_COMP)[number];
  @IsString() serie!: string;
  @IsString() numeroComprobante!: string;
  @IsDateString() fechaEmision!: string;
  @IsOptional() @IsDateString() fechaRecepcion?: string;

  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => CrearCompraItemDto)
  items!: CrearCompraItemDto[];

  @IsOptional() @IsString() moneda?: string;
  @IsOptional() @IsNumber() tipoCambio?: number;
  @IsOptional() @IsNumber() descuento?: number;
  @IsOptional() @IsNumber() otrosImpuestos?: number;
  /** Si no se manda, se calcula 18% sobre subtotal. */
  @IsOptional() @IsNumber() igv?: number;

  @IsOptional() @IsEnum(CONDICION) condicionPago?: (typeof CONDICION)[number];
  @IsOptional() @IsDateString() fechaVencimiento?: string;

  /** Si se mandan pagos al crear y monto total cubre el total, queda contado pagado. */
  @IsOptional() @IsArray()
  pagos?: { medio: (typeof MEDIO)[number]; monto: number; referencia?: string; fechaPago?: string }[];

  @IsOptional() @IsString() notas?: string;
  /** Si true, crea + confirma en un solo paso (ingresa stock + asiento). */
  @IsOptional() confirmar?: boolean;
}

export class RegistrarPagoCompraDto {
  @IsEnum(MEDIO) medio!: (typeof MEDIO)[number];
  @IsNumber() @Min(0.01) monto!: number;
  @IsOptional() @IsString() referencia?: string;
  @IsOptional() @IsDateString() fechaPago?: string;
  @IsOptional() @IsUUID() sesionCajaId?: string;
  @IsOptional() @IsString() notas?: string;
}
