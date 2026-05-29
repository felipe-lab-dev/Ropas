'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Eye,
  Edit2,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Tag,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { eliminar, mensajeError, obtenerPaginado, actualizar } from '@/lib/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ESTADO_LABEL, ESTADOS, SEGMENTO_LABEL, SEGMENTOS } from './cupon-schema';

interface CuponLista {
  id: string;
  codigo: string;
  nombre: string;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'activo' | 'pausado' | 'expirado' | 'agotado';
  segmento: string;
  campania?: string | null;
  usosMaximosTotal: number | null;
  disenoColorPrimario: string;
  disenoEmoji?: string | null;
  _count?: { usos: number };
}

const ESTADO_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'outline'> = {
  activo: 'success',
  pausado: 'warning',
  expirado: 'outline',
  agotado: 'outline',
};

export default function CuponesPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [estado, setEstado] = React.useState<string>('');
  const [segmento, setSegmento] = React.useState<string>('');
  const [debounced, setDebounced] = React.useState('');
  const [aEliminar, setAEliminar] = React.useState<CuponLista | null>(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(buscar);
      setPagina(1);
    }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.code === 'Space' && document.activeElement?.matches('[data-busqueda]')) {
        e.preventDefault();
        setBuscar('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['cupones', debounced, pagina, estado, segmento],
    queryFn: () =>
      obtenerPaginado<CuponLista>('/cupones', {
        limite: 30,
        pagina,
        ...(debounced ? { buscar: debounced } : {}),
        ...(estado ? { estado } : {}),
        ...(segmento ? { segmento } : {}),
      }),
    retry: 1,
  });

  const mutarEliminar = useMutation({
    mutationFn: (id: string) => eliminar(`/cupones/${id}`),
    onSuccess: () => {
      toast.success('Cupón eliminado');
      setAEliminar(null);
      qc.invalidateQueries({ queryKey: ['cupones'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const mutarPausar = useMutation({
    mutationFn: ({ id, pausar }: { id: string; pausar: boolean }) =>
      actualizar(`/cupones/${id}`, { pausar }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cupones'] });
      toast.success('Estado actualizado');
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const filas = data?.datos ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Cupones y promociones"
        descripcion="Generá campañas brutales, hacé tracking del canje y mide ROI por cada cupón."
        acciones={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="lg">
              <Link href="/cupones/canjear">
                <Tag className="size-4" /> Canjear
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/cupones/nuevo?wizard=plantillas">
                <Sparkles className="size-4" /> Plantillas brutales
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/cupones/nuevo">
                <Plus className="size-4" /> Nuevo cupón
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            data-busqueda
            placeholder="Buscar por código, nombre, campaña…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-9"
            aria-label="Buscar cupones"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-semibold text-[hsl(var(--text-muted))]">Estado</label>
          <Select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }} aria-label="Filtrar estado">
            <option value="">Todos</option>
            {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-semibold text-[hsl(var(--text-muted))]">Segmento</label>
          <Select value={segmento} onChange={e => { setSegmento(e.target.value); setPagina(1); }} aria-label="Filtrar segmento">
            <option value="">Todos</option>
            {SEGMENTOS.map(s => <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>)}
          </Select>
        </div>
      </div>

      {isError && (
        <Card className="p-4 border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-[hsl(355_75%_85%)]">No se pudieron cargar los cupones</div>
              <div className="text-sm text-[hsl(355_75%_75%)] mt-1">{mensajeError(error)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cupón</TableHead>
              <TableHead>Descuento</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead className="text-right">Canjes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right pr-4 w-[150px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !isError && filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    ilustracion={<Tag className="size-20 text-[hsl(var(--brand-primary))/60]" />}
                    titulo={debounced || estado || segmento ? 'Sin resultados' : 'Aún no creaste cupones'}
                    descripcion={
                      debounced || estado || segmento
                        ? 'Probá ajustar los filtros o probar con otra búsqueda.'
                        : 'Empezá con una plantilla brutal o creá uno desde cero. El marketing pasa por acá.'
                    }
                    accion={
                      debounced || estado || segmento
                        ? undefined
                        : { label: '⚡ Empezar con plantilla', href: '/cupones/nuevo?wizard=plantillas' }
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filas.map(c => {
                const usos = c._count?.usos ?? 0;
                const tasaCanje = c.usosMaximosTotal
                  ? Math.round((usos / c.usosMaximosTotal) * 100)
                  : null;
                const venceEn = Math.ceil((new Date(c.fechaFin).getTime() - Date.now()) / 86400_000);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className="size-9 rounded-md grid place-items-center text-base shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${c.disenoColorPrimario}, ${c.disenoColorPrimario}66)`,
                            color: '#fff',
                          }}
                          aria-hidden
                        >
                          {c.disenoEmoji || '🏷️'}
                        </span>
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-xs uppercase">{c.codigo}</div>
                          <div className="text-sm font-medium truncate">{c.nombre}</div>
                          {c.campania && (
                            <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--text-muted))]">
                              {c.campania}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {c.tipoDescuento === 'porcentaje' ? `${Number(c.valorDescuento)}%` : `S/ ${Number(c.valorDescuento).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {SEGMENTO_LABEL[c.segmento as never] ?? c.segmento}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        Hasta {new Date(c.fechaFin).toLocaleDateString('es-PE')}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${venceEn <= 3 && venceEn >= 0 ? 'text-[hsl(355_75%_70%)] font-semibold' : 'text-[hsl(var(--text-muted))]'}`}>
                        {venceEn < 0 ? 'Vencido' : venceEn === 0 ? '⚠ Vence hoy' : `${venceEn}d restantes`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="font-bold">{usos}{c.usosMaximosTotal ? ` / ${c.usosMaximosTotal}` : ''}</div>
                      {tasaCanje !== null && (
                        <div className="text-[10px] text-[hsl(var(--text-muted))]">{tasaCanje}% canje</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[c.estado] ?? 'outline'}>
                        {ESTADO_LABEL[c.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon-sm" aria-label={`Ver ${c.codigo}`}>
                          <Link href={`/cupones/detalle?id=${c.id}`}><Eye className="size-3.5" /></Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon-sm" aria-label={`Editar ${c.codigo}`}>
                          <Link href={`/cupones/editar?id=${c.id}`}><Edit2 className="size-3.5" /></Link>
                        </Button>
                        {c.estado === 'activo' && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Pausar ${c.codigo}`}
                            onClick={() => mutarPausar.mutate({ id: c.id, pausar: true })}
                            disabled={mutarPausar.isPending}
                          >
                            <PauseCircle className="size-3.5" />
                          </Button>
                        )}
                        {c.estado === 'pausado' && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Reanudar ${c.codigo}`}
                            onClick={() => mutarPausar.mutate({ id: c.id, pausar: false })}
                            disabled={mutarPausar.isPending}
                          >
                            <PlayCircle className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Eliminar ${c.codigo}`}
                          onClick={() => setAEliminar(c)}
                          className="text-[hsl(355_75%_65%)] hover:text-[hsl(355_75%_75%)] hover:bg-[hsl(355_75%_55%/0.1)]"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {data && data.totalPaginas > 1 && (
          <Pagination
            pagina={data.pagina}
            totalPaginas={data.totalPaginas}
            total={data.total}
            limite={30}
            onCambiar={setPagina}
          />
        )}
      </Card>

      <Dialog open={!!aEliminar} onOpenChange={o => !o && setAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cupón</DialogTitle>
            <DialogDescription>
              Vas a eliminar <strong className="font-mono">{aEliminar?.codigo}</strong> ({aEliminar?.nombre}).
              Es un borrado lógico: deja de aparecer y no se puede canjear, pero el histórico de usos
              se conserva para reportes. El código vuelve a estar disponible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAEliminar(null)}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={mutarEliminar.isPending}
              onClick={() => aEliminar && mutarEliminar.mutate(aEliminar.id)}
            >
              {mutarEliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
