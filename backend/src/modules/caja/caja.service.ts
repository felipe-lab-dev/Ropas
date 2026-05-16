import { Injectable } from '@nestjs/common';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
} from '../../core/errors/errores';

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async sesionAbiertaDe(sucursalId: string, cajeroId: string, ctx: TenantContext) {
    return this.prisma.forTenant(ctx).sesionCaja.findFirst({
      where: { sucursalId, cajeroId, estado: 'abierta' },
    });
  }

  async abrir(
    data: { sucursalId: string; cajeroId: string; montoApertura: number; notas?: string },
    ctx: TenantContext,
  ) {
    const existente = await this.sesionAbiertaDe(data.sucursalId, data.cajeroId, ctx);
    if (existente) throw new ErrorConflicto('Ya tienes una sesión de caja abierta');
    return this.prisma.forTenant(ctx).sesionCaja.create({
      data: {
        sucursalId: data.sucursalId,
        cajeroId: data.cajeroId,
        montoApertura: data.montoApertura,
        notasApertura: data.notas,
      },
    });
  }

  async cerrar(
    id: string,
    data: { montoCierre: number; notas?: string },
    ctx: TenantContext,
  ) {
    const cliente = this.prisma.forTenant(ctx);
    const sesion = await cliente.sesionCaja.findUnique({
      where: { id },
      include: { ventas: { include: { pagos: true } }, movimientos: true },
    });
    if (!sesion) throw new ErrorNoEncontrado('Sesión no encontrada');
    if (sesion.estado !== 'abierta') throw new ErrorConflicto('La sesión ya está cerrada');

    const ingresoVentas = sesion.ventas
      .flatMap(v => v.pagos)
      .filter(p => p.medio === 'efectivo')
      .reduce((s, p) => s + Number(p.monto), 0);
    const ingresosManual = sesion.movimientos
      .filter(m => m.tipo === 'ingreso')
      .reduce((s, m) => s + Number(m.monto), 0);
    const egresos = sesion.movimientos
      .filter(m => m.tipo === 'egreso' || m.tipo === 'retiro')
      .reduce((s, m) => s + Number(m.monto), 0);

    const montoEsperado = Number(sesion.montoApertura) + ingresoVentas + ingresosManual - egresos;
    const diferencia = data.montoCierre - montoEsperado;

    return cliente.sesionCaja.update({
      where: { id },
      data: {
        montoCierre: data.montoCierre,
        montoEsperado,
        diferencia,
        notasCierre: data.notas,
        estado: Math.abs(diferencia) < 0.01 ? 'cerrada' : 'con_diferencia',
        cerradaEn: new Date(),
      },
    });
  }

  async listarSesiones(query: { sucursalId?: string }, ctx: TenantContext) {
    return this.prisma.forTenant(ctx).sesionCaja.findMany({
      where: query.sucursalId ? { sucursalId: query.sucursalId } : undefined,
      orderBy: { abiertaEn: 'desc' },
      take: 50,
      include: {
        cajero: { select: { id: true, nombre: true } },
        sucursal: { select: { id: true, nombre: true } },
        _count: { select: { ventas: true } },
      },
    });
  }
}
