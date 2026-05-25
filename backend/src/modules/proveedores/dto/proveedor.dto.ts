import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

const TIPO_DOC = ['dni', 'ruc', 'cpf', 'cnpj', 'pasaporte', 'otro'] as const;
const CONDICION = ['contado', 'credito_15', 'credito_30', 'credito_60', 'credito_otro'] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const lower = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  return v === '' ? null : v;
};
const digits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D+/g, '') : value;

export class CrearProveedorDto {
  @IsEnum(TIPO_DOC, { message: 'Tipo de documento inválido' })
  tipoDocumento!: (typeof TIPO_DOC)[number];

  @Transform(digits)
  @IsString()
  @Length(1, 20, { message: 'El documento es obligatorio (máx 20 caracteres)' })
  @ValidateIf(o => o.tipoDocumento === 'ruc')
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener exactamente 11 dígitos' })
  @ValidateIf(o => o.tipoDocumento === 'dni')
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener exactamente 8 dígitos' })
  documento!: string;

  @Transform(upper)
  @IsString()
  @Length(2, 200, { message: 'La razón social debe tener entre 2 y 200 caracteres' })
  razonSocial!: string;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 160)
  nombreComercial?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 120)
  contacto?: string | null;

  @IsOptional() @Transform(lower) @IsEmail({}, { message: 'Email inválido' })
  email?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 40)
  telefono?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 240)
  direccion?: string | null;

  @IsOptional() @Transform(trim) @IsString() @Length(0, 120)
  ciudad?: string | null;

  @IsOptional() @IsEnum(CONDICION, { message: 'Condición de pago inválida' })
  condicionPago?: (typeof CONDICION)[number];

  @IsOptional() @IsInt() @Min(0) @Max(365)
  diasCredito?: number;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 60)
  cuentaBancaria?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 2000)
  notas?: string | null;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}

export class ActualizarProveedorDto {
  @IsOptional() @IsEnum(TIPO_DOC)
  tipoDocumento?: (typeof TIPO_DOC)[number];

  @IsOptional() @Transform(digits) @IsString() @Length(1, 20)
  documento?: string;

  @IsOptional() @Transform(upper) @IsString() @Length(2, 200)
  razonSocial?: string;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 160)
  nombreComercial?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 120)
  contacto?: string | null;

  @IsOptional() @Transform(lower) @IsEmail({}, { message: 'Email inválido' })
  email?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 40)
  telefono?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 240)
  direccion?: string | null;

  @IsOptional() @Transform(trim) @IsString() @Length(0, 120)
  ciudad?: string | null;

  @IsOptional() @IsEnum(CONDICION)
  condicionPago?: (typeof CONDICION)[number];

  @IsOptional() @IsInt() @Min(0) @Max(365)
  diasCredito?: number;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 60)
  cuentaBancaria?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 2000)
  notas?: string | null;

  @IsOptional() @IsBoolean()
  activo?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}
