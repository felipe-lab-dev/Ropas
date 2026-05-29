import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

export class GuardarConfiguracionFacturacionDto {
  @Transform(trim)
  @IsString()
  @Matches(/^\d{11}$/, { message: 'RUC debe tener 11 dígitos' })
  ruc!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Razón social requerida' })
  @MaxLength(200)
  razonSocial!: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200)
  nombreComercial?: string | null;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Dirección fiscal requerida' })
  @MaxLength(240)
  direccionFiscal!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'UBIGEO debe tener 6 dígitos' })
  ubigeoFiscalCodigo!: string;

  /** Si viene vacío o no viene → mantener el token existente */
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  mifactToken?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsUrl({}, { message: 'URL de Mifact inválida' })
  mifactBaseUrl?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^(001|002|004)$/, { message: 'Formato debe ser 001 (A4), 002 (A5) o 004 (Ticket 80mm)' })
  formatoImpresion?: string;
}
