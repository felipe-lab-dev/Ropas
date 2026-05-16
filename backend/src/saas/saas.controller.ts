import { Controller, Get } from '@nestjs/common';
import { SaasConfigCacheService } from './saas-config-cache.service';

@Controller('saas')
export class SaasController {
  constructor(private readonly cache: SaasConfigCacheService) {}

  @Get('mi-config')
  async miConfig() {
    const cfg = await this.cache.obtener();
    return {
      datos: {
        tenant: cfg.tenant,
        plan: cfg.plan,
        modulosHabilitados: cfg.modulosHabilitados,
        accesoPermitido: cfg.accesoPermitido,
      },
    };
  }
}
