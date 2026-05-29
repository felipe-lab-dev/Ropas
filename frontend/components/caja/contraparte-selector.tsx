'use client';

import * as React from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LinkWhatsApp } from '@/components/ui/link-whatsapp';
import { obtener, obtenerPaginado, mensajeError } from '@/lib/api/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tipo = 'cliente' | 'proveedor' | 'empleado' | 'otro';

interface SeleccionContraparte {
  nombre: string;
  documento?: string;
  id?: string;
  telefono?: string;
}

interface Props {
  tipo: Tipo;
  valor: SeleccionContraparte | null;
  onChange: (v: SeleccionContraparte | null) => void;
}

interface ClienteApi {
  id: string;
  nombre: string;
  documento?: string | null;
  telefono?: string | null;
}

interface ProveedorApi {
  id: string;
  razonSocial: string;
  documento: string;
  telefono?: string | null;
}

interface RucData {
  ruc: string;
  razonSocial: string;
  telefono?: string | null;
}

interface DniData {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

const LABELS: Record<Tipo, { label: string; placeholder: string }> = {
  cliente: { label: 'Cliente', placeholder: 'Nombre, DNI/RUC del cliente…' },
  proveedor: { label: 'Proveedor', placeholder: 'Razón social, RUC del proveedor…' },
  empleado: { label: 'Empleado', placeholder: 'Nombre del empleado…' },
  otro: { label: 'Origen / destino', placeholder: 'Nombre libre (opcional)' },
};

export function ContraparteSelector({ tipo, valor, onChange }: Props) {
  const [buscar, setBuscar] = React.useState('');
  const [consultandoSunat, setConsultandoSunat] = React.useState(false);
  const meta = LABELS[tipo];
  const debounced = useDebounced(buscar, 280);

  // Búsqueda en BD local
  const busquedaQ = useQuery({
    queryKey: ['contraparte-busqueda', tipo, debounced],
    queryFn: async () => {
      if (debounced.length < 2) return [];
      if (tipo === 'cliente') {
        const res = await obtenerPaginado<ClienteApi>(`/clientes`, { buscar: debounced, limite: 8 });
        return res.datos.map(c => ({
          id: c.id,
          nombre: c.nombre,
          documento: c.documento ?? undefined,
          telefono: c.telefono ?? undefined,
        }));
      }
      if (tipo === 'proveedor') {
        const res = await obtenerPaginado<ProveedorApi>(`/proveedores`, { buscar: debounced, limite: 8 });
        return res.datos.map(p => ({
          id: p.id,
          nombre: p.razonSocial,
          documento: p.documento,
          telefono: p.telefono ?? undefined,
        }));
      }
      return [];
    },
    enabled: debounced.length >= 2 && (tipo === 'cliente' || tipo === 'proveedor') && !valor,
    staleTime: 30_000,
  });

  // Empleado y "otro" se manejan como texto libre porque hoy no hay endpoint público de usuarios
  if (tipo === 'otro' || tipo === 'empleado') {
    return (
      <div className="space-y-2">
        <Label htmlFor="cp-libre">{meta.label} (opcional)</Label>
        <Input
          id="cp-libre"
          placeholder={meta.placeholder}
          value={valor?.nombre ?? ''}
          onChange={e => onChange(e.target.value ? { nombre: e.target.value } : null)}
        />
      </div>
    );
  }

  // Si ya hay selección → mostrar chip
  if (valor) {
    return (
      <div className="space-y-2">
        <Label>{meta.label}</Label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[hsl(var(--brand-accent))]/30 bg-[hsl(var(--brand-accent))]/8">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{valor.nombre}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
              {valor.documento && (
                <span className="text-[11px] font-mono text-[hsl(var(--text-muted))]">{valor.documento}</span>
              )}
              {valor.telefono && <LinkWhatsApp telefono={valor.telefono} className="text-[11px]" />}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              onChange(null);
              setBuscar('');
            }}
            title="Quitar selección"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  const consultarJsonpe = async () => {
    const doc = buscar.trim();
    setConsultandoSunat(true);
    try {
      if (/^\d{11}$/.test(doc)) {
        const datos = await obtener<RucData>(`/utilidades/ruc/${doc}`);
        onChange({
          nombre: datos.razonSocial,
          documento: datos.ruc,
          telefono: datos.telefono ?? undefined,
        });
        toast.success('Datos obtenidos de SUNAT');
      } else if (/^\d{8}$/.test(doc)) {
        const datos = await obtener<DniData>(`/utilidades/dni/${doc}`);
        const nombre = `${datos.nombres} ${datos.apellidoPaterno} ${datos.apellidoMaterno}`.trim();
        onChange({ nombre, documento: datos.dni });
        toast.success('Datos obtenidos de RENIEC');
      } else {
        toast.error('Ingresa un RUC (11 dígitos) o DNI (8 dígitos)');
      }
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setConsultandoSunat(false);
    }
  };

  const resultados = busquedaQ.data ?? [];
  const cargando = busquedaQ.isFetching || consultandoSunat;
  const esDocConsultable = /^\d{8}$|^\d{11}$/.test(buscar.trim());

  return (
    <div className="space-y-2">
      <Label htmlFor="cp-buscar">{meta.label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))] pointer-events-none" />
        <Input
          id="cp-buscar"
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder={meta.placeholder}
          className="pl-9"
          autoComplete="off"
        />
        {cargando && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-[hsl(var(--text-muted))]" />
        )}
      </div>

      {buscar.length >= 2 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 divide-y divide-[hsl(var(--border))] overflow-hidden">
          {resultados.map(r => (
            <button
              type="button"
              key={r.id}
              onClick={() => onChange(r)}
              className="w-full text-left px-3 py-2 hover:bg-[hsl(var(--brand-accent))]/8 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium truncate">{r.nombre}</span>
                {r.documento && (
                  <span className="text-[11px] font-mono text-[hsl(var(--text-muted))] shrink-0">
                    {r.documento}
                  </span>
                )}
              </div>
            </button>
          ))}

          {!cargando && resultados.length === 0 && (
            <div className="px-3 py-2 text-xs text-[hsl(var(--text-muted))] text-center">
              Sin resultados en base local
            </div>
          )}

          {esDocConsultable && (
            <button
              type="button"
              disabled={consultandoSunat}
              onClick={consultarJsonpe}
              className={cn(
                'w-full text-left px-3 py-2 text-xs font-semibold transition-colors',
                'text-[hsl(var(--brand-accent))] hover:bg-[hsl(var(--brand-accent))]/8 disabled:opacity-40',
              )}
            >
              {consultandoSunat
                ? 'Consultando…'
                : `🔍 Consultar ${buscar.length === 11 ? 'SUNAT' : 'RENIEC'} y usar “${buscar}”`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
