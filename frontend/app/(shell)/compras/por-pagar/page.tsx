'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtener } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';

interface Fila {
  id: string;
  numero: string;
  comprobante: string;
  proveedor: { id: string; razonSocial: string; documento: string };
  fechaEmision: string;
  fechaVencimiento?: string | null;
  total: number;
  totalPagado: number;
  saldo: number;
  diasVencido: number;
  estado: string;
}

interface Respuesta {
  datos: Fila[];
  totales: { porPagar: number; vencido: number };
}

export default function CuentasPorPagarPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['compras-cxp'],
    queryFn: () => obtener<Respuesta>('/compras/cuentas-por-pagar'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Cuentas por pagar"
        descripcion="Compras a crédito pendientes de cancelación."
        acciones={
          <Button variant="ghost" asChild>
            <Link href="/compras"><ArrowLeft className="size-4" /> Volver a compras</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Total por pagar</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {data ? formatearMoneda(data.totales.porPagar) : <Skeleton className="h-9 w-32" />}
          </div>
        </Card>
        <Card className="p-5 border-[hsl(355_75%_55%/0.4)]">
          <div className="text-xs uppercase tracking-wider text-[hsl(355_75%_60%)]">Vencido</div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-[hsl(355_75%_65%)]">
            {data ? formatearMoneda(data.totales.vencido) : <Skeleton className="h-9 w-32" />}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Comprobante</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Días venc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {Array(9).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data!.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-[hsl(var(--text-muted))]">
                  Sin cuentas por pagar pendientes 🎉
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono font-semibold">{f.numero}</TableCell>
                  <TableCell className="font-mono text-xs">{f.comprobante}</TableCell>
                  <TableCell>
                    <div className="font-medium">{f.proveedor.razonSocial}</div>
                    <div className="text-xs text-[hsl(var(--text-muted))] font-mono">{f.proveedor.documento}</div>
                  </TableCell>
                  <TableCell className="text-xs">{formatearFecha(f.fechaEmision)}</TableCell>
                  <TableCell className="text-xs">{f.fechaVencimiento ? formatearFecha(f.fechaVencimiento) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(f.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(f.totalPagado)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatearMoneda(f.saldo)}</TableCell>
                  <TableCell>
                    {f.diasVencido > 0 ? (
                      <Badge variant="danger">{f.diasVencido}d</Badge>
                    ) : (
                      <span className="text-xs text-[hsl(var(--text-muted))]">Al día</span>
                    )}
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
