'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Eye, ArrowUpRight } from 'lucide-react';
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
import { VentaDetalle } from '../../ventas/venta-detalle';

interface VentaDelDia {
  id: string;
  numero: string;
  cliente?: { nombre: string } | null;
  estado: 'borrador' | 'confirmada' | 'pagada' | 'parcial' | 'anulada';
  esNotaDeVenta: boolean;
  total: string;
  creadoEn: string;
  _count: { items: number };
}

const estadoColor = {
  borrador: 'outline',
  confirmada: 'default',
  pagada: 'success',
  parcial: 'warning',
  anulada: 'danger',
} as const;

const COLUMNAS = 6;

/** YYYY-MM-DD en hora local (Lima): el cajero ve "hoy" según su reloj. */
function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export default function VentasDelDiaPage() {
  const hoy = React.useMemo(() => hoyLocal(), []);
  const [abierta, setAbierta] = React.useState<{ id: string; numero?: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['caja-ventas-dia', hoy],
    queryFn: () =>
      obtenerPaginado<VentaDelDia>('/ventas', { desde: hoy, hasta: hoy, limite: 100, pagina: 1 }),
  });

  const ventas = data?.datos ?? [];
  const totalDia = ventas
    .filter(v => v.estado !== 'anulada')
    .reduce((acc, v) => acc + parseFloat(v.total), 0);
  const hayMas = data ? data.total > ventas.length : false;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Ventas del día"
        descripcion="Tickets emitidos hoy. Tocá una fila para ver el detalle."
        acciones={
          <Button asChild variant="outline" size="sm">
            <Link href="/ventas">
              <ArrowUpRight className="size-4" /> Ver todas las ventas
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
                <span className="font-bold text-[hsl(var(--text))]">{ventas.length}</span>{' '}
                {ventas.length === 1 ? 'venta' : 'ventas'} hoy
              </>
            )}
          </div>
          {!isLoading && (
            <div className="text-sm">
              <span className="text-[hsl(var(--text-muted))]">Total del día </span>
              <span className="font-bold tabular-nums text-[hsl(var(--brand-accent))]">
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
              <TableHead className="hidden sm:table-cell">Cliente</TableHead>
              <TableHead className="text-right hidden md:table-cell">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  {Array(COLUMNAS).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError || !data ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="p-8 text-center text-[hsl(var(--text-muted))]">
                  No se pudieron cargar las ventas: {mensajeError(error)}
                </TableCell>
              </TableRow>
            ) : ventas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="p-0">
                  <EmptyState
                    titulo="Sin ventas hoy todavía"
                    descripcion="Cuando emitas un ticket en el día aparecerá acá, junto al efectivo esperado en caja."
                    accion={{ label: '＋ Ir al POS', href: '/pos' }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              ventas.map(v => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-[hsl(var(--surface-2))]/50"
                  onClick={() => setAbierta({ id: v.id, numero: v.numero })}
                  data-testid="fila-venta-dia"
                >
                  <TableCell className="text-xs text-[hsl(var(--text-muted))] tabular-nums">{hora(v.creadoEn)}</TableCell>
                  <TableCell className="font-mono font-semibold">
                    <div className="flex items-center gap-2">
                      <span>{v.numero}</span>
                      {v.esNotaDeVenta && (
                        <Badge
                          variant="outline"
                          className="border-[hsl(35_90%_55%/0.4)] bg-[hsl(35_90%_55%/0.08)] text-[hsl(35_90%_55%)] text-[10px] font-sans font-medium px-1.5 py-0"
                          title="Nota de venta interna · no se envía a SUNAT"
                        >
                          NV
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {v.cliente?.nombre ?? <span className="text-[hsl(var(--text-muted))]">Consumidor final</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden md:table-cell">{v._count.items}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{formatearMoneda(v.total)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={estadoColor[v.estado]}>{v.estado}</Badge>
                      <Eye className="size-4 shrink-0 text-[hsl(var(--text-muted))]" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {hayMas && (
          <div className="border-t border-[hsl(var(--border))] p-3 text-center text-xs text-[hsl(var(--text-muted))]">
            Mostrando las primeras {ventas.length} de {data?.total} ventas de hoy.{' '}
            <Link href="/ventas" className="font-semibold text-[hsl(var(--brand-accent))] hover:underline">
              Ver todas
            </Link>
          </div>
        )}
      </Card>

      <DetalleSheet
        open={!!abierta}
        onOpenChange={o => { if (!o) setAbierta(null); }}
        titulo={abierta?.numero ?? 'Venta'}
        subtitulo="Detalle de venta"
        icono={<Receipt className="size-4" />}
        ancho="2xl"
      >
        {abierta && (
          <VentaDetalle
            ventaId={abierta.id}
            accionInicial={null}
            onAbrirVenta={id => setAbierta({ id })}
          />
        )}
      </DetalleSheet>
    </div>
  );
}
