'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Edit2,
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
import { eliminar, mensajeError, obtenerPaginado } from '@/lib/api/client';
import { formatearMoneda, formatearNumero } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type ColumnaTabla, type TableState } from '@/components/ui/data-table';
import { usePreferencias } from '@/lib/use-preferencias';
import { LinkWhatsApp } from '@/components/ui/link-whatsapp';
import { ReportesBoton } from '@/components/reportes/reportes-boton';
import { NuevoProveedorContenido } from './nuevo/page';
import { EditarProveedorCliente } from './editar/editar-cliente';

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

/** Campo etiqueta + valor para el panel expandible. */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))]">{label}</div>
      <div className="text-sm mt-0.5 break-words">{children}</div>
    </div>
  );
}

const VACIO = <span className="text-[hsl(var(--text-muted))]">—</span>;

/**
 * Panel de detalle bajo la fila. Muestra TODOS los campos, incluidos los que se
 * ocultan como columnas en pantallas chicas (contacto, email, teléfono, ciudad,
 * dirección, condición, etc.) — así nada queda inaccesible en laptops.
 */
function DetalleProveedor({ p }: { p: Proveedor }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
      <Campo label="Contacto">{p.contacto || VACIO}</Campo>
      <Campo label="Email">
        {p.email
          ? <a href={`mailto:${p.email}`} className="text-[hsl(var(--brand-primary))] hover:underline break-all">{p.email}</a>
          : VACIO}
      </Campo>
      <Campo label="Teléfono"><LinkWhatsApp telefono={p.telefono} className="text-sm" /></Campo>
      <Campo label="Ciudad">{p.ciudad || VACIO}</Campo>
      <Campo label="Dirección">{p.direccion || VACIO}</Campo>
      <Campo label="Nombre comercial">{p.nombreComercial || VACIO}</Campo>
      <Campo label="Condición de pago">
        <Badge variant={p.condicionPago === 'contado' ? 'default' : 'warning'}>
          {CONDICION_LABEL[p.condicionPago] ?? p.condicionPago}
          {p.condicionPago !== 'contado' && p.diasCredito > 0 ? ` · ${p.diasCredito}d` : ''}
        </Badge>
      </Campo>
      <Campo label="Cuenta bancaria">
        {p.cuentaBancaria ? <span className="font-mono text-xs">{p.cuentaBancaria}</span> : VACIO}
      </Campo>
      <Campo label="Total comprado"><span className="tabular-nums">{formatearMoneda(p.totalComprado)}</span></Campo>
      <Campo label="Deuda actual">
        {Number(p.deudaActual) > 0
          ? <span className="tabular-nums font-semibold text-[hsl(355_75%_60%)]">{formatearMoneda(p.deudaActual)}</span>
          : VACIO}
      </Campo>
      {p.tags && p.tags.length > 0 && (
        <Campo label="Tags">
          <div className="flex flex-wrap gap-1">
            {p.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
          </div>
        </Campo>
      )}
      {p.notas && (
        <div className="col-span-2 md:col-span-3 lg:col-span-4">
          <Campo label="Notas">{p.notas}</Campo>
        </div>
      )}
    </div>
  );
}

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
  const [filaExpandida, setFilaExpandida] = React.useState<string | null>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estado del modal de alta/edición — soporta deep-link vía ?nuevo=1 o ?editar=<id>.
  const modal: ModalProveedores = React.useMemo(() => {
    if (searchParams.get('nuevo') === '1') return { tipo: 'nuevo' };
    const editarId = searchParams.get('editar');
    if (editarId) return { tipo: 'editar', id: editarId };
    return null;
  }, [searchParams]);

  const abrirNuevo = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('editar'); sp.set('nuevo', '1');
    router.replace(`/proveedores?${sp.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const abrirEditar = React.useCallback((id: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('nuevo'); sp.set('editar', id);
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
      width: 88,
      align: 'right',
      movible: false,
      cellClassName: 'pr-4',
      render: p => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${p.razonSocial}`}
            onClick={() => abrirEditar(p.id)}
          >
            <Edit2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar ${p.razonSocial}`}
            onClick={() => setAEliminar(p)}
            className="text-[hsl(355_75%_65%)] hover:text-[hsl(355_75%_75%)] hover:bg-[hsl(355_75%_55%/0.1)]"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ], [pagina, opcionesCiudad, abrirEditar]);

  const filtrosActivos = Object.keys(estadoTabla.filtros ?? {}).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Proveedores"
        descripcion="Quiénes te abastecen, sus condiciones de pago y deuda pendiente."
        acciones={
          <div className="flex items-center gap-2">
            <ReportesBoton
              recurso="proveedores"
              conRango={false}
              filtros={{ buscar: debounced || undefined }}
            />
            <Button size="lg" onClick={abrirNuevo} data-testid="btn-abrir-nuevo-proveedor">
              <Plus className="size-4" /> Nuevo proveedor
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
            filaExpandidaKey={filaExpandida}
            onToggleFilaExpandida={key => setFilaExpandida(k => (k === key ? null : key))}
            renderFilaExpandida={p => <DetalleProveedor p={p} />}
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
