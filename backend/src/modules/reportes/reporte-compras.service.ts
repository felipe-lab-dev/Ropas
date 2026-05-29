import { Injectable } from '@nestjs/common';
import { Prisma, EstadoPagoCompra } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { construirBusquedaWordSplit } from '../../core/pagination/paginacion';
import { aPEN } from '../compras/compras.moneda';
import { generarExcelCompras } from './reporte-compras-excel';
import { generarPdfCompras } from './reporte-compras-pdf';

const TOPE_COMPRAS = 10_000;

export interface FiltrosReporteCompras {
  desde?: string;
  hasta?: string;
  estadoPago?: string;
  proveedorId?: string;
  sucursalId?: string;
  buscar?: string;
}

export interface FilaCompraReporte {
  numero: string;
  fecha: string;
  comprobante: string;
  tipoComprobante: string;
  proveedor: string;
  sucursal: string;
  moneda: string;
  total: number;       // en moneda original
  totalPen: number;    // normalizado a S/
  items: number;
  estado: string;
  estadoPago: string;
}

export interface FilaProductoCompradoReporte {
  sku: string;
  nombre: string;
  unidades: number;
  costoTotal: number;  // S/
  compras: number;
}

export interface ReporteComprasDatos {
  generadoEn: string;
  tenantNombre: string;
  periodo: { desde: string | null; hasta: string | null; etiqueta: string };
  resumen: {
    cantidadCompras: number;
    cantidadAnuladas: number;
    subtotal: number;
    igv: number;
    otros: number;
    descuento: number;
    total: number;
    totalPagado: number;
    porPagar: number;
    porEstadoPago: Array<{ estadoPago: string; cantidad: number; total: number }>;
    porProveedor: Array<{ proveedor: string; cantidad: number; total: number }>;
    porSucursal: Array<{ sucursal: string; cantidad: number; total: number }>;
    porTipoComprobante: Array<{ tipo: string; cantidad: number; total: number }>;
  };
  compras: FilaCompraReporte[];
  productos: FilaProductoCompradoReporte[];
  truncado: boolean;
}

@Injectable()
export class ReporteComprasService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async datos(ctx: TenantContext, filtros: FiltrosReporteCompras): Promise<ReporteComprasDatos> {
    const cliente = this.prisma.forTenant(ctx);

