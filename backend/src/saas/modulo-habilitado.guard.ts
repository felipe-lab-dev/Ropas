import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ErrorProhibido } from '../core/errors/errores';
import { SaasConfigCacheService } from './saas-config-cache.service';
import { ModuloId } from './catalogo-modulos';

const MODULO_KEY = 'saas.modulo';

export const ModuloHabilitado = (modulo: ModuloId): MethodDecorator & ClassDecorator =>
  SetMetadata(MODULO_KEY, modulo);

@Injectable()
export class ModuloHabilitadoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: SaasConfigCacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const modulo =
      this.reflector.get<ModuloId>(MODULO_KEY, ctx.getHandler()) ??
      this.reflector.get<ModuloId>(MODULO_KEY, ctx.getClass());
    if (!modulo) return true;

    // FIX: usar el código del tenant resuelto por el middleware, no el default
    // global. Sin esto cualquier request a un controller con @ModuloHabilitado
    // devuelve 404 con "Tenant mi-tienda no existe" si ese tenant default no
    // existe — rompiendo el shell entero del frontend.
    const req = ctx.switchToHttp().getRequest<Request>();
    const codigoTenant = req.tenant?.codigo;
    const config = await this.cache.obtener(codigoTenant);
    if (!config.modulosHabilitados.includes(modulo)) {
      throw new ErrorProhibido(`Módulo "${modulo}" no incluido en tu plan`);
    }
    return true;
  }
}
