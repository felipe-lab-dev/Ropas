import { Injectable } from '@nestjs/common';
import { Prisma, EstadoVenta, MedioPago, TipoMovimientoStock } from '@prisma/client';
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
import { InventarioService } from '../inventario/inventario.service';
import { CrearVentaDto } from './dto/crear-venta.dto';

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaTenantService,
    private readonly inventario: InventarioService,
  ) {}

  async listar(query: PaginacionDto & { sucursalId?: string; estado?: EstadoVenta }, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.VentaWhereInput = {};
    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.estado) where.estado = query.estado;

    const busqueda = construirBusquedaWordSplit(query.buscar, ['numero', 'cliente.nombre']);
    if (busqueda) Object.assign(where, busqueda);

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.venta.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
        include: {
          cliente: { select: { id: true, nombre: true } },
          vendedor: { select: { id: true, nombre: true } },
          sucursal: { select: { id: true, nombre: true } },
          _count: { select: { items: true } },
        },
      }),
      cliente.venta.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async obtener(id: string, ctx: TenantContext) {
    const venta = await this.prisma.forTenant(ctx).venta.findFirst({
      where: { id },
      include: {
        items: { include: { variante: { include: { producto: true } } } },
        pagos: true,
        cliente: true,
        vendedor: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
      },
    });
    if (!venta) throw new ErrorNoEncontrado('Venta no encontrada');
    return venta;
  }

  async crear(dto: CrearVentaDto, ctx: TenantContext, vendedorId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new ErrorValidacion('La venta debe tener al menos un item');
    }
    const cliente = this.prisma.forTenant(ctx);

    return cliente.$transaction(async tx => {
      const variantes = await tx.variante.findMany({
        where: { id: { in: dto.items.map(i => i.varianteId) }, eliminadoEn: null },
        include: { producto: true },
      });
      if (variantes.length !== dto.items.length) {
        throw new ErrorValidacion('Una o más variantes no existen');
      }

      const itemsConPrecio = dto.items.map(item => {
        const v = variantes.find(x => x.id === item.varianteId)!;
        const precio = item.precioUnitario ?? Number(v.precioVenta ?? v.producto.precioVenta);
        const subtotal = precio * item.cantidad - (item.descuento ?? 0);
        return {
          varianteId: v.id,
          descripcion: `${v.producto.nombre} · ${v.talla}/${v.color}`,
          cantidad: item.cantidad,
          precioUnitario: precio,
          descuento: item.descuento ?? 0,
          subtotal,
        };
      });

      const subtotal = itemsConPrecio.reduce((s, i) => s + i.subtotal, 0);
      const descuento = dto.descuento ?? 0;
      const impuestos = dto.impuestos ?? 0;
      const total = subtotal - descuento + impuestos;

      const totalPagado = (dto.pagos ?? []).reduce((s, p) => s + p.monto, 0);
      if (totalPagado > total + 0.01) {
        throw new ErrorConflicto('El total pagado excede el total de la venta');
      }
      const estado: EstadoVenta =
        totalPagado >= total - 0.01 ? 'pagada' : totalPagado > 0 ? 'parcial' : 'confirmada';

      const numero = await this.siguienteNumero(tx);

      const venta = await tx.venta.create({
        data: {
          numero,
          sucursalId: dto.sucursalId,
          clienteId: dto.clienteId,
          vendedorId,
          estado,
          subtotal,
          descuento,
          impuestos,
          total,
          totalPagado,
          notas: dto.notas,
          sesionCajaId: dto.sesionCajaId,
          items: { create: itemsConPrecio },
          pagos: {
            create: (dto.pagos ?? []).map(p => ({
              medio: p.medio as MedioPago,
              monto: p.monto,
              referencia: p.referencia,
            })),
          },
        },
        include: { items: true, pagos: true },
      });

      for (const item of itemsConPrecio) {
        await this.inventario.ajustarEnTx(tx, {
          varianteId: item.varianteId,
          sucursalId: dto.sucursalId,
          delta: -item.cantidad,
          tipo: TipoMovimientoStock.egreso_venta,
          referenciaTipo: 'Venta',
          referenciaId: venta.id,
          motivo: `Venta ${numero}`,
          usuarioId: vendedorId,
        });
      }

      if (dto.clienteId) {
        await tx.cliente.update({
          where: { id: dto.clienteId },
          data: { totalCompras: { increment: total }, ultimaCompraEn: new Date() },
        });
      }

      return venta;
    });
  }

  async anular(id: string, motivo: string, ctx: TenantContext, usuarioId: string) {
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => {
      const venta = await tx.venta.findFirst({
        where: { id },
        include: { items: true },
      });
      if (!venta) throw new ErrorNoEncontrado('Venta no encontrada');
      if (venta.estado === 'anulada') throw new ErrorConflicto('La venta ya está anulada');

      for (const item of venta.items) {
        await this.inventario.ajustarEnTx(tx, {
          varianteId: item.varianteId,
          sucursalId: venta.sucursalId,
          delta: item.cantidad,
          tipo: TipoMovimientoStock.ingreso_devolucion,
          referenciaTipo: 'VentaAnulada',
          referenciaId: venta.id,
          motivo: `Anulación venta ${venta.numero}: ${motivo}`,
          usuarioId,
        });
      }

      return tx.venta.update({
        where: { id },
        data: { estado: 'anulada', anuladaEn: new Date(), motivoAnulacion: motivo },
      });
    });
  }

  private async siguienteNumero(tx: Prisma.TransactionClient): Promise<string> {
    const ultima = await tx.venta.findFirst({
      orderBy: { creadoEn: 'desc' },
      select: { numero: true },
    });
    const n = ultima ? parseInt(ultima.numero.replace(/\D/g, ''), 10) + 1 : 1;
    return `V-${String(n).padStart(6, '0')}`;
  }
}
