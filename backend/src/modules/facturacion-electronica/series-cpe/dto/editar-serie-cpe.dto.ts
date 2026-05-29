import {
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Min,
  ValidateIf,
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

const APLICA_A_VALIDOS: TipoCpe[] = ['factura', 'boleta'];

/**
 * DTO de edición de una serie de comprobante.
 *
 * Todos los campos son OPCIONALES. Los que no vengan, se mantienen del existente.
 * La operación SOLO procede si la serie no tiene comprobantes emitidos (regla
 * fiscal SUNAT: una vez emitido un comprobante, la serie/correlativo es
 * inmutable). El service valida y rechaza con ErrorConflicto si hay emisiones.
 *
 * Las mismas coherencias que `crear` se validan: formato serie, tipoCpe↔aplicaA,
 * prefijo letra↔subtipo, y unicidad por (sucursal, tipoCpe, aplicaA).
 */
export class EditarSerieCpeDto {
  @IsOptional()
  @IsIn(TIPOS_CPE, {
    message: `tipoCpe debe ser uno de: ${TIPOS_CPE.join(', ')}`,
  })
  tipoCpe?: TipoCpe;

  /**
   * Pasar `null` explícito para limpiar aplicaA (ej. cambiar de NC-Factura a
   * Factura). Para mantener el valor actual, omitir el campo.
   */
  @ValidateIf((_o, v) => v !== null)
  @IsOptional()
  @IsIn(APLICA_A_VALIDOS, {
    message: `aplicaA debe ser uno de: ${APLICA_A_VALIDOS.join(', ')} (o null)`,
  })
  aplicaA?: TipoCpe | null;

  @IsOptional()
  @Matches(/^[A-Z]\d{3}$/, {
    message: 'La serie debe tener el formato: 1 letra mayúscula seguida de 3 dígitos (ej: F001, B002)',
  })
  serie?: string;

  /**
   * Permite ajustar el correlativo "punto de partida" si el usuario se equivocó
   * al migrar. Solo aplicable mientras la serie no haya emitido nada.
   */
  @IsOptional()
  @IsInt({ message: 'correlativoInicial debe ser un número entero' })
  @Min(0, { message: 'correlativoInicial no puede ser negativo' })
  correlativoInicial?: number;
}
