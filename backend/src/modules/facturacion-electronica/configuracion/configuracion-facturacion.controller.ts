import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ConfiguracionFacturacionService } from './configuracion-facturacion.service';
import { GuardarConfiguracionFacturacionDto } from './dto/guardar-configuracion-facturacion.dto';
import { AuthGuard, RequierePermiso } from '../../auth/auth.guard';
import { ErrorNoEncontrado } from '../../../core/errors/errores';
import { Tenant } from '../../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../../core/tenancy/tenant-context';

@Controller('configuracion-facturacion')
@UseGuards(AuthGuard)
export class ConfiguracionFacturacionController {
  constructor(
    private readonly configuracionService: ConfiguracionFacturacionService,
  ) {}

  /**
   * Devuelve la configuración de facturación del tenant.
   * CRÍTICO: el token Mifact NUNCA sale en plano. Solo se expone tokenConfigurado: boolean.
   * Si no hay configuración → { datos: null } (no 404, para que el form sepa que hay que crear).
   */
  @Get()
  @RequierePermiso('configuracion:ver')
  async obtener(@Tenant() ctx: TenantContext) {
    try {
      const config = await this.configuracionService.obtenerConfiguracion(ctx);
      return {
        datos: {
          ruc: config.ruc,
          razonSocial: config.razonSocial,
          nombreComercial: config.nombreComercial,
          direccionFiscal: config.direccionFiscal,
          ubigeoFiscalCodigo: config.ubigeoFiscalCodigo,
          mifactBaseUrl: config.mifactBaseUrl,
          tokenConfigurado: !!config.mifactToken, // NUNCA exponer el token plano
          enviarAutomaticoASunat: config.enviarAutomaticoASunat,
          emitirAlConfirmar: config.emitirAlConfirmar,
          retornarPdf: config.retornarPdf,
          retornarXmlEnvio: config.retornarXmlEnvio,
          retornarXmlCdr: config.retornarXmlCdr,
          formatoImpresion: config.formatoImpresion,
        },
      };
    } catch (err) {
      // Sin config → null (no 404) para que el frontend sepa que debe crear
      if (err instanceof ErrorNoEncontrado) {
        return { datos: null };
      }
      throw err;
    }
  }

  @Put()
  @RequierePermiso('configuracion:editar')
  async guardar(
    @Body() dto: GuardarConfiguracionFacturacionDto,
    @Tenant() ctx: TenantContext,
  ) {
    const resultado = await this.configuracionService.guardarConfiguracion(ctx, dto);
    return { datos: resultado, mensaje: 'Configuración de facturación guardada' };
  }
}
