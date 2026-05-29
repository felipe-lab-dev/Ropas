'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Eye, FileText, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { obtener, obtenerPaginado, mensajeError } from '@/lib/api/client';
import { formatearFecha, formatearMoneda, formatearNumero } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FacetFilter } from '@/components/ui/facet-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { IlustracionVentas } from '@/components/ui/empty-illustrations';
import { DataTable, type ColumnaTabla, type TableState } from '@/components/ui/data-table';
import { usePreferencias } from '@/lib/use-preferencias';
import {
  BadgeRentabilidad,
  tooltipRentabilidad,
  type RentabilidadVenta,
} from '@/lib/rentabilidad-ui';

type EstadoVenta = 'borrador' | 'confirmada' | 'pagada' | 'parcial' | 'anulada';

interface VentaLista {
  id: string;
  numero: string;
  cliente?: { nombre: string } | null;
  vendedor: { nombre: string };
  sucursal: { id: string; nombre: string };
  estado: EstadoVenta;
  esNotaDeVenta: boolean;
  total: string;
  totalPagado: string;
  creadoEn: string;
  _count: { items: number };
  rentabilidad: RentabilidadVenta;
  documentoElectronico?: { pdfUrl: string | null; estadoSunat: string } | null;
}

interface Sucursal {
  id: string;
  nombre: string;
}

const estadoColor: Record<EstadoVenta, 'outline' | 'default' | 'success' | 'warning' | 'danger'> = {
  borrador: 'outline',
  confirmada: 'default',
  pagada: 'success',
  parcial: 'warning',
  anulada: 'danger',
};

const ESTADO_LABEL: Record<EstadoVenta, string> = {
  borrador: 'Borrador',
  confirmada: 'Confirmada',
  pagada: 'Pagada',
  parcial: 'Parcial',
  anulada: 'Anulada',
};

const ESTADOS_FACET = [
  { valor: 'confirmada', label: 'Confirmada', color: 'hsl(265 55% 58%)' },
  { valor: 'pagada', label: 'Pagada', color: 'hsl(150 55% 42%)' },
  { valor: 'parcial', label: 'Parcial', color: 'hsl(35 90% 55%)' },
  { valor: 'borrador', label: 'Borrador', color: 'hsl(265 12% 60%)' },
  { valor: 'anulada', label: 'Anulada', color: 'hsl(355 75% 55%)' },
];

const ESTADO_DEFAULT: TableState = {
  sort: { campo: 'fecha', dir: 'desc' },
};

const LIMITE = 30;

export default function VentasPage() {
  return (
    <React.Suspense fallback={null}>
      <VentasPageContenido />
    </React.Suspense>
  );
}

