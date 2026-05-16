import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CajaService } from './caja.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';

@Controller('caja')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('caja')
export class CajaController {
  constructor(private readonly service: CajaService) {}

  @Get('sesiones') @RequierePermiso('caja:leer')
  async listar(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listarSesiones(q, ctx);
  }

  @Get('mi-sesion-abierta') @RequierePermiso('caja:operar')
  async miSesion(
    @Query('sucursalId') sucursalId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const sesion = await this.service.sesionAbiertaDe(sucursalId, req.usuario!.sub, ctx);
    return { datos: sesion };
  }

  @Post('abrir') @RequierePermiso('caja:operar')
  async abrir(
    @Body() body: { sucursalId: string; montoApertura: number; notas?: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const sesion = await this.service.abrir(
      { sucursalId: body.sucursalId, cajeroId: req.usuario!.sub, montoApertura: body.montoApertura, notas: body.notas },
      ctx,
    );
    return { datos: sesion, mensaje: 'Caja abierta' };
  }

  @Post(':id/cerrar') @RequierePermiso('caja:operar')
  async cerrar(
    @Param('id') id: string,
    @Body() body: { montoCierre: number; notas?: string },
    @Tenant() ctx: TenantContext,
  ) {
    const sesion = await this.service.cerrar(id, body, ctx);
    return { datos: sesion, mensaje: 'Caja cerrada' };
  }
}
