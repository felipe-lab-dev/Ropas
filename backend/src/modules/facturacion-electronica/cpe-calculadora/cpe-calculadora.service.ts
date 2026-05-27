/**
 * CpeCalculadoraService — deriva todos los montos SUNAT a partir de
 * los datos crudos de la venta (precio CON IGV incluido, cantidad, tipo afectación).
 *
 * Responsabilidad ÚNICA: aritmética de IGV según reglas SUNAT.
 * No accede a la DB, no hace HTTP, no formatea strings para Mifact.
 * Su salida es consumida por CpeBuilderService.
 *
 * Aritmética: Decimal.js (vía @prisma/client/runtime/library).
 * Redondeo: ROUND_HALF_EVEN (Banker's rounding — default de Decimal.js).
 * Cada monto monetario final se redondea a 2 decimales con .toDP(2).
 * Los intermedios (precioSinIgv) se redondean también a 2dp para evitar
 * propagación de error: valorVentaItem = precioSinIgvRedondeado × cantidad.
 */
import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TipoAfectacionIgv } from 'src/core/sunat/codigos';
import {
  ItemCalculado,
  ItemParaCalcular,
  VentaCalculada,
  VentaParaCalcular,
} from './types';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Divisor para extraer precio sin IGV de un precio con IGV (18%) */
const IGV_DECIMAL = new Decimal('1.18');

/** Porcentaje numérico para items gravados */
const IGV_PORCENTAJE = 18;

/** Zero Decimal reutilizable */
const CERO = new Decimal('0');

// ─── Helpers de clasificación de afectación ───────────────────────────────────

function esGravado(tipo: TipoAfectacionIgv): boolean {
  return tipo.startsWith('gravado_');
}

function esExonerado(tipo: TipoAfectacionIgv): boolean {
  return tipo.startsWith('exonerado_');
}

function esInafectoOExportacion(tipo: TipoAfectacionIgv): boolean {
  return tipo.startsWith('inafecto_') || tipo === 'exportacion';
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class CpeCalculadoraService {
  /**
   * Calcula todos los montos derivados para una venta completa.
   * Entrada: precios CON IGV tal como se registran en el dominio.
   * Salida: VentaCalculada con items calculados + totales por categoría.
   *
   * Si se pasa `descuentoGlobal`, se resta de la base gravada y el IGV total
   * se recalcula sobre la base neta (gravado − descuentoGlobal) * 0.18.
   * Los items individuales no se modifican: solo cambian los totales de cabecera.
   */
  calcular(venta: VentaParaCalcular): VentaCalculada {
    const itemsCalculados = venta.items.map((item) =>
      this.calcularItem(item),
    );

    const totalesBase = this.sumarTotales(itemsCalculados);

    if (venta.descuentoGlobal === undefined) {
      return totalesBase;
    }

    // Aplicar descuento global sobre la base gravada
    const descuento = new Decimal(venta.descuentoGlobal.toString()).toDP(2);
    const gravadoNeto = totalesBase.montoTotalGravado.minus(descuento).toDP(2);
    const igvNeto = gravadoNeto.mul(new Decimal('0.18')).toDP(2);
    const totalNeto = gravadoNeto
      .plus(igvNeto)
      .plus(totalesBase.montoTotalExonerado)
      .plus(totalesBase.montoTotalInafecto)
      .toDP(2);

    return {
      ...totalesBase,
      montoTotalGravado: gravadoNeto,
      montoTotalIgv: igvNeto,
      montoTotal: totalNeto,
      descuentoGlobal: descuento,
    };
  }

  // ─── Cálculo de ítem ────────────────────────────────────────────────────────

  private calcularItem(item: ItemParaCalcular): ItemCalculado {
    const cantidad = new Decimal(item.cantidad);
    const precioConIgv = new Decimal(item.precioUnitarioConIgv.toString());
    const tipo = item.tipoAfectacionIgv;

    const porcentajeIgv = esGravado(tipo) ? IGV_PORCENTAJE : 0;

    // precioSinIgv: si gravado → dividir por 1.18; si no → mismo precio.
    // Se redondea a 2dp AQUÍ para que valorVentaItem sea consistente.
    const precioSinIgv = esGravado(tipo)
      ? precioConIgv.div(IGV_DECIMAL).toDP(2)
      : precioConIgv.toDP(2);

    // valorVentaItem = precioSinIgv (ya redondeado) × cantidad → redondear a 2dp
    const valorVentaItem = precioSinIgv.mul(cantidad).toDP(2);

    // montoPrecioVentaItem = precioConIgv × cantidad → redondear a 2dp
    const montoPrecioVentaItem = precioConIgv.mul(cantidad).toDP(2);

    // montoIgvItem = montoPrecioVentaItem − valorVentaItem → redondear a 2dp
    const montoIgvItem = montoPrecioVentaItem.minus(valorVentaItem).toDP(2);

    return {
      codigo: item.codigo,
      descripcion: item.descripcion,
      unidadMedida: item.unidadMedida,
      cantidad: item.cantidad,
      precioUnitarioConIgv: precioConIgv,
      precioSinIgv,
      valorVentaItem,
      montoPrecioVentaItem,
      montoIgvItem,
      porcentajeIgv,
      tipoAfectacionIgv: tipo,
    };
  }

  // ─── Suma de totales por categoría ──────────────────────────────────────────

  private sumarTotales(items: ItemCalculado[]): VentaCalculada {
    let montoTotalGravado = CERO;
    let montoTotalExonerado = CERO;
    let montoTotalInafecto = CERO;
    let montoTotalIgv = CERO;
    let montoTotal = CERO;

    for (const item of items) {
      const tipo = item.tipoAfectacionIgv;

      if (esGravado(tipo)) {
        montoTotalGravado = montoTotalGravado.plus(item.valorVentaItem);
      } else if (esExonerado(tipo)) {
        montoTotalExonerado = montoTotalExonerado.plus(item.valorVentaItem);
      } else if (esInafectoOExportacion(tipo)) {
        montoTotalInafecto = montoTotalInafecto.plus(item.valorVentaItem);
      }

      montoTotalIgv = montoTotalIgv.plus(item.montoIgvItem);
      montoTotal = montoTotal.plus(item.montoPrecioVentaItem);
    }

    return {
      items,
      montoTotalGravado: montoTotalGravado.toDP(2),
      montoTotalExonerado: montoTotalExonerado.toDP(2),
      montoTotalInafecto: montoTotalInafecto.toDP(2),
      montoTotalIgv: montoTotalIgv.toDP(2),
      montoTotal: montoTotal.toDP(2),
    };
  }
}
