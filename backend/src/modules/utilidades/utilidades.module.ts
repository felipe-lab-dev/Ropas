import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UtilidadesController } from './utilidades.controller';
import { JsonPeService } from './jsonpe.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [HttpModule.register({ timeout: 8000 }), AuthModule],
  controllers: [UtilidadesController],
  providers: [JsonPeService],
  exports: [JsonPeService],
})
export class UtilidadesModule {}
