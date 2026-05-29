import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  ResetearPasswordDto,
} from './dto/usuario.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { PayloadJwt } from '../auth/auth.service';

@Controller('usuarios')
@UseGuards(AuthGuard)
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get() @RequierePermiso('usuarios:leer')
  async listar(@Query() q: Record<string, string | undefined>, @Tenant() ctx: TenantContext) {
    return this.service.listar(q as never, ctx);
  }

  @Get(':id') @RequierePermiso('usuarios:leer')
  async obtener(@Param('id', new ParseUUIDPipe()) id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  @Post() @RequierePermiso('usuarios:crear')
  async crear(@Body() dto: CrearUsuarioDto, @Tenant() ctx: TenantContext) {
    const datos = await this.service.crear(dto, ctx);
    return { datos, mensaje: 'Usuario creado' };
  }

  @Patch(':id') @RequierePermiso('usuarios:editar')
  async actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @Tenant() ctx: TenantContext,
    @UsuarioActual() actor: PayloadJwt,
  ) {
    const datos = await this.service.actualizar(id, dto, ctx, actor.sub);
    return { datos, mensaje: 'Usuario actualizado' };
  }

  @Post(':id/resetear-password') @RequierePermiso('usuarios:editar') @HttpCode(200)
  async resetearPassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResetearPasswordDto,
    @Tenant() ctx: TenantContext,
  ) {
    const datos = await this.service.resetearPassword(id, ctx, dto.password);
    return { datos, mensaje: 'Contraseña restablecida' };
  }

  @Delete(':id') @RequierePermiso('usuarios:eliminar') @HttpCode(200)
  async eliminar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Tenant() ctx: TenantContext,
    @UsuarioActual() actor: PayloadJwt,
  ) {
    await this.service.eliminar(id, ctx, actor.sub);
    return { mensaje: 'Usuario eliminado' };
  }
}
