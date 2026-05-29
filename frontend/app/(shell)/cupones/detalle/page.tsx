'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Edit2,
  Image as ImageIcon,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, mensajeError, obtener } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';
import { useConfigSaas } from '@/lib/store/config-saas';
import { useApariencia } from '@/lib/store/apariencia';
import { CuponPreview } from '../cupon-preview';
import { ESTADO_LABEL, SEGMENTO_LABEL } from '../cupon-schema';

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

export default function CuponDetallePage() {
  const id = useSearchParams().get('id') ?? '';

  if (!id) {
    return (
      <Card className="p-6">
        Falta el parámetro <code>id</code> en la URL.
      </Card>
    );
  }

  return <CuponDetalleContenido id={id} />;
}

function CuponDetalleContenido({ id }: { id: string }) {
  // Prioridad: nombre custom de Configuración (local) > nombre del tenant en backend > fallback
  const nombreLocal = useApariencia(s => s.nombreApp);
  const nombreTenant = useConfigSaas(s => s.config?.tenant.nombre);
  const tienda = (nombreLocal?.trim() || nombreTenant || 'Mi Tienda');

  const { data: cupon, isLoading: cargandoCupon } = useQuery({
    queryKey: ['cupon', id],
    queryFn: () => obtener<CuponDetalle>(`/cupones/${id}`),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ['cupon-stats', id],
    queryFn: () => obtener<CuponStats>(`/cupones/${id}/estadisticas`),
    enabled: !!id,
  });

  const { data: usos } = useQuery({
    queryKey: ['cupon-usos', id],
    queryFn: () => obtener<CuponUso[]>(`/cupones/${id}/usos`),
    enabled: !!id,
  });

  const descargar = async (formato: 'pdf' | 'imagen', extension: string) => {
    try {
      const res = await api.get<Blob>(`/cupones/${id}/${formato}`, {
        responseType: 'blob',
        params: { tienda },
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cupon-${cupon?.codigo ?? id}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(mensajeError(e));
    }
  };

  if (cargandoCupon) return <Skeleton className="h-screen" />;
  if (!cupon) return <Card className="p-6">Cupón no encontrado.</Card>;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={
          <span className="font-mono text-base sm:text-2xl">{cupon.codigo}</span> as never
        }
        descripcion={cupon.nombre}
        acciones={
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/cupones"><ArrowLeft className="size-4" /> Volver</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/cupones/editar?id=${id}`}><Edit2 className="size-4" /> Editar</Link>
            </Button>
            <Button variant="outline" onClick={() => descargar('pdf', 'pdf')} data-testid="descargar-pdf">
              <Download className="size-4" /> PDF
            </Button>
            <Button variant="outline" onClick={() => descargar('imagen', 'png')} data-testid="descargar-png">
              <ImageIcon className="size-4" /> PNG
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        {/* Preview + datos del cupón */}
        <div className="space-y-4">
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
            {cupon.montoMinimoCompra && (
              <Dato label="Mínimo">{formatearMoneda(cupon.montoMinimoCompra)}</Dato>
            )}
            {cupon.descuentoMaximo && (
              <Dato label="Tope">{formatearMoneda(cupon.descuentoMaximo)}</Dato>
            )}
            {cupon.descripcion && (
              <div className="pt-2 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--text-muted))]">
                {cupon.descripcion}
              </div>
            )}
          </Card>
        </div>

        {/* KPIs y usos */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              valor={stats ? `S/ ${stats.descuentoEntregado}` : '—'}
              negativo
            />
            <Kpi
              icon={<TrendingUp className="size-4" />}
              titulo="Ingreso neto"
              valor={stats ? `S/ ${stats.ingresoNeto}` : '—'}
              sub={stats?.roi != null ? `ROI ${stats.roi}x` : undefined}
            />
          </div>

          <Card>
            <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Historial de canjes</h3>
                <p className="text-xs text-[hsl(var(--text-muted))]">Últimos 100 usos del cupón.</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead className="text-right">Total venta</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!usos || usos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-[hsl(var(--text-muted))] py-10">
                      Aún no se canjeó este cupón.
                    </TableCell>
                  </TableRow>
                ) : (
                  usos.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="text-xs">
                        {new Date(u.aplicadoEn).toLocaleString('es-PE')}
                      </TableCell>
                      <TableCell>{u.cliente?.nombre ?? <span className="text-[hsl(var(--text-muted))]">Sin cliente</span>}</TableCell>
                      <TableCell>
                        <Link href={`/ventas/${u.venta.id}`} className="font-mono text-xs hover:underline">
                          {u.venta.numero}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatearMoneda(u.venta.total)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-[hsl(355_75%_70%)]">
                        -{formatearMoneda(u.montoDescuento)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
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
      <div className={`text-2xl font-bold tabular-nums ${negativo ? 'text-[hsl(355_75%_70%)]' : ''}`}>
        {valor}
      </div>
      {sub && <div className="text-[10px] text-[hsl(var(--text-muted))]">{sub}</div>}
    </Card>
  );
}
