import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

const ConfigEnkiSchema = z.object({
  tenant: z.object({
    id: z.string(),
    codigo: z.string(),
    nombre: z.string(),
    schemaName: z.string().optional(),
    estado: z.enum(['trial', 'activo', 'suspendido', 'cancelado']),
  }),
  plan: z.object({
    id: z.string(),
    nombre: z.string(),
    limites: z.record(z.number()).default({}),
  }),
  modulosHabilitados: z.array(z.string()),
  accesoPermitido: z.boolean(),
  fechaFinTrial: z.string().nullable().optional(),
  webhookUrl: z.string().url().nullable().optional(),
  sistemaId: z.string().optional(),
});

export type ConfigEnki = z.infer<typeof ConfigEnkiSchema>;

@Injectable()
export class EnkiClient {
  private readonly logger = new Logger(EnkiClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.getOrThrow<string>('ENKI_BASE_URL');
  }
  private get apiKey(): string {
    return this.config.getOrThrow<string>('ENKI_API_KEY');
  }
  private get tenantCode(): string {
    return this.config.getOrThrow<string>('ENKI_TENANT_CODE');
  }
  private get sistemaId(): string {
    return this.config.getOrThrow<string>('ENKI_SISTEMA_ID');
  }

  async obtenerConfig(): Promise<ConfigEnki> {
    const url = `${this.baseUrl}/api/v1/saas/tenants/${this.tenantCode}/config`;
    const { data } = await firstValueFrom(
      this.http.get(url, {
        headers: { 'X-Enki-Api-Key': this.apiKey },
      }),
    );
    const parsed = ConfigEnkiSchema.parse(data?.datos ?? data);
    this.logger.log(
      { tenant: parsed.tenant.codigo, plan: parsed.plan.nombre },
      'Config ENKI recibida',
    );
    return parsed;
  }

  async heartbeat(metricas: Record<string, unknown>): Promise<void> {
    const url = `${this.baseUrl}/api/v1/saas/tenants/${this.tenantCode}/sistemas/${this.sistemaId}/heartbeat`;
    await firstValueFrom(
      this.http.post(
        url,
        { version: process.env.npm_package_version ?? '0.0.1', timestamp: new Date().toISOString(), metricas },
        { headers: { 'X-Enki-Api-Key': this.apiKey } },
      ),
    );
  }
}
