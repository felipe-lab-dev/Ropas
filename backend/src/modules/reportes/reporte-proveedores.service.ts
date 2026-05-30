import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { construirBusquedaWordSplit } from '../../core/pagination/paginacion';
import { generarExcelProveedores } from './reporte-proveedores-excel';
import { generarPdfProveedores } from './reporte-proveedores-pdf';

const TOPE_FILAS = 20_000;

export interface FiltrosReporteProveedores {
  buscar?: string;
  soloActivos?: string;
}

export interface FilaProveedorReporte {
  codigo: string;
  razonSocial: string;
  documento: string;
  tipoDocumento: string;
  contacto: string;
  telefono: string;
  condicionPago: string;
  diasCredito: number;
  totalComprado: number;
  deudaActual: number;
  activo: boolean;
}

export interface ReporteProveedoresDatos {
  generadoEn: string;
  tenantNombre: string;
  resumen: {
    total: number;
    activos: number;
    inactivos: number;
    totalComprado: number;
    deudaTotal: number;
    conDeuda: number;
    porCondicionPago: Array<{ condicion: string; cantidad: number; comprado: number; deuda: number }>;
  };
  proveedores: FilaProveedorReporte[];
  deudas: FilaProveedorReporte[];
  truncado: boolean;
}

@Injectable()
export class ReporteProveedoresService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async datos(ctx: TenantContext, filtros: FiltrosReporteProveedores): Promise<ReporteProveedoresDatos> {
    const cliente = this.prisma.forTenant(ctx);

    const where: Prisma.ProveedorWhereInput = { eliminadoEn: null };
    if (filtros.soloActivos === 'true') where.activo = true;
    const busqueda = construirBusquedaWordSplit(filtros.buscar, [
      'razonSocial',
      'nombreComercial',
      'documento',
      'contacto',
      'email',
    ]);
    if (busqueda) Object.assign(where, busqueda);

    const filas = await cliente.proveedor.findMany({
      where,
      take: TOPE_FILAS + 1,
      orderBy: [{ totalComprado: 'desc' }],
    });

    const truncado = filas.length > TOPE_FILAS;
    const lista = truncado ? filas.slice(0, TOPE_FILAS) : filas;

    let totalComprado = 0, deudaTotal = 0, activos = 0, conDeuda = 0;
    const porCondicion = new Map<string, { cantidad: number; comprado: number; deuda: number }>();

    const proveedores: FilaProveedorReporte[] = lista.map(p => {
      const comprado = Number(p.totalComprado);
      const deuda = Number(p.deudaActual);
      totalComprado += comprado;
      deudaTotal += deuda;
      if (p.activo) activos += 1;
      if (deuda > 0.01) conDeuda += 1;

      const c = porCondicion.get(p.condicionPago) ?? { cantidad: 0, comprado: 0, deuda: 0 };
      c.cantidad += 1; c.comprado += comprado; c.deuda += deuda;
      porCondicion.set(p.condicionPago, c);

      return {
        codigo: p.codigo ?? '—',
        razonSocial: p.razonSocial,
        documento: p.documento,
        tipoDocumento: p.tipoDocumento,
        contacto: p.contacto ?? '',
        telefono: p.telefono ?? '',
        condicionPago: p.condicionPago,
        diasCredito: p.diasCredito,
        totalComprado: round2(comprado),
        deudaActual: round2(deuda),
        activo: p.activo,
      };
    });

    const deudas = proveedores
      .filter(p => p.deudaActual > 0.01)
      .sort((a, b) => b.deudaActual - a.deudaActual);

    return {
      generadoEn: new Date().toISOString(),
      tenantNombre: ctx.nombre,
      resumen: {
        total: lista.length,
        activos,
        inactivos: lista.length - activos,
        totalComprado: round2(totalComprado),
        deudaTotal: round2(deudaTotal),
        conDeuda,
        porCondicionPago: Array.from(porCondicion.entries())
          .map(([condicion, x]) => ({ condicion, cantidad: x.cantidad, comprado: round2(x.comprado), deuda: round2(x.deuda) }))
          .sort((a, b) => b.comprado - a.comprado),
      },
      proveedores,
      deudas,
      truncado,
    };
  }

  async excel(ctx: TenantContext, filtros: FiltrosReporteProveedores): Promise<Buffer> {
    return generarExcelProveedores(await this.datos(ctx, filtros));
  }

  async pdf(ctx: TenantContext, filtros: FiltrosReporteProveedores): Promise<Buffer> {
    return generarPdfProveedores(await this.datos(ctx, filtros));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
