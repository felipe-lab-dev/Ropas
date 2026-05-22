'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, History, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { obtener, obtenerPaginado, eliminar as eliminarApi, mensajeError } from '@/lib/api/client';
import { formatearMoneda, formatearNumero } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { IlustracionProductos } from '@/components/ui/empty-illustrations';
import { VentasSparkline } from '@/components/ui/ventas-sparkline';
import { IconoCategoria } from '@/components/ui/icono-categoria';
import { DataTable, type ColumnaTabla, type TableState } from '@/components/ui/data-table';
import { colorCategoria } from '@/lib/color-categoria';
import { usePreferencias } from '@/lib/use-preferencias';
import { MotorLogisticoModal } from './motor-logistico-modal';

interface Categoria { id: string; nombre: string }

interface ProductoLista {
  id: string;
  sku: string;
  codigo: string | null;
  nombre: string;
  precioVenta: string;
  activo: boolean;
  imagenes: string[];
  categoria: { id: string; nombre: string; slug?: string };
  marca?: { nombre: string } | null;
  cantidadVariantes: number;
  stockTotal: number;
  cantidadVentas: number;
  ventasMensuales: Array<{ mes: string; cantidad: number }>;
  variantes: Array<{ talla: string; color: string; colorHex?: string | null }>;
  clasificacion: 'AA' | 'A' | 'B' | 'C' | 'D' | null;
}

const COLORES_CLASE: Record<'AA' | 'A' | 'B' | 'C' | 'D', { base: string; suave: string }> = {
  AA: { base: '#8b5cf6', suave: 'rgba(139,92,246,0.12)' },
  A:  { base: '#0ea5e9', suave: 'rgba(14,165,233,0.12)' },
  B:  { base: '#22c55e', suave: 'rgba(34,197,94,0.12)' },
  C:  { base: '#f59e0b', suave: 'rgba(245,158,11,0.12)' },
  D:  { base: '#94a3b8', suave: 'rgba(148,163,184,0.12)' },
};

const ESTADO_DEFAULT: TableState = {
  sort: { campo: 'nombre', dir: 'asc' },
};

