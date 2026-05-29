import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReporteInventarioService, FiltrosReporteInventario } from './reporte-inventario.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('reportes/inventario')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.INVENTARIO)
export class ReporteInventarioController {
  constructor(private readonly service: ReporteInventarioService) {}

  @Get('excel') @RequierePermiso('inventario:leer')
  async excel(@Query() q: FiltrosReporteInventario, @Tenant() ctx: TenantContext, @Res() res: Response) {
    const buffer = await this.service.excel(ctx, q);
    res
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="${nombre('xlsx')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }

  @Get('pdf') @RequierePermiso('inventario:leer')
  async pdf(@Query() q: FiltrosReporteInventario, @Tenant() ctx: TenantContext, @Res() res: Response) {
    const buffer = await this.service.pdf(ctx, q);
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${nombre('pdf')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }
}

function nombre(ext: string): string {
  return `reporte-inventario-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
