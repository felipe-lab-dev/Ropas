'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Icono opcional (componente ya instanciado, ej. `<Wallet className="size-3.5" />`). */
  icono?: React.ReactNode;
  /**
   * Override de las clases del estado ACTIVO solo para esta opción.
   * Útil para colores semánticos por opción (ej. verde para ingreso, rojo para egreso).
   * Si se omite, usa el activo por default (acento de marca).
   */
  activeClassName?: string;
  disabled?: boolean;
  title?: string;
}

type Size = 'sm' | 'md' | 'lg';

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** sm = compacto (selectores chicos, ej. moneda) · md = filtros · lg = toggle primario. */
  size?: Size;
  ariaLabel?: string;
  className?: string;
}

const SIZES: Record<Size, { container: string; btn: string }> = {
  sm: { container: 'p-0.5 rounded-md', btn: 'h-6 px-2 rounded text-[10px] font-bold' },
  md: { container: 'p-0.5 rounded-lg', btn: 'h-7 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide' },
  lg: { container: 'p-1 rounded-lg', btn: 'h-8 px-4 rounded-md text-xs font-bold uppercase tracking-widest' },
};

const ACTIVO_DEFAULT = 'bg-[hsl(var(--brand-accent))]/15 text-[hsl(var(--brand-accent))]';
const INACTIVO = 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]';

/**
 * Control segmentado para selección única (toggles y filtros): Ingresos/Egresos,
 * Todos/Físico/Virtual, selector de moneda, etc.
 *
 * NO es navegación entre rutas (para eso está `RouteTabs`) ni cambio de panel dentro
 * de una vista (para eso está el `Tabs` de shadcn). Esto togglea ESTADO.
 *
 * Genérico sobre el tipo del valor (`T extends string`), así `value`/`onChange` quedan
 * tipados sin `any`.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40',
        SIZES[size].container,
        className,
      )}
    >
      {options.map((opt) => {
        const activo = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap transition-all',
              'disabled:cursor-not-allowed disabled:opacity-40',
              SIZES[size].btn,
              activo ? opt.activeClassName ?? ACTIVO_DEFAULT : INACTIVO,
            )}
          >
            {opt.icono}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
