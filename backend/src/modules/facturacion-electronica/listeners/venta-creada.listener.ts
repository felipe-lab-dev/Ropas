/**
 * VentaCreadaListener — escucha el evento 'venta.creada' y dispara la
 * auto-emisión del CPE si el tenant tiene emitirAlConfirmar=true.
 *
 * Suscripción: se registra en onModuleInit() sobre el AppEventEmitter.
 * Errores de emisión: capturados con log warn, nunca re-lanzados.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppEventEmitter } from '../../../core/events/app-event-emitter';
import { ConfiguracionFacturacionService } from '../configuracion/configuracion-facturacion.service';
import { DocumentoElectronicoService } from '../documento-electronico/documento-electronico.service';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

export interface VentaCreadaPayload {
  ventaId: string;
  tenantCode: string;
}

/**
 * Construye un TenantContext mínimo a partir del código de tenant.
 * Suficiente para que PrismaTenantService resuelva el schema correcto.
 * El schemaName sigue la convención: tenant_<code con guiones → guiones bajos>.
 */
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
export class VentaCreadaListener implements OnModuleInit {
  private readonly logger = new Logger(VentaCreadaListener.name);

  constructor(
    private readonly eventEmitter: AppEventEmitter,
    private readonly configuracionService: ConfiguracionFacturacionService,
    private readonly documentoElectronicoService: DocumentoElectronicoService,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.on('venta.creada', (payload: VentaCreadaPayload) => {
      this.manejar(payload).catch(() => {
        // manejar() ya captura y loguea — este catch previene unhandledRejection
      });
    });
  }

  async manejar(payload: VentaCreadaPayload): Promise<void> {
    try {
      const ctx = ctxDesdeCodigo(payload.tenantCode);
      const config = await this.configuracionService.obtenerConfiguracion(ctx);
      if (!config.emitirAlConfirmar) {
        this.logger.log(
          `Tenant ${payload.tenantCode}: emitirAlConfirmar=false, skipeando emit auto`,
        );
        return;
      }
      await this.documentoElectronicoService.emitirCpe(ctx, payload.ventaId);
    } catch (err) {
      // Cualquier error: log y NO re-lanzar. El doc queda en 'pendiente' o sin doc,
      // se reintenta luego vía endpoint /reintentar o cron.
      this.logger.warn(
        `Auto-emit CPE falló para venta ${payload.ventaId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
