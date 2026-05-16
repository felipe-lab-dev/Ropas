import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, TipoMovimientoStock } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
} from '../../core/errors/errores';
import {
  construirBusquedaWordSplit,
  obtenerPaginacion,
  PaginacionDto,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';

interface ListarStockQuery extends PaginacionDto {
  sucursalId?: string;
  soloAlertas?: string;
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
      where.disponible = { lte: cliente.stockSucursal.fields.stockMinimo as any };
    }

    const variantWhere: Prisma.VarianteWhereInput = { eliminadoEn: null };
    const busqueda = construirBusquedaWordSplit(query.buscar, [
      'sku',
      'producto.nombre',
      'producto.sku',
      'codigoBarras',
    ]);
    if (busqueda) Object.assign(variantWhere, busqueda);
    where.variante = variantWhere;

    const [datos, total] = await Promise.all([
      cliente.stockSucursal.findMany({
        where,
        skip,
        take,
        orderBy: { actualizadoEn: 'desc' },
        include: {
          sucursal: { select: { id: true, codigo: true, nombre: true } },
          variante: {
            include: {
              producto: { select: { id: true, sku: true, nombre: true, imagenes: true } },
            },
          },
        },
      }),
      cliente.stockSucursal.count({ where }),
    ]);

    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async ajustar(
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
    ctx: TenantContext,
  ) {
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => this.ajustarEnTx(tx, params));
  }

  /** Ajuste dentro de una transacción ya abierta — usado por VentasService. */
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
    const stock = await tx.stockSucursal.upsert({
      where: { varianteId_sucursalId: { varianteId: params.varianteId, sucursalId: params.sucursalId } },
      create: {
        varianteId: params.varianteId,
        sucursalId: params.sucursalId,
        disponible: Math.max(0, params.delta),
      },
      update: {},
    });

    const stockAntes = stock.disponible;
    const stockDespues = stockAntes + params.delta;
    if (stockDespues < 0) {
      const variante = await tx.variante.findUnique({
        where: { id: params.varianteId },
        include: { producto: true },
      });
      throw new ErrorConflicto(
        `Stock insuficiente para ${variante?.producto.nombre} (${variante?.talla}/${variante?.color}). Disponible: ${stockAntes}, requerido: ${Math.abs(params.delta)}`,
      );
    }

    await tx.stockSucursal.update({
      where: { id: stock.id },
      data: { disponible: stockDespues },
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

  async movimientos(query: PaginacionDto & { varianteId?: string; sucursalId?: string }, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.MovimientoStockWhereInput = {};
    if (query.varianteId) where.varianteId = query.varianteId;
    if (query.sucursalId) where.sucursalId = query.sucursalId;

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.movimientoStock.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
        include: { variante: { include: { producto: true } } },
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
