import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { generarExcelContabilidad } from './reporte-contabilidad-excel';
import { generarPdfContabilidad } from './reporte-contabilidad-pdf';

const TOPE = 20_000;

export interface FiltrosReporteContabilidad {
  desde?: string;
  hasta?: string;
}

export interface FilaAsientoReporte {
  numero: string;
  fecha: string;
  glosa: string;
  tipoOperacion: string;
  debe: number;
  haber: number;
  estado: string;
}

export interface FilaDetalleAsientoReporte {
  numero: string;
  fecha: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  glosa: string;
  debe: number;
  haber: number;
}

export interface FilaCuentaReporte {
  codigo: string;
  nombre: string;
  debe: number;
  haber: number;
}

export interface ReporteContabilidadDatos {
  generadoEn: string;
  tenantNombre: string;
  periodo: { desde: string | null; hasta: string | null; etiqueta: string };
  resumen: {
    asientos: number;
    totalDebe: number;
    totalHaber: number;
    descuadre: number;
    porTipoOperacion: Array<{ tipo: string; cantidad: number; debe: number }>;
  };
  asientos: FilaAsientoReporte[];
  detalle: FilaDetalleAsientoReporte[];
  porCuenta: FilaCuentaReporte[];
  truncado: boolean;
}

@Injectable()
export class ReporteContabilidadService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async datos(ctx: TenantContext, filtros: FiltrosReporteContabilidad): Promise<ReporteContabilidadDatos> {
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

    const where: Prisma.AsientoContableWhereInput = {
      fecha: { gte: desde, lte: hasta },
      estado: { not: 'anulado' },
    };

    const lista = await cliente.asientoContable.findMany({
      where,
      take: TOPE + 1,
      orderBy: [{ fecha: 'asc' }, { numero: 'asc' }],
      include: {
        detalles: {
          orderBy: { orden: 'asc' },
          include: { cuenta: { select: { codigo: true, nombre: true } } },
        },
      },
    });

    const truncado = lista.length > TOPE;
    const asientosRaw = truncado ? lista.slice(0, TOPE) : lista;

    let totalDebe = 0, totalHaber = 0;
    const porTipo = new Map<string, { cantidad: number; debe: number }>();
    const porCuenta = new Map<string, { nombre: string; debe: number; haber: number }>();
    const detalle: FilaDetalleAsientoReporte[] = [];

    const asientos: FilaAsientoReporte[] = asientosRaw.map(a => {
      const debe = Number(a.totalDebe);
      const haber = Number(a.totalHaber);
      totalDebe += debe;
      totalHaber += haber;

      const t = porTipo.get(a.tipoOperacion) ?? { cantidad: 0, debe: 0 };
      t.cantidad += 1; t.debe += debe;
      porTipo.set(a.tipoOperacion, t);

      for (const det of a.detalles) {
        const dDebe = Number(det.debe);
        const dHaber = Number(det.haber);
        detalle.push({
          numero: a.numero,
          fecha: a.fecha.toISOString(),
          cuentaCodigo: det.cuentaCodigo,
          cuentaNombre: det.cuenta?.nombre ?? '',
          glosa: det.glosa ?? '',
          debe: round2(dDebe),
          haber: round2(dHaber),
        });
        const c = porCuenta.get(det.cuentaCodigo) ?? { nombre: det.cuenta?.nombre ?? '', debe: 0, haber: 0 };
        c.debe += dDebe; c.haber += dHaber;
        porCuenta.set(det.cuentaCodigo, c);
      }

      return {
        numero: a.numero,
        fecha: a.fecha.toISOString(),
        glosa: a.glosa,
        tipoOperacion: a.tipoOperacion,
        debe: round2(debe),
        haber: round2(haber),
        estado: a.estado,
      };
    });

    return {
      generadoEn: new Date().toISOString(),
      tenantNombre: ctx.nombre,
      periodo: { desde: desde.toISOString(), hasta: hasta.toISOString(), etiqueta: etiquetaPeriodo(desde, hasta) },
      resumen: {
        asientos: asientosRaw.length,
        totalDebe: round2(totalDebe),
        totalHaber: round2(totalHaber),
        descuadre: round2(totalDebe - totalHaber),
        porTipoOperacion: Array.from(porTipo.entries())
          .map(([tipo, x]) => ({ tipo, cantidad: x.cantidad, debe: round2(x.debe) }))
          .sort((a, b) => b.debe - a.debe),
      },
      asientos,
      detalle,
      porCuenta: Array.from(porCuenta.entries())
        .map(([codigo, x]) => ({ codigo, nombre: x.nombre, debe: round2(x.debe), haber: round2(x.haber) }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
      truncado,
    };
  }

  async excel(ctx: TenantContext, filtros: FiltrosReporteContabilidad): Promise<Buffer> {
    return generarExcelContabilidad(await this.datos(ctx, filtros));
  }

  async pdf(ctx: TenantContext, filtros: FiltrosReporteContabilidad): Promise<Buffer> {
    return generarPdfContabilidad(await this.datos(ctx, filtros));
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
