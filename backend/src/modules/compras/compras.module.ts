import { Module } from '@nestjs/common';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';
import { AuthModule } from '../auth/auth.module';
import { InventarioModule } from '../inventario/inventario.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [AuthModule, InventarioModule, ContabilidadModule],
  controllers: [ComprasController],
  providers: [ComprasService],
})
export class ComprasModule {}
