import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { construirBusquedaWordSplit } from '../../core/pagination/paginacion';
import { generarExcelProductos } from './reporte-productos-excel';
import { generarPdfProductos } from './reporte-productos-pdf';

const TOPE_FILAS = 20_000;

export interface FiltrosReporteProductos {
  buscar?: string;
  categoriaId?: string;
  marcaId?: string;
  activo?: string;
}

export interface FilaProductoCatalogo {
  sku: string;
  codigo: string;
  nombre: string;
  categoria: string;
  marca: string;
  genero: string;
  clasificacion: string;
  precioVenta: number;
  precioCompra: number | null;
  margenPct: number | null;
  variantes: number;
  stock: number;
  valorCosto: number;
  valorVenta: number;
  activo: boolean;
}

export interface ReporteProductosDatos {
  generadoEn: string;
  tenantNombre: string;
  resumen: {
    total: number;
    activos: number;
    inactivos: number;
    variantes: number;
    unidadesStock: number;
    valorCosto: number;
    valorVenta: number;
    sinPrecioCompra: number;
    porCategoria: Array<{ categoria: string; cantidad: number; valorCosto: number }>;
    porClasificacion: Array<{ clasificacion: string; cantidad: number }>;
  };
  productos: FilaProductoCatalogo[];
  top: FilaProductoCatalogo[];
  truncado: boolean;
}

@Injectable()
export class ReporteProductosService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async datos(ctx: TenantContext, filtros: FiltrosReporteProductos): Promise<ReporteProductosDatos> {
    const cliente = this.prisma.forTenant(ctx);

    const where: Prisma.ProductoWhereInput = { eliminadoEn: null };
    if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
    if (filtros.marcaId) where.marcaId = filtros.marcaId;
    if (filtros.activo !== undefined && filtros.activo !== '') where.activo = filtros.activo === 'true';
    const busqueda = construirBusquedaWordSplit(filtros.buscar, ['nombre', 'sku', 'codigo', 'descripcion', 'material']);
    if (busqueda) Object.assign(where, busqueda);

    const filas = await cliente.producto.findMany({
      where,
      take: TOPE_FILAS + 1,
      orderBy: { nombre: 'asc' },
      include: {
        categoria: { select: { nombre: true } },
        marca: { select: { nombre: true } },
        variantes: {
          where: { eliminadoEn: null },
          select: { id: true, stocks: { select: { disponible: true } } },
        },
      },
    });

    const truncado = filas.length > TOPE_FILAS;
    const lista = truncado ? filas.slice(0, TOPE_FILAS) : filas;

    let activos = 0, variantes = 0, unidadesStock = 0, valorCosto = 0, valorVenta = 0, sinPrecioCompra = 0;
    const porCategoria = new Map<string, { cantidad: number; valorCosto: number }>();
    const porClase = new Map<string, number>();

    const productos: FilaProductoCatalogo[] = lista.map(p => {
      const precioVenta = Number(p.precioVenta);
      const precioCompra = p.precioCompra != null ? Number(p.precioCompra) : null;
      const stock = p.variantes.reduce((s, v) => s + v.stocks.reduce((t, x) => t + x.disponible, 0), 0);
      const vCosto = precioCompra != null ? round2(stock * precioCompra) : 0;
      const vVenta = round2(stock * precioVenta);
      const margenPct =
        precioCompra != null && precioVenta > 0 ? round2(((precioVenta - precioCompra) / precioVenta) * 100) : null;

      if (p.activo) activos += 1;
      variantes += p.variantes.length;
      unidadesStock += stock;
      valorCosto += vCosto;
      valorVenta += vVenta;
      if (precioCompra == null) sinPrecioCompra += 1;

      const cat = p.categoria?.nombre ?? 'Sin categoría';
      const c = porCategoria.get(cat) ?? { cantidad: 0, valorCosto: 0 };
      c.cantidad += 1; c.valorCosto += vCosto;
      porCategoria.set(cat, c);

      const clase = p.clasificacion ?? 'Sin clasificar';
      porClase.set(clase, (porClase.get(clase) ?? 0) + 1);

      return {
        sku: p.sku,
        codigo: p.codigo ?? '—',
        nombre: p.nombre,
        categoria: cat,
        marca: p.marca?.nombre ?? '—',
        genero: p.genero,
        clasificacion: p.clasificacion ?? '—',
        precioVenta: round2(precioVenta),
        precioCompra: precioCompra != null ? round2(precioCompra) : null,
        margenPct,
        variantes: p.variantes.length,
        stock,
        valorCosto: vCosto,
        valorVenta: vVenta,
        activo: p.activo,
      };
    });

    const top = [...productos].filter(p => p.valorCosto > 0).sort((a, b) => b.valorCosto - a.valorCosto).slice(0, 20);

    const ordenClase = ['AA', 'A', 'B', 'C', 'D', 'Sin clasificar'];
    return {
      generadoEn: new Date().toISOString(),
      tenantNombre: ctx.nombre,
      resumen: {
        total: lista.length,
        activos,
        inactivos: lista.length - activos,
        variantes,
        unidadesStock,
        valorCosto: round2(valorCosto),
        valorVenta: round2(valorVenta),
        sinPrecioCompra,
        porCategoria: Array.from(porCategoria.entries())
          .map(([categoria, x]) => ({ categoria, cantidad: x.cantidad, valorCosto: round2(x.valorCosto) }))
          .sort((a, b) => b.valorCosto - a.valorCosto),
        porClasificacion: Array.from(porClase.entries())
          .map(([clasificacion, cantidad]) => ({ clasificacion, cantidad }))
          .sort((a, b) => ordenClase.indexOf(a.clasificacion) - ordenClase.indexOf(b.clasificacion)),
      },
      productos,
      top,
      truncado,
    };
  }

  async excel(ctx: TenantContext, filtros: FiltrosReporteProductos): Promise<Buffer> {
    return generarExcelProductos(await this.datos(ctx, filtros));
  }

  async pdf(ctx: TenantContext, filtros: FiltrosReporteProductos): Promise<Buffer> {
    return generarPdfProductos(await this.datos(ctx, filtros));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
