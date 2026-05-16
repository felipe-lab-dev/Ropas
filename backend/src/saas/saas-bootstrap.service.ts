import { Injectable, Logger } from '@nestjs/common';
import { SaasConfigCacheService } from './saas-config-cache.service';

@Injectable()
export class SaasBootstrapService {
  private readonly logger = new Logger(SaasBootstrapService.name);

  constructor(private readonly cache: SaasConfigCacheService) {}

  async iniciar(): Promise<void> {
    try {
      const cfg = await this.cache.obtener(true);
      this.logger.log(
        { tenant: cfg.tenant.codigo, modulos: cfg.modulosHabilitados.length },
        'Bootstrap SaaS completo',
      );
    } catch (err) {
      this.logger.error(
        { err },
        'Bootstrap SaaS falló — la API arrancará pero rechazará requests de tenant',
      );
    }
  }
}
