'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  RotateCcw,
  Ban,
  Receipt,
  User,
  Store,
  Loader2,
  AlertTriangle,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { obtener, postear, mensajeError } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { tienePermiso, useSesion } from '@/lib/store/sesion';

interface NotaDetalle {
  id: string;
  numero: string;
  estado: 'emitida' | 'anulada';
  motivo: string;
  subtotal: string;
  total: string;
  restituyeStock: boolean;
  anuladaEn: string | null;
  motivoAnulacion: string | null;
  creadoEn: string;
  venta: { id: string; numero: string; total: string };
  sucursal: { id: string; nombre: string };
  cliente: { id: string; nombre: string; documento: string | null; tipoDocumento: string } | null;
  emitidaPor: { id: string; nombre: string; email: string };
  items: Array<{
    id: string;
    cantidad: number;
    descripcion: string;
    precioUnitario: string;
    subtotal: string;
    variante: {
      id: string;
      sku: string;
      talla: string;
      color: string;
      producto: { id: string; nombre: string };
    };
  }>;
}

export function NotaCreditoDetalleCliente() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const permisos = useSesion(s => s.usuario?.permisos);

  const [dialogoAnular, setDialogoAnular] = React.useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = React.useState('');

  const { data: nc, isLoading, isError } = useQuery({
    queryKey: ['nota-credito', id],
    queryFn: () => obtener<NotaDetalle>(`/notas-credito/${id}`),
  });

  const anular = useMutation({
    mutationFn: () =>
      postear<NotaDetalle>(`/notas-credito/${id}/anular`, {
        motivo: motivoAnulacion.trim(),
      }),
    onSuccess: () => {
      toast.success('Nota de crédito anulada');
      setDialogoAnular(false);
      setMotivoAnulacion('');
      qc.invalidateQueries({ queryKey: ['nota-credito', id] });
      qc.invalidateQueries({ queryKey: ['notas-credito'] });
      qc.invalidateQueries({ queryKey: ['venta'] });
    },
    onError: err => toast.error(mensajeError(err)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="size-6 animate-spin text-[hsl(var(--brand-primary))]" />
      </div>
    );
  }
  if (isError || !nc) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="size-10 mx-auto text-[hsl(var(--brand-warning))] mb-3" />
        <p className="font-medium">No se pudo cargar la nota de crédito</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/notas-credito"><ArrowLeft className="size-4" /> Volver al listado</Link>
        </Button>
      </div>
    );
  }

  const puedeAnular = tienePermiso(permisos, 'notas-credito:anular') && nc.estado !== 'anulada';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/notas-credito" aria-label="Volver"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="size-9 rounded-lg gradient-brand-accent grid place-items-center">
              <RotateCcw className="size-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">{nc.numero}</h1>
            <Badge variant={nc.estado === 'anulada' ? 'danger' : 'success'}>{nc.estado}</Badge>
          </div>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1 ml-12">
            Emitida {formatearFecha(nc.creadoEn, 'completa')} por {nc.emitidaPor.nombre} ·{' '}
            sobre venta{' '}
            <Link href={`/ventas/${nc.venta.id}`} className="hover:underline font-mono">
              {nc.venta.numero}
            </Link>
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Button>
          {puedeAnular && (
            <Button
              variant="outline"
              className="text-[hsl(var(--brand-danger))] border-[hsl(var(--brand-danger))]/40 hover:bg-[hsl(var(--brand-danger))]/10"
              onClick={() => setDialogoAnular(true)}
            >
              <Ban className="size-4" /> Anular
            </Button>
          )}
        </div>
      </div>

      {nc.estado === 'anulada' && (
        <div className="flex items-start gap-3 rounded-lg border border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)] p-4">
          <Ban className="size-4 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Anulada {nc.anuladaEn && formatearFecha(nc.anuladaEn, 'completa')}</p>
            {nc.motivoAnulacion && (
              <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Motivo: {nc.motivoAnulacion}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-[hsl(var(--border))]">
              <h2 className="font-semibold">Items devueltos</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nc.items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.variante.producto.nombre}</div>
                      <div className="text-xs text-[hsl(var(--text-muted))] font-mono">
                        {item.variante.sku} · {item.variante.talla} · {item.variante.color}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.cantidad}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearMoneda(item.precioUnitario)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatearMoneda(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-4">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-2">Motivo</p>
            <p className="text-sm whitespace-pre-line">{nc.motivo}</p>
            <p className="text-xs text-[hsl(var(--text-muted))] mt-3">
              {nc.restituyeStock
                ? 'Stock restituido al inventario.'
                : 'Stock NO restituido (mercadería descartada).'}
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-baseline justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatearMoneda(nc.subtotal)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-[hsl(var(--border))] pt-3">
              <span className="text-sm font-semibold">Total NC</span>
              <span className="text-2xl font-black tabular-nums">{formatearMoneda(nc.total)}</span>
            </div>
            <div className="text-xs text-[hsl(var(--text-muted))]">
              Venta original:{' '}
              <Link href={`/ventas/${nc.venta.id}`} className="hover:underline font-mono">
                {nc.venta.numero}
              </Link>{' '}
              ({formatearMoneda(nc.venta.total)})
            </div>
          </Card>

          <Card className="p-5 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <User className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Cliente</p>
                {nc.cliente ? (
                  <>
                    <Link href={`/clientes/${nc.cliente.id}`} className="font-medium hover:underline">
                      {nc.cliente.nombre}
                    </Link>
                    {nc.cliente.documento && (
                      <p className="text-xs text-[hsl(var(--text-muted))] font-mono">
                        {nc.cliente.tipoDocumento.toUpperCase()} {nc.cliente.documento}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[hsl(var(--text-muted))]">Consumidor final</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Store className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
              <div>
                <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Sucursal</p>
                <p className="font-medium">{nc.sucursal.nombre}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Receipt className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
              <div>
                <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Emitida por</p>
                <p className="font-medium">{nc.emitidaPor.nombre}</p>
                <p className="text-xs text-[hsl(var(--text-muted))]">{nc.emitidaPor.email}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={dialogoAnular} onOpenChange={setDialogoAnular}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular nota de crédito {nc.numero}</DialogTitle>
            <DialogDescription>
              {nc.restituyeStock
                ? 'Esta acción saca del stock las unidades restituidas y devuelve el monto al totalCompras del cliente.'
                : 'Esta acción devuelve el monto al totalCompras del cliente.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="motivo">Motivo</label>
            <Textarea
              id="motivo"
              value={motivoAnulacion}
              onChange={e => setMotivoAnulacion(e.target.value)}
              placeholder="Ej: NC emitida por error"
              rows={3}
              maxLength={500}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogoAnular(false)}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={!motivoAnulacion.trim() || anular.isPending}
              onClick={() => anular.mutate()}
            >
              {anular.isPending ? 'Anulando…' : 'Confirmar anulación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