export default function ProductosPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debouncedBuscar, setDebouncedBuscar] = React.useState('');
  const [confirmandoId, setConfirmandoId] = React.useState<string | null>(null);
  const [motorAbierto, setMotorAbierto] = React.useState(false);
  const qc = useQueryClient();

  const [estadoTabla, setEstadoTabla] = usePreferencias<TableState>('productos', ESTADO_DEFAULT);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedBuscar(buscar), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  React.useEffect(() => { setPagina(1); }, [debouncedBuscar]);

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => obtener<Categoria[]>('/categorias'),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['productos', pagina, debouncedBuscar],
    queryFn: () =>
      obtenerPaginado<ProductoLista>('/productos', {
        pagina,
        limite: 20,
        ...(debouncedBuscar ? { buscar: debouncedBuscar } : {}),
      }),
    retry: false,
  });

  const borrar = useMutation({
    mutationFn: (id: string) => eliminarApi(`/productos/${id}`),
    onSuccess: () => {
      toast.success('Producto eliminado');
      setConfirmandoId(null);
      void qc.invalidateQueries({ queryKey: ['productos'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const opcionesCategoria = React.useMemo(
    () => (categorias ?? []).map(c => ({ valor: c.nombre, label: c.nombre })),
    [categorias],
  );

  const columnas = React.useMemo<ColumnaTabla<ProductoLista>[]>(() => [
    {
      id: 'imagen',
      titulo: '',
      width: 64,
      minWidth: 56,
      render: (p) => {
        const cat = colorCategoria(p.categoria.slug ?? p.categoria.nombre);
        return (
          <div
            className="size-10 rounded-md grid place-items-center overflow-hidden border"
            style={{ borderColor: `${cat.base}40`, background: cat.suave }}
          >
            {p.imagenes[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagenes[0]} alt={p.nombre} className="size-full object-cover" />
            ) : (
              <IconoCategoria
                slug={p.categoria.slug}
                nombre={p.categoria.nombre}
                className="size-5"
                style={{ color: cat.base }}
              />
            )}
          </div>
        );
      },
    },
    {
      id: 'nombre',
      titulo: 'Producto',
      width: 220,
      sortValor: p => p.nombre,
      filter: { tipo: 'texto', getValor: p => p.nombre },
      render: p => (
        <div className="min-w-0">
          <div className="font-medium truncate">{p.nombre}</div>
          {p.marca && (
            <div className="text-xs text-[hsl(var(--text-muted))] truncate">{p.marca.nombre}</div>
          )}
        </div>
      ),
    },
    {
      id: 'codigo',
      titulo: 'Código',
      width: 110,
      sortValor: p => p.codigo ?? '',
      filter: { tipo: 'texto', getValor: p => p.codigo },
      render: p => p.codigo
        ? <span className="font-mono text-xs font-semibold">{p.codigo}</span>
        : <span className="text-[hsl(var(--text-muted))]">—</span>,
    },
    {
      id: 'sku',
      titulo: 'SKU',
      width: 110,
      sortValor: p => p.sku,
      filter: { tipo: 'texto', getValor: p => p.sku },
      render: p => <span className="font-mono text-[10px] text-[hsl(var(--text-muted))]">{p.sku}</span>,
    },
    {
      id: 'categoria',
      titulo: 'Categoría',
      width: 140,
      sortValor: p => p.categoria.nombre,
      filter: { tipo: 'select', getValor: p => p.categoria.nombre, opciones: opcionesCategoria },
      render: p => {
        const cat = colorCategoria(p.categoria.slug ?? p.categoria.nombre);
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border"
            style={{ background: cat.suave, color: cat.base, borderColor: `${cat.base}40` }}
          >
            <span className="size-1.5 rounded-full" style={{ background: cat.base }} />
            {p.categoria.nombre}
          </span>
        );
      },
    },
    {
      id: 'clasificacion',
      titulo: 'Clase',
      width: 90,
      align: 'center',
      sortValor: p => {
        const ord: Record<string, number> = { AA: 5, A: 4, B: 3, C: 2, D: 1 };
        return ord[p.clasificacion ?? ''] ?? 0;
      },
      filter: {
        tipo: 'select',
        getValor: p => p.clasificacion ?? '',
        opciones: [
          { valor: 'AA', label: 'AA — Top' },
          { valor: 'A',  label: 'A — Pilares' },
          { valor: 'B',  label: 'B — Sólidos' },
          { valor: 'C',  label: 'C — Baja rotación' },
          { valor: 'D',  label: 'D — Cola larga' },
        ],
      },
      render: p => {
        if (!p.clasificacion) {
          return <span className="text-[10px] text-[hsl(var(--text-muted))]">—</span>;
        }
        const c = COLORES_CLASE[p.clasificacion];
        return (
          <span
            className="inline-block min-w-[28px] px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums border"
            style={{ background: c.suave, color: c.base, borderColor: `${c.base}40` }}
            title={`Clase ${p.clasificacion}`}
          >
            {p.clasificacion}
          </span>
        );
      },
    },
    {
      id: 'variantes',
      titulo: 'Variantes',
      width: 140,
      sortValor: p => p.cantidadVariantes,
      render: p => (
        <div>
          <div className="flex items-center gap-1">
            {p.variantes.slice(0, 4).map((v, i) => (
              <span
                key={i}
                className="size-5 rounded-full border border-[hsl(var(--border))] shadow-sm shrink-0"
                title={`${v.talla} · ${v.color}`}
                style={{ backgroundColor: v.colorHex ?? 'var(--surface-2)' }}
              />
            ))}
            {p.variantes.length > 4 && (
              <span className="text-xs text-[hsl(var(--text-muted))] ml-1">+{p.variantes.length - 4}</span>
            )}
          </div>
          <div className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
            {p.cantidadVariantes} variante{p.cantidadVariantes === 1 ? '' : 's'}
          </div>
        </div>
      ),
    },
    {
      id: 'cantidadVentas',
      titulo: 'C. Ventas',
      width: 110,
      align: 'right',
      sortValor: p => p.cantidadVentas,
      filter: { tipo: 'rango', getValor: p => p.cantidadVentas },
      render: p => {
        const cat = colorCategoria(p.categoria.slug ?? p.categoria.nombre);
        return (
          <div className="inline-flex items-center gap-1.5 justify-end">
            <span
              className={p.cantidadVentas === 0 ? 'text-[hsl(var(--text-muted))]' : 'font-semibold'}
              style={p.cantidadVentas > 0 ? { color: cat.base } : undefined}
            >
              {p.cantidadVentas}
            </span>
            <VentasSparkline serie={p.ventasMensuales} total={p.cantidadVentas} color={cat.base} />
          </div>
        );
      },
    },
    {
      id: 'stockTotal',
      titulo: 'Stock',
      width: 90,
      align: 'right',
      sortValor: p => p.stockTotal,
      filter: { tipo: 'rango', getValor: p => p.stockTotal },
      render: p => (
        <span className={p.stockTotal === 0
          ? 'text-[hsl(var(--brand-danger))] font-semibold tabular-nums'
          : 'tabular-nums'}>
          {p.stockTotal}
        </span>
      ),
    },
    {
      id: 'precioVenta',
      titulo: 'Precio',
      width: 110,
      align: 'right',
      sortValor: p => Number(p.precioVenta),
      filter: { tipo: 'rango', getValor: p => Number(p.precioVenta) },
      render: p => <span className="font-semibold tabular-nums">{formatearMoneda(p.precioVenta)}</span>,
    },
    {
      id: 'estado',
      titulo: 'Estado',
      width: 100,
      sortValor: p => (p.activo ? 1 : 0),
      filter: {
        tipo: 'select',
        getValor: p => (p.activo ? 'activos' : 'inactivos'),
        opciones: [
          { valor: 'activos', label: 'Activos' },
          { valor: 'inactivos', label: 'Inactivos' },
        ],
      },
      render: p => p.activo
        ? <Badge variant="success">Activo</Badge>
        : <Badge variant="outline">Inactivo</Badge>,
    },
    {
      id: 'acciones',
      titulo: 'Acciones',
      width: 150,
      align: 'right',
      movible: false,
      cellClassName: 'pr-4',
      render: (p) => confirmandoId === p.id ? (
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-[hsl(var(--text-muted))] mr-1">¿Eliminar?</span>
          <Button variant="outline" size="sm" onClick={() => setConfirmandoId(null)} className="h-7 px-2 text-[10px]">No</Button>
          <Button
            size="sm"
            onClick={() => borrar.mutate(p.id)}
            disabled={borrar.isPending}
            className="h-7 px-2 text-[10px] bg-[hsl(var(--brand-danger))] hover:bg-[hsl(var(--brand-danger))]/90"
          >
            Sí
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1">
          <Button
            asChild variant="ghost" size="icon-sm" title="Ver Kardex"
            className="bg-gradient-to-br from-[#fbbf24] to-[#d97706] text-white shadow-[0_2px_8px_rgba(217,119,6,0.35)] hover:from-[#fcd34d] hover:to-[#f59e0b] border border-amber-600/20"
          >
            <Link href={`/productos/kardex/?id=${p.id}`}><History className="size-3.5" /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" title="Editar">
            <Link href={`/productos/editar/?id=${p.id}`}><Edit2 className="size-3.5" /></Link>
          </Button>
          <Button
            variant="ghost" size="icon-sm" title="Eliminar"
            className="text-[hsl(var(--brand-danger))] hover:bg-[hsl(var(--brand-danger))]/10"
            onClick={() => setConfirmandoId(p.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ], [confirmandoId, borrar, opcionesCategoria]);

  const filas = data?.datos ?? [];
  const filtrosActivos = Object.keys(estadoTabla.filtros ?? {}).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Productos"
        descripcion="Catálogo con variantes (talla, color, material)."
        acciones={
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setMotorAbierto(true)}
              className="relative overflow-hidden border-[hsl(var(--brand-primary))]/40 bg-gradient-to-r from-[hsl(var(--brand-primary))]/10 to-[#ec4899]/10 hover:from-[hsl(var(--brand-primary))]/20 hover:to-[#ec4899]/20"
            >
              <Zap className="size-4 text-[hsl(var(--brand-primary))]" />
              Motor Logístico
            </Button>
            <Button asChild size="lg">
              <Link href="/productos/nuevo"><Plus className="size-4" /> Nuevo producto</Link>
            </Button>
          </>
        }
      />
      <MotorLogisticoModal abierto={motorAbierto} onAbiertoChange={setMotorAbierto} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            data-busqueda
            placeholder="Buscar por nombre, SKU, código o material…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-9"
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

      <Card className="overflow-hidden p-0">
        {isError ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-[hsl(var(--brand-danger))]">No se pudo cargar productos</p>
            <p className="text-xs text-[hsl(var(--text-muted))]">{mensajeError(error)}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
          </div>
        ) : (
          <DataTable<ProductoLista>
            columnas={columnas}
            filas={filas}
            getRowKey={p => p.id}
            estado={estadoTabla}
            onEstadoChange={setEstadoTabla}
            cargando={isLoading}
            renderRowAccent={p => {
              const cat = colorCategoria(p.categoria.slug ?? p.categoria.nombre);
              return (
                <div
                  className="h-full w-1"
                  style={{ background: cat.base, boxShadow: `0 0 10px ${cat.base}40` }}
                  title={p.categoria.nombre}
                />
              );
            }}
            vacioRender={
              <EmptyState
                ilustracion={<IlustracionProductos className="w-full h-full" />}
                titulo={debouncedBuscar ? 'Sin resultados' : 'Aún no hay productos'}
                descripcion={debouncedBuscar
                  ? 'Probá con otra búsqueda o limpiá los filtros.'
                  : 'Crea tu primer producto con variantes de talla y color.'}
                accion={debouncedBuscar ? undefined : { label: '＋ Nuevo producto', href: '/productos/nuevo' }}
              />
            }
          />
        )}
        {data && data.total > 0 && (
          <Pagination
            pagina={data.pagina}
            totalPaginas={data.totalPaginas}
            total={data.total}
            limite={20}
            onCambiar={setPagina}
          />
        )}
      </Card>
    </div>
  );
}
