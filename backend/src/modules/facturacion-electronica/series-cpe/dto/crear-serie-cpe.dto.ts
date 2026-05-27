import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { TipoCpe } from '../../../../core/sunat/codigos';

const TIPOS_CPE: TipoCpe[] = [
  'factura',
  'boleta',
  'nota_credito',
  'nota_debito',
  'guia_remitente',
  'guia_transportista',
];

export class CrearSerieCpeDto {
  @IsUUID()
  sucursalId!: string;

  @IsIn(TIPOS_CPE, {
    message: `tipoCpe debe ser uno de: ${TIPOS_CPE.join(', ')}`,
  })
  tipoCpe!: TipoCpe;

  /**
   * Formato: 1 letra mayúscula + 3 dígitos. Ej: F001, B001, FA02.
   * Convención (no estricta SUNAT pero útil):
   *   factura → debe empezar con 'F'
   *   boleta  → debe empezar con 'B'
   */
  @Matches(/^[A-Z]\d{3}$/, {
    message: 'La serie debe tener el formato: 1 letra mayúscula seguida de 3 dígitos (ej: F001, B002)',
  })
  serie!: string;

  /**
   * Correlativo inicial. Útil cuando se migra desde otro sistema
   * y se quiere continuar la numeración. Default: 0.
   */
  @IsOptional()
  @IsInt({ message: 'correlativoInicial debe ser un número entero' })
  @Min(0, { message: 'correlativoInicial no puede ser negativo' })
  correlativoInicial?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
