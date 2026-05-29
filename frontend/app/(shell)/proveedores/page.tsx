'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Edit2,
  Eye,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DetalleSheet } from '@/components/ui/sheet';
import { eliminar, mensajeError, obtenerPaginado } from '@/lib/api/client';
import { formatearMoneda, formatearNumero } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type ColumnaTabla, type TableState } from '@/components/ui/data-table';
import { usePreferencias } from '@/lib/use-preferencias';
import { LinkWhatsApp } from '@/components/ui/link-whatsapp';
import { NuevoProveedorContenido } from './nuevo/page';
import { EditarProveedorCliente } from './editar/editar-cliente';
import { ProveedorDetalle } from './proveedor-detalle';

type ModalProveedores =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; id: string }
  | null;

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

const CONDICION_LABEL: Record<string, string> = {
  contado: 'Contado',
  credito_15: '15 días',
  credito_30: '30 días',
  credito_60: '60 días',
  credito_otro: 'Otro',
};

const OPCIONES_CONDICION = Object.entries(CONDICION_LABEL).map(([valor, label]) => ({ valor, label }));

const ESTADO_DEFAULT: TableState = {
  sort: { campo: 'razonSocial', dir: 'asc' },
};

const LIMITE = 30;

export default function ProveedoresPage() {
  return (
    <React.Suspense fallback={null}>
      <ProveedoresPageContenido />
    </React.Suspense>
  );
}

