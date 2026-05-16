import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorNoEncontrado } from '../../core/errors/errores';
import {
  obtenerPaginacion,
  PaginacionDto,
  construirBusquedaWordSplit,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async listar(query: PaginacionDto, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.ClienteWhereInput = { eliminadoEn: null };
    const busqueda = construirBusquedaWordSplit(query.buscar, [
      'nombre', 'documento', 'email', 'telefono',
    ]);
    if (busqueda) Object.assign(where, busqueda);

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.cliente.findMany({ where, skip, take, orderBy: { creadoEn: 'desc' } }),
      cliente.cliente.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async obtener(id: string, ctx: TenantContext) {
    const c = await this.prisma.forTenant(ctx).cliente.findFirst({
      where: { id, eliminadoEn: null },
      include: { ventas: { take: 10, orderBy: { creadoEn: 'desc' } } },
    });
    if (!c) throw new ErrorNoEncontrado('Cliente no encontrado');
    return c;
  }

  crear(data: any, ctx: TenantContext) {
    return this.prisma.forTenant(ctx).cliente.create({ data });
  }

  async actualizar(id: string, data: any, ctx: TenantContext) {
    await this.obtener(id, ctx);
    return this.prisma.forTenant(ctx).cliente.update({ where: { id }, data });
  }

  async eliminar(id: string, ctx: TenantContext) {
    await this.obtener(id, ctx);
    await this.prisma.forTenant(ctx).cliente.update({
      where: { id }, data: { eliminadoEn: new Date() },
    });
  }
}
