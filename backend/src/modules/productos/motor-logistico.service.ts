import { Injectable } from '@nestjs/common';
import { ClasificacionAbc, Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';

/**
 * Motor Logístico — Clasificación ABC multi-variable, adaptado al rubro ropa.
 *
 * Inspiración: cron semanal de DIH/nueva_era (Pareto puro por "contadorSalidas").
 * Aquí enriquecemos con 6 variables que reflejan demanda, rentabilidad y salud
 * de stock, y aplicamos la misma distribución 6/14/20/27/33.
 *
 *   Variable           Peso  Qué mide
 *   ────────────────────────────────────────────────────────────────────────
 *   Unidades (12 m)    25 %  Volumen vendido absoluto
 *   Margen (12 m)      20 %  Rentabilidad: (precio - costo) × unidades
 *   Frecuencia         15 %  % de meses con ventas (constancia)
 *   Recencia           10 %  1 = vendido hoy, 0 = hace 12+ meses
 *   Tendencia          15 %  Crecimiento últimos 3 m vs 3 m previos
 *   Rotación           15 %  Unidades 12 m / stock disponible (velocidad)
 *
 *   Distribución (sobre productos con ventas > 0):
 *     AA  6 %   — joyas, máxima atención y stock
 *     A  14 %   — pilares del catálogo
 *     B  20 %   — sólidos
 *     C  27 %   — baja rotación, candidatos a promoción
 *     D  33 %   — cola larga
 *
 *   Productos sin ventas en 12 m → D directamente.
 *   Productos inactivos / eliminados → no se clasifican.
 */
@Injectable()
export class MotorLogisticoService {
  constructor(private readonly prisma: PrismaTenantService) {}

  private static readonly PORCENTAJES: Record<ClasificacionAbc, number> = {
    AA: 0.06,
    A: 0.14,
    B: 0.20,
    C: 0.27,
    D: 0.33,
  };

  private static readonly PESOS = {
    unidades: 0.25,
    margen: 0.20,
    frecuencia: 0.15,
    recencia: 0.10,
    tendencia: 0.15,
    rotacion: 0.15,
  };

  private static readonly MESES_LOOKBACK = 12;
  private static readonly MESES_TENDENCIA = 3;

  async calcular(ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const ejecutadoEn = new Date();

    const desde = new Date();
    desde.setMonth(desde.getMonth() - MotorLogisticoService.MESES_LOOKBACK);
    desde.setDate(1);
    desde.setHours(0, 0, 0, 0);

    // 1. Cargar productos activos con variantes + stock total (para rotación).
    const productos = await cliente.producto.findMany({
      where: { eliminadoEn: null, activo: true },
      select: {
        id: true,
        precioVenta: true,
        precioCompra: true,
        variantes: {
          where: { eliminadoEn: null },
          select: {
            id: true,
            stocks: { select: { disponible: true } },
          },
        },
      },
    });
    if (productos.length === 0) {
      return {
        ejecutadoEn,
        productosTotales: 0,
        productosClasificados: 0,
        distribucion: { AA: 0, A: 0, B: 0, C: 0, D: 0 },
        topPorClase: { AA: [], A: [], B: [], C: [], D: [] } as Record<ClasificacionAbc, Array<TopProducto>>,
        parametros: MotorLogisticoService.parametros(),
      };
    }
    const varianteAProducto = new Map<string, string>();
    for (const p of productos) for (const v of p.variantes) varianteAProducto.set(v.id, p.id);

    // 2. Agregar ventas (unidades + ingresos) por variante en el período.
    const items = await cliente.ventaItem.findMany({
      where: {
        variante: { producto: { eliminadoEn: null } },
        venta: { anuladaEn: null, creadoEn: { gte: desde } },
      },
      select: {
        cantidad: true,
        varianteId: true,
        precioUnitario: true,
        venta: { select: { creadoEn: true } },
      },
    });

    // Calcular punto de corte para "tendencia" (3 meses recientes vs 3 anteriores).
    const corteTendencia = new Date();
    corteTendencia.setMonth(corteTendencia.getMonth() - MotorLogisticoService.MESES_TENDENCIA);
    corteTendencia.setHours(0, 0, 0, 0);

    type Acumulado = {
      unidades: number;
      ingreso: number;
      mesesActivos: Set<string>;
      ultimaVenta?: Date;
      unidadesRecientes: number; // últimos 3 meses
      unidadesPrevias: number;   // 3 meses anteriores a esos
    };
    const porProducto = new Map<string, Acumulado>();

    for (const it of items) {
      const productoId = varianteAProducto.get(it.varianteId);
      if (!productoId) continue;
      const acc = porProducto.get(productoId) ?? {
        unidades: 0, ingreso: 0, mesesActivos: new Set<string>(),
        unidadesRecientes: 0, unidadesPrevias: 0,
      };
      acc.unidades += it.cantidad;
      acc.ingreso += Number(it.precioUnitario) * it.cantidad;
      const f = it.venta.creadoEn;
      const mes = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
      acc.mesesActivos.add(mes);
      if (!acc.ultimaVenta || f > acc.ultimaVenta) acc.ultimaVenta = f;
      if (f >= corteTendencia) acc.unidadesRecientes += it.cantidad;
      else acc.unidadesPrevias += it.cantidad;
      porProducto.set(productoId, acc);
    }

    // 3. Calcular variables crudas por producto.
    type Crudo = {
      productoId: string;
      unidades: number;
      margen: number;
      frecuencia: number;
      recencia: number;
      tendencia: number; // -1 .. +1 después de normalizar a [0,1]
      rotacion: number;  // ventas / stock
    };
    const crudos: Crudo[] = [];
    const ahora = ejecutadoEn.getTime();
    const ventanaMs = MotorLogisticoService.MESES_LOOKBACK * 30 * 24 * 3600 * 1000;

    for (const p of productos) {
      const acc = porProducto.get(p.id);
      const stockTotal = p.variantes.reduce(
        (s, v) => s + v.stocks.reduce((a, st) => a + st.disponible, 0),
        0,
      );
      if (!acc || acc.unidades === 0) {
        crudos.push({
          productoId: p.id,
          unidades: 0, margen: 0, frecuencia: 0,
          recencia: 0, tendencia: 0, rotacion: 0,
        });
        continue;
      }

      const costoUnitario = Number(p.precioCompra ?? 0);
      const ingresoUnitarioProm = acc.ingreso / acc.unidades;
      const margenUnitario = Math.max(0, ingresoUnitarioProm - costoUnitario);
      const margenTotal = margenUnitario * acc.unidades;

      const frecuencia = acc.mesesActivos.size / MotorLogisticoService.MESES_LOOKBACK;
      const dias = acc.ultimaVenta ? (ahora - acc.ultimaVenta.getTime()) / ventanaMs : 1;
      const recencia = Math.max(0, 1 - dias);

      // Tendencia: ratio recientes vs previos, mapeado a [0, 1].
      //   = 1 si recientes > previos × 2
      //   = 0.5 si iguales
      //   = 0 si sin ventas recientes
      let tendencia: number;
      if (acc.unidadesRecientes === 0 && acc.unidadesPrevias === 0) tendencia = 0;
      else if (acc.unidadesPrevias === 0) tendencia = 1;
      else {
        const ratio = acc.unidadesRecientes / acc.unidadesPrevias; // 0..∞
        tendencia = Math.min(1, ratio / 2); // ratio=2 → 1; ratio=1 → 0.5; ratio=0 → 0
      }

      // Rotación: unidades vendidas / (stock + unidades), evita div/0 y satura
      const rotacion = stockTotal === 0
        ? 1 // sin stock pero vendiendo = altísima rotación
        : Math.min(1, acc.unidades / (stockTotal + acc.unidades));

      crudos.push({
        productoId: p.id,
        unidades: acc.unidades,
        margen: margenTotal,
        frecuencia,
        recencia,
        tendencia,
        rotacion,
      });
    }

    // 4. Normalizar y calcular score ponderado.
    const maxU = Math.max(1, ...crudos.map(s => s.unidades));
    const maxM = Math.max(1, ...crudos.map(s => s.margen));
    // frecuencia, recencia, tendencia y rotación ya están en [0,1]

    type Scored = Crudo & { score: number };
    const scored: Scored[] = crudos.map(c => {
      const score =
        (c.unidades / maxU)  * MotorLogisticoService.PESOS.unidades +
        (c.margen   / maxM)  * MotorLogisticoService.PESOS.margen +
        c.frecuencia         * MotorLogisticoService.PESOS.frecuencia +
        c.recencia           * MotorLogisticoService.PESOS.recencia +
        c.tendencia          * MotorLogisticoService.PESOS.tendencia +
        c.rotacion           * MotorLogisticoService.PESOS.rotacion;
      return { ...c, score };
    });

    // 4. Separar con/sin ventas. Solo "con ventas" entra al Pareto AA-C.
    const conVentas = scored.filter(s => s.unidades > 0).sort((a, b) => b.score - a.score);
    const sinVentas = scored.filter(s => s.unidades === 0);

    // 5. Asignar clases por porcentaje sobre el universo activo (productos.length),
    //    pero la distribución se aplica al ordenamiento de los con ventas.
    //    Los sin ventas caen automáticamente en D.
    const total = productos.length;
    const cupos: Array<{ clase: ClasificacionAbc; cant: number }> = [];
    let asignados = 0;
    (['AA', 'A', 'B', 'C', 'D'] as ClasificacionAbc[]).forEach((clase, i, arr) => {
      const pct = MotorLogisticoService.PORCENTAJES[clase] ?? 0;
      let cant = Math.floor(total * pct);
      if (i === arr.length - 1) cant = total - asignados; // D absorbe el redondeo
      asignados += cant;
      cupos.push({ clase, cant });
    });

    const asignaciones = new Map<string, { clase: ClasificacionAbc; score: number }>();
    let cursor = 0;
    for (const { clase, cant } of cupos) {
      for (let i = 0; i < cant; i++) {
        const s = conVentas[cursor];
        if (s) {
          asignaciones.set(s.productoId, { clase, score: s.score });
          cursor++;
        } else {
          // Se acabaron los con ventas; el resto de cupos cae en D
          break;
        }
      }
    }
    // Productos sin ventas → D
    for (const s of sinVentas) {
      asignaciones.set(s.productoId, { clase: 'D', score: 0 });
    }
    // Productos con ventas que quedaron sin cupo (D)
    for (const s of conVentas.slice(cursor)) {
      asignaciones.set(s.productoId, { clase: 'D', score: s.score });
    }

    // 6. Update masivo en BD.
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    for (const [productoId, { clase, score }] of asignaciones) {
      updates.push(
        cliente.producto.update({
          where: { id: productoId },
          data: {
            clasificacion: clase,
            clasificacionScore: score,
            clasificadoEn: ejecutadoEn,
          },
        }),
      );
    }
    await cliente.$transaction(updates);

    // 7. Distribución y top por clase para devolver al usuario.
    const distribucion: Record<ClasificacionAbc, number> = { AA: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const { clase } of asignaciones.values()) distribucion[clase] = (distribucion[clase] ?? 0) + 1;

    const topIdsPorClase: Record<ClasificacionAbc, string[]> = { AA: [], A: [], B: [], C: [], D: [] };
    for (const [productoId, { clase }] of asignaciones) {
      const arr = topIdsPorClase[clase] ?? (topIdsPorClase[clase] = []);
      if (arr.length < 5) arr.push(productoId);
    }
    const todosIds = Object.values(topIdsPorClase).flat();
    const topInfo = todosIds.length
      ? await cliente.producto.findMany({
          where: { id: { in: todosIds } },
          select: { id: true, sku: true, codigo: true, nombre: true },
        })
      : [];
    const infoMap = new Map(topInfo.map(t => [t.id, t]));
    const scoreMap = new Map(scored.map(s => [s.productoId, s]));
    const topPorClase = {} as Record<ClasificacionAbc, Array<TopProducto>>;
    (['AA', 'A', 'B', 'C', 'D'] as ClasificacionAbc[]).forEach(clase => {
      const ids = topIdsPorClase[clase] ?? [];
      topPorClase[clase] = ids
        .map(id => {
          const i = infoMap.get(id);
          const s = scoreMap.get(id);
          if (!i || !s) return null;
          return {
            id: i.id,
            sku: i.sku,
            codigo: i.codigo,
            nombre: i.nombre,
            unidades: s.unidades,
            margen: Math.round(s.margen * 100) / 100,
            frecuencia: Math.round(s.frecuencia * 100) / 100,
            recencia: Math.round(s.recencia * 100) / 100,
            tendencia: Math.round(s.tendencia * 100) / 100,
            rotacion: Math.round(s.rotacion * 100) / 100,
            score: Math.round(s.score * 1000) / 1000,
          };
        })
        .filter((x): x is TopProducto => x !== null);
    });

    return {
      ejecutadoEn,
      productosTotales: total,
      productosClasificados: asignaciones.size,
      distribucion,
      topPorClase,
      parametros: MotorLogisticoService.parametros(),
    };
  }

  private static parametros() {
    return {
      mesesLookback: MotorLogisticoService.MESES_LOOKBACK,
      mesesTendencia: MotorLogisticoService.MESES_TENDENCIA,
      porcentajes: MotorLogisticoService.PORCENTAJES,
      pesos: MotorLogisticoService.PESOS,
    };
  }
}

export interface TopProducto {
  id: string;
  sku: string;
  codigo: string | null;
  nombre: string;
  unidades: number;
  margen: number;
  frecuencia: number;
  recencia: number;
  tendencia: number;
  rotacion: number;
  score: number;
}
