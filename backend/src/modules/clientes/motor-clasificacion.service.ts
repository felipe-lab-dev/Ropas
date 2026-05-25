import { Injectable } from '@nestjs/common';
import { ClasificacionAbc, Prisma, TipoDocumento } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';

/**
 * Motor de Clasificación de Clientes — RFM clásico, mismo Pareto que motor logístico.
 *
 * Inspiración: módulo CRM > Clientes de DIH_ERP y el motor logístico de productos
 * de este mismo repo. Acá usamos RFM (Recency / Frequency / Monetary) porque para
 * clientes no aplican rotación/margen/tendencia.
 *
 *   Variable      Peso  Qué mide
 *   ────────────────────────────────────────────────────────────────────────
 *   Recencia      30 %  1 = compró hoy, 0 = hace 12+ meses (decay lineal)
 *   Frecuencia    30 %  cantidad de ventas / 12 (saturado a 1.0)
 *   Monetario     40 %  Σ totales de ventas, normalizado al máximo del tenant
 *
 *   Distribución (sobre clientes activos):
 *     AA  6 %   — VIP, máxima atención y trato preferencial
 *     A  14 %   — top de cartera
 *     B  20 %   — sólidos
 *     C  27 %   — ocasionales
 *     D  33 %   — fríos / sin compras
 *
 *   Clientes sin ventas en 12 m → D directamente.
 *   Clientes eliminados → no se clasifican.
 */
@Injectable()
export class MotorClasificacionClientesService {
  constructor(private readonly prisma: PrismaTenantService) {}

  private static readonly PORCENTAJES: Record<ClasificacionAbc, number> = {
    AA: 0.06,
    A: 0.14,
    B: 0.20,
    C: 0.27,
    D: 0.33,
  };

  private static readonly PESOS = {
    recencia: 0.30,
    frecuencia: 0.30,
    monetario: 0.40,
  };

  private static readonly MESES_LOOKBACK = 12;

