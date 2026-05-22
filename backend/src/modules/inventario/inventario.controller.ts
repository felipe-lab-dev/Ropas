import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { InventarioService } from './inventario.service';
import {
  AjusteStockDto,
  ConteoFisicoDto,
  MermaStockDto,
  TrasladoStockDto,
  ActualizarParametrosStockDto,
} from './dto/ajuste.dto';
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
  async ajustar(
    @Body() dto: AjusteStockDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.service.ajustar(dto, ctx, req.usuario?.sub);
    return { datos, mensaje: 'Ajuste registrado' };
  }

  @Post('mermas') @RequierePermiso('inventario:ajustar')
  async merma(
    @Body() dto: MermaStockDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.service.merma(dto, ctx, req.usuario?.sub);
    return { datos, mensaje: 'Merma registrada' };
  }

  @Post('traslados') @RequierePermiso('inventario:ajustar')
  async traslado(
    @Body() dto: TrasladoStockDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.service.traslado(dto, ctx, req.usuario?.sub);
    return { datos, mensaje: 'Traslado registrado' };
  }

  @Post('conteos') @RequierePermiso('inventario:ajustar')
  async conteoFisico(
    @Body() dto: ConteoFisicoDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.service.conteoFisico(dto, ctx, req.usuario?.sub);
    return { datos, mensaje: 'Conteo físico aplicado' };
  }

  @Patch('stock/:id') @RequierePermiso('inventario:ajustar')
  async actualizarParametros(
    @Param('id') id: string,
    @Body() dto: ActualizarParametrosStockDto,
    @Tenant() ctx: TenantContext,
  ) {
    const datos = await this.service.actualizarParametros(id, dto, ctx);
    return { datos, mensaje: 'Parámetros de stock actualizados' };
  }
}
