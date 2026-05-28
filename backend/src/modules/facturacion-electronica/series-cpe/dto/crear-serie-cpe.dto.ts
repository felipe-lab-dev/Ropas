import {
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

/**
 * Subtipos válidos para `aplicaA`. Solo aplica a NC y ND (que pueden referenciar
 * factura o boleta). Para otros `tipoCpe`, `aplicaA` debe ser null.
 */
const APLICA_A_VALIDOS: TipoCpe[] = ['factura', 'boleta'];

export class CrearSerieCpeDto {
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @IsIn(TIPOS_CPE, {
    message: `tipoCpe debe ser uno de: ${TIPOS_CPE.join(', ')}`,
  })
  tipoCpe!: TipoCpe;

  /**
   * Subtipo cuando `tipoCpe` es transversal (nota_credito, nota_debito).
   * Obligatorio si tipoCpe es nota_credito o nota_debito; debe ser null
   * para los demás tipos. La coherencia se valida en el service.
   *
   * Valores permitidos: 'factura' | 'boleta' (o null/undefined).
   */
  @IsOptional()
  @IsIn(APLICA_A_VALIDOS, {
    message: `aplicaA debe ser uno de: ${APLICA_A_VALIDOS.join(', ')} (o null)`,
  })
  aplicaA?: TipoCpe | null;

  /**
   * Formato: 1 letra mayúscula + 3 dígitos. Ej: F001, B001.
   * Convención (validada en service):
   *   factura                      → debe empezar con 'F'
   *   boleta                       → debe empezar con 'B'
   *   nota_credito + aplicaA=factura → debe empezar con 'F' (referencia facturas)
   *   nota_credito + aplicaA=boleta  → debe empezar con 'B' (referencia boletas)
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
}
