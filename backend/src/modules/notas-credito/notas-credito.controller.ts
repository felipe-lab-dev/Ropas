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
import { NotasCreditoService } from './notas-credito.service';
import { CrearNotaCreditoDto } from './dto/crear-nota-credito.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('notas-credito')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.NOTAS_CREDITO)
export class NotasCreditoController {
  constructor(private readonly service: NotasCreditoService) {}

  @Get() @RequierePermiso('notas-credito:leer')
  async listar(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listar(q, ctx);
  }

  @Get(':id') @RequierePermiso('notas-credito:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  @Post() @RequierePermiso('notas-credito:crear')
  async crear(
    @Body() dto: CrearNotaCreditoDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const nota = await this.service.crear(dto, ctx, req.usuario!.sub);
    return { datos: nota, mensaje: `Nota de crédito ${nota.numero} emitida` };
  }

  @Post(':id/anular') @RequierePermiso('notas-credito:anular')
  async anular(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const nota = await this.service.anular(id, body.motivo, ctx, req.usuario!.sub);
    return { datos: nota, mensaje: 'Nota de crédito anulada' };
  }
}
