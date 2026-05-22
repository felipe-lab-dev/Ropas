import { Injectable } from '@nestjs/common';
import { Prisma, TipoMovimientoStock } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';
import {
  construirBusquedaWordSplit,
  obtenerPaginacion,
  PaginacionDto,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';
import {
  AjusteStockDto,
  ConteoFisicoDto,
  MermaStockDto,
  TrasladoStockDto,
  ActualizarParametrosStockDto,
} from './dto/ajuste.dto';

interface ListarStockQuery extends PaginacionDto {
  sucursalId?: string;
  soloAlertas?: string;
  incluirAgotados?: string;
}

interface ListarMovimientosQuery extends PaginacionDto {
  varianteId?: string;
  sucursalId?: string;
  productoId?: string;
  tipo?: 'entradas' | 'salidas' | 'ambas';
  fechaIni?: string;
  fechaFin?: string;
}

@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async listarStock(query: ListarStockQuery, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const cliente = this.prisma.forTenant(ctx);

    const where: Prisma.StockSucursalWhereInput = {};
    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.soloAlertas === 'true') {
      // Alerta sólo cuando el usuario configuró un mínimo > 0 y se está por debajo.
      where.AND = [
        { stockMinimo: { gt: 0 } },
        { disponible: { lte: cliente.stockSucursal.fields.stockMinimo } },
      ];
    }

    const variantWhere: Prisma.VarianteWhereInput = {
      eliminadoEn: null,
      producto: { eliminadoEn: null },
    };
    const busqueda = construirBusquedaWordSplit(query.buscar, [
      'sku',
      'codigoBarras',
      'producto.nombre',
      'producto.sku',
      'producto.codigo',
    ]);
    if (busqueda) Object.assign(variantWhere, busqueda);
    where.variante = variantWhere;

    const [datos, total] = await Promise.all([
      cliente.stockSucursal.findMany({
        where,
        skip,
        take,
        orderBy: [{ disponible: 'asc' }, { actualizadoEn: 'desc' }],
        include: {
          sucursal: { select: { id: true, codigo: true, nombre: true } },
          variante: {
            include: {
              producto: {
                select: { id: true, sku: true, nombre: true, imagenes: true, codigo: true },
              },
            },
          },
        },
      }),
      cliente.stockSucursal.count({ where }),
    ]);

    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  // ─── Ajustes ──────────────────────────────────────────────────────────────

  async ajustar(dto: AjusteStockDto, ctx: TenantContext, usuarioId?: string) {
    if (dto.delta === 0) throw new ErrorValidacion('El delta no puede ser 0');

    const cliente = this.prisma.forTenant(ctx);
    await this.validarVarianteYSucursal(cliente, dto.varianteId, dto.sucursalId);

    const delta = this.signoSegunTipo(dto.tipo as TipoMovimientoStock, Math.abs(dto.delta));
    return cliente.$transaction(tx =>
      this.ajustarEnTx(tx, {
        varianteId: dto.varianteId,
        sucursalId: dto.sucursalId,
        delta,
        tipo: dto.tipo as TipoMovimientoStock,
        motivo: dto.motivo,
        usuarioId,
      }),
    );
  }

  async merma(dto: MermaStockDto, ctx: TenantContext, usuarioId?: string) {
    if (dto.cantidad <= 0) throw new ErrorValidacion('La cantidad de merma debe ser > 0');
    const cliente = this.prisma.forTenant(ctx);
    await this.validarVarianteYSucursal(cliente, dto.varianteId, dto.sucursalId);

    return cliente.$transaction(tx =>
      this.ajustarEnTx(tx, {
        varianteId: dto.varianteId,
        sucursalId: dto.sucursalId,
        delta: -Math.abs(dto.cantidad),
        tipo: TipoMovimientoStock.egreso_merma,
        motivo: dto.motivo,
        usuarioId,
      }),
    );
  }

  async traslado(dto: TrasladoStockDto, ctx: TenantContext, usuarioId?: string) {
    if (dto.cantidad <= 0) throw new ErrorValidacion('La cantidad debe ser > 0');
    if (dto.sucursalOrigenId === dto.sucursalDestinoId) {
      throw new ErrorValidacion('Origen y destino no pueden ser la misma sucursal');
    }
    const cliente = this.prisma.forTenant(ctx);
    await this.validarVarianteYSucursal(cliente, dto.varianteId, dto.sucursalOrigenId);
    await this.validarSucursal(cliente, dto.sucursalDestinoId);

    return cliente.$transaction(async tx => {
      const salida = await this.ajustarEnTx(tx, {
        varianteId: dto.varianteId,
        sucursalId: dto.sucursalOrigenId,
        delta: -Math.abs(dto.cantidad),
        tipo: TipoMovimientoStock.traslado_salida,
        motivo: dto.motivo ?? `Traslado a sucursal ${dto.sucursalDestinoId}`,
        referenciaTipo: 'traslado',
        usuarioId,
      });
      const entrada = await this.ajustarEnTx(tx, {
        varianteId: dto.varianteId,
        sucursalId: dto.sucursalDestinoId,
        delta: Math.abs(dto.cantidad),
        tipo: TipoMovimientoStock.traslado_entrada,
        motivo: dto.motivo ?? `Traslado desde sucursal ${dto.sucursalOrigenId}`,
        referenciaTipo: 'traslado',
        usuarioId,
      });
      return { salida, entrada };
    });
  }

  async conteoFisico(dto: ConteoFisicoDto, ctx: TenantContext, usuarioId?: string) {
    if (!dto.items?.length) throw new ErrorValidacion('Debe incluir al menos un item');
    const cliente = this.prisma.forTenant(ctx);
    await this.validarSucursal(cliente, dto.sucursalId);

    // Cargo el stock actual de cada variante para calcular la diferencia.
    const varianteIds = dto.items.map(i => i.varianteId);
    const stocks = await cliente.stockSucursal.findMany({
      where: { sucursalId: dto.sucursalId, varianteId: { in: varianteIds } },
    });
    const stockMap = new Map(stocks.map(s => [s.varianteId, s.disponible]));

    return cliente.$transaction(async tx => {
      const resultados: Array<{
        varianteId: string;
        diferencia: number;
        stockAntes: number;
        stockDespues: number;
      }> = [];
      for (const item of dto.items) {
        if (item.cantidadContada < 0) {
          throw new ErrorValidacion(`Conteo inválido para variante ${item.varianteId}`);
        }
        const actual = stockMap.get(item.varianteId) ?? 0;
        const diferencia = item.cantidadContada - actual;
        if (diferencia === 0) {
          resultados.push({
            varianteId: item.varianteId,
            diferencia: 0,
            stockAntes: actual,
            stockDespues: actual,
          });
          continue;
        }
        const tipo =
          diferencia > 0
            ? TipoMovimientoStock.ingreso_ajuste
            : TipoMovimientoStock.egreso_ajuste;
        const { stockAntes, stockDespues } = await this.ajustarEnTx(tx, {
          varianteId: item.varianteId,
          sucursalId: dto.sucursalId,
          delta: diferencia,
          tipo,
          motivo: dto.motivo ?? 'Ajuste por conteo físico',
          referenciaTipo: 'conteo_fisico',
          usuarioId,
        });
        resultados.push({ varianteId: item.varianteId, diferencia, stockAntes, stockDespues });
      }
      return { sucursalId: dto.sucursalId, resultados };
    });
  }

  async actualizarParametros(
    stockId: string,
    dto: ActualizarParametrosStockDto,
    ctx: TenantContext,
  ) {
    const cliente = this.prisma.forTenant(ctx);
    const stock = await cliente.stockSucursal.findUnique({ where: { id: stockId } });
    if (!stock) throw new ErrorNoEncontrado('Registro de stock no encontrado');
    if (dto.stockMinimo !== undefined && dto.stockMinimo < 0) {
      throw new ErrorValidacion('stockMinimo no puede ser negativo');
    }
    return cliente.stockSucursal.update({
      where: { id: stockId },
      data: {
        stockMinimo: dto.stockMinimo,
        ubicacion: dto.ubicacion === undefined ? undefined : (dto.ubicacion?.trim() || null),
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private signoSegunTipo(tipo: TipoMovimientoStock, cantidadAbs: number): number {
    switch (tipo) {
      case TipoMovimientoStock.ingreso_compra:
      case TipoMovimientoStock.ingreso_devolucion:
      case TipoMovimientoStock.ingreso_ajuste:
      case TipoMovimientoStock.traslado_entrada:
        return cantidadAbs;
      case TipoMovimientoStock.egreso_venta:
      case TipoMovimientoStock.egreso_merma:
      case TipoMovimientoStock.egreso_ajuste:
      case TipoMovimientoStock.traslado_salida:
        return -cantidadAbs;
      default:
        return cantidadAbs;
    }
  }

  private async validarVarianteYSucursal(
    cliente: ReturnType<PrismaTenantService['forTenant']>,
    varianteId: string,
    sucursalId: string,
  ) {
    const variante = await cliente.variante.findFirst({
      where: { id: varianteId, eliminadoEn: null, producto: { eliminadoEn: null } },
      select: { id: true },
    });
    if (!variante) throw new ErrorNoEncontrado('Variante no encontrada');
    await this.validarSucursal(cliente, sucursalId);
  }

  private async validarSucursal(
    cliente: ReturnType<PrismaTenantService['forTenant']>,
    sucursalId: string,
  ) {
    const sucursal = await cliente.sucursal.findFirst({
      where: { id: sucursalId, eliminadoEn: null, activa: true },
      select: { id: true },
    });
    if (!sucursal) throw new ErrorNoEncontrado('Sucursal no encontrada o inactiva');
  }

  /**
   * Ajuste dentro de una transacción ya abierta.
   * Importante: lee el stock previo ANTES de tocarlo y persiste con un único upsert
   * usando el valor final calculado — sin doble conteo.
   */
  async ajustarEnTx(
    tx: Prisma.TransactionClient,
    params: {
      varianteId: string;
      sucursalId: string;
      delta: number;
      tipo: TipoMovimientoStock;
      motivo?: string;
      referenciaTipo?: string;
      referenciaId?: string;
      usuarioId?: string;
    },
  ) {
    const previo = await tx.stockSucursal.findUnique({
      where: {
        varianteId_sucursalId: {
          varianteId: params.varianteId,
          sucursalId: params.sucursalId,
        },
      },
    });

    const stockAntes = previo?.disponible ?? 0;
    const stockDespues = stockAntes + params.delta;

    if (stockDespues < 0) {
      const variante = await tx.variante.findUnique({
        where: { id: params.varianteId },
        include: { producto: { select: { nombre: true } } },
      });
      throw new ErrorConflicto(
        `Stock insuficiente para ${variante?.producto.nombre ?? 'variante'} (${variante?.talla}/${variante?.color}). Disponible: ${stockAntes}, requerido: ${Math.abs(params.delta)}`,
      );
    }

    await tx.stockSucursal.upsert({
      where: {
        varianteId_sucursalId: {
          varianteId: params.varianteId,
          sucursalId: params.sucursalId,
        },
      },
      create: {
        varianteId: params.varianteId,
        sucursalId: params.sucursalId,
        disponible: stockDespues,
      },
      update: { disponible: stockDespues },
    });

    await tx.movimientoStock.create({
      data: {
        varianteId: params.varianteId,
        sucursalId: params.sucursalId,
        tipo: params.tipo,
        cantidad: params.delta,
        stockAntes,
        stockDespues,
        notas: params.motivo,
        referenciaTipo: params.referenciaTipo,
        referenciaId: params.referenciaId,
        usuarioId: params.usuarioId,
      },
    });
    return { stockAntes, stockDespues };
  }

  async movimientos(query: ListarMovimientosQuery, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.MovimientoStockWhereInput = {};
    if (query.varianteId) where.varianteId = query.varianteId;
    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.productoId) {
      where.variante = { productoId: query.productoId };
    }
    if (query.tipo === 'entradas') {
      where.tipo = {
        in: ['ingreso_compra', 'ingreso_devolucion', 'ingreso_ajuste', 'traslado_entrada'],
      };
    } else if (query.tipo === 'salidas') {
      where.tipo = {
        in: ['egreso_venta', 'egreso_merma', 'egreso_ajuste', 'traslado_salida'],
      };
    }
    if (query.fechaIni || query.fechaFin) {
      const rango: Prisma.DateTimeFilter = {};
      if (query.fechaIni) rango.gte = new Date(query.fechaIni);
      if (query.fechaFin) {
        const hasta = new Date(query.fechaFin);
        hasta.setDate(hasta.getDate() + 1);
        rango.lt = hasta;
      }
      where.creadoEn = rango;
    }

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.movimientoStock.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
        include: {
          variante: {
            include: { producto: { select: { id: true, sku: true, nombre: true } } },
          },
        },
      }),
      cliente.movimientoStock.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async stockDeVariante(varianteId: string, sucursalId: string, ctx: TenantContext) {
    const stock = await this.prisma.forTenant(ctx).stockSucursal.findUnique({
      where: { varianteId_sucursalId: { varianteId, sucursalId } },
    });
    if (!stock) throw new ErrorNoEncontrado('Stock no encontrado');
    return stock;
  }
}
