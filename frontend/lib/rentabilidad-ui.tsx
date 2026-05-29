import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatearMoneda } from '@/lib/utils';

export type NivelRentabilidad =
  | 'saludable'
  | 'aceptable'
  | 'bajo'
  | 'perdida'
  | 'sin_datos'
  | 'parcial';

/** Rentabilidad agregada de una venta (espejo del backend). */
export interface RentabilidadVenta {
  ingresoNeto: number;
  costoTotal: number;
  ganancia: number;
  margenPct: number | null;
  markupPct: number | null;
  itemsTotal: number;
  itemsConCosto: number;
  confiable: boolean;
  nivel: NivelRentabilidad;
}

/** Rentabilidad de una línea de detalle (espejo del backend). */
export interface RentabilidadItem {
  costoUnitario: number | null;
  ingreso: number;
  costoTotal: number;
  ganancia: number | null;
  margenPct: number | null;
  nivel: NivelRentabilidad;
}

export const NIVEL_LABEL: Record<NivelRentabilidad, string> = {
  saludable: 'Saludable',
  aceptable: 'Aceptable',
  bajo: 'Bajo',
  perdida: 'Pérdida',
  sin_datos: 'Sin datos',
  parcial: 'Parcial',
};

/** Clases de color por nivel (theme-safe: light + dark). */
const NIVEL_CLASE: Record<NivelRentabilidad, string> = {
  saludable: 'border-transparent bg-[hsl(150_55%_42%/0.15)] text-[hsl(150_60%_40%)] dark:text-[hsl(150_65%_60%)]',
  aceptable: 'border-transparent bg-[hsl(45_90%_50%/0.16)] text-[hsl(40_90%_42%)] dark:text-[hsl(45_95%_62%)]',
  bajo: 'border-transparent bg-[hsl(25_90%_55%/0.16)] text-[hsl(22_90%_48%)] dark:text-[hsl(28_95%_62%)]',
  perdida: 'border-transparent bg-[hsl(355_75%_55%/0.15)] text-[hsl(355_75%_50%)] dark:text-[hsl(355_85%_68%)]',
  parcial: 'border-[hsl(45_90%_50%/0.4)] bg-[hsl(45_90%_50%/0.08)] text-[hsl(40_85%_42%)] dark:text-[hsl(45_90%_62%)]',
  sin_datos: 'border-[hsl(var(--border))] bg-transparent text-[hsl(var(--text-muted))]',
};

/** "+40%" / "−20%" / "—" */
export function formatearMargen(pct: number | null): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return '—';
  const signo = pct >= 0 ? '+' : '−';
  return `${signo}${Math.abs(Math.round(pct))}%`;
}

/** Texto de desglose para el atributo title (tooltip nativo). */
export function tooltipRentabilidad(r: RentabilidadVenta): string {
  if (r.nivel === 'sin_datos') {
    return 'Sin costo registrado: no se puede calcular la rentabilidad de esta venta.';
  }
  const partes = [
    `Margen ${formatearMargen(r.margenPct)}`,
    r.markupPct !== null ? `Markup ${formatearMargen(r.markupPct)}` : null,
    `Ingreso neto ${formatearMoneda(r.ingresoNeto)}`,
    `Costo ${formatearMoneda(r.costoTotal)}`,
    `Ganancia ${formatearMoneda(r.ganancia)}`,
    `Cobertura ${r.itemsConCosto}/${r.itemsTotal} ítems con costo`,
  ].filter(Boolean);
  return partes.join(' · ');
}

/**
 * Chip de rentabilidad por venta o por línea. Muestra el % de margen con color
 * por nivel; en `parcial` agrega un triángulo de aviso (costos incompletos).
 */
export function BadgeRentabilidad({
  nivel,
  margenPct,
  title,
  className,
}: {
  nivel: NivelRentabilidad;
  margenPct: number | null;
  title?: string;
  className?: string;
}) {
  const esParcial = nivel === 'parcial';
  return (
    <Badge
      className={cn('gap-1 tabular-nums', NIVEL_CLASE[nivel], className)}
      title={title ?? NIVEL_LABEL[nivel]}
    >
      {esParcial && <AlertTriangle className="size-3 shrink-0" />}
      {nivel === 'sin_datos' ? '—' : formatearMargen(margenPct)}
    </Badge>
  );
}
