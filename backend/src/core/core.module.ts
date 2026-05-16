import { Global, Module } from '@nestjs/common';
import { PrismaPublicService } from './prisma/prisma-public.service';
import { PrismaTenantService } from './prisma/prisma-tenant.service';

@Global()
@Module({
  providers: [PrismaPublicService, PrismaTenantService],
  exports: [PrismaPublicService, PrismaTenantService],
})
export class CoreModule {}