  async calcular(ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const ejecutadoEn = new Date();

    const desde = new Date();
    desde.setMonth(desde.getMonth() - MotorClasificacionClientesService.MESES_LOOKBACK);
    desde.setHours(0, 0, 0, 0);

    const clientes = await cliente.cliente.findMany({
      where: { eliminadoEn: null },
      select: { id: true },
    });
    if (clientes.length === 0) {
      return {
        ejecutadoEn,
        clientesTotales: 0,
        clientesClasificados: 0,
        distribucion: { AA: 0, A: 0, B: 0, C: 0, D: 0 } as Record<ClasificacionAbc, number>,
        topPorClase: { AA: [], A: [], B: [], C: [], D: [] } as Record<ClasificacionAbc, Array<TopCliente>>,
        parametros: MotorClasificacionClientesService.parametros(),
      };
    }

    // Cargar ventas en la ventana de 12 meses, asociadas a un cliente y no anuladas.
    const ventas = await cliente.venta.findMany({
      where: {
        anuladaEn: null,
        clienteId: { not: null },
        creadoEn: { gte: desde },
      },
      select: { clienteId: true, total: true, creadoEn: true },
    });

    type Acumulado = {
      monto: number;
      cantidad: number;
      ultimaVenta?: Date;
    };
    const porCliente = new Map<string, Acumulado>();
    for (const v of ventas) {
      if (!v.clienteId) continue;
      const acc = porCliente.get(v.clienteId) ?? { monto: 0, cantidad: 0 };
      acc.monto += Number(v.total);
      acc.cantidad += 1;
      if (!acc.ultimaVenta || v.creadoEn > acc.ultimaVenta) acc.ultimaVenta = v.creadoEn;
      porCliente.set(v.clienteId, acc);
    }

    type Crudo = {
      clienteId: string;
      monto: number;
      cantidad: number;
      recencia: number;   // 0..1
      frecuencia: number; // 0..1
      monetario: number;  // 0..1 (normalizado al final)
    };
    const ahora = ejecutadoEn.getTime();
    const ventanaMs = MotorClasificacionClientesService.MESES_LOOKBACK * 30 * 24 * 3600 * 1000;
    const crudos: Crudo[] = clientes.map(c => {
      const acc = porCliente.get(c.id);
      if (!acc) {
        return { clienteId: c.id, monto: 0, cantidad: 0, recencia: 0, frecuencia: 0, monetario: 0 };
      }
      const dias = acc.ultimaVenta ? (ahora - acc.ultimaVenta.getTime()) / ventanaMs : 1;
      const recencia = Math.max(0, 1 - dias);
      const frecuencia = Math.min(1, acc.cantidad / MotorClasificacionClientesService.MESES_LOOKBACK);
      return {
        clienteId: c.id,
        monto: acc.monto,
        cantidad: acc.cantidad,
        recencia,
        frecuencia,
        monetario: acc.monto, // se normaliza abajo
      };
    });

    const maxMonto = Math.max(1, ...crudos.map(c => c.monto));

    type Scored = Crudo & { score: number };
    const scored: Scored[] = crudos.map(c => {
      const monetarioNorm = c.monto / maxMonto;
      const score =
        c.recencia   * MotorClasificacionClientesService.PESOS.recencia +
        c.frecuencia * MotorClasificacionClientesService.PESOS.frecuencia +
        monetarioNorm * MotorClasificacionClientesService.PESOS.monetario;
      return { ...c, monetario: monetarioNorm, score };
    });

    const conVentas = scored.filter(s => s.cantidad > 0).sort((a, b) => b.score - a.score);
    const sinVentas = scored.filter(s => s.cantidad === 0);

    const total = clientes.length;
    const conVentasCount = conVentas.length;
    const cupos: Array<{ clase: ClasificacionAbc; cant: number }> = [];
    let asignados = 0;
    (['AA', 'A', 'B', 'C', 'D'] as ClasificacionAbc[]).forEach((clase, i, arr) => {
      const pct = MotorClasificacionClientesService.PORCENTAJES[clase] ?? 0;
      let cant = Math.floor(total * pct);
      // En carteras chicas (típico CRM), garantizar al menos 1 cliente en AA/A/B/C
      // si todavía hay candidatos con ventas. Sin esto, con 10 clientes AA queda
      // vacío (floor(10*0.06)=0) y se pierde la cima del Pareto.
      if (cant === 0 && clase !== 'D' && asignados < conVentasCount) cant = 1;
      if (i === arr.length - 1) cant = total - asignados; // D absorbe redondeo
      asignados += cant;
      cupos.push({ clase, cant });
    });

    const asignaciones = new Map<string, { clase: ClasificacionAbc; score: number }>();
    let cursor = 0;
    for (const { clase, cant } of cupos) {
      for (let i = 0; i < cant; i++) {
        const s = conVentas[cursor];
        if (s) {
          asignaciones.set(s.clienteId, { clase, score: s.score });
          cursor++;
        } else {
          break;
        }
      }
    }
    for (const s of sinVentas) {
      asignaciones.set(s.clienteId, { clase: 'D', score: 0 });
    }
    for (const s of conVentas.slice(cursor)) {
      asignaciones.set(s.clienteId, { clase: 'D', score: s.score });
    }

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    for (const [clienteId, { clase, score }] of asignaciones) {
      updates.push(
        cliente.cliente.update({
          where: { id: clienteId },
          data: {
            clasificacion: clase,
            clasificacionScore: score,
            clasificadoEn: ejecutadoEn,
          },
        }),
      );
    }
    await cliente.$transaction(updates);

    const distribucion: Record<ClasificacionAbc, number> = { AA: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const { clase } of asignaciones.values()) distribucion[clase] = (distribucion[clase] ?? 0) + 1;

    const topIdsPorClase: Record<ClasificacionAbc, string[]> = { AA: [], A: [], B: [], C: [], D: [] };
    for (const [clienteId, { clase }] of asignaciones) {
      const arr = topIdsPorClase[clase] ?? (topIdsPorClase[clase] = []);
      if (arr.length < 5) arr.push(clienteId);
    }
    const todosIds = Object.values(topIdsPorClase).flat();
    const topInfo = todosIds.length
      ? await cliente.cliente.findMany({
          where: { id: { in: todosIds } },
          select: { id: true, nombre: true, documento: true, tipoDocumento: true },
        })
      : [];
    const infoMap = new Map(topInfo.map(t => [t.id, t]));
    const scoreMap = new Map(scored.map(s => [s.clienteId, s]));
    const topPorClase = {} as Record<ClasificacionAbc, Array<TopCliente>>;
    (['AA', 'A', 'B', 'C', 'D'] as ClasificacionAbc[]).forEach(clase => {
      const ids = topIdsPorClase[clase] ?? [];
      topPorClase[clase] = ids
        .map(id => {
          const i = infoMap.get(id);
          const s = scoreMap.get(id);
          if (!i || !s) return null;
          return {
            id: i.id,
            nombre: i.nombre,
            documento: i.documento,
            tipoDocumento: i.tipoDocumento,
            cantidadVentas: s.cantidad,
            monto: Math.round(s.monto * 100) / 100,
            recencia: Math.round(s.recencia * 100) / 100,
            frecuencia: Math.round(s.frecuencia * 100) / 100,
            monetario: Math.round(s.monetario * 100) / 100,
            score: Math.round(s.score * 1000) / 1000,
          };
        })
        .filter((x): x is TopCliente => x !== null);
    });

    return {
      ejecutadoEn,
      clientesTotales: total,
      clientesClasificados: asignaciones.size,
      distribucion,
      topPorClase,
      parametros: MotorClasificacionClientesService.parametros(),
    };
  }

  private static parametros() {
    return {
      mesesLookback: MotorClasificacionClientesService.MESES_LOOKBACK,
      porcentajes: MotorClasificacionClientesService.PORCENTAJES,
      pesos: MotorClasificacionClientesService.PESOS,
    };
  }
}

export interface TopCliente {
  id: string;
  nombre: string;
  documento: string | null;
  tipoDocumento: TipoDocumento;
  cantidadVentas: number;
  monto: number;
  recencia: number;
  frecuencia: number;
  monetario: number;
  score: number;
}
