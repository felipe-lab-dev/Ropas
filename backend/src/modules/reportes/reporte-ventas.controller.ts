import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReporteVentasService, FiltrosReporteVentas } from './reporte-ventas.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

/**
 * Exportación de reportes de ventas (Excel / PDF).
 * Vive en el módulo de reportes pero se gatea por el módulo VENTAS y el permiso
 * ventas:leer: quien puede ver el listado de ventas puede exportarlo.
 */
@Controller('reportes/ventas')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.VENTAS)
export class ReporteVentasController {
  constructor(private readonly service: ReporteVentasService) {}

  @Get('excel') @RequierePermiso('ventas:leer')
  async excel(
    @Query() q: FiltrosReporteVentas,
    @Tenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const buffer = await this.service.excel(ctx, q);
    res
      .setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(q, 'xlsx')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }

  @Get('pdf') @RequierePermiso('ventas:leer')
  async pdf(
    @Query() q: FiltrosReporteVentas,
    @Tenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const buffer = await this.service.pdf(ctx, q);
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(q, 'pdf')}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }
}

function nombreArchivo(q: FiltrosReporteVentas, ext: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const sufijo = q.desde ? q.desde.slice(0, 10) : hoy;
  return `reporte-ventas-${sufijo}.${ext}`;
}
