/**
 * EmisionCpeController — endpoints REST para emitir CPE de una venta.
 *
 * Endpoints (todos bajo prefijo global 'api/v1' del AppModule):
 *   GET  /ventas/:id/documento-electronico
 *   POST /ventas/:id/emitir-cpe
 *   POST /ventas/:id/reintentar-cpe
 *   POST /ventas/:id/consultar-estado-cpe
 *
 * Visibilidad por rol (regla 2026-05-28):
 *   - Usuario con `contabilidad:leer` → objeto DocumentoElectronico completo.
 *   - Otros usuarios → solo `{pdfUrl, serie, correlativo}` SI el CPE ya está
 *     aceptado por SUNAT; sino null. NUNCA expone estado/error/hash/XML/CDR.
 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { DocumentoElectronicoService } from '../documento-electronico/documento-electronico.service';
import { AuthGuard, RequierePermiso } from '../../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../../saas/catalogo-modulos';
import { Tenant } from '../../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../../core/tenancy/tenant-context';
import { filtrarDocumentoSegunPermisos } from './filtrar-documento-segun-permisos';

@Controller('ventas')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.VENTAS)
export class EmisionCpeController {
  constructor(private readonly documentoService: DocumentoElectronicoService) {}

  @Get(':id/documento-electronico')
  @RequierePermiso('ventas:ver')
  async obtener(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const documento = await this.documentoService.obtenerPorVentaId(ctx, ventaId);
    return { datos: filtrarDocumentoSegunPermisos(documento, req.usuario!.permisos) };
  }

  @Post(':id/emitir-cpe')
  @RequierePermiso('ventas:emitir-cpe')
  async emitir(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.documentoService.emitirCpe(ctx, ventaId);
    return { datos: filtrarDocumentoSegunPermisos(datos, req.usuario!.permisos) };
  }

  @Post(':id/reintentar-cpe')
  @RequierePermiso('ventas:emitir-cpe')
  async reintentar(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const documento = await this.documentoService.reintentarCpe(ctx, ventaId);
    return { datos: filtrarDocumentoSegunPermisos(documento, req.usuario!.permisos) };
  }

  @Post(':id/consultar-estado-cpe')
  @RequierePermiso('ventas:emitir-cpe')
  async consultarEstado(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const documento = await this.documentoService.consultarEstadoCpe(ctx, ventaId);
    return { datos: filtrarDocumentoSegunPermisos(documento, req.usuario!.permisos) };
  }

  /**
   * Solicita la BAJA del CPE a SUNAT (LowInvoice).
   *
   * Distinto de emitir una NC: la anulación deshace el comprobante en SUNAT
   * como si nunca hubiera existido. Solo aplica sobre CPEs aceptados.
   *
   * Body: `{ motivo: string }` — mínimo 5 caracteres.
   */
  @Post(':id/anular-cpe')
  @RequierePermiso('ventas:emitir-cpe')
  async anular(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Body() body: { motivo?: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const documento = await this.documentoService.anularCpeVenta(ctx, ventaId, body?.motivo ?? '');
    return { datos: filtrarDocumentoSegunPermisos(documento, req.usuario!.permisos) };
  }
}
