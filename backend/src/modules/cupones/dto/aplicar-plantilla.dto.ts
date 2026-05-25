import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

const PLANTILLAS = [
  'bienvenida_vip',
  'reactivacion_urgente',
  'cumpleanios',
  'recompra_inteligente',
  'flash_sale',
] as const;

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class AplicarPlantillaDto {
  @IsEnum(PLANTILLAS, { message: 'Plantilla desconocida' })
  plantilla!: (typeof PLANTILLAS)[number];

  @IsOptional() @Transform(upper) @IsString() @Length(3, 40)
  codigo?: string;

  @IsOptional() @IsDateString()
  fechaInicio?: string;

  @IsOptional() @IsDateString()
  fechaFin?: string;
}
