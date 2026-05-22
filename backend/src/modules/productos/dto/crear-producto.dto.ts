import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearVarianteDto {
  @IsString() @IsNotEmpty() talla!: string;
  @IsString() @IsNotEmpty() color!: string;
  @IsOptional() @IsString() colorHex?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() codigoBarras?: string;
  @IsOptional() @IsNumber() precioVenta?: number;
  @IsOptional() @IsNumber() pesoGramos?: number;
  @IsOptional() @IsNumber() @Min(0) stockInicial?: number;
  /** Sucursal donde se carga el stock inicial. Si no viene, se usa la sucursal principal. */
  @IsOptional() @IsUUID() sucursalId?: string;
}

export class CrearProductoDto {
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() codigo?: string;
  @IsString() @IsNotEmpty() nombre!: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsUUID() categoriaId!: string;
  @IsOptional() @IsUUID() marcaId?: string;
  @IsOptional() @IsEnum(['hombre', 'mujer', 'ninio', 'ninia', 'unisex'] as const) genero?: string;
  @IsOptional() @IsEnum(['primavera', 'verano', 'otonio', 'invierno', 'todo_el_anio'] as const) temporada?: string;
  @IsOptional() @IsString() material?: string;
  @IsOptional() @IsString() cuidado?: string;
  @IsNumber() precioVenta!: number;
  @IsOptional() @IsNumber() precioCompra?: number;
  @IsOptional() @IsArray() imagenes?: string[];
  @IsOptional() @IsArray() tags?: string[];
  /** Sucursal por defecto para el stock inicial de variantes que no la especifiquen. */
  @IsOptional() @IsUUID() sucursalId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearVarianteDto)
  variantes!: CrearVarianteDto[];
}
