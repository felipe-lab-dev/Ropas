'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  Loader2,
  AlertTriangle,
  Pencil,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { obtener, obtenerPaginado } from '@/lib/api/client';
import { formatearMoneda, formatearFecha, iniciales } from '@/lib/utils';

type Clase = 'AA' | 'A' | 'B' | 'C' | 'D';

const COLORES_CLASE: Record<Clase, { base: string; suave: string }> = {
  AA: { base: '#8b5cf6', suave: 'rgba(139,92,246,0.12)' },
  A: { base: '#0ea5e9', suave: 'rgba(14,165,233,0.12)' },
  B: { base: '#22c55e', suave: 'rgba(34,197,94,0.12)' },
  C: { base: '#f59e0b', suave: 'rgba(245,158,11,0.12)' },
  D: { base: '#94a3b8', suave: 'rgba(148,163,184,0.12)' },
};
const CLASE_LABEL: Record<Clase, string> = {
  AA: 'VIP', A: 'Top', B: 'Sólidos', C: 'Ocasionales', D: 'Fríos / sin compras',
};

interface ClienteDetalle {
  id: string;
  codigo?: string | null;
  nombre: string;
  documento?: string | null;
  tipoDocumento: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  totalCompras: string;
  ultimaCompraEn?: string | null;
  clasificacion: Clase | null;
}

interface VentaHistorial {
  id: string;
  numero: string;
  creadoEn: string;
  total: string;
  estado: 'borrador' | 'confirmada' | 'pagada' | 'parcial' | 'anulada';
}

const ESTADO_BADGE = {
  borrador: 'outline',
  confirmada: 'default',
  pagada: 'success',
  parcial: 'warning',
  anulada: 'danger',
} as const;

export function ClienteDetalle({ clienteId }: { clienteId: string }) {
  const { data: c, isLoading, isError } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => obtener<ClienteDetalle>(`/clientes/${clienteId}`),
  });

  const { data: ventas } = useQuery({
    queryKey: ['cliente-ventas', clienteId],
    queryFn: () => obtenerPaginado<VentaHistorial>('/ventas', { clienteId, limite: 6 }),
    enabled: !!clienteId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="size-6 animate-spin text-[hsl(var(--brand-primary))]" />
      </div>
    );
  }
  if (isError || !c) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="size-10 mx-auto text-[hsl(var(--brand-warning))] mb-3" />
        <p className="font-medium">No se pudo cargar el cliente</p>
      </div>
    );
  }

  const cc = c.clasificacion ? COLORES_CLASE[c.clasificacion] : null;
  const historial = ventas?.datos ?? [];

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <div className="size-11 shrink-0 rounded-full bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] grid place-items-center text-white text-sm font-bold">
          {iniciales(c.nombre)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight truncate">{c.nombre}</h2>
            {c.clasificacion && cc && (
              <span
                className="inline-block px-1.5 py-0.5 rounded-md text-[11px] font-bold border"
                style={{ background: cc.suave, color: cc.base, borderColor: `${cc.base}40` }}
                title={`Clase ${c.clasificacion} — ${CLASE_LABEL[c.clasificacion]}`}
              >
                {c.clasificacion} · {CLASE_LABEL[c.clasificacion]}
              </span>
            )}
          </div>
          <p className="text-xs text-[hsl(var(--text-muted))] font-mono">
            {c.documento ? `${c.tipoDocumento.toUpperCase()} ${c.documento}` : 'Sin documento'}
            {c.codigo && <span className="font-sans"> · {c.codigo}</span>}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Total compras</p>
          <p className="text-xl font-black tracking-tight tabular-nums mt-1">{formatearMoneda(c.totalCompras)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Última compra</p>
          <p className="text-sm font-medium mt-1">
            {c.ultimaCompraEn ? formatearFecha(c.ultimaCompraEn, 'completa') : 'Sin compras'}
          </p>
        </Card>
      </div>

      {/* Contacto */}
      <Card className="p-4 space-y-4 text-sm">
        <div className="flex items-start gap-3">
          <Phone className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Teléfono</p>
            <p className="font-medium">{c.telefono || <span className="text-[hsl(var(--text-muted))]">—</span>}</p>
          </div>
        </div>
        {c.email && (
          <div className="flex items-start gap-3">
            <Mail className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Email</p>
              <a href={`mailto:${c.email}`} className="text-[hsl(var(--brand-primary))] hover:underline break-all">{c.email}</a>
            </div>
          </div>
        )}
        {(c.direccion || c.ciudad) && (
          <div className="flex items-start gap-3">
            <MapPin className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Dirección</p>
              <p className="font-medium">{[c.direccion, c.ciudad].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Historial de compras */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <ShoppingBag className="size-4" />
          <h3 className="font-semibold text-sm">Compras recientes</h3>
        </div>
        {historial.length === 0 ? (
          <div className="p-5 text-sm text-[hsl(var(--text-muted))] text-center">
            Este cliente todavía no tiene compras registradas.
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {historial.map(v => (
              <li key={v.id}>
                <Link
                  href={`/ventas?ver=${v.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[hsl(var(--surface-2))]/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold">{v.numero}</p>
                    <p className="text-[11px] text-[hsl(var(--text-muted))]">{formatearFecha(v.creadoEn, 'corta')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={ESTADO_BADGE[v.estado]} className="text-[10px]">{v.estado}</Badge>
                    <span className="font-bold tabular-nums text-sm">{formatearMoneda(v.total)}</span>
                    <ChevronRight className="size-4 text-[hsl(var(--text-muted))]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Barra de acciones fija al pie del drawer */}
      <div
        className="no-print sticky bottom-0 -mx-4 sm:-mx-5 -mb-5 mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface))]/95 px-4 sm:px-5 py-3 backdrop-blur"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Button asChild variant="outline" size="sm">
          <Link href={`/clientes/editar/?id=${c.id}`}>
            <Pencil className="size-4" /> Editar
          </Link>
        </Button>
      </div>
    </div>
  );
}
