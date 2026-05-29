import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, TipoDocumento, CondicionPago } from '@prisma/client';
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
import { ActualizarProveedorDto, CrearProveedorDto } from './dto/proveedor.dto';

interface ListarQuery extends PaginacionDto {
  activo?: string;
  condicionPago?: string;
}

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async listar(query: ListarQuery, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const cliente = this.prisma.forTenant(ctx);

    const where: Prisma.ProveedorWhereInput = { eliminadoEn: null };
    if (query.activo === 'true') where.activo = true;
    if (query.activo === 'false') where.activo = false;
    if (query.condicionPago) where.condicionPago = query.condicionPago as CondicionPago;

    const busqueda = construirBusquedaWordSplit(query.buscar, [
      'razonSocial',
      'nombreComercial',
      'documento',
      'contacto',
      'email',
    ]);
    if (busqueda) Object.assign(where, busqueda);

    const [datos, total] = await Promise.all([
      cliente.proveedor.findMany({
        where,
        skip,
        take,
        orderBy: [{ activo: 'desc' }, { razonSocial: 'asc' }],
      }),
      cliente.proveedor.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async obtener(id: string, ctx: TenantContext) {
    const proveedor = await this.prisma.forTenant(ctx).proveedor.findFirst({
      where: { id, eliminadoEn: null },
    });
    if (!proveedor) throw new ErrorNoEncontrado('Proveedor no encontrado');
    return proveedor;
  }

  /**
   * Detalle con stats vivas (cantidad de compras, última compra, deuda recalculada).
   * Se usa en la pantalla de edición.
   */
  async detalle(id: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const proveedor = await this.obtener(id, ctx);

    const [totalCompras, ultima, abiertas] = await Promise.all([
      cliente.compra.count({
        where: { proveedorId: id, eliminadoEn: null, anuladaEn: null },
      }),
      cliente.compra.findFirst({
        where: { proveedorId: id, eliminadoEn: null, anuladaEn: null },
        orderBy: { fechaEmision: 'desc' },
        select: { fechaEmision: true, total: true, numero: true, id: true },
      }),
      // No usamos aggregate _sum: mezclaría USD+PEN. Traemos las compras abiertas
      // (conjunto acotado por proveedor) y sumamos la deuda en PEN con el TC.
      cliente.compra.findMany({
        where: {
          proveedorId: id,
          eliminadoEn: null,
          anuladaEn: null,
          estadoPago: { in: ['pendiente', 'parcial', 'vencida'] },
        },
        select: { total: true, totalPagado: true, tipoCambio: true },
      }),
    ]);

    const deudaCalculada = abiertas.reduce(
      (acc, c) => acc.plus(c.total.minus(c.totalPagado).times(c.tipoCambio)),
      new Prisma.Decimal(0),
    );

    return {
      ...proveedor,
      stats: {
        totalCompras,
        ultimaCompra: ultima,
        deudaCalculada: deudaCalculada.toFixed(2),
      },
    };
  }

  async historial(id: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    await this.obtener(id, ctx);
    return cliente.compra.findMany({
      where: { proveedorId: id, eliminadoEn: null },
      orderBy: { fechaEmision: 'desc' },
      take: 50,
      select: {
        id: true,
        numero: true,
        serie: true,
        numeroComprobante: true,
        tipoComprobante: true,
        fechaEmision: true,
        fechaVencimiento: true,
        moneda: true,
        total: true,
        totalPagado: true,
        estado: true,
        estadoPago: true,
        anuladaEn: true,
        _count: { select: { items: true, pagos: true } },
      },
    });
  }

  async crear(dto: CrearProveedorDto, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const existente = await cliente.proveedor.findFirst({
      where: {
        tipoDocumento: dto.tipoDocumento as TipoDocumento,
        documento: dto.documento,
        eliminadoEn: null,
      },
      select: { id: true, razonSocial: true },
    });
    if (existente) {
      throw new ErrorConflicto(
        `Ya existe un proveedor con ${dto.tipoDocumento.toUpperCase()} ${dto.documento}: ${existente.razonSocial}`,
      );
    }

    const codigo = await this.siguienteCodigo(cliente);

    return cliente.proveedor.create({
      data: {
        codigo,
        tipoDocumento: dto.tipoDocumento as TipoDocumento,
        documento: dto.documento,
        razonSocial: dto.razonSocial,
        nombreComercial: dto.nombreComercial ?? null,
        contacto: dto.contacto ?? null,
        email: dto.email ?? null,
        telefono: dto.telefono ?? null,
        direccion: dto.direccion ?? null,
        ciudad: dto.ciudad ?? null,
        condicionPago: (dto.condicionPago ?? 'contado') as CondicionPago,
        diasCredito: dto.diasCredito ?? 0,
        cuentaBancaria: dto.cuentaBancaria ?? null,
        notas: dto.notas ?? null,
        tags: dto.tags ?? [],
      },
    });
  }

  async actualizar(id: string, dto: ActualizarProveedorDto, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const actual = await this.obtener(id, ctx);

    // Si cambian tipoDocumento o documento, validar duplicado contra OTROS proveedores.
    const nuevoTipo = (dto.tipoDocumento ?? actual.tipoDocumento) as TipoDocumento;
    const nuevoDoc = dto.documento ?? actual.documento;
    if (nuevoTipo !== actual.tipoDocumento || nuevoDoc !== actual.documento) {
      const duplicado = await cliente.proveedor.findFirst({
        where: {
          id: { not: id },
          tipoDocumento: nuevoTipo,
          documento: nuevoDoc,
          eliminadoEn: null,
        },
        select: { id: true, razonSocial: true },
      });
      if (duplicado) {
        throw new ErrorConflicto(
          `Otro proveedor ya usa ${nuevoTipo.toUpperCase()} ${nuevoDoc}: ${duplicado.razonSocial}`,
        );
      }
    }

    return cliente.proveedor.update({
      where: { id },
      data: {
        ...(dto.tipoDocumento && { tipoDocumento: dto.tipoDocumento as TipoDocumento }),
        ...(dto.documento && { documento: dto.documento }),
        ...(dto.razonSocial && { razonSocial: dto.razonSocial }),
        ...(dto.nombreComercial !== undefined && { nombreComercial: dto.nombreComercial }),
        ...(dto.contacto !== undefined && { contacto: dto.contacto }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono }),
        ...(dto.direccion !== undefined && { direccion: dto.direccion }),
        ...(dto.ciudad !== undefined && { ciudad: dto.ciudad }),
        ...(dto.condicionPago && { condicionPago: dto.condicionPago as CondicionPago }),
        ...(dto.diasCredito !== undefined && { diasCredito: dto.diasCredito }),
        ...(dto.cuentaBancaria !== undefined && { cuentaBancaria: dto.cuentaBancaria }),
        ...(dto.notas !== undefined && { notas: dto.notas }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.tags && { tags: dto.tags }),
      },
    });
  }

  /**
   * Soft delete. Bloquea si el proveedor tiene compras pendientes/parciales/vencidas:
   * borrarlo ocultaría cuentas por pagar abiertas.
   */
  async eliminar(id: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    await this.obtener(id, ctx);

    const comprasAbiertas = await cliente.compra.count({
      where: {
        proveedorId: id,
        eliminadoEn: null,
        anuladaEn: null,
        estadoPago: { in: ['pendiente', 'parcial', 'vencida'] },
      },
    });
    if (comprasAbiertas > 0) {
      throw new ErrorValidacion(
        `No se puede eliminar: el proveedor tiene ${comprasAbiertas} compra(s) con pago pendiente. Cancela o paga las compras primero.`,
      );
    }

    await cliente.proveedor.update({
      where: { id },
      data: { eliminadoEn: new Date(), activo: false },
    });
  }

  /**
   * Genera el siguiente código legible de proveedor: PR00001, PR00002, …
   * Monotónico por tenant (no reutiliza códigos de proveedores eliminados).
   * El índice único `proveedores_codigo_key` actúa de red de seguridad ante carreras.
   */
  private async siguienteCodigo(cliente: PrismaClient): Promise<string> {
    const ultimo = await cliente.proveedor.findFirst({
      where: { codigo: { startsWith: 'PR' } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    const n = ultimo?.codigo ? parseInt(ultimo.codigo.slice(2), 10) + 1 : 1;
    return `PR${String(n).padStart(5, '0')}`;
  }
}
