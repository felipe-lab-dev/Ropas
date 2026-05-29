'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download,
  Image as ImageIcon,
  Pencil,
  ShoppingCart,
  Users,
  Receipt,
  TrendingUp,
  Loader2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, mensajeError, obtener } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';
import { useConfigSaas } from '@/lib/store/config-saas';
import { useApariencia } from '@/lib/store/apariencia';
import { CuponPreview } from './cupon-preview';
import { ESTADO_LABEL, SEGMENTO_LABEL } from './cupon-schema';

interface CuponDetalle {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: string;
  montoMinimoCompra: string | null;
  descuentoMaximo: string | null;
  fechaInicio: string;
  fechaFin: string;
  usosMaximosTotal: number | null;
  usosMaximosPorCliente: number;
  segmento: string;
  aplicableA: string;
  estado: 'activo' | 'pausado' | 'expirado' | 'agotado';
  campania: string | null;
  disenoColorPrimario: string;
  disenoColorSecundario: string;
  disenoMensaje: string | null;
  disenoEmoji: string | null;
  temaEstacional: string | null;
  fondoImagenUrl: string | null;
  creadoEn: string;
  _count?: { usos: number };
}

interface CuponStats {
  usos: number;
  descuentoEntregado: string;
  ventasGeneradas: string;
  ingresoNeto: string;
  roi: number | null;
  clientesUnicos: number;
  tasaCanje: number | null;
}

interface CuponUso {
  id: string;
  montoDescuento: string;
  montoVenta: string;
  aplicadoEn: string;
  cliente: { id: string; nombre: string; documento?: string | null } | null;
  venta: { id: string; numero: string; total: string };
}

