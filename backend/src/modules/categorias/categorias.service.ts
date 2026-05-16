import { Injectable } from '@nestjs/common';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaTenantService) {}

  listar(ctx: TenantContext) {
    return this.prisma.forTenant(ctx).categoria.findMany({
      where: { eliminadoEn: null },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { productos: true } } },
    });
  }

  crear(data: { nombre: string; slug: string; padreId?: string; icono?: string }, ctx: TenantContext) {
    return this.prisma.forTenant(ctx).categoria.create({ data });
  }
}
