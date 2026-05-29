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
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Express, Request, Response } from 'express';
import { ProductosService } from './productos.service';
import { MotorLogisticoService } from './motor-logistico.service';
import { ImportacionProductosService } from './importacion-productos.service';
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
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('productos')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.PRODUCTOS)
export class ProductosController {
  constructor(
    private readonly service: ProductosService,
    private readonly motor: MotorLogisticoService,
    private readonly importacion: ImportacionProductosService,
  ) {}

  @Post('motor-logistico/calcular')
  @RequierePermiso('productos:editar')
  async motorLogistico(@Tenant() ctx: TenantContext) {
    const datos = await this.motor.calcular(ctx);
    return { datos, mensaje: 'Motor Logístico ejecutado' };
  }

  // ─── Importación / Exportación ────────────────────────────────────────

  @Get('importar/plantilla')
  @RequierePermiso('productos:crear')
  plantilla(@Res() res: Response): void {
    const csv = this.importacion.plantillaCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-productos.csv"');
    res.send(csv);
  }

  @Post('importar')
  @RequierePermiso('productos:crear')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importar(
    @UploadedFile() archivo: Express.Multer.File,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.importacion.importar(archivo, ctx, req.usuario?.sub);
    return { datos, mensaje: 'Importación completada' };
  }

  @Get('exportar')
  @RequierePermiso('productos:leer')
  async exportar(@Tenant() ctx: TenantContext, @Res() res: Response) {
    const csv = await this.importacion.exportarCsv(ctx);
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="productos-${fecha}.csv"`);
    res.send(csv);
  }

  @Get('importaciones/historial')
  @RequierePermiso('productos:leer')
  async historialImportaciones(@Query() query: any, @Tenant() ctx: TenantContext) {
    return this.importacion.historial(query, ctx);
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

  @Get(':id/insights')
  @RequierePermiso('productos:leer')
  async insights(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    const datos = await this.service.obtenerInsights(id, ctx);
    return { datos };
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
  @UseInterceptors(FilesInterceptor('archivos', 10, { limits: { fileSize: 25 * 1024 * 1024 } }))
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
