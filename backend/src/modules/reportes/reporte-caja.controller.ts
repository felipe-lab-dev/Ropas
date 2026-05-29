import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReporteCajaService, FiltrosReporteCaja } from './reporte-caja.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('reportes/caja')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.CAJA)
export class ReporteCajaController {
  constructor(private readonly service: ReporteCajaService) {}

  @Get('excel') @RequierePermiso('caja:leer')
  async excel(@Query() q: FiltrosReporteCaja, @Tenant() ctx: TenantContext, @Res() res: Response) {
    const buffer = await this.service.excel(ctx, q);
    res
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="${nombre(q, 'xlsx')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }

  @Get('pdf') @RequierePermiso('caja:leer')
  async pdf(@Query() q: FiltrosReporteCaja, @Tenant() ctx: TenantContext, @Res() res: Response) {
    const buffer = await this.service.pdf(ctx, q);
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${nombre(q, 'pdf')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }
}

function nombre(q: FiltrosReporteCaja, ext: string): string {
  const sufijo = q.desde ? q.desde.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `reporte-caja-${sufijo}.${ext}`;
}
