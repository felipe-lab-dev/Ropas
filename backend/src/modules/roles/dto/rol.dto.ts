import { IsArray, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

export class CrearRolDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'El nombre del rol debe tener entre 2 y 80 caracteres' })
  nombre!: string;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 240)
  descripcion?: string | null;

  @IsArray()
  @IsString({ each: true })
  permisos!: string[];
}

export class ActualizarRolDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80)
  nombre?: string;

  @IsOptional() @Transform(trimToNull) @IsString() @Length(0, 240)
  descripcion?: string | null;

  @IsOptional() @IsArray() @IsString({ each: true })
  permisos?: string[];
}
