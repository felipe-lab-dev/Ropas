import { Injectable } from '@nestjs/common';
import { Prisma, TipoDocumento } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorConflicto, ErrorNoEncontrado } from '../../core/errors/errores';
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
    if (query.condicionPago) where.condicionPago = query.condicionPago as any;

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
        orderBy: { razonSocial: 'asc' },
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

  async historial(id: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    return cliente.compra.findMany({
      where: { proveedorId: id, eliminadoEn: null },
      orderBy: { fechaEmision: 'desc' },
      take: 50,
      include: { _count: { select: { items: true, pagos: true } } },
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
    });
    if (existente) throw new ErrorConflicto('Ya existe un proveedor con ese documento');

    return cliente.proveedor.create({
      data: {
        tipoDocumento: dto.tipoDocumento as TipoDocumento,
        documento: dto.documento,
        razonSocial: dto.razonSocial,
        nombreComercial: dto.nombreComercial,
        contacto: dto.contacto,
        email: dto.email,
        telefono: dto.telefono,
        direccion: dto.direccion,
        ciudad: dto.ciudad,
        condicionPago: (dto.condicionPago ?? 'contado') as any,
        diasCredito: dto.diasCredito ?? 0,
        cuentaBancaria: dto.cuentaBancaria,
        notas: dto.notas,
        tags: dto.tags ?? [],
      },
    });
  }

  async actualizar(id: string, dto: ActualizarProveedorDto, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    await this.obtener(id, ctx);
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
        ...(dto.condicionPago && { condicionPago: dto.condicionPago as any }),
        ...(dto.diasCredito !== undefined && { diasCredito: dto.diasCredito }),
        ...(dto.cuentaBancaria !== undefined && { cuentaBancaria: dto.cuentaBancaria }),
        ...(dto.notas !== undefined && { notas: dto.notas }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.tags && { tags: dto.tags }),
      },
    });
  }

  async eliminar(id: string, ctx: TenantContext) {
    await this.obtener(id, ctx);
    return this.prisma.forTenant(ctx).proveedor.update({
      where: { id },
      data: { eliminadoEn: new Date(), activo: false },
    });
  }
}
