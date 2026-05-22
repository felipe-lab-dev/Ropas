import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class AgregarVarianteDto {
  @IsString() @IsNotEmpty() talla!: string;
  @IsString() @IsNotEmpty() color!: string;
  @IsOptional() @IsString() colorHex?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() codigoBarras?: string;
  @IsOptional() @IsNumber() precioVenta?: number;
  @IsOptional() @IsNumber() pesoGramos?: number;
  @IsOptional() @IsNumber() @Min(0) stockInicial?: number;
  @IsOptional() @IsUUID() sucursalId?: string;
}

export class ActualizarVarianteDto {
  @IsOptional() @IsString() talla?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() colorHex?: string;
  @IsOptional() @IsString() codigoBarras?: string;
  @IsOptional() @IsNumber() precioVenta?: number;
  @IsOptional() @IsNumber() pesoGramos?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
