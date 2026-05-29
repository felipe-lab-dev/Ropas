/**
 * Tipos de dominio para CpeCalculadoraService.
 * Representa la información de venta tal como vive en el dominio
 * (precio CON IGV incluido) antes del cálculo hacia el formato Mifact.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { TipoAfectacionIgv } from 'src/core/sunat/codigos';

// ─── Entrada ──────────────────────────────────────────────────────────────────

export interface ItemParaCalcular {
  /** Código interno del producto/variante */
  codigo: string;
  descripcion: string;
  /** Código unidad de medida SUNAT (ej. 'NIU') */
  unidadMedida: string;
  cantidad: number;
  /** Precio unitario que paga el cliente — CON IGV incluido */
  precioUnitarioConIgv: Decimal | number | string;
  tipoAfectacionIgv: TipoAfectacionIgv;
}

export interface VentaParaCalcular {
  items: ItemParaCalcular[];
  /**
   * Descuento global a nivel de cabecera (antes del IGV).
   * Se resta de la base gravada para recalcular MNT_TOT_TRIB_IGV y MNT_TOT.
   * Los items individuales NO se modifican; solo cambian los totales de cabecera.
   */
  descuentoGlobal?: Decimal | number | string;
}

// ─── Salida ───────────────────────────────────────────────────────────────────

export interface ItemCalculado {
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  /** Precio unitario con IGV (input normalizado a Decimal) */
  precioUnitarioConIgv: Decimal;
  /** Precio unitario sin IGV (puede tener hasta 6 decimales internos; se redondea a 2) */
  precioSinIgv: Decimal;
  /** valorVentaItem = precioSinIgv × cantidad — sin IGV — redondeado a 2 decimales */
  valorVentaItem: Decimal;
  /** montoPrecioVentaItem = precioUnitarioConIgv × cantidad — con IGV — redondeado a 2 decimales */
  montoPrecioVentaItem: Decimal;
  /** montoIgvItem = montoPrecioVentaItem − valorVentaItem — redondeado a 2 decimales */
  montoIgvItem: Decimal;
  /** 18 si gravado, 0 si exonerado / inafecto / exportacion */
  porcentajeIgv: number;
  tipoAfectacionIgv: TipoAfectacionIgv;
}

export interface VentaCalculada {
  items: ItemCalculado[];
  /** Σ valorVentaItem donde tipoAfectacion empieza con 'gravado_', menos descuentoGlobal si aplica */
  montoTotalGravado: Decimal;
  /** Σ valorVentaItem donde tipoAfectacion empieza con 'exonerado_' */
  montoTotalExonerado: Decimal;
  /** Σ valorVentaItem donde tipoAfectacion empieza con 'inafecto_' o es 'exportacion' */
  montoTotalInafecto: Decimal;
  /** Total IGV: si hay descuentoGlobal = (montoTotalGravado) * 0.18; si no = Σ montoIgvItem */
  montoTotalIgv: Decimal;
  /** Total a pagar: montoTotalGravado + montoTotalIgv + exonerado + inafecto */
  montoTotal: Decimal;
  /** Descuento global aplicado (redondeado a 2dp). Presente solo si se ingresó. */
  descuentoGlobal?: Decimal;
}
