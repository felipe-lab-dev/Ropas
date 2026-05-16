'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtenerPaginado } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';

interface VentaLista {
  id: string; numero: string;
  cliente?: { nombre: string } | null;
  vendedor: { nombre: string };
  sucursal: { nombre: string };
  estado: 'borrador' | 'confirmada' | 'pagada' | 'parcial' | 'anulada';
  total: string;
  totalPagado: string;
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

export default function VentasPage() {
  const [buscar, setBuscar] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(buscar), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading } = useQuery({
    queryKey: ['ventas', debounced],
    queryFn: () =>
      obtenerPaginado<VentaLista>('/ventas', {
        limite: 30, ...(debounced ? { buscar: debounced } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ventas</h1>
          <p className="text-[hsl(var(--text-muted))]">
            Historial de tickets emitidos.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/pos"><Plus className="size-4" /> Nueva venta</Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
        <Input
          data-busqueda
          placeholder="Buscar por número o cliente…"
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  {Array(8).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data!.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <ShoppingCart className="size-8 mx-auto text-[hsl(var(--text-muted))] mb-2" />
                  <p className="text-sm text-[hsl(var(--text-muted))]">No hay ventas todavía.</p>
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono font-semibold">{v.numero}</TableCell>
                  <TableCell className="text-xs text-[hsl(var(--text-muted))]">{formatearFecha(v.creadoEn, 'completa')}</TableCell>
                  <TableCell>{v.cliente?.nombre ?? <span className="text-[hsl(var(--text-muted))]">Consumidor final</span>}</TableCell>
                  <TableCell>{v.vendedor.nombre}</TableCell>
                  <TableCell>{v.sucursal.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{v._count.items}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{formatearMoneda(v.total)}</TableCell>
                  <TableCell>
                    <Badge variant={estadoColor[v.estado]}>{v.estado}</Badge>
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