function ProveedoresPageContenido() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debounced, setDebounced] = React.useState('');
  const [aEliminar, setAEliminar] = React.useState<Proveedor | null>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verId = searchParams.get('ver');

  // Estado del modal de alta/edición — soporta deep-link vía ?nuevo=1 o ?editar=<id>.
  const modal: ModalProveedores = React.useMemo(() => {
    if (searchParams.get('nuevo') === '1') return { tipo: 'nuevo' };
    const editarId = searchParams.get('editar');
    if (editarId) return { tipo: 'editar', id: editarId };
    return null;
  }, [searchParams]);

  // Drawer de ficha de lectura (?ver=<id>).
  const [proveedorAbierto, setProveedorAbierto] = React.useState<{ id: string; razonSocial?: string } | null>(
    verId ? { id: verId } : null,
  );
  const pusheamos = React.useRef(false);

  React.useEffect(() => {
    if (verId) {
      setProveedorAbierto(prev => (prev?.id === verId ? prev : { id: verId }));
    } else {
      setProveedorAbierto(null);
      pusheamos.current = false;
    }
  }, [verId]);

  const abrir = React.useCallback(
    (id: string, razonSocial?: string) => {
      setProveedorAbierto({ id, razonSocial });
      pusheamos.current = true;
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete('nuevo'); sp.delete('editar'); sp.set('ver', id);
      router.push(`/proveedores?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const cerrar = React.useCallback(() => {
    setProveedorAbierto(null);
    if (pusheamos.current) {
      pusheamos.current = false;
      router.back();
    } else {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete('ver');
      const qs = sp.toString();
      router.replace(`/proveedores${qs ? `?${qs}` : ''}`, { scroll: false });
    }
  }, [router, searchParams]);

  const abrirNuevo = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('editar'); sp.delete('ver'); sp.set('nuevo', '1');
    router.replace(`/proveedores?${sp.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const abrirEditar = React.useCallback((id: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('nuevo'); sp.delete('ver'); sp.set('editar', id);
    router.replace(`/proveedores?${sp.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const cerrarModal = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('nuevo'); sp.delete('editar');
    const qs = sp.toString();
    router.replace(`/proveedores${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router, searchParams]);

  const [estadoTabla, setEstadoTabla] = usePreferencias<TableState>('proveedores', ESTADO_DEFAULT);

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
    queryKey: ['proveedores', debounced, pagina],
    queryFn: () =>
      obtenerPaginado<Proveedor>('/proveedores', {
        limite: LIMITE,
        pagina,
        ...(debounced ? { buscar: debounced } : {}),
      }),
    retry: 1,
  });

  const mutarEliminar = useMutation({
    mutationFn: (id: string) => eliminar(`/proveedores/${id}`),
    onSuccess: () => {
      toast.success('Proveedor eliminado');
      setAEliminar(null);
      qc.invalidateQueries({ queryKey: ['proveedores'] });
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

  const columnas = React.useMemo<ColumnaTabla<Proveedor>[]>(() => [
    {
      id: 'numero',
      titulo: 'N°',
      width: 44,
      minWidth: 40,
      align: 'right',
      movible: false,
      render: (_p, idx) => (
        <span className="text-[10px] text-[hsl(var(--text-muted))] tabular-nums">
          {(pagina - 1) * LIMITE + idx + 1}
        </span>
      ),
    },
    {
      id: 'codigo',
      titulo: 'Código',
      width: 80,
      minWidth: 68,
      sortValor: p => p.codigo ?? '',
      filter: { tipo: 'texto', getValor: p => p.codigo ?? '' },
      render: p => (
        <span className="font-mono text-xs font-semibold text-[hsl(var(--brand-primary))]">
          {p.codigo ?? '—'}
        </span>
      ),
    },
    {
      id: 'razonSocial',
      titulo: 'Razón social',
      width: 184,
      minWidth: 140,
      sortValor: p => p.razonSocial,
      filter: { tipo: 'texto', getValor: p => p.razonSocial },
      render: p => (
        <div className="min-w-0">
          <div className="font-semibold truncate">{p.razonSocial}</div>
          {p.nombreComercial && (
            <div className="text-xs text-[hsl(var(--text-muted))] truncate">{p.nombreComercial}</div>
          )}
        </div>
      ),
    },
    {
      id: 'documento',
      titulo: 'Documento',
      width: 112,
      minWidth: 96,
      sortValor: p => p.documento,
      filter: { tipo: 'texto', getValor: p => p.documento },
      render: p => (
        <div className="font-mono text-xs">
          <div className="uppercase text-[10px] text-[hsl(var(--text-muted))]">{p.tipoDocumento}</div>
          <div>{p.documento}</div>
        </div>
      ),
    },
    {
      id: 'condicionPago',
      titulo: 'Condición',
      width: 108,
      colClassName: 'hidden lg:table-cell',
      sortValor: p => p.condicionPago,
      filter: { tipo: 'select', getValor: p => p.condicionPago, opciones: OPCIONES_CONDICION },
      render: p => (
        <Badge variant={p.condicionPago === 'contado' ? 'default' : 'warning'}>
          {CONDICION_LABEL[p.condicionPago] ?? p.condicionPago}
          {p.condicionPago !== 'contado' && p.diasCredito > 0 ? ` · ${p.diasCredito}d` : ''}
        </Badge>
      ),
    },
    {
      id: 'totalComprado',
      titulo: 'Comprado',
      width: 110,
      align: 'right',
      colClassName: 'hidden 2xl:table-cell',
      sortValor: p => Number(p.totalComprado),
      filter: { tipo: 'rango', getValor: p => Number(p.totalComprado) },
      render: p => (
        <span className="tabular-nums">{formatearMoneda(p.totalComprado)}</span>
      ),
    },
    {
      id: 'deudaActual',
      titulo: 'Deuda',
      width: 100,
      align: 'right',
      sortValor: p => Number(p.deudaActual),
      filter: { tipo: 'rango', getValor: p => Number(p.deudaActual) },
      render: p => Number(p.deudaActual) > 0
        ? <span className="tabular-nums font-semibold text-[hsl(355_75%_60%)]">{formatearMoneda(p.deudaActual)}</span>
        : <span className="text-[hsl(var(--text-muted))] tabular-nums">—</span>,
    },
    {
      id: 'telefono',
      titulo: 'Teléfono',
      width: 120,
      colClassName: 'hidden xl:table-cell',
      sortValor: p => p.telefono ?? '',
      filter: { tipo: 'texto', getValor: p => p.telefono ?? '' },
      render: p => (
        <LinkWhatsApp telefono={p.telefono} className="text-sm" />
      ),
    },
    {
      id: 'ciudad',
      titulo: 'Ciudad',
      width: 104,
      colClassName: 'hidden 2xl:table-cell',
      sortValor: p => p.ciudad ?? '',
      filter: { tipo: 'select', getValor: p => p.ciudad ?? '', opciones: opcionesCiudad },
      render: p => p.ciudad
        ? <span className="text-sm">{p.ciudad}</span>
        : <span className="text-[hsl(var(--text-muted))]">—</span>,
    },
    {
      id: 'estado',
      titulo: 'Estado',
      width: 88,
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
      width: 80,
      align: 'right',
      movible: false,
      cellClassName: 'pr-4',
      render: p => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ver ${p.razonSocial}`}
            title="Ver ficha"
            onClick={() => abrir(p.id, p.razonSocial)}
            data-testid="btn-ver-proveedor"
          >
            <Eye className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Más acciones">
                <MoreVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => abrirEditar(p.id)}>
                <Edit2 /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variante="danger" onSelect={() => setAEliminar(p)}>
                <Trash2 /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [pagina, opcionesCiudad, abrirEditar, abrir]);

  const filtrosActivos = Object.keys(estadoTabla.filtros ?? {}).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Proveedores"
        descripcion="Quiénes te abastecen, sus condiciones de pago y deuda pendiente."
        acciones={
          <Button size="lg" onClick={abrirNuevo} data-testid="btn-abrir-nuevo-proveedor">
            <Plus className="size-4" /> Nuevo proveedor
          </Button>
        }
      />

      {/* Toolbar estándar — rounded-xl + border + bg-surface (DIH ERP look) */}
      <div className="mt-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
            <Input
              data-busqueda
              placeholder="Buscar por razón social, RUC/DNI, contacto, email…"
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              className="pl-9"
              aria-label="Buscar proveedores"
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
      </div>

      {isError && (
        <Card className="p-4 border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-[hsl(355_75%_85%)]">No se pudieron cargar los proveedores</div>
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
          <DataTable<Proveedor>
            columnas={columnas}
            filas={filas}
            getRowKey={p => p.id}
            estado={estadoTabla}
            onEstadoChange={setEstadoTabla}
            cargando={isLoading}
            rowClassName={p => (p.activo ? '' : 'opacity-60')}
            onFilaClick={p => abrir(p.id, p.razonSocial)}
            vacioRender={
              <EmptyState
                ilustracion={<Truck className="size-20 text-[hsl(var(--brand-primary))/60]" />}
                titulo={debounced ? 'Sin resultados' : 'Aún no registraste proveedores'}
                descripcion={
                  debounced
                    ? `No encontramos proveedores que coincidan con "${debounced}".`
                    : 'Agrega a tus proveedores para registrar compras y seguir tus cuentas por pagar.'
                }
                accion={
                  debounced
                    ? undefined
                    : { label: '＋ Nuevo proveedor', onClick: abrirNuevo }
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

      <DetalleSheet
        open={!!proveedorAbierto}
        onOpenChange={o => { if (!o) cerrar(); }}
        titulo={proveedorAbierto?.razonSocial ?? 'Proveedor'}
        subtitulo="Ficha del proveedor"
        icono={<Truck className="size-4" />}
        ancho="2xl"
      >
        {proveedorAbierto && (
          <ProveedorDetalle proveedorId={proveedorAbierto.id} onEditar={abrirEditar} />
        )}
      </DetalleSheet>

      <Dialog open={!!aEliminar} onOpenChange={o => !o && setAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar proveedor</DialogTitle>
            <DialogDescription>
              Vas a eliminar <strong>{aEliminar?.razonSocial}</strong>. Esto es un borrado
              lógico: el proveedor desaparece del listado pero su historial de compras
              se conserva. No podrá registrarse otro proveedor con el mismo documento.
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

      {/* Modal "Nuevo proveedor" */}
      <Dialog open={modal?.tipo === 'nuevo'} onOpenChange={a => !a && cerrarModal()}>
        <DialogContent
          className="max-w-3xl w-[min(95vw,48rem)] max-h-[92vh] overflow-y-auto p-6"
          data-testid="modal-nuevo-proveedor"
        >
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
            <DialogDescription>
              Registra los datos fiscales y de contacto. Se valida el formato del RUC/DNI/email antes de guardar.
            </DialogDescription>
          </DialogHeader>
          {modal?.tipo === 'nuevo' && (
            <NuevoProveedorContenido modoModal onCerrar={cerrarModal} />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal "Editar proveedor" */}
      <Dialog open={modal?.tipo === 'editar'} onOpenChange={a => !a && cerrarModal()}>
        <DialogContent
          className="max-w-5xl w-[min(95vw,72rem)] max-h-[92vh] overflow-y-auto p-6"
          data-testid="modal-editar-proveedor"
        >
          <DialogTitle className="sr-only">Editar proveedor</DialogTitle>
          <DialogDescription className="sr-only">
            Formulario para editar datos del proveedor, ver historial de compras y stats.
          </DialogDescription>
          {modal?.tipo === 'editar' && (
            <EditarProveedorCliente
              idForzado={modal.id}
              modoModal
              onCerrar={cerrarModal}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
