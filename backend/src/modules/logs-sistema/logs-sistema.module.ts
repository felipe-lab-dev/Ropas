import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LogsSistemaController } from './logs-sistema.controller';
import { LogsSistemaService } from './logs-sistema.service';
import { AuthModule } from '../auth/auth.module';
import { AppExceptionFilter } from '../../core/errors/app-exception.filter';

@Module({
  imports: [AuthModule],
  controllers: [LogsSistemaController],
  providers: [
    LogsSistemaService,
    // Registrar el filter global aca para que pueda inyectar LogsSistemaService.
    // Reemplaza el `app.useGlobalFilters(new AppExceptionFilter())` que estaba
    // en main.ts y que impedia la inyeccion de dependencias.
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
  exports: [LogsSistemaService],
})
export class LogsSistemaModule {}
