import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';

@Controller('categorias')
@UseGuards(AuthGuard)
export class CategoriasController {
  constructor(private readonly service: CategoriasService) {}

  @Get() @RequierePermiso('productos:leer')
  async listar(@Tenant() ctx: TenantContext) {
    return this.service.listar(ctx);
  }

  @Post() @RequierePermiso('productos:crear')
  async crear(@Body() body: any, @Tenant() ctx: TenantContext) {
    const cat = await this.service.crear(body, ctx);
    return { datos: cat, mensaje: 'Categoría creada' };
  }
}