function VentasPageContenido() {
  const router = useRouter();
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [estadosSeleccionados, setEstadosSeleccionados] = React.useState<string[]>([]);
  const [debounced, setDebounced] = React.useState('');
  const [estadoTabla, setEstadoTabla] = usePreferencias<TableState>('ventas', ESTADO_DEFAULT);

  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  React.useEffect(() => { setPagina(1); }, [estadosSeleccionados]);

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

  // Sucursales: la columna solo se muestra si hay más de una (no aporta con 1).
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
    staleTime: 5 * 60_000,
  });
  const variasSucursales = (sucursales?.length ?? 0) > 1;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['ventas', debounced, pagina, estadosSeleccionados],
    queryFn: () =>
      obtenerPaginado<VentaLista>('/ventas', {
        limite: LIMITE,
        pagina,
        ...(debounced ? { buscar: debounced } : {}),
        ...(estadosSeleccionados.length ? { estado: estadosSeleccionados.join(',') } : {}),
      }),
    retry: 1,
  });

  const filas = data?.datos ?? [];

  const abrirPdf = React.useCallback((v: VentaLista) => {
    if (v.documentoElectronico?.pdfUrl) {
      window.open(v.documentoElectronico.pdfUrl, '_blank', 'noopener');
    }
  }, []);

  const columnas = React.useMemo<ColumnaTabla<VentaLista>[]>(() => {
    const cols: ColumnaTabla<VentaLista>[] = [
      {
        id: 'numero',
        titulo: 'Número',
        width: 124,
        minWidth: 100,
        movible: false,
        sortValor: v => v.numero,
        filter: { tipo: 'texto', getValor: v => v.numero },
        render: v => (
          <div className="flex items-center gap-2">
            <Link
              href={`/ventas/${v.id}`}
              onClick={e => e.stopPropagation()}
              className="font-mono font-semibold hover:underline text-[hsl(var(--brand-primary))]"
            >
              {v.numero}
            </Link>
            {v.esNotaDeVenta && (
              <Badge
                variant="outline"
                className="border-[hsl(35_90%_55%/0.4)] bg-[hsl(35_90%_55%/0.08)] text-[hsl(35_90%_55%)] text-[10px] font-medium px-1.5 py-0"
                title="Nota de venta interna · no se envía a SUNAT"
              >
                NV
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'fecha',
        titulo: 'Fecha',
        width: 150,
        colClassName: 'hidden lg:table-cell',
        sortValor: v => v.creadoEn,
        render: v => (
          <span className="text-xs text-[hsl(var(--text-muted))]">
            {formatearFecha(v.creadoEn, 'completa')}
          </span>
        ),
      },
      {
        id: 'cliente',
        titulo: 'Cliente',
        width: 180,
        minWidth: 130,
        sortValor: v => v.cliente?.nombre ?? '',
        filter: { tipo: 'texto', getValor: v => v.cliente?.nombre ?? '' },
        render: v => v.cliente?.nombre ?? (
          <span className="text-[hsl(var(--text-muted))]">Consumidor final</span>
        ),
      },
      {
        id: 'vendedor',
        titulo: 'Vendedor',
        width: 140,
        colClassName: 'hidden xl:table-cell',
        sortValor: v => v.vendedor.nombre,
        filter: { tipo: 'texto', getValor: v => v.vendedor.nombre },
        render: v => <span className="text-sm">{v.vendedor.nombre}</span>,
      },
    ];

    // Columna Sucursal: condicional — solo si el tenant tiene más de una.
    if (variasSucursales) {
      cols.push({
        id: 'sucursal',
        titulo: 'Sucursal',
        width: 140,
        colClassName: 'hidden xl:table-cell',
        sortValor: v => v.sucursal.nombre,
        filter: {
          tipo: 'select',
          getValor: v => v.sucursal.nombre,
          opciones: (sucursales ?? []).map(s => ({ valor: s.nombre, label: s.nombre })),
        },
        render: v => <span className="text-sm">{v.sucursal.nombre}</span>,
      });
    }

    cols.push(
      {
        id: 'items',
        titulo: 'Ítems',
        width: 64,
        align: 'right',
        colClassName: 'hidden 2xl:table-cell',
        sortValor: v => v._count.items,
        render: v => <span className="tabular-nums text-sm">{v._count.items}</span>,
      },
      {
        id: 'rentabilidad',
        titulo: 'Rentabilidad',
        width: 110,
        align: 'right',
        sortValor: v => v.rentabilidad.margenPct ?? -Infinity,
        filter: { tipo: 'rango', getValor: v => v.rentabilidad.margenPct ?? null },
        render: v => (
          <div className="flex justify-end">
            <BadgeRentabilidad
              nivel={v.rentabilidad.nivel}
              margenPct={v.rentabilidad.margenPct}
              title={tooltipRentabilidad(v.rentabilidad)}
            />
          </div>
        ),
      },
      {
        id: 'total',
        titulo: 'Total',
        width: 110,
        align: 'right',
        sortValor: v => Number(v.total),
        filter: { tipo: 'rango', getValor: v => Number(v.total) },
        render: v => <span className="font-bold tabular-nums">{formatearMoneda(v.total)}</span>,
      },
      {
        id: 'estado',
        titulo: 'Estado',
        width: 104,
        sortValor: v => v.estado,
        filter: {
          tipo: 'select',
          getValor: v => v.estado,
          opciones: (Object.keys(ESTADO_LABEL) as EstadoVenta[]).map(e => ({ valor: e, label: ESTADO_LABEL[e] })),
        },
        render: v => <Badge variant={estadoColor[v.estado]}>{ESTADO_LABEL[v.estado]}</Badge>,
      },
      {
        id: 'acciones',
        titulo: 'Acciones',
        width: 92,
        align: 'right',
        movible: false,
        cellClassName: 'pr-4',
        render: v => {
          const tienePdf = !!v.documentoElectronico?.pdfUrl;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Ver detalle de ${v.numero}`}
                onClick={e => { e.stopPropagation(); router.push(`/ventas/${v.id}`); }}
              >
                <Eye className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`PDF de ${v.numero}`}
                disabled={!tienePdf}
                title={
                  tienePdf
                    ? 'Abrir PDF del comprobante electrónico'
                    : 'Sin comprobante electrónico disponible'
                }
                onClick={e => { e.stopPropagation(); abrirPdf(v); }}
              >
                <FileText className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    );

    return cols;
  }, [variasSucursales, sucursales, router, abrirPdf]);

  const filtrosActivos = Object.keys(estadoTabla.filtros ?? {}).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Ventas"
        descripcion="Historial de tickets emitidos, con su rentabilidad por venta."
        acciones={
          <Button asChild size="lg">
            <Link href="/pos"><Plus className="size-4" /> Nueva venta</Link>
          </Button>
        }
      />

      {/* Toolbar estándar — rounded-xl + border + bg-surface */}
      <div className="mt-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
            <Input
              data-busqueda
              placeholder="Buscar por número o cliente…"
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              className="pl-9"
              aria-label="Buscar ventas"
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
              {formatearNumero(data.total)} resultado{data.total === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <FacetFilter
          titulo="Estado"
          opciones={ESTADOS_FACET}
          seleccionadas={estadosSeleccionados}
          onCambiar={setEstadosSeleccionados}
        />
      </div>

      {isError && (
        <Card className="p-4 border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-[hsl(355_75%_85%)]">No se pudieron cargar las ventas</div>
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
          <DataTable<VentaLista>
            columnas={columnas}
            filas={filas}
            getRowKey={v => v.id}
            estado={estadoTabla}
            onEstadoChange={setEstadoTabla}
            cargando={isLoading}
            rowClassName={v => (v.estado === 'anulada' ? 'opacity-55' : '')}
            onFilaClick={v => router.push(`/ventas/${v.id}`)}
            vacioRender={
              <EmptyState
                ilustracion={<IlustracionVentas className="w-full h-full" />}
                titulo={debounced ? 'Sin resultados' : 'No hay ventas todavía'}
                descripcion={
                  debounced
                    ? `No encontramos ventas que coincidan con "${debounced}".`
                    : 'Cuando emitas tu primer ticket aparecerá aquí con su número, monto, cliente y rentabilidad.'
                }
                accion={debounced ? undefined : { label: '＋ Ir al POS', href: '/pos' }}
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
    </div>
  );
}
