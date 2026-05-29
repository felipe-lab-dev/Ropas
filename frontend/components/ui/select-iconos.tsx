'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OpcionIcono {
  valor: string;
  label: string;
  /** Nodo de ícono ya renderizado (lucide, svg inline, etc.). Usa `className="size-full"`. */
  icono?: React.ReactNode;
  /** Color de acento opcional para tintar el ícono. */
  color?: string;
}

export interface SelectIconosProps {
  id?: string;
  value: string;
  onValueChange: (valor: string) => void;
  opciones: OpcionIcono[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Select cerrado con ícono por opción, construido sobre Radix Select.
 * Sustituye al `<Select>` nativo cuando se quiere mostrar un ícono junto al
 * texto (categoría, género). Para listas con valores libres usar
 * `ComboboxCreable`.
 *
 * El trigger conserva `id` para que `useValidacionForm` pueda hacer focus/scroll
 * y FormField inyecte `aria-invalid` / `aria-describedby`.
 */
export function SelectIconos({
  id,
  value,
  onValueChange,
  opciones,
  placeholder = 'Seleccioná…',
  className,
  disabled,
  'data-testid': testid,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: SelectIconosProps) {
  const seleccionada = opciones.find((o) => o.valor === value);

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        data-testid={testid}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))]',
          'bg-[hsl(var(--surface))] pl-3.5 pr-3 py-2 text-sm text-left',
          'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
          'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15',
          'data-[state=open]:border-[hsl(var(--brand-primary))]/60',
          'disabled:cursor-not-allowed disabled:opacity-50 transition-all',
          'aria-[invalid=true]:border-[#ef4444]',
          className,
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {seleccionada?.icono && (
            <span
              className="shrink-0 inline-flex size-4 items-center justify-center"
              style={seleccionada.color ? { color: seleccionada.color } : undefined}
            >
              {seleccionada.icono}
            </span>
          )}
          <span className={cn('truncate', !seleccionada && 'text-[hsl(var(--text-muted))]')}>
            {seleccionada ? seleccionada.label : placeholder}
          </span>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-[hsl(var(--text-muted))]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl',
            'border border-[hsl(var(--border))] bg-[hsl(var(--surface))]',
            'shadow-[0_20px_60px_-10px_hsl(265_50%_4%/0.4)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          )}
        >
          <SelectPrimitive.Viewport className="p-1 scrollbar-thin">
            {opciones.map((o) => (
              <SelectPrimitive.Item
                key={o.valor}
                value={o.valor}
                className={cn(
                  'relative flex cursor-pointer select-none items-center gap-2 rounded-md py-2 pl-2.5 pr-8 text-sm outline-none',
                  'data-[highlighted]:bg-[hsl(var(--brand-primary))]/10 data-[highlighted]:text-[hsl(var(--brand-primary))]',
                  'data-[state=checked]:font-medium',
                )}
              >
                {o.icono && (
                  <span
                    className="shrink-0 inline-flex size-4 items-center justify-center"
                    style={o.color ? { color: o.color } : undefined}
                  >
                    {o.icono}
                  </span>
                )}
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
                  <Check className="size-4 text-[hsl(var(--brand-primary))]" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
