import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TipoMovimientoCaja,
  MedioPago,
  CategoriaMovimientoCaja,
  TipoContraparte,
} from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';
import {
  obtenerPaginacion,
  PaginacionDto,
  construirBusquedaWordSplit,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';

export interface FiltroSesionesDto extends PaginacionDto {
  sucursalId?: string;
  cajeroId?: string;
  estado?: 'abierta' | 'cerrada' | 'con_diferencia';
  desde?: string;
  hasta?: string;
}

export interface FiltroMovimientosDto extends PaginacionDto {
  tipo?: TipoMovimientoCaja;
  medio?: MedioPago;
  categoria?: CategoriaMovimientoCaja;
  /** 'fisico' = solo efectivo, 'virtual' = todo lo demás. */
  flujo?: 'fisico' | 'virtual';
}

export interface CrearMovimientoDto {
  tipo: TipoMovimientoCaja;
  categoria: CategoriaMovimientoCaja;
  subCategoria?: string;
  medio?: MedioPago;
  monto: number;
  motivo: string;
  comprobante?: string;
  contraparte?: string;
  contraparteTipo?: TipoContraparte;
  contraparteId?: string;
  contraparteDocumento?: string;
}

const CATEGORIAS_INGRESO: CategoriaMovimientoCaja[] = [
  'saldo_anterior',
  'adelanto_cliente',
  'cobro_credito',
  'devolucion_proveedor',
  'otro_ingreso',
];

const CATEGORIAS_EGRESO: CategoriaMovimientoCaja[] = [
  'pago_proveedor',
  'servicio_basico',
  'comision_empleado',
  'refrigerio',
  'movilidad',
  'publicidad',
  'devolucion_cliente',
  'otro_egreso',
];

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaTenantService) {}

  // -------------------------- Sesiones --------------------------

  async sesionAbiertaDe(sucursalId: string, cajeroId: string, ctx: TenantContext) {
    return this.prisma.forTenant(ctx).sesionCaja.findFirst({
      where: { sucursalId, cajeroId, estado: 'abierta' },
      include: {
        sucursal: { select: { id: true, nombre: true } },
        cajero: { select: { id: true, nombre: true } },
      },
    });
  }

  async abrir(
    data: { sucursalId: string; cajeroId: string; montoApertura: number; notas?: string },
    ctx: TenantContext,
  ) {
    const existente = await this.prisma.forTenant(ctx).sesionCaja.findFirst({
      where: { sucursalId: data.sucursalId, cajeroId: data.cajeroId, estado: 'abierta' },
    });
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
      include: { ventas: { include: { pagos: true } }, movimientos: { where: { eliminadoEn: null } } },
    });
    if (!sesion) throw new ErrorNoEncontrado('Sesión no encontrada');
    if (sesion.estado !== 'abierta') throw new ErrorConflicto('La sesión ya está cerrada');

    const ingresoVentas = sesion.ventas
      .flatMap(v => v.pagos)
      .filter(p => p.medio === 'efectivo')
      .reduce((s, p) => s + Number(p.monto), 0);
    const ingresosManual = sesion.movimientos
      .filter(m => m.tipo === 'ingreso' && m.medio === 'efectivo')
      .reduce((s, m) => s + Number(m.monto), 0);
    const egresos = sesion.movimientos
      .filter(m => (m.tipo === 'egreso' || m.tipo === 'retiro') && m.medio === 'efectivo')
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

  async listarSesiones(query: FiltroSesionesDto, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.SesionCajaWhereInput = {};
    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.cajeroId) where.cajeroId = query.cajeroId;
    if (query.estado) where.estado = query.estado;
    if (query.desde || query.hasta) {
      where.abiertaEn = {};
      if (query.desde) where.abiertaEn.gte = new Date(query.desde);
      if (query.hasta) where.abiertaEn.lte = new Date(query.hasta);
    }

    const busqueda = construirBusquedaWordSplit(query.buscar, ['cajero.nombre', 'sucursal.nombre']);
    if (busqueda) Object.assign(where, busqueda);

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.sesionCaja.findMany({
        where,
        skip,
        take,
        orderBy: { abiertaEn: 'desc' },
        include: {
          cajero: { select: { id: true, nombre: true } },
          sucursal: { select: { id: true, nombre: true } },
          _count: { select: { ventas: true, movimientos: true } },
        },
      }),
      cliente.sesionCaja.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async obtenerSesion(id: string, ctx: TenantContext) {
    const sesion = await this.prisma.forTenant(ctx).sesionCaja.findUnique({
      where: { id },
      include: {
        cajero: { select: { id: true, nombre: true, email: true } },
        sucursal: { select: { id: true, nombre: true } },
        _count: { select: { ventas: true, movimientos: { where: { eliminadoEn: null } } } },
      },
    });
    if (!sesion) throw new ErrorNoEncontrado('Sesión de caja no encontrada');
    return sesion;
  }

  async totalesSesion(id: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const sesion = await cliente.sesionCaja.findUnique({
      where: { id },
      include: {
        ventas: {
          where: { estado: { not: 'anulada' } },
          include: { pagos: true },
        },
        movimientos: { where: { eliminadoEn: null } },
      },
    });
    if (!sesion) throw new ErrorNoEncontrado('Sesión de caja no encontrada');

    const ventasPorMedio: Record<string, number> = {};
    let totalVentas = 0;
    let totalPagosVenta = 0;
    for (const v of sesion.ventas) {
      totalVentas += Number(v.total);
      for (const p of v.pagos) {
        ventasPorMedio[p.medio] = (ventasPorMedio[p.medio] ?? 0) + Number(p.monto);
        totalPagosVenta += Number(p.monto);
      }
    }

    const ingresosManual: Record<string, number> = {};
    const egresosManual: Record<string, number> = {};
    let totalIngresosManual = 0;
    let totalEgresosManual = 0;
    for (const m of sesion.movimientos) {
      const monto = Number(m.monto);
      if (m.tipo === 'ingreso') {
        ingresosManual[m.medio] = (ingresosManual[m.medio] ?? 0) + monto;
        totalIngresosManual += monto;
      } else if (m.tipo === 'egreso' || m.tipo === 'retiro') {
        egresosManual[m.medio] = (egresosManual[m.medio] ?? 0) + monto;
        totalEgresosManual += monto;
      }
    }

    const efectivoEsperado =
      Number(sesion.montoApertura) +
      (ventasPorMedio['efectivo'] ?? 0) +
      (ingresosManual['efectivo'] ?? 0) -
      (egresosManual['efectivo'] ?? 0);

    return {
      sesionId: sesion.id,
      estado: sesion.estado,
      montoApertura: Number(sesion.montoApertura),
      montoCierre: sesion.montoCierre ? Number(sesion.montoCierre) : null,
      montoEsperado: sesion.montoEsperado ? Number(sesion.montoEsperado) : efectivoEsperado,
      diferencia: sesion.diferencia ? Number(sesion.diferencia) : null,
      efectivoEsperado,
      ventas: {
        cantidad: sesion.ventas.length,
        total: totalVentas,
        totalCobrado: totalPagosVenta,
        porMedio: ventasPorMedio,
      },
      ingresosManual: { total: totalIngresosManual, porMedio: ingresosManual },
      egresosManual: { total: totalEgresosManual, porMedio: egresosManual },
    };
  }

  // -------------------------- Movimientos --------------------------

  async listarMovimientos(
    sesionId: string,
    query: FiltroMovimientosDto,
    ctx: TenantContext,
  ) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.MovimientoCajaWhereInput = {
      sesionId,
      eliminadoEn: null,
    };
    if (query.tipo) where.tipo = query.tipo;
    if (query.medio) where.medio = query.medio;
    if (query.categoria) where.categoria = query.categoria;
    if (query.flujo === 'fisico') where.medio = 'efectivo';
    else if (query.flujo === 'virtual') where.medio = { not: 'efectivo' };

    const busqueda = construirBusquedaWordSplit(query.buscar, ['motivo', 'contraparte', 'comprobante']);
    if (busqueda) Object.assign(where, busqueda);

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.movimientoCaja.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
        include: {
          creadoPor: { select: { id: true, nombre: true } },
        },
      }),
      cliente.movimientoCaja.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async crearMovimiento(
    sesionId: string,
    dto: CrearMovimientoDto,
    creadoPorId: string,
    ctx: TenantContext,
  ) {
    const cliente = this.prisma.forTenant(ctx);
    const sesion = await cliente.sesionCaja.findUnique({ where: { id: sesionId } });
    if (!sesion) throw new ErrorNoEncontrado('Sesión de caja no encontrada');
    if (sesion.estado !== 'abierta')
      throw new ErrorConflicto('La sesión está cerrada, no se pueden registrar movimientos');

    // Validar coherencia tipo ↔ categoría
    const catsValidas = dto.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
    if (dto.tipo === 'ingreso' || dto.tipo === 'egreso') {
      if (!catsValidas.includes(dto.categoria)) {
        throw new ErrorValidacion(
          `La categoría "${dto.categoria}" no corresponde a un movimiento de tipo "${dto.tipo}"`,
        );
      }
    }

    // Saldo anterior: solo efectivo y única vez por sesión
    if (dto.categoria === 'saldo_anterior') {
      const medio = dto.medio ?? 'efectivo';
      if (medio !== 'efectivo') {
        throw new ErrorValidacion('El saldo anterior solo puede registrarse en efectivo');
      }
      const yaRegistrado = await cliente.movimientoCaja.findFirst({
        where: { sesionId, categoria: 'saldo_anterior', eliminadoEn: null },
        select: { id: true },
      });
      if (yaRegistrado) {
        throw new ErrorConflicto('Ya se registró el saldo anterior en esta sesión de caja');
      }
    }

    return cliente.movimientoCaja.create({
      data: {
        sesionId,
        tipo: dto.tipo,
        categoria: dto.categoria,
        subCategoria: dto.subCategoria,
        medio: dto.medio ?? 'efectivo',
        monto: dto.monto,
        motivo: dto.motivo,
        comprobante: dto.comprobante,
        contraparte: dto.contraparte,
        contraparteTipo: dto.contraparteTipo,
        contraparteId: dto.contraparteId,
        contraparteDocumento: dto.contraparteDocumento,
        creadoPorId,
      },
      include: { creadoPor: { select: { id: true, nombre: true } } },
    });
  }

  /**
   * Desglose de movimientos manuales de una sesión agrupado por categoría.
   * Retorna ingresos y egresos por separado con monto total + cantidad.
   */
  async desglosePorCategoria(sesionId: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const sesion = await cliente.sesionCaja.findUnique({
      where: { id: sesionId },
      select: { id: true },
    });
    if (!sesion) throw new ErrorNoEncontrado('Sesión de caja no encontrada');

    const grupos = await cliente.movimientoCaja.groupBy({
      by: ['tipo', 'categoria', 'medio'],
      where: { sesionId, eliminadoEn: null },
      _sum: { monto: true },
      _count: { _all: true },
    });

    const init = (cats: CategoriaMovimientoCaja[]) =>
      Object.fromEntries(
        cats.map(c => [c, { total: 0, cantidad: 0, fisico: 0, virtual: 0 }]),
      ) as Record<
        CategoriaMovimientoCaja,
        { total: number; cantidad: number; fisico: number; virtual: number }
      >;
    const ingresos = init(CATEGORIAS_INGRESO);
    const egresos = init(CATEGORIAS_EGRESO);

    for (const g of grupos) {
      const cat = g.categoria;
      if (!cat) continue;
      const target = g.tipo === 'ingreso' ? ingresos : egresos;
      if (!target[cat]) continue;
      const monto = Number(g._sum.monto ?? 0);
      target[cat].total += monto;
      target[cat].cantidad += g._count._all;
      if (g.medio === 'efectivo') target[cat].fisico += monto;
      else target[cat].virtual += monto;
    }

    return { sesionId, ingresos, egresos };
  }

  async eliminarMovimiento(id: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const mov = await cliente.movimientoCaja.findUnique({
      where: { id },
      include: { sesion: true },
    });
    if (!mov || mov.eliminadoEn) throw new ErrorNoEncontrado('Movimiento no encontrado');
    if (mov.sesion.estado !== 'abierta')
      throw new ErrorConflicto('No se pueden eliminar movimientos de una sesión cerrada');
    await cliente.movimientoCaja.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
    return { id };
  }
}
