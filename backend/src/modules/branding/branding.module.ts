import { Global, Module } from '@nestjs/common';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';

/**
 * Global para que SaasController (/saas/mi-config) y ConfiguracionController
 * (PUT /configuracion/branding) inyecten BrandingService sin wiring extra.
 */
@Global()
@Module({
  controllers: [BrandingController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
