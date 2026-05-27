/**
 * SerieCpeService — gestión de series CPE y asignación atómica de correlativos.
 *
 * REGLAS DE DOMINIO CRÍTICAS:
 *
 *  1. NUNCA hard-delete una serie: usar toggle `activa` únicamente.
 *     Una vez emitido un CPE con correlativo N, ese número es "burned" en SUNAT.
 *
 *  2. `correlativoActual` es read-only post-creación (solo vía asignarProximoCorrelativo).
 *     Modificarlo directamente sería contabilidad creativa.
 *
 *  3. `serie` y `tipoCpe` son inmutables post-creación — cambiarlos rompe la
 *     continuidad fiscal.
 *
 *  4. El incremento de correlativo se hace con Prisma `increment: 1`, delegando
 *     el lock a Postgres para evitar race conditions.
 */
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TipoCpe } from '../../../core/sunat/codigos';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../../core/errors/errores';
import { CrearSerieCpeDto } from './dto/crear-serie-cpe.dto';
import { ActualizarSerieCpeDto } from './dto/actualizar-serie-cpe.dto';
import { PrismaTenantService } from '../../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../../core/tenancy/tenant-context';

export interface SerieAsignada {
  serieCpeId: string;
  serie: string;        // ej. "F001"
  correlativo: string;  // ej. "00000032" (zero-padded 8 chars)
}

// Tipos inferidos del Prisma client
type SerieCpe = Awaited<ReturnType<PrismaClient['serieCpe']['findFirst']>> & NonNullable<unknown>;

/**
 * Letra inicial esperada por tipo CPE (convención, no normativa estricta SUNAT).
 * Solo aplica para factura y boleta — el resto no tiene restricción.
 */
const PREFIJO_POR_TIPO: Partial<Record<TipoCpe, string>> = {
  factura: 'F',
  boleta: 'B',
};

@Injectable()
export class SerieCpeService {
  constructor(private readonly prismaTenancy: PrismaTenantService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Lista todas las series CPE, opcionalmente filtradas por sucursal.
   * Incluye la relación sucursal para mostrar el nombre en la UI.
   */
  async listar(ctx: TenantContext, sucursalId?: string): Promise<SerieCpe[]> {
    return this.prismaTenancy.forTenant(ctx).serieCpe.findMany({
      where: sucursalId ? { sucursalId } : undefined,
      include: { sucursal: true },
      orderBy: [{ sucursalId: 'asc' }, { tipoCpe: 'asc' }, { serie: 'asc' }],
    }) as Promise<SerieCpe[]>;
  }

  /**
   * Crea una nueva serie CPE.
   *
   * Validaciones:
   *  1. sucursalId existe y no está eliminada.
   *  2. serie matchea /^[A-Z]\d{3}$/.
   *  3. Coherencia letra↔tipoCpe (factura→F, boleta→B).
   *  4. correlativoInicial >= 0 (controlado por DTO).
   *  5. (sucursalId, tipoCpe, serie) no duplicada → ErrorConflicto.
   */
  async crear(ctx: TenantContext, dto: CrearSerieCpeDto): Promise<SerieCpe> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    // 1. Verificar sucursal
    const sucursal = await prisma.sucursal.findFirst({
      where: { id: dto.sucursalId, eliminadoEn: null },
    });
    if (!sucursal) {
      throw new ErrorNoEncontrado(
        `Sucursal con id '${dto.sucursalId}' no encontrada o eliminada`,
      );
    }

    // 2. Validar formato serie (el DTO ya tiene @Matches, esta validación es
    //    una defensa en profundidad para cuando el service se llame programáticamente)
    if (!/^[A-Z]\d{3}$/.test(dto.serie)) {
      throw new ErrorValidacion(
        'La serie debe tener el formato: 1 letra mayúscula seguida de 3 dígitos (ej: F001, B002)',
      );
    }

    // 3. Coherencia letra↔tipoCpe
    const prefijoEsperado = PREFIJO_POR_TIPO[dto.tipoCpe];
    if (prefijoEsperado && !dto.serie.startsWith(prefijoEsperado)) {
      throw new ErrorValidacion(
        `Para el tipo '${dto.tipoCpe}', la serie debe comenzar con '${prefijoEsperado}' (ej: ${prefijoEsperado}001). ` +
          `Recibido: '${dto.serie}'.`,
      );
    }

    // 4 & 5. Crear — atrapar P2002 (unique constraint) → ErrorConflicto
    try {
      return await prisma.serieCpe.create({
        data: {
          sucursalId: dto.sucursalId,
          tipoCpe: dto.tipoCpe,
          serie: dto.serie,
          correlativoActual: dto.correlativoInicial ?? 0,
          activa: dto.activa ?? true,
        },
        include: { sucursal: true },
      }) as SerieCpe;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ErrorConflicto(
          `Ya existe una serie '${dto.serie}' para esa sucursal y tipo '${dto.tipoCpe}'`,
        );
      }
      throw err;
    }
  }

  /**
   * Actualiza una serie CPE. Solo permite cambiar `activa`.
   * Campos inmutables (serie, tipoCpe, correlativoActual, sucursalId)
   * se ignoran silenciosamente aunque vengan en el DTO.
   */
  async actualizar(ctx: TenantContext, id: string, dto: ActualizarSerieCpeDto): Promise<SerieCpe> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    // Verificar que existe
    const existente = await prisma.serieCpe.findFirst({ where: { id } });
    if (!existente) {
      throw new ErrorNoEncontrado(`Serie CPE con id '${id}' no encontrada`);
    }

    return prisma.serieCpe.update({
      where: { id },
      data: {
        // Solo aplicamos los campos permitidos — todo lo demás se ignora
        ...(dto.activa !== undefined ? { activa: dto.activa } : {}),
      },
      include: { sucursal: true },
    }) as Promise<SerieCpe>;
  }

  // ─── Asignación atómica de correlativos (uso interno — emisión CPE) ────────

  async asignarProximoCorrelativo(
    ctx: TenantContext,
    sucursalId: string,
    tipoCpe: TipoCpe,
  ): Promise<SerieAsignada> {
    return this.asignarProximoCorrelativoEnTenant(
      this.prismaTenancy.forTenant(ctx),
      sucursalId,
      tipoCpe,
    );
  }

  /**
   * Variante que usa el prisma del caller (ya resuelto al tenant correcto).
   * Útil cuando VentasService u otros services quieren llamar desde fuera de
   * su propia inyección de PrismaTenantService, pasando el PrismaClient ya resuelto.
   */
  async asignarProximoCorrelativoEnTenant(
    prismaTenant: PrismaClient,
    sucursalId: string,
    tipoCpe: TipoCpe,
  ): Promise<SerieAsignada> {
    return prismaTenant.$transaction(async (tx) => {
      const serie = await tx.serieCpe.findFirst({
        where: { sucursalId, tipoCpe, activa: true },
      });

      if (!serie) {
        throw new ErrorNoEncontrado(
          `No hay serie activa configurada para sucursal ${sucursalId} tipo ${tipoCpe}`,
        );
      }

      const actualizada = await tx.serieCpe.update({
        where: { id: serie.id },
        data: { correlativoActual: { increment: 1 } },
      });

      return {
        serieCpeId: serie.id,
        serie: serie.serie,
        correlativo: String(actualizada.correlativoActual).padStart(8, '0'),
      };
    });
  }
}
