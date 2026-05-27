import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unidadMedidaCodigo?: string;

  @IsOptional()
  @IsIn([...TIPOS_AFECTACION_IGV_VALIDOS])
  tipoAfectacionIgv?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearVarianteDto)
  variantes!: CrearVarianteDto[];
}
