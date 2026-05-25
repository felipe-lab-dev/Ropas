import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { MotorClasificacionClientesService } from './motor-clasificacion.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ClientesController],
  providers: [ClientesService, MotorClasificacionClientesService],
})
export class ClientesModule {}
