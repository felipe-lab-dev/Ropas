import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';
import { esPermisoValido } from '../../saas/catalogo-permisos';
import { ActualizarRolDto, CrearRolDto } from './dto/rol.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async listar(ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const roles = await cliente.rol.findMany({
      where: { eliminadoEn: null },
      orderBy: [{ esSistema: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { usuarios: { where: { eliminadoEn: null } } } } },
    });
    return roles.map(r => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: r.permisos,
      esSistema: r.esSistema,
      usuariosCount: r._count.usuarios,
      // El rol Administrador con wildcard `*` tiene acceso total.
      esTotal: r.permisos.includes('*'),
    }));
  }

  async obtener(id: string, ctx: TenantContext) {
    const rol = await this.prisma.forTenant(ctx).rol.findFirst({
      where: { id, eliminadoEn: null },
    });
    if (!rol) throw new ErrorNoEncontrado('Rol no encontrado');
    return rol;
  }

  async crear(dto: CrearRolDto, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const permisos = this.validarPermisos(dto.permisos);

    const dup = await cliente.rol.findFirst({
      where: { nombre: dto.nombre, eliminadoEn: null },
      select: { id: true },
    });
    if (dup) throw new ErrorConflicto(`Ya existe un rol llamado "${dto.nombre}"`);

    return cliente.rol.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        permisos,
        esSistema: false,
      },
    });
  }

  async actualizar(id: string, dto: ActualizarRolDto, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const actual = await this.obtener(id, ctx);

    if (actual.esSistema) {
      throw new ErrorValidacion(
        'El rol Administrador es del sistema y no se puede editar. Creá un rol nuevo si necesitás otros permisos.',
      );
    }

    if (dto.nombre && dto.nombre !== actual.nombre) {
      const dup = await cliente.rol.findFirst({
        where: { nombre: dto.nombre, eliminadoEn: null, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw new ErrorConflicto(`Ya existe un rol llamado "${dto.nombre}"`);
    }

    const data: Prisma.RolUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.permisos !== undefined) data.permisos = this.validarPermisos(dto.permisos);

    return cliente.rol.update({ where: { id }, data });
  }

  async eliminar(id: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const rol = await this.obtener(id, ctx);

    if (rol.esSistema) {
      throw new ErrorValidacion('No se puede eliminar un rol del sistema.');
    }

    const usuarios = await cliente.usuario.count({
      where: { rolId: id, eliminadoEn: null },
    });
    if (usuarios > 0) {
      throw new ErrorValidacion(
        `No se puede eliminar: ${usuarios} usuario(s) tienen este rol. Reasignalos primero.`,
      );
    }

    await cliente.rol.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
  }

  /** Valida que todos los permisos existan en el catálogo y deduplica. Rechaza el wildcard `*`. */
  private validarPermisos(permisos: string[]): string[] {
    const unicos = Array.from(new Set(permisos.map(p => p.trim()).filter(Boolean)));
    const invalidos = unicos.filter(p => !esPermisoValido(p));
    if (invalidos.length > 0) {
      throw new ErrorValidacion(
        `Permisos inválidos: ${invalidos.join(', ')}. ` +
          (invalidos.includes('*')
            ? 'El acceso total (*) está reservado al rol Administrador del sistema.'
            : ''),
      );
    }
    return unicos;
  }
}
