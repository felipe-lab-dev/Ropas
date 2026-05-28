/**
 * EmisionCpeNcController — endpoint REST para emitir CPE de una nota de crédito.
 *
 * Endpoints (todos bajo prefijo global 'api/v1' del AppModule):
 *   GET  /notas-credito/:id/documento-electronico
 *   POST /notas-credito/:id/emitir-cpe
 *   POST /notas-credito/:id/reintentar-cpe
 *   POST /notas-credito/:id/consultar-estado-cpe
 *
 * Visibilidad por rol (regla 2026-05-28):
 *   - Usuario con `contabilidad:leer` → objeto DocumentoElectronico completo.
 *   - Otros usuarios → solo `{pdfUrl, serie, correlativo}` SI el CPE ya está
 *     aceptado por SUNAT; sino null. NUNCA expone estado/error/hash/XML/CDR.
 */
import {
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

@Controller('notas-credito')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.NOTAS_CREDITO)
export class EmisionCpeNcController {
  constructor(private readonly documentoService: DocumentoElectronicoService) {}

  @Get(':id/documento-electronico')
  @RequierePermiso('notas-credito:leer')
  async obtener(
    @Param('id', ParseUUIDPipe) notaCreditoId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const documento = await this.documentoService.obtenerPorNotaCreditoId(ctx, notaCreditoId);
    return { datos: filtrarDocumentoSegunPermisos(documento, req.usuario!.permisos) };
  }

  @Post(':id/emitir-cpe')
  @RequierePermiso('notas-credito:emitir-cpe')
  async emitir(
    @Param('id', ParseUUIDPipe) notaCreditoId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const documento = await this.documentoService.emitirCpeNotaCredito(ctx, notaCreditoId);
    return { datos: filtrarDocumentoSegunPermisos(documento, req.usuario!.permisos) };
  }

  @Post(':id/reintentar-cpe')
  @RequierePermiso('notas-credito:emitir-cpe')
  async reintentar(
    @Param('id', ParseUUIDPipe) notaCreditoId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const documento = await this.documentoService.reintentarCpeNotaCredito(ctx, notaCreditoId);
    return { datos: filtrarDocumentoSegunPermisos(documento, req.usuario!.permisos) };
  }

  @Post(':id/consultar-estado-cpe')
  @RequierePermiso('notas-credito:emitir-cpe')
  async consultarEstado(
    @Param('id', ParseUUIDPipe) notaCreditoId: string,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const documento = await this.documentoService.consultarEstadoCpeNotaCredito(ctx, notaCreditoId);
    return { datos: filtrarDocumentoSegunPermisos(documento, req.usuario!.permisos) };
  }
}
