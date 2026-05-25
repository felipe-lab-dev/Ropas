import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

const TIPO_DOC = ['dni', 'ruc', 'cpf', 'cnpj', 'pasaporte', 'otro'] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};
const lower = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  return v === '' ? null : v;
};
const digits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D+/g, '') : value;

export class CrearClienteDto {
  @IsEnum(TIPO_DOC, { message: 'Tipo de documento inválido' })
  tipoDocumento!: (typeof TIPO_DOC)[number];

  @IsOptional()
  @Transform(digits)
  @IsString()
  @Length(0, 20, { message: 'El documento puede tener hasta 20 caracteres' })
  @ValidateIf(o => o.tipoDocumento === 'ruc' && o.documento)
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener exactamente 11 dígitos' })
  @ValidateIf(o => o.tipoDocumento === 'dni' && o.documento)
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener exactamente 8 dígitos' })
  documento?: string | null;

  @Transform(trim)
  @IsString()
  @Length(2, 160, { message: 'El nombre debe tener entre 2 y 160 caracteres' })
  nombre!: string;

  @IsOptional() @Transform(lower) @IsEmail({}, { message: 'Email inválido' })
  email?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 40)
  telefono?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 240)
  direccion?: string | null;

  @IsOptional() @Transform(trim) @IsString() @Length(0, 120)
  ciudad?: string | null;

  @IsOptional() @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  fechaNacimiento?: string | null;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 2000)
  notas?: string | null;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}
