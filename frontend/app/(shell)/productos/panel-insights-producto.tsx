'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Upload, Trash2, TrendingUp, TrendingDown, Package, DollarSign, BarChart3 } from 'lucide-react';
import { obtener, subirArchivos, eliminar, mensajeError } from '@/lib/api/client';
import { formatearMoneda, formatearNumero } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface InsightsProducto {
  rotacion: {
    diasCobertura: number | null;
    stockTotal: number;
    ventasDiariasPromedio: number;
    claseAbc: 'AA' | 'A' | 'B' | 'C' | 'D' | null;
    score: number | null;
    clasificadoEn: string | null;
  };
  ventas: {
    ultimos30d: { unidades: number; monto: number };
    ultimos90d: { unidades: number; monto: number };
  };
  margen: {
    precioVenta: number;
    precioCompra: number | null;
    margenPct: number | null;
    moneda: string;
    historico: Array<{ fecha: string; precioVenta: number }>;
  };
}

interface Props {
  productoId: string;
  imagenes: string[];
  nombre: string;
}

const COLORES_CLASE: Record<'AA' | 'A' | 'B' | 'C' | 'D', { base: string; suave: string }> = {
  AA: { base: '#8b5cf6', suave: 'rgba(139,92,246,0.15)' },
  A:  { base: '#0ea5e9', suave: 'rgba(14,165,233,0.15)' },
  B:  { base: '#22c55e', suave: 'rgba(34,197,94,0.15)' },
  C:  { base: '#f59e0b', suave: 'rgba(245,158,11,0.15)' },
  D:  { base: '#94a3b8', suave: 'rgba(148,163,184,0.15)' },
};

function etiquetaCobertura(dias: number | null): { texto: string; color: string } {
  if (dias === null) return { texto: 'Sin ventas', color: '#94a3b8' };
  if (dias <= 14) return { texto: 'Alta rotación', color: '#10b981' };
  if (dias <= 45) return { texto: 'Rotación normal', color: '#0ea5e9' };
  if (dias <= 90) return { texto: 'Lenta', color: '#f59e0b' };
  return { texto: 'Estancado', color: '#ef4444' };
}

