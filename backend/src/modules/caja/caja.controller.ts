import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  CajaService,
  CrearMovimientoDto,
  FiltroMovimientosDto,
  FiltroSesionesDto,
} from './caja.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('caja')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.CAJA)
export class CajaController {
  constructor(private readonly service: CajaService) {}

  // Sesión actual del cajero logueado
  @Get('mi-sesion-abierta') @RequierePermiso('caja:operar')
  async miSesion(
    @Query('sucursalId') sucursalId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const sesion = await this.service.sesionAbiertaDe(sucursalId, req.usuario!.sub, ctx);
    return { datos: sesion };
  }

  // Apertura / cierre
  @Post('abrir') @RequierePermiso('caja:operar')
  async abrir(
    @Body()
    body: {
      sucursalId: string;
      montoApertura: number;
      aperturasMoneda?: { moneda: string; monto: number }[];
      notas?: string;
    },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const sesion = await this.service.abrir(
      {
        sucursalId: body.sucursalId,
        cajeroId: req.usuario!.sub,
        montoApertura: body.montoApertura,
        aperturasMoneda: body.aperturasMoneda,
        notas: body.notas,
      },
      ctx,
    );
    return { datos: sesion, mensaje: 'Caja abierta' };
  }

  @Post(':id/cerrar') @RequierePermiso('caja:operar')
  async cerrar(
    @Param('id') id: string,
    @Body()
    body: {
      montoCierre: number;
      cierresMoneda?: { moneda: string; monto: number }[];
      notas?: string;
    },
    @Tenant() ctx: TenantContext,
  ) {
    const sesion = await this.service.cerrar(id, body, ctx);
    return { datos: sesion, mensaje: 'Caja cerrada' };
  }

  // Listado histórico paginado
  @Get('sesiones') @RequierePermiso('caja:leer')
  async listar(@Query() q: FiltroSesionesDto, @Tenant() ctx: TenantContext) {
    return this.service.listarSesiones(q, ctx);
  }

  // Detalle de una sesión
  @Get('sesiones/:id') @RequierePermiso('caja:leer')
  async detalle(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    const datos = await this.service.obtenerSesion(id, ctx);
    return { datos };
  }

  // Totales agregados de una sesión
  @Get('sesiones/:id/totales') @RequierePermiso('caja:leer')
  async totales(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    const datos = await this.service.totalesSesion(id, ctx);
    return { datos };
  }

  // Desglose de movimientos manuales por categoría
  @Get('sesiones/:id/desglose-categorias') @RequierePermiso('caja:leer')
  async desglose(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    const datos = await this.service.desglosePorCategoria(id, ctx);
    return { datos };
  }

  // Movimientos
  @Get('sesiones/:id/movimientos') @RequierePermiso('caja:leer')
  async listarMovimientos(
    @Param('id') id: string,
    @Query() q: FiltroMovimientosDto,
    @Tenant() ctx: TenantContext,
  ) {
    return this.service.listarMovimientos(id, q, ctx);
  }

  @Post('sesiones/:id/movimientos') @RequierePermiso('caja:operar')
  async crearMovimiento(
    @Param('id') id: string,
    @Body() body: CrearMovimientoDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.service.crearMovimiento(id, body, req.usuario!.sub, ctx);
    return { datos, mensaje: 'Movimiento registrado' };
  }

  @Delete('movimientos/:movId') @RequierePermiso('caja:operar')
  async eliminarMovimiento(
    @Param('movId') movId: string,
    @Tenant() ctx: TenantContext,
  ) {
    const datos = await this.service.eliminarMovimiento(movId, ctx);
    return { datos, mensaje: 'Movimiento eliminado' };
  }
}
