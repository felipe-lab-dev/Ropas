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
 *  3. `serie`, `tipoCpe` y `aplicaA` son inmutables post-creación — cambiarlos
 *     rompe la continuidad fiscal.
 *
 *  4. El incremento de correlativo se hace con Prisma `increment: 1`, delegando
 *     el lock a Postgres para evitar race conditions.
 *
 *  5. UNICIDAD: a lo sumo UNA serie ACTIVA por (sucursalId, tipoCpe, aplicaA).
 *     Forzado en DB por dos unique partial indexes (uno con aplicaA NULL, otro
 *     con aplicaA NOT NULL). Se valida también a nivel service para devolver
 *     ErrorConflicto con mensaje legible antes del round-trip a Postgres.
 *
 *  6. `aplicaA` solo puede tener valor cuando `tipoCpe` es transversal:
 *     nota_credito o nota_debito. Para factura/boleta/guia_* debe ser null.
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

/** Tipos `tipoCpe` que requieren `aplicaA` (factura | boleta). */
const TIPOS_TRANSVERSALES: ReadonlySet<TipoCpe> = new Set(['nota_credito', 'nota_debito']);

/**
 * Letra inicial esperada por (tipoCpe, aplicaA).
 * - factura / boleta normales → prefijo F / B
 * - NC/ND con aplicaA=factura → prefijo F (sigue serie del documento referenciado)
 * - NC/ND con aplicaA=boleta  → prefijo B
 * - Otros tipos sin restricción
 */
