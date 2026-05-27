import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Motor de cupones — lógica de validación y cálculo de descuento.
 *
 * Stateless e idempotente: NO escribe en la DB. Recibe el cupón ya cargado
 * y un carrito, y devuelve el veredicto.
 *
 * Quien lo invoca (ventas.service o cupones.controller) se encarga de:
 *  - cargar el cupón
 *  - persistir el descuento en la venta
 *  - crear el CuponUso dentro de una transacción
 */
@Injectable()
export class MotorCuponesService {
  /**
   * Valida si un cupón puede aplicarse al carrito + cliente dados, y calcula
   * el monto de descuento.
   */
  evaluar(input: EvaluarCuponInput): EvaluarCuponResultado {
    const { cupon, carrito, clienteIdSolicitante, clienteClasificacion, ahora = new Date(), usosTotalesActuales, usosDelClienteActuales } = input;

    // 1. Estado lógico del cupón
    if (cupon.eliminadoEn) {
      return rechazo('El cupón fue eliminado');
    }
    if (cupon.estado === 'pausado') {
      return rechazo('El cupón está pausado');
    }

    // 2. Vigencia temporal
    if (ahora < cupon.fechaInicio) {
      return rechazo(`El cupón empieza a regir el ${cupon.fechaInicio.toISOString().slice(0, 10)}`);
    }
    if (ahora > cupon.fechaFin) {
      return rechazo('El cupón está vencido');
    }

    // 3. Límite total de usos
    if (cupon.usosMaximosTotal != null && usosTotalesActuales >= cupon.usosMaximosTotal) {
      return rechazo('El cupón se agotó (límite global alcanzado)');
    }

    // 4. Límite por cliente
    if (cupon.usosMaximosPorCliente != null && cupon.usosMaximosPorCliente > 0) {
      if (usosDelClienteActuales >= cupon.usosMaximosPorCliente) {
        return rechazo(
          cupon.usosMaximosPorCliente === 1
            ? 'Este cliente ya usó este cupón'
            : `Este cliente ya alcanzó el máximo de ${cupon.usosMaximosPorCliente} usos`,
        );
      }
    }

    // 5. Segmento
    const veredictoSegmento = this.evaluarSegmento(
      cupon.segmento,
      clienteIdSolicitante,
      clienteClasificacion,
      cupon.clientesElegiblesIds,
    );
    if (!veredictoSegmento.ok) return rechazo(veredictoSegmento.motivo);

    // 6. Aplicabilidad — qué items del carrito cuentan
    const itemsAplicables = this.filtrarItemsAplicables(carrito, cupon);
    if (itemsAplicables.length === 0) {
      const por =
        cupon.aplicableA === 'categorias'
          ? 'a las categorías incluidas'
          : cupon.aplicableA === 'productos'
            ? 'a los productos incluidos'
            : 'al carrito';
      return rechazo(`Ningún ítem del carrito aplica ${por}`);
    }

    const baseAplicable = itemsAplicables.reduce(
      (acc, i) => acc + i.precioUnitario * i.cantidad,
      0,
    );

    // 7. Monto mínimo
    if (cupon.montoMinimoCompra != null) {
      const totalCarrito = carrito.reduce(
        (acc, i) => acc + i.precioUnitario * i.cantidad,
        0,
      );
      const minimo = toNumber(cupon.montoMinimoCompra);
      if (totalCarrito < minimo) {
        const faltante = (minimo - totalCarrito).toFixed(2);
        return rechazo(`Falta S/ ${faltante} para alcanzar el mínimo de S/ ${minimo.toFixed(2)}`);
      }
    }

    // 8. Cálculo del descuento
    let descuento = 0;
    if (cupon.tipoDescuento === 'porcentaje') {
      const pct = toNumber(cupon.valorDescuento);
      descuento = redondear(baseAplicable * (pct / 100));
    } else {
      descuento = toNumber(cupon.valorDescuento);
    }

    // 9. Tope absoluto (descuentoMaximo solo aplica a porcentaje, pero por seguridad lo respetamos siempre)
    if (cupon.descuentoMaximo != null) {
      const tope = toNumber(cupon.descuentoMaximo);
      if (descuento > tope) descuento = tope;
    }

    // 10. No puede descontar más que la base aplicable
    if (descuento > baseAplicable) descuento = baseAplicable;
    if (descuento < 0) descuento = 0;

    return {
      valido: true,
      descuento: redondear(descuento),
      baseAplicable: redondear(baseAplicable),
      itemsAplicables: itemsAplicables.map(i => i.varianteId),
      mensaje: `Cupón aplicado: -S/ ${descuento.toFixed(2)}`,
    };
  }

