import { Injectable } from '@nestjs/common';
import { Prisma, TipoOperacionSunat } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorConflicto, ErrorValidacion } from '../../core/errors/errores';
import { CUENTAS, cuentaMedioPago } from './plan-cuentas.seed';

const D = (n: Prisma.Decimal | number | string): number =>
  typeof n === 'number' ? n : Number(n.toString());

interface DetalleAsiento {
  cuentaCodigo: string;
  glosa?: string;
  debe?: number;
  haber?: number;
  documentoTipo?: string;
  documentoNumero?: string;
}

interface CrearAsientoParams {
  fecha: Date;
  glosa: string;
  tipoOperacion: TipoOperacionSunat;
  origenTipo?: string;
  origenId?: string;
  detalles: DetalleAsiento[];
  usuarioId: string;
  moneda?: string;
  tipoCambio?: number;
}

@Injectable()
export class AsientosService {
  constructor(private readonly prisma: PrismaTenantService) {}

  /** Crea un asiento dentro de una transacción ya abierta. */
  async crearEnTx(tx: Prisma.TransactionClient, params: CrearAsientoParams) {
    const detalles = params.detalles
      .map((d, i) => ({
        cuentaCodigo: d.cuentaCodigo,
        glosa: d.glosa,
        debe: round2(d.debe ?? 0),
        haber: round2(d.haber ?? 0),
        documentoTipo: d.documentoTipo,
        documentoNumero: d.documentoNumero,
        orden: i,
      }))
      .filter(d => d.debe > 0 || d.haber > 0);

    const totalDebe = detalles.reduce((s, d) => s + d.debe, 0);
    const totalHaber = detalles.reduce((s, d) => s + d.haber, 0);
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      throw new ErrorValidacion(
        `Asiento descuadrado: Debe ${totalDebe.toFixed(2)} ≠ Haber ${totalHaber.toFixed(2)}`,
      );
    }
    if (detalles.length < 2) {
      throw new ErrorValidacion('Asiento debe tener al menos dos detalles');
    }

    const periodo = await this.obtenerOCrearPeriodo(tx, params.fecha);
    if (periodo.estado === 'cerrado') {
      throw new ErrorConflicto(
        `Período ${periodo.anio}-${String(periodo.mes).padStart(2, '0')} cerrado; no admite asientos`,
      );
    }

    const numero = await this.siguienteNumero(tx, periodo.anio, periodo.mes);

