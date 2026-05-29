/**
 * PollEstadosCpeCron — barrido periódico de documentos electrónicos para todos
 * los tenants activos.
 *
 * Procesa DOS familias de documentos por ciclo:
 *
 *   A) `en_proceso` (SUNAT 101): refresca estado con `consultarEstadoCpe`.
 *      Se barren docs no actualizados en los últimos 5 min (anti-hammering).
 *
 *   B) `pendiente` (envío inicial nunca llegó a SUNAT): reintenta envío con
 *      `reintentarCpe` aplicando backoff exponencial por número de intentos
 *      ya realizados (BACKOFF_REINTENTO_MS). Después de MAX_INTENTOS_PENDIENTE
 *      se deja el doc para revisión humana — no se reintenta más
 *      automáticamente.
 *
 * Errores por tenant y por documento se capturan localmente — nunca
 * interrumpen el resto del barrido.
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

/** Tiempo mínimo (ms) entre consultas al mismo documento `en_proceso`. */
const MIN_INTERVALO_DOC_MS = 5 * 60_000;

/** Estados de tenant que se incluyen en el barrido. */
const ESTADOS_TENANT_ACTIVOS = ['activo', 'trial'];

/**
 * Backoff entre reintentos automáticos de docs `pendiente`, indexado por
 * `numIntentos` previo. Ejemplo: tras el 1er intento (numIntentos=1),
 * el cron reintenta cuando hayan pasado al menos 1 min desde el último envío.
 *
 *   1m → 5m → 15m → 1h → 6h
 */
const BACKOFF_REINTENTO_MS = [
  60_000,            // luego del 1er intento
  5 * 60_000,        // luego del 2do
  15 * 60_000,       // luego del 3ro
  60 * 60_000,       // luego del 4to
  6 * 60 * 60_000,   // luego del 5to
];

/**
 * Cap de intentos totales (inicial + reintentos del cron). Después de este
 * número, el cron deja el doc en paz y debe revisarse manualmente — evita
 * spam contra Mifact cuando algo está estructuralmente roto (token, datos,
 * config del emisor mal en SUNAT).
 */
const MAX_INTENTOS_PENDIENTE = BACKOFF_REINTENTO_MS.length + 1; // 6 total

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

    const docSvc = this.crearDocSvc();

    await this.procesarEnProceso(ctx, tenant.codigo, docSvc);
    await this.procesarPendientes(ctx, tenant.codigo, docSvc);
  }

  /**
   * Family A: docs `en_proceso` → consultar estado y avanzar a aceptado/rechazado.
   */
  private async procesarEnProceso(
    ctx: TenantContext,
    tenantCodigo: string,
    docSvc: DocumentoElectronicoService,
  ): Promise<void> {
    const prismaTenant = this.prismaTenancy.forTenant(ctx);

    const docs = await prismaTenant.documentoElectronico.findMany({
      where: {
        estadoSunat: 'en_proceso',
        actualizadoEn: { lt: new Date(Date.now() - MIN_INTERVALO_DOC_MS) },
      },
      take: MAX_DOCS_POR_TENANT,
      select: { ventaId: true, notaCreditoId: true, id: true },
    });

    if (docs.length === 0) return;

    this.logger.log(
      `tenant ${tenantCodigo}: ${docs.length} doc(s) en_proceso a revisar`,
    );

    for (const doc of docs) {
      try {
        if (doc.ventaId) {
          await docSvc.consultarEstadoCpe(ctx, doc.ventaId);
        } else if (doc.notaCreditoId) {
          await docSvc.consultarEstadoCpeNotaCredito(ctx, doc.notaCreditoId);
        }
      } catch (err) {
        this.logger.warn(
          `tenant ${tenantCodigo} doc ${doc.id}: consultarEstado falló: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Family B: docs `pendiente` → reintentar envío con backoff exponencial.
   *
   * Selecciona docs donde:
   *   - estado_sunat = 'pendiente'
   *   - 0 < num_intentos < MAX_INTENTOS_PENDIENTE (cap automático)
   *
   * En memoria filtra los que aún no cumplen el backoff (ahora - enviadoEn ≥
   * BACKOFF[numIntentos-1]) y reintenta el envío. El reintento es idempotente
   * a nivel serie+correlativo (DocumentoElectronicoService reusa los del doc).
   */
  private async procesarPendientes(
    ctx: TenantContext,
    tenantCodigo: string,
    docSvc: DocumentoElectronicoService,
  ): Promise<void> {
    const prismaTenant = this.prismaTenancy.forTenant(ctx);

    const candidatos = await prismaTenant.documentoElectronico.findMany({
      where: {
        estadoSunat: 'pendiente',
        numIntentos: { gt: 0, lt: MAX_INTENTOS_PENDIENTE },
      },
      take: MAX_DOCS_POR_TENANT,
      select: {
        id: true,
        ventaId: true,
        notaCreditoId: true,
        numIntentos: true,
        enviadoEn: true,
        creadoEn: true,
      },
    });

    if (candidatos.length === 0) return;

    const ahora = Date.now();
    // El último intervalo del array es el de mayor delay; lo usamos como fallback
    // si numIntentos por alguna razón excediera el array (defensa, no debería pasar
    // por el filtro `lt: MAX_INTENTOS_PENDIENTE`).
    const backoffMaximo = BACKOFF_REINTENTO_MS[BACKOFF_REINTENTO_MS.length - 1]!;
    const listos = candidatos.filter(doc => {
      const ultimoIntento = (doc.enviadoEn ?? doc.creadoEn).getTime();
      const backoffMs = BACKOFF_REINTENTO_MS[doc.numIntentos - 1] ?? backoffMaximo;
      return ahora - ultimoIntento >= backoffMs;
    });

    if (listos.length === 0) return;

    this.logger.log(
      `tenant ${tenantCodigo}: ${listos.length} doc(s) pendiente a reintentar ` +
        `(${candidatos.length - listos.length} aún esperan backoff)`,
    );

    for (const doc of listos) {
      try {
        if (doc.ventaId) {
          await docSvc.reintentarCpe(ctx, doc.ventaId);
        } else if (doc.notaCreditoId) {
          await docSvc.reintentarCpeNotaCredito(ctx, doc.notaCreditoId);
        }
        this.logger.log(
          `tenant ${tenantCodigo} doc ${doc.id}: reintento OK (intento ${doc.numIntentos + 1})`,
        );
      } catch (err) {
        this.logger.warn(
          `tenant ${tenantCodigo} doc ${doc.id}: reintento ${doc.numIntentos + 1} falló: ${(err as Error).message}`,
        );
      }
    }
  }
}
