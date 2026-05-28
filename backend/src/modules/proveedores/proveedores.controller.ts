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
import { ProveedoresService } from './proveedores.service';
import { ActualizarProveedorDto, CrearProveedorDto } from './dto/proveedor.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import {
  ModuloHabilitado,
  ModuloHabilitadoGuard,
} from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('proveedores')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.PROVEEDORES)
export class ProveedoresController {
  constructor(private readonly service: ProveedoresService) {}

  @Get() @RequierePermiso('proveedores:leer')
  async listar(@Query() q: Record<string, string | undefined>, @Tenant() ctx: TenantContext) {
    return this.service.listar(q as never, ctx);
  }

  @Get(':id') @RequierePermiso('proveedores:leer')
  async obtener(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Tenant() ctx: TenantContext,
  ) {
    return { datos: await this.service.detalle(id, ctx) };
  }

  @Get(':id/historial') @RequierePermiso('proveedores:leer')
  async historial(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Tenant() ctx: TenantContext,
  ) {
    return { datos: await this.service.historial(id, ctx) };
  }

  @Post() @RequierePermiso('proveedores:crear')
  async crear(@Body() dto: CrearProveedorDto, @Tenant() ctx: TenantContext) {
    const datos = await this.service.crear(dto, ctx);
    return { datos, mensaje: 'Proveedor registrado' };
  }

  @Patch(':id') @RequierePermiso('proveedores:editar')
  async actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarProveedorDto,
    @Tenant() ctx: TenantContext,
  ) {
    const datos = await this.service.actualizar(id, dto, ctx);
    return { datos, mensaje: 'Proveedor actualizado' };
  }

  @Delete(':id') @RequierePermiso('proveedores:eliminar') @HttpCode(200)
  async eliminar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Tenant() ctx: TenantContext,
  ) {
    await this.service.eliminar(id, ctx);
    return { mensaje: 'Proveedor eliminado' };
  }
}
