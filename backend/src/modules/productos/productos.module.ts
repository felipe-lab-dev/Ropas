import { Module } from '@nestjs/common';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { MotorLogisticoService } from './motor-logistico.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProductosController],
  providers: [ProductosService, MotorLogisticoService],
})
export class ProductosModule {}
