import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorConflicto, ErrorNoEncontrado } from '../../core/errors/errores';
import {
  obtenerPaginacion,
  PaginacionDto,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';

const D = (n: Prisma.Decimal | number | string | null | undefined): number =>
  n == null ? 0 : typeof n === 'number' ? n : Number(n.toString());

@Injectable()
export class ContabilidadService {
  constructor(private readonly prisma: PrismaTenantService) {}

  // ─── Plan de cuentas ───────────────────────────────────────────────

  async planCuentas(ctx: TenantContext) {
    return this.prisma.forTenant(ctx).planCuenta.findMany({
      where: { activa: true },
      orderBy: { codigo: 'asc' },
    });
  }

  // ─── Asientos ──────────────────────────────────────────────────────

  async listarAsientos(
    query: PaginacionDto & { periodoId?: string; origenTipo?: string },
    ctx: TenantContext,
  ) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.AsientoContableWhereInput = {};
    if (query.periodoId) where.periodoId = query.periodoId;
    if (query.origenTipo) where.origenTipo = query.origenTipo;
    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.asientoContable.findMany({
        where,
        skip,
        take,
        orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
        include: {
          detalles: { include: { cuenta: { select: { codigo: true, nombre: true } } } },
          periodo: true,
        },
      }),
      cliente.asientoContable.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async obtenerAsiento(id: string, ctx: TenantContext) {
    const asiento = await this.prisma.forTenant(ctx).asientoContable.findFirst({
      where: { id },
      include: {
        detalles: {
          orderBy: { orden: 'asc' },
          include: { cuenta: true },
        },
        periodo: true,
      },
    });
    if (!asiento) throw new ErrorNoEncontrado('Asiento no encontrado');
    return asiento;
  }

  // ─── Libro Diario ──────────────────────────────────────────────────

  async libroDiario(anio: number, mes: number, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const periodo = await cliente.periodoContable.findUnique({
      where: { anio_mes: { anio, mes } },
    });
    if (!periodo) return { periodo: { anio, mes, estado: 'abierto' as const }, asientos: [], totales: { debe: 0, haber: 0 } };

    const asientos = await cliente.asientoContable.findMany({
      where: { periodoId: periodo.id, estado: { not: 'anulado' } },
      orderBy: [{ fecha: 'asc' }, { numero: 'asc' }],
      include: {
        detalles: {
          orderBy: { orden: 'asc' },
          include: { cuenta: { select: { codigo: true, nombre: true } } },
        },
      },
    });

    const totalDebe = asientos.reduce((s, a) => s + D(a.totalDebe), 0);
    const totalHaber = asientos.reduce((s, a) => s + D(a.totalHaber), 0);

    return {
      periodo,
      asientos,
      totales: { debe: totalDebe, haber: totalHaber },
    };
  }

  // ─── Libro Mayor ───────────────────────────────────────────────────

  async libroMayor(
    cuentaCodigo: string,
    anio: number,
    mes: number,
    ctx: TenantContext,
  ) {
    const cliente = this.prisma.forTenant(ctx);
    const cuenta = await cliente.planCuenta.findUnique({ where: { codigo: cuentaCodigo } });
    if (!cuenta) throw new ErrorNoEncontrado('Cuenta no existe');

    // Saldo inicial: suma de movimientos hasta el período anterior
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const saldoAnterior = await cliente.asientoDetalle.aggregate({
      where: {
        cuentaCodigo,
        asiento: { fecha: { lt: inicio }, estado: { not: 'anulado' } },
      },
      _sum: { debe: true, haber: true },
    });

    const movimientos = await cliente.asientoDetalle.findMany({
      where: {
        cuentaCodigo,
        asiento: { fecha: { gte: inicio, lte: fin }, estado: { not: 'anulado' } },
      },
      orderBy: { asiento: { fecha: 'asc' } },
      include: { asiento: { select: { numero: true, fecha: true, glosa: true } } },
    });

    const saldoInicial =
      cuenta.naturaleza === 'deudora'
        ? D(saldoAnterior._sum.debe) - D(saldoAnterior._sum.haber)
        : D(saldoAnterior._sum.haber) - D(saldoAnterior._sum.debe);

    let saldo = saldoInicial;
    const filas = movimientos.map(m => {
      const debe = D(m.debe);
      const haber = D(m.haber);
      saldo += cuenta.naturaleza === 'deudora' ? debe - haber : haber - debe;
      return {
        fecha: m.asiento.fecha,
        asientoNumero: m.asiento.numero,
        glosa: m.glosa ?? m.asiento.glosa,
        debe,
        haber,
        saldo,
      };
    });

    return {
      cuenta,
      saldoInicial,
      filas,
      totales: {
        debe: filas.reduce((s, f) => s + f.debe, 0),
        haber: filas.reduce((s, f) => s + f.haber, 0),
        saldoFinal: saldo,
      },
    };
  }

  // ─── Registro de Ventas (PLE 14.1) ─────────────────────────────────

  async registroVentas(anio: number, mes: number, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const ventas = await cliente.venta.findMany({
      where: {
        creadoEn: { gte: inicio, lte: fin },
        estado: { not: 'anulada' },
      },
      orderBy: { creadoEn: 'asc' },
      include: {
        cliente: { select: { tipoDocumento: true, documento: true, nombre: true } },
      },
    });

    const filas = ventas.map(v => {
      const total = D(v.total);
      const base = round2(total / 1.18);
      const igv = round2(total - base);
      return {
        fecha: v.creadoEn,
        comprobante: v.numero,
        tipoDoc: v.cliente?.tipoDocumento ?? '-',
        docCliente: v.cliente?.documento ?? '-',
        nombreCliente: v.cliente?.nombre ?? 'Consumidor final',
        baseImponible: base,
        igv,
        total,
      };
    });

    return {
      periodo: { anio, mes },
      filas,
      totales: {
        baseImponible: filas.reduce((s, f) => s + f.baseImponible, 0),
        igv: filas.reduce((s, f) => s + f.igv, 0),
        total: filas.reduce((s, f) => s + f.total, 0),
      },
    };
  }

  // ─── Registro de Compras (PLE 8.1) ─────────────────────────────────

  async registroCompras(anio: number, mes: number, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59);

    const compras = await cliente.compra.findMany({
      where: {
        fechaEmision: { gte: inicio, lte: fin },
        estado: 'recibida',
        eliminadoEn: null,
      },
      orderBy: { fechaEmision: 'asc' },
      include: {
        proveedor: { select: { tipoDocumento: true, documento: true, razonSocial: true } },
      },
    });

    const filas = compras.map(c => ({
      fechaEmision: c.fechaEmision,
      fechaRecepcion: c.fechaRecepcion,
      tipoComprobante: c.tipoComprobante,
      serie: c.serie,
      numero: c.numeroComprobante,
      tipoDoc: c.proveedor.tipoDocumento,
      docProveedor: c.proveedor.documento,
      razonSocial: c.proveedor.razonSocial,
      baseImponible: D(c.subtotal),
      igv: D(c.igv),
      total: D(c.total),
      moneda: c.moneda,
    }));

    return {
      periodo: { anio, mes },
      filas,
      totales: {
        baseImponible: filas.reduce((s, f) => s + f.baseImponible, 0),
        igv: filas.reduce((s, f) => s + f.igv, 0),
        total: filas.reduce((s, f) => s + f.total, 0),
      },
    };
  }

  // ─── Estado de Resultados ──────────────────────────────────────────

  async estadoResultados(desde: Date, hasta: Date, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const agregados = await cliente.asientoDetalle.groupBy({
      by: ['cuentaCodigo'],
      where: { asiento: { fecha: { gte: desde, lte: hasta }, estado: { not: 'anulado' } } },
      _sum: { debe: true, haber: true },
    });
    const cuentas = await cliente.planCuenta.findMany({
      where: { codigo: { in: agregados.map(a => a.cuentaCodigo) } },
    });
    const porCodigo = new Map(cuentas.map(c => [c.codigo, c]));

    let ingresos = 0;
    let costoVentas = 0;
    let gastos = 0;
    for (const a of agregados) {
      const c = porCodigo.get(a.cuentaCodigo);
      if (!c) continue;
      const debe = D(a._sum.debe);
      const haber = D(a._sum.haber);
      if (c.tipo === 'ingreso') ingresos += haber - debe;
      if (c.tipo === 'costo') costoVentas += debe - haber;
      if (c.tipo === 'gasto') gastos += debe - haber;
    }
    const utilidadBruta = ingresos - costoVentas;
    const utilidadOperativa = utilidadBruta - gastos;

    return {
      desde,
      hasta,
      ingresos,
      costoVentas,
      utilidadBruta,
      gastos,
      utilidadOperativa,
    };
  }

  // ─── Períodos ──────────────────────────────────────────────────────

  async listarPeriodos(ctx: TenantContext) {
    return this.prisma.forTenant(ctx).periodoContable.findMany({
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });
  }

  async cerrarPeriodo(id: string, ctx: TenantContext, usuarioId: string) {
    const cliente = this.prisma.forTenant(ctx);
    const periodo = await cliente.periodoContable.findUnique({ where: { id } });
    if (!periodo) throw new ErrorNoEncontrado('Período no existe');
    if (periodo.estado === 'cerrado') throw new ErrorConflicto('Período ya cerrado');
    return cliente.periodoContable.update({
      where: { id },
      data: { estado: 'cerrado', cerradoEn: new Date(), cerradoPorId: usuarioId },
    });
  }

  // ─── Exportación PLE SUNAT ─────────────────────────────────────────

  /**
   * Genera un archivo PLE en formato TXT delimitado por pipe `|`.
   * Estructura simplificada — los campos siguen el orden del libro pedido.
   * Esto es suficiente para vista previa / desarrollo; la conformidad
   * 100% con SUNAT se valida con el PLE Validator oficial.
   */
  async exportarPle(libro: string, anio: number, mes: number, ctx: TenantContext): Promise<string> {
    if (libro === '14.1' || libro === 'ventas') {
      const reg = await this.registroVentas(anio, mes, ctx);
      return reg.filas
        .map((f, i) =>
          [
            `${anio}${String(mes).padStart(2, '0')}00`,
            `M${String(i + 1).padStart(8, '0')}`,
            isoFecha(f.fecha),
            '',
            '03',
            '',
            f.comprobante,
            '',
            f.tipoDoc,
            f.docCliente,
            f.nombreCliente,
            money(f.baseImponible),
            '0.00',
            '0.00',
            money(f.igv),
            '0.00',
            money(f.total),
            'PEN',
            '1.000',
            '',
            '1',
            '',
            '',
            '',
            '',
          ].join('|'),
        )
        .join('\r\n') + '\r\n';
    }
    if (libro === '8.1' || libro === 'compras') {
      const reg = await this.registroCompras(anio, mes, ctx);
      return reg.filas
        .map((f, i) =>
          [
            `${anio}${String(mes).padStart(2, '0')}00`,
            `M${String(i + 1).padStart(8, '0')}`,
            isoFecha(f.fechaEmision),
            isoFecha(f.fechaRecepcion),
            tipoCompSunat(f.tipoComprobante),
            f.serie,
            f.numero,
            f.tipoDoc,
            f.docProveedor,
            f.razonSocial,
            money(f.baseImponible),
            money(f.igv),
            '0.00',
            '0.00',
            '0.00',
            '0.00',
            '0.00',
            '0.00',
            '0.00',
            money(f.total),
            f.moneda,
            '1.000',
            '',
            '',
            '',
            '',
            '',
            '',
            '1',
          ].join('|'),
        )
        .join('\r\n') + '\r\n';
    }
    if (libro === '5.1' || libro === 'diario') {
      const diario = await this.libroDiario(anio, mes, ctx);
      const filas: string[] = [];
      for (const a of diario.asientos) {
        for (const [j, d] of a.detalles.entries()) {
          filas.push(
            [
              `${anio}${String(mes).padStart(2, '0')}00`,
              a.numero,
              String(j + 1).padStart(3, '0'),
              d.cuentaCodigo,
              '',
              '',
              '',
              d.documentoTipo ?? '',
              d.documentoNumero ?? '',
              isoFecha(a.fecha),
              '',
              '',
              d.glosa ?? a.glosa,
              money(D(d.debe)),
              money(D(d.haber)),
              '1',
            ].join('|'),
          );
        }
      }
      return filas.join('\r\n') + '\r\n';
    }
    throw new ErrorNoEncontrado(`Libro PLE "${libro}" no soportado todavía`);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function isoFecha(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function money(n: number): string {
  return n.toFixed(2);
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
