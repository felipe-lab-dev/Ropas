import { Injectable } from '@nestjs/common';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async resumenDashboard(ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const inicioSemana = new Date(inicioHoy);
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const [
      totalProductos,
      totalClientes,
      ventasHoy,
      ventasSemana,
      ventasMes,
      stockBajo,
      topVendidos,
    ] = await Promise.all([
      cliente.producto.count({ where: { eliminadoEn: null } }),
      cliente.cliente.count({ where: { eliminadoEn: null } }),
      cliente.venta.aggregate({
        where: { creadoEn: { gte: inicioHoy }, estado: { not: 'anulada' } },
        _sum: { total: true }, _count: true,
      }),
      cliente.venta.aggregate({
        where: { creadoEn: { gte: inicioSemana }, estado: { not: 'anulada' } },
        _sum: { total: true }, _count: true,
      }),
      cliente.venta.aggregate({
        where: { creadoEn: { gte: inicioMes }, estado: { not: 'anulada' } },
        _sum: { total: true }, _count: true,
      }),
      cliente.stockSucursal.findMany({
        where: { disponible: { lte: 5 } },
        take: 10,
        include: {
          variante: { include: { producto: { select: { nombre: true, sku: true } } } },
          sucursal: true,
        },
        orderBy: { disponible: 'asc' },
      }),
      cliente.ventaItem.groupBy({
        by: ['varianteId'],
        _sum: { cantidad: true },
        orderBy: { _sum: { cantidad: 'desc' } },
        take: 5,
      }),
    ]);

    const variantesIds = topVendidos.map(t => t.varianteId);
    const variantes = variantesIds.length
      ? await cliente.variante.findMany({
          where: { id: { in: variantesIds } },
          include: { producto: true },
        })
      : [];

    const top = topVendidos.map(t => {
      const v = variantes.find(x => x.id === t.varianteId);
      return {
        varianteId: t.varianteId,
        nombre: v?.producto.nombre,
        talla: v?.talla,
        color: v?.color,
        unidades: t._sum.cantidad ?? 0,
      };
    });

    return {
      totales: { productos: totalProductos, clientes: totalClientes },
      ventas: {
        hoy: { monto: Number(ventasHoy._sum.total ?? 0), cantidad: ventasHoy._count },
        semana: { monto: Number(ventasSemana._sum.total ?? 0), cantidad: ventasSemana._count },
        mes: { monto: Number(ventasMes._sum.total ?? 0), cantidad: ventasMes._count },
      },
      stockBajo,
      topVendidos: top,
    };
  }

  async ventasPorCategoria(ctx: TenantContext, dias = 30) {
    const cliente = this.prisma.forTenant(ctx);
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const items = await cliente.ventaItem.findMany({
      where: { venta: { creadoEn: { gte: desde }, estado: { not: 'anulada' } } },
      include: { variante: { include: { producto: { include: { categoria: true } } } } },
    });

    const acc = new Map<string, { categoria: string; monto: number; unidades: number }>();
    for (const item of items) {
      const cat = item.variante.producto.categoria.nombre;
      const cur = acc.get(cat) ?? { categoria: cat, monto: 0, unidades: 0 };
      cur.monto += Number(item.subtotal);
      cur.unidades += item.cantidad;
      acc.set(cat, cur);
    }
    return Array.from(acc.values()).sort((a, b) => b.monto - a.monto);
  }
}