    const ahora = new Date();
    const desde = filtros.desde
      ? new Date(filtros.desde)
      : new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    let hasta: Date;
    if (filtros.hasta) {
      hasta = new Date(filtros.hasta);
      hasta.setHours(23, 59, 59, 999);
    } else {
      hasta = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const where: Prisma.CompraWhereInput = {
      eliminadoEn: null,
      fechaEmision: { gte: desde, lte: hasta },
    };
    if (filtros.proveedorId) where.proveedorId = filtros.proveedorId;
    if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
    if (filtros.estadoPago) where.estadoPago = filtros.estadoPago as EstadoPagoCompra;
    const busqueda = construirBusquedaWordSplit(filtros.buscar, [
      'numero',
      'serie',
      'numeroComprobante',
      'proveedor.razonSocial',
      'proveedor.documento',
    ]);
    if (busqueda) Object.assign(where, busqueda);

    const compras = await cliente.compra.findMany({
      where,
      orderBy: { fechaEmision: 'asc' },
      take: TOPE_COMPRAS + 1,
      include: {
        proveedor: { select: { razonSocial: true } },
        sucursal: { select: { nombre: true } },
        items: {
          select: {
            cantidad: true,
            subtotal: true,
            costoUnitario: true,
            variante: { select: { producto: { select: { id: true, nombre: true, sku: true } } } },
          },
        },
      },
    });

    const truncado = compras.length > TOPE_COMPRAS;
    const lista = truncado ? compras.slice(0, TOPE_COMPRAS) : compras;
    const noAnuladas = lista.filter(c => c.estado !== 'anulada');

    let subtotal = 0, igv = 0, otros = 0, descuento = 0, total = 0, totalPagado = 0;
    const porEstadoPago = new Map<string, { cantidad: number; total: number }>();
    const porProveedor = new Map<string, { cantidad: number; total: number }>();
    const porSucursal = new Map<string, { cantidad: number; total: number }>();
    const porTipo = new Map<string, { cantidad: number; total: number }>();
    const productosMap = new Map<
      string,
      { sku: string; nombre: string; unidades: number; costoTotal: number; compras: Set<string> }
    >();

    for (const c of noAnuladas) {
      const tc = Number(c.tipoCambio);
      const totalPen = aPEN(Number(c.total), tc);
      subtotal += aPEN(Number(c.subtotal), tc);
      igv += aPEN(Number(c.igv), tc);
      otros += aPEN(Number(c.otrosImpuestos), tc);
      descuento += aPEN(Number(c.descuento), tc);
      total += totalPen;
      totalPagado += aPEN(Number(c.totalPagado), tc);

      const ep = porEstadoPago.get(c.estadoPago) ?? { cantidad: 0, total: 0 };
      ep.cantidad += 1; ep.total += totalPen;
      porEstadoPago.set(c.estadoPago, ep);

      const pv = porProveedor.get(c.proveedor.razonSocial) ?? { cantidad: 0, total: 0 };
      pv.cantidad += 1; pv.total += totalPen;
      porProveedor.set(c.proveedor.razonSocial, pv);

      const su = porSucursal.get(c.sucursal.nombre) ?? { cantidad: 0, total: 0 };
      su.cantidad += 1; su.total += totalPen;
      porSucursal.set(c.sucursal.nombre, su);

      const ti = porTipo.get(c.tipoComprobante) ?? { cantidad: 0, total: 0 };
      ti.cantidad += 1; ti.total += totalPen;
      porTipo.set(c.tipoComprobante, ti);

      for (const it of c.items) {
        const prod = it.variante.producto;
        const acc =
          productosMap.get(prod.id) ??
          { sku: prod.sku, nombre: prod.nombre, unidades: 0, costoTotal: 0, compras: new Set<string>() };
        acc.unidades += it.cantidad;
        acc.costoTotal += aPEN(Number(it.subtotal), tc);
        acc.compras.add(c.id);
        productosMap.set(prod.id, acc);
      }
    }

    const productos: FilaProductoCompradoReporte[] = Array.from(productosMap.values())
      .map(p => ({
        sku: p.sku,
        nombre: p.nombre,
        unidades: p.unidades,
        costoTotal: round2(p.costoTotal),
        compras: p.compras.size,
      }))
      .sort((a, b) => b.costoTotal - a.costoTotal);

    const comprasFilas: FilaCompraReporte[] = lista.map(c => ({
      numero: c.numero,
      fecha: c.fechaEmision.toISOString(),
      comprobante: `${c.serie}-${c.numeroComprobante}`,
      tipoComprobante: c.tipoComprobante,
      proveedor: c.proveedor.razonSocial,
      sucursal: c.sucursal.nombre,
      moneda: c.moneda,
      total: Number(c.total),
      totalPen: round2(aPEN(Number(c.total), Number(c.tipoCambio))),
      items: c.items.length,
      estado: c.estado,
      estadoPago: c.estadoPago,
    }));

    return {
      generadoEn: new Date().toISOString(),
      tenantNombre: ctx.nombre,
      periodo: { desde: desde.toISOString(), hasta: hasta.toISOString(), etiqueta: etiquetaPeriodo(desde, hasta) },
      resumen: {
        cantidadCompras: noAnuladas.length,
        cantidadAnuladas: lista.length - noAnuladas.length,
        subtotal: round2(subtotal),
        igv: round2(igv),
        otros: round2(otros),
        descuento: round2(descuento),
        total: round2(total),
        totalPagado: round2(totalPagado),
        porPagar: round2(total - totalPagado),
        porEstadoPago: Array.from(porEstadoPago.entries())
          .map(([estadoPago, x]) => ({ estadoPago, cantidad: x.cantidad, total: round2(x.total) }))
          .sort((a, b) => b.total - a.total),
        porProveedor: Array.from(porProveedor.entries())
          .map(([proveedor, x]) => ({ proveedor, cantidad: x.cantidad, total: round2(x.total) }))
          .sort((a, b) => b.total - a.total),
        porSucursal: Array.from(porSucursal.entries())
          .map(([sucursal, x]) => ({ sucursal, cantidad: x.cantidad, total: round2(x.total) }))
          .sort((a, b) => b.total - a.total),
        porTipoComprobante: Array.from(porTipo.entries())
          .map(([tipo, x]) => ({ tipo, cantidad: x.cantidad, total: round2(x.total) }))
          .sort((a, b) => b.total - a.total),
      },
      compras: comprasFilas,
      productos,
      truncado,
    };
  }

  async excel(ctx: TenantContext, filtros: FiltrosReporteCompras): Promise<Buffer> {
    return generarExcelCompras(await this.datos(ctx, filtros));
  }

  async pdf(ctx: TenantContext, filtros: FiltrosReporteCompras): Promise<Buffer> {
    return generarPdfCompras(await this.datos(ctx, filtros));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function etiquetaPeriodo(desde: Date, hasta: Date): string {
  const mismoMes = desde.getFullYear() === hasta.getFullYear() && desde.getMonth() === hasta.getMonth();
  const esMesCompleto =
    desde.getDate() === 1 && hasta.getDate() === new Date(hasta.getFullYear(), hasta.getMonth() + 1, 0).getDate();
  if (mismoMes && esMesCompleto) {
    return `${MESES[desde.getMonth()]!.toUpperCase()} ${desde.getFullYear()}`;
  }
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${fmt(desde)} — ${fmt(hasta)}`;
}
