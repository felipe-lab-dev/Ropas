import { Injectable, Logger } from '@nestjs/common';
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
import { MotorCuponesService, ItemCarrito } from '../cupones/motor-cupones.service';
import { SerieCpeService } from '../facturacion-electronica/series-cpe/series-cpe.service';
import { TipoCpe } from '../../core/sunat/codigos';
import { AppEventEmitter } from '../../core/events/app-event-emitter';
import { CrearVentaDto } from './dto/crear-venta.dto';

// Advisory-lock key (estable por tenant) para serializar generación del número de venta.
const LOCK_KEY_NUMERO_VENTA = 8_372_481_002;

const ESTADOS_VENTA_VALIDOS: EstadoVenta[] = [
  'borrador',
  'confirmada',
  'pagada',
  'parcial',
  'anulada',
];

interface ListarVentasQuery extends PaginacionDto {
  sucursalId?: string;
  clienteId?: string;
  vendedorId?: string;
  /** Acepta un único estado o varios separados por coma: `?estado=pagada,parcial` */
  estado?: string;
  desde?: string;
  hasta?: string;
  /** 'true' para excluir anuladas (útil para reportes). */
  excluirAnuladas?: string;
}

@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);

  constructor(
    private readonly prisma: PrismaTenantService,
    private readonly inventario: InventarioService,
    private readonly motorCupones: MotorCuponesService,
    private readonly serieCpeService: SerieCpeService,
    private readonly eventEmitter: AppEventEmitter,
  ) {}

  async listar(query: ListarVentasQuery, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.VentaWhereInput = { eliminadoEn: null };

    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.clienteId) where.clienteId = query.clienteId;
    if (query.vendedorId) where.vendedorId = query.vendedorId;

    if (query.estado) {
      const valores = String(query.estado)
        .split(',')
        .map(s => s.trim())
        .filter((s): s is EstadoVenta =>
          ESTADOS_VENTA_VALIDOS.includes(s as EstadoVenta),
        );
      if (valores.length === 1) where.estado = valores[0];
      else if (valores.length > 1) where.estado = { in: valores };
    }

    if (query.excluirAnuladas === 'true') {
      where.anuladaEn = null;
    }

    if (query.desde || query.hasta) {
      const rango: Prisma.DateTimeFilter = {};
      if (query.desde) rango.gte = new Date(query.desde);
      if (query.hasta) {
        const hasta = new Date(query.hasta);
        hasta.setDate(hasta.getDate() + 1);
        rango.lt = hasta;
      }
      where.creadoEn = rango;
    }

    // Búsqueda word-split: número exacto, cliente.nombre, o sin cliente cuando matchea "consumidor".
    const buscar = query.buscar?.trim();
    if (buscar) {
      const palabras = buscar.split(/\s+/).filter(Boolean);
      const filtros = palabras.map(p => ({
        OR: [
          { numero: { contains: p, mode: 'insensitive' as const } },
          { cliente: { nombre: { contains: p, mode: 'insensitive' as const } } },
        ],
      }));
      where.AND = filtros;
    }

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
      where: { id, eliminadoEn: null },
      include: {
        items: {
          include: {
            variante: { include: { producto: true } },
            notasCreditoItems: { select: { cantidad: true, notaCreditoId: true } },
          },
        },
        pagos: { orderBy: { recibidoEn: 'asc' } },
        cliente: true,
        vendedor: { select: { id: true, nombre: true, email: true } },
        sucursal: true,
        cupon: { select: { id: true, codigo: true, tipoDescuento: true, valorDescuento: true } },
        cuponUso: true,
        notasCredito: {
          where: { eliminadoEn: null },
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            numero: true,
            estado: true,
            motivo: true,
            total: true,
            creadoEn: true,
          },
        },
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

    const resultado = await cliente.$transaction(async tx => {
      // Lock advisory por tenant: serializa generación del número correlativo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY_NUMERO_VENTA})`;

      // ─── Sucursal ─────────────────────────────────────────────────────
      const sucursal = await tx.sucursal.findFirst({
        where: { id: dto.sucursalId, eliminadoEn: null, activa: true },
        select: { id: true },
      });
      if (!sucursal) {
        throw new ErrorNoEncontrado('Sucursal no encontrada o inactiva');
      }

      // ─── Cliente (opcional) ───────────────────────────────────────────
      let clienteRegistrado: {
        id: string;
        clasificacion: 'AA' | 'A' | 'B' | 'C' | 'D' | null;
        totalCompras: Prisma.Decimal;
        ultimaCompraEn: Date | null;
      } | null = null;
      if (dto.clienteId) {
        const c = await tx.cliente.findFirst({
          where: { id: dto.clienteId, eliminadoEn: null },
          select: { id: true, clasificacion: true, totalCompras: true, ultimaCompraEn: true },
        });
        if (!c) throw new ErrorNoEncontrado('Cliente no encontrado');
        clienteRegistrado = c;
      }

      // ─── Sesión de caja (opcional) ────────────────────────────────────
      if (dto.sesionCajaId) {
        const sesion = await tx.sesionCaja.findUnique({
          where: { id: dto.sesionCajaId },
          select: { id: true, estado: true, sucursalId: true, cajeroId: true },
        });
        if (!sesion) throw new ErrorNoEncontrado('Sesión de caja no encontrada');
        if (sesion.estado !== 'abierta') {
          throw new ErrorConflicto('La sesión de caja está cerrada');
        }
        if (sesion.sucursalId !== dto.sucursalId) {
          throw new ErrorValidacion(
            'La sesión de caja pertenece a otra sucursal',
          );
        }
        if (sesion.cajeroId !== vendedorId) {
          throw new ErrorValidacion('La sesión de caja pertenece a otro cajero');
        }
      }

      // ─── Variantes y precios ──────────────────────────────────────────
      const varianteIds = dto.items.map(i => i.varianteId);
      // Detectar IDs duplicados: el frontend debería consolidar pero validamos.
      if (new Set(varianteIds).size !== varianteIds.length) {
        throw new ErrorValidacion(
          'Hay items duplicados; consolida la cantidad antes de enviar',
        );
      }
      const variantes = await tx.variante.findMany({
        where: { id: { in: varianteIds }, eliminadoEn: null },
        include: { producto: { select: { id: true, nombre: true, precioVenta: true, categoriaId: true, eliminadoEn: true } } },
      });
      if (variantes.length !== dto.items.length) {
        throw new ErrorValidacion('Una o más variantes no existen o fueron eliminadas');
      }
      const productosEliminados = variantes.filter(v => v.producto.eliminadoEn);
      if (productosEliminados.length > 0) {
        throw new ErrorValidacion(
          'Una o más variantes pertenecen a productos eliminados',
        );
      }

      const itemsConPrecio = dto.items.map(item => {
        const v = variantes.find(x => x.id === item.varianteId)!;
        const precioBase = Number(v.precioVenta ?? v.producto.precioVenta);
        const precio =
          item.precioUnitario !== undefined && item.precioUnitario !== null
            ? item.precioUnitario
            : precioBase;
        if (precio <= 0) {
          throw new ErrorValidacion(
            `El precio unitario debe ser mayor a 0 para "${v.producto.nombre}"`,
          );
        }
        const descuentoItem = item.descuento ?? 0;
        const bruto = precio * item.cantidad;
        if (descuentoItem > bruto) {
          throw new ErrorValidacion(
            `El descuento (${descuentoItem}) no puede exceder el subtotal del item (${bruto})`,
          );
        }
        const subtotal = bruto - descuentoItem;
        return {
          varianteId: v.id,
          descripcion: `${v.producto.nombre} · ${v.talla}/${v.color}`,
          cantidad: item.cantidad,
          precioUnitario: precio,
          descuento: descuentoItem,
          subtotal,
          productoId: v.productoId,
          categoriaId: v.producto.categoriaId,
        };
      });

      const subtotal = itemsConPrecio.reduce((s, i) => s + i.subtotal, 0);
      const descuento = dto.descuento ?? 0;
      const impuestos = dto.impuestos ?? 0;

      // ─── CUPÓN ────────────────────────────────────────────────────────
      let cuponAplicado: { id: string; codigo: string; descuento: number } | null = null;
      if (dto.codigoCupon && dto.codigoCupon.trim()) {
        const codigo = dto.codigoCupon.trim().toUpperCase();
        const cupon = await tx.cupon.findFirst({
          where: { codigo, eliminadoEn: null },
        });
        if (!cupon) {
          throw new ErrorValidacion(`El cupón "${codigo}" no existe`);
        }

        const [usosTotales, usosCliente] = await Promise.all([
          tx.cuponUso.count({ where: { cuponId: cupon.id } }),
          dto.clienteId
            ? tx.cuponUso.count({ where: { cuponId: cupon.id, clienteId: dto.clienteId } })
            : Promise.resolve(0),
        ]);

        const clasificacion = clienteRegistrado?.clasificacion ?? null;
        if (clienteRegistrado) {
          if (
            cupon.segmento === 'nuevos_clientes' &&
            Number(clienteRegistrado.totalCompras ?? 0) > 0
          ) {
            throw new ErrorValidacion('El cupón es solo para nuevos clientes');
          }
          if (cupon.segmento === 'reactivacion') {
            if (!clienteRegistrado.ultimaCompraEn) {
              throw new ErrorValidacion(
                'Cupón de reactivación no aplica: cliente nunca compró',
              );
            }
            const dias =
              (Date.now() - clienteRegistrado.ultimaCompraEn.getTime()) / 86400_000;
            if (dias < 60) {
              throw new ErrorValidacion(
                `Cupón de reactivación requiere 60+ días sin compras (actual: ${Math.floor(dias)})`,
              );
            }
          }
        }

        const carrito: ItemCarrito[] = itemsConPrecio.map(i => ({
          varianteId: i.varianteId,
          productoId: i.productoId,
          categoriaId: i.categoriaId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        }));

        const veredicto = this.motorCupones.evaluar({
          cupon: {
            estado: cupon.estado as never,
            eliminadoEn: cupon.eliminadoEn,
            fechaInicio: cupon.fechaInicio,
            fechaFin: cupon.fechaFin,
            tipoDescuento: cupon.tipoDescuento as never,
            valorDescuento: cupon.valorDescuento,
            montoMinimoCompra: cupon.montoMinimoCompra,
            descuentoMaximo: cupon.descuentoMaximo,
            usosMaximosTotal: cupon.usosMaximosTotal,
            usosMaximosPorCliente: cupon.usosMaximosPorCliente,
            segmento: cupon.segmento,
            clientesElegiblesIds: cupon.clientesElegiblesIds,
            aplicableA: cupon.aplicableA as never,
            categoriasAplicablesIds: cupon.categoriasAplicablesIds,
            productosAplicablesIds: cupon.productosAplicablesIds,
          },
          carrito,
          clienteIdSolicitante: dto.clienteId,
          clienteClasificacion: clasificacion,
          usosTotalesActuales: usosTotales,
          usosDelClienteActuales: usosCliente,
        });

        if (!veredicto.valido) {
          throw new ErrorValidacion(`Cupón rechazado: ${veredicto.mensaje}`);
        }
        cuponAplicado = { id: cupon.id, codigo: cupon.codigo, descuento: veredicto.descuento };
      }

      const descuentoCupon = cuponAplicado?.descuento ?? 0;
      const totalCalc = subtotal - descuento - descuentoCupon + impuestos;
      // Redondeo a 2 decimales para evitar drift por floats.
      const total = Math.max(0, Math.round(totalCalc * 100) / 100);
      if (subtotal - descuento - descuentoCupon < 0) {
        throw new ErrorValidacion(
          'Los descuentos exceden el subtotal — revisa montos',
        );
      }

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
          descuentoCupon,
          cuponId: cuponAplicado?.id ?? null,
          cuponCodigo: cuponAplicado?.codigo ?? null,
          impuestos,
          total,
          totalPagado,
          notas: dto.notas,
          sesionCajaId: dto.sesionCajaId,
          esNotaDeVenta: dto.esNotaDeVenta ?? false,
          items: {
            create: itemsConPrecio.map(({ productoId, categoriaId, ...rest }) => rest),
          },
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

      if (cuponAplicado) {
        await tx.cuponUso.create({
          data: {
            cuponId: cuponAplicado.id,
            clienteId: dto.clienteId ?? null,
            ventaId: venta.id,
            montoDescuento: new Prisma.Decimal(cuponAplicado.descuento),
            montoVenta: new Prisma.Decimal(total),
          },
        });
        await this.actualizarEstadoCuponSiAgotado(tx, cuponAplicado.id);
      }

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
    }, {
      // La transacción hace muchos pasos (lock + checks + crear venta + items
      // + pagos + cupón uso + ajuste inventario por item + update cliente).
      // Default de Prisma (5s) es insuficiente contra Azure prod, sobre todo
      // con varios items. 30s da margen sin tapar problemas reales.
      timeout: 30_000,
      maxWait: 10_000,
    });

    // ─── BEST-EFFORT: stamp tipoCpe + serie + correlativo ────────────────────
    // Fire-and-forget: la venta retorna ANTES de que el stamp termine.
    // Si la venta es nota de venta interna, NO se stampa (no hay CPE).
    // Si no hay serie configurada o falla cualquier cosa, la venta queda sin
    // stamp. emitirCpe se lo asignará posteriormente.
    if (!resultado.esNotaDeVenta) {
      this.stampearTipoCpeYSerie(resultado.id, ctx).catch(err => {
        this.logger.warn(
          `No se pudo asignar serie+correlativo a venta ${resultado.id}: ${err.message}`,
        );
      });
    }

    return resultado;
  }

  private async stampearTipoCpeYSerie(ventaId: string, ctx: TenantContext): Promise<void> {
    const prisma = this.prisma.forTenant(ctx);
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      select: { sucursalId: true, cliente: { select: { tipoDocumento: true } } },
    });
    if (!venta) return;

    const tipoCpe: TipoCpe =
      venta.cliente?.tipoDocumento === 'ruc' ? 'factura' : 'boleta';

    const serie = await this.serieCpeService.asignarProximoCorrelativoEnTenant(
      prisma,
      venta.sucursalId,
      tipoCpe,
    );

    await prisma.venta.update({
      where: { id: ventaId },
      data: { tipoCpe, serieCpeId: serie.serieCpeId, correlativo: serie.correlativo },
    });

    // Stamp exitoso: emitir evento para que VentaCreadaListener dispare auto-emisión CPE.
    this.eventEmitter.emit('venta.creada', { ventaId, tenantCode: ctx.codigo });
  }

  private async actualizarEstadoCuponSiAgotado(tx: Prisma.TransactionClient, cuponId: string) {
    const cupon = await tx.cupon.findUnique({ where: { id: cuponId }, select: { usosMaximosTotal: true, estado: true } });
    if (!cupon || cupon.usosMaximosTotal == null) return;
    const usos = await tx.cuponUso.count({ where: { cuponId } });
    if (usos >= cupon.usosMaximosTotal && cupon.estado !== 'agotado') {
      await tx.cupon.update({ where: { id: cuponId }, data: { estado: 'agotado' } });
    }
  }

  async anular(id: string, motivo: string, ctx: TenantContext, usuarioId: string) {
    const motivoLimpio = motivo?.trim();
    if (!motivoLimpio) throw new ErrorValidacion('Debes indicar el motivo de la anulación');
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => {
      const venta = await tx.venta.findFirst({
        where: { id },
        include: { items: true, cuponUso: true },
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
          motivo: `Anulación venta ${venta.numero}: ${motivoLimpio}`,
          usuarioId,
        });
      }

      // Liberar uso de cupón si lo había (el cliente puede volver a usarlo)
      if (venta.cuponUso) {
        await tx.cuponUso.delete({ where: { id: venta.cuponUso.id } });
        // Si el cupón estaba marcado como agotado pero ahora hay cupo, revertir a activo
        const cupon = await tx.cupon.findUnique({
          where: { id: venta.cuponUso.cuponId },
          select: { estado: true, usosMaximosTotal: true, fechaFin: true },
        });
        if (cupon && cupon.estado === 'agotado' && cupon.fechaFin > new Date()) {
          await tx.cupon.update({ where: { id: venta.cuponUso.cuponId }, data: { estado: 'activo' } });
        }
      }

      // Revertir agregados del cliente: total y "última compra".
      if (venta.clienteId) {
        const totalVenta = new Prisma.Decimal(venta.total);
        await tx.cliente.update({
          where: { id: venta.clienteId },
          data: { totalCompras: { decrement: totalVenta } },
        });
        // Recalcular ultimaCompraEn como la fecha de la última venta NO anulada del cliente.
        const previa = await tx.venta.findFirst({
          where: {
            clienteId: venta.clienteId,
            anuladaEn: null,
            id: { not: venta.id },
          },
          orderBy: { creadoEn: 'desc' },
          select: { creadoEn: true },
        });
        await tx.cliente.update({
          where: { id: venta.clienteId },
          data: { ultimaCompraEn: previa?.creadoEn ?? null },
        });
      }

      return tx.venta.update({
        where: { id },
        data: {
          estado: 'anulada',
          anuladaEn: new Date(),
          motivoAnulacion: motivoLimpio,
        },
      });
    }, { timeout: 30_000, maxWait: 10_000 });
  }

  private async siguienteNumero(tx: Prisma.TransactionClient): Promise<string> {
    // Ordenar por número (no por creadoEn) para que un alta manual atrasada
    // no rompa el correlativo.
    const ultima = await tx.venta.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const n = ultima ? parseInt(ultima.numero.replace(/\D/g, ''), 10) + 1 : 1;
    return `V-${String(n).padStart(6, '0')}`;
  }

  /**
   * Registra un pago adicional sobre una venta existente.
   * Recalcula `totalPagado` y promueve `estado` (parcial → pagada).
   */
  async registrarPago(
    ventaId: string,
    dto: { medio: string; monto: number; referencia?: string; sesionCajaId?: string },
    ctx: TenantContext,
    usuarioId: string,
  ) {
    if (!dto.monto || dto.monto <= 0) {
      throw new ErrorValidacion('El monto debe ser mayor a 0');
    }
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => {
      const venta = await tx.venta.findFirst({
        where: { id: ventaId, eliminadoEn: null },
        select: {
          id: true,
          numero: true,
          estado: true,
          total: true,
          totalPagado: true,
          sucursalId: true,
        },
      });
      if (!venta) throw new ErrorNoEncontrado('Venta no encontrada');
      if (venta.estado === 'anulada') {
        throw new ErrorConflicto('No se puede registrar pago en una venta anulada');
      }
      if (venta.estado === 'pagada') {
        throw new ErrorConflicto('La venta ya está totalmente pagada');
      }

      // Validar sesión de caja igual que en crear()
      if (dto.sesionCajaId) {
        const sesion = await tx.sesionCaja.findUnique({
          where: { id: dto.sesionCajaId },
          select: { id: true, estado: true, sucursalId: true, cajeroId: true },
        });
        if (!sesion) throw new ErrorNoEncontrado('Sesión de caja no encontrada');
        if (sesion.estado !== 'abierta') {
          throw new ErrorConflicto('La sesión de caja está cerrada');
        }
        if (sesion.sucursalId !== venta.sucursalId) {
          throw new ErrorValidacion('La sesión de caja pertenece a otra sucursal');
        }
        if (sesion.cajeroId !== usuarioId) {
          throw new ErrorValidacion('La sesión de caja pertenece a otro cajero');
        }
      }

      const pendiente = Number(venta.total) - Number(venta.totalPagado);
      if (dto.monto > pendiente + 0.01) {
        throw new ErrorConflicto(
          `El monto (${dto.monto}) excede lo pendiente (${pendiente.toFixed(2)})`,
        );
      }

      const pago = await tx.ventaPago.create({
        data: {
          ventaId: venta.id,
          medio: dto.medio as MedioPago,
          monto: dto.monto,
          referencia: dto.referencia,
        },
      });

      const totalPagadoNuevo = Math.round((Number(venta.totalPagado) + dto.monto) * 100) / 100;
      const nuevoEstado: EstadoVenta =
        totalPagadoNuevo >= Number(venta.total) - 0.01 ? 'pagada' : 'parcial';

      await tx.venta.update({
        where: { id: venta.id },
        data: { totalPagado: totalPagadoNuevo, estado: nuevoEstado },
      });

      return { ventaId: venta.id, pago, estado: nuevoEstado, totalPagado: totalPagadoNuevo };
    });
  }
}
