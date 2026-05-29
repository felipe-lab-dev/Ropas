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
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CuponesService } from './cupones.service';
import { CuponRenderService } from './cupon-render.service';
import { CrearCuponDto } from './dto/crear-cupon.dto';
import { ActualizarCuponDto } from './dto/actualizar-cupon.dto';
import { AplicarPlantillaDto } from './dto/aplicar-plantilla.dto';
import { ValidarCuponDto } from './dto/validar-cupon.dto';
import { PLANTILLAS_LISTA, generarCodigoCupon } from './plantillas-cupones';
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
  ) {}

  // ─── PLANTILLAS (público dentro del tenant, sin permiso especial) ────

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
    });
    res
      .setHeader('Content-Type', 'image/png')
      .setHeader('Content-Disposition', `inline; filename="cupon-${cupon.codigo}.png"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }
}