function MiniSparkline({ puntos, color = '#0ea5e9' }: { puntos: number[]; color?: string }) {
  if (puntos.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...puntos);
  const max = Math.max(...puntos);
  const rango = max - min || 1;
  const path = puntos
    .map((p, i) => {
      const x = (i / (puntos.length - 1)) * w;
      const y = h - ((p - min) / rango) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PanelInsightsProducto({ productoId, imagenes, nombre }: Props) {
  const [indiceImagen, setIndiceImagen] = React.useState(0);
  const inputFotoRef = React.useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();

  const { data: insights, isLoading, isError } = useQuery({
    queryKey: ['producto-insights', productoId],
    queryFn: () => obtener<InsightsProducto>(`/productos/${productoId}/insights`),
    staleTime: 60_000,
  });

  const subir = useMutation({
    mutationFn: (archivos: File[]) =>
      subirArchivos<{ imagenes: string[] }>(`/productos/${productoId}/imagenes`, archivos),
    onSuccess: () => {
      toast.success('Imagen subida');
      void qc.invalidateQueries({ queryKey: ['productos'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const borrar = useMutation({
    mutationFn: (url: string) =>
      eliminar<{ imagenes: string[] }>(`/productos/${productoId}/imagenes`, { params: { url } }),
    onSuccess: () => {
      toast.success('Imagen eliminada');
      setIndiceImagen(0);
      void qc.invalidateQueries({ queryKey: ['productos'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const onSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) subir.mutate(files);
    if (inputFotoRef.current) inputFotoRef.current.value = '';
  };

  const totalImagenes = imagenes.length;
  const imagenActual = imagenes[indiceImagen];

  return (
    <div
      data-testid="panel-insights-producto"
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4"
    >
      {/* ── Carrusel de fotos ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="relative aspect-[4/3] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] overflow-hidden grid place-items-center">
          {imagenActual ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagenActual}
              alt={`${nombre} (${indiceImagen + 1}/${totalImagenes})`}
              className="size-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[hsl(var(--text-muted))]">
              <Package className="size-8 opacity-40" />
              <p className="text-sm">Sin fotos cargadas</p>
            </div>
          )}

          {totalImagenes > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndiceImagen((i) => (i - 1 + totalImagenes) % totalImagenes)}
                className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 hover:bg-black/60 text-white grid place-items-center"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setIndiceImagen((i) => (i + 1) % totalImagenes)}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/40 hover:bg-black/60 text-white grid place-items-center"
                aria-label="Foto siguiente"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {imagenes.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIndiceImagen(i)}
                    className={`size-1.5 rounded-full transition-all ${
                      i === indiceImagen ? 'bg-white w-4' : 'bg-white/50'
                    }`}
                    aria-label={`Ir a foto ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onSeleccionarArchivo}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputFotoRef.current?.click()}
            disabled={subir.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))] text-sm font-medium disabled:opacity-50"
          >
            <Upload className="size-4" />
            {subir.isPending ? 'Subiendo...' : 'Subir foto'}
          </button>
          {imagenActual && (
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Eliminar esta foto?')) borrar.mutate(imagenActual);
              }}
              disabled={borrar.isPending}
              className="px-3 py-2 rounded-md border border-[hsl(var(--border))] hover:bg-red-500/10 text-red-500 text-sm disabled:opacity-50"
              aria-label="Eliminar foto actual"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Insights ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isLoading && (
          <>
            {[0, 1, 2].map(i => (
              <Card key={i} className="p-4 h-32 animate-pulse">
                <div className="h-4 w-24 bg-[hsl(var(--surface-2))] rounded mb-3" />
                <div className="h-8 w-16 bg-[hsl(var(--surface-2))] rounded" />
              </Card>
            ))}
          </>
        )}

        {isError && (
          <Card className="p-4 col-span-full text-sm text-[hsl(var(--text-muted))]">
            No se pudieron cargar los insights.
          </Card>
        )}

        {insights && (
          <>
            {/* Rotación */}
            <Card className="p-4" data-testid="card-rotacion">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[hsl(var(--text-muted))] uppercase tracking-wide flex items-center gap-1.5">
                  <BarChart3 className="size-3.5" /> Rotación
                </span>
                {insights.rotacion.claseAbc && (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: COLORES_CLASE[insights.rotacion.claseAbc].suave,
                      color: COLORES_CLASE[insights.rotacion.claseAbc].base,
                    }}
                  >
                    {insights.rotacion.claseAbc}
                  </span>
                )}
              </div>
              {(() => {
                const cobertura = insights.rotacion.diasCobertura;
                const et = etiquetaCobertura(cobertura);
                return (
                  <>
                    <div className="text-2xl font-bold">
                      {cobertura === null ? '—' : `${formatearNumero(cobertura, 0)}d`}
                    </div>
                    <div className="text-xs mt-1" style={{ color: et.color }}>
                      {et.texto}
                    </div>
                    <div className="text-xs text-[hsl(var(--text-muted))] mt-2">
                      Stock: {formatearNumero(insights.rotacion.stockTotal)} · Vta/día:{' '}
                      {formatearNumero(insights.rotacion.ventasDiariasPromedio, 2)}
                    </div>
                  </>
                );
              })()}
            </Card>

            {/* Ventas */}
            <Card className="p-4" data-testid="card-ventas">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[hsl(var(--text-muted))] uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="size-3.5" /> Ventas
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-[hsl(var(--text-muted))]">Últimos 30 días</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold">{formatearNumero(insights.ventas.ultimos30d.unidades)}</span>
                    <span className="text-xs text-[hsl(var(--text-muted))]">unid</span>
                    <span className="text-sm font-medium ml-auto">
                      {formatearMoneda(insights.ventas.ultimos30d.monto, insights.margen.moneda)}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-[hsl(var(--border))]">
                  <div className="text-xs text-[hsl(var(--text-muted))]">Últimos 90 días</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold">{formatearNumero(insights.ventas.ultimos90d.unidades)}</span>
                    <span className="text-xs text-[hsl(var(--text-muted))]">unid</span>
                    <span className="text-sm font-medium ml-auto">
                      {formatearMoneda(insights.ventas.ultimos90d.monto, insights.margen.moneda)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Margen */}
            <Card className="p-4" data-testid="card-margen">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[hsl(var(--text-muted))] uppercase tracking-wide flex items-center gap-1.5">
                  <DollarSign className="size-3.5" /> Margen
                </span>
                {insights.margen.margenPct !== null && (
                  <span
                    className="text-xs font-bold flex items-center gap-0.5"
                    style={{ color: insights.margen.margenPct >= 30 ? '#10b981' : insights.margen.margenPct >= 15 ? '#f59e0b' : '#ef4444' }}
                  >
                    {insights.margen.margenPct >= 30 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {insights.margen.margenPct.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold">
                {formatearMoneda(insights.margen.precioVenta, insights.margen.moneda)}
              </div>
              <div className="text-xs text-[hsl(var(--text-muted))] mt-1">
                {insights.margen.precioCompra !== null
                  ? `Costo: ${formatearMoneda(insights.margen.precioCompra, insights.margen.moneda)}`
                  : 'Sin costo registrado'}
              </div>
              {insights.margen.historico.length >= 2 && (
                <div className="mt-2">
                  <MiniSparkline
                    puntos={insights.margen.historico.map(h => h.precioVenta)}
                    color={insights.margen.margenPct && insights.margen.margenPct >= 30 ? '#10b981' : '#0ea5e9'}
                  />
                  <div className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">
                    {insights.margen.historico.length} cambios de precio
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
