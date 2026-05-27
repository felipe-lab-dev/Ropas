'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Receipt,
  Tag,
  User,
  Store,
  CreditCard,
  AlertTriangle,
  Loader2,
  Plus,
  RotateCcw,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import { tienePermiso } from '@/lib/store/sesion';
import { useSesion } from '@/lib/store/sesion';

type EstadoVenta = 'borrador' | 'confirmada' | 'pagada' | 'parcial' | 'anulada';

interface VentaDetalle {
  id: string;
  numero: string;
  estado: EstadoVenta;
  subtotal: string;
  descuento: string;
  descuentoCupon: string;
  impuestos: string;
  total: string;
  totalPagado: string;
  notas: string | null;
  creadoEn: string;
  anuladaEn: string | null;
  motivoAnulacion: string | null;
  cuponCodigo: string | null;
  sucursal: { id: string; nombre: string };
  vendedor: { id: string; nombre: string; email: string };
  cliente: { id: string; nombre: string; documento: string; tipoDocumento: string } | null;
  items: Array<{
    id: string;
    cantidad: number;
    descripcion: string;
    precioUnitario: string;
    descuento: string;
    subtotal: string;
    variante: {
      id: string;
      sku: string;
      talla: string;
      color: string;
      producto: { id: string; nombre: string };
    };
    notasCreditoItems?: Array<{ cantidad: number; notaCreditoId: string }>;
  }>;
  pagos: Array<{
    id: string;
    medio: string;
    monto: string;
    referencia: string | null;
    recibidoEn: string;
  }>;
  cupon: {
    id: string;
    codigo: string;
    tipoDescuento: string;
    valorDescuento: string;
  } | null;
  notasCredito?: Array<{
    id: string;
    numero: string;
    estado: 'emitida' | 'anulada';
    motivo: string;
    total: string;
    creadoEn: string;
  }>;
}

const ESTADO_BADGE = {
  borrador: 'outline',
  confirmada: 'default',
  pagada: 'success',
  parcial: 'warning',
  anulada: 'danger',
} as const;

const MEDIO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta_debito: 'Tarjeta débito',
  tarjeta_credito: 'Tarjeta crédito',
  pix: 'PIX',
  transferencia: 'Transferencia',
  yape: 'Yape',
  plin: 'Plin',
  otro: 'Otro',
};

