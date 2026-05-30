import { Injectable } from '@nestjs/common';
import { Prisma, EstadoVenta } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  calcularRentabilidadVenta,
  type RentabilidadVenta,
} from '../ventas/rentabilidad';
import { generarExcelVentas } from './reporte-ventas-excel';
import { generarPdfVentas } from './reporte-ventas-pdf';

const ESTADOS_VALIDOS: EstadoVenta[] = [
  'borrador',
  'confirmada',
  'pagada',
  'parcial',
  'anulada',
];

/** Tope de seguridad: evita reportes gigantes que tumben el proceso. */
const TOPE_VENTAS = 10_000;

export interface FiltrosReporteVentas {
  desde?: string;
  hasta?: string;
  estado?: string;
  buscar?: string;
  sucursalId?: string;
}

export interface FilaVentaReporte {
  numero: string;
  fecha: string;
  cliente: string;
  vendedor: string;
  sucursal: string;
  items: number;
  total: number;
  estado: EstadoVenta;
  margenPct: number | null;
  nivel: RentabilidadVenta['nivel'];
  esNotaDeVenta: boolean;
}

export interface FilaProductoReporte {
  sku: string;
  nombre: string;
  unidades: number;
  ingreso: number;
  costo: number;
  ganancia: number;
  margenPct: number | null;
  conCosto: boolean;
}

export interface ReporteVentasDatos {
  generadoEn: string;
  tenantNombre: string;
  periodo: { desde: string | null; hasta: string | null; etiqueta: string };
  resumen: {
    cantidadVentas: number;
    cantidadAnuladas: number;
    subtotal: number;
    descuentos: number;
    impuestos: number;
    total: number;
    totalPagado: number;
    porCobrar: number;
    rentabilidad: RentabilidadVenta;
    porEstado: Array<{ estado: string; cantidad: number; total: number }>;
    porMedioPago: Array<{ medio: string; cantidad: number; monto: number }>;
    porSucursal: Array<{ sucursal: string; cantidad: number; total: number }>;
  };
  ventas: FilaVentaReporte[];
  productos: FilaProductoReporte[];
  truncado: boolean;
}

@Injectable()
export class ReporteVentasService {
  constructor(private readonly prisma: PrismaTenantService) {}

