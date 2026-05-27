import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const TIPOS_AFECTACION_IGV_VALIDOS = [
  'gravado_onerosa',
  'gravado_retiro_premio',
  'gravado_retiro_donacion',
  'gravado_retiro',
  'gravado_retiro_publicidad',
  'gravado_bonificaciones',
  'gravado_retiro_trabajadores',
  'gravado_ivap',
  'exonerado_onerosa',
  'exonerado_transferencia_gratuita',
  'inafecto_onerosa',
  'inafecto_retiro_bonificacion',
  'inafecto_retiro',
  'inafecto_retiro_muestras',
  'inafecto_retiro_convenio',
  'inafecto_retiro_premio',
  'inafecto_retiro_publicidad',
  'inafecto_transf_gratuita_no_grav',
  'exportacion',
] as const;

export class ActualizarProductoDto {
  @IsOptional() @IsString() codigo?: string;
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

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unidadMedidaCodigo?: string;

  @IsOptional()
  @IsIn([...TIPOS_AFECTACION_IGV_VALIDOS])
  tipoAfectacionIgv?: string;
}
