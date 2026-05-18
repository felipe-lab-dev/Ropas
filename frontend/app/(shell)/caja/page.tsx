'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Wallet,
  Lock,
  Unlock,
  History,
  Plus,
  Minus,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Banknote,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { obtener, obtenerPaginado, eliminar, mensajeError } from '@/lib/api/client';
import { formatearFecha, formatearMoneda, cn } from '@/lib/utils';
import { useSesion } from '@/lib/store/sesion';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/caja/kpi-card';
import { DialogApertura } from '@/components/caja/dialog-apertura';
import { DialogCierre } from '@/components/caja/dialog-cierre';
import { DialogMovimiento } from '@/components/caja/dialog-movimiento';
import { etiquetaMedio, esMedioFisico } from '@/components/caja/medio-pago';

interface Sucursal { id: string; nombre: string }

interface SesionCaja {
  id: string;
  estado: 'abierta' | 'cerrada' | 'con_diferencia';
  montoApertura: string;
  abiertaEn: string;
  sucursal: { id: string; nombre: string };
  cajero: { id: string; nombre: string };
}

interface MovimientoCaja {
  id: string;
  tipo: 'ingreso' | 'egreso' | 'retiro' | 'ajuste';
  medio: string;
  monto: string;
  motivo: string;
  comprobante: string | null;
  contraparte: string | null;
  creadoEn: string;
  creadoPor: { id: string; nombre: string } | null;
}

interface TotalesSesion {
  sesionId: string;
  efectivoEsperado: number;
  ventas: { cantidad: number; total: number; totalCobrado: number; porMedio: Record<string, number> };
  ingresosManual: { total: number; porMedio: Record<string, number> };
  egresosManual: { total: number; porMedio: Record<string, number> };
}

