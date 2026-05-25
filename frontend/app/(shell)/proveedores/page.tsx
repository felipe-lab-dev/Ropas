'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Edit2,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { eliminar, mensajeError, obtenerPaginado } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';

interface Proveedor {
  id: string;
  razonSocial: string;
  nombreComercial?: string | null;
  tipoDocumento: string;
  documento: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  ciudad?: string | null;
  condicionPago: string;
  diasCredito: number;
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

export default function ProveedoresPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debounced, setDebounced] = React.useState('');
  const [aEliminar, setAEliminar] = React.useState<Proveedor | null>(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
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
    queryKey: ['proveedores', debounced, pagina],
    queryFn: () =>
      obtenerPaginado<Proveedor>('/proveedores', {
        limite: 30,
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

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Proveedores"
        descripcion="Quiénes te abastecen, sus condiciones de pago y deuda pendiente."
        acciones={
          <Button asChild size="lg">
            <Link href="/proveedores/nuevo"><Plus className="size-4" /> Nuevo proveedor</Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
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

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Condición</TableHead>
              <TableHead className="text-right">Comprado</TableHead>
              <TableHead className="text-right">Deuda</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right pr-4 w-[120px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  {Array(8).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !isError && filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
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
                        : { label: '＋ Nuevo proveedor', href: '/proveedores/nuevo' }
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filas.map(p => (
                <TableRow key={p.id} className={!p.activo ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="font-semibold">{p.razonSocial}</div>
                    {p.nombreComercial && (
                      <div className="text-xs text-[hsl(var(--text-muted))]">{p.nombreComercial}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="uppercase text-[hsl(var(--text-muted))]">{p.tipoDocumento}</div>
                    <div>{p.documento}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{p.contacto ?? '—'}</div>
                    {(p.telefono || p.email) && (
                      <div className="text-xs text-[hsl(var(--text-muted))] flex items-center gap-1 mt-0.5">
                        {p.telefono && <><Phone className="size-3" /> {p.telefono}</>}
                        {!p.telefono && p.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.condicionPago === 'contado' ? 'default' : 'warning'}>
                      {CONDICION_LABEL[p.condicionPago] ?? p.condicionPago}
                      {p.condicionPago !== 'contado' && p.diasCredito > 0 ? ` · ${p.diasCredito}d` : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(p.totalComprado)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {Number(p.deudaActual) > 0 ? (
                      <span className="text-[hsl(355_75%_60%)]">{formatearMoneda(p.deudaActual)}</span>
                    ) : (
                      <span className="text-[hsl(var(--text-muted))]">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.activo ? 'success' : 'outline'}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`Editar ${p.razonSocial}`}>
                        <Link href={`/proveedores/editar/?id=${p.id}`}><Edit2 className="size-3.5" /></Link>
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
                  </TableCell>
                </TableRow>
              ))
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
    </div>
  );
}
