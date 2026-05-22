import { Module } from '@nestjs/common';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasService } from './preferencias.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PreferenciasController],
  providers: [PreferenciasService],
})
export class PreferenciasModule {}
