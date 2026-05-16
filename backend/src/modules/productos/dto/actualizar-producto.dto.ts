import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ActualizarProductoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsOptional() @IsUUID() marcaId?: string;
  @IsOptional() @IsEnum(['hombre', 'mujer', 'ninio', 'ninia', 'unisex'] as const) genero?: string;
  @IsOptional() @IsEnum(['primavera', 'verano', 'otonio', 'invierno', 'todo_el_anio'] as const) temporada?: string;
  @IsOptional() @IsString() material?: string;
  @IsOptional() @IsString() cuidado?: string;
  @IsOptional() @IsNumber() precioVenta?: number;
  @IsOptional() @IsNumber() precioCompra?: number;
  @IsOptional() @IsArray() imagenes?: string[];
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsBoolean() activo?: boolean;
}
