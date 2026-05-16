import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { LRUCache } from 'lru-cache';
import { TenantContext } from '../tenancy/tenant-context';

/**
 * Devuelve un PrismaClient apuntando al schema del tenant resuelto.
 * Cachea instancias por código de tenant (LRU 50 simultáneas) para no abrir
 * miles de conexiones — cada cliente reutiliza pool subyacente.
 */
@Injectable()
export class PrismaTenantService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaTenantService.name);
  private readonly clientes: LRUCache<string, PrismaClient>;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL');
    if (!url) throw new Error('DATABASE_URL no configurado');
    this.baseUrl = url;

    this.clientes = new LRUCache<string, PrismaClient>({
      max: 50,
      dispose: cliente => {
        cliente.$disconnect().catch(err =>
          this.logger.error({ err }, 'Error desconectando cliente Prisma'),
        );
      },
    });
  }

  forTenant(ctx: TenantContext): PrismaClient {
    const cacheado = this.clientes.get(ctx.codigo);
    if (cacheado) return cacheado;

    const url = this.urlConSchema(ctx.schemaName);
    this.logger.log(`Creando cliente Prisma para tenant=${ctx.codigo} schema=${ctx.schemaName} url=${url.replace(/:[^:@]+@/, ':***@')}`);
    const cliente = new PrismaClient({
      log: ['query', 'warn', 'error'],
      datasources: { db: { url } },
    });
    this.clientes.set(ctx.codigo, cliente);
    return cliente;
  }

  private urlConSchema(schema: string): string {
    const u = new URL(this.baseUrl);
    u.searchParams.set('schema', schema);
    return u.toString();
  }

  async onModuleDestroy(): Promise<void> {
    for (const cliente of this.clientes.values()) {
      await cliente.$disconnect();
    }
    this.clientes.clear();
  }
}
