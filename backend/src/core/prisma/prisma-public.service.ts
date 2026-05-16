import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma apuntando al schema `public`.
 * Solo para metadata global: tenants, jobs, audit cross-schema.
 * NO usar desde módulos de negocio — usar PrismaTenantService.
 */
@Injectable()
export class PrismaPublicService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaPublicService.name);

  constructor() {
    super({ log: ['warn', 'error'] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PrismaPublicService conectado');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
