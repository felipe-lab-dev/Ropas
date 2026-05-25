import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
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

export class ActualizarClienteDto {
  @IsOptional() @IsEnum(TIPO_DOC)
  tipoDocumento?: (typeof TIPO_DOC)[number];

  @IsOptional() @Transform(digits) @IsString() @Length(0, 20)
  documento?: string | null;

  @IsOptional() @Transform(trim) @IsString() @Length(2, 160)
  nombre?: string;

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