export function VentaDetalleCliente() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const permisos = useSesion(s => s.usuario?.permisos);

  const [dialogoAnular, setDialogoAnular] = React.useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = React.useState('');

  const [dialogoPago, setDialogoPago] = React.useState(false);
  const [pagoMonto, setPagoMonto] = React.useState('');
  const [pagoMedio, setPagoMedio] = React.useState<string>('efectivo');
  const [pagoReferencia, setPagoReferencia] = React.useState('');

  const [dialogoNC, setDialogoNC] = React.useState(false);
  const [ncMotivo, setNcMotivo] = React.useState('');
  const [ncRestituyeStock, setNcRestituyeStock] = React.useState(true);
  const [ncCantidades, setNcCantidades] = React.useState<Record<string, number>>({});

  const { data: venta, isLoading, isError } = useQuery({
    queryKey: ['venta', id],
    queryFn: () => obtener<VentaDetalle>(`/ventas/${id}`),
  });

  const anular = useMutation({
    mutationFn: () =>
      postear<VentaDetalle>(`/ventas/${id}/anular`, { motivo: motivoAnulacion.trim() }),
    onSuccess: () => {
      toast.success('Venta anulada');
      setDialogoAnular(false);
      setMotivoAnulacion('');
      qc.invalidateQueries({ queryKey: ['venta', id] });
      qc.invalidateQueries({ queryKey: ['ventas'] });
    },
    onError: err => toast.error(mensajeError(err)),
  });

  const registrarPago = useMutation({
    mutationFn: () =>
      postear<{ estado: string; totalPagado: number }>(`/ventas/${id}/pagos`, {
        medio: pagoMedio,
        monto: parseFloat(pagoMonto),
        referencia: pagoReferencia.trim() || undefined,
      }),
    onSuccess: data => {
      toast.success(data.estado === 'pagada' ? 'Venta saldada' : 'Pago registrado');
      setDialogoPago(false);
      setPagoMonto('');
      setPagoReferencia('');
      qc.invalidateQueries({ queryKey: ['venta', id] });
      qc.invalidateQueries({ queryKey: ['ventas'] });
    },
    onError: err => toast.error(mensajeError(err)),
  });

  const emitirNC = useMutation({
    mutationFn: () =>
      postear<{ numero: string }>(`/notas-credito`, {
        ventaId: id,
        motivo: ncMotivo.trim(),
        restituyeStock: ncRestituyeStock,
        items: Object.entries(ncCantidades)
          .filter(([, c]) => c > 0)
          .map(([ventaItemId, cantidad]) => ({ ventaItemId, cantidad })),
      }),
    onSuccess: data => {
      toast.success(`Nota de crédito ${data.numero} emitida`);
      setDialogoNC(false);
      setNcMotivo('');
      setNcCantidades({});
      qc.invalidateQueries({ queryKey: ['venta', id] });
      qc.invalidateQueries({ queryKey: ['notas-credito'] });
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

  if (isError || !venta) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="size-10 mx-auto text-[hsl(var(--brand-warning))] mb-3" />
        <p className="font-medium">No se pudo cargar la venta</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/ventas"><ArrowLeft className="size-4" /> Volver al listado</Link>
        </Button>
      </div>
    );
  }

  const puedeAnular = tienePermiso(permisos, 'ventas:anular') && venta.estado !== 'anulada';
  const puedeRegistrarPago =
    tienePermiso(permisos, 'ventas:crear') &&
    venta.estado !== 'anulada' &&
    venta.estado !== 'pagada' &&
    parseFloat(venta.total) > parseFloat(venta.totalPagado) + 0.01;
  const puedeEmitirNC =
    tienePermiso(permisos, 'notas-credito:crear') && venta.estado !== 'anulada';
  const pendiente = Math.max(0, parseFloat(venta.total) - parseFloat(venta.totalPagado));

  const disponibleDevolverPorItem = new Map<string, number>();
  for (const item of venta.items) {
    const yaDevuelto = (item.notasCreditoItems ?? []).reduce((s, x) => s + x.cantidad, 0);
    disponibleDevolverPorItem.set(item.id, item.cantidad - yaDevuelto);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/ventas" aria-label="Volver"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="size-9 rounded-lg gradient-brand-accent grid place-items-center">
              <Receipt className="size-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">{venta.numero}</h1>
            <Badge variant={ESTADO_BADGE[venta.estado]}>{venta.estado}</Badge>
          </div>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1 ml-12">
            Emitida {formatearFecha(venta.creadoEn, 'completa')} por {venta.vendedor.nombre}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap no-print">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Button>
          {puedeRegistrarPago && (
            <Button
              variant="outline"
              onClick={() => {
                setPagoMonto(pendiente.toFixed(2));
                setDialogoPago(true);
              }}
            >
              <Plus className="size-4" /> Registrar pago
            </Button>
          )}
          {puedeEmitirNC && (
            <Button
              variant="outline"
              onClick={() => {
                const init: Record<string, number> = {};
                for (const it of venta.items) {
                  init[it.id] = 0;
                }
                setNcCantidades(init);
                setDialogoNC(true);
              }}
            >
              <RotateCcw className="size-4" /> Nota de crédito
            </Button>
          )}
          {puedeAnular && (
            <Button
              variant="outline"
              className="text-[hsl(var(--brand-danger))] border-[hsl(var(--brand-danger))]/40 hover:bg-[hsl(var(--brand-danger))]/10"
              onClick={() => setDialogoAnular(true)}
            >
              <Ban className="size-4" /> Anular venta
            </Button>
          )}
        </div>
      </div>

      {venta.estado === 'anulada' && (
        <div className="flex items-start gap-3 rounded-lg border border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)] p-4">
          <Ban className="size-4 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Venta anulada {venta.anuladaEn && formatearFecha(venta.anuladaEn, 'completa')}</p>
            {venta.motivoAnulacion && (
              <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Motivo: {venta.motivoAnulacion}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-[hsl(var(--border))]">
              <h2 className="font-semibold">Detalle de productos</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Desc.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venta.items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.variante.producto.nombre}</div>
                      <div className="text-xs text-[hsl(var(--text-muted))] font-mono">
                        {item.variante.sku} · {item.variante.talla} · {item.variante.color}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.cantidad}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearMoneda(item.precioUnitario)}</TableCell>
                    <TableCell className="text-right tabular-nums text-[hsl(var(--text-muted))]">
                      {parseFloat(item.descuento) > 0 ? `-${formatearMoneda(item.descuento)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatearMoneda(item.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <CreditCard className="size-4" />
              <h2 className="font-semibold">Pagos</h2>
            </div>
            {venta.pagos.length === 0 ? (
              <div className="p-6 text-sm text-[hsl(var(--text-muted))] text-center">
                Sin pagos registrados.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medio</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Recibido</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venta.pagos.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{MEDIO_LABEL[p.medio] ?? p.medio}</TableCell>
                      <TableCell className="text-xs text-[hsl(var(--text-muted))] font-mono">
                        {p.referencia ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-[hsl(var(--text-muted))]">
                        {formatearFecha(p.recibidoEn, 'completa')}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatearMoneda(p.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {venta.notas && (
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-2">Notas</p>
              <p className="text-sm whitespace-pre-line">{venta.notas}</p>
            </Card>
          )}

          {(venta.notasCredito ?? []).length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <RotateCcw className="size-4" />
                <h2 className="font-semibold">Notas de crédito asociadas</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venta.notasCredito!.map(nc => (
                    <TableRow
                      key={nc.id}
                      className="cursor-pointer hover:bg-[hsl(var(--surface-2))]/50"
                      onClick={() => { window.location.href = `/notas-credito/${nc.id}`; }}
                    >
                      <TableCell className="font-mono font-semibold">{nc.numero}</TableCell>
                      <TableCell className="text-xs text-[hsl(var(--text-muted))]">
                        {formatearFecha(nc.creadoEn, 'completa')}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{nc.motivo}</TableCell>
                      <TableCell>
                        <Badge variant={nc.estado === 'anulada' ? 'danger' : 'success'}>
                          {nc.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatearMoneda(nc.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <Linea label="Subtotal" valor={venta.subtotal} />
            {parseFloat(venta.descuento) > 0 && (
              <Linea label="Descuento" valor={`-${venta.descuento}`} dim />
            )}
            {parseFloat(venta.descuentoCupon) > 0 && (
              <Linea
                label={`Cupón ${venta.cuponCodigo ?? ''}`}
                valor={`-${venta.descuentoCupon}`}
                acento
              />
            )}
            {parseFloat(venta.impuestos) > 0 && (
              <Linea label="Impuestos" valor={venta.impuestos} dim />
            )}
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-2xl font-black tracking-tight tabular-nums">
                {formatearMoneda(venta.total)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-[hsl(var(--text-muted))]">
              <span>Pagado</span>
              <span className="tabular-nums">{formatearMoneda(venta.totalPagado)}</span>
            </div>
            {parseFloat(venta.total) - parseFloat(venta.totalPagado) > 0.01 && (
              <div className="flex items-baseline justify-between text-xs text-[hsl(35_90%_60%)] font-semibold">
                <span>Por cobrar</span>
                <span className="tabular-nums">
                  {formatearMoneda(parseFloat(venta.total) - parseFloat(venta.totalPagado))}
                </span>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <User className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Cliente</p>
                {venta.cliente ? (
                  <>
                    <Link href={`/clientes/${venta.cliente.id}`} className="font-medium hover:underline truncate block">
                      {venta.cliente.nombre}
                    </Link>
                    <p className="text-xs text-[hsl(var(--text-muted))] font-mono">
                      {venta.cliente.tipoDocumento.toUpperCase()} {venta.cliente.documento}
                    </p>
                  </>
                ) : (
                  <p className="text-[hsl(var(--text-muted))]">Consumidor final</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Store className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Sucursal</p>
                <p className="font-medium">{venta.sucursal.nombre}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Vendedor</p>
                <p className="font-medium">{venta.vendedor.nombre}</p>
                <p className="text-xs text-[hsl(var(--text-muted))]">{venta.vendedor.email}</p>
              </div>
            </div>
            {venta.cupon && (
              <div className="flex items-start gap-3">
                <Tag className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Cupón aplicado</p>
                  <p className="font-mono font-bold">{venta.cupon.codigo}</p>
                  <p className="text-xs text-[hsl(var(--text-muted))]">
                    {venta.cupon.tipoDescuento === 'porcentaje'
                      ? `${venta.cupon.valorDescuento}%`
                      : formatearMoneda(venta.cupon.valorDescuento)}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={dialogoPago} onOpenChange={setDialogoPago}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago — {venta.numero}</DialogTitle>
            <DialogDescription>
              Pendiente: <span className="font-mono font-bold">{formatearMoneda(pendiente)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="pago-monto">Monto</label>
              <Input
                id="pago-monto"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={pendiente}
                value={pagoMonto}
                onChange={e => setPagoMonto(e.target.value)}
                className="text-right tabular-nums font-mono"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="pago-medio">Medio</label>
              <select
                id="pago-medio"
                value={pagoMedio}
                onChange={e => setPagoMedio(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-sm"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta_debito">Tarjeta débito</option>
                <option value="tarjeta_credito">Tarjeta crédito</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="transferencia">Transferencia</option>
                <option value="pix">PIX</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="pago-ref">Referencia (opcional)</label>
              <Input
                id="pago-ref"
                value={pagoReferencia}
                onChange={e => setPagoReferencia(e.target.value)}
                placeholder="Nº de operación, voucher…"
                maxLength={120}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogoPago(false)}>Cancelar</Button>
            <Button
              disabled={
                registrarPago.isPending ||
                !pagoMonto ||
                parseFloat(pagoMonto) <= 0 ||
                parseFloat(pagoMonto) > pendiente + 0.01
              }
              onClick={() => registrarPago.mutate()}
            >
              {registrarPago.isPending ? 'Procesando…' : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoNC} onOpenChange={setDialogoNC}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nota de crédito — {venta.numero}</DialogTitle>
            <DialogDescription>
              Marca las cantidades que se devuelven. Cada item tiene un máximo disponible
              (vendido menos lo ya devuelto en NC previas).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="nc-motivo">Motivo</label>
              <Textarea
                id="nc-motivo"
                rows={2}
                value={ncMotivo}
                onChange={e => setNcMotivo(e.target.value)}
                placeholder="Devolución por talla incorrecta, defecto…"
                maxLength={500}
              />
            </div>
            <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-right">Devolver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venta.items.map(it => {
                    const disponible = disponibleDevolverPorItem.get(it.id) ?? 0;
                    return (
                      <TableRow key={it.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{it.variante.producto.nombre}</div>
                          <div className="text-xs text-[hsl(var(--text-muted))] font-mono">
                            {it.variante.talla} · {it.variante.color}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.cantidad}</TableCell>
                        <TableCell className="text-right tabular-nums">{disponible}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={disponible}
                            value={ncCantidades[it.id] ?? 0}
                            disabled={disponible <= 0}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              setNcCantidades(prev => ({
                                ...prev,
                                [it.id]: isNaN(v) || v < 0 ? 0 : Math.min(v, disponible),
                              }));
                            }}
                            className="w-20 text-right tabular-nums ml-auto"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ncRestituyeStock}
                onChange={e => setNcRestituyeStock(e.target.checked)}
              />
              Restituir stock al inventario
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogoNC(false)}>Cancelar</Button>
            <Button
              disabled={
                emitirNC.isPending ||
                ncMotivo.trim().length < 3 ||
                Object.values(ncCantidades).every(c => !c || c <= 0)
              }
              onClick={() => emitirNC.mutate()}
            >
              {emitirNC.isPending ? 'Emitiendo…' : 'Emitir nota de crédito'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoAnular} onOpenChange={setDialogoAnular}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular venta {venta.numero}</DialogTitle>
            <DialogDescription>
              Esta acción devuelve el stock a la sucursal y libera el cupón si lo tuviera. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="motivo">
              Motivo de la anulación
            </label>
            <Textarea
              id="motivo"
              value={motivoAnulacion}
              onChange={e => setMotivoAnulacion(e.target.value)}
              placeholder="Ej: cliente devolvió la mercadería"
              rows={3}
              maxLength={500}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogoAnular(false)}>
              Cancelar
            </Button>
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

function Linea({
  label,
  valor,
  dim,
  acento,
}: {
  label: string;
  valor: string | number;
  dim?: boolean;
  acento?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={dim ? 'text-[hsl(var(--text-muted))]' : ''}>{label}</span>
      <span
        className={`tabular-nums font-mono ${
          acento ? 'text-[hsl(140_70%_60%)] font-semibold' : ''
        } ${dim ? 'text-[hsl(var(--text-muted))]' : ''}`}
      >
        {typeof valor === 'string' && valor.startsWith('-')
          ? `-${formatearMoneda(valor.slice(1))}`
          : formatearMoneda(valor)}
      </span>
    </div>
  );
}
