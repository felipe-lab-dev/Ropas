/**
 * PollEstadosCpeCron — barrido periódico de documentos electrónicos en estado
 * `en_proceso` para todos los tenants activos.
 *
 * Flujo por ejecución:
 *   1. Lista tenants con estado 'activo' o 'trial' (no suspendidos/cancelados).
 *   2. Por cada tenant, obtiene hasta 50 documentos con estadoSunat = 'en_proceso'
 *      que no hayan sido actualizados en los últimos 5 minutos (anti-hammering).
 *   3. Para cada documento llama a DocumentoElectronicoService.consultarEstadoCpe(ctx, ventaId).
 *   4. Los errores por tenant y por documento se capturan localmente — nunca
 *      interrumpen el resto del barrido.
 *
 * Anti-overlap: si el barrido anterior aún no terminó cuando llega el siguiente
 * tick del cron, el nuevo tick se descarta (flag `corriendo`).
 *
 * Intervalo configurable vía env var FACTURACION_POLLING_CRON (default: cada 10 min).
 */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaPublicService } from '../../../core/prisma/prisma-public.service';
import { PrismaTenantService } from '../../../core/prisma/prisma-tenant.service';
import type { TenantContext } from '../../../core/tenancy/tenant-context';
import type { DocumentoElectronicoService } from '../documento-electronico/documento-electronico.service';

/** Cantidad máxima de documentos por tenant por ciclo. */
const MAX_DOCS_POR_TENANT = 50;

/** Tiempo mínimo (ms) entre consultas al mismo documento. */
const MIN_INTERVALO_DOC_MS = 5 * 60_000;

/** Estados de tenant que se incluyen en el barrido. */
const ESTADOS_TENANT_ACTIVOS = ['activo', 'trial'];

export type DocumentoElectronicoServiceFactory = () => DocumentoElectronicoService;

@Injectable()
export class PollEstadosCpeCron {
  private readonly logger = new Logger(PollEstadosCpeCron.name);

  /** Flag simple de anti-overlap. */
  private corriendo = false;

  constructor(
    private readonly prismaPublic: PrismaPublicService,
    private readonly prismaTenancy: PrismaTenantService,
    @Inject('DOCUMENTO_SERVICE_FACTORY')
    private readonly crearDocSvc: DocumentoElectronicoServiceFactory,
  ) {}

  @Cron(process.env.FACTURACION_POLLING_CRON ?? '*/10 * * * *')
  async barrer(): Promise<void> {
    if (this.corriendo) {
      this.logger.log('Saltando ciclo: barrido anterior aún en curso');
      return;
    }
    this.corriendo = true;
    try {
      await this.ejecutar();
    } finally {
      this.corriendo = false;
    }
  }

  private async ejecutar(): Promise<void> {
    const tenants = await this.listarTenantsActivos();
    if (tenants.length === 0) {
      this.logger.log('Sin tenants activos — nada que barrer');
      return;
    }

    this.logger.log(`Iniciando barrido CPE para ${tenants.length} tenant(s)`);

    for (const tenant of tenants) {
      try {
        await this.procesarTenant(tenant);
      } catch (err) {
        this.logger.warn(
          `Error procesando tenant ${tenant.codigo}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log('Barrido CPE completado');
  }

  private async listarTenantsActivos(): Promise<
    Pick<TenantContext, 'codigo' | 'schemaName' | 'nombre'>[]
  > {
    const tenants = await this.prismaPublic.tenant.findMany({
      where: {
        estado: { in: ESTADOS_TENANT_ACTIVOS as ('activo' | 'trial')[] },
        eliminadoEn: null,
      },
      select: { codigo: true, schemaName: true, nombre: true },
    });
    return tenants;
  }

  private async procesarTenant(
    tenant: Pick<TenantContext, 'codigo' | 'schemaName' | 'nombre'>,
  ): Promise<void> {
    const ctx: TenantContext = {
      codigo: tenant.codigo,
      schemaName: tenant.schemaName,
      nombre: tenant.nombre,
      plan: '',
      modulosHabilitados: [],
      limites: {},
      accesoPermitido: true,
    };

    const prismaTenant = this.prismaTenancy.forTenant(ctx);

    const docs = await prismaTenant.documentoElectronico.findMany({
      where: {
        estadoSunat: 'en_proceso',
        actualizadoEn: { lt: new Date(Date.now() - MIN_INTERVALO_DOC_MS) },
      },
      take: MAX_DOCS_POR_TENANT,
      select: { ventaId: true, id: true },
    });

    if (docs.length === 0) return;

    this.logger.log(
      `tenant ${tenant.codigo}: ${docs.length} doc(s) en_proceso a revisar`,
    );

    const docSvc = this.crearDocSvc();

    for (const doc of docs) {
      if (!doc.ventaId) continue;
      try {
        await docSvc.consultarEstadoCpe(ctx, doc.ventaId);
      } catch (err) {
        this.logger.warn(
          `tenant ${tenant.codigo} doc ${doc.id}: consultarEstadoCpe falló: ${(err as Error).message}`,
        );
      }
    }
  }
}
