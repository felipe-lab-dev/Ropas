import { Module } from '@nestjs/common';
import { CuponesController } from './cupones.controller';
import { CuponesService } from './cupones.service';
import { MotorCuponesService } from './motor-cupones.service';
import { CuponRenderService } from './cupon-render.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CuponesController],
  providers: [CuponesService, MotorCuponesService, CuponRenderService],
  exports: [CuponesService, MotorCuponesService],
})
export class CuponesModule {}
