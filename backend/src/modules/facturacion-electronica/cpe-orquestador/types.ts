/**
 * Tipos del CpeOrquestadorService.
 *
 * El orquestador recibe la venta en formato DOMINIO (precio con IGV, cantidad,
 * tipoAfectacion) y delega el cálculo a CpeCalculadoraService y la serialización
 * a CpeBuilderService.
 */
import type { Decimal } from '@prisma/client/runtime/library';
import type { TipoAfectacionIgv, TipoCpe } from 'src/core/sunat/codigos';
import type {
  DatoAdicionalInput,
  DocReferenciadoInput,
  EmisorInput,
  MifactOpciones,
  ReceptorInput,
} from '../cpe-builder/types';

export interface ItemDominioInput {
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  precioUnitarioConIgv: Decimal | number | string;
  tipoAfectacionIgv: TipoAfectacionIgv;
}

export interface VentaDominioInput {
  tipoCpe: TipoCpe;
  serie: string;
  correlativo: string | number;
  fechaEmision: Date | string;
  moneda: string;
  tipoCambio?: Decimal | number | string;
  correoCliente?: string;
  codigoPuntoVenta?: string;
  codigoTipoOperacionSunat?: string;
  placa?: string;
  items: ItemDominioInput[];
  datosAdicionales?: DatoAdicionalInput[];
  /** Código tipo NC SUNAT catálogo 09. Presente solo en nota de crédito. */
  codigoTipoNc?: string;
  /** Código tipo ND SUNAT catálogo 10. Presente solo en nota de débito. */
  codigoTipoNd?: string;
  /** Descripción libre del motivo. Presente solo en NC/ND. */
  descripcionMotivo?: string;
  /** Documentos referenciados (CPE original). Presente solo en NC/ND. */
  docsReferenciado?: DocReferenciadoInput[];
  /** Descuento global a nivel cabecera (antes del IGV). Afecta montoTotalGravado, IGV y total. */
  descuentoGlobal?: Decimal | number | string;
  /** Código tipo de descuento SUNAT (ej. '02' = descuento global). */
  codigoTipoDescuento?: string;
}

export interface OrquestarCpeInput {
  token: string;
  emisor: EmisorInput;
  receptor: ReceptorInput;
  venta: VentaDominioInput;
  opciones?: MifactOpciones;
}
