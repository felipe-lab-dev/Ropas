import { Injectable } from '@nestjs/common';
import { Prisma, TenantEstado } from '@prisma/client';
import { PrismaPublicService } from '../../core/prisma/prisma-public.service';
import { ErrorNoEncontrado, ErrorValidacion } from '../../core/errors/errores';

/** Forma persistida en public.tenants.branding. */
export interface BrandingTienda {
  logoSvg: string | null;
  nombre: string | null;
  subtitulo: string | null;
}

/** Respuesta pública del branding (consumida por el login pre-auth y el shell). */
export interface BrandingPublico {
  codigo: string;
  nombre: string;
  subtitulo: string | null;
  logoSvg: string | null;
  tenantEncontrado: boolean;
}

export interface ActualizarBrandingDto {
  logoSvg?: string | null;
  nombre?: string | null;
  subtitulo?: string | null;
}

/**
 * Branding por tienda. Vive en public.tenants (DB compartida dev/prod), por eso
 * editar en localhost se refleja en producción (<tienda>.tienda.enkihubs.com) al
 * instante. Mismo patrón que el módulo `branding` de Centros Odontológicos Velarde.
 */
@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaPublicService) {}

  /** Branding público de una tienda por código — para el login (pre-auth). */
  async obtenerPublico(codigo: string): Promise<BrandingPublico> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { codigo, eliminadoEn: null },
    });
    if (!tenant) {
      return { codigo, nombre: codigo, subtitulo: null, logoSvg: null, tenantEncontrado: false };
    }
    const b = (tenant.branding ?? {}) as Partial<BrandingTienda>;
    return {
      codigo: tenant.codigo,
      nombre: b.nombre ?? tenant.nombre,
      subtitulo: b.subtitulo ?? null,
      logoSvg: b.logoSvg ?? null,
      tenantEncontrado: true,
    };
  }

  /**
   * Lista de tiendas para el selector del login. Solo en dev/staging: en producción
   * el subdominio fija el tenant (idéntico al `lista-dev` de Velarde, que devuelve []
   * en prod para no exponer la lista de tenants públicamente).
   */
  async listarTiendas(): Promise<Array<{ codigo: string; nombre: string }>> {
    if (process.env.NODE_ENV === 'production') return [];
    return this.prisma.tenant.findMany({
      where: {
        eliminadoEn: null,
        estado: { in: [TenantEstado.activo, TenantEstado.trial] },
      },
      select: { codigo: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /** Actualiza el branding de una tienda con merge defensivo (solo claves provistas). */
  async actualizar(codigo: string, dto: ActualizarBrandingDto): Promise<BrandingPublico> {
    if (dto.logoSvg != null && !dto.logoSvg.includes('<svg')) {
      throw new ErrorValidacion('El logo no parece ser un SVG válido');
    }
    const tenant = await this.prisma.tenant.findFirst({
      where: { codigo, eliminadoEn: null },
    });
    if (!tenant) throw new ErrorNoEncontrado(`Tienda "${codigo}" no existe`);

    const actual = (tenant.branding ?? {}) as Partial<BrandingTienda>;
    const merged: BrandingTienda = {
      logoSvg: dto.logoSvg !== undefined ? dto.logoSvg : actual.logoSvg ?? null,
      nombre: dto.nombre !== undefined ? dto.nombre : actual.nombre ?? null,
      subtitulo: dto.subtitulo !== undefined ? dto.subtitulo : actual.subtitulo ?? null,
    };
    await this.prisma.tenant.update({
      where: { codigo },
      data: { branding: merged as unknown as Prisma.InputJsonValue },
    });
    return this.obtenerPublico(codigo);
  }
}
