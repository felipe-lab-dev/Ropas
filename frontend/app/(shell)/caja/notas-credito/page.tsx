'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Eye, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { DetalleSheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { obtenerPaginado, mensajeError } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { CajaTabs } from '@/components/caja/caja-tabs';
import { NotaCreditoDetalle } from '../../notas-credito/nota-credito-detalle';

interface NotaDelDia {
  id: string;
  numero: string;
  estado: 'emitida' | 'anulada';
  tipoCpe: string | null;
  motivo: string;
  total: string;
  creadoEn: string;
  venta: { id: string; numero: string };
  cliente: { nombre: string } | null;
}

const estadoColor = {
  emitida: 'success',
  anulada: 'danger',
} as const;

const COLUMNAS = 6;

/** YYYY-MM-DD en hora local (Lima). */
function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function esDeHoy(fecha: string, hoy: string): boolean {
  const d = new Date(fecha);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return local === hoy;
}

function hora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export default function NotasCreditoDelDiaPage() {
  const hoy = React.useMemo(() => hoyLocal(), []);
  const [abierta, setAbierta] = React.useState<{ id: string; numero?: string } | null>(null);

  // El backend de NC no filtra por fecha → traemos las últimas y filtramos hoy en cliente.
  // Las NC son de bajo volumen; 100 cubre cualquier día holgadamente.
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['caja-nc-dia', hoy],
    queryFn: () =>
      obtenerPaginado<NotaDelDia>('/notas-credito', { limite: 100, pagina: 1 }),
  });

  const notas = React.useMemo(
    () => (data?.datos ?? []).filter(n => esDeHoy(n.creadoEn, hoy)),
    [data, hoy],
  );
  const totalDia = notas
    .filter(n => n.estado !== 'anulada')
    .reduce((acc, n) => acc + parseFloat(n.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notas de crédito del día"
        descripcion="Devoluciones y notas de crédito emitidas hoy. Tocá una fila para ver el detalle."
        acciones={
          <Button asChild variant="outline" size="sm">
            <Link href="/notas-credito">
              <ArrowUpRight className="size-4" /> Ver todas las notas
            </Link>
          </Button>
        }
      />

      <CajaTabs />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] p-4">
          <div className="text-sm text-[hsl(var(--text-muted))]">
            {isLoading ? (
              <Skeleton className="h-5 w-40" />
            ) : (
              <>
                <span className="font-bold text-[hsl(var(--text))]">{notas.length}</span>{' '}
                {notas.length === 1 ? 'nota' : 'notas'} hoy
              </>
            )}
          </div>
          {!isLoading && (
            <div className="text-sm">
              <span className="text-[hsl(var(--text-muted))]">Total devuelto hoy </span>
              <span className="font-bold tabular-nums text-[hsl(355_75%_55%)]">
                {formatearMoneda(totalDia)}
              </span>
            </div>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Hora</TableHead>
              <TableHead>Número</TableHead>
              <TableHead className="hidden sm:table-cell">Venta</TableHead>
              <TableHead className="hidden md:table-cell">Cliente</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {Array(COLUMNAS).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError || !data ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="p-8 text-center text-[hsl(var(--text-muted))]">
                  No se pudieron cargar las notas de crédito: {mensajeError(error)}
                </TableCell>
              </TableRow>
            ) : notas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="p-0">
                  <EmptyState
                    titulo="Sin notas de crédito hoy"
                    descripcion="Las notas de crédito se emiten desde el detalle de una venta. Si emitís alguna hoy, aparecerá acá."
                  />
                </TableCell>
              </TableRow>
            ) : (
              notas.map(n => (
                <TableRow
                  key={n.id}
                  className="cursor-pointer hover:bg-[hsl(var(--surface-2))]/50"
                  onClick={() => setAbierta({ id: n.id, numero: n.numero })}
                  data-testid="fila-nc-dia"
                >
                  <TableCell className="text-xs text-[hsl(var(--text-muted))] tabular-nums">{hora(n.creadoEn)}</TableCell>
                  <TableCell className="font-mono font-semibold">{n.numero}</TableCell>
                  <TableCell className="hidden sm:table-cell font-mono text-[hsl(var(--text-muted))]">{n.venta.numero}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {n.cliente?.nombre ?? <span className="text-[hsl(var(--text-muted))]">Consumidor final</span>}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{formatearMoneda(n.total)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={estadoColor[n.estado]}>{n.estado}</Badge>
                      <Eye className="size-4 shrink-0 text-[hsl(var(--text-muted))]" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <DetalleSheet
        open={!!abierta}
        onOpenChange={o => { if (!o) setAbierta(null); }}
        titulo={abierta?.numero ?? 'Nota de crédito'}
        subtitulo="Detalle de la nota de crédito"
        icono={<RotateCcw className="size-4" />}
        ancho="2xl"
      >
        {abierta && <NotaCreditoDetalle ncId={abierta.id} accionInicial={null} />}
      </DetalleSheet>
    </div>
  );
}
