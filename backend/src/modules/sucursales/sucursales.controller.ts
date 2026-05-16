import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SucursalesService } from './sucursales.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';

@Controller('sucursales')
@UseGuards(AuthGuard)
export class SucursalesController {
  constructor(private readonly service: SucursalesService) {}

  @Get() @RequierePermiso('sucursales:leer')
  async listar(@Tenant() ctx: TenantContext) {
    return this.service.listar(ctx);
  }

  @Get(':id') @RequierePermiso('sucursales:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return this.service.obtener(id, ctx);
  }

  @Post() @RequierePermiso('sucursales:crear')
  async crear(@Body() body: any, @Tenant() ctx: TenantContext) {
    const sucursal = await this.service.crear(body, ctx);
    return { datos: sucursal, mensaje: 'Sucursal creada' };
  }
}
