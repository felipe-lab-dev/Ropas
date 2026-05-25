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
  obtenerPaginacion,
  PaginacionDto,
  construirBusquedaWordSplit,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';
import { InventarioService } from '../inventario/inventario.service';
import { CrearNotaCreditoDto } from './dto/crear-nota-credito.dto';

// Lock advisory (estable por tenant) para serializar generación del número NC.
const LOCK_KEY_NUMERO_NC = 8_372_481_003;

interface ListarNotasQuery extends PaginacionDto {
  ventaId?: string;
  clienteId?: string;
  sucursalId?: string;
  estado?: 'emitida' | 'anulada';
}

@Injectable()
export class NotasCreditoService {
  constructor(
    private readonly prisma: PrismaTenantService,
    private readonly inventario: InventarioService,
  ) {}

  async listar(query: ListarNotasQuery, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.NotaCreditoWhereInput = { eliminadoEn: null };
    if (query.ventaId) where.ventaId = query.ventaId;
    if (query.clienteId) where.clienteId = query.clienteId;
    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.estado) where.estado = query.estado;

    const busqueda = construirBusquedaWordSplit(query.buscar, [
      'numero',
      'venta.numero',
      'cliente.nombre',
    ]);
    if (busqueda) Object.assign(where, busqueda);

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.notaCredito.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
        include: {
          venta: { select: { id: true, numero: true } },
          cliente: { select: { id: true, nombre: true } },
          sucursal: { select: { id: true, nombre: true } },
          emitidaPor: { select: { id: true, nombre: true } },
          _count: { select: { items: true } },
        },
      }),
      cliente.notaCredito.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async obtener(id: string, ctx: TenantContext) {
    const nc = await this.prisma.forTenant(ctx).notaCredito.findFirst({
      where: { id, eliminadoEn: null },
      include: {
        items: { include: { variante: { include: { producto: true } } } },
        venta: { select: { id: true, numero: true, total: true } },
        cliente: true,
        sucursal: true,
        emitidaPor: { select: { id: true, nombre: true, email: true } },
      },
    });
    if (!nc) throw new ErrorNoEncontrado('Nota de crédito no encontrada');
    return nc;
  }

  async crear(dto: CrearNotaCreditoDto, ctx: TenantContext, emitidaPorId: string) {
    if (!dto.items?.length) throw new ErrorValidacion('Debe incluir al menos un item');

    const motivo = dto.motivo?.trim();
    if (!motivo) throw new ErrorValidacion('El motivo es obligatorio');

    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY_NUMERO_NC})`;

      const venta = await tx.venta.findFirst({
        where: { id: dto.ventaId, eliminadoEn: null },
        include: {
          items: true,
          notasCredito: {
            where: { eliminadoEn: null, estado: 'emitida' },
            include: { items: { select: { ventaItemId: true, cantidad: true } } },
          },
        },
      });
      if (!venta) throw new ErrorNoEncontrado('Venta no encontrada');
      if (venta.estado === 'anulada') {
        throw new ErrorConflicto('No se puede emitir NC sobre venta anulada');
      }

      // Items duplicados en la petición
      const idsEnPeticion = dto.items.map(i => i.ventaItemId);
      if (new Set(idsEnPeticion).size !== idsEnPeticion.length) {
        throw new ErrorValidacion('Hay items duplicados en la petición');
      }

      // Cuánto ya se devolvió por cada VentaItem
      const yaDevuelto = new Map<string, number>();
      for (const ncPrev of venta.notasCredito) {
        for (const it of ncPrev.items) {
          yaDevuelto.set(
            it.ventaItemId,
            (yaDevuelto.get(it.ventaItemId) ?? 0) + it.cantidad,
          );
        }
      }

      // Construir items finales validando cantidades disponibles
      const itemsFinales: Array<{
        ventaItemId: string;
        varianteId: string;
        descripcion: string;
        cantidad: number;
        precioUnitario: number;
        subtotal: number;
      }> = [];

      for (const sol of dto.items) {
        const vi = venta.items.find(x => x.id === sol.ventaItemId);
        if (!vi) {
          throw new ErrorValidacion(
            `El item ${sol.ventaItemId} no pertenece a esta venta`,
          );
        }
        const disponibleParaDevolver = vi.cantidad - (yaDevuelto.get(vi.id) ?? 0);
        if (sol.cantidad > disponibleParaDevolver) {
          throw new ErrorValidacion(
            `Cantidad a devolver (${sol.cantidad}) excede lo disponible (${disponibleParaDevolver}) para "${vi.descripcion}"`,
          );
        }
        // Precio prorrateado por unidad sobre el subtotal del item (que ya tiene descuento por item descontado)
        const precioPorUnidad =
          Number(vi.cantidad) === 0 ? 0 : Number(vi.subtotal) / Number(vi.cantidad);
        const subtotal = Math.round(precioPorUnidad * sol.cantidad * 100) / 100;
        itemsFinales.push({
          ventaItemId: vi.id,
          varianteId: vi.varianteId,
          descripcion: vi.descripcion,
          cantidad: sol.cantidad,
          precioUnitario: Math.round(precioPorUnidad * 100) / 100,
          subtotal,
        });
      }

      const subtotal = itemsFinales.reduce((s, i) => s + i.subtotal, 0);
      const total = Math.round(subtotal * 100) / 100;

      const numero = await this.siguienteNumero(tx);
      const restituyeStock = dto.restituyeStock ?? true;

      const nota = await tx.notaCredito.create({
        data: {
          numero,
          ventaId: venta.id,
          sucursalId: venta.sucursalId,
          clienteId: venta.clienteId,
          emitidaPorId,
          motivo,
          subtotal,
          total,
          restituyeStock,
          items: { create: itemsFinales },
        },
        include: { items: true },
      });

      if (restituyeStock) {
        for (const item of itemsFinales) {
          await this.inventario.ajustarEnTx(tx, {
            varianteId: item.varianteId,
            sucursalId: venta.sucursalId,
            delta: item.cantidad,
            tipo: TipoMovimientoStock.ingreso_devolucion,
            referenciaTipo: 'NotaCredito',
            referenciaId: nota.id,
            motivo: `NC ${numero} sobre venta ${venta.numero}: ${motivo}`,
            usuarioId: emitidaPorId,
          });
        }
      }

      // Ajustar agregados del cliente
      if (venta.clienteId) {
        await tx.cliente.update({
          where: { id: venta.clienteId },
          data: { totalCompras: { decrement: new Prisma.Decimal(total) } },
        });
      }

      return nota;
    });
  }

  async anular(id: string, motivo: string, ctx: TenantContext, usuarioId: string) {
    const motivoLimpio = motivo?.trim();
    if (!motivoLimpio) {
      throw new ErrorValidacion('Debes indicar el motivo de la anulación');
    }
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => {
      const nc = await tx.notaCredito.findFirst({
        where: { id, eliminadoEn: null },
        include: { items: true, venta: { select: { id: true, numero: true, sucursalId: true, clienteId: true } } },
      });
      if (!nc) throw new ErrorNoEncontrado('Nota de crédito no encontrada');
      if (nc.estado === 'anulada') {
        throw new ErrorConflicto('La nota de crédito ya está anulada');
      }

      // Si restituyó stock, hay que sacarlo otra vez (egreso_ajuste)
      if (nc.restituyeStock) {
        for (const item of nc.items) {
          await this.inventario.ajustarEnTx(tx, {
            varianteId: item.varianteId,
            sucursalId: nc.venta.sucursalId,
            delta: -item.cantidad,
            tipo: TipoMovimientoStock.egreso_ajuste,
            referenciaTipo: 'NotaCreditoAnulada',
            referenciaId: nc.id,
            motivo: `Anulación NC ${nc.numero}: ${motivoLimpio}`,
            usuarioId,
          });
        }
      }

      // Revertir decremento del cliente
      if (nc.venta.clienteId) {
        await tx.cliente.update({
          where: { id: nc.venta.clienteId },
          data: { totalCompras: { increment: new Prisma.Decimal(nc.total) } },
        });
      }

      return tx.notaCredito.update({
        where: { id: nc.id },
        data: {
          estado: 'anulada',
          anuladaEn: new Date(),
          motivoAnulacion: motivoLimpio,
        },
      });
    });
  }

  private async siguienteNumero(tx: Prisma.TransactionClient): Promise<string> {
    const ultima = await tx.notaCredito.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const n = ultima ? parseInt(ultima.numero.replace(/\D/g, ''), 10) + 1 : 1;
    return `NC-${String(n).padStart(6, '0')}`;
  }
}
