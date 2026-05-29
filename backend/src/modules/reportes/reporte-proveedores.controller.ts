import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReporteProveedoresService, FiltrosReporteProveedores } from './reporte-proveedores.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('reportes/proveedores')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.PROVEEDORES)
export class ReporteProveedoresController {
  constructor(private readonly service: ReporteProveedoresService) {}

  @Get('excel') @RequierePermiso('proveedores:leer')
  async excel(@Query() q: FiltrosReporteProveedores, @Tenant() ctx: TenantContext, @Res() res: Response) {
    const buffer = await this.service.excel(ctx, q);
    res
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="${nombre('xlsx')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }

  @Get('pdf') @RequierePermiso('proveedores:leer')
  async pdf(@Query() q: FiltrosReporteProveedores, @Tenant() ctx: TenantContext, @Res() res: Response) {
    const buffer = await this.service.pdf(ctx, q);
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${nombre('pdf')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }
}

function nombre(ext: string): string {
  return `reporte-proveedores-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
