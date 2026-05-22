'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  AlertTriangle,
  History,
  Plus,
  Minus,
  ArrowLeftRight,
  Settings2,
  Check,
  X,
  Trash,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtener, obtenerPaginado, postear, actualizar, mensajeError } from '@/lib/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { IlustracionInventario } from '@/components/ui/empty-illustrations';
import { cn } from '@/lib/utils';

interface Sucursal { id: string; nombre: string; codigo: string }

interface StockItem {
  id: string;
  disponible: number;
  reservado: number;
  stockMinimo: number;
  ubicacion: string | null;
  varianteId: string;
  sucursalId: string;
  variante: {
    id: string;
    sku: string;
    talla: string;
    color: string;
    colorHex?: string | null;
    codigoBarras?: string | null;
    producto: { id: string; sku: string; nombre: string; imagenes: string[]; codigo: string | null };
  };
  sucursal: { id: string; nombre: string; codigo: string };
}

type ModalAjuste =
  | { tipo: 'ajuste'; item: StockItem; signo: 'ingreso' | 'egreso' }
  | { tipo: 'merma'; item: StockItem }
  | { tipo: 'traslado'; item: StockItem }
  | null;

export default function InventarioPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debounced, setDebounced] = React.useState('');
  const [sucursalId, setSucursalId] = React.useState('');
  const [soloAlertas, setSoloAlertas] = React.useState(false);
  const [modal, setModal] = React.useState<ModalAjuste>(null);
  const [editandoMinimoId, setEditandoMinimoId] = React.useState<string | null>(null);

  const qc = useQueryClient();

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(buscar), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  React.useEffect(() => {
    setPagina(1);
  }, [debounced, sucursalId, soloAlertas]);

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stock', debounced, pagina, sucursalId, soloAlertas],
    queryFn: () =>
      obtenerPaginado<StockItem>('/inventario/stock', {
        limite: 50,
        pagina,
        ...(debounced ? { buscar: debounced } : {}),
        ...(sucursalId ? { sucursalId } : {}),
        ...(soloAlertas ? { soloAlertas: 'true' } : {}),
      }),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Inventario"
        descripcion="Stock por variante y sucursal. Ajustes, mermas y traslados."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            data-busqueda
            placeholder="Buscar producto, SKU o código de barras…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={sucursalId}
          onChange={e => setSucursalId(e.target.value)}
          className="w-auto min-w-[180px]"
          aria-label="Filtrar por sucursal"
        >
          <option value="">Todas las sucursales</option>
          {sucursales?.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </Select>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
          <input
            type="checkbox"
            checked={soloAlertas}
            onChange={e => setSoloAlertas(e.target.checked)}
            className="size-4 accent-[hsl(var(--brand-warning))]"
          />
          <AlertTriangle className="size-4 text-[hsl(var(--brand-warning))]" />
          Solo alertas
        </label>
        {data && (
          <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums ml-auto">
            {data.total} resultado{data.total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead>Código barras</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead className="text-right">Reservado</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right pr-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    {Array(9).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError || !data ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-10 text-center">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-[hsl(var(--brand-danger))]">
                        No se pudo cargar el inventario
                      </p>
                      <p className="text-xs text-[hsl(var(--text-muted))]">{mensajeError(error)}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                        Reintentar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.datos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <EmptyState
                      ilustracion={<IlustracionInventario className="w-full h-full" />}
                      titulo={debounced || sucursalId || soloAlertas ? 'Sin resultados' : 'Sin stock registrado'}
                      descripcion={
                        debounced || sucursalId || soloAlertas
                          ? 'Probá con otros filtros.'
                          : 'El inventario aparecerá aquí cuando crees productos con variantes y movimientos.'
                      }
                      accion={debounced || sucursalId || soloAlertas ? undefined : { label: 'Ir a Productos', href: '/productos' }}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.datos.map(s => {
                  const critico = s.stockMinimo > 0 && s.disponible <= s.stockMinimo;
                  const agotado = s.disponible === 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.variante.producto.nombre}</div>
                        <div className="text-xs text-[hsl(var(--text-muted))] font-mono">
                          {s.variante.producto.codigo ?? s.variante.producto.sku}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="size-4 rounded-full border border-[hsl(var(--border))] shrink-0"
                            style={{ backgroundColor: s.variante.colorHex ?? 'var(--surface-2)' }}
                          />
                          <span className="text-sm">{s.variante.talla} · {s.variante.color}</span>
                        </div>
                        <div className="text-[10px] text-[hsl(var(--text-muted))] font-mono mt-0.5">{s.variante.sku}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.variante.codigoBarras ?? '—'}</TableCell>
                      <TableCell>{s.sucursal.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">
                        <span className={agotado ? 'text-[hsl(var(--brand-danger))]' : critico ? 'text-[hsl(var(--brand-warning))]' : ''}>
                          {s.disponible}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-[hsl(var(--text-muted))]">{s.reservado}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {editandoMinimoId === s.id ? (
                          <EditMinimoInline
                            stock={s}
                            onCancel={() => setEditandoMinimoId(null)}
                            onSaved={() => {
                              setEditandoMinimoId(null);
                              void qc.invalidateQueries({ queryKey: ['stock'] });
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditandoMinimoId(s.id)}
                            className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))] underline-offset-2 hover:underline tabular-nums"
                            title="Editar stock mínimo"
                          >
                            {s.stockMinimo}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        {agotado ? (
                          <Badge variant="danger"><AlertTriangle className="size-3 mr-1" />Agotado</Badge>
                        ) : critico ? (
                          <Badge variant="warning">Bajo</Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="inline-flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Ingresar stock"
                            onClick={() => setModal({ tipo: 'ajuste', item: s, signo: 'ingreso' })}
                            className="text-[hsl(var(--brand-success))] hover:bg-[hsl(var(--brand-success))]/10"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Retirar stock"
                            onClick={() => setModal({ tipo: 'ajuste', item: s, signo: 'egreso' })}
                            className="text-[hsl(var(--brand-warning))] hover:bg-[hsl(var(--brand-warning))]/10"
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Trasladar a otra sucursal"
                            onClick={() => setModal({ tipo: 'traslado', item: s })}
                          >
                            <ArrowLeftRight className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Registrar merma"
                            onClick={() => setModal({ tipo: 'merma', item: s })}
                            className="text-[hsl(var(--brand-danger))] hover:bg-[hsl(var(--brand-danger))]/10"
                          >
                            <Trash className="size-3.5" />
                          </Button>
                          <Button asChild variant="ghost" size="icon-sm" title="Ver kardex">
                            <Link href={`/productos/kardex/?id=${s.variante.producto.id}`}>
                              <History className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {data && data.total > 0 && (
          <Pagination
            pagina={data.pagina}
            totalPaginas={data.totalPaginas}
            total={data.total}
            limite={50}
            onCambiar={setPagina}
          />
        )}
      </Card>

      {modal && (
        <ModalAjusteInventario
          modal={modal}
          sucursales={sucursales ?? []}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            void qc.invalidateQueries({ queryKey: ['stock'] });
          }}
        />
      )}
    </div>
  );
}

function EditMinimoInline({
  stock,
  onCancel,
  onSaved,
}: {
  stock: StockItem;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [valor, setValor] = React.useState(stock.stockMinimo.toString());

  const guardar = useMutation({
    mutationFn: () =>
      actualizar(`/inventario/stock/${stock.id}`, {
        stockMinimo: Number(valor) || 0,
      }),
    onSuccess: () => {
      toast.success('Stock mínimo actualizado');
      onSaved();
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <div className="inline-flex items-center gap-1">
      <Input
        type="number"
        min="0"
        value={valor}
        onChange={e => setValor(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') guardar.mutate();
          if (e.key === 'Escape') onCancel();
        }}
        className="h-7 w-16 text-xs text-right tabular-nums"
        autoFocus
      />
      <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} title="Cancelar">
        <X className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        onClick={() => guardar.mutate()}
        disabled={guardar.isPending}
        title="Guardar"
      >
        <Check className="size-3.5" />
      </Button>
    </div>
  );
}

function ModalAjusteInventario({
  modal,
  sucursales,
  onClose,
  onDone,
}: {
  modal: NonNullable<ModalAjuste>;
  sucursales: Sucursal[];
  onClose: () => void;
  onDone: () => void;
}) {
  const item = modal.item;
  const [cantidad, setCantidad] = React.useState('1');
  const [motivo, setMotivo] = React.useState('');
  const [sucursalDestinoId, setSucursalDestinoId] = React.useState(
    sucursales.find(s => s.id !== item.sucursalId)?.id ?? '',
  );

  const titulo =
    modal.tipo === 'merma'
      ? 'Registrar merma'
      : modal.tipo === 'traslado'
        ? 'Trasladar a otra sucursal'
        : modal.signo === 'ingreso'
          ? 'Ingresar stock'
          : 'Retirar stock';

  const guardar = useMutation({
    mutationFn: () => {
      const n = Number(cantidad);
      if (!n || n <= 0) throw new Error('La cantidad debe ser mayor a 0');
      if (modal.tipo === 'ajuste') {
        return postear('/inventario/ajustes', {
          varianteId: item.varianteId,
          sucursalId: item.sucursalId,
          delta: n,
          tipo: modal.signo === 'ingreso' ? 'ingreso_ajuste' : 'egreso_ajuste',
          motivo: motivo.trim() || undefined,
        });
      }
      if (modal.tipo === 'merma') {
        if (!motivo.trim()) throw new Error('El motivo de la merma es obligatorio');
        return postear('/inventario/mermas', {
          varianteId: item.varianteId,
          sucursalId: item.sucursalId,
          cantidad: n,
          motivo: motivo.trim(),
        });
      }
      // traslado
      if (!sucursalDestinoId) throw new Error('Selecciona una sucursal destino');
      return postear('/inventario/traslados', {
        varianteId: item.varianteId,
        sucursalOrigenId: item.sucursalId,
        sucursalDestinoId,
        cantidad: n,
        motivo: motivo.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(
        modal.tipo === 'merma'
          ? 'Merma registrada'
          : modal.tipo === 'traslado'
            ? 'Traslado realizado'
            : 'Ajuste registrado',
      );
      onDone();
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {item.variante.producto.nombre} · {item.variante.talla}/{item.variante.color}
            {modal.tipo !== 'traslado' && ` · ${item.sucursal.nombre}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-muted))]">Stock actual ({item.sucursal.nombre})</span>
              <span className="font-bold tabular-nums">{item.disponible}</span>
            </div>
          </div>

          {modal.tipo === 'traslado' && (
            <div className="space-y-1.5">
              <Label htmlFor="destino">Sucursal destino</Label>
              <Select
                id="destino"
                value={sucursalDestinoId}
                onChange={e => setSucursalDestinoId(e.target.value)}
              >
                <option value="" disabled>Selecciona…</option>
                {sucursales
                  .filter(s => s.id !== item.sucursalId)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cantidad">Cantidad</Label>
            <Input
              id="cantidad"
              type="number"
              min="1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              autoFocus
            />
            {modal.tipo === 'ajuste' && (
              <p className={cn(
                'text-[10px]',
                modal.signo === 'ingreso' ? 'text-[hsl(var(--brand-success))]' : 'text-[hsl(var(--brand-warning))]',
              )}>
                Nuevo disponible: {item.disponible + (modal.signo === 'ingreso' ? 1 : -1) * (Number(cantidad) || 0)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">
              Motivo {modal.tipo === 'merma' ? '*' : '(opcional)'}
            </Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              placeholder={
                modal.tipo === 'merma'
                  ? 'Ej. Dañado en almacén, robo, vencimiento…'
                  : 'Razón del ajuste'
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending}
            className={cn(
              modal.tipo === 'merma' && 'bg-[hsl(var(--brand-danger))] hover:bg-[hsl(var(--brand-danger))]/90',
            )}
          >
            {guardar.isPending ? 'Guardando…' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
