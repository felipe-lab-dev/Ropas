import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ContabilidadService } from './contabilidad.service';
import { AsientosService } from './asientos.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import {
  ModuloHabilitado,
  ModuloHabilitadoGuard,
} from '../../saas/modulo-habilitado.guard';

@Controller('contabilidad')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('contabilidad')
export class ContabilidadController {
  constructor(
    private readonly service: ContabilidadService,
    private readonly asientos: AsientosService,
  ) {}

  @Get('plan-cuentas') @RequierePermiso('contabilidad:leer')
  async planCuentas(@Tenant() ctx: TenantContext) {
    return { datos: await this.service.planCuentas(ctx) };
  }

  @Get('asientos') @RequierePermiso('contabilidad:leer')
  async listarAsientos(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listarAsientos(q, ctx);
  }

  @Get('asientos/:id') @RequierePermiso('contabilidad:leer')
  async obtenerAsiento(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtenerAsiento(id, ctx) };
  }

  @Post('asientos') @RequierePermiso('contabilidad:crear')
  async crearAsiento(@Body() dto: any, @Tenant() ctx: TenantContext, @Req() req: Request) {
    const datos = await this.asientos.crear(
      {
        fecha: new Date(dto.fecha),
        glosa: dto.glosa,
        tipoOperacion: dto.tipoOperacion ?? 'asiento_manual',
        detalles: dto.detalles,
        usuarioId: req.usuario!.sub,
      },
      ctx,
    );
    return { datos, mensaje: `Asiento ${datos.numero} registrado` };
  }

  @Post('asientos/:id/reversar') @RequierePermiso('contabilidad:reversar')
  async reversar(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.asientos.reversar(id, body.motivo, ctx, req.usuario!.sub);
    return { datos, mensaje: 'Asiento reversado' };
  }

  @Get('libro-diario') @RequierePermiso('contabilidad:leer')
  async libroDiario(
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Tenant() ctx: TenantContext,
  ) {
    return { datos: await this.service.libroDiario(Number(anio), Number(mes), ctx) };
  }

  @Get('libro-mayor') @RequierePermiso('contabilidad:leer')
  async libroMayor(
    @Query('cuenta') cuenta: string,
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Tenant() ctx: TenantContext,
  ) {
    return {
      datos: await this.service.libroMayor(cuenta, Number(anio), Number(mes), ctx),
    };
  }

  @Get('registro-ventas') @RequierePermiso('contabilidad:leer')
  async registroVentas(
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Tenant() ctx: TenantContext,
  ) {
    return { datos: await this.service.registroVentas(Number(anio), Number(mes), ctx) };
  }

  @Get('registro-compras') @RequierePermiso('contabilidad:leer')
  async registroCompras(
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Tenant() ctx: TenantContext,
  ) {
    return { datos: await this.service.registroCompras(Number(anio), Number(mes), ctx) };
  }

  @Get('estado-resultados') @RequierePermiso('contabilidad:leer')
  async estadoResultados(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Tenant() ctx: TenantContext,
  ) {
    return {
      datos: await this.service.estadoResultados(new Date(desde), new Date(hasta), ctx),
    };
  }

  @Get('periodos') @RequierePermiso('contabilidad:leer')
  async periodos(@Tenant() ctx: TenantContext) {
    return { datos: await this.service.listarPeriodos(ctx) };
  }

  @Post('periodos/:id/cerrar') @RequierePermiso('contabilidad:cerrar')
  async cerrar(@Param('id') id: string, @Tenant() ctx: TenantContext, @Req() req: Request) {
    const datos = await this.service.cerrarPeriodo(id, ctx, req.usuario!.sub);
    return { datos, mensaje: 'Período cerrado' };
  }

  @Get('exportar/ple') @RequierePermiso('contabilidad:exportar')
  async exportarPle(
    @Query('libro') libro: string,
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Tenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const contenido = await this.service.exportarPle(libro, Number(anio), Number(mes), ctx);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="LE${anio}${String(mes).padStart(2, '0')}_${libro}.txt"`,
    );
    res.send(contenido);
  }
}
