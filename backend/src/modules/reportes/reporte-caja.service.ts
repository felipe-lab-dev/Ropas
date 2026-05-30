import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { generarExcelCaja } from './reporte-caja-excel';
import { generarPdfCaja } from './reporte-caja-pdf';

const TOPE = 20_000;

export interface FiltrosReporteCaja {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
}

export interface FilaSesionReporte {
  sucursal: string;
  cajero: string;
  abiertaEn: string;
  cerradaEn: string | null;
  estado: string;
  apertura: number;
  cierre: number | null;
  esperado: number | null;
  diferencia: number | null;
}

export interface FilaMovimientoReporte {
  fecha: string;
  sucursal: string;
  tipo: string;
  categoria: string;
  medio: string;
  moneda: string;
  monto: number;
  motivo: string;
  contraparte: string;
}

export interface ReporteCajaDatos {
  generadoEn: string;
  tenantNombre: string;
  periodo: { desde: string | null; hasta: string | null; etiqueta: string };
  resumen: {
    sesiones: number;
    cerradas: number;
    abiertas: number;
    conDiferencia: number;
    aperturas: number;
    cierres: number;
    esperado: number;
    diferencia: number;
    ingresos: number;
    egresos: number;
    neto: number;
    movimientos: number;
    otrasMonedas: number;
    porCategoria: Array<{ categoria: string; tipo: string; cantidad: number; monto: number }>;
    porMedio: Array<{ medio: string; cantidad: number; monto: number }>;
  };
  sesiones: FilaSesionReporte[];
  movimientos: FilaMovimientoReporte[];
  truncado: boolean;
}

@Injectable()
export class ReporteCajaService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async datos(ctx: TenantContext, filtros: FiltrosReporteCaja): Promise<ReporteCajaDatos> {
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

    const whereSesion: Prisma.SesionCajaWhereInput = { abiertaEn: { gte: desde, lte: hasta } };
    if (filtros.sucursalId) whereSesion.sucursalId = filtros.sucursalId;

    const whereMov: Prisma.MovimientoCajaWhereInput = {
      eliminadoEn: null,
      creadoEn: { gte: desde, lte: hasta },
    };
    if (filtros.sucursalId) whereMov.sesion = { sucursalId: filtros.sucursalId };

    const [sesiones, movimientos] = await Promise.all([
      cliente.sesionCaja.findMany({
        where: whereSesion,
        take: TOPE + 1,
        orderBy: { abiertaEn: 'desc' },
        include: {
          sucursal: { select: { nombre: true } },
          cajero: { select: { nombre: true } },
        },
      }),
      cliente.movimientoCaja.findMany({
        where: whereMov,
        take: TOPE + 1,
        orderBy: { creadoEn: 'desc' },
        include: { sesion: { select: { sucursal: { select: { nombre: true } } } } },
      }),
    ]);

    const truncado = sesiones.length > TOPE || movimientos.length > TOPE;
    const listaSes = sesiones.slice(0, TOPE);
    const listaMov = movimientos.slice(0, TOPE);

    // ── Sesiones (montos PEN de las columnas de arqueo) ────────────────────
    let aperturas = 0, cierres = 0, esperado = 0, diferencia = 0, cerradas = 0, conDif = 0;
    const sesionesFilas: FilaSesionReporte[] = listaSes.map(s => {
      aperturas += Number(s.montoApertura);
      if (s.montoCierre != null) cierres += Number(s.montoCierre);
      if (s.montoEsperado != null) esperado += Number(s.montoEsperado);
      if (s.diferencia != null) diferencia += Number(s.diferencia);
      if (s.estado === 'cerrada' || s.estado === 'con_diferencia') cerradas += 1;
      if (s.estado === 'con_diferencia' || (s.diferencia != null && Math.abs(Number(s.diferencia)) > 0.01)) conDif += 1;
      return {
        sucursal: s.sucursal.nombre,
        cajero: s.cajero.nombre,
        abiertaEn: s.abiertaEn.toISOString(),
        cerradaEn: s.cerradaEn ? s.cerradaEn.toISOString() : null,
        estado: s.estado,
        apertura: round2(Number(s.montoApertura)),
        cierre: s.montoCierre != null ? round2(Number(s.montoCierre)) : null,
        esperado: s.montoEsperado != null ? round2(Number(s.montoEsperado)) : null,
        diferencia: s.diferencia != null ? round2(Number(s.diferencia)) : null,
      };
    });

    // ── Movimientos manuales (montos PEN; otras monedas se cuentan aparte) ──
    let ingresos = 0, egresos = 0, otrasMonedas = 0;
    const porCategoria = new Map<string, { tipo: string; cantidad: number; monto: number }>();
    const porMedio = new Map<string, { cantidad: number; monto: number }>();

    const movimientosFilas: FilaMovimientoReporte[] = listaMov.map(m => {
      const monto = Number(m.monto);
      const esPen = (m.moneda ?? 'PEN') === 'PEN';
      if (!esPen) otrasMonedas += 1;

      if (esPen) {
        if (m.tipo === 'ingreso') ingresos += monto;
        else if (m.tipo === 'egreso' || m.tipo === 'retiro') egresos += monto;

        const cat = m.categoria ?? 'otro';
        const tipoCat = m.tipo === 'ingreso' ? 'ingreso' : 'egreso';
        const c = porCategoria.get(cat) ?? { tipo: tipoCat, cantidad: 0, monto: 0 };
        c.cantidad += 1; c.monto += monto;
        porCategoria.set(cat, c);

        const me = porMedio.get(m.medio) ?? { cantidad: 0, monto: 0 };
        me.cantidad += 1; me.monto += monto;
        porMedio.set(m.medio, me);
      }

      return {
        fecha: m.creadoEn.toISOString(),
        sucursal: m.sesion.sucursal.nombre,
        tipo: m.tipo,
        categoria: m.categoria ?? '—',
        medio: m.medio,
        moneda: m.moneda,
        monto: round2(monto),
        motivo: m.motivo,
        contraparte: m.contraparte ?? '',
      };
    });

    return {
      generadoEn: new Date().toISOString(),
      tenantNombre: ctx.nombre,
      periodo: { desde: desde.toISOString(), hasta: hasta.toISOString(), etiqueta: etiquetaPeriodo(desde, hasta) },
      resumen: {
        sesiones: listaSes.length,
        cerradas,
        abiertas: listaSes.length - cerradas,
        conDiferencia: conDif,
        aperturas: round2(aperturas),
        cierres: round2(cierres),
        esperado: round2(esperado),
        diferencia: round2(diferencia),
        ingresos: round2(ingresos),
        egresos: round2(egresos),
        neto: round2(ingresos - egresos),
        movimientos: listaMov.length,
        otrasMonedas,
        porCategoria: Array.from(porCategoria.entries())
          .map(([categoria, x]) => ({ categoria, tipo: x.tipo, cantidad: x.cantidad, monto: round2(x.monto) }))
          .sort((a, b) => b.monto - a.monto),
        porMedio: Array.from(porMedio.entries())
          .map(([medio, x]) => ({ medio, cantidad: x.cantidad, monto: round2(x.monto) }))
          .sort((a, b) => b.monto - a.monto),
      },
      sesiones: sesionesFilas,
      movimientos: movimientosFilas,
      truncado,
    };
  }

  async excel(ctx: TenantContext, filtros: FiltrosReporteCaja): Promise<Buffer> {
    return generarExcelCaja(await this.datos(ctx, filtros));
  }

  async pdf(ctx: TenantContext, filtros: FiltrosReporteCaja): Promise<Buffer> {
    return generarPdfCaja(await this.datos(ctx, filtros));
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
