import { Module } from '@nestjs/common';
import { CuponesController } from './cupones.controller';
import { CuponesService } from './cupones.service';
import { MotorCuponesService } from './motor-cupones.service';
import { CuponRenderService } from './cupon-render.service';
import { AuthModule } from '../auth/auth.module';
import { AzureBlobService } from '../../core/storage/azure-blob.service';

@Module({
  imports: [AuthModule],
  controllers: [CuponesController],
  providers: [CuponesService, MotorCuponesService, CuponRenderService, AzureBlobService],
  exports: [CuponesService, MotorCuponesService],
})
export class CuponesModule {}
