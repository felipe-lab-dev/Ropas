'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PackageCheck,
  Building2,
  Store,
  CreditCard,
  Ban,
  AlertTriangle,
  Loader2,
  Plus,
  Printer,
  Clock,
  Calendar,
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
import { tienePermiso, useSesion } from '@/lib/store/sesion';
import { useSesionCajaAbierta } from '@/lib/api/hooks/use-sesion-caja-abierta';

export type AccionCompra = 'pago' | 'anular';

type EstadoCompra = 'borrador' | 'recibida' | 'anulada';
type EstadoPagoCompra = 'pendiente' | 'parcial' | 'pagada' | 'vencida';

interface CompraDetalle {
  id: string;
  numero: string;
  tipoComprobante: string;
  serie: string;
  numeroComprobante: string;
  fechaEmision: string;
  fechaRecepcion: string;
  fechaVencimiento: string | null;
  moneda: string;
  tipoCambio: string;
  subtotal: string;
  igv: string;
  otrosImpuestos: string;
  descuento: string;
  total: string;
  totalPagado: string;
  estado: EstadoCompra;
  estadoPago: EstadoPagoCompra;
  condicionPago: string;
  notas: string | null;
  anuladaEn: string | null;
  motivoAnulacion: string | null;
  creadoEn: string;
  proveedor: { id: string; razonSocial: string; documento: string; nombreComercial?: string | null };
  sucursal: { id: string; nombre: string };
  items: Array<{
    id: string;
    descripcion: string;
    cantidad: number;
    costoUnitario: string;
    descuento: string;
    subtotal: string;
    variante: {
      id: string;
      sku: string;
      talla: string;
      color: string;
      producto: { id: string; nombre: string };
    };
  }>;
  pagos: Array<{
    id: string;
    medio: string;
    monto: string;
    referencia: string | null;
    fechaPago: string;
  }>;
}

const ESTADO_PAGO_VARIANT: Record<EstadoPagoCompra, 'warning' | 'success' | 'danger'> = {
  pendiente: 'warning',
  parcial: 'warning',
  pagada: 'success',
  vencida: 'danger',
};

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

const TIPO_COMPROBANTE_LABEL: Record<string, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  ticket: 'Ticket',
  recibo: 'Recibo',
  nota: 'Nota',
  sin_comprobante: 'Sin comprobante',
};

interface CompraDetalleProps {
  compraId: string;
  /** Abre directamente un diálogo de acción al cargar (atajo desde el menú ⋯ de la tabla). */
  accionInicial?: AccionCompra | null;
}

