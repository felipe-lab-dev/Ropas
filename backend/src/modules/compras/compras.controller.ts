import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ComprasService } from './compras.service';
import {
  CrearCompraDto,
  RegistrarPagoCompraDto,
} from './dto/crear-compra.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import {
  ModuloHabilitado,
  ModuloHabilitadoGuard,
} from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('compras')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.COMPRAS)
export class ComprasController {
  constructor(private readonly service: ComprasService) {}

  @Get() @RequierePermiso('compras:leer')
  async listar(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listar(q, ctx);
  }

  @Get('cuentas-por-pagar') @RequierePermiso('compras:leer')
  async cuentasPorPagar(@Tenant() ctx: TenantContext) {
    return this.service.cuentasPorPagar(ctx);
  }

  @Get(':id') @RequierePermiso('compras:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  @Post() @RequierePermiso('compras:crear')
  async crear(@Body() dto: CrearCompraDto, @Tenant() ctx: TenantContext, @Req() req: Request) {
    const compra = await this.service.crear(dto, ctx, req.usuario!.sub);
    return { datos: compra, mensaje: `Compra ${compra!.numero} registrada` };
  }

  @Post(':id/pagos') @RequierePermiso('compras:pagar')
  async pagar(
    @Param('id') id: string,
    @Body() dto: RegistrarPagoCompraDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const pago = await this.service.registrarPago(id, dto, ctx, req.usuario!.sub);
    return { datos: pago, mensaje: 'Pago registrado' };
  }

  @Post(':id/anular') @RequierePermiso('compras:anular')
  async anular(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const compra = await this.service.anular(id, body.motivo, ctx, req.usuario!.sub);
    return { datos: compra, mensaje: 'Compra anulada' };
  }
}