function prefijoEsperado(tipoCpe: TipoCpe, aplicaA: TipoCpe | null): string | null {
  if (tipoCpe === 'factura') return 'F';
  if (tipoCpe === 'boleta') return 'B';
  if (TIPOS_TRANSVERSALES.has(tipoCpe)) {
    if (aplicaA === 'factura') return 'F';
    if (aplicaA === 'boleta') return 'B';
  }
  return null;
}

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
      orderBy: [
        { sucursalId: 'asc' },
        { tipoCpe: 'asc' },
        { aplicaA: 'asc' },
        { serie: 'asc' },
      ],
    }) as Promise<SerieCpe[]>;
  }

  /**
   * Crea una nueva serie CPE.
   *
   * Validaciones:
   *  1. sucursalId existe (si viene); si no, se usa la sucursal principal.
   *  2. serie matchea /^[A-Z]\d{3}$/.
   *  3. Coherencia tipoCpe ↔ aplicaA:
   *     - nota_credito / nota_debito  → aplicaA obligatorio (factura | boleta)
   *     - resto                       → aplicaA debe ser null
   *  4. Coherencia letra inicial ↔ (tipoCpe, aplicaA).
   *  5. correlativoInicial >= 0 (controlado por DTO).
   *  6. Si se crea ACTIVA, no debe existir otra serie activa para esa
   *     (sucursalId, tipoCpe, aplicaA). ErrorConflicto en caso contrario.
   *  7. (sucursalId, tipoCpe, aplicaA, serie) no duplicada → ErrorConflicto.
   */
  async crear(ctx: TenantContext, dto: CrearSerieCpeDto): Promise<SerieCpe> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    // 1. Resolver sucursal
    let sucursalId: string;
    if (dto.sucursalId) {
      const sucursal = await prisma.sucursal.findFirst({
        where: { id: dto.sucursalId, eliminadoEn: null },
      });
      if (!sucursal) {
        throw new ErrorNoEncontrado(
          `Sucursal con id '${dto.sucursalId}' no encontrada o eliminada`,
        );
      }
      sucursalId = sucursal.id;
    } else {
      const principal = await prisma.sucursal.findFirst({
        where: { esPrincipal: true, eliminadoEn: null },
      });
      if (!principal) {
        throw new ErrorNoEncontrado('Sucursal principal no encontrada');
      }
      sucursalId = principal.id;
    }

    // 2. Validar formato serie (defensa en profundidad — el DTO ya valida)
    if (!/^[A-Z]\d{3}$/.test(dto.serie)) {
      throw new ErrorValidacion(
        'La serie debe tener el formato: 1 letra mayúscula seguida de 3 dígitos (ej: F001, B002)',
      );
    }

    // 3. Coherencia tipoCpe ↔ aplicaA
    const aplicaA: TipoCpe | null = dto.aplicaA ?? null;
    if (TIPOS_TRANSVERSALES.has(dto.tipoCpe)) {
      if (aplicaA !== 'factura' && aplicaA !== 'boleta') {
        throw new ErrorValidacion(
          `Para '${dto.tipoCpe}' debes indicar aplicaA = 'factura' o 'boleta' (qué tipo de comprobante referencia esta NC/ND)`,
        );
      }
    } else if (aplicaA !== null) {
      throw new ErrorValidacion(
        `aplicaA solo se permite cuando tipoCpe es nota_credito o nota_debito. Recibido tipoCpe='${dto.tipoCpe}' aplicaA='${aplicaA}'.`,
      );
    }

    // 4. Coherencia letra ↔ subtipo
    const prefijo = prefijoEsperado(dto.tipoCpe, aplicaA);
    if (prefijo && !dto.serie.startsWith(prefijo)) {
      const detalleSubtipo = aplicaA ? ` (que aplica a ${aplicaA})` : '';
      throw new ErrorValidacion(
        `Para '${dto.tipoCpe}'${detalleSubtipo} la serie debe comenzar con '${prefijo}' (ej: ${prefijo}001). Recibido: '${dto.serie}'.`,
      );
    }

    const activa = dto.activa ?? true;

    // 6. Unicidad de activa por (sucursal, tipoCpe, aplicaA)
    if (activa) {
      const existeActiva = await prisma.serieCpe.findFirst({
        where: {
          sucursalId,
          tipoCpe: dto.tipoCpe,
          aplicaA,
          activa: true,
        },
      });
      if (existeActiva) {
        const detalle = aplicaA
          ? `tipo '${dto.tipoCpe}' (aplica a ${aplicaA})`
          : `tipo '${dto.tipoCpe}'`;
        throw new ErrorConflicto(
          `Ya hay una serie ACTIVA para ${detalle} en esa sucursal ('${existeActiva.serie}'). ` +
            `Desactivá esa serie antes de crear una nueva.`,
        );
      }
    }

    // 7. Crear — atrapar P2002 (unique violation a nivel DB)
    try {
      return await prisma.serieCpe.create({
        data: {
          sucursalId,
          tipoCpe: dto.tipoCpe,
          aplicaA,
          serie: dto.serie,
          correlativoActual: dto.correlativoInicial ?? 0,
          activa,
        },
        include: { sucursal: true },
      }) as SerieCpe;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const detalle = aplicaA
          ? `tipo '${dto.tipoCpe}' (aplica a ${aplicaA})`
          : `tipo '${dto.tipoCpe}'`;
        throw new ErrorConflicto(
          `Ya existe una serie '${dto.serie}' para ${detalle} en esa sucursal`,
        );
      }
      throw err;
    }
  }

  /**
   * Actualiza una serie CPE. Solo permite cambiar `activa`.
   * Campos inmutables (serie, tipoCpe, aplicaA, correlativoActual, sucursalId)
   * se ignoran silenciosamente aunque vengan en el DTO.
   *
   * Si se intenta activar una serie y ya existe otra activa para la misma
   * (sucursal, tipoCpe, aplicaA), se lanza ErrorConflicto.
   */
  async actualizar(ctx: TenantContext, id: string, dto: ActualizarSerieCpeDto): Promise<SerieCpe> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    const existente = await prisma.serieCpe.findFirst({ where: { id } });
    if (!existente) {
      throw new ErrorNoEncontrado(`Serie CPE con id '${id}' no encontrada`);
    }

    // Si se quiere activar y hoy está inactiva, validar que no haya otra activa.
    if (dto.activa === true && !existente.activa) {
      const otraActiva = await prisma.serieCpe.findFirst({
        where: {
          sucursalId: existente.sucursalId,
          tipoCpe: existente.tipoCpe,
          aplicaA: existente.aplicaA,
          activa: true,
          id: { not: id },
        },
      });
      if (otraActiva) {
        const detalle = existente.aplicaA
          ? `tipo '${existente.tipoCpe}' (aplica a ${existente.aplicaA})`
          : `tipo '${existente.tipoCpe}'`;
        throw new ErrorConflicto(
          `No se puede activar: ya hay otra serie activa para ${detalle} ('${otraActiva.serie}'). ` +
            `Desactivala primero.`,
        );
      }
    }

    return prisma.serieCpe.update({
      where: { id },
      data: {
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
    aplicaA: TipoCpe | null = null,
  ): Promise<SerieAsignada> {
    return this.asignarProximoCorrelativoEnTenant(
      this.prismaTenancy.forTenant(ctx),
      sucursalId,
      tipoCpe,
      aplicaA,
    );
  }

  /**
   * Variante que usa el prisma del caller (ya resuelto al tenant correcto).
   * `aplicaA` debe pasarse explícitamente cuando `tipoCpe` es transversal
   * (nota_credito/nota_debito); si no, se busca la serie activa con aplicaA=null.
   */
  async asignarProximoCorrelativoEnTenant(
    prismaTenant: PrismaClient,
    sucursalId: string,
    tipoCpe: TipoCpe,
    aplicaA: TipoCpe | null = null,
  ): Promise<SerieAsignada> {
    return prismaTenant.$transaction(async (tx) => {
      const serie = await tx.serieCpe.findFirst({
        where: { sucursalId, tipoCpe, aplicaA, activa: true },
      });

      if (!serie) {
        const detalle = aplicaA
          ? `${tipoCpe} (aplica a ${aplicaA})`
          : tipoCpe;
        throw new ErrorNoEncontrado(
          `No hay serie activa configurada para sucursal ${sucursalId} tipo ${detalle}`,
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
