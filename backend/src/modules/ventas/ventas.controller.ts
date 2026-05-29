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
import { VentasService } from './ventas.service';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('ventas')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.VENTAS)
export class VentasController {
  constructor(private readonly service: VentasService) {}

  @Get() @RequierePermiso('ventas:leer')
  async listar(@Query() q: any, @Tenant() ctx: TenantContext, @Req() req: Request) {
    return this.service.listar(q, ctx, req.usuario!.permisos);
  }

  @Get(':id') @RequierePermiso('ventas:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  @Post() @RequierePermiso('ventas:crear')
  async crear(@Body() dto: CrearVentaDto, @Tenant() ctx: TenantContext, @Req() req: Request) {
    const venta = await this.service.crear(dto, ctx, req.usuario!.sub);
    return { datos: venta, mensaje: `Venta ${venta.numero} registrada` };
  }

  @Post(':id/anular') @RequierePermiso('ventas:anular')
  async anular(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const venta = await this.service.anular(id, body.motivo, ctx, req.usuario!.sub);
    return { datos: venta, mensaje: 'Venta anulada' };
  }

  @Post(':id/pagos') @RequierePermiso('ventas:crear')
  async registrarPago(
    @Param('id') id: string,
    @Body() body: { medio: string; monto: number; referencia?: string; sesionCajaId?: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.service.registrarPago(id, body, ctx, req.usuario!.sub);
    return {
      datos,
      mensaje: datos.estado === 'pagada' ? 'Venta saldada' : 'Pago registrado',
    };
  }
}
