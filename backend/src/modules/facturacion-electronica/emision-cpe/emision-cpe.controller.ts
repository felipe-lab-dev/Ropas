/**
 * EmisionCpeController — endpoint REST para emitir CPE de una venta.
 *
 * POST /ventas/:id/emitir-cpe
 *
 * El controller vive bajo el prefijo global 'api/v1' que configura el AppModule.
 * El interceptor RespuestaInterceptor envuelve la respuesta en {exito:true, datos:...}
 * automáticamente — el controller solo retorna {datos: documento}.
 *
 * Nota: reutiliza los guards de VentasModule (ModuloHabilitadoGuard + AuthGuard)
 * y el permiso 'ventas:emitir-cpe'.
 */
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DocumentoElectronicoService } from '../documento-electronico/documento-electronico.service';
import { AuthGuard, RequierePermiso } from '../../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../../saas/modulo-habilitado.guard';
import { Tenant } from '../../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../../core/tenancy/tenant-context';

@Controller('ventas')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('ventas')
export class EmisionCpeController {
  constructor(private readonly documentoService: DocumentoElectronicoService) {}

  @Get(':id/documento-electronico')
  @RequierePermiso('ventas:ver')
  async obtener(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Tenant() ctx: TenantContext,
  ) {
    const documento = await this.documentoService.obtenerPorVentaId(ctx, ventaId);
    return { datos: documento };
  }

  @Post(':id/emitir-cpe')
  @RequierePermiso('ventas:emitir-cpe')
  async emitir(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Tenant() ctx: TenantContext,
  ) {
    const datos = await this.documentoService.emitirCpe(ctx, ventaId);
    return { datos };
  }

  @Post(':id/reintentar-cpe')
  @RequierePermiso('ventas:emitir-cpe')
  async reintentar(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Tenant() ctx: TenantContext,
  ) {
    const documento = await this.documentoService.reintentarCpe(ctx, ventaId);
    return { datos: documento };
  }

  @Post(':id/consultar-estado-cpe')
  @RequierePermiso('ventas:emitir-cpe')
  async consultarEstado(
    @Param('id', ParseUUIDPipe) ventaId: string,
    @Tenant() ctx: TenantContext,
  ) {
    const documento = await this.documentoService.consultarEstadoCpe(ctx, ventaId);
    return { datos: documento };
  }
}
