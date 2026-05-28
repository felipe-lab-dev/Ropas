/**
 * NotaCreditoCreadaListener — escucha el evento 'nota-credito.creada' y dispara
 * la auto-emisión del CPE de la NC si el tenant tiene emitirAlConfirmar=true.
 *
 * Suscripción: se registra en onModuleInit() sobre el AppEventEmitter.
 * Errores de emisión: capturados con log warn, nunca re-lanzados — la NC ya
 * está creada y el listener no debe afectar la respuesta al usuario.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppEventEmitter } from '../../../core/events/app-event-emitter';
import { ConfiguracionFacturacionService } from '../configuracion/configuracion-facturacion.service';
import { DocumentoElectronicoService } from '../documento-electronico/documento-electronico.service';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

export interface NotaCreditoCreadaPayload {
  notaCreditoId: string;
  tenantCode: string;
}

function ctxDesdeCodigo(tenantCode: string): TenantContext {
  return {
    codigo: tenantCode,
    schemaName: `tenant_${tenantCode.replace(/-/g, '_')}`,
    nombre: tenantCode,
    plan: '',
    modulosHabilitados: [],
    limites: {},
    accesoPermitido: true,
  };
}

@Injectable()
export class NotaCreditoCreadaListener implements OnModuleInit {
  private readonly logger = new Logger(NotaCreditoCreadaListener.name);

  constructor(
    private readonly eventEmitter: AppEventEmitter,
    private readonly configuracionService: ConfiguracionFacturacionService,
    private readonly documentoElectronicoService: DocumentoElectronicoService,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.on('nota-credito.creada', (payload: NotaCreditoCreadaPayload) => {
      this.manejar(payload).catch(() => {
        // manejar() ya captura y loguea — este catch previene unhandledRejection
      });
    });
  }

  async manejar(payload: NotaCreditoCreadaPayload): Promise<void> {
    try {
      const ctx = ctxDesdeCodigo(payload.tenantCode);
      const config = await this.configuracionService.obtenerConfiguracion(ctx);
      if (!config.emitirAlConfirmar) {
        this.logger.log(
          `Tenant ${payload.tenantCode}: emitirAlConfirmar=false, skipeando emit auto NC`,
        );
        return;
      }
      await this.documentoElectronicoService.emitirCpeNotaCredito(ctx, payload.notaCreditoId);
    } catch (err) {
      // ErrorConflicto típico: NC sin datos SUNAT (tenant sin facElec) — log y seguir.
      // Cualquier otro error: log y NO re-lanzar.
      this.logger.warn(
        `Auto-emit CPE falló para NC ${payload.notaCreditoId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
