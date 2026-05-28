import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { MotorClasificacionClientesService } from './motor-clasificacion.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('clientes')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.CLIENTES)
export class ClientesController {
  constructor(
    private readonly service: ClientesService,
    private readonly motor: MotorClasificacionClientesService,
  ) {}

  @Post('clasificacion/calcular')
  @RequierePermiso('clientes:editar')
  async clasificar(@Tenant() ctx: TenantContext) {
    const datos = await this.motor.calcular(ctx);
    return { datos, mensaje: 'Clasificación de clientes ejecutada' };
  }

  @Get() @RequierePermiso('clientes:leer')
  async listar(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listar(q, ctx);
  }

  @Get(':id') @RequierePermiso('clientes:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  @Post() @RequierePermiso('clientes:crear')
  async crear(@Body() body: CrearClienteDto, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.crear(body, ctx), mensaje: 'Cliente creado' };
  }

  @Patch(':id') @RequierePermiso('clientes:editar')
  async actualizar(@Param('id') id: string, @Body() body: ActualizarClienteDto, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.actualizar(id, body, ctx), mensaje: 'Cliente actualizado' };
  }

  @Delete(':id') @RequierePermiso('clientes:eliminar')
  async eliminar(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    await this.service.eliminar(id, ctx);
    return { mensaje: 'Cliente eliminado' };
  }
}
