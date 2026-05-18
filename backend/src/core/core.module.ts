import { Global, Module } from '@nestjs/common';
import { PrismaPublicService } from './prisma/prisma-public.service';
import { PrismaTenantService } from './prisma/prisma-tenant.service';
import { AzureBlobService } from './storage/azure-blob.service';

@Global()
@Module({
  providers: [PrismaPublicService, PrismaTenantService, AzureBlobService],
  exports: [PrismaPublicService, PrismaTenantService, AzureBlobService],
})
export class CoreModule {}