export function CompraDetalle({ compraId, accionInicial }: CompraDetalleProps) {
  const qc = useQueryClient();
  const permisos = useSesion(s => s.usuario?.permisos);

  const [dialogoAnular, setDialogoAnular] = React.useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = React.useState('');

  const [dialogoPago, setDialogoPago] = React.useState(false);
  const [pagoMonto, setPagoMonto] = React.useState('');
  const [pagoMedio, setPagoMedio] = React.useState('efectivo');
  const [pagoReferencia, setPagoReferencia] = React.useState('');
  const [pagoFecha, setPagoFecha] = React.useState('');

  const { data: compra, isLoading, isError } = useQuery({
    queryKey: ['compra', compraId],
    queryFn: () => obtener<CompraDetalle>(`/compras/${compraId}`),
  });

  // Sesión de caja abierta — requerida para registrar pagos (backend exige sesionCajaId).
  const sucursalIdCompra = compra?.sucursal?.id;
  const { data: sesionCaja } = useSesionCajaAbierta(sucursalIdCompra);

  const registrarPago = useMutation({
    mutationFn: () =>
      postear<{ estadoPago: string }>(`/compras/${compraId}/pagos`, {
        medio: pagoMedio,
        monto: parseFloat(pagoMonto),
        referencia: pagoReferencia.trim() || undefined,
        fechaPago: pagoFecha || undefined,
        sesionCajaId: sesionCaja?.id,
      }),
    onSuccess: data => {
      toast.success(data.estadoPago === 'pagada' ? 'Compra saldada' : 'Pago registrado');
      setDialogoPago(false);
      setPagoMonto('');
      setPagoReferencia('');
      qc.invalidateQueries({ queryKey: ['compra', compraId] });
      qc.invalidateQueries({ queryKey: ['compras'] });
    },
    onError: err => toast.error(mensajeError(err)),
  });

  const anular = useMutation({
    mutationFn: () =>
      postear<CompraDetalle>(`/compras/${compraId}/anular`, { motivo: motivoAnulacion.trim() }),
    onSuccess: () => {
      toast.success('Compra anulada');
      setDialogoAnular(false);
      setMotivoAnulacion('');
      qc.invalidateQueries({ queryKey: ['compra', compraId] });
      qc.invalidateQueries({ queryKey: ['compras'] });
    },
    onError: err => toast.error(mensajeError(err)),
  });

  // Atajo: abrir un diálogo de acción al cargar (desde el menú ⋯ de la tabla).
  const accionDisparada = React.useRef(false);
  React.useEffect(() => {
    if (!compra || accionDisparada.current || !accionInicial) return;
    accionDisparada.current = true;
    const pend = Math.max(0, parseFloat(compra.total) - parseFloat(compra.totalPagado));
    if (
      accionInicial === 'pago' &&
      tienePermiso(permisos, 'compras:pagar') &&
      compra.estado !== 'anulada' &&
      compra.estadoPago !== 'pagada' &&
      pend > 0.01
    ) {
      setPagoMonto(pend.toFixed(2));
      setDialogoPago(true);
    } else if (
      accionInicial === 'anular' &&
      tienePermiso(permisos, 'compras:anular') &&
      compra.estado !== 'anulada'
    ) {
      setDialogoAnular(true);
    }
  }, [compra, accionInicial, permisos]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="size-6 animate-spin text-[hsl(var(--brand-primary))]" />
      </div>
    );
  }
  if (isError || !compra) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="size-10 mx-auto text-[hsl(var(--brand-warning))] mb-3" />
        <p className="font-medium">No se pudo cargar la compra</p>
      </div>
    );
  }

  const moneda = compra.moneda;
  const esExtranjera = moneda !== 'PEN';
  const tipoCambio = parseFloat(compra.tipoCambio);
  const pendiente = Math.max(0, parseFloat(compra.total) - parseFloat(compra.totalPagado));
  const puedePagar =
    tienePermiso(permisos, 'compras:pagar') &&
    compra.estado !== 'anulada' &&
    compra.estadoPago !== 'pagada' &&
    pendiente > 0.01;
  const puedeAnular = tienePermiso(permisos, 'compras:anular') && compra.estado !== 'anulada';

  type EventoTimeline = { fecha: string; icono: React.ElementType; color: string; titulo: string; detalle?: string };
  const eventos: EventoTimeline[] = [
    {
      fecha: compra.creadoEn,
      icono: PackageCheck,
      color: 'hsl(265 55% 58%)',
      titulo: `Compra ${compra.numero} registrada`,
      detalle: `${TIPO_COMPROBANTE_LABEL[compra.tipoComprobante] ?? compra.tipoComprobante} ${compra.serie}-${compra.numeroComprobante}`,
    },
    ...compra.pagos.map(p => ({
      fecha: p.fechaPago,
      icono: CreditCard,
      color: 'hsl(150 55% 50%)',
      titulo: `Pago ${formatearMoneda(p.monto, moneda)}`,
      detalle: `${MEDIO_LABEL[p.medio] ?? p.medio}${p.referencia ? ` · ${p.referencia}` : ''}`,
    })),
    ...(compra.anuladaEn
      ? [{
          fecha: compra.anuladaEn,
          icono: Ban,
          color: 'hsl(355 75% 60%)',
          titulo: 'Compra anulada',
          detalle: compra.motivoAnulacion ?? undefined,
        }]
      : []),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Hero compacto */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold tracking-tight font-mono">{compra.numero}</h2>
        {compra.estado === 'anulada' ? (
          <Badge variant="danger">Anulada</Badge>
        ) : compra.estado === 'borrador' ? (
          <Badge variant="outline">Borrador</Badge>
        ) : (
          <Badge variant={ESTADO_PAGO_VARIANT[compra.estadoPago]}>{compra.estadoPago}</Badge>
        )}
        {esExtranjera && (
          <Badge variant="outline" className="font-mono text-[10px]">{moneda} · TC {tipoCambio.toFixed(3)}</Badge>
        )}
        <span className="text-xs text-[hsl(var(--text-muted))] w-full">
          {TIPO_COMPROBANTE_LABEL[compra.tipoComprobante] ?? compra.tipoComprobante}{' '}
          {compra.serie}-{compra.numeroComprobante} · emitida {formatearFecha(compra.fechaEmision)}
        </span>
      </div>

      {compra.estado === 'anulada' && (
        <div className="flex items-start gap-3 rounded-lg border border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)] p-3">
          <Ban className="size-4 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Compra anulada {compra.anuladaEn && formatearFecha(compra.anuladaEn, 'completa')}</p>
            {compra.motivoAnulacion && (
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1">Motivo: {compra.motivoAnulacion}</p>
            )}
          </div>
        </div>
      )}

      {/* Totales */}
      <Card className="p-4 space-y-2.5">
        <Linea label="Subtotal" valor={compra.subtotal} moneda={moneda} dim />
        {parseFloat(compra.descuento) > 0 && <Linea label="Descuento" valor={`-${compra.descuento}`} moneda={moneda} dim />}
        {parseFloat(compra.igv) > 0 && <Linea label="IGV" valor={compra.igv} moneda={moneda} dim />}
        {parseFloat(compra.otrosImpuestos) > 0 && <Linea label="Otros impuestos" valor={compra.otrosImpuestos} moneda={moneda} dim />}
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-2xl font-black tracking-tight tabular-nums">
            {formatearMoneda(compra.total, moneda)}
          </span>
        </div>
        {esExtranjera && (
          <div className="flex items-baseline justify-between text-xs text-[hsl(var(--text-muted))]">
            <span>Equivalente</span>
            <span className="tabular-nums">≈ {formatearMoneda(parseFloat(compra.total) * tipoCambio, 'PEN')}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between text-xs text-[hsl(var(--text-muted))]">
          <span>Pagado</span>
          <span className="tabular-nums">{formatearMoneda(compra.totalPagado, moneda)}</span>
        </div>
        {pendiente > 0.01 && (
          <div className="flex items-baseline justify-between text-xs text-[hsl(35_90%_60%)] font-semibold">
            <span>Por pagar</span>
            <span className="tabular-nums">{formatearMoneda(pendiente, moneda)}</span>
          </div>
        )}
      </Card>

      {/* Proveedor / sucursal / comprobante */}
      <Card className="p-4 space-y-4 text-sm">
        <div className="flex items-start gap-3">
          <Building2 className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Proveedor</p>
            <Link href={`/proveedores?ver=${compra.proveedor.id}`} className="font-medium hover:underline truncate block">
              {compra.proveedor.razonSocial}
            </Link>
            <p className="text-xs text-[hsl(var(--text-muted))] font-mono">{compra.proveedor.documento}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Store className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Sucursal</p>
            <p className="font-medium">{compra.sucursal.nombre}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Calendar className="size-4 mt-0.5 text-[hsl(var(--text-muted))]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Recepción / vencimiento</p>
            <p className="font-medium">
              Recibida {formatearFecha(compra.fechaRecepcion)}
              {compra.fechaVencimiento && ` · vence ${formatearFecha(compra.fechaVencimiento)}`}
            </p>
            <p className="text-xs text-[hsl(var(--text-muted))]">Condición: {compra.condicionPago}</p>
          </div>
        </div>
      </Card>

      {/* Items */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <PackageCheck className="size-4" />
          <h3 className="font-semibold text-sm">Mercadería recibida</h3>
          <Badge variant="outline" className="ml-auto">
            {compra.items.length} {compra.items.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="w-14 text-right">Cant.</TableHead>
              <TableHead className="w-24 text-right">Costo</TableHead>
              <TableHead className="w-24 text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {compra.items.map(item => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium text-sm">{item.variante.producto.nombre}</div>
                  <div className="text-[11px] text-[hsl(var(--text-muted))] font-mono">
                    {item.variante.sku} · {item.variante.talla} · {item.variante.color}
                  </div>
                  {parseFloat(item.descuento) > 0 && (
                    <div className="text-[11px] text-[hsl(var(--text-muted))]">Desc. -{formatearMoneda(item.descuento, moneda)}</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.cantidad}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatearMoneda(item.costoUnitario, moneda)}</TableCell>
                <TableCell className="text-right font-bold tabular-nums text-sm">{formatearMoneda(item.subtotal, moneda)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagos */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <CreditCard className="size-4" />
          <h3 className="font-semibold text-sm">Pagos al proveedor</h3>
        </div>
        {compra.pagos.length === 0 ? (
          <div className="p-5 text-sm text-[hsl(var(--text-muted))] text-center">Sin pagos registrados.</div>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]">
            {compra.pagos.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{MEDIO_LABEL[p.medio] ?? p.medio}</p>
                  <p className="text-[11px] text-[hsl(var(--text-muted))] font-mono truncate">
                    {p.referencia ? `${p.referencia} · ` : ''}{formatearFecha(p.fechaPago)}
                  </p>
                </div>
                <span className="text-right font-bold tabular-nums text-sm shrink-0">{formatearMoneda(p.monto, moneda)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {compra.notas && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-2">Notas</p>
          <p className="text-sm whitespace-pre-line">{compra.notas}</p>
        </Card>
      )}

      {/* Historial / timeline */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <Clock className="size-4" />
          <h3 className="font-semibold text-sm">Historial</h3>
        </div>
        <ol className="p-4 space-y-4">
          {eventos.map((ev, i) => {
            const Icon = ev.icono;
            return (
              <li key={`${ev.fecha}-${i}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="size-8 rounded-full grid place-items-center shrink-0"
                    style={{ backgroundColor: ev.color.replace(')', ' / 0.15)'), color: ev.color }}
                  >
                    <Icon className="size-4" />
                  </div>
                  {i < eventos.length - 1 && <div className="w-px flex-1 mt-1 bg-[hsl(var(--border))]" />}
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <p className="text-sm font-medium">{ev.titulo}</p>
                  {ev.detalle && <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5 break-words">{ev.detalle}</p>}
                  <p className="text-xs text-[hsl(var(--text-muted))] mt-1 font-mono">{formatearFecha(ev.fecha, 'completa')}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Aviso de caja cerrada — visible cuando la sesión ya resolvió como null */}
      {sucursalIdCompra && sesionCaja === null && (
        <div className="flex items-center gap-3 rounded-lg border border-[hsl(35_90%_55%/0.4)] bg-[hsl(35_90%_55%/0.08)] px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-[hsl(35_90%_55%)] shrink-0" />
          <div className="flex-1">
            <p className="font-medium">No hay caja abierta</p>
            <p className="text-xs text-[hsl(var(--text-muted))]">
              No podés registrar un pago sin una sesión de caja abierta.{' '}
              <Link href="/caja" className="underline">Abrir caja</Link>
            </p>
          </div>
        </div>
      )}

      {/* Barra de acciones fija al pie del drawer */}
      <div
        className="no-print sticky bottom-0 -mx-4 sm:-mx-5 -mb-5 mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface))]/95 px-4 sm:px-5 py-3 backdrop-blur"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Button variant="outline" size="sm" onClick={imprimirDetalle}>
          <Printer className="size-4" /> Imprimir
        </Button>
        {puedePagar && (
          <Button
            variant="outline"
            size="sm"
            disabled={sesionCaja === null}
            onClick={() => {
              setPagoMonto(pendiente.toFixed(2));
              setDialogoPago(true);
            }}
          >
            <Plus className="size-4" /> Registrar pago
          </Button>
        )}
        {puedeAnular && (
          <Button
            variant="outline"
            size="sm"
            className="text-[hsl(var(--brand-danger))] border-[hsl(var(--brand-danger))]/40 hover:bg-[hsl(var(--brand-danger))]/10"
            onClick={() => setDialogoAnular(true)}
          >
            <Ban className="size-4" /> Anular
          </Button>
        )}
      </div>

      {/* ── Diálogos ─────────────────────────────────────────────── */}
      <Dialog open={dialogoPago} onOpenChange={setDialogoPago}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>Registrar pago — {compra.numero}</DialogTitle>
            <DialogDescription>
              Pendiente: <span className="font-mono font-bold">{formatearMoneda(pendiente, moneda)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="pago-monto">Monto ({moneda})</label>
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
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta_debito">Tarjeta débito</option>
                <option value="tarjeta_credito">Tarjeta crédito</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="pix">PIX</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="pago-fecha">Fecha de pago</label>
                <Input id="pago-fecha" type="date" value={pagoFecha} onChange={e => setPagoFecha(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="pago-ref">Referencia</label>
                <Input id="pago-ref" value={pagoReferencia} onChange={e => setPagoReferencia(e.target.value)} placeholder="Operación, voucher…" maxLength={120} />
              </div>
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

      <Dialog open={dialogoAnular} onOpenChange={setDialogoAnular}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>Anular compra {compra.numero}</DialogTitle>
            <DialogDescription>
              Esta acción revierte el stock ingresado por esta compra. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="motivo">Motivo de la anulación</label>
            <Textarea
              id="motivo"
              value={motivoAnulacion}
              onChange={e => setMotivoAnulacion(e.target.value)}
              placeholder="Ej: mercadería devuelta al proveedor"
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

/** Imprime sólo el panel del drawer (ver reglas `@media print` en globals.css). */
function imprimirDetalle() {
  const limpiar = () => {
    document.body.classList.remove('imprimiendo-detalle');
    window.removeEventListener('afterprint', limpiar);
  };
  document.body.classList.add('imprimiendo-detalle');
  window.addEventListener('afterprint', limpiar);
  window.print();
  window.setTimeout(limpiar, 1500);
}

function Linea({
  label,
  valor,
  moneda,
  dim,
}: {
  label: string;
  valor: string | number;
  moneda: string;
  dim?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={dim ? 'text-[hsl(var(--text-muted))]' : ''}>{label}</span>
      <span className={`tabular-nums font-mono ${dim ? 'text-[hsl(var(--text-muted))]' : ''}`}>
        {typeof valor === 'string' && valor.startsWith('-')
          ? `-${formatearMoneda(valor.slice(1), moneda)}`
          : formatearMoneda(valor, moneda)}
      </span>
    </div>
  );
}
