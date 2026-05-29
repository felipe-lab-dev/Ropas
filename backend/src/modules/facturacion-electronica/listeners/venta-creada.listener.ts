/**
 * VentaCreadaListener — escucha el evento 'venta.creada' y dispara la
 * auto-emisión del CPE.
 *
 * Suscripción: se registra en onModuleInit() sobre el AppEventEmitter.
 * Errores de emisión: capturados con log warn, nunca re-lanzados. Si el tenant
 * no tiene ConfiguracionFacturacion, `emitirCpe` lanza ErrorNoEncontrado, que
 * cae en el catch y el documento queda para reintento manual o vía cron.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppEventEmitter } from '../../../core/events/app-event-emitter';
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
      await this.documentoElectronicoService.emitirCpe(ctx, payload.ventaId);
    } catch (err) {
      // Cualquier error (sin config, Mifact down, venta sin tipoCpe): log y NO re-lanzar.
      // El doc queda en 'pendiente' o sin doc, se reintenta luego vía endpoint o cron.
      this.logger.warn(
        `Auto-emit CPE falló para venta ${payload.ventaId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
