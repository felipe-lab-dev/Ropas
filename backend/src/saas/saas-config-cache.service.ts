import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnkiClient, ConfigEnki } from './enki.client';
import { PrismaPublicService } from '../core/prisma/prisma-public.service';
import { ErrorNoEncontrado } from '../core/errors/errores';

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

interface EntradaCache {
  config: ConfigEnki;
  cachedAt: number;
}

@Injectable()
export class SaasConfigCacheService {
  private readonly logger = new Logger(SaasConfigCacheService.name);
  // Cache multi-tenant: una entrada por codigo. Permite que la misma instancia del backend
  // sirva loremstore, mi-tienda, etc. resolviendo el tenant desde public.tenants por request.
  private readonly cachePorCodigo = new Map<string, EntradaCache>();

  constructor(
    private readonly enki: EnkiClient,
    private readonly config: ConfigService,
    private readonly prisma: PrismaPublicService,
  ) {}

  private get offline(): boolean {
    return this.config.get<string>('ENKI_OFFLINE') === 'true';
  }

  setInicial(c: ConfigEnki): void {
    this.cachePorCodigo.set(c.tenant.codigo, { config: c, cachedAt: Date.now() });
  }

  async obtener(codigo?: string, force = false): Promise<ConfigEnki> {
    const codigoFinal =
      codigo ?? this.config.get<string>('ENKI_TENANT_CODE') ?? 'local-dev';

    const entrada = this.cachePorCodigo.get(codigoFinal);
    const expirado = entrada ? Date.now() - entrada.cachedAt > CACHE_TTL_MS : true;
    if (entrada && !force && !expirado) return entrada.config;

    if (this.offline) {
      const config = await this.cargarOffline(codigoFinal);
      this.cachePorCodigo.set(codigoFinal, { config, cachedAt: Date.now() });
      return config;
    }

    try {
      const fresh = await this.enki.obtenerConfig();
      if (!fresh.tenant.schemaName) fresh.tenant.schemaName = this.schemaDe(fresh.tenant.codigo);
      this.cachePorCodigo.set(fresh.tenant.codigo, { config: fresh, cachedAt: Date.now() });
      return fresh;
    } catch (err) {
      this.logger.error({ err }, 'Error obteniendo config ENKI; sirviendo cache previa si existe');
      if (entrada) return entrada.config;
      throw err;
    }
  }

  private async cargarOffline(codigo: string): Promise<ConfigEnki> {
    // Modo offline: leemos public.tenants (sembrado por el script tenant:crear) en vez del
    // portal ENKI. Cualquier subdominio *.tienda.enkihubs.com termina aca.
    const tenant = await this.prisma.tenant.findFirst({
      where: { codigo, eliminadoEn: null },
    });
    if (!tenant) throw new ErrorNoEncontrado(`Tenant "${codigo}" no existe`);

    const modulos = Array.isArray(tenant.modulosHabilitados)
      ? (tenant.modulosHabilitados as string[])
      : MODULOS_OFFLINE;

    return {
      tenant: {
        id: tenant.id,
        codigo: tenant.codigo,
        nombre: tenant.nombre,
        schemaName: tenant.schemaName,
        estado: tenant.estado === 'activo' ? 'activo' : tenant.estado,
      },
      plan: {
        id: 'offline-plan',
        nombre: tenant.planNombre ?? 'Offline Full',
        limites: (tenant.limites as Record<string, number>) ?? {},
      },
      modulosHabilitados: modulos.length > 0 ? modulos : MODULOS_OFFLINE,
      accesoPermitido: tenant.estado === 'activo' || tenant.estado === 'trial',
    };
  }

  private schemaDe(codigo: string): string {
    return 'tenant_' + codigo.replace(/-/g, '_');
  }
}
