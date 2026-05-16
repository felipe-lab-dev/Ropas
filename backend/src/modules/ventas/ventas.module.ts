import { Module } from '@nestjs/common';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';
import { AuthModule } from '../auth/auth.module';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [AuthModule, InventarioModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
