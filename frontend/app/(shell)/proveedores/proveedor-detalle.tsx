'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  PackageCheck,
  Loader2,
  AlertTriangle,
  Pencil,
  ChevronRight,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { obtener, obtenerPaginado } from '@/lib/api/client';
import { formatearMoneda, formatearFecha } from '@/lib/utils';
import { LinkWhatsApp } from '@/components/ui/link-whatsapp';

interface Proveedor {
  id: string;
  codigo?: string | null;
  razonSocial: string;
  nombreComercial?: string | null;
  tipoDocumento: string;
  documento: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  condicionPago: string;
  diasCredito: number;
  cuentaBancaria?: string | null;
  notas?: string | null;
  tags?: string[];
  totalComprado: string;
  deudaActual: string;
  activo: boolean;
}

interface CompraHistorial {
  id: string;
  numero: string;
  serie: string;
  numeroComprobante: string;
  fechaEmision: string;
  moneda: string;
  total: string;
  estado: 'borrador' | 'recibida' | 'anulada';
  estadoPago: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
}

const CONDICION_LABEL: Record<string, string> = {
  contado: 'Contado',
  credito_15: '15 días',
  credito_30: '30 días',
  credito_60: '60 días',
  credito_otro: 'Otro',
};

interface ProveedorDetalleProps {
  proveedorId: string;
  /** Abre el formulario de edición (modal existente de la lista). */
  onEditar: (id: string) => void;
}

export function ProveedorDetalle({ proveedorId, onEditar }: ProveedorDetalleProps) {
  const { data: p, isLoading, isError } = useQuery({
    queryKey: ['proveedor', proveedorId],
    queryFn: () => obtener<Proveedor>(`/proveedores/${proveedorId}`),
  });

  const { data: compras } = useQuery({
    queryKey: ['proveedor-compras', proveedorId],
    queryFn: () => obtenerPaginado<CompraHistorial>('/compras', { proveedorId, limite: 6 }),
    enabled: !!proveedorId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="size-6 animate-spin text-[hsl(var(--brand-primary))]" />
      </div>
    );
  }
  if (isError || !p) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="size-10 mx-auto text-[hsl(var(--brand-warning))] mb-3" />
        <p className="font-medium">No se pudo cargar el proveedor</p>
      </div>
    );
  }

  const deuda = Number(p.deudaActual);
  const historial = compras?.datos ?? [];

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Hero */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold tracking-tight">{p.razonSocial}</h2>
        {p.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}
        {p.codigo && <Badge variant="outline" className="font-mono text-[10px]">{p.codigo}</Badge>}
        <span className="text-xs text-[hsl(var(--text-muted))] w-full font-mono">
          {p.tipoDocumento.toUpperCase()} {p.documento}
          {p.nombreComercial && <span className="font-sans"> · {p.nombreComercial}</span>}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Total comprado</p>
          <p className="text-xl font-black tracking-tight tabular-nums mt-1">{formatearMoneda(p.totalComprado)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Deuda actual</p>
          <p className={`text-xl font-black tracking-tight tabular-nums mt-1 ${deuda > 0 ? 'text-[hsl(355_75%_60%)]' : ''}`}>
            {formatearMoneda(p.deudaActual)}
          </p>
        </Card>
      </div>

      {/* Contacto */}
      <Card className="p-4 space-y-4 text-sm">
        <div className="flex items-start gap-3">
          <Building2 className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Contacto</p>
            <p className="font-medium">{p.contacto || <span className="text-[hsl(var(--text-muted))]">—</span>}</p>
            <div className="mt-1"><LinkWhatsApp telefono={p.telefono} className="text-sm" /></div>
          </div>
        </div>
        {p.email && (
          <div className="flex items-start gap-3">
            <Mail className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Email</p>
              <a href={`mailto:${p.email}`} className="text-[hsl(var(--brand-primary))] hover:underline break-all">{p.email}</a>
            </div>
          </div>
        )}
        {(p.direccion || p.ciudad) && (
          <div className="flex items-start gap-3">
            <MapPin className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Dirección</p>
              <p className="font-medium">{[p.direccion, p.ciudad].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Condiciones comerciales */}
      <Card className="p-4 space-y-4 text-sm">
        <div className="flex items-start gap-3">
          <CreditCard className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Condición de pago</p>
            <Badge variant={p.condicionPago === 'contado' ? 'default' : 'warning'}>
              {CONDICION_LABEL[p.condicionPago] ?? p.condicionPago}
              {p.condicionPago !== 'contado' && p.diasCredito > 0 ? ` · ${p.diasCredito}d` : ''}
            </Badge>
          </div>
        </div>
        {p.cuentaBancaria && (
          <div className="flex items-start gap-3">
            <FileText className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Cuenta bancaria</p>
              <p className="font-mono text-xs">{p.cuentaBancaria}</p>
            </div>
          </div>
        )}
        {p.tags && p.tags.length > 0 && (
          <div className="flex items-start gap-3">
            <Tag className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Tags</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {p.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            </div>
          </div>
        )}
      </Card>

      {p.notas && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-2">Notas</p>
          <p className="text-sm whitespace-pre-line">{p.notas}</p>
        </Card>
      )}

      {/* Historial de compras */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <PackageCheck className="size-4" />
          <h3 className="font-semibold text-sm">Compras recientes</h3>
        </div>
        {historial.length === 0 ? (
          <div className="p-5 text-sm text-[hsl(var(--text-muted))] text-center">
            Aún no hay compras registradas a este proveedor.
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {historial.map(c => (
              <li key={c.id}>
                <Link
                  href={`/compras?ver=${c.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[hsl(var(--surface-2))]/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold">{c.numero}</p>
                    <p className="text-[11px] text-[hsl(var(--text-muted))] font-mono truncate">
                      {c.serie}-{c.numeroComprobante} · {formatearFecha(c.fechaEmision)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={c.estado === 'anulada' ? 'danger' : c.estadoPago === 'pagada' ? 'success' : 'warning'}
                      className="text-[10px]"
                    >
                      {c.estado === 'anulada' ? 'anulada' : c.estadoPago}
                    </Badge>
                    <span className="font-bold tabular-nums text-sm">{formatearMoneda(c.total, c.moneda)}</span>
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
        <Button variant="outline" size="sm" onClick={() => onEditar(p.id)}>
          <Pencil className="size-4" /> Editar
        </Button>
      </div>
    </div>
  );
}
