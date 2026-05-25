'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  History,
  PackageCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import {
  actualizar, eliminar, mensajeError, obtener,
} from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { ProveedorFormulario } from '../proveedor-formulario';
import {
  aPayloadApi,
  CONDICION_LABEL,
  type ProveedorFormValues,
} from '../proveedor-schema';

interface ProveedorDetalle {
  id: string;
  tipoDocumento: ProveedorFormValues['tipoDocumento'];
  documento: string;
  razonSocial: string;
  nombreComercial: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  condicionPago: ProveedorFormValues['condicionPago'];
  diasCredito: number;
  cuentaBancaria: string | null;
  notas: string | null;
  activo: boolean;
  totalComprado: string;
  deudaActual: string;
  ultimaCompraEn: string | null;
  creadoEn: string;
  stats: {
    totalCompras: number;
    deudaCalculada: string;
    ultimaCompra: { fechaEmision: string; total: string; numero: string; id: string } | null;
  };
}

interface CompraHistorial {
  id: string;
  numero: string;
  serie: string;
  numeroComprobante: string;
  tipoComprobante: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  moneda: string;
  total: string;
  totalPagado: string;
  estado: string;
  estadoPago: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  anuladaEn: string | null;
  _count: { items: number; pagos: number };
}

const ESTADO_PAGO_VARIANT: Record<CompraHistorial['estadoPago'], 'success' | 'warning' | 'danger' | 'outline'> = {
  pagada: 'success',
  parcial: 'warning',
  vencida: 'danger',
  pendiente: 'outline',
};
const ESTADO_PAGO_LABEL: Record<CompraHistorial['estadoPago'], string> = {
  pagada: 'Pagada',
  parcial: 'Parcial',
  vencida: 'Vencida',
  pendiente: 'Pendiente',
};

