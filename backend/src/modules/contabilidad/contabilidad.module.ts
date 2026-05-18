import { Module } from '@nestjs/common';
import { ContabilidadController } from './contabilidad.controller';
import { ContabilidadService } from './contabilidad.service';
import { AsientosService } from './asientos.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ContabilidadController],
  providers: [ContabilidadService, AsientosService],
  exports: [AsientosService],
})
export class ContabilidadModule {}
