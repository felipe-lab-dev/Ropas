import { Controller, Get } from '@nestjs/common';
import { SaasConfigCacheService } from './saas-config-cache.service';
import { BrandingService } from '../modules/branding/branding.service';

@Controller('saas')
export class SaasController {
  constructor(
    private readonly cache: SaasConfigCacheService,
    private readonly branding: BrandingService,
  ) {}

  @Get('mi-config')
  async miConfig() {
    const cfg = await this.cache.obtener();
    // Branding tenant-level (logo/nombre/eslogan) para hidratar el shell.
    const branding = await this.branding.obtenerPublico(cfg.tenant.codigo);
    return {
      datos: {
        tenant: cfg.tenant,
        plan: cfg.plan,
        modulosHabilitados: cfg.modulosHabilitados,
        accesoPermitido: cfg.accesoPermitido,
        branding,
      },
    };
  }
}
