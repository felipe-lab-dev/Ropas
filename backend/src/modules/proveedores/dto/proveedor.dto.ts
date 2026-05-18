import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

const TIPO_DOC = ['dni', 'ruc', 'cpf', 'cnpj', 'pasaporte', 'otro'] as const;
const CONDICION = ['contado', 'credito_15', 'credito_30', 'credito_60', 'credito_otro'] as const;

export class CrearProveedorDto {
  @IsEnum(TIPO_DOC) tipoDocumento!: (typeof TIPO_DOC)[number];
  @IsString() @Length(1, 20) documento!: string;
  @IsString() @Length(1, 200) razonSocial!: string;
  @IsOptional() @IsString() nombreComercial?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() ciudad?: string;
  @IsOptional() @IsEnum(CONDICION) condicionPago?: (typeof CONDICION)[number];
  @IsOptional() @IsInt() @Min(0) diasCredito?: number;
  @IsOptional() @IsString() cuentaBancaria?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsArray() tags?: string[];
}

export class ActualizarProveedorDto {
  @IsOptional() @IsEnum(TIPO_DOC) tipoDocumento?: (typeof TIPO_DOC)[number];
  @IsOptional() @IsString() documento?: string;
  @IsOptional() @IsString() razonSocial?: string;
  @IsOptional() @IsString() nombreComercial?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() ciudad?: string;
  @IsOptional() @IsEnum(CONDICION) condicionPago?: (typeof CONDICION)[number];
  @IsOptional() @IsInt() @Min(0) diasCredito?: number;
  @IsOptional() @IsString() cuentaBancaria?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsArray() tags?: string[];
}