export function EditarProveedorCliente() {
  const router = useRouter();
  const search = useSearchParams();
  const id = search.get('id') ?? '';
  const qc = useQueryClient();
  const [errorServidor, setErrorServidor] = React.useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = React.useState(false);

  const { data: proveedor, isLoading, isError, error } = useQuery({
    queryKey: ['proveedor', id],
    queryFn: () => obtener<ProveedorDetalle>(`/proveedores/${id}`),
    enabled: !!id,
    retry: 1,
  });

  const { data: historial, isLoading: cargandoHistorial } = useQuery({
    queryKey: ['proveedor-historial', id],
    queryFn: () => obtener<CompraHistorial[]>(`/proveedores/${id}/historial`),
    enabled: !!id && !!proveedor,
  });

  const guardar = useMutation({
    mutationFn: (valores: ProveedorFormValues) =>
      actualizar(`/proveedores/${id}`, aPayloadApi(valores)),
    onSuccess: () => {
      toast.success('Proveedor actualizado');
      qc.invalidateQueries({ queryKey: ['proveedor', id] });
      qc.invalidateQueries({ queryKey: ['proveedores'] });
    },
    onError: e => setErrorServidor(mensajeError(e)),
  });

  const mutarEstado = useMutation({
    mutationFn: (activo: boolean) => actualizar(`/proveedores/${id}`, { activo }),
    onSuccess: (_d, activo) => {
      toast.success(activo ? 'Proveedor activado' : 'Proveedor desactivado');
      qc.invalidateQueries({ queryKey: ['proveedor', id] });
      qc.invalidateQueries({ queryKey: ['proveedores'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const mutarEliminar = useMutation({
    mutationFn: () => eliminar(`/proveedores/${id}`),
    onSuccess: () => {
      toast.success('Proveedor eliminado');
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      router.push('/proveedores');
    },
    onError: e => {
      setConfirmarEliminar(false);
      toast.error(mensajeError(e));
    },
  });

  if (!id) {
    return (
      <Card className="p-6 max-w-md mx-auto text-center space-y-3">
        <AlertCircle className="size-10 mx-auto text-[hsl(355_75%_65%)]" />
        <p className="font-semibold">Falta el identificador del proveedor</p>
        <Button asChild><Link href="/proveedores">Volver al listado</Link></Button>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 max-w-xl space-y-3">
        <div className="flex items-center gap-2 text-[hsl(355_75%_70%)]">
          <AlertCircle className="size-5" />
          <span className="font-semibold">No se pudo cargar el proveedor</span>
        </div>
        <p className="text-sm text-[hsl(var(--text-muted))]">{mensajeError(error)}</p>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link href="/proveedores">Volver</Link></Button>
        </div>
      </Card>
    );
  }

  const valoresIniciales: Partial<ProveedorFormValues> | undefined = proveedor
    ? {
        tipoDocumento: proveedor.tipoDocumento,
        documento: proveedor.documento,
        razonSocial: proveedor.razonSocial,
        nombreComercial: proveedor.nombreComercial ?? '',
        contacto: proveedor.contacto ?? '',
        email: proveedor.email ?? '',
        telefono: proveedor.telefono ?? '',
        direccion: proveedor.direccion ?? '',
        ciudad: proveedor.ciudad ?? '',
        condicionPago: proveedor.condicionPago,
        diasCredito: proveedor.diasCredito,
        cuentaBancaria: proveedor.cuentaBancaria ?? '',
        notas: proveedor.notas ?? '',
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={proveedor ? proveedor.razonSocial : 'Editar proveedor'}
        descripcion={
          proveedor
            ? `${proveedor.tipoDocumento.toUpperCase()} ${proveedor.documento} · ${CONDICION_LABEL[proveedor.condicionPago]}`
            : 'Cargando datos…'
        }
        acciones={
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/proveedores"><ArrowLeft className="size-4" /> Volver</Link>
            </Button>
            {proveedor && (
              <>
                <Button
                  variant="outline"
                  onClick={() => mutarEstado.mutate(!proveedor.activo)}
                  disabled={mutarEstado.isPending}
                >
                  {proveedor.activo ? 'Desactivar' : 'Activar'}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setConfirmarEliminar(true)}
                  disabled={mutarEliminar.isPending}
                >
                  <Trash2 className="size-4" /> Eliminar
                </Button>
              </>
            )}
          </div>
        }
      />

      {proveedor && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            icon={<PackageCheck className="size-4" />}
            label="Total compras"
            valor={proveedor.stats.totalCompras.toString()}
            hint={proveedor.stats.totalCompras === 0 ? 'Sin compras registradas' : 'Compras no anuladas'}
          />
          <StatCard
            icon={<Wallet className="size-4" />}
            label="Total comprado"
            valor={formatearMoneda(proveedor.totalComprado)}
          />
          <StatCard
            icon={<AlertCircle className="size-4" />}
            label="Deuda viva"
            valor={formatearMoneda(proveedor.stats.deudaCalculada)}
            destacar={Number(proveedor.stats.deudaCalculada) > 0}
            hint="Suma de compras pendientes, parciales y vencidas"
          />
          <StatCard
            icon={<CalendarDays className="size-4" />}
            label="Última compra"
            valor={
              proveedor.stats.ultimaCompra
                ? formatearFecha(proveedor.stats.ultimaCompra.fechaEmision)
                : '—'
            }
            hint={
              proveedor.stats.ultimaCompra
                ? `${proveedor.stats.ultimaCompra.numero} · ${formatearMoneda(proveedor.stats.ultimaCompra.total)}`
                : undefined
            }
          />
        </div>
      )}

      {isLoading || !proveedor ? (
        <Card className="p-6 space-y-3 max-w-3xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </Card>
      ) : (
        <ProveedorFormulario
          inicial={valoresIniciales}
          guardando={guardar.isPending}
          ctaLabel="Guardar cambios"
          errorServidor={errorServidor}
          modoEdicion
          onGuardar={v => { setErrorServidor(null); guardar.mutate(v); }}
          onCancelar={() => router.push('/proveedores')}
        />
      )}

      <Card className="p-6 max-w-5xl">
        <div className="flex items-center gap-2 mb-4">
          <History className="size-4 text-[hsl(var(--brand-primary))]" />
          <h2 className="font-semibold">Historial de compras</h2>
          <span className="text-xs text-[hsl(var(--text-muted))]">
            (últimas 50)
          </span>
        </div>
        {cargandoHistorial ? (
          <Skeleton className="h-32" />
        ) : !historial || historial.length === 0 ? (
          <p className="text-sm text-[hsl(var(--text-muted))] py-4">
            Aún no hay compras registradas con este proveedor.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comprobante</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historial.map(c => {
                const saldo = Number(c.total) - Number(c.totalPagado);
                return (
                  <TableRow key={c.id} className={c.anuladaEn ? 'opacity-50 line-through' : ''}>
                    <TableCell className="font-mono text-xs">
                      <div className="uppercase text-[hsl(var(--text-muted))]">{c.tipoComprobante}</div>
                      <div>{c.serie}-{c.numeroComprobante}</div>
                    </TableCell>
                    <TableCell>{formatearFecha(c.fechaEmision)}</TableCell>
                    <TableCell>
                      {c.fechaVencimiento ? formatearFecha(c.fechaVencimiento) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearMoneda(c.total, c.moneda)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {saldo > 0 ? (
                        <span className="text-[hsl(355_75%_65%)] font-semibold">
                          {formatearMoneda(saldo, c.moneda)}
                        </span>
                      ) : (
                        <span className="text-[hsl(var(--text-muted))]">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_PAGO_VARIANT[c.estadoPago]}>
                        {ESTADO_PAGO_LABEL[c.estadoPago]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={confirmarEliminar} onOpenChange={setConfirmarEliminar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar proveedor</DialogTitle>
            <DialogDescription>
              Vas a eliminar <strong>{proveedor?.razonSocial}</strong>. Si el proveedor
              tiene compras con saldo pendiente, el backend bloqueará el borrado.
              Es un soft delete: el historial se conserva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmarEliminar(false)}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={mutarEliminar.isPending}
              onClick={() => mutarEliminar.mutate()}
            >
              {mutarEliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  valor,
  hint,
  destacar,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  hint?: string;
  destacar?: boolean;
}) {
  return (
    <Card className="p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-[hsl(var(--text-muted))]">
        {icon} {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${destacar ? 'text-[hsl(355_75%_65%)]' : ''}`}>
        {valor}
      </div>
      {hint && <div className="text-[11px] text-[hsl(var(--text-muted))]">{hint}</div>}
    </Card>
  );
}
