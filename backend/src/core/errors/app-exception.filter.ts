import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErrorAplicacion } from './errores';
import { LogsSistemaService } from '../../modules/logs-sistema/logs-sistema.service';

// Persistencia en `errores_sistema`:
//   severidad 'error'  → 5xx, errores no controlados (defectos del sistema)
//   severidad 'warn'   → 409 Conflict, 413 Payload, 422 Unprocessable
//   NO se persiste     → 400 Bad Request, 401, 403, 404, 429
//                        (4xx triviales: ruido de input del usuario, no defectos)
function debeLoguearse(status: number): boolean {
  if (status >= 500) return true;
  if (status === 409) return true;
  if (status === 413) return true;
  if (status === 422) return true;
  return false;
}

function severidadPara(status: number): 'error' | 'warn' {
  return status >= 500 ? 'error' : 'warn';
}

function extraerMetadata(req: Request | undefined) {
  if (!req) return {};
  const ip =
    req.ip ||
    req.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    undefined;
  const u = req.usuario;
  return {
    metodo: req.method,
    ruta: (req as Request & { originalUrl?: string }).originalUrl || req.url,
    usuarioId: u?.sub ?? null,
    usuarioNombre: u?.email ?? null,
    tenantCodigo: u?.tenant ?? req.tenant?.codigo ?? null,
    ip,
    userAgent: req.headers?.['user-agent']?.toString(),
    requestBody: req.body,
    requestQuery: req.query,
  };
}

@Injectable()
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  constructor(private readonly logs?: LogsSistemaService) {}

  private persistir(
    exception: unknown,
    status: number,
    req: Request | undefined,
    mensaje: string,
  ) {
    if (!this.logs) return;
    if (!debeLoguearse(status)) return;
    const meta = extraerMetadata(req);
    this.logs
      .registrar({
        mensaje,
        tipo:
          exception instanceof Error
            ? exception.constructor.name
            : typeof exception,
        stack: exception instanceof Error ? exception.stack : undefined,
        statusCode: status,
        severidad: severidadPara(status),
        ...meta,
      })
      .catch(() => {
        /* nunca propagar */
      });
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof ErrorAplicacion) {
      this.persistir(exception, exception.codigo, req, exception.message);
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
      this.persistir(exception, status, req, mensaje);
      res.status(status).json({ exito: false, mensaje });
      return;
    }

    this.logger.error(
      { err: exception },
      'Error no controlado en filtro global',
    );
    const mensajeFinal = exception instanceof Error ? exception.message : String(exception);
    this.persistir(exception, 500, req, mensajeFinal);

    res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor',
    });
  }
}
