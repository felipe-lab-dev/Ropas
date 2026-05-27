/**
 * ConfiguracionFacturacionService — singleton de configuración del tenant.
 *
 * Lee la única fila de `configuracion_facturacion`, descifra el token Mifact
 * con AES-256-GCM (usando la clave maestra de entorno) y retorna el DTO
 * listo para consumir por el orquestador CPE.
 */
import { Injectable } from '@nestjs/common';
import { cifrar, descifrar } from '../../../core/cifrado/cifrado';
import {
  ErrorNoEncontrado,
  ErrorAplicacion,
  ErrorValidacion,
} from '../../../core/errors/errores';
import { ubigeoExiste } from '../../../core/sunat/ubigeos';
import { GuardarConfiguracionFacturacionDto } from './dto/guardar-configuracion-facturacion.dto';
import { PrismaTenantService } from '../../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../../core/tenancy/tenant-context';

export interface ConfiguracionFacturacionGuardada {
  tokenConfigurado: boolean;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccionFiscal: string;
  ubigeoFiscalCodigo: string;
  mifactBaseUrl: string;
  enviarAutomaticoASunat: boolean;
  emitirAlConfirmar: boolean;
  retornarPdf: boolean;
  retornarXmlEnvio: boolean;
  retornarXmlCdr: boolean;
  formatoImpresion: string;
  correoNotificacion: string | null;
}

export interface ConfiguracionFacturacionResuelta {
  mifactToken: string;
  mifactBaseUrl: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccionFiscal: string;
  ubigeoFiscalCodigo: string;
  enviarAutomaticoASunat: boolean;
  retornarPdf: boolean;
  retornarXmlEnvio: boolean;
  retornarXmlCdr: boolean;
  formatoImpresion: string;
  correoNotificacion: string | null;
  emitirAlConfirmar: boolean;
}

@Injectable()
export class ConfiguracionFacturacionService {
  constructor(private readonly prismaTenancy: PrismaTenantService) {}

  async obtenerConfiguracion(ctx: TenantContext): Promise<ConfiguracionFacturacionResuelta> {
    const config = await this.prismaTenancy.forTenant(ctx).configuracionFacturacion.findFirst();

    if (!config) {
      throw new ErrorNoEncontrado(
        'Tenant no tiene configuración de facturación electrónica. ' +
          'Configura RUC, token Mifact y datos fiscales primero.',
      );
    }

    const masterKey = process.env.FACTURACION_MASTER_KEY;
    if (!masterKey) {
      throw new ErrorAplicacion(500, 'FACTURACION_MASTER_KEY no configurada');
    }

    const mifactToken = descifrar(config.mifactTokenCifrado, masterKey);

    return {
      mifactToken,
      mifactBaseUrl: config.mifactBaseUrl,
      ruc: config.ruc,
      razonSocial: config.razonSocial,
      nombreComercial: config.nombreComercial,
      direccionFiscal: config.direccionFiscal,
      ubigeoFiscalCodigo: config.ubigeoFiscalCodigo,
      enviarAutomaticoASunat: config.enviarAutomaticoASunat,
      retornarPdf: config.retornarPdf,
      retornarXmlEnvio: config.retornarXmlEnvio,
      retornarXmlCdr: config.retornarXmlCdr,
      formatoImpresion: config.formatoImpresion,
      correoNotificacion: config.correoNotificacion,
      emitirAlConfirmar: config.emitirAlConfirmar,
    };
  }

  async guardarConfiguracion(
    ctx: TenantContext,
    dto: GuardarConfiguracionFacturacionDto,
  ): Promise<ConfiguracionFacturacionGuardada> {
    const masterKey = process.env.FACTURACION_MASTER_KEY;
    if (!masterKey) {
      throw new ErrorAplicacion(500, 'FACTURACION_MASTER_KEY no configurada en el servidor');
    }

    // Validar que el UBIGEO existe
    if (!ubigeoExiste(dto.ubigeoFiscalCodigo)) {
      throw new ErrorValidacion(`UBIGEO ${dto.ubigeoFiscalCodigo} no es válido`);
    }

    const prisma = this.prismaTenancy.forTenant(ctx);

    // Buscar configuración existente
    const existente = await prisma.configuracionFacturacion.findFirst();

    // Determinar token cifrado
    let tokenCifrado: string;
    if (dto.mifactToken && dto.mifactToken.trim()) {
      tokenCifrado = cifrar(dto.mifactToken, masterKey);
    } else if (existente) {
      tokenCifrado = existente.mifactTokenCifrado;
    } else {
      throw new ErrorValidacion(
        'mifactToken es obligatorio al crear la configuración por primera vez',
      );
    }

    const data = {
      ruc: dto.ruc,
      razonSocial: dto.razonSocial,
      nombreComercial: dto.nombreComercial ?? null,
      direccionFiscal: dto.direccionFiscal,
      ubigeoFiscalCodigo: dto.ubigeoFiscalCodigo,
      mifactTokenCifrado: tokenCifrado,
      mifactBaseUrl: dto.mifactBaseUrl ?? 'https://demo.mifact.net.pe',
      enviarAutomaticoASunat: dto.enviarAutomaticoASunat ?? true,
      emitirAlConfirmar: dto.emitirAlConfirmar ?? true,
      retornarPdf: dto.retornarPdf ?? true,
      retornarXmlEnvio: dto.retornarXmlEnvio ?? false,
      retornarXmlCdr: dto.retornarXmlCdr ?? false,
      formatoImpresion: dto.formatoImpresion ?? '001',
      correoNotificacion: dto.correoNotificacion ?? null,
    };

    if (existente) {
      await prisma.configuracionFacturacion.update({
        where: { id: existente.id },
        data,
      });
    } else {
      await prisma.configuracionFacturacion.create({ data });
    }

    // Retornar versión segura sin token
    return {
      tokenConfigurado: true,
      ruc: data.ruc,
      razonSocial: data.razonSocial,
      nombreComercial: data.nombreComercial,
      direccionFiscal: data.direccionFiscal,
      ubigeoFiscalCodigo: data.ubigeoFiscalCodigo,
      mifactBaseUrl: data.mifactBaseUrl,
      enviarAutomaticoASunat: data.enviarAutomaticoASunat,
      emitirAlConfirmar: data.emitirAlConfirmar,
      retornarPdf: data.retornarPdf,
      retornarXmlEnvio: data.retornarXmlEnvio,
      retornarXmlCdr: data.retornarXmlCdr,
      formatoImpresion: data.formatoImpresion,
      correoNotificacion: data.correoNotificacion,
    };
  }
}
