import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

const RESULTADO_PAGINADO = Symbol.for('respuesta.paginada');

export interface ResultadoPaginado<T> {
  [RESULTADO_PAGINADO]: true;
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export function crearResultadoPaginado<T>(
  datos: T[],
  total: number,
  opts: { pagina: number; limite: number },
): ResultadoPaginado<T> {
  return {
    [RESULTADO_PAGINADO]: true,
    datos,
    total,
    pagina: opts.pagina,
    limite: opts.limite,
    totalPaginas: Math.max(1, Math.ceil(total / opts.limite)),
  };
}

export function respuestaExito<T>(datos: T, mensaje?: string) {
  return { datos, mensaje };
}

@Injectable()
export class RespuestaInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map(valor => {
        if (valor && typeof valor === 'object' && RESULTADO_PAGINADO in valor) {
          const { [RESULTADO_PAGINADO]: _, ...rest } = valor as ResultadoPaginado<unknown>;
          return { exito: true, ...rest };
        }
        if (
          valor &&
          typeof valor === 'object' &&
          'datos' in (valor as Record<string, unknown>)
        ) {
          return { exito: true, ...(valor as Record<string, unknown>) };
        }
        return { exito: true, datos: valor };
      }),
    );
  }
}
