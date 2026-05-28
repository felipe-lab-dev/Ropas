/**
 * FacturacionElectronicaModule — registra el pipeline completo de emisión CPE.
 *
 * Providers internos:
 *   - CpeCalculadoraService          (matemática SUNAT)
 *   - CpeBuilderService              (serialización JSON Mifact)
 *   - CpeOrquestadorService          (compone calculadora + builder)
 *   - MifactService                  (cliente HTTP Mifact)
 *   - SerieCpeService                (asignación atómica de correlativos + CRUD)
 *   - ConfiguracionFacturacionService (config del tenant + descifrado token)
 *   - DocumentoElectronicoService    (orquestador emisión CPE)
 *
 * Controllers:
 *   - EmisionCpeController           — emitir / reintentar / consultar CPE
 *   - ConfiguracionFacturacionController — config SUNAT/Mifact
 *   - SerieCpeController             — CRUD de series (sin DELETE — regla fiscal)
 *
 * Exports para consumidores externos:
 *   - CpeOrquestadorService          — construye el payload CPE desde datos dominio
 *   - MifactService                  — envía / anula / consulta / obtiene CPE en Mifact
 *   - SerieCpeService                — próximo correlativo por sucursal+tipo
 *   - ConfiguracionFacturacionService — config resuelta (token descifrado)
 *
 * NO importar en AppModule — el módulo raíz lo importa quien lo necesite
 * (ej. VentasModule, NotasCreditoModule).
 */
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { CpeCalculadoraService } from './cpe-calculadora/cpe-calculadora.service';
import { CpeBuilderService } from './cpe-builder/cpe-builder.service';
import { CpeOrquestadorService } from './cpe-orquestador/cpe-orquestador.service';
import { MifactService } from './mifact/mifact.service';
import { SerieCpeService } from './series-cpe/series-cpe.service';
import { SerieCpeController } from './series-cpe/series-cpe.controller';
import { ConfiguracionFacturacionService } from './configuracion/configuracion-facturacion.service';
import { DocumentoElectronicoService } from './documento-electronico/documento-electronico.service';
import { EmisionCpeController } from './emision-cpe/emision-cpe.controller';
import { EmisionCpeNcController } from './emision-cpe/emision-cpe-nc.controller';
import { ConfiguracionFacturacionController } from './configuracion/configuracion-facturacion.controller';
import { VentaCreadaListener } from './listeners/venta-creada.listener';
import { NotaCreditoCreadaListener } from './listeners/nota-credito-creada.listener';
import { PollEstadosCpeCron } from './cron/poll-estados-cpe.cron';
import { PrismaPublicService } from '../../core/prisma/prisma-public.service';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [
    EmisionCpeController,
    EmisionCpeNcController,
    ConfiguracionFacturacionController,
    SerieCpeController,
  ],
  providers: [
    CpeCalculadoraService,
    CpeBuilderService,
    CpeOrquestadorService,
    MifactService,
    SerieCpeService,
    ConfiguracionFacturacionService,
    DocumentoElectronicoService,
    VentaCreadaListener,
    NotaCreditoCreadaListener,
    // ─── Cron de polling de estados CPE ─────────────────────────────────────
    {
      provide: 'DOCUMENTO_SERVICE_FACTORY',
      useFactory:
        (prismaTenancy: PrismaTenantService, orquestador: CpeOrquestadorService, mifact: MifactService) =>
        () =>
          new DocumentoElectronicoService(
            prismaTenancy,
            new ConfiguracionFacturacionService(prismaTenancy),
            new SerieCpeService(prismaTenancy),
            orquestador,
            mifact,
          ),
      inject: [PrismaTenantService, CpeOrquestadorService, MifactService],
    },
    PollEstadosCpeCron,
  ],
  exports: [
    CpeOrquestadorService,
    MifactService,
    SerieCpeService,
    ConfiguracionFacturacionService,
    DocumentoElectronicoService,
  ],
})
export class FacturacionElectronicaModule {}