export default function CajaPage() {
  const usuario = useSesion(s => s.usuario);
  const qc = useQueryClient();
  const [sucursalId, setSucursalId] = React.useState(usuario?.sucursalDefecto ?? '');
  const [modo, setModo] = React.useState<'ingreso' | 'egreso'>('ingreso');
  const [openApertura, setOpenApertura] = React.useState(false);
  const [openCierre, setOpenCierre] = React.useState(false);
  const [openMov, setOpenMov] = React.useState(false);
  const [tipoMov, setTipoMov] = React.useState<'ingreso' | 'egreso'>('ingreso');

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  React.useEffect(() => {
    if (sucursales && !sucursalId && sucursales[0]) setSucursalId(sucursales[0].id);
  }, [sucursales, sucursalId]);

  const sesionQ = useQuery({
    queryKey: ['caja-mi-sesion', sucursalId],
    queryFn: () =>
      obtener<SesionCaja | null>(`/caja/mi-sesion-abierta?sucursalId=${sucursalId}`),
    enabled: !!sucursalId,
  });
  const sesion = sesionQ.data;

  const totalesQ = useQuery({
    queryKey: ['caja-totales', sesion?.id],
    queryFn: () => obtener<TotalesSesion>(`/caja/sesiones/${sesion!.id}/totales`),
    enabled: !!sesion?.id,
  });

  const movimientosQ = useQuery({
    queryKey: ['caja-movimientos', sesion?.id, modo],
    queryFn: () =>
      obtenerPaginado<MovimientoCaja>(`/caja/sesiones/${sesion!.id}/movimientos`, {
        tipo: modo,
        limite: 50,
      }),
    enabled: !!sesion?.id,
  });

  const eliminarMov = useMutation({
    mutationFn: (id: string) => eliminar(`/caja/movimientos/${id}`),
    onSuccess: () => {
      toast.success('Movimiento eliminado');
      qc.invalidateQueries({ queryKey: ['caja-movimientos', sesion?.id] });
      qc.invalidateQueries({ queryKey: ['caja-totales', sesion?.id] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const sumarNoEfectivo = (mapa: Record<string, number>) =>
    Object.entries(mapa).reduce((s, [m, v]) => (m === 'efectivo' ? s : s + v), 0);
  const ingEfectivo =
    (totalesQ.data?.ventas.porMedio['efectivo'] ?? 0) +
    (totalesQ.data?.ingresosManual.porMedio['efectivo'] ?? 0);
  const ingVirtual =
    sumarNoEfectivo(totalesQ.data?.ventas.porMedio ?? {}) +
    sumarNoEfectivo(totalesQ.data?.ingresosManual.porMedio ?? {});
  const egrEfectivo = totalesQ.data?.egresosManual.porMedio['efectivo'] ?? 0;
  const egrVirtual = sumarNoEfectivo(totalesQ.data?.egresosManual.porMedio ?? {});

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Operaciones del día"
        descripcion="Estado de caja, ingresos y egresos de la sesión activa."
        acciones={
          <Button asChild variant="outline" size="sm">
            <Link href="/caja/historial">
              <History className="size-4" /> Historial
            </Link>
          </Button>
        }
      />

      {/* Tarjeta de estado de caja */}
      <Card className="overflow-hidden">
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'size-12 rounded-xl grid place-items-center shadow-md',
                sesion
                  ? 'bg-[hsl(var(--brand-success))]/20 text-[hsl(150_55%_60%)]'
                  : 'bg-[hsl(var(--text-muted))]/15 text-[hsl(var(--text-muted))]',
              )}
            >
              <Wallet className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-tight">
                {sesion ? 'Caja abierta' : 'Caja cerrada'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant={sesion ? 'success' : 'outline'}>
                  {sesion ? 'ACTIVA' : 'SIN SESIÓN'}
                </Badge>
                {sesion && (
                  <>
                    <span className="text-xs text-[hsl(var(--text-muted))]">
                      Desde {formatearFecha(sesion.abiertaEn, 'completa')}
                    </span>
                    <span className="text-[hsl(var(--text-muted))]/40">·</span>
                    <span className="text-xs text-[hsl(var(--text-muted))]">
                      {sesion.cajero.nombre} · {sesion.sucursal.nombre}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!sesion && sucursales && sucursales.length > 1 && (
              <Select
                value={sucursalId}
                onChange={e => setSucursalId(e.target.value)}
                className="h-9"
              >
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </Select>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                sesionQ.refetch();
                totalesQ.refetch();
                movimientosQ.refetch();
              }}
              title="Actualizar"
            >
              <RefreshCw className="size-4" />
            </Button>
            {sesion ? (
              <Button variant="danger" onClick={() => setOpenCierre(true)}>
                <Lock className="size-4" /> Cerrar caja
              </Button>
            ) : (
              <Button onClick={() => setOpenApertura(true)} disabled={!sucursalId}>
                <Unlock className="size-4" /> Abrir caja
              </Button>
            )}
          </div>
        </div>
      </Card>

      {sesion ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {totalesQ.isLoading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
            ) : (
              <>
                <KpiCard
                  titulo="Ingresos efectivo"
                  monto={ingEfectivo}
                  detalle={`Ventas + manual · ${totalesQ.data?.ventas.cantidad ?? 0} ventas`}
                  icono={<Banknote className="size-5" />}
                  tono="success"
                  delay={0}
                />
                <KpiCard
                  titulo="Ingresos virtuales"
                  monto={ingVirtual}
                  detalle="Tarjeta · transferencia · billeteras"
                  icono={<CreditCard className="size-5" />}
                  tono="info"
                  delay={0.05}
                />
                <KpiCard
                  titulo="Egresos efectivo"
                  monto={egrEfectivo}
                  detalle="Salidas en efectivo"
                  icono={<ArrowUpFromLine className="size-5" />}
                  tono="danger"
                  delay={0.1}
                />
                <KpiCard
                  titulo="Egresos virtuales"
                  monto={egrVirtual}
                  detalle="Pagos por otros medios"
                  icono={<ArrowUpFromLine className="size-5" />}
                  tono="warning"
                  delay={0.15}
                />
              </>
            )}
          </div>

          {/* Resumen efectivo esperado */}
          {totalesQ.data && (
            <Card className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-bold">
                    Monto apertura
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-1">
                    {formatearMoneda(sesion ? Number(sesion.montoApertura) : 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-bold">
                    Total ventas
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-1">
                    {formatearMoneda(totalesQ.data.ventas.total)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--brand-accent))] font-bold">
                    Efectivo esperado en caja
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-1 text-[hsl(var(--brand-accent))]">
                    {formatearMoneda(totalesQ.data.efectivoEsperado)}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Toggle + tabla de movimientos */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-[hsl(var(--border))]">
              <div className="inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 p-1">
                <button
                  onClick={() => setModo('ingreso')}
                  className={cn(
                    'flex items-center gap-2 px-4 h-8 rounded-md text-xs font-bold uppercase tracking-widest transition-all',
                    modo === 'ingreso'
                      ? 'bg-gradient-to-br from-[hsl(150_55%_42%)] to-[hsl(150_55%_32%)] text-white shadow-md'
                      : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]',
                  )}
                >
                  <ArrowDownToLine className="size-3.5" /> Ingresos
                </button>
                <button
                  onClick={() => setModo('egreso')}
                  className={cn(
                    'flex items-center gap-2 px-4 h-8 rounded-md text-xs font-bold uppercase tracking-widest transition-all',
                    modo === 'egreso'
                      ? 'bg-gradient-to-br from-[hsl(355_75%_55%)] to-[hsl(355_70%_42%)] text-white shadow-md'
                      : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]',
                  )}
                >
                  <ArrowUpFromLine className="size-3.5" /> Egresos
                </button>
              </div>

              <Button
                variant={modo === 'ingreso' ? 'default' : 'danger'}
                size="sm"
                onClick={() => {
                  setTipoMov(modo);
                  setOpenMov(true);
                }}
              >
                {modo === 'ingreso' ? (
                  <>
                    <Plus className="size-4" /> Registrar ingreso
                  </>
                ) : (
                  <>
                    <Minus className="size-4" /> Registrar egreso
                  </>
                )}
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientosQ.isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i}>
                      {Array(6).fill(0).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : movimientosQ.data?.datos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icono={
                          modo === 'ingreso' ? (
                            <ArrowDownToLine className="size-6" />
                          ) : (
                            <ArrowUpFromLine className="size-6" />
                          )
                        }
                        titulo={
                          modo === 'ingreso'
                            ? 'Sin ingresos manuales registrados'
                            : 'Sin egresos registrados'
                        }
                        descripcion={
                          modo === 'ingreso'
                            ? 'Las ventas se contabilizan automáticamente. Aquí puedes registrar ingresos manuales como adelantos o cobros de letras.'
                            : 'Registra salidas de dinero: pagos a proveedores, viáticos, retiros, etc.'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  movimientosQ.data?.datos.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs font-semibold tabular-nums whitespace-nowrap">
                        {formatearFecha(m.creadoEn, 'completa')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{m.motivo}</span>
                          {m.contraparte && (
                            <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))]">
                              {m.contraparte}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {m.comprobante ?? <span className="text-[hsl(var(--text-muted))]">S/N</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={esMedioFisico(m.medio as never) ? 'success' : 'default'}
                          className="uppercase text-[10px]"
                        >
                          {etiquetaMedio(m.medio)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-bold tabular-nums',
                          modo === 'ingreso'
                            ? 'text-[hsl(150_55%_60%)]'
                            : 'text-[hsl(355_85%_70%)]',
                        )}
                      >
                        {modo === 'egreso' ? '−' : '+'}
                        {formatearMoneda(m.monto)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (confirm('¿Eliminar este movimiento?')) eliminarMov.mutate(m.id);
                          }}
                          className="text-[hsl(355_85%_70%)] hover:bg-[hsl(355_75%_55%)]/15"
                          title="Eliminar"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <EmptyState
              icono={<Wallet className="size-6" />}
              titulo="No tienes una sesión de caja abierta"
              descripcion="Abre la caja con el monto inicial en efectivo para empezar a vender y registrar movimientos."
              accion={{
                label: 'Abrir caja',
                onClick: () => setOpenApertura(true),
              }}
            />
          </Card>
        </motion.div>
      )}

      {/* Dialogs */}
      {sucursalId && (
        <DialogApertura
          open={openApertura}
          onOpenChange={setOpenApertura}
          sucursalId={sucursalId}
          sucursalNombre={sucursales?.find(s => s.id === sucursalId)?.nombre}
        />
      )}
      {sesion && totalesQ.data && (
        <DialogCierre
          open={openCierre}
          onOpenChange={setOpenCierre}
          sesionId={sesion.id}
          efectivoEsperado={totalesQ.data.efectivoEsperado}
        />
      )}
      {sesion && (
        <DialogMovimiento
          open={openMov}
          onOpenChange={setOpenMov}
          sesionId={sesion.id}
          tipo={tipoMov}
        />
      )}
    </div>
  );
}

