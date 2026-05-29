'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, Zap, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { obtenerPaginado, postear, eliminar, mensajeError } from '@/lib/api/client';
import { formatearMoneda, formatearNumero, formatearFecha, iniciales } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { IlustracionClientes } from '@/components/ui/empty-illustrations';
import { DataTable, type ColumnaTabla, type TableState } from '@/components/ui/data-table';
import { usePreferencias } from '@/lib/use-preferencias';

type Clase = 'AA' | 'A' | 'B' | 'C' | 'D';

interface Cliente {
  id: string; codigo?: string | null; nombre: string; documento?: string | null; tipoDocumento: string;
  telefono?: string | null; email?: string | null; ciudad?: string | null;
  totalCompras: string; ultimaCompraEn?: string | null;
  clasificacion: Clase | null;
}

interface ResultadoClasificacion {
  clientesTotales: number;
  clientesClasificados: number;
  distribucion: Record<Clase, number>;
}

const COLORES_CLASE: Record<Clase, { base: string; suave: string }> = {
  AA: { base: '#8b5cf6', suave: 'rgba(139,92,246,0.12)' },
  A:  { base: '#0ea5e9', suave: 'rgba(14,165,233,0.12)' },
  B:  { base: '#22c55e', suave: 'rgba(34,197,94,0.12)' },
  C:  { base: '#f59e0b', suave: 'rgba(245,158,11,0.12)' },
  D:  { base: '#94a3b8', suave: 'rgba(148,163,184,0.12)' },
};

const CLASE_LABEL: Record<Clase, string> = {
  AA: 'VIP', A: 'Top', B: 'Sólidos', C: 'Ocasionales', D: 'Fríos / sin compras',
};

const CLASE_RANK: Record<Clase, number> = { AA: 5, A: 4, B: 3, C: 2, D: 1 };

const OPCIONES_CLASE = (['AA', 'A', 'B', 'C', 'D'] as Clase[]).map(c => ({
  valor: c, label: `${c} — ${CLASE_LABEL[c]}`,
}));

const ESTADO_DEFAULT: TableState = {
  sort: { campo: 'totalCompras', dir: 'desc' },
};

const LIMITE = 30;

