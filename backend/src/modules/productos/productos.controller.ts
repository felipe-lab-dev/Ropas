import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
import { ProductosService } from './productos.service';
import { MotorLogisticoService } from './motor-logistico.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import {
  AgregarVarianteDto,
  ActualizarVarianteDto,
} from './dto/variante.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';

@Controller('productos')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('productos')
export class ProductosController {
  constructor(
    private readonly service: ProductosService,
    private readonly motor: MotorLogisticoService,
  ) {}

  @Post('motor-logistico/calcular')
  @RequierePermiso('productos:editar')
  async motorLogistico(@Tenant() ctx: TenantContext) {
    const datos = await this.motor.calcular(ctx);
    return { datos, mensaje: 'Motor Logístico ejecutado' };
  }

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
  async crear(
    @Body() dto: CrearProductoDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const producto = await this.service.crear(dto, ctx, req.usuario?.sub);
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

  // ─── Variantes ────────────────────────────────────────────────────────────

  @Post(':id/variantes')
  @RequierePermiso('productos:editar')
  async agregarVariante(
    @Param('id') id: string,
    @Body() dto: AgregarVarianteDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const variante = await this.service.agregarVariante(id, dto, ctx, req.usuario?.sub);
    return { datos: variante, mensaje: 'Variante agregada' };
  }

  @Patch(':id/variantes/:varianteId')
  @RequierePermiso('productos:editar')
  async actualizarVariante(
    @Param('id') id: string,
    @Param('varianteId') varianteId: string,
    @Body() dto: ActualizarVarianteDto,
    @Tenant() ctx: TenantContext,
  ) {
    const variante = await this.service.actualizarVariante(id, varianteId, dto, ctx);
    return { datos: variante, mensaje: 'Variante actualizada' };
  }

  // ─── Imágenes ─────────────────────────────────────────────────────────────

  @Post(':id/imagenes')
  @RequierePermiso('productos:editar')
  @UseInterceptors(FilesInterceptor('archivos', 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async subirImagenes(
    @Param('id') id: string,
    @UploadedFiles() archivos: Express.Multer.File[],
    @Tenant() ctx: TenantContext,
  ) {
    const imagenes = await this.service.subirImagenes(id, archivos ?? [], ctx);
    return { datos: { imagenes }, mensaje: 'Imágenes subidas' };
  }

  @Delete(':id/imagenes')
  @RequierePermiso('productos:editar')
  async eliminarImagen(
    @Param('id') id: string,
    @Query('url') url: string,
    @Tenant() ctx: TenantContext,
  ) {
    const imagenes = await this.service.eliminarImagen(id, url, ctx);
    return { datos: { imagenes }, mensaje: 'Imagen eliminada' };
  }

  @Delete(':id/variantes/:varianteId')
  @RequierePermiso('productos:editar')
  async eliminarVariante(
    @Param('id') id: string,
    @Param('varianteId') varianteId: string,
    @Tenant() ctx: TenantContext,
  ) {
    await this.service.eliminarVariante(id, varianteId, ctx);
    return { mensaje: 'Variante eliminada' };
  }
}
