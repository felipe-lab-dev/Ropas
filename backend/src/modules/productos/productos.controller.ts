import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';

@Controller('productos')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('productos')
export class ProductosController {
  constructor(private readonly service: ProductosService) {}

  @Get()
  @RequierePermiso('productos:leer')
  async listar(@Query() query: any, @Tenant() ctx: TenantContext) {
    return this.service.listar(query, ctx);
  }

  @Get('codigo-barras/:codigo')
  @RequierePermiso('productos:leer')
  async porCodigoBarras(@Param('codigo') codigo: string, @Tenant() ctx: TenantContext) {
    return this.service.buscarPorCodigoBarras(codigo, ctx);
  }

  @Get(':id')
  @RequierePermiso('productos:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return this.service.obtenerPorId(id, ctx);
  }

  @Get(':id/kardex')
  @RequierePermiso('productos:leer')
  async kardex(
    @Param('id') id: string,
    @Query() query: any,
    @Tenant() ctx: TenantContext,
  ) {
    return this.service.kardex(id, query, ctx);
  }

  @Post()
  @RequierePermiso('productos:crear')
  async crear(@Body() dto: CrearProductoDto, @Tenant() ctx: TenantContext) {
    const producto = await this.service.crear(dto, ctx);
    return { datos: producto, mensaje: 'Producto creado' };
  }

  @Patch(':id')
  @RequierePermiso('productos:editar')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarProductoDto,
    @Tenant() ctx: TenantContext,
  ) {
    const producto = await this.service.actualizar(id, dto, ctx);
    return { datos: producto, mensaje: 'Producto actualizado' };
  }

  @Delete(':id')
  @RequierePermiso('productos:eliminar')
  async eliminar(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    await this.service.eliminar(id, ctx);
    return { mensaje: 'Producto eliminado' };
  }
}
