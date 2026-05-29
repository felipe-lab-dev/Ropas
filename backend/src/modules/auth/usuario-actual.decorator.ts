import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ErrorNoAutorizado } from '../../core/errors/errores';
import { PayloadJwt } from './auth.service';

/**
 * Inyecta el usuario autenticado (PayloadJwt) resuelto por AuthGuard.
 * Útil para reglas como "no podés eliminar/desactivar tu propio usuario".
 */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PayloadJwt => {
    const req = ctx.switchToHttp().getRequest<{ usuario?: PayloadJwt }>();
    if (!req.usuario) {
      throw new ErrorNoAutorizado('Usuario no autenticado');
    }
    return req.usuario;
  },
);
