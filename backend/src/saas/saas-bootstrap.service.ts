import { Injectable, Logger } from '@nestjs/common';
import { SaasConfigCacheService } from './saas-config-cache.service';

@Injectable()
export class SaasBootstrapService {
  private readonly logger = new Logger(SaasBootstrapService.name);

  constructor(private readonly cache: SaasConfigCacheService) {}

  async iniciar(): Promise<void> {
    // Multi-tenant: ya no hay un tenant "default" para precachear en bootstrap.
    // Cada request resuelve su tenant por X-Tenant-Code via SaasConfigCacheService.
    this.logger.log('Bootstrap SaaS listo (modo multi-tenant, resolución por request)');
    try {
      const codigoDefault = process.env.ENKI_TENANT_CODE;
      if (codigoDefault) {
        const cfg = await this.cache.obtener(codigoDefault);
        this.logger.log(
          { tenant: cfg.tenant.codigo, modulos: cfg.modulosHabilitados.length },
          'Tenant default precacheado',
        );
      }
    } catch (err) {
      this.logger.warn({ err }, 'No se pudo precachear el tenant default (no fatal)');
    }
  }
}
