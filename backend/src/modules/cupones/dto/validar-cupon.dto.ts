import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CarritoItemDto {
  @IsUUID() varianteId!: string;
  @IsOptional() @IsUUID() productoId?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsNumber() @Min(1) cantidad!: number;
  @IsNumber() @Min(0) precioUnitario!: number;
}

export class ValidarCuponDto {
  @Transform(upper)
  @IsString()
  @Length(3, 40)
  codigo!: string;

  @IsOptional() @IsUUID()
  clienteId?: string;

  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => CarritoItemDto)
  items!: CarritoItemDto[];
}