  private evaluarSegmento(
    segmento: string,
    clienteId: string | undefined,
    clasificacion: string | null | undefined,
    clientesElegiblesIds: string[],
  ): { ok: true } | { ok: false; motivo: string } {
    switch (segmento) {
      case 'todos':
        return { ok: true };
      case 'vip_aa':
        if (clasificacion !== 'AA') return { ok: false, motivo: 'Cupón exclusivo de clientes VIP nivel AA' };
        return { ok: true };
      case 'vip_a':
        if (!clasificacion || !['AA', 'A'].includes(clasificacion)) {
          return { ok: false, motivo: 'Cupón exclusivo de clientes VIP nivel A o superior' };
        }
        return { ok: true };
      case 'vip_b':
        if (!clasificacion || !['AA', 'A', 'B'].includes(clasificacion)) {
          return { ok: false, motivo: 'Cupón exclusivo de clientes nivel B o superior' };
        }
        return { ok: true };
      case 'vip_c':
        if (!clasificacion || !['AA', 'A', 'B', 'C'].includes(clasificacion)) {
          return { ok: false, motivo: 'Cupón solo para clientes clasificados' };
        }
        return { ok: true };
      case 'lista_clientes':
        if (!clienteId) return { ok: false, motivo: 'Este cupón requiere identificar al cliente' };
        if (!clientesElegiblesIds.includes(clienteId)) {
          return { ok: false, motivo: 'Este cliente no está en la lista de elegibles' };
        }
        return { ok: true };
      case 'nuevos_clientes':
        // El service que invoca debe haber verificado totalCompras=0 al cargar — aquí confiamos.
        return { ok: true };
      case 'reactivacion':
        return { ok: true };
      default:
        return { ok: false, motivo: `Segmento desconocido: ${segmento}` };
    }
  }

  private filtrarItemsAplicables(
    carrito: ItemCarrito[],
    cupon: CuponEvaluable,
  ): ItemCarrito[] {
    if (cupon.aplicableA === 'toda_compra') return carrito;
    if (cupon.aplicableA === 'categorias') {
      const set = new Set(cupon.categoriasAplicablesIds);
      return carrito.filter(i => set.has(i.categoriaId));
    }
    if (cupon.aplicableA === 'productos') {
      const set = new Set(cupon.productosAplicablesIds);
      return carrito.filter(i => set.has(i.productoId));
    }
    return [];
  }
}

// ─── tipos públicos ────────────────────────────────────────────────────────

export interface ItemCarrito {
  varianteId: string;
  productoId: string;
  categoriaId: string;
  cantidad: number;
  precioUnitario: number;
}

export interface CuponEvaluable {
  estado: 'activo' | 'pausado' | 'expirado' | 'agotado';
  eliminadoEn: Date | null;
  fechaInicio: Date;
  fechaFin: Date;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: Prisma.Decimal | number;
  montoMinimoCompra: Prisma.Decimal | number | null;
  descuentoMaximo: Prisma.Decimal | number | null;
  usosMaximosTotal: number | null;
  usosMaximosPorCliente: number;
  segmento: string;
  clientesElegiblesIds: string[];
  aplicableA: 'toda_compra' | 'categorias' | 'productos';
  categoriasAplicablesIds: string[];
  productosAplicablesIds: string[];
}

export interface EvaluarCuponInput {
  cupon: CuponEvaluable;
  carrito: ItemCarrito[];
  clienteIdSolicitante?: string;
  clienteClasificacion?: 'AA' | 'A' | 'B' | 'C' | 'D' | null;
  usosTotalesActuales: number;
  usosDelClienteActuales: number;
  ahora?: Date;
}

export type EvaluarCuponResultado =
  | {
      valido: true;
      descuento: number;
      baseAplicable: number;
      itemsAplicables: string[];
      mensaje: string;
    }
  | { valido: false; descuento: 0; baseAplicable: 0; itemsAplicables: never[]; mensaje: string };

// ─── helpers ───────────────────────────────────────────────────────────────

function rechazo(mensaje: string): EvaluarCuponResultado {
  return { valido: false, descuento: 0, baseAplicable: 0, itemsAplicables: [], mensaje };
}

function toNumber(v: Prisma.Decimal | number): number {
  if (typeof v === 'number') return v;
  return Number(v.toString());
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
