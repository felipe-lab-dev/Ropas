import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';

@Controller('reportes')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('dashboard') @RequierePermiso('reportes:leer')
  async dashboard(@Tenant() ctx: TenantContext) {
    return { datos: await this.service.resumenDashboard(ctx) };
  }

  @Get('ventas-por-categoria') @RequierePermiso('reportes:leer')
  async porCategoria(@Query('dias') dias: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.ventasPorCategoria(ctx, dias ? parseInt(dias, 10) : 30) };
  }
}
