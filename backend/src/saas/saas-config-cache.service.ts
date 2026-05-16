import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnkiClient, ConfigEnki } from './enki.client';

const CACHE_TTL_MS = 5 * 60 * 1000;

const MODULOS_OFFLINE = [
  'productos',
  'inventario',
  'ventas',
  'caja',
  'clientes',
  'proveedores',
  'compras',
  'reportes',
  'usuarios',
  'configuracion',
];

@Injectable()
export class SaasConfigCacheService {
  private readonly logger = new Logger(SaasConfigCacheService.name);
  private cache: ConfigEnki | null = null;
  private cachedAt = 0;

  constructor(
    private readonly enki: EnkiClient,
    private readonly config: ConfigService,
  ) {}

  private get offline(): boolean {
    return this.config.get<string>('ENKI_OFFLINE') === 'true';
  }

  setInicial(c: ConfigEnki): void {
    this.cache = c;
    this.cachedAt = Date.now();
  }

  async obtener(force = false): Promise<ConfigEnki> {
    const expirado = Date.now() - this.cachedAt > CACHE_TTL_MS;
    if (this.cache && !force && !expirado) return this.cache;

    if (this.offline) {
      const codigo = this.config.get<string>('ENKI_TENANT_CODE') ?? 'local-dev';
      this.cache = {
        tenant: {
          id: 'offline-' + codigo,
          codigo,
          nombre: 'Tenant Local (offline)',
          schemaName: this.schemaDe(codigo),
          estado: 'activo',
        },
        plan: { id: 'offline-plan', nombre: 'Offline Full', limites: {} },
        modulosHabilitados: MODULOS_OFFLINE,
        accesoPermitido: true,
      };
      this.cachedAt = Date.now();
      return this.cache;
    }

    try {
      const fresh = await this.enki.obtenerConfig();
      if (!fresh.tenant.schemaName) {
        fresh.tenant.schemaName = this.schemaDe(fresh.tenant.codigo);
      }
      this.cache = fresh;
      this.cachedAt = Date.now();
      return fresh;
    } catch (err) {
      this.logger.error({ err }, 'Error obteniendo config ENKI; sirviendo cache previa si existe');
      if (this.cache) return this.cache;
      throw err;
    }
  }

  private schemaDe(codigo: string): string {
    return 'tenant_' + codigo.replace(/-/g, '_');
  }
}
