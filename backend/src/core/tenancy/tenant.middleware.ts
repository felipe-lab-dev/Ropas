import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ErrorNoAutorizado, ErrorPagoRequerido } from '../errors/errores';
import { SaasConfigCacheService } from '../../saas/saas-config-cache.service';
import { TenantContext } from './tenant-context';

declare module 'express' {
  interface Request {
    tenant?: TenantContext;
  }
}

const RUTAS_SIN_TENANT = ['/api/v1/health', '/api/v1/saas/mi-config'];

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly cache: SaasConfigCacheService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (RUTAS_SIN_TENANT.some(p => req.path.startsWith(p))) return next();

    const codigo: string | undefined =
      (req.headers['x-tenant-code'] as string | undefined) ??
      process.env.ENKI_TENANT_CODE;

    if (!codigo) throw new ErrorNoAutorizado('Header X-Tenant-Code requerido');
    const codigoFinal: string = codigo;

    const config = await this.cache.obtener();
    if (config.tenant.codigo !== codigoFinal) {
      throw new ErrorNoAutorizado('Tenant no coincide con la configuración del servicio');
    }
    if (!config.accesoPermitido) {
      throw new ErrorPagoRequerido('Suscripción suspendida o trial vencido');
    }

    req.tenant = {
      codigo: config.tenant.codigo,
      schemaName: config.tenant.schemaName ?? `tenant_${codigoFinal.replace(/-/g, '_')}`,
      nombre: config.tenant.nombre,
      plan: config.plan.nombre,
      modulosHabilitados: config.modulosHabilitados,
      limites: config.plan.limites,
      accesoPermitido: config.accesoPermitido,
    };
    next();
  }
}
