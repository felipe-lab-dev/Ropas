import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorNoAutorizado,
  ErrorValidacion,
} from '../../core/errors/errores';
import { LoginDto } from './dto/login.dto';

export interface PayloadJwt {
  sub: string;
  email: string;
  rol: string;
  permisos: string[];
  tenant: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaTenantService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, ctx: TenantContext) {
    if (!dto.email || !dto.password) {
      throw new ErrorValidacion('Email y contraseña son requeridos');
    }

    const usuario = await this.prisma.forTenant(ctx).usuario.findFirst({
      where: { email: dto.email.toLowerCase(), eliminadoEn: null, activo: true },
      include: { rol: true },
    });

    if (!usuario || !(await bcrypt.compare(dto.password, usuario.passwordHash))) {
      throw new ErrorNoAutorizado('Credenciales inválidas');
    }

    await this.prisma.forTenant(ctx).usuario.update({
      where: { id: usuario.id },
      data: { ultimoIngreso: new Date() },
    });

    const payload: PayloadJwt = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre,
      permisos: usuario.rol.permisos,
      tenant: ctx.codigo,
    };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(
      { sub: usuario.id, tenant: ctx.codigo, tipo: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    return {
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol.nombre,
        permisos: usuario.rol.permisos,
        sucursalDefecto: usuario.sucursalDefecto,
      },
    };
  }

  async refrescar(token: string, ctx: TenantContext) {
    let payload: { sub: string; tenant: string; tipo: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new ErrorNoAutorizado('Refresh token inválido');
    }

    if (payload.tipo !== 'refresh' || payload.tenant !== ctx.codigo) {
      throw new ErrorNoAutorizado('Refresh token no corresponde a este tenant');
    }

    const usuario = await this.prisma.forTenant(ctx).usuario.findFirst({
      where: { id: payload.sub, eliminadoEn: null, activo: true },
      include: { rol: true },
    });
    if (!usuario) throw new ErrorNoAutorizado('Usuario inactivo');

    const nuevoPayload: PayloadJwt = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre,
      permisos: usuario.rol.permisos,
      tenant: ctx.codigo,
    };
    return { accessToken: await this.jwt.signAsync(nuevoPayload) };
  }
}
