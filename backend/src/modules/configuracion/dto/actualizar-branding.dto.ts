import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

/**
 * Body de PUT /configuracion/branding. Todos opcionales: el service hace merge
 * defensivo (solo sobreescribe las claves provistas). `@IsOptional` permite null
 * y undefined, así que "borrar" un campo se hace mandando null.
 */
export class ActualizarBrandingDto {
  /** Contenido del SVG (texto). La validación de `<svg` ocurre en el service. */
  @IsOptional()
  @IsString()
  logoSvg?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(160)
  nombre?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200)
  subtitulo?: string | null;
}