export default function ClientesPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debounced, setDebounced] = React.useState('');
  const [aEliminar, setAEliminar] = React.useState<Cliente | null>(null);
  const qc = useQueryClient();

  const [estadoTabla, setEstadoTabla] = usePreferencias<TableState>('clientes', ESTADO_DEFAULT);

  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  // Shift+Space limpia búsqueda y filtros mientras el foco está en el buscador.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.code === 'Space' && document.activeElement?.matches('[data-busqueda]')) {
        e.preventDefault();
        setBuscar('');
        setEstadoTabla(p => ({ ...p, filtros: {} }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setEstadoTabla]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['clientes', debounced, pagina],
    queryFn: () => obtenerPaginado<Cliente>('/clientes', {
      limite: LIMITE,
      pagina,
      ...(debounced ? { buscar: debounced } : {}),
    }),
    retry: 1,
  });

  const calcular = useMutation({
    mutationFn: () => postear<ResultadoClasificacion>('/clientes/clasificacion/calcular', {}),
    onSuccess: r => {
      const resumen = (['AA', 'A', 'B', 'C', 'D'] as Clase[])
        .map(c => `${c}:${r.distribucion[c] ?? 0}`)
        .join(' · ');
      toast.success(`Clasificación lista — ${resumen}`);
      void qc.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const mutarEliminar = useMutation({
    mutationFn: (id: string) => eliminar(`/clientes/${id}`),
    onSuccess: () => {
      toast.success('Cliente eliminado');
      setAEliminar(null);
      void qc.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const filas = data?.datos ?? [];

  const opcionesCiudad = React.useMemo(
    () => Array.from(new Set(filas.map(f => f.ciudad).filter((c): c is string => !!c)))
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map(c => ({ valor: c, label: c })),
    [filas],
  );

  const columnas = React.useMemo<ColumnaTabla<Cliente>[]>(() => [
    {
      id: 'numero',
      titulo: 'N°',
      width: 46,
      minWidth: 40,
      align: 'right',
      movible: false,
      render: (_c, idx) => (
        <span className="text-[10px] text-[hsl(var(--text-muted))] tabular-nums">
          {(pagina - 1) * LIMITE + idx + 1}
        </span>
      ),
    },
    {
      id: 'codigo',
      titulo: 'Código',
      width: 86,
      minWidth: 70,
      sortValor: c => c.codigo ?? '',
      filter: { tipo: 'texto', getValor: c => c.codigo ?? '' },
      render: c => (
        <span className="font-mono text-xs font-semibold text-[hsl(var(--brand-primary))]">
          {c.codigo ?? '—'}
        </span>
      ),
    },
    {
      id: 'cliente',
      titulo: 'Cliente',
      width: 210,
      minWidth: 160,
      sortValor: c => c.nombre,
      filter: { tipo: 'texto', getValor: c => c.nombre },
      render: c => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] grid place-items-center text-white text-[10px] font-bold">
            {iniciales(c.nombre)}
          </div>
          <span className="font-medium truncate">{c.nombre}</span>
        </div>
      ),
    },
    {
      id: 'documento',
      titulo: 'Documento',
      width: 124,
      minWidth: 100,
      sortValor: c => c.documento ?? '',
      filter: { tipo: 'texto', getValor: c => c.documento ?? '' },
      render: c => c.documento ? (
        <div className="font-mono text-xs">
          <div className="uppercase text-[10px] text-[hsl(var(--text-muted))]">{c.tipoDocumento}</div>
          <div>{c.documento}</div>
        </div>
      ) : <span className="text-[hsl(var(--text-muted))]">—</span>,
    },
    {
      id: 'contacto',
      titulo: 'Contacto',
      width: 160,
      minWidth: 140,
      colClassName: 'hidden 2xl:table-cell',
      sortValor: c => c.email ?? c.telefono ?? '',
      filter: { tipo: 'texto', getValor: c => `${c.email ?? ''} ${c.telefono ?? ''}` },
      render: c => (c.email || c.telefono) ? (
        <div className="min-w-0 text-xs text-[hsl(var(--text-muted))]">
          {c.email && <div className="truncate">{c.email}</div>}
          {c.telefono && <div className="truncate">{c.telefono}</div>}
        </div>
      ) : <span className="text-[hsl(var(--text-muted))]">—</span>,
    },
    {
      id: 'ciudad',
      titulo: 'Ciudad',
      width: 104,
      minWidth: 90,
      colClassName: 'hidden lg:table-cell',
      sortValor: c => c.ciudad ?? '',
      filter: { tipo: 'select', getValor: c => c.ciudad ?? '', opciones: opcionesCiudad },
      render: c => c.ciudad
        ? <span className="text-sm">{c.ciudad}</span>
        : <span className="text-[hsl(var(--text-muted))]">—</span>,
    },
    {
      id: 'clase',
      titulo: 'Clase',
      width: 88,
      minWidth: 76,
      align: 'center',
      sortValor: c => (c.clasificacion ? CLASE_RANK[c.clasificacion] : 0),
      filter: { tipo: 'select', getValor: c => c.clasificacion ?? '', opciones: OPCIONES_CLASE },
      render: c => {
        if (!c.clasificacion) return <span className="text-[10px] text-[hsl(var(--text-muted))]">—</span>;
        const cc = COLORES_CLASE[c.clasificacion];
        return (
          <span
            className="inline-block min-w-[28px] px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums border"
            style={{ background: cc.suave, color: cc.base, borderColor: `${cc.base}40` }}
            title={`Clase ${c.clasificacion} — ${CLASE_LABEL[c.clasificacion]}`}
          >
            {c.clasificacion}
          </span>
        );
      },
    },
    {
      id: 'totalCompras',
      titulo: 'Total compras',
      width: 120,
      minWidth: 104,
      align: 'right',
      sortValor: c => Number(c.totalCompras),
      filter: { tipo: 'rango', getValor: c => Number(c.totalCompras) },
      render: c => Number(c.totalCompras) > 0
        ? <span className="font-bold tabular-nums">{formatearMoneda(c.totalCompras)}</span>
        : <span className="text-[hsl(var(--text-muted))] tabular-nums">{formatearMoneda(0)}</span>,
    },
    {
      id: 'ultimaCompra',
      titulo: 'Última compra',
      width: 116,
      minWidth: 100,
      align: 'right',
      colClassName: 'hidden xl:table-cell',
      sortValor: c => (c.ultimaCompraEn ? new Date(c.ultimaCompraEn).getTime() : 0),
      render: c => c.ultimaCompraEn
        ? <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums">{formatearFecha(c.ultimaCompraEn)}</span>
        : <span className="text-[hsl(var(--text-muted))]">—</span>,
    },
    {
      id: 'acciones',
      titulo: 'Acciones',
      width: 88,
      minWidth: 80,
      align: 'right',
      movible: false,
      cellClassName: 'pr-4',
      render: c => (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label={`Editar ${c.nombre}`}>
            <Link href={`/clientes/${c.id}`}><Edit2 className="size-3.5" /></Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar ${c.nombre}`}
            onClick={() => setAEliminar(c)}
            className="text-[hsl(355_75%_65%)] hover:text-[hsl(355_75%_75%)] hover:bg-[hsl(355_75%_55%/0.1)]"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ], [pagina, opcionesCiudad]);

  const filtrosActivos = Object.keys(estadoTabla.filtros ?? {}).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Clientes"
        descripcion="Tu base de clientes registrados, segmentados por clasificación RFM (AA · A · B · C · D)."
        acciones={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => calcular.mutate()}
              disabled={calcular.isPending}
              className="border-[hsl(var(--brand-primary))]/40 bg-gradient-to-r from-[hsl(var(--brand-primary))]/10 to-[#ec4899]/10 hover:from-[hsl(var(--brand-primary))]/20 hover:to-[#ec4899]/20"
            >
              {calcular.isPending
                ? <><Loader2 className="size-4 animate-spin" /> Calculando…</>
                : <><Zap className="size-4 text-[hsl(var(--brand-primary))]" /> Recalcular clasificación</>}
            </Button>
            <Button asChild size="lg">
              <Link href="/clientes/nuevo"><Plus className="size-4" /> Nuevo cliente</Link>
            </Button>
          </div>
        }
      />

      {/* Toolbar estándar — rounded-xl + border + bg-surface (DIH ERP look) */}
      <div className="mt-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
            <Input
              data-busqueda
              placeholder="Buscar por nombre, documento, email, teléfono…"
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              className="pl-9"
              aria-label="Buscar clientes"
            />
          </div>
          {filtrosActivos > 0 && (
            <button
              type="button"
              onClick={() => setEstadoTabla(p => ({ ...p, filtros: {} }))}
              className="text-xs text-[hsl(var(--brand-danger))] hover:underline"
            >
              Limpiar {filtrosActivos} filtro{filtrosActivos === 1 ? '' : 's'}
            </button>
          )}
          {data && (
            <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums ml-auto">
              {formatearNumero(data.total)} cliente{data.total === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {isError && (
        <Card className="p-4 border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-[hsl(355_75%_85%)]">No se pudieron cargar los clientes</div>
              <div className="text-sm text-[hsl(355_75%_75%)] mt-1">{mensajeError(error)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {!isError && (
          <DataTable<Cliente>
            columnas={columnas}
            filas={filas}
            getRowKey={c => c.id}
            estado={estadoTabla}
            onEstadoChange={setEstadoTabla}
            cargando={isLoading}
            vacioRender={
              <EmptyState
                ilustracion={<IlustracionClientes className="w-full h-full" />}
                titulo={debounced ? 'Sin resultados' : 'Tu base de clientes está vacía'}
                descripcion={
                  debounced
                    ? `No encontramos clientes que coincidan con "${debounced}".`
                    : 'Registra tus clientes para llevar el control de sus compras y fidelizar.'
                }
                accion={
                  debounced ? undefined : { label: '＋ Nuevo cliente', href: '/clientes/nuevo' }
                }
              />
            }
          />
        )}
        {data && data.total > 0 && (
          <Pagination
            pagina={data.pagina}
            totalPaginas={data.totalPaginas}
            total={data.total}
            limite={LIMITE}
            onCambiar={setPagina}
          />
        )}
      </Card>

      <Dialog open={!!aEliminar} onOpenChange={o => !o && setAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              Vas a eliminar <strong>{aEliminar?.nombre}</strong>. Esto es un borrado
              lógico: el cliente desaparece del listado pero su historial de compras
              se conserva. No podrá registrarse otro cliente con el mismo documento.
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
