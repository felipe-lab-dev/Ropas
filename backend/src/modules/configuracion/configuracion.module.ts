import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConfiguracionController],
})
export class ConfiguracionModule {}
