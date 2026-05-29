import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReporteComprasService, FiltrosReporteCompras } from './reporte-compras.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

/**
 * Exportación de reportes de compras (Excel / PDF).
 * Gateado por el módulo COMPRAS y el permiso compras:leer: quien ve el listado
 * de compras puede exportarlo.
 */
@Controller('reportes/compras')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.COMPRAS)
export class ReporteComprasController {
  constructor(private readonly service: ReporteComprasService) {}

  @Get('excel') @RequierePermiso('compras:leer')
  async excel(@Query() q: FiltrosReporteCompras, @Tenant() ctx: TenantContext, @Res() res: Response) {
    const buffer = await this.service.excel(ctx, q);
    res
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(q, 'xlsx')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }

  @Get('pdf') @RequierePermiso('compras:leer')
  async pdf(@Query() q: FiltrosReporteCompras, @Tenant() ctx: TenantContext, @Res() res: Response) {
    const buffer = await this.service.pdf(ctx, q);
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(q, 'pdf')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }
}

function nombreArchivo(q: FiltrosReporteCompras, ext: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const sufijo = q.desde ? q.desde.slice(0, 10) : hoy;
  return `reporte-compras-${sufijo}.${ext}`;
}
