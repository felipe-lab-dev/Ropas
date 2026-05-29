'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import type { OpcionIcono } from '@/components/ui/select-iconos';

export interface ComboboxCreableProps {
  id?: string;
  value: string;
  onChange: (valor: string) => void;
  /** Opciones predefinidas con ícono. El usuario igual puede escribir una propia. */
  opciones: OpcionIcono[];
  /** Ícono que se muestra junto a un valor custom (no presente en opciones). */
  iconoFallback?: React.ReactNode;
  placeholder?: string;
  placeholderBuscar?: string;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Combobox creable: lista de opciones con ícono + permite escribir un valor
 * libre (creatable). El valor seleccionado/escrito se devuelve como string.
 * Construido sobre Radix Popover + cmdk, mismo patrón que `SelectorUbigeo`.
 */
export function ComboboxCreable({
  id,
  value,
  onChange,
  opciones,
  iconoFallback,
  placeholder = 'Seleccioná o escribí…',
  placeholderBuscar = 'Buscar o escribir…',
  className,
  disabled,
  'data-testid': testid,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
}: ComboboxCreableProps) {
  const [abierto, setAbierto] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState('');

  const valorNorm = value.trim().toLowerCase();
  const seleccionada = opciones.find((o) => o.valor.toLowerCase() === valorNorm);
  const iconoActual = seleccionada?.icono ?? (value.trim() ? iconoFallback : undefined);

  const q = busqueda.trim();
  const yaExiste =
    opciones.some((o) => o.label.toLowerCase() === q.toLowerCase()) ||
    q.toLowerCase() === valorNorm;

  const elegir = (valorElegido: string) => {
    onChange(valorElegido);
    setAbierto(false);
    setBusqueda('');
  };

  return (
    <PopoverPrimitive.Root open={abierto} onOpenChange={setAbierto}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={abierto}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          data-testid={testid}
          disabled={disabled}
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
            {iconoActual && (
              <span
                className="shrink-0 inline-flex size-4 items-center justify-center"
                style={seleccionada?.color ? { color: seleccionada.color } : undefined}
              >
                {iconoActual}
              </span>
            )}
            <span className={cn('truncate', !value.trim() && 'text-[hsl(var(--text-muted))]')}>
              {value.trim() || placeholder}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[hsl(var(--text-muted))]" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={4}
          align="start"
          className={cn(
            'z-50 w-[var(--radix-popover-trigger-width)] min-w-[220px] rounded-xl border border-[hsl(var(--border))]',
            'bg-[hsl(var(--surface))] shadow-[0_20px_60px_-10px_hsl(265_50%_4%/0.4)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          )}
        >
          <Command>
            <CommandInput
              placeholder={placeholderBuscar}
              value={busqueda}
              onValueChange={setBusqueda}
            />
            <CommandList>
              {q && !yaExiste && (
                <CommandGroup>
                  <CommandItem value={`__crear__ ${q}`} onSelect={() => elegir(q)}>
                    <Plus className="size-4 shrink-0 text-[hsl(var(--brand-primary))]" />
                    <span>
                      Usar «<span className="font-medium">{q}</span>»
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandEmpty>Escribí un valor y presioná Enter.</CommandEmpty>
              <CommandGroup>
                {opciones.map((o) => (
                  <CommandItem key={o.valor} value={o.label} onSelect={() => elegir(o.valor)}>
                    {o.icono && (
                      <span
                        className="shrink-0 inline-flex size-4 items-center justify-center"
                        style={o.color ? { color: o.color } : undefined}
                      >
                        {o.icono}
                      </span>
                    )}
                    <span className="flex-1 truncate">{o.label}</span>
                    <Check
                      className={cn(
                        'size-4 shrink-0 transition-opacity',
                        o.valor.toLowerCase() === valorNorm ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
