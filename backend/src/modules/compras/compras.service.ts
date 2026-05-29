import { Injectable } from '@nestjs/common';
import {
  Prisma,
  EstadoCompra,
  EstadoPagoCompra,
  MedioPago,
  TipoComprobanteCompra,
  CondicionPago,
  TipoMovimientoStock,
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
import { InventarioService } from '../inventario/inventario.service';
import { AsientosService } from '../contabilidad/asientos.service';
import {
  CrearCompraDto,
  RegistrarPagoCompraDto,
} from './dto/crear-compra.dto';
import { aPEN, costoUnitarioPEN, normalizarMoneda } from './compras.moneda';

const D = (n: Prisma.Decimal | number | string | null | undefined): number =>
  n == null ? 0 : typeof n === 'number' ? n : Number(n.toString());

interface ListarQuery extends PaginacionDto {
  proveedorId?: string;
  sucursalId?: string;
  estado?: EstadoCompra;
  estadoPago?: EstadoPagoCompra;
  desde?: string;
  hasta?: string;
}

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaTenantService,
    private readonly inventario: InventarioService,
    private readonly asientos: AsientosService,
  ) {}

  async listar(query: ListarQuery, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const cliente = this.prisma.forTenant(ctx);
    const where: Prisma.CompraWhereInput = { eliminadoEn: null };
    if (query.proveedorId) where.proveedorId = query.proveedorId;
    if (query.sucursalId) where.sucursalId = query.sucursalId;
    if (query.estado) where.estado = query.estado;
    if (query.estadoPago) where.estadoPago = query.estadoPago;
    if (query.desde || query.hasta) {
      where.fechaEmision = {};
      if (query.desde) (where.fechaEmision as any).gte = new Date(query.desde);
      if (query.hasta) (where.fechaEmision as any).lte = new Date(query.hasta);
    }
    const busqueda = construirBusquedaWordSplit(query.buscar, [
      'numero',
      'serie',
      'numeroComprobante',
      'proveedor.razonSocial',
      'proveedor.documento',
    ]);
    if (busqueda) Object.assign(where, busqueda);

    const [datos, total] = await Promise.all([
      cliente.compra.findMany({
        where,
        skip,
        take,
        orderBy: { fechaEmision: 'desc' },
        include: {
          proveedor: { select: { id: true, razonSocial: true, documento: true } },
          sucursal: { select: { id: true, nombre: true } },
          _count: { select: { items: true, pagos: true } },
        },
      }),
      cliente.compra.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async cuentasPorPagar(ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const hoy = new Date();
    const compras = await cliente.compra.findMany({
      where: {
        estado: 'recibida',
        estadoPago: { in: ['pendiente', 'parcial', 'vencida'] },
        eliminadoEn: null,
      },
      orderBy: { fechaVencimiento: 'asc' },
      include: { proveedor: { select: { id: true, razonSocial: true, documento: true } } },
    });
    const filas = compras.map(c => {
      const saldo = D(c.total) - D(c.totalPagado);
      // saldoPen normaliza para los totales (un proveedor puede deber en PEN y USD).
      const saldoPen = aPEN(saldo, D(c.tipoCambio));
      const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento) : null;
      const diasVencido = venc ? Math.floor((hoy.getTime() - venc.getTime()) / 86400000) : 0;
      return {
        id: c.id,
        numero: c.numero,
        comprobante: `${c.serie}-${c.numeroComprobante}`,
        proveedor: c.proveedor,
        fechaEmision: c.fechaEmision,
        fechaVencimiento: c.fechaVencimiento,
        moneda: c.moneda,
        tipoCambio: D(c.tipoCambio),
        total: D(c.total),
        totalPagado: D(c.totalPagado),
        saldo,
        saldoPen,
        diasVencido: diasVencido > 0 ? diasVencido : 0,
        estado: c.estadoPago,
      };
    });
    return {
      datos: filas,
      totales: {
        // En PEN: mezclar monedas en un único total no tendría sentido.
        porPagar: round2(filas.reduce((s, f) => s + f.saldoPen, 0)),
        vencido: round2(
          filas.filter(f => f.diasVencido > 0).reduce((s, f) => s + f.saldoPen, 0),
        ),
      },
    };
  }

  async obtener(id: string, ctx: TenantContext) {
    const compra = await this.prisma.forTenant(ctx).compra.findFirst({
      where: { id, eliminadoEn: null },
      include: {
        items: { include: { variante: { include: { producto: true } } } },
        pagos: { where: { eliminadoEn: null }, orderBy: { fechaPago: 'desc' } },
        proveedor: true,
        sucursal: true,
      },
    });
    if (!compra) throw new ErrorNoEncontrado('Compra no encontrada');
    return compra;
  }

  async crear(dto: CrearCompraDto, ctx: TenantContext, usuarioId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new ErrorValidacion('La compra debe tener al menos un item');
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

      const proveedor = await tx.proveedor.findFirst({
        where: { id: dto.proveedorId, eliminadoEn: null },
      });
      if (!proveedor) throw new ErrorValidacion('Proveedor no existe');

      // Moneda + TC: PEN fuerza tc=1; USD exige tc>0. Los montos de la compra
      // quedan en moneda original; PEN se deriva donde haga falta (costo, asiento,
      // deuda del proveedor).
      const { moneda, tipoCambio } = normalizarMoneda(dto);

      const items = dto.items.map(item => {
        const v = variantes.find(x => x.id === item.varianteId)!;
        const subtotal = round2(item.costoUnitario * item.cantidad - (item.descuento ?? 0));
        return {
          varianteId: v.id,
          descripcion: `${v.producto.nombre} · ${v.talla}/${v.color}`,
          cantidad: item.cantidad,
          costoUnitario: item.costoUnitario,
          descuento: item.descuento ?? 0,
          subtotal,
        };
      });

      const descuento = dto.descuento ?? 0;
      const subtotalNeto = round2(items.reduce((s, i) => s + i.subtotal, 0) - descuento);
      const igv = dto.igv !== undefined ? round2(dto.igv) : round2(subtotalNeto * 0.18);
      const otros = dto.otrosImpuestos ?? 0;
      const total = round2(subtotalNeto + igv + otros);

      const condicionPago = (dto.condicionPago ?? proveedor.condicionPago) as CondicionPago;
      const esContado = condicionPago === 'contado';
      const fechaEmision = new Date(dto.fechaEmision);
      const fechaRecepcion = dto.fechaRecepcion ? new Date(dto.fechaRecepcion) : fechaEmision;
      const fechaVencimiento =
        !esContado && dto.fechaVencimiento
          ? new Date(dto.fechaVencimiento)
          : !esContado
            ? new Date(fechaEmision.getTime() + (proveedor.diasCredito || 30) * 86400000)
            : null;

      const numero = await this.siguienteNumero(tx);
      const confirmar = dto.confirmar ?? true;

      const compra = await tx.compra.create({
        data: {
          numero,
          proveedorId: dto.proveedorId,
          sucursalId: dto.sucursalId,
          tipoComprobante: dto.tipoComprobante as TipoComprobanteCompra,
          serie: dto.serie,
          numeroComprobante: dto.numeroComprobante,
          fechaEmision,
          fechaRecepcion,
          moneda,
          tipoCambio,
          subtotal: subtotalNeto,
          igv,
          otrosImpuestos: otros,
          descuento,
          total,
          estado: confirmar ? 'recibida' : 'borrador',
          condicionPago,
          fechaVencimiento,
          notas: dto.notas,
          usuarioId,
          items: { create: items },
        },
        include: { items: true, proveedor: true },
      });

      if (!confirmar) return compra;

      // 1. Ingreso de stock por cada item + actualizar costo promedio
      for (const item of items) {
        await this.inventario.ajustarEnTx(tx, {
          varianteId: item.varianteId,
          sucursalId: dto.sucursalId,
          delta: item.cantidad,
          tipo: TipoMovimientoStock.ingreso_compra,
          referenciaTipo: 'Compra',
          referenciaId: compra.id,
          motivo: `Compra ${numero}`,
          usuarioId,
        });
        // El costo que alimenta el promedio del inventario SIEMPRE va en PEN.
        await this.recalcularCostoPromedio(
          tx,
          item.varianteId,
          item.cantidad,
          costoUnitarioPEN(item.costoUnitario, tipoCambio),
        );
      }

      // 2. Pagos iniciales si vienen
      let totalPagado = 0;
      const medioPrincipalCompra = dto.pagos?.[0]?.medio ?? 'efectivo';
      if (dto.pagos && dto.pagos.length > 0) {
        for (const p of dto.pagos) {
          await tx.pagoCompra.create({
            data: {
              compraId: compra.id,
              medio: p.medio as MedioPago,
              monto: p.monto,
              referencia: p.referencia,
              fechaPago: p.fechaPago ? new Date(p.fechaPago) : fechaRecepcion,
              usuarioId,
            },
          });
          totalPagado += p.monto;
        }
      }
      if (esContado && totalPagado < total - 0.01 && !dto.pagos?.length) {
        // Contado sin pagos explícitos: registramos un único pago en efectivo
        await tx.pagoCompra.create({
          data: {
            compraId: compra.id,
            medio: 'efectivo',
            monto: total,
            fechaPago: fechaRecepcion,
            usuarioId,
          },
        });
        totalPagado = total;
      }

      const estadoPago: EstadoPagoCompra =
        totalPagado >= total - 0.01
          ? 'pagada'
          : totalPagado > 0
            ? 'parcial'
            : 'pendiente';

      await tx.compra.update({
        where: { id: compra.id },
        data: { totalPagado, estadoPago },
      });

      // 3. Actualizar agregados del proveedor (acumuladores globales → PEN)
      await tx.proveedor.update({
        where: { id: dto.proveedorId },
        data: {
          totalComprado: { increment: aPEN(total, tipoCambio) },
          deudaActual: { increment: aPEN(total - totalPagado, tipoCambio) },
          ultimaCompraEn: new Date(),
        },
      });

      // 4. Asiento contable de la compra (+ destino existencias) — en PEN.
      await this.asientos.generarPorCompra(tx, {
        compraId: compra.id,
        numero,
        fecha: fechaEmision,
        subtotal: aPEN(subtotalNeto, tipoCambio),
        igv: aPEN(igv, tipoCambio),
        total: aPEN(total, tipoCambio),
        esContado,
        medioPago: esContado ? medioPrincipalCompra : undefined,
        proveedorDoc: { tipo: proveedor.tipoDocumento, numero: proveedor.documento },
        docTipo: tipoCompSunat(dto.tipoComprobante),
        docNumero: `${dto.serie}-${dto.numeroComprobante}`,
        moneda,
        tipoCambio,
        usuarioId,
      });

      return tx.compra.findUnique({
        where: { id: compra.id },
        include: { items: true, pagos: true, proveedor: true },
      });
    });
  }

  async registrarPago(
    compraId: string,
    dto: RegistrarPagoCompraDto,
    ctx: TenantContext,
    usuarioId: string,
  ) {
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => {
      const compra = await tx.compra.findFirst({
        where: { id: compraId, eliminadoEn: null },
        include: { proveedor: true },
      });
      if (!compra) throw new ErrorNoEncontrado('Compra no encontrada');
      if (compra.estado !== 'recibida') {
        throw new ErrorConflicto('Solo se puede pagar una compra recibida');
      }
      const saldo = D(compra.total) - D(compra.totalPagado);
      if (dto.monto > saldo + 0.01) {
        throw new ErrorConflicto(`Monto excede el saldo pendiente (S/ ${saldo.toFixed(2)})`);
      }

      const fechaPago = dto.fechaPago ? new Date(dto.fechaPago) : new Date();

      const pago = await tx.pagoCompra.create({
        data: {
          compraId,
          medio: dto.medio as MedioPago,
          monto: dto.monto,
          referencia: dto.referencia,
          fechaPago,
          sesionCajaId: dto.sesionCajaId,
          usuarioId,
          notas: dto.notas,
        },
      });

      const nuevoTotalPagado = D(compra.totalPagado) + dto.monto;
      const estadoPago: EstadoPagoCompra =
        nuevoTotalPagado >= D(compra.total) - 0.01 ? 'pagada' : 'parcial';

      await tx.compra.update({
        where: { id: compraId },
        data: { totalPagado: nuevoTotalPagado, estadoPago },
      });

      // El pago se guarda en la moneda original (arriba), pero deuda, caja y
      // asiento se llevan en PEN con el TC de la compra.
      const montoPen = aPEN(dto.monto, D(compra.tipoCambio));

      await tx.proveedor.update({
        where: { id: compra.proveedorId },
        data: { deudaActual: { decrement: montoPen } },
      });

      if (dto.sesionCajaId) {
        // La caja maneja ambas monedas: el movimiento se registra en la moneda
        // ORIGINAL de la compra (la deuda y el asiento sí van en PEN).
        await tx.movimientoCaja.create({
          data: {
            sesionId: dto.sesionCajaId,
            tipo: 'egreso',
            categoria: 'pago_proveedor',
            medio: dto.medio as MedioPago,
            moneda: compra.moneda,
            monto: dto.monto,
            motivo: `Pago compra ${compra.numero}`,
            contraparte: compra.proveedor.razonSocial,
            contraparteTipo: 'proveedor',
            creadoPorId: usuarioId,
          },
        });
      }

      await this.asientos.generarPorPagoCompra(tx, {
        pagoId: pago.id,
        compraNumero: compra.numero,
        fecha: fechaPago,
        monto: montoPen,
        medio: dto.medio,
        proveedorDoc: {
          tipo: compra.proveedor.tipoDocumento,
          numero: compra.proveedor.documento,
        },
        moneda: compra.moneda,
        tipoCambio: D(compra.tipoCambio),
        usuarioId,
      });

      return pago;
    });
  }

  async anular(id: string, motivo: string, ctx: TenantContext, usuarioId: string) {
    const cliente = this.prisma.forTenant(ctx);
    return cliente.$transaction(async tx => {
      const compra = await tx.compra.findFirst({
        where: { id, eliminadoEn: null },
        include: { items: true, pagos: { where: { eliminadoEn: null } } },
      });
      if (!compra) throw new ErrorNoEncontrado('Compra no encontrada');
      if (compra.estado === 'anulada') throw new ErrorConflicto('La compra ya está anulada');
      if (compra.pagos.length > 0) {
        throw new ErrorConflicto(
          'No se puede anular una compra con pagos registrados. Reversa los pagos primero.',
        );
      }

      // Reversa de stock
      for (const item of compra.items) {
        await this.inventario.ajustarEnTx(tx, {
          varianteId: item.varianteId,
          sucursalId: compra.sucursalId,
          delta: -item.cantidad,
          tipo: TipoMovimientoStock.egreso_ajuste,
          referenciaTipo: 'CompraAnulada',
          referenciaId: compra.id,
          motivo: `Anulación compra ${compra.numero}: ${motivo}`,
          usuarioId,
        });
      }

      // Reversa de asientos contables de la compra
      const asientos = await tx.asientoContable.findMany({
        where: {
          origenId: compra.id,
          origenTipo: { in: ['compra', 'compra_destino'] },
          estado: 'asentado',
        },
      });
      for (const a of asientos) {
        await this.asientos.reversar(a.id, `Anulación compra ${compra.numero}`, ctx, usuarioId)
          .catch(() => undefined);
      }

      // Mismo criterio PEN que el incremento de crear(), si no la deuda se
      // desincroniza permanentemente.
      const tc = D(compra.tipoCambio);
      await tx.proveedor.update({
        where: { id: compra.proveedorId },
        data: {
          totalComprado: { decrement: aPEN(D(compra.total), tc) },
          deudaActual: { decrement: aPEN(D(compra.total) - D(compra.totalPagado), tc) },
        },
      });

      return tx.compra.update({
        where: { id },
        data: {
          estado: 'anulada',
          anuladaEn: new Date(),
          motivoAnulacion: motivo,
        },
      });
    });
  }

  // ─── Helpers privados ──────────────────────────────────────────────

  /** Costo promedio ponderado por variante, propagado al producto. */
  private async recalcularCostoPromedio(
    tx: Prisma.TransactionClient,
    varianteId: string,
    cantidadIngresada: number,
    costoIngresado: number,
  ) {
    const variante = await tx.variante.findUnique({
      where: { id: varianteId },
      include: { producto: true, stocks: true },
    });
    if (!variante) return;
    const stockTotal = variante.stocks.reduce((s, x) => s + x.disponible, 0);
    const stockAntes = stockTotal - cantidadIngresada;
    const costoActual = D(variante.producto.precioCompra);
    if (stockAntes <= 0) {
      await tx.producto.update({
        where: { id: variante.productoId },
        data: { precioCompra: round2(costoIngresado) },
      });
      return;
    }
    const nuevo =
      (stockAntes * costoActual + cantidadIngresada * costoIngresado) /
      (stockAntes + cantidadIngresada);
    await tx.producto.update({
      where: { id: variante.productoId },
      data: { precioCompra: round2(nuevo) },
    });
  }

  private async siguienteNumero(tx: Prisma.TransactionClient): Promise<string> {
    const anio = new Date().getFullYear();
    const prefijo = `C-${anio}-`;
    const ultima = await tx.compra.findFirst({
      where: { numero: { startsWith: prefijo } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const n = ultima ? parseInt(ultima.numero.slice(prefijo.length), 10) + 1 : 1;
    return `${prefijo}${String(n).padStart(5, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function tipoCompSunat(t: string): string {
  switch (t) {
    case 'factura': return '01';
    case 'boleta': return '03';
    case 'nota_ingreso': return '50';
    case 'guia_remision': return '09';
    case 'recibo_honorarios': return '02';
    default: return '00';
  }
}
