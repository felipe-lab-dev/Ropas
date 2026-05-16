import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  ErrorNoAutorizado,
  ErrorProhibido,
} from '../../core/errors/errores';
import { PayloadJwt } from './auth.service';

const PERMISO_KEY = 'auth.permiso';
export const RequierePermiso = (permiso: string) => SetMetadata(PERMISO_KEY, permiso);

const PUBLICO_KEY = 'auth.publico';
export const Publico = () => SetMetadata(PUBLICO_KEY, true);

declare module 'express' {
  interface Request {
    usuario?: PayloadJwt;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const esPublico =
      this.reflector.get<boolean>(PUBLICO_KEY, ctx.getHandler()) ??
      this.reflector.get<boolean>(PUBLICO_KEY, ctx.getClass());
    if (esPublico) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new ErrorNoAutorizado('Token de acceso requerido');
    }

    let payload: PayloadJwt;
    try {
      payload = await this.jwt.verifyAsync<PayloadJwt>(auth.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new ErrorNoAutorizado('Token inválido o expirado');
    }

    if (req.tenant && payload.tenant !== req.tenant.codigo) {
      throw new ErrorNoAutorizado('Token no corresponde al tenant solicitado');
    }
    req.usuario = payload;

    const permiso =
      this.reflector.get<string>(PERMISO_KEY, ctx.getHandler()) ??
      this.reflector.get<string>(PERMISO_KEY, ctx.getClass());
    if (permiso && !payload.permisos.includes(permiso) && !payload.permisos.includes('*')) {
      throw new ErrorProhibido(`Falta permiso: ${permiso}`);
    }
    return true;
  }
}
