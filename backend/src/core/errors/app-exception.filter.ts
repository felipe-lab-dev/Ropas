import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';
import { ErrorAplicacion, ErrorValidacion } from './errores';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof ErrorAplicacion) {
      res.status(exception.codigo).json({
        exito: false,
        mensaje: exception.message,
        errores: exception.errores,
      });
      return;
    }

    if (exception instanceof ZodError) {
      const errores = exception.errors.map(e => ({
        campo: e.path.join('.'),
        mensaje: e.message,
      }));
      res.status(400).json({
        exito: false,
        mensaje: 'Error de validación',
        errores,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const mensaje =
        typeof body === 'string'
          ? body
          : (body as { message?: string }).message ?? exception.message;
      res.status(status).json({ exito: false, mensaje });
      return;
    }

    this.logger.error(
      { err: exception },
      'Error no controlado en filtro global',
    );
    res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor',
    });
  }
}
