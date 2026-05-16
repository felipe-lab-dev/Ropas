import { Global, MiddlewareConsumer, Module, NestModule, OnApplicationBootstrap } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EnkiClient } from './enki.client';
import { SaasConfigCacheService } from './saas-config-cache.service';
import { SaasBootstrapService } from './saas-bootstrap.service';
import { HeartbeatService } from './heartbeat.service';
import { SaasController } from './saas.controller';
import { ModuloHabilitadoGuard } from './modulo-habilitado.guard';
import { TenantMiddleware } from '../core/tenancy/tenant.middleware';

@Global()
@Module({
  imports: [HttpModule.register({ timeout: 8000 })],
  controllers: [SaasController],
  providers: [
    EnkiClient,
    SaasConfigCacheService,
    SaasBootstrapService,
    HeartbeatService,
    ModuloHabilitadoGuard,
    TenantMiddleware,
  ],
  exports: [SaasConfigCacheService, ModuloHabilitadoGuard],
})
export class SaasModule implements NestModule, OnApplicationBootstrap {
  constructor(private readonly bootstrap: SaasBootstrapService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bootstrap.iniciar();
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