export function CuponDetalle({ cuponId }: { cuponId: string }) {
  // Prioridad: nombre custom de Configuración (local) > nombre del tenant > fallback
  const nombreLocal = useApariencia(s => s.nombreApp);
  const nombreTenant = useConfigSaas(s => s.config?.tenant.nombre);
  const tienda = nombreLocal?.trim() || nombreTenant || 'Mi Tienda';

  const { data: cupon, isLoading, isError } = useQuery({
    queryKey: ['cupon', cuponId],
    queryFn: () => obtener<CuponDetalle>(`/cupones/${cuponId}`),
    enabled: !!cuponId,
  });

  const { data: stats } = useQuery({
    queryKey: ['cupon-stats', cuponId],
    queryFn: () => obtener<CuponStats>(`/cupones/${cuponId}/estadisticas`),
    enabled: !!cuponId,
  });

  const { data: usos } = useQuery({
    queryKey: ['cupon-usos', cuponId],
    queryFn: () => obtener<CuponUso[]>(`/cupones/${cuponId}/usos`),
    enabled: !!cuponId,
  });

  const descargar = async (formato: 'pdf' | 'imagen', extension: string) => {
    try {
      const res = await api.get<Blob>(`/cupones/${cuponId}/${formato}`, {
        responseType: 'blob',
        params: { tienda },
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cupon-${cupon?.codigo ?? cuponId}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(mensajeError(e));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="size-6 animate-spin text-[hsl(var(--brand-primary))]" />
      </div>
    );
  }
  if (isError || !cupon) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="size-10 mx-auto text-[hsl(var(--brand-warning))] mb-3" />
        <p className="font-medium">No se pudo cargar el cupón</p>
      </div>
    );
  }

  const listaUsos = usos ?? [];

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Preview del cupón */}
      <CuponPreview
        codigo={cupon.codigo}
        nombre={cupon.nombre}
        tipoDescuento={cupon.tipoDescuento}
        valorDescuento={Number(cupon.valorDescuento)}
        fechaFin={cupon.fechaFin}
        montoMinimoCompra={cupon.montoMinimoCompra ? Number(cupon.montoMinimoCompra) : null}
        campania={cupon.campania}
        disenoColorPrimario={cupon.disenoColorPrimario}
        disenoColorSecundario={cupon.disenoColorSecundario}
        disenoMensaje={cupon.disenoMensaje}
        disenoEmoji={cupon.disenoEmoji}
        fondoImagenUrl={cupon.fondoImagenUrl}
        tienda={tienda}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          icon={<ShoppingCart className="size-4" />}
          titulo="Canjes"
          valor={String(stats?.usos ?? 0)}
          sub={stats?.tasaCanje != null ? `${stats.tasaCanje}% del cupo` : 'Sin tope'}
        />
        <Kpi
          icon={<Users className="size-4" />}
          titulo="Clientes únicos"
          valor={String(stats?.clientesUnicos ?? 0)}
        />
        <Kpi
          icon={<Receipt className="size-4" />}
          titulo="Descuento entregado"
          valor={stats ? formatearMoneda(stats.descuentoEntregado) : '—'}
          negativo
        />
        <Kpi
          icon={<TrendingUp className="size-4" />}
          titulo="Ingreso neto"
          valor={stats ? formatearMoneda(stats.ingresoNeto) : '—'}
          sub={stats?.roi != null ? `ROI ${stats.roi}x` : undefined}
        />
      </div>

      {/* Datos del cupón */}
      <Card className="p-4 space-y-3 text-sm">
        <Dato label="Estado">
          <Badge variant={cupon.estado === 'activo' ? 'success' : 'outline'}>
            {ESTADO_LABEL[cupon.estado]}
          </Badge>
        </Dato>
        <Dato label="Segmento">{SEGMENTO_LABEL[cupon.segmento as never] ?? cupon.segmento}</Dato>
        <Dato label="Vigencia">
          {new Date(cupon.fechaInicio).toLocaleDateString('es-PE')} →{' '}
          {new Date(cupon.fechaFin).toLocaleDateString('es-PE')}
        </Dato>
        <Dato label="Usos por cliente">{cupon.usosMaximosPorCliente}</Dato>
        <Dato label="Usos totales">{cupon.usosMaximosTotal ?? 'Ilimitado'}</Dato>
        {cupon.montoMinimoCompra && <Dato label="Mínimo">{formatearMoneda(cupon.montoMinimoCompra)}</Dato>}
        {cupon.descuentoMaximo && <Dato label="Tope">{formatearMoneda(cupon.descuentoMaximo)}</Dato>}
        {cupon.descripcion && (
          <div className="pt-2 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--text-muted))]">
            {cupon.descripcion}
          </div>
        )}
      </Card>

      {/* Historial de canjes */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-[hsl(var(--border))]">
          <h3 className="font-semibold text-sm">Historial de canjes</h3>
          <p className="text-[11px] text-[hsl(var(--text-muted))]">Últimos 100 usos del cupón.</p>
        </div>
        {listaUsos.length === 0 ? (
          <div className="p-5 text-sm text-[hsl(var(--text-muted))] text-center">
            Aún no se canjeó este cupón.
          </div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {listaUsos.map(u => (
              <li key={u.id}>
                <Link
                  href={`/ventas?ver=${u.venta.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[hsl(var(--surface-2))]/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {u.cliente?.nombre ?? <span className="text-[hsl(var(--text-muted))]">Sin cliente</span>}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--text-muted))] font-mono truncate">
                      {u.venta.numero} · {new Date(u.aplicadoEn).toLocaleDateString('es-PE')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold tabular-nums text-sm text-[hsl(355_75%_70%)]">
                      -{formatearMoneda(u.montoDescuento)}
                    </span>
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
        <Button variant="outline" size="sm" onClick={() => descargar('pdf', 'pdf')} data-testid="descargar-pdf">
          <Download className="size-4" /> PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => descargar('imagen', 'png')} data-testid="descargar-png">
          <ImageIcon className="size-4" /> PNG
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/cupones/editar?id=${cupon.id}`}>
            <Pencil className="size-4" /> Editar
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))]">{label}</span>
      <span className="text-xs font-medium text-right">{children}</span>
    </div>
  );
}

function Kpi({
  icon,
  titulo,
  valor,
  sub,
  negativo,
}: {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  sub?: string;
  negativo?: boolean;
}) {
  return (
    <Card className="p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))]">
        {icon} {titulo}
      </div>
      <div className={`text-xl font-bold tabular-nums ${negativo ? 'text-[hsl(355_75%_70%)]' : ''}`}>
        {valor}
      </div>
      {sub && <div className="text-[10px] text-[hsl(var(--text-muted))]">{sub}</div>}
    </Card>
  );
}
