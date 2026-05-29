'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtenerPaginado } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FacetFilter } from '@/components/ui/facet-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { EstadoError } from '@/components/ui/error-state';

interface NotaListada {
  id: string;
  numero: string;
  estado: 'emitida' | 'anulada';
  /** Si null, es devolución interna (la venta original era nota de venta). */
  tipoCpe: string | null;
  motivo: string;
  total: string;
  creadoEn: string;
  venta: { id: string; numero: string };
  cliente: { nombre: string } | null;
  sucursal: { nombre: string };
  emitidaPor: { nombre: string };
  _count: { items: number };
}

const ESTADO_FACET = [
  { valor: 'emitida', label: 'Emitida', color: 'hsl(150 55% 42%)' },
  { valor: 'anulada', label: 'Anulada', color: 'hsl(355 75% 55%)' },
];

export default function NotasCreditoPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [estados, setEstados] = React.useState<string[]>([]);
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  React.useEffect(() => { setPagina(1); }, [estados]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['notas-credito', debounced, pagina, estados],
    queryFn: () =>
      obtenerPaginado<NotaListada>('/notas-credito', {
        limite: 30,
        pagina,
        ...(debounced ? { buscar: debounced } : {}),
        ...(estados.length === 1 ? { estado: estados[0] } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notas de crédito"
        descripcion="Devoluciones totales o parciales de ventas."
      />

      <Card className="p-4 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            data-busqueda
            placeholder="Buscar por número, venta o cliente…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-9"
          />
        </div>
        <FacetFilter
          titulo="Estado"
          opciones={ESTADO_FACET}
          seleccionadas={estados}
          onCambiar={setEstados}
        />
      </Card>

      {isError ? (
        <EstadoError
          titulo="No se pudieron cargar las notas de crédito"
          error={error}
          onReintentar={() => refetch()}
          reintentando={isFetching}
        />
      ) : (
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha</TableHead>
              <TableHead className="hidden lg:table-cell">Venta</TableHead>
              <TableHead className="hidden xl:table-cell">Cliente</TableHead>
              <TableHead className="hidden 2xl:table-cell">Motivo</TableHead>
              <TableHead className="text-right hidden 2xl:table-cell">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  {Array(8).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data!.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    titulo="Sin notas de crédito"
                    descripcion="Las devoluciones que emitas desde una venta aparecerán aquí."
                  />
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(nc => (
                <TableRow
                  key={nc.id}
                  className="cursor-pointer hover:bg-[hsl(var(--surface-2))]/50"
                  onClick={() => { window.location.href = `/notas-credito/${nc.id}`; }}
                >
                  <TableCell className="font-mono font-semibold">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/notas-credito/${nc.id}`}
                        onClick={e => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {nc.numero}
                      </Link>
                      {!nc.tipoCpe && (
                        <Badge
                          variant="outline"
                          className="border-[hsl(35_90%_55%/0.4)] bg-[hsl(35_90%_55%/0.08)] text-[hsl(35_90%_55%)] text-[10px] font-sans font-medium px-1.5 py-0"
                          title="Devolución interna · no enviada a SUNAT"
                        >
                          interna
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--text-muted))] hidden lg:table-cell">
                    {formatearFecha(nc.creadoEn, 'completa')}
                  </TableCell>
                  <TableCell className="font-mono text-xs hidden lg:table-cell">
                    <Link
                      href={`/ventas/${nc.venta.id}`}
                      onClick={e => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {nc.venta.numero}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {nc.cliente?.nombre ?? (
                      <span className="text-[hsl(var(--text-muted))]">Consumidor final</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate hidden 2xl:table-cell">{nc.motivo}</TableCell>
                  <TableCell className="text-right tabular-nums hidden 2xl:table-cell">{nc._count.items}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatearMoneda(nc.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={nc.estado === 'anulada' ? 'danger' : 'success'}>
                      {nc.estado}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {data && (
          <Pagination
            pagina={data.pagina}
            totalPaginas={data.totalPaginas}
            total={data.total}
            limite={30}
            onCambiar={setPagina}
          />
        )}
      </Card>
      )}
    </div>
  );
}
