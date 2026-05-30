import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { construirBusquedaWordSplit } from '../../core/pagination/paginacion';
import { generarExcelInventario } from './reporte-inventario-excel';
import { generarPdfInventario } from './reporte-inventario-pdf';

const TOPE_FILAS = 20_000;

export interface FiltrosReporteInventario {
  sucursalId?: string;
  soloAlertas?: string;
  buscar?: string;
}

export type EstadoStock = 'ok' | 'bajo' | 'agotado';

export interface FilaStockReporte {
  sku: string;
  producto: string;
  variante: string;
  sucursal: string;
  disponible: number;
  reservado: number;
  stockMinimo: number;
  costoUnit: number;
  valorCosto: number;
  precioVenta: number;
  valorVenta: number;
  estado: EstadoStock;
}

export interface ReporteInventarioDatos {
  generadoEn: string;
  tenantNombre: string;
  resumen: {
    registros: number;
    unidadesDisponibles: number;
    reservado: number;
    danado: number;
    valorCosto: number;
    valorVenta: number;
    margenPotencial: number;
    alertasBajo: number;
    agotados: number;
    porSucursal: Array<{ sucursal: string; registros: number; unidades: number; valorCosto: number }>;
    porCategoria: Array<{ categoria: string; unidades: number; valorCosto: number }>;
  };
  stock: FilaStockReporte[];
  alertas: FilaStockReporte[];
  truncado: boolean;
}

@Injectable()
export class ReporteInventarioService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async datos(ctx: TenantContext, filtros: FiltrosReporteInventario): Promise<ReporteInventarioDatos> {
    const cliente = this.prisma.forTenant(ctx);

    // Scope: sucursal + búsqueda (soloAlertas se aplica al detalle, no al resumen).
    const where: Prisma.StockSucursalWhereInput = {};
    if (filtros.sucursalId) where.sucursalId = filtros.sucursalId;
    const variantWhere: Prisma.VarianteWhereInput = {
      eliminadoEn: null,
      producto: { eliminadoEn: null },
    };
    const busqueda = construirBusquedaWordSplit(filtros.buscar, [
      'sku',
      'codigoBarras',
      'producto.nombre',
      'producto.sku',
      'producto.codigo',
    ]);
    if (busqueda) Object.assign(variantWhere, busqueda);
    where.variante = variantWhere;

    const filas = await cliente.stockSucursal.findMany({
      where,
      take: TOPE_FILAS + 1,
      orderBy: [{ disponible: 'asc' }],
      include: {
        sucursal: { select: { nombre: true } },
        variante: {
          select: {
            sku: true,
            talla: true,
            color: true,
            precioVenta: true,
            producto: {
              select: {
                nombre: true,
                sku: true,
                precioCompra: true,
                precioVenta: true,
                categoria: { select: { nombre: true } },
              },
            },
          },
        },
      },
    });

    const truncado = filas.length > TOPE_FILAS;
    const lista = truncado ? filas.slice(0, TOPE_FILAS) : filas;

    let unidades = 0, reservado = 0, danado = 0, valorCosto = 0, valorVenta = 0, alertasBajo = 0, agotados = 0;
    const porSucursal = new Map<string, { registros: number; unidades: number; valorCosto: number }>();
    const porCategoria = new Map<string, { unidades: number; valorCosto: number }>();

    const stock: FilaStockReporte[] = lista.map(s => {
      const costoUnit = Number(s.variante.producto.precioCompra ?? 0);
      const precioVenta = Number(s.variante.precioVenta ?? s.variante.producto.precioVenta);
      const vCosto = round2(s.disponible * costoUnit);
      const vVenta = round2(s.disponible * precioVenta);
      const estado: EstadoStock =
        s.disponible === 0 ? 'agotado' : s.stockMinimo > 0 && s.disponible <= s.stockMinimo ? 'bajo' : 'ok';

      unidades += s.disponible;
      reservado += s.reservado;
      danado += s.danado;
      valorCosto += vCosto;
      valorVenta += vVenta;
      if (estado === 'agotado') agotados += 1;
      else if (estado === 'bajo') alertasBajo += 1;

      const su = porSucursal.get(s.sucursal.nombre) ?? { registros: 0, unidades: 0, valorCosto: 0 };
      su.registros += 1; su.unidades += s.disponible; su.valorCosto += vCosto;
      porSucursal.set(s.sucursal.nombre, su);

      const cat = s.variante.producto.categoria?.nombre ?? 'Sin categoría';
      const c = porCategoria.get(cat) ?? { unidades: 0, valorCosto: 0 };
      c.unidades += s.disponible; c.valorCosto += vCosto;
      porCategoria.set(cat, c);

      return {
        sku: s.variante.sku,
        producto: s.variante.producto.nombre,
        variante: `${s.variante.talla}/${s.variante.color}`,
        sucursal: s.sucursal.nombre,
        disponible: s.disponible,
        reservado: s.reservado,
        stockMinimo: s.stockMinimo,
        costoUnit: round2(costoUnit),
        valorCosto: vCosto,
        precioVenta: round2(precioVenta),
        valorVenta: vVenta,
        estado,
      };
    });

    const alertas = stock.filter(s => s.estado !== 'ok');
    const detalle = filtros.soloAlertas === 'true' ? alertas : stock;

    return {
      generadoEn: new Date().toISOString(),
      tenantNombre: ctx.nombre,
      resumen: {
        registros: lista.length,
        unidadesDisponibles: unidades,
        reservado,
        danado,
        valorCosto: round2(valorCosto),
        valorVenta: round2(valorVenta),
        margenPotencial: round2(valorVenta - valorCosto),
        alertasBajo,
        agotados,
        porSucursal: Array.from(porSucursal.entries())
          .map(([sucursal, x]) => ({ sucursal, registros: x.registros, unidades: x.unidades, valorCosto: round2(x.valorCosto) }))
          .sort((a, b) => b.valorCosto - a.valorCosto),
        porCategoria: Array.from(porCategoria.entries())
          .map(([categoria, x]) => ({ categoria, unidades: x.unidades, valorCosto: round2(x.valorCosto) }))
          .sort((a, b) => b.valorCosto - a.valorCosto),
      },
      stock: detalle,
      alertas,
      truncado,
    };
  }

  async excel(ctx: TenantContext, filtros: FiltrosReporteInventario): Promise<Buffer> {
    return generarExcelInventario(await this.datos(ctx, filtros));
  }

  async pdf(ctx: TenantContext, filtros: FiltrosReporteInventario): Promise<Buffer> {
    return generarPdfInventario(await this.datos(ctx, filtros));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
