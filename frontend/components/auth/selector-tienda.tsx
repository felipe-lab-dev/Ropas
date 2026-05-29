'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronsUpDown, Check, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import type { TiendaResumen } from '@/lib/branding';

export interface SelectorTiendaProps {
  id?: string;
  /** Código de la tienda seleccionada. */
  value: string;
  onChange: (codigo: string) => void;
  tiendas: TiendaResumen[];
  /** Nombre legible de la tienda actual (cae al código si no se conoce). */
  nombreActual?: string | null;
  disabled?: boolean;
}

/**
 * Selector de tienda para el login — estilo Velarde (combobox/popover). Solo se
 * muestra en localhost/staging; en producción el subdominio fija el tenant y el
 * selector queda oculto.
 */
export function SelectorTienda({
  id,
  value,
  onChange,
  tiendas,
  nombreActual,
  disabled,
}: SelectorTiendaProps) {
  const [abierto, setAbierto] = React.useState(false);
  const valorNorm = value.trim().toLowerCase();
  const etiqueta = nombreActual?.trim() || value.trim() || 'Selecciona una tienda';

  const elegir = (codigo: string) => {
    onChange(codigo);
    setAbierto(false);
  };

  return (
    <PopoverPrimitive.Root open={abierto} onOpenChange={setAbierto}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={abierto}
          disabled={disabled}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))]',
            'bg-[hsl(var(--surface))] pl-10 pr-3 py-2 text-sm text-left relative',
            'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
            'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15',
            'data-[state=open]:border-[hsl(var(--brand-primary))]/60',
            'disabled:cursor-not-allowed disabled:opacity-50 transition-all',
          )}
        >
          <Store className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <span className={cn('truncate flex-1', !value.trim() && 'text-[hsl(var(--text-muted))]')}>
            {etiqueta}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[hsl(var(--text-muted))]" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={4}
          align="start"
          className={cn(
            'z-50 w-[var(--radix-popover-trigger-width)] min-w-[240px] rounded-xl border border-[hsl(var(--border))]',
            'bg-[hsl(var(--surface))] shadow-[0_20px_60px_-10px_hsl(265_50%_4%/0.4)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          )}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
            <span className="text-[11px] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wider">
              Tiendas disponibles
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--brand-primary))]">
              DEV
            </span>
          </div>
          <Command>
            {tiendas.length > 6 && <CommandInput placeholder="Buscar tienda…" />}
            <CommandList>
              <CommandEmpty>No hay tiendas disponibles.</CommandEmpty>
              <CommandGroup>
                {tiendas.map((t) => (
                  <CommandItem key={t.codigo} value={`${t.nombre} ${t.codigo}`} onSelect={() => elegir(t.codigo)}>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="truncate font-medium">{t.nombre}</span>
                      <span className="truncate text-[11px] text-[hsl(var(--text-muted))] font-mono">{t.codigo}</span>
                    </span>
                    <Check
                      className={cn(
                        'size-4 shrink-0 transition-opacity',
                        t.codigo.toLowerCase() === valorNorm ? 'opacity-100' : 'opacity-0',
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
