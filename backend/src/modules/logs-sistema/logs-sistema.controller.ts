import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { LogsSistemaService, ConsultaLogs } from './logs-sistema.service';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorNoEncontrado, ErrorNoAutorizado } from '../../core/errors/errores';

@Controller('logs-sistema')
@UseGuards(AuthGuard)
export class LogsSistemaController {
  constructor(private readonly service: LogsSistemaService) {}

  @Get() @RequierePermiso('logs-sistema:acceso')
  async listar(
    @Query() query: ConsultaLogs,
    @Tenant() ctx: TenantContext,
  ) {
    return this.service.listar(query, ctx.codigo);
  }

  @Get('estadisticas') @RequierePermiso('logs-sistema:acceso')
  async estadisticas(@Tenant() ctx: TenantContext) {
    const datos = await this.service.estadisticas(ctx.codigo);
    return { datos };
  }

  @Get(':id') @RequierePermiso('logs-sistema:acceso')
  async obtener(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Tenant() ctx: TenantContext,
  ) {
    const datos = await this.service.obtenerPorId(id, ctx.codigo);
    if (!datos) throw new ErrorNoEncontrado('Error no encontrado');
    return { datos };
  }

  @Patch(':id/resolver') @RequierePermiso('logs-sistema:resolver')
  async resolver(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { notas?: string } = {},
    @Req() req: Request,
  ) {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) throw new ErrorNoAutorizado('Usuario no resuelto');
    const datos = await this.service.marcarResuelto(id, usuarioId, body.notas);
    return { datos, mensaje: 'Marcado como resuelto' };
  }

  @Patch(':id/no-resuelto') @RequierePermiso('logs-sistema:resolver')
  async noResuelto(@Param('id', new ParseUUIDPipe()) id: string) {
    const datos = await this.service.marcarNoResuelto(id);
    return { datos, mensaje: 'Reabierto' };
  }

  @Delete(':id') @RequierePermiso('logs-sistema:purgar') @HttpCode(200)
  async eliminar(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.service.eliminar(id);
    return { mensaje: 'Eliminado' };
  }

  @Delete() @RequierePermiso('logs-sistema:purgar') @HttpCode(200)
  async purgar(
    @Query('diasResueltos') diasResueltos?: string,
    @Query('diasNoResueltos') diasNoResueltos?: string,
  ) {
    const datos = await this.service.purgarAntiguos(
      diasResueltos ? parseInt(diasResueltos, 10) : undefined,
      diasNoResueltos ? parseInt(diasNoResueltos, 10) : undefined,
    );
    return { datos, mensaje: `${datos.eliminados} logs eliminados` };
  }
}
