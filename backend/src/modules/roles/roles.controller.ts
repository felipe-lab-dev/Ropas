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
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { ActualizarRolDto, CrearRolDto } from './dto/rol.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { CATALOGO_PERMISOS } from '../../saas/catalogo-permisos';

/**
 * Módulo "Accesos": gestión de roles y sus permisos (RBAC).
 * La asignación de un rol a un usuario vive en el módulo de Usuarios.
 */
@Controller('roles')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly service: RolesService) {}

  /** Catálogo de permisos (módulo × acción) para construir la matriz de Accesos. */
  @Get('catalogo-permisos') @RequierePermiso('roles:leer')
  catalogoPermisos() {
    return { datos: CATALOGO_PERMISOS };
  }

  @Get() @RequierePermiso('roles:leer')
  async listar(@Tenant() ctx: TenantContext) {
    return { datos: await this.service.listar(ctx) };
  }

  @Get(':id') @RequierePermiso('roles:leer')
  async obtener(@Param('id', new ParseUUIDPipe()) id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  @Post() @RequierePermiso('roles:crear')
  async crear(@Body() dto: CrearRolDto, @Tenant() ctx: TenantContext) {
    const datos = await this.service.crear(dto, ctx);
    return { datos, mensaje: 'Rol creado' };
  }

  @Patch(':id') @RequierePermiso('roles:editar')
  async actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarRolDto,
    @Tenant() ctx: TenantContext,
  ) {
    const datos = await this.service.actualizar(id, dto, ctx);
    return { datos, mensaje: 'Rol actualizado' };
  }

  @Delete(':id') @RequierePermiso('roles:eliminar') @HttpCode(200)
  async eliminar(@Param('id', new ParseUUIDPipe()) id: string, @Tenant() ctx: TenantContext) {
    await this.service.eliminar(id, ctx);
    return { mensaje: 'Rol eliminado' };
  }
}
