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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CuponesService } from './cupones.service';
import { CuponRenderService } from './cupon-render.service';
import { CrearCuponDto } from './dto/crear-cupon.dto';
import { ActualizarCuponDto } from './dto/actualizar-cupon.dto';
import { AplicarPlantillaDto } from './dto/aplicar-plantilla.dto';
import { ValidarCuponDto } from './dto/validar-cupon.dto';
import { PLANTILLAS_LISTA, generarCodigoCupon } from './plantillas-cupones';
import { TEMAS_ESTACIONALES } from './temas-estacionales';
import { AzureBlobService } from '../../core/storage/azure-blob.service';
import { ErrorValidacion } from '../../core/errors/errores';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import {
  ModuloHabilitado,
  ModuloHabilitadoGuard,
} from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('cupones')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.CUPONES)
export class CuponesController {
  constructor(
    private readonly service: CuponesService,
    private readonly render: CuponRenderService,
    private readonly blob: AzureBlobService,
  ) {}

  // ─── PLANTILLAS y TEMAS (público dentro del tenant) ──────────────────

  @Get('temas') @RequierePermiso('cupones:leer')
  listarTemas() {
    return { datos: TEMAS_ESTACIONALES };
  }

  /**
   * Sube una imagen (PNG/JPG/WebP) para usar como fondo de un cupón.
   * El blob queda en `<tenant>/cupones/fondos/<uuid>.<ext>` y devuelve la URL pública.
   */
  @Post('fondos/upload') @RequierePermiso('cupones:crear')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async subirFondo(
    @UploadedFile() archivo: Express.Multer.File,
    @Tenant() ctx: TenantContext,
  ) {
    if (!archivo) throw new ErrorValidacion('No se recibió archivo');

    const mimeOk = ['image/png', 'image/jpeg', 'image/webp'];
    if (!mimeOk.includes(archivo.mimetype)) {
      throw new ErrorValidacion(`Solo PNG, JPG o WebP (recibido: ${archivo.mimetype})`);
    }
    if (archivo.size > 5 * 1024 * 1024) {
      throw new ErrorValidacion('Tamaño máximo 5 MB');
    }
    const ext =
      archivo.mimetype === 'image/png' ? 'png' :
      archivo.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const url = await this.blob.subir(
      ctx.codigo,
      `cupones/fondos/${randomUUID()}.${ext}`,
      archivo.buffer,
      archivo.mimetype,
    );
    return { datos: { url }, mensaje: 'Fondo subido' };
  }

  @Get('plantillas') @RequierePermiso('cupones:leer')
  listarPlantillas() {
    return {
      datos: PLANTILLAS_LISTA.map(p => ({
        id: p.id,
        emoji: p.emoji,
        titulo: p.titulo,
        tagline: p.tagline,
        copyMarketing: p.copyMarketing,
        diasVigenciaSugeridos: p.diasVigenciaSugeridos,
        config: p.config,
      })),
    };
  }

  @Get('codigo-sugerido') @RequierePermiso('cupones:leer')
  sugerirCodigo(@Query('prefijo') prefijo?: string) {
    return { datos: { codigo: generarCodigoCupon(prefijo) } };
  }

  // ─── CRUD ────────────────────────────────────────────────────────────

  @Get() @RequierePermiso('cupones:leer')
  listar(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listar(q, ctx);
  }

  @Get(':id') @RequierePermiso('cupones:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  @Get(':id/estadisticas') @RequierePermiso('cupones:leer')
  async estadisticas(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.estadisticas(id, ctx) };
  }

  @Get(':id/usos') @RequierePermiso('cupones:leer')
  async usos(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.historial(id, ctx) };
  }

  @Post() @RequierePermiso('cupones:crear')
  async crear(@Body() dto: CrearCuponDto, @Tenant() ctx: TenantContext, @Req() req: Request) {
    return {
      datos: await this.service.crear(dto, ctx, req.usuario?.sub),
      mensaje: 'Cupón creado',
    };
  }

  @Post('desde-plantilla') @RequierePermiso('cupones:crear')
  async desdePlantilla(
    @Body() dto: AplicarPlantillaDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    return {
      datos: await this.service.crearDesdePlantilla(dto, ctx, req.usuario?.sub),
      mensaje: 'Campaña creada desde plantilla',
    };
  }

  @Patch(':id') @RequierePermiso('cupones:editar')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarCuponDto,
    @Tenant() ctx: TenantContext,
  ) {
    return {
      datos: await this.service.actualizar(id, dto, ctx),
      mensaje: 'Cupón actualizado',
    };
  }

  @Delete(':id') @RequierePermiso('cupones:eliminar')
  async eliminar(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    await this.service.eliminar(id, ctx);
    return { mensaje: 'Cupón eliminado' };
  }

  // ─── VALIDAR (usado por POS antes de confirmar venta) ────────────────

  @Post('validar') @RequierePermiso('cupones:aplicar')
  async validar(@Body() dto: ValidarCuponDto, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.validar(dto, ctx) };
  }

  // ─── RENDER (PDF / PNG) ──────────────────────────────────────────────

  @Get(':id/pdf') @RequierePermiso('cupones:leer')
  async pdf(
    @Param('id') id: string,
    @Query('tienda') tiendaOverride: string | undefined,
    @Tenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const cupon = await this.service.obtener(id, ctx);
    const buffer = await this.render.generarPdf({
      codigo: cupon.codigo,
      nombre: cupon.nombre,
      descripcion: cupon.descripcion,
      tipoDescuento: cupon.tipoDescuento as never,
      valorDescuento: Number(cupon.valorDescuento.toString()),
      fechaFin: cupon.fechaFin,
      montoMinimoCompra: cupon.montoMinimoCompra ? Number(cupon.montoMinimoCompra.toString()) : null,
      campania: cupon.campania,
      disenoColorPrimario: cupon.disenoColorPrimario,
      disenoColorSecundario: cupon.disenoColorSecundario,
      disenoMensaje: cupon.disenoMensaje,
      disenoEmoji: cupon.disenoEmoji,
      tienda: tiendaOverride?.trim() || ctx.nombre,
      temaEstacional: cupon.temaEstacional,
      fondoImagenUrl: cupon.fondoImagenUrl,
    });
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `inline; filename="cupon-${cupon.codigo}.pdf"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }

  @Get(':id/imagen') @RequierePermiso('cupones:leer')
  async imagen(
    @Param('id') id: string,
    @Query('tienda') tiendaOverride: string | undefined,
    @Tenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const cupon = await this.service.obtener(id, ctx);
    const buffer = await this.render.generarPng({
      codigo: cupon.codigo,
      nombre: cupon.nombre,
      descripcion: cupon.descripcion,
      tipoDescuento: cupon.tipoDescuento as never,
      valorDescuento: Number(cupon.valorDescuento.toString()),
      fechaFin: cupon.fechaFin,
      montoMinimoCompra: cupon.montoMinimoCompra ? Number(cupon.montoMinimoCompra.toString()) : null,
      campania: cupon.campania,
      disenoColorPrimario: cupon.disenoColorPrimario,
      disenoColorSecundario: cupon.disenoColorSecundario,
      disenoMensaje: cupon.disenoMensaje,
      disenoEmoji: cupon.disenoEmoji,
      tienda: tiendaOverride?.trim() || ctx.nombre,
      temaEstacional: cupon.temaEstacional,
      fondoImagenUrl: cupon.fondoImagenUrl,
    });
    res
      .setHeader('Content-Type', 'image/png')
      .setHeader('Content-Disposition', `inline; filename="cupon-${cupon.codigo}.png"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }
}
