import { Injectable } from '@nestjs/common';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorNoEncontrado } from '../../core/errors/errores';

@Injectable()
export class SucursalesService {
  constructor(private readonly prisma: PrismaTenantService) {}

  listar(ctx: TenantContext) {
    return this.prisma.forTenant(ctx).sucursal.findMany({
      where: { eliminadoEn: null },
      orderBy: [{ esPrincipal: 'desc' }, { nombre: 'asc' }],
    });
  }

  async obtener(id: string, ctx: TenantContext) {
    const s = await this.prisma.forTenant(ctx).sucursal.findFirst({ where: { id, eliminadoEn: null } });
    if (!s) throw new ErrorNoEncontrado('Sucursal no encontrada');
    return s;
  }

  crear(data: { codigo: string; nombre: string; direccion?: string; telefono?: string }, ctx: TenantContext) {
    return this.prisma.forTenant(ctx).sucursal.create({ data });
  }
}