  /** Construye el reporte completo (resumen + ventas + ranking de productos). */
  async datos(
    ctx: TenantContext,
    filtros: FiltrosReporteVentas,
  ): Promise<ReporteVentasDatos> {
    const cliente = this.prisma.forTenant(ctx);

    // ── Período (default: mes actual) ──────────────────────────────────────
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

    // ── WHERE (mismo criterio que el listado de ventas) ────────────────────
    const where: Prisma.VentaWhereInput = {
      eliminadoEn: null,
      creadoEn: { gte: desde, lte: hasta },
    };
    if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
    if (filtros.estado) {
      const valores = String(filtros.estado)
        .split(',')
        .map(s => s.trim())
        .filter((s): s is EstadoVenta => ESTADOS_VALIDOS.includes(s as EstadoVenta));
      if (valores.length === 1) where.estado = valores[0];
      else if (valores.length > 1) where.estado = { in: valores };
    }
    const buscar = filtros.buscar?.trim();
    if (buscar) {
      where.AND = buscar
        .split(/\s+/)
        .filter(Boolean)
        .map(p => ({
          OR: [
            { numero: { contains: p, mode: 'insensitive' as const } },
            { cliente: { nombre: { contains: p, mode: 'insensitive' as const } } },
          ],
        }));
    }

    const ventas = await cliente.venta.findMany({
      where,
      orderBy: { creadoEn: 'asc' },
      take: TOPE_VENTAS + 1,
      include: {
        cliente: { select: { nombre: true } },
        vendedor: { select: { nombre: true } },
        sucursal: { select: { nombre: true } },
        pagos: { select: { medio: true, monto: true } },
        items: {
          select: {
            cantidad: true,
            subtotal: true,
            costoUnitario: true,
            variante: {
              select: { producto: { select: { id: true, nombre: true, sku: true } } },
            },
          },
        },
      },
    });

    const truncado = ventas.length > TOPE_VENTAS;
    const lista = truncado ? ventas.slice(0, TOPE_VENTAS) : ventas;

    // ── Agregados ──────────────────────────────────────────────────────────
    const noAnuladas = lista.filter(v => v.estado !== 'anulada');

    let subtotal = 0;
    let descuentos = 0;
    let impuestos = 0;
    let total = 0;
    let totalPagado = 0;
    const itemsParaMargen: Array<{ cantidad: number; subtotal: Prisma.Decimal; costoUnitario: Prisma.Decimal | null }> = [];
    let descuentoGlobal = 0;

    const porEstadoMap = new Map<string, { cantidad: number; total: number }>();
    const porMedioMap = new Map<string, { cantidad: number; monto: number }>();
    const porSucursalMap = new Map<string, { cantidad: number; total: number }>();
    const productosMap = new Map<
      string,
      { sku: string; nombre: string; unidades: number; ingreso: number; costo: number; itemsConCosto: number; items: number }
    >();

    for (const v of lista) {
      const est = porEstadoMap.get(v.estado) ?? { cantidad: 0, total: 0 };
      est.cantidad += 1;
      est.total += Number(v.total);
      porEstadoMap.set(v.estado, est);
    }

    for (const v of noAnuladas) {
      subtotal += Number(v.subtotal);
      descuentos += Number(v.descuento) + Number(v.descuentoCupon);
      descuentoGlobal += Number(v.descuento) + Number(v.descuentoCupon);
      impuestos += Number(v.impuestos);
      total += Number(v.total);
      totalPagado += Number(v.totalPagado);

      const suc = porSucursalMap.get(v.sucursal.nombre) ?? { cantidad: 0, total: 0 };
      suc.cantidad += 1;
      suc.total += Number(v.total);
      porSucursalMap.set(v.sucursal.nombre, suc);

      for (const p of v.pagos) {
        const m = porMedioMap.get(p.medio) ?? { cantidad: 0, monto: 0 };
        m.cantidad += 1;
        m.monto += Number(p.monto);
        porMedioMap.set(p.medio, m);
      }

      for (const it of v.items) {
        itemsParaMargen.push({ cantidad: it.cantidad, subtotal: it.subtotal, costoUnitario: it.costoUnitario });
        const prod = it.variante.producto;
        const acc =
          productosMap.get(prod.id) ??
          { sku: prod.sku, nombre: prod.nombre, unidades: 0, ingreso: 0, costo: 0, itemsConCosto: 0, items: 0 };
        acc.unidades += it.cantidad;
        acc.ingreso += Number(it.subtotal);
        acc.items += 1;
        if (it.costoUnitario != null) {
          acc.costo += Number(it.costoUnitario) * it.cantidad;
          acc.itemsConCosto += 1;
        }
        productosMap.set(prod.id, acc);
      }
    }

    const rentabilidad = calcularRentabilidadVenta({
      items: itemsParaMargen,
      descuento: descuentoGlobal,
      descuentoCupon: 0,
    });

    const productos: FilaProductoReporte[] = Array.from(productosMap.values())
      .map(p => {
        const ganancia = p.itemsConCosto > 0 ? p.ingreso - p.costo : 0;
        const margenPct = p.itemsConCosto > 0 && p.ingreso > 0 ? (ganancia / p.ingreso) * 100 : null;
        return {
          sku: p.sku,
          nombre: p.nombre,
          unidades: p.unidades,
          ingreso: redondear(p.ingreso),
          costo: redondear(p.costo),
          ganancia: redondear(ganancia),
          margenPct: margenPct === null ? null : redondear(margenPct),
          conCosto: p.itemsConCosto === p.items,
        };
      })
      .sort((a, b) => b.ingreso - a.ingreso);

    const ventasFilas: FilaVentaReporte[] = lista.map(v => {
      const rv = calcularRentabilidadVenta({
        items: v.items.map(it => ({ cantidad: it.cantidad, subtotal: it.subtotal, costoUnitario: it.costoUnitario })),
        descuento: v.descuento,
        descuentoCupon: v.descuentoCupon,
      });
      return {
        numero: v.numero,
        fecha: v.creadoEn.toISOString(),
        cliente: v.cliente?.nombre ?? 'Consumidor final',
        vendedor: v.vendedor.nombre,
        sucursal: v.sucursal.nombre,
        items: v.items.length,
        total: Number(v.total),
        estado: v.estado,
        margenPct: rv.margenPct,
        nivel: rv.nivel,
        esNotaDeVenta: v.esNotaDeVenta,
      };
    });

    return {
      generadoEn: new Date().toISOString(),
      tenantNombre: ctx.nombre,
      periodo: {
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        etiqueta: etiquetaPeriodo(desde, hasta),
      },
      resumen: {
        cantidadVentas: noAnuladas.length,
        cantidadAnuladas: lista.length - noAnuladas.length,
        subtotal: redondear(subtotal),
        descuentos: redondear(descuentos),
        impuestos: redondear(impuestos),
        total: redondear(total),
        totalPagado: redondear(totalPagado),
        porCobrar: redondear(total - totalPagado),
        rentabilidad,
        porEstado: Array.from(porEstadoMap.entries())
          .map(([estado, x]) => ({ estado, cantidad: x.cantidad, total: redondear(x.total) }))
          .sort((a, b) => b.total - a.total),
        porMedioPago: Array.from(porMedioMap.entries())
          .map(([medio, x]) => ({ medio, cantidad: x.cantidad, monto: redondear(x.monto) }))
          .sort((a, b) => b.monto - a.monto),
        porSucursal: Array.from(porSucursalMap.entries())
          .map(([sucursal, x]) => ({ sucursal, cantidad: x.cantidad, total: redondear(x.total) }))
          .sort((a, b) => b.total - a.total),
      },
      ventas: ventasFilas,
      productos,
      truncado,
    };
  }

  async excel(ctx: TenantContext, filtros: FiltrosReporteVentas): Promise<Buffer> {
    return generarExcelVentas(await this.datos(ctx, filtros));
  }

  async pdf(ctx: TenantContext, filtros: FiltrosReporteVentas): Promise<Buffer> {
    return generarPdfVentas(await this.datos(ctx, filtros));
  }
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function etiquetaPeriodo(desde: Date, hasta: Date): string {
  const mismoMes =
    desde.getFullYear() === hasta.getFullYear() && desde.getMonth() === hasta.getMonth();
  const esMesCompleto =
    desde.getDate() === 1 && hasta.getDate() === new Date(hasta.getFullYear(), hasta.getMonth() + 1, 0).getDate();
  if (mismoMes && esMesCompleto) {
    return `${MESES[desde.getMonth()]!.toUpperCase()} ${desde.getFullYear()}`;
  }
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${fmt(desde)} — ${fmt(hasta)}`;
}
