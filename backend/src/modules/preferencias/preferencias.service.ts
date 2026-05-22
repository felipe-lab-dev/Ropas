import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorNoEncontrado, ErrorValidacion } from '../../core/errors/errores';

/**
 * Preferencias de UI por usuario: orden de columnas, anchos, filtros, sort, etc.
 * Persistido como JSON en `usuarios.preferencias_ui`. Estructura por módulo:
 *   { productos: { sort: {...}, orden: [...], anchos: {...}, filtros: {...} }, ... }
 */
@Injectable()
export class PreferenciasService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async obtener(ctx: TenantContext, usuarioId: string): Promise<Record<string, unknown>> {
    const u = await this.prisma.forTenant(ctx).usuario.findFirst({
      where: { id: usuarioId, eliminadoEn: null },
      select: { preferenciasUi: true },
    });
    if (!u) throw new ErrorNoEncontrado('Usuario no encontrado');
    return (u.preferenciasUi as Record<string, unknown>) ?? {};
  }

  /**
   * Reemplaza el estado completo de un módulo: `preferencias_ui[modulo] = estado`.
   * Devuelve el JSON completo actualizado.
   */
  async guardarModulo(
    ctx: TenantContext,
    usuarioId: string,
    modulo: string,
    estado: unknown,
  ): Promise<Record<string, unknown>> {
    if (!modulo || !/^[a-z0-9_-]{1,40}$/.test(modulo)) {
      throw new ErrorValidacion('Módulo inválido');
    }
    const cliente = this.prisma.forTenant(ctx);
    const u = await cliente.usuario.findFirst({
      where: { id: usuarioId, eliminadoEn: null },
      select: { preferenciasUi: true },
    });
    if (!u) throw new ErrorNoEncontrado('Usuario no encontrado');
    const actuales = ((u.preferenciasUi as Record<string, unknown>) ?? {});
    const siguiente = { ...actuales, [modulo]: estado };
    await cliente.usuario.update({
      where: { id: usuarioId },
      data: { preferenciasUi: siguiente as Prisma.InputJsonValue },
    });
    return siguiente;
  }
}
