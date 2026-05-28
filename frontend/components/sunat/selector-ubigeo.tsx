'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronsUpDown, Check, Loader2, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api/client';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Ubigeo {
  codigo: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

export interface SelectorUbigeoProps {
  value: string | undefined;
  onChange: (codigo: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

// ─── API call con TanStack Query ──────────────────────────────────────────────

async function buscarUbigeos(q: string): Promise<Ubigeo[]> {
  const { data } = await api.get<{ datos: Ubigeo[] }>('/catalogos/ubigeos', {
    params: { q, limite: 20 },
  });
  return data.datos;
}

async function obtenerUbigeo(codigo: string): Promise<Ubigeo[]> {
  const { data } = await api.get<{ datos: Ubigeo[] }>('/catalogos/ubigeos', {
    params: { q: codigo, limite: 1 },
  });
  return data.datos;
}

function etiquetaUbigeo(u: Ubigeo) {
  return `${u.codigo} — ${u.distrito} / ${u.provincia} / ${u.departamento}`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SelectorUbigeo({
  value,
  onChange,
  placeholder = 'Seleccionar ubigeo...',
  disabled = false,
}: SelectorUbigeoProps) {
  const [abierto, setAbierto] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState('');
  const [debouncedBusqueda, setDebouncedBusqueda] = React.useState('');

  // Debounce 200ms
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedBusqueda(busqueda), 200);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Búsqueda principal
  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ['ubigeos', debouncedBusqueda] as const,
    queryFn: () =>
      debouncedBusqueda.trim()
        ? buscarUbigeos(debouncedBusqueda)
        : buscarUbigeos(''),
    staleTime: Infinity,
    enabled: abierto,
  });

  // Cargar el ubigeo seleccionado para mostrar la etiqueta
  const { data: ubigeoSeleccionado, isFetching: cargandoSeleccionado } = useQuery({
    queryKey: ['ubigeos', 'selected', value] as const,
    queryFn: () => (value ? obtenerUbigeo(value) : Promise.resolve([])),
    staleTime: 5 * 60_000,
    refetchOnMount: 'always',
    enabled: !!value,
    select: (data) => data.find((u) => u.codigo === value),
  });

  const etiquetaActual = ubigeoSeleccionado
    ? etiquetaUbigeo(ubigeoSeleccionado)
    : value && cargandoSeleccionado
    ? `Cargando ${value}...`
    : value
    ? value
    : placeholder;

  return (
    <PopoverPrimitive.Root open={abierto} onOpenChange={setAbierto}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={abierto}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-[hsl(var(--border))]',
            'bg-[hsl(var(--surface))] px-3.5 py-2 text-sm text-left',
            'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
            'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all hover:border-[hsl(var(--brand-primary))]/40',
            !value && 'text-[hsl(var(--text-muted))]',
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <MapPin className="size-3.5 shrink-0 text-[hsl(var(--brand-primary))]" />
            <span className="truncate">{etiquetaActual}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[hsl(var(--text-muted))]" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={cn(
            'z-50 w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-xl border border-[hsl(var(--border))]',
            'bg-[hsl(var(--surface))] shadow-[0_20px_60px_-10px_hsl(265_50%_4%/0.4)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          )}
          sideOffset={4}
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar departamento, provincia o distrito..."
              value={busqueda}
              onValueChange={setBusqueda}
            />
            <CommandList>
              {isFetching && (
                <div className="flex items-center justify-center py-4 text-sm text-[hsl(var(--text-muted))]">
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Buscando...
                </div>
              )}
              {!isFetching && resultados.length === 0 && (
                <CommandEmpty>
                  {debouncedBusqueda
                    ? `Sin resultados para "${debouncedBusqueda}"`
                    : 'Escribe para buscar...'}
                </CommandEmpty>
              )}
              {!isFetching && resultados.length > 0 && (
                <CommandGroup>
                  {resultados.map((u) => (
                    <CommandItem
                      key={u.codigo}
                      value={u.codigo}
                      onSelect={() => {
                        onChange(u.codigo === value ? undefined : u.codigo);
                        setAbierto(false);
                        setBusqueda('');
                      }}
                    >
                      <Check
                        className={cn(
                          'size-4 shrink-0 transition-opacity',
                          value === u.codigo ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex flex-col min-w-0">
                        <span className="font-medium text-xs text-[hsl(var(--text-muted))]">
                          {u.codigo}
                        </span>
                        <span className="text-sm truncate">
                          {u.distrito} — {u.provincia} / {u.departamento}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
