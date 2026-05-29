import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';
import {
  obtenerPaginacion,
  PaginacionDto,
  construirBusquedaWordSplit,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './dto/usuario.dto';

interface ListarQuery extends PaginacionDto {
  activo?: string;
  rolId?: string;
}

const INCLUDE_ROL = {
  rol: { select: { id: true, nombre: true } },
} satisfies Prisma.UsuarioInclude;

/** Usuario sin el hash de contraseña (nunca se expone al frontend). */
type UsuarioSeguro = Omit<Prisma.UsuarioGetPayload<{ include: typeof INCLUDE_ROL }>, 'passwordHash'>;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaTenantService) {}

  private sinPassword<T extends { passwordHash: string }>(u: T): Omit<T, 'passwordHash'> {
    const { passwordHash: _omit, ...resto } = u;
    void _omit;
    return resto;
  }

  async listar(query: ListarQuery, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const cliente = this.prisma.forTenant(ctx);

    const where: Prisma.UsuarioWhereInput = { eliminadoEn: null };
    if (query.activo === 'true') where.activo = true;
    if (query.activo === 'false') where.activo = false;
    if (query.rolId) where.rolId = query.rolId;

    const busqueda = construirBusquedaWordSplit(query.buscar, ['nombre', 'email', 'dni']);
    if (busqueda) Object.assign(where, busqueda);

    const [datos, total] = await Promise.all([
      cliente.usuario.findMany({
        where,
        skip,
        take,
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
        include: INCLUDE_ROL,
      }),
      cliente.usuario.count({ where }),
    ]);
    return crearResultadoPaginado(
      datos.map(u => this.sinPassword(u)),
      total,
      { pagina, limite },
    );
  }

  async obtener(id: string, ctx: TenantContext): Promise<UsuarioSeguro> {
    const u = await this.prisma.forTenant(ctx).usuario.findFirst({
      where: { id, eliminadoEn: null },
      include: INCLUDE_ROL,
    });
    if (!u) throw new ErrorNoEncontrado('Usuario no encontrado');
    return this.sinPassword(u);
  }

  async crear(dto: CrearUsuarioDto, ctx: TenantContext): Promise<UsuarioSeguro> {
    const cliente = this.prisma.forTenant(ctx);

    const rol = await cliente.rol.findFirst({ where: { id: dto.rolId, eliminadoEn: null } });
    if (!rol) throw new ErrorValidacion('El rol indicado no existe');

    await this.validarUnicos(cliente, { email: dto.email, dni: dto.dni ?? null });

    const passwordPlano = dto.password ?? dto.dni;
    if (!passwordPlano) {
      throw new ErrorValidacion(
        'Definí una contraseña, o un DNI que se usará como contraseña inicial.',
      );
    }
    const passwordHash = await bcrypt.hash(passwordPlano, 10);

    try {
      const u = await cliente.usuario.create({
        data: {
          nombre: dto.nombre,
          email: dto.email,
          dni: dto.dni ?? null,
          passwordHash,
          rolId: dto.rolId,
          sucursalDefecto: dto.sucursalDefecto ?? null,
          activo: dto.activo ?? true,
        },
        include: INCLUDE_ROL,
      });
      return this.sinPassword(u);
    } catch (e) {
      throw this.mapearConflicto(e);
    }
  }

  async actualizar(
    id: string,
    dto: ActualizarUsuarioDto,
    ctx: TenantContext,
    actorId: string,
  ): Promise<UsuarioSeguro> {
    const cliente = this.prisma.forTenant(ctx);
    const actual = await cliente.usuario.findFirst({ where: { id, eliminadoEn: null } });
    if (!actual) throw new ErrorNoEncontrado('Usuario no encontrado');

    if (dto.activo === false && id === actorId) {
      throw new ErrorValidacion('No podés desactivar tu propio usuario.');
    }

    if (dto.rolId && dto.rolId !== actual.rolId) {
      const rol = await cliente.rol.findFirst({ where: { id: dto.rolId, eliminadoEn: null } });
      if (!rol) throw new ErrorValidacion('El rol indicado no existe');
    }

    await this.validarUnicos(
      cliente,
      {
        email: dto.email && dto.email !== actual.email ? dto.email : undefined,
        dni: dto.dni !== undefined && dto.dni !== actual.dni ? dto.dni : undefined,
      },
      id,
    );

    const data: Prisma.UsuarioUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.dni !== undefined) data.dni = dto.dni;
    if (dto.sucursalDefecto !== undefined) data.sucursalDefecto = dto.sucursalDefecto;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.rolId !== undefined) data.rol = { connect: { id: dto.rolId } };
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const u = await cliente.usuario.update({ where: { id }, data, include: INCLUDE_ROL });
      return this.sinPassword(u);
    } catch (e) {
      throw this.mapearConflicto(e);
    }
  }

  /**
   * Resetea la contraseña. Si no se pasa una, usa el DNI; si tampoco hay DNI,
   * genera una temporal y la devuelve para que el admin la comparta.
   */
  async resetearPassword(
    id: string,
    ctx: TenantContext,
    nueva?: string,
  ): Promise<{ passwordTemporal?: string }> {
    const cliente = this.prisma.forTenant(ctx);
    const u = await cliente.usuario.findFirst({ where: { id, eliminadoEn: null } });
    if (!u) throw new ErrorNoEncontrado('Usuario no encontrado');

    const generada = !nueva && !u.dni;
    const passwordPlano = nueva ?? u.dni ?? this.passwordAleatoria();
    await cliente.usuario.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(passwordPlano, 10) },
    });
    return generada ? { passwordTemporal: passwordPlano } : {};
  }

  async eliminar(id: string, ctx: TenantContext, actorId: string): Promise<void> {
    if (id === actorId) {
      throw new ErrorValidacion('No podés eliminar tu propio usuario.');
    }
    const cliente = this.prisma.forTenant(ctx);
    const u = await cliente.usuario.findFirst({ where: { id, eliminadoEn: null } });
    if (!u) throw new ErrorNoEncontrado('Usuario no encontrado');

    await cliente.usuario.update({
      where: { id },
      data: { eliminadoEn: new Date(), activo: false },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async validarUnicos(
    cliente: ReturnType<PrismaTenantService['forTenant']>,
    campos: { email?: string; dni?: string | null },
    excluirId?: string,
  ) {
    if (campos.email) {
      const dup = await cliente.usuario.findFirst({
        where: {
          email: campos.email,
          eliminadoEn: null,
          ...(excluirId ? { id: { not: excluirId } } : {}),
        },
        select: { id: true },
      });
      if (dup) throw new ErrorConflicto(`Ya existe un usuario con el email ${campos.email}`);
    }
    if (campos.dni) {
      const dup = await cliente.usuario.findFirst({
        where: {
          dni: campos.dni,
          eliminadoEn: null,
          ...(excluirId ? { id: { not: excluirId } } : {}),
        },
        select: { id: true },
      });
      if (dup) throw new ErrorConflicto(`Ya existe un usuario con el DNI ${campos.dni}`);
    }
  }

  /** Mapea P2002 (unique) a un conflicto amable (cubre colisión con registros eliminados). */
  private mapearConflicto(e: unknown): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const campo = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'dato único';
      return new ErrorConflicto(
        `Ya existe un usuario con ese ${campo.includes('email') ? 'email' : campo.includes('dni') ? 'DNI' : campo}.`,
      );
    }
    return e;
  }

  private passwordAleatoria(): string {
    return Math.random().toString(36).slice(2, 10) + 'A1';
  }
}
