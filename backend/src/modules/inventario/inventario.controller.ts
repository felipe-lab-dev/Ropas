import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';

@Controller('inventario')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('inventario')
export class InventarioController {
  constructor(private readonly service: InventarioService) {}

  @Get('stock') @RequierePermiso('inventario:leer')
  stock(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listarStock(q, ctx);
  }

  @Get('movimientos') @RequierePermiso('inventario:leer')
  movimientos(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.movimientos(q, ctx);
  }

  @Post('ajustes') @RequierePermiso('inventario:ajustar')
  async ajustar(@Body() body: any, @Tenant() ctx: TenantContext) {
    const r = await this.service.ajustar(body, ctx);
    return { datos: r, mensaje: 'Ajuste registrado' };
  }
}
