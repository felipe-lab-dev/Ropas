import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';

@Controller('clientes')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Get() @RequierePermiso('clientes:leer')
  async listar(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listar(q, ctx);
  }

  @Get(':id') @RequierePermiso('clientes:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  @Post() @RequierePermiso('clientes:crear')
  async crear(@Body() body: any, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.crear(body, ctx), mensaje: 'Cliente creado' };
  }

  @Patch(':id') @RequierePermiso('clientes:editar')
  async actualizar(@Param('id') id: string, @Body() body: any, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.actualizar(id, body, ctx), mensaje: 'Cliente actualizado' };
  }

  @Delete(':id') @RequierePermiso('clientes:eliminar')
  async eliminar(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    await this.service.eliminar(id, ctx);
    return { mensaje: 'Cliente eliminado' };
  }
}
