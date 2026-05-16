import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ErrorNoAutorizado } from '../errors/errores';
import { TenantContext } from './tenant-context';

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<{ tenant?: TenantContext }>();
    if (!req.tenant) {
      throw new ErrorNoAutorizado('Tenant no resuelto en el request');
    }
    return req.tenant;
  },
);
