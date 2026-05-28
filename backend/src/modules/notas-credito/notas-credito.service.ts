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
import { SerieCpeService } from '../facturacion-electronica/series-cpe/series-cpe.service';
import { TipoCpe } from '../../core/sunat/codigos';
import { AppEventEmitter } from '../../core/events/app-event-emitter';
import { CrearNotaCreditoDto } from './dto/crear-nota-credito.dto';

// Lock advisory (estable por tenant) para serializar generación del número NC.
const LOCK_KEY_NUMERO_NC = 8_372_481_003;

/**
 * Estados del CPE original (factura/boleta) sobre los que SE PUEDE emitir NC.
 * No tiene sentido emitir NC sobre un CPE rechazado por SUNAT o ya anulado.
 */
const ESTADOS_CPE_HABILITAN_NC: ReadonlySet<string> = new Set([
  'pendiente',
  'en_proceso',
  'aceptado',
  'aceptado_observado',
]);

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
    private readonly serieCpeService: SerieCpeService,
    private readonly eventEmitter: AppEventEmitter,
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
    const nota = await cliente.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY_NUMERO_NC})`;

      const venta = await tx.venta.findFirst({
        where: { id: dto.ventaId, eliminadoEn: null },
        include: {
          items: true,
          notasCredito: {
            where: { eliminadoEn: null, estado: 'emitida' },
            include: { items: { select: { ventaItemId: true, cantidad: true } } },
          },
          documentoElectronico: true,
        },
      });
      if (!venta) throw new ErrorNoEncontrado('Venta no encontrada');
      if (venta.estado === 'anulada') {
        throw new ErrorConflicto('No se puede emitir NC sobre venta anulada');
      }

      // ─── Validación SUNAT: tipo del CPE original ──────────────────────────
      //
      // Hay dos modos según si el tenant tiene facturación electrónica activa:
      //   A) Tenant CON ConfiguracionFacturacion (usa fac elec):
      //      - La venta DEBE tener CPE emitido para poder emitir NC. Si no lo
      //        tiene → ErrorConflicto pidiendo emitir CPE primero. Sin esto
      //        las NC se crearían en "limbo fiscal" (sin serie/correlativo),
      //        imposibles de enviar a SUNAT después.
      //      - Si tiene CPE, se valida estado y se asigna serie de NC.
      //   B) Tenant SIN ConfiguracionFacturacion (no usa fac elec):
      //      - Flujo legacy: la NC se crea sin campos SUNAT. Útil para tenants
      //        que aún no configuraron facturación o están migrando.
      const configFac = await tx.configuracionFacturacion.findFirst();
      const tenantUsaFacElec = configFac !== null;
      const docOriginal = venta.documentoElectronico;

      if (tenantUsaFacElec && !docOriginal) {
        throw new ErrorConflicto(
          `No se puede emitir la nota de crédito: la venta ${venta.numero} no tiene comprobante electrónico emitido. ` +
            `Emita primero el comprobante (factura o boleta) desde la pantalla de ventas, ` +
            `y luego registre la nota de crédito.`,
        );
      }

      let datosSunat: {
        tipoCpe: TipoCpe;
        serieCpeId: string;
        serie: string;
        correlativo: string;
        tipoCpeOriginal: TipoCpe;
        serieCpeOriginal: string;
        correlativoCpeOriginal: string;
      } | null = null;

      if (docOriginal) {
        if (docOriginal.tipoCpe !== 'factura' && docOriginal.tipoCpe !== 'boleta') {
          // El comprobante original debería ser factura o boleta — nunca NC, ND, guía.
          // Defensa por si en el futuro el modelo permite otros tipos en ventas.
          throw new ErrorValidacion(
            `El comprobante electrónico original de la venta es '${docOriginal.tipoCpe}', se esperaba factura o boleta`,
          );
        }
        if (!ESTADOS_CPE_HABILITAN_NC.has(docOriginal.estadoSunat)) {
          throw new ErrorConflicto(
            `No se puede emitir la nota de crédito: el comprobante original (${docOriginal.tipoCpe} ${docOriginal.serie}-${docOriginal.correlativo}) ` +
              `está en estado '${docOriginal.estadoSunat}'. Solo se permite sobre estados: ` +
              `${Array.from(ESTADOS_CPE_HABILITAN_NC).join(', ')}.`,
          );
        }
        const aplicaA: TipoCpe = docOriginal.tipoCpe;
        // Asignación inline (no podemos usar serieCpeService porque anidaría
        // $transaction). El lock advisory ya tomado al inicio de la outer tx
        // serializa la asignación del correlativo a nivel tenant.
        const serieNc = await tx.serieCpe.findFirst({
          where: {
            sucursalId: venta.sucursalId,
            tipoCpe: 'nota_credito',
            aplicaA,
          },
        });
        if (!serieNc) {
          throw new ErrorValidacion(
            `No hay una serie de Nota de Crédito para ${aplicaA} en esta sucursal. ` +
              `Configure una en Configuración → Series de comprobantes antes de emitir la nota de crédito.`,
          );
        }
        const actualizada = await tx.serieCpe.update({
          where: { id: serieNc.id },
          data: { correlativoActual: { increment: 1 } },
        });
        datosSunat = {
          tipoCpe: 'nota_credito',
          serieCpeId: serieNc.id,
          serie: serieNc.serie,
          correlativo: String(actualizada.correlativoActual).padStart(8, '0'),
          tipoCpeOriginal: aplicaA,
          serieCpeOriginal: docOriginal.serie,
          correlativoCpeOriginal: docOriginal.correlativo,
        };
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
          // Datos SUNAT — solo se llenan si la venta tenía CPE emitido.
          ...(datosSunat
            ? {
                tipoCpe: datosSunat.tipoCpe,
                serieCpeId: datosSunat.serieCpeId,
                correlativo: datosSunat.correlativo,
                tipoCpeOriginal: datosSunat.tipoCpeOriginal,
                serieCpeOriginal: datosSunat.serieCpeOriginal,
                correlativoCpeOriginal: datosSunat.correlativoCpeOriginal,
              }
            : {}),
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

    // Emitir DESPUÉS del commit. El listener decidirá si emite CPE
    // (solo si el tenant tiene facElec activa y la NC tiene datos SUNAT).
    this.eventEmitter.emit('nota-credito.creada', {
      notaCreditoId: nota.id,
      tenantCode: ctx.codigo,
    });

    return nota;
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
