import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PreferenciasService } from './preferencias.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard } from '../auth/auth.guard';
import { ErrorNoAutorizado } from '../../core/errors/errores';

@Controller('preferencias')
@UseGuards(AuthGuard)
export class PreferenciasController {
  constructor(private readonly service: PreferenciasService) {}

  @Get()
  async obtener(@Tenant() ctx: TenantContext, @Req() req: Request) {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) throw new ErrorNoAutorizado('Sin sesión');
    return { datos: await this.service.obtener(ctx, usuarioId) };
  }

  @Put(':modulo')
  async guardar(
    @Param('modulo') modulo: string,
    @Body() body: { estado: unknown },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) throw new ErrorNoAutorizado('Sin sesión');
    const datos = await this.service.guardarModulo(ctx, usuarioId, modulo, body?.estado ?? {});
    return { datos, mensaje: 'Preferencias guardadas' };
  }
}