    return tx.asientoContable.create({
      data: {
        numero,
        periodoId: periodo.id,
        fecha: params.fecha,
        glosa: params.glosa,
        tipoOperacion: params.tipoOperacion,
        origenTipo: params.origenTipo,
        origenId: params.origenId,
        totalDebe: round2(totalDebe),
        totalHaber: round2(totalHaber),
        moneda: params.moneda ?? 'PEN',
        tipoCambio: params.tipoCambio ?? 1,
        usuarioId: params.usuarioId,
        detalles: { create: detalles },
      },
      include: { detalles: true },
    });
  }

  async crear(params: CrearAsientoParams, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(tx => this.crearEnTx(tx, params));
  }

  async reversar(asientoId: string, motivo: string, ctx: TenantContext, usuarioId: string) {
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => {
      const original = await tx.asientoContable.findUnique({
        where: { id: asientoId },
        include: { detalles: true },
      });
      if (!original) throw new ErrorValidacion('Asiento no existe');
      if (original.estado !== 'asentado') {
        throw new ErrorConflicto('Solo se pueden reversar asientos asentados');
      }
      const detallesEspejo: DetalleAsiento[] = original.detalles.map(d => ({
        cuentaCodigo: d.cuentaCodigo,
        glosa: d.glosa ?? undefined,
        debe: D(d.haber),
        haber: D(d.debe),
        documentoTipo: d.documentoTipo ?? undefined,
        documentoNumero: d.documentoNumero ?? undefined,
      }));
      const reversa = await this.crearEnTx(tx, {
        fecha: new Date(),
        glosa: `Reversión ${original.numero}: ${motivo}`,
        tipoOperacion: original.tipoOperacion,
        origenTipo: original.origenTipo ?? undefined,
        origenId: original.origenId ?? undefined,
        detalles: detallesEspejo,
        usuarioId,
      });
      await tx.asientoContable.update({
        where: { id: asientoId },
        data: { estado: 'revertido' },
      });
      await tx.asientoContable.update({
        where: { id: reversa.id },
        data: { reversaDeId: asientoId },
      });
      return reversa;
    });
  }

  // ─── Generadores automáticos ───────────────────────────────────────

  /**
   * Asiento de venta: reconoce ingreso e IGV.
   * Si la venta cobró parte/todo, agrega caja/banco; el resto a cuentas por cobrar.
   *
   * Debe  10/12   total
   * Haber 70      base
   * Haber 40.111  IGV
   */
  async generarPorVenta(
    tx: Prisma.TransactionClient,
    params: {
      ventaId: string;
      numero: string;
      fecha: Date;
      total: number;
      cobrado: number;
      medioPrincipal?: string;
      documentoTipo?: string;
      documentoNumero?: string;
      clienteDoc?: { tipo: string; numero: string };
      usuarioId: string;
    },
  ) {
    const total = round2(params.total);
    const cobrado = round2(Math.min(params.cobrado, total));
    const porCobrar = round2(total - cobrado);
    const base = round2(total / 1.18);
    const igv = round2(total - base);

    const detalles: DetalleAsiento[] = [];
    if (cobrado > 0) {
      detalles.push({
        cuentaCodigo: cuentaMedioPago(params.medioPrincipal ?? 'efectivo'),
        glosa: `Cobro venta ${params.numero}`,
        debe: cobrado,
        documentoTipo: params.documentoTipo,
        documentoNumero: params.documentoNumero,
      });
    }
    if (porCobrar > 0) {
      detalles.push({
        cuentaCodigo: CUENTAS.cxcClientes,
        glosa: `Cuenta por cobrar venta ${params.numero}`,
        debe: porCobrar,
        documentoTipo: params.clienteDoc?.tipo,
        documentoNumero: params.clienteDoc?.numero,
      });
    }
    detalles.push({
      cuentaCodigo: CUENTAS.ventasMercaderias,
      glosa: `Venta ${params.numero}`,
      haber: base,
    });
    if (igv > 0) {
      detalles.push({
        cuentaCodigo: CUENTAS.igvCuentaPropia,
        glosa: `IGV venta ${params.numero}`,
        haber: igv,
      });
    }

    return this.crearEnTx(tx, {
      fecha: params.fecha,
      glosa: `Venta ${params.numero}`,
      tipoOperacion: 'venta_gravada',
      origenTipo: 'venta',
      origenId: params.ventaId,
      detalles,
      usuarioId: params.usuarioId,
    });
  }

  /**
   * Asiento de compra: reconoce gasto por compra, IGV crédito fiscal,
   * y obligación con proveedor (o salida de caja si contado).
   * Genera además el asiento de destino al activo (existencias).
   *
   * Asiento 1 — registro de la compra:
   *   Debe  60.11   base
   *   Debe  40.111  IGV
   *   Haber 42.12   total            (si crédito)
   *   Haber 10.11   total            (si contado)
   *
   * Asiento 2 — destino al activo:
   *   Debe  20.11   base
   *   Haber 61.11   base
   */
  async generarPorCompra(
    tx: Prisma.TransactionClient,
    params: {
      compraId: string;
      numero: string;
      fecha: Date;
      subtotal: number;
      igv: number;
      total: number;
      esContado: boolean;
      medioPago?: string;
      proveedorDoc: { tipo: string; numero: string };
      docTipo: string;
      docNumero: string;
      moneda?: string;
      tipoCambio?: number;
      usuarioId: string;
    },
  ) {
    const base = round2(params.subtotal);
    const total = round2(params.total);
    // Derivamos el IGV del total para que el asiento cuadre por construcción
    // (base + igv = total), evitando descuadres de 0.01 al convertir montos a PEN.
    const igv = round2(total - base);

    const detallesCompra: DetalleAsiento[] = [
      {
        cuentaCodigo: CUENTAS.comprasMercaderias,
        glosa: `Compra ${params.numero}`,
        debe: base,
        documentoTipo: params.docTipo,
        documentoNumero: params.docNumero,
      },
    ];
    if (igv > 0) {
      detallesCompra.push({
        cuentaCodigo: CUENTAS.igvCuentaPropia,
        glosa: `IGV crédito fiscal ${params.numero}`,
        debe: igv,
      });
    }
    detallesCompra.push(
      params.esContado
        ? {
            cuentaCodigo: cuentaMedioPago(params.medioPago ?? 'efectivo'),
            glosa: `Pago contado ${params.numero}`,
            haber: total,
          }
        : {
            cuentaCodigo: CUENTAS.cxpProveedores,
            glosa: `Cuenta por pagar ${params.numero}`,
            haber: total,
            documentoTipo: params.proveedorDoc.tipo,
            documentoNumero: params.proveedorDoc.numero,
          },
    );

    const asientoCompra = await this.crearEnTx(tx, {
      fecha: params.fecha,
      glosa: `Compra ${params.numero}`,
      tipoOperacion: 'compra_gravada',
      origenTipo: 'compra',
      origenId: params.compraId,
      detalles: detallesCompra,
      moneda: params.moneda,
      tipoCambio: params.tipoCambio,
      usuarioId: params.usuarioId,
    });

    // Asiento de destino al activo (existencias)
    if (base > 0) {
      await this.crearEnTx(tx, {
        fecha: params.fecha,
        glosa: `Destino existencias compra ${params.numero}`,
        tipoOperacion: 'compra_gravada',
        origenTipo: 'compra_destino',
        origenId: params.compraId,
        detalles: [
          { cuentaCodigo: CUENTAS.mercaderias, glosa: 'Ingreso a mercaderías', debe: base },
          { cuentaCodigo: CUENTAS.variacionExistencias, glosa: 'Variación existencias', haber: base },
        ],
        moneda: params.moneda,
        tipoCambio: params.tipoCambio,
        usuarioId: params.usuarioId,
      });
    }

    return asientoCompra;
  }

  /**
   * Pago a proveedor (cancelación CxP).
   *   Debe  42.12  monto
   *   Haber 10/104 monto
   */
  async generarPorPagoCompra(
    tx: Prisma.TransactionClient,
    params: {
      pagoId: string;
      compraNumero: string;
      fecha: Date;
      monto: number;
      medio: string;
      proveedorDoc: { tipo: string; numero: string };
      moneda?: string;
      tipoCambio?: number;
      usuarioId: string;
    },
  ) {
    const monto = round2(params.monto);
    return this.crearEnTx(tx, {
      fecha: params.fecha,
      glosa: `Pago compra ${params.compraNumero}`,
      tipoOperacion: 'pago_proveedor',
      origenTipo: 'pago_compra',
      origenId: params.pagoId,
      detalles: [
        {
          cuentaCodigo: CUENTAS.cxpProveedores,
          glosa: `Cancelación parcial/total ${params.compraNumero}`,
          debe: monto,
          documentoTipo: params.proveedorDoc.tipo,
          documentoNumero: params.proveedorDoc.numero,
        },
        {
          cuentaCodigo: cuentaMedioPago(params.medio),
          glosa: `Pago ${params.medio}`,
          haber: monto,
        },
      ],
      moneda: params.moneda,
      tipoCambio: params.tipoCambio,
      usuarioId: params.usuarioId,
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private async obtenerOCrearPeriodo(tx: Prisma.TransactionClient, fecha: Date) {
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const existente = await tx.periodoContable.findUnique({ where: { anio_mes: { anio, mes } } });
    if (existente) return existente;
    return tx.periodoContable.create({ data: { anio, mes } });
  }

  private async siguienteNumero(
    tx: Prisma.TransactionClient,
    anio: number,
    mes: number,
  ): Promise<string> {
    const prefijo = `${anio}-${String(mes).padStart(2, '0')}-`;
    const ultimo = await tx.asientoContable.findFirst({
      where: { numero: { startsWith: prefijo } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const n = ultimo ? parseInt(ultimo.numero.split('-')[2]!, 10) + 1 : 1;
    return `${prefijo}${String(n).padStart(6, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
