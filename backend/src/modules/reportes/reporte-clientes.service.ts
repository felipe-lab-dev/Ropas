import { Injectable } from '@nestjs/common';
import { Prisma, ClasificacionAbc } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { construirBusquedaWordSplit } from '../../core/pagination/paginacion';
import { generarExcelClientes } from './reporte-clientes-excel';
import { generarPdfClientes } from './reporte-clientes-pdf';

const TOPE_FILAS = 20_000;
const CLASES: ClasificacionAbc[] = ['AA', 'A', 'B', 'C', 'D'];

export interface FiltrosReporteClientes {
  buscar?: string;
  clasificacion?: string;
}

export interface FilaClienteReporte {
  codigo: string;
  nombre: string;
  documento: string;
  tipoDocumento: string;
  telefono: string;
  ciudad: string;
  clasificacion: string;
  totalCompras: number;
  ultimaCompraEn: string | null;
}

export interface ReporteClientesDatos {
  generadoEn: string;
  tenantNombre: string;
  resumen: {
    total: number;
    conCompras: number;
    sinCompras: number;
    totalCompras: number;
    ticketPromedio: number;
    porClasificacion: Array<{ clasificacion: string; cantidad: number; compras: number }>;
  };
  clientes: FilaClienteReporte[];
  top: FilaClienteReporte[];
  truncado: boolean;
}

@Injectable()
export class ReporteClientesService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async datos(ctx: TenantContext, filtros: FiltrosReporteClientes): Promise<ReporteClientesDatos> {
    const cliente = this.prisma.forTenant(ctx);

    const where: Prisma.ClienteWhereInput = { eliminadoEn: null };
    const busqueda = construirBusquedaWordSplit(filtros.buscar, ['nombre', 'documento', 'email', 'telefono']);
    if (busqueda) Object.assign(where, busqueda);
    if (filtros.clasificacion && CLASES.includes(filtros.clasificacion as ClasificacionAbc)) {
      where.clasificacion = filtros.clasificacion as ClasificacionAbc;
    }

    const filas = await cliente.cliente.findMany({
      where,
      take: TOPE_FILAS + 1,
      orderBy: { totalCompras: 'desc' },
    });

    const truncado = filas.length > TOPE_FILAS;
    const lista = truncado ? filas.slice(0, TOPE_FILAS) : filas;

    let totalCompras = 0, conCompras = 0;
    const porClase = new Map<string, { cantidad: number; compras: number }>();

    const clientes: FilaClienteReporte[] = lista.map(c => {
      const compras = Number(c.totalCompras);
      totalCompras += compras;
      if (compras > 0.01) conCompras += 1;
      const clave = c.clasificacion ?? 'Sin clasificar';
      const acc = porClase.get(clave) ?? { cantidad: 0, compras: 0 };
      acc.cantidad += 1; acc.compras += compras;
      porClase.set(clave, acc);
      return {
        codigo: c.codigo ?? '—',
        nombre: c.nombre,
        documento: c.documento ?? '—',
        tipoDocumento: c.tipoDocumento,
        telefono: c.telefono ?? '',
        ciudad: c.ciudad ?? '',
        clasificacion: c.clasificacion ?? '—',
        totalCompras: round2(compras),
        ultimaCompraEn: c.ultimaCompraEn ? c.ultimaCompraEn.toISOString() : null,
      };
    });

    const top = clientes.filter(c => c.totalCompras > 0).slice(0, 20);

    return {
      generadoEn: new Date().toISOString(),
      tenantNombre: ctx.nombre,
      resumen: {
        total: lista.length,
        conCompras,
        sinCompras: lista.length - conCompras,
        totalCompras: round2(totalCompras),
        ticketPromedio: conCompras > 0 ? round2(totalCompras / conCompras) : 0,
        porClasificacion: ordenarClases(porClase),
      },
      clientes,
      top,
      truncado,
    };
  }

  async excel(ctx: TenantContext, filtros: FiltrosReporteClientes): Promise<Buffer> {
    return generarExcelClientes(await this.datos(ctx, filtros));
  }

  async pdf(ctx: TenantContext, filtros: FiltrosReporteClientes): Promise<Buffer> {
    return generarPdfClientes(await this.datos(ctx, filtros));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ordena AA, A, B, C, D y deja "Sin clasificar" al final. */
function ordenarClases(map: Map<string, { cantidad: number; compras: number }>) {
  const orden = ['AA', 'A', 'B', 'C', 'D', 'Sin clasificar'];
  return Array.from(map.entries())
    .map(([clasificacion, x]) => ({ clasificacion, cantidad: x.cantidad, compras: round2(x.compras) }))
    .sort((a, b) => orden.indexOf(a.clasificacion) - orden.indexOf(b.clasificacion));
}
