import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorProhibido } from '../core/errors/errores';
import { SaasConfigCacheService } from './saas-config-cache.service';

const MODULO_KEY = 'saas.modulo';

export const ModuloHabilitado = (modulo: string): MethodDecorator & ClassDecorator =>
  SetMetadata(MODULO_KEY, modulo);

@Injectable()
export class ModuloHabilitadoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: SaasConfigCacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const modulo =
      this.reflector.get<string>(MODULO_KEY, ctx.getHandler()) ??
      this.reflector.get<string>(MODULO_KEY, ctx.getClass());
    if (!modulo) return true;

    const config = await this.cache.obtener();
    if (!config.modulosHabilitados.includes(modulo)) {
      throw new ErrorProhibido(`Módulo "${modulo}" no incluido en tu plan`);
    }
    return true;
  }
}
