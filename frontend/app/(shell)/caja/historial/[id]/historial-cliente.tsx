'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CreditCard,
  Clock,
  Lock,
  Receipt,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { obtener, obtenerPaginado } from '@/lib/api/client';
import { formatearFecha, formatearMoneda, iniciales, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/caja/kpi-card';
import { etiquetaMedio, esMedioFisico } from '@/components/caja/medio-pago';
import { EmptyState } from '@/components/ui/empty-state';

interface SesionDetalle {
  id: string;
  estado: 'abierta' | 'cerrada' | 'con_diferencia';
  montoApertura: string;
  montoCierre: string | null;
  montoEsperado: string | null;
  diferencia: string | null;
  notasApertura: string | null;
  notasCierre: string | null;
  abiertaEn: string;
  cerradaEn: string | null;
  cajero: { id: string; nombre: string; email: string };
  sucursal: { id: string; nombre: string };
  _count: { ventas: number; movimientos: number };
}

interface Totales {
  efectivoEsperado: number;
  montoApertura: number;
  montoCierre: number | null;
  diferencia: number | null;
  ventas: {
    cantidad: number;
    total: number;
    totalCobrado: number;
    porMedio: Record<string, number>;
  };
  ingresosManual: { total: number; porMedio: Record<string, number> };
  egresosManual: { total: number; porMedio: Record<string, number> };
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

const ESTADO_BADGE = {
  abierta: 'success',
  cerrada: 'outline',
  con_diferencia: 'warning',
} as const;

const ESTADO_LABEL = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  con_diferencia: 'Con diferencia',
} as const;

export function SesionDetalleCliente() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [modo, setModo] = React.useState<'ingreso' | 'egreso'>('ingreso');

  const sesionQ = useQuery({
    queryKey: ['caja-sesion', id],
    queryFn: () => obtener<SesionDetalle>(`/caja/sesiones/${id}`),
  });
  const totalesQ = useQuery({
    queryKey: ['caja-totales', id],
    queryFn: () => obtener<Totales>(`/caja/sesiones/${id}/totales`),
  });
  const movsQ = useQuery({
    queryKey: ['caja-movimientos-historial', id, modo],
    queryFn: () =>
      obtenerPaginado<MovimientoCaja>(`/caja/sesiones/${id}/movimientos`, {
        tipo: modo,
        limite: 100,
      }),
  });

  const sesion = sesionQ.data;
  const totales = totalesQ.data;

  const sumarNoEfectivo = (m: Record<string, number>) =>
    Object.entries(m).reduce((s, [k, v]) => (k === 'efectivo' ? s : s + v), 0);

  const ingEfectivo = totales
    ? (totales.ventas.porMedio['efectivo'] ?? 0) +
      (totales.ingresosManual.porMedio['efectivo'] ?? 0)
    : 0;
  const ingVirtual = totales
    ? sumarNoEfectivo(totales.ventas.porMedio) +
      sumarNoEfectivo(totales.ingresosManual.porMedio)
    : 0;
  const egrEfectivo = totales?.egresosManual.porMedio['efectivo'] ?? 0;
  const egrVirtual = totales ? sumarNoEfectivo(totales.egresosManual.porMedio) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Detalle de sesión"
        descripcion="Resumen financiero y movimientos de la sesión de caja."
        acciones={
          <Button asChild variant="outline" size="sm">
            <Link href="/caja/historial">
              <ArrowLeft className="size-4" /> Volver al historial
            </Link>
          </Button>
        }
      />

      <Card className="p-5">
        {sesionQ.isLoading || !sesion ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="size-12 rounded-xl bg-[hsl(var(--brand-primary))]/20 text-[hsl(var(--brand-accent))] grid place-items-center shadow-md shrink-0">
                <Receipt className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight">
                    Sesión #{sesion.id.slice(-6).toUpperCase()}
                  </h2>
                  <Badge variant={ESTADO_BADGE[sesion.estado]} className="uppercase text-[10px]">
                    {ESTADO_LABEL[sesion.estado]}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[hsl(var(--text-muted))]">
                  <span className="flex items-center gap-1.5">
                    <div className="size-5 rounded-full bg-[hsl(var(--brand-primary))]/15 text-[hsl(var(--brand-accent))] grid place-items-center text-[9px] font-bold">
                      {iniciales(sesion.cajero.nombre)}
                    </div>
                    {sesion.cajero.nombre}
                  </span>
                  <span className="text-[hsl(var(--text-muted))]/40">·</span>
                  <span>{sesion.sucursal.nombre}</span>
                  <span className="text-[hsl(var(--text-muted))]/40">·</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    Apertura: {formatearFecha(sesion.abiertaEn, 'completa')}
                  </span>
                  {sesion.cerradaEn && (
                    <>
                      <span className="text-[hsl(var(--text-muted))]/40">·</span>
                      <span className="flex items-center gap-1.5">
                        <Lock className="size-3.5" />
                        Cierre: {formatearFecha(sesion.cerradaEn, 'completa')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {totalesQ.isLoading || !totales ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <KpiCard
              titulo="Ingresos efectivo"
              monto={ingEfectivo}
              detalle={`${totales.ventas.cantidad} ventas + manual`}
              icono={<Banknote className="size-5" />}
              tono="success"
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

      {/* Resumen arqueo */}
      {totales && (
        <Card className="p-5">
          <h3 className="font-semibold tracking-tight mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-[hsl(var(--brand-accent))]" /> Arqueo
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <ArqueoItem label="Apertura" valor={totales.montoApertura} />
            <ArqueoItem label="Total ventas" valor={totales.ventas.total} />
            <ArqueoItem label="Efectivo esperado" valor={totales.efectivoEsperado} accent />
            <ArqueoItem
              label="Cierre"
              valor={totales.montoCierre}
              vacio="Sin cierre"
            />
            <ArqueoItem
              label="Diferencia"
              valor={totales.diferencia}
              tone={
                totales.diferencia === null
                  ? 'muted'
                  : Math.abs(totales.diferencia) < 0.01
                  ? 'success'
                  : 'warning'
              }
              vacio="—"
            />
          </div>
          {(sesion?.notasApertura || sesion?.notasCierre) && (
            <div className="mt-5 pt-5 border-t border-[hsl(var(--border))] grid md:grid-cols-2 gap-4 text-sm">
              {sesion.notasApertura && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[hsl(var(--text-muted))] mb-1">
                    Notas de apertura
                  </p>
                  <p className="text-[hsl(var(--text))]/80 leading-relaxed">
                    {sesion.notasApertura}
                  </p>
                </div>
              )}
              {sesion.notasCierre && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[hsl(var(--text-muted))] mb-1">
                    Notas de cierre
                  </p>
                  <p className="text-[hsl(var(--text))]/80 leading-relaxed">
                    {sesion.notasCierre}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Movimientos */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-[hsl(var(--border))]">
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
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Comprobante</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movsQ.isLoading ? (
              [...Array(4)].map((_, i) => (
                <TableRow key={i}>
                  {Array(6).fill(0).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : movsQ.data?.datos.length === 0 ? (
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
                    titulo={`Sin ${modo}s manuales en esta sesión`}
                    descripcion="Los movimientos manuales registrados durante la sesión aparecen aquí."
                  />
                </TableCell>
              </TableRow>
            ) : (
              movsQ.data?.datos.map(m => (
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
                  <TableCell className="text-xs text-[hsl(var(--text-muted))]">
                    {m.creadoPor?.nombre ?? '—'}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

interface ArqueoItemProps {
  label: string;
  valor: number | null;
  vacio?: string;
  accent?: boolean;
  tone?: 'success' | 'warning' | 'muted';
}

function ArqueoItem({ label, valor, vacio = '—', accent, tone }: ArqueoItemProps) {
  const colorClass =
    tone === 'success'
      ? 'text-[hsl(150_55%_60%)]'
      : tone === 'warning'
      ? 'text-[hsl(35_90%_65%)]'
      : tone === 'muted'
      ? 'text-[hsl(var(--text-muted))]'
      : accent
      ? 'text-[hsl(var(--brand-accent))]'
      : '';
  return (
    <div>
      <p
        className={cn(
          'text-[10px] uppercase tracking-widest font-bold',
          accent ? 'text-[hsl(var(--brand-accent))]' : 'text-[hsl(var(--text-muted))]',
        )}
      >
        {label}
      </p>
      <p className={cn('text-xl font-bold tabular-nums mt-1', colorClass)}>
        {valor === null ? (
          <span className="text-[hsl(var(--text-muted))]">{vacio}</span>
        ) : (
          formatearMoneda(valor)
        )}
      </p>
    </div>
  );
}
