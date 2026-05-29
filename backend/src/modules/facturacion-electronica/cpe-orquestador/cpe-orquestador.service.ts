/**
 * CpeOrquestadorService — compone CpeCalculadoraService + CpeBuilderService.
 *
 * Punto de entrada del módulo de facturación: recibe la venta en formato
 * dominio (precios CON IGV, cantidad, tipoAfectacion) y devuelve el payload
 * JSON listo para enviar a Mifact. No hace HTTP ni accede a DB.
 */
import { Injectable } from '@nestjs/common';
import { CpeBuilderService } from '../cpe-builder/cpe-builder.service';
import type {
  ConstruirCpeInput,
  MifactCpePayload,
  VentaItemInput,
} from '../cpe-builder/types';
import { CpeCalculadoraService } from '../cpe-calculadora/cpe-calculadora.service';
import type { ItemCalculado } from '../cpe-calculadora/types';
import type { OrquestarCpeInput } from './types';

@Injectable()
export class CpeOrquestadorService {
  constructor(
    private readonly calculadora: CpeCalculadoraService,
    private readonly builder: CpeBuilderService,
  ) {}

  /** @deprecated Usa construirCpe — este alias se mantiene por retrocompatibilidad */
  construirFactura(input: OrquestarCpeInput): MifactCpePayload {
    return this.construirCpe(input);
  }

  construirCpe(input: OrquestarCpeInput): MifactCpePayload {
    const ventaCalculada = this.calculadora.calcular({
      items: input.venta.items.map((i) => ({
        codigo: i.codigo,
        descripcion: i.descripcion,
        unidadMedida: i.unidadMedida,
        cantidad: i.cantidad,
        precioUnitarioConIgv: i.precioUnitarioConIgv,
        tipoAfectacionIgv: i.tipoAfectacionIgv,
      })),
      descuentoGlobal: input.venta.descuentoGlobal,
    });

    const construirCpeInput: ConstruirCpeInput = {
      token: input.token,
      emisor: input.emisor,
      receptor: input.receptor,
      venta: {
        tipoCpe: input.venta.tipoCpe,
        serie: input.venta.serie,
        correlativo: input.venta.correlativo,
        fechaEmision: input.venta.fechaEmision,
        moneda: input.venta.moneda,
        tipoCambio: input.venta.tipoCambio?.toString(),
        correoCliente: input.venta.correoCliente,
        codigoPuntoVenta: input.venta.codigoPuntoVenta,
        codigoTipoOperacionSunat: input.venta.codigoTipoOperacionSunat,
        placa: input.venta.placa,
        montoTotalGravado: ventaCalculada.montoTotalGravado.toFixed(2),
        montoTotalIgv: ventaCalculada.montoTotalIgv.toFixed(2),
        montoTotal: ventaCalculada.montoTotal.toFixed(2),
        items: ventaCalculada.items.map((c) => this.itemCalculadoAInput(c)),
        datosAdicionales: input.venta.datosAdicionales,
        // Campos NC: pasados directamente sin cálculo
        codigoTipoNc: input.venta.codigoTipoNc,
        // Campos ND: pasados directamente sin cálculo
        codigoTipoNd: input.venta.codigoTipoNd,
        descripcionMotivo: input.venta.descripcionMotivo,
        docsReferenciado: input.venta.docsReferenciado,
        // Descuento global: el valor calculado (redondeado) del servicio
        descuentoGlobal: ventaCalculada.descuentoGlobal?.toFixed(2),
        codigoTipoDescuento: input.venta.codigoTipoDescuento,
      },
      opciones: input.opciones,
    };

    return this.builder.construirCpe(construirCpeInput);
  }

  private itemCalculadoAInput(c: ItemCalculado): VentaItemInput {
    return {
      codigo: c.codigo,
      descripcion: c.descripcion,
      unidadMedida: c.unidadMedida,
      cantidad: c.cantidad,
      precioSinIgv: c.precioSinIgv.toFixed(2),
      precioConIgv: c.precioUnitarioConIgv.toFixed(2),
      valorVentaItem: c.valorVentaItem.toFixed(2),
      montoPrecioVentaItem: c.montoPrecioVentaItem.toFixed(2),
      montoIgvItem: c.montoIgvItem.toFixed(2),
      porcentajeIgv: c.porcentajeIgv,
      tipoAfectacionIgv: c.tipoAfectacionIgv,
    };
  }
}
