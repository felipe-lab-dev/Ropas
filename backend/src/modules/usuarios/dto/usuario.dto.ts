import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  return v === '' ? null : v;
};
const digitsToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.replace(/\D+/g, '');
  return v === '' ? null : v;
};

export class CrearUsuarioDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres' })
  nombre!: string;

  @Transform(lower)
  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @IsOptional()
  @Transform(digitsToNull)
  @IsString()
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string | null;

  /** Si se omite, la contraseña inicial será el DNI. */
  @IsOptional()
  @IsString()
  @Length(6, 72, { message: 'La contraseña debe tener entre 6 y 72 caracteres' })
  password?: string;

  @IsUUID(undefined, { message: 'Rol inválido' })
  rolId!: string;

  @IsOptional()
  @IsUUID()
  sucursalDefecto?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarUsuarioDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 120)
  nombre?: string;

  @IsOptional() @Transform(lower) @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional() @Transform(digitsToNull) @IsString() @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string | null;

  @IsOptional() @IsString() @Length(6, 72, { message: 'La contraseña debe tener entre 6 y 72 caracteres' })
  password?: string;

  @IsOptional() @IsUUID(undefined, { message: 'Rol inválido' })
  rolId?: string;

  @IsOptional() @IsUUID()
  sucursalDefecto?: string | null;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}

export class ResetearPasswordDto {
  /** Si se omite, se genera/usa el DNI como contraseña temporal. */
  @IsOptional() @IsString() @Length(6, 72)
  password?: string;
}
