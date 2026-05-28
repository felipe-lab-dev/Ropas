'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtenerPaginado, mensajeError } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FacetFilter } from '@/components/ui/facet-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { IlustracionVentas } from '@/components/ui/empty-illustrations';

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

const ESTADOS_FACET = [
  { valor: 'confirmada', label: 'Confirmada', color: 'hsl(265 55% 58%)' },
  { valor: 'pagada', label: 'Pagada', color: 'hsl(150 55% 42%)' },
  { valor: 'parcial', label: 'Parcial', color: 'hsl(35 90% 55%)' },
  { valor: 'borrador', label: 'Borrador', color: 'hsl(265 12% 60%)' },
  { valor: 'anulada', label: 'Anulada', color: 'hsl(355 75% 55%)' },
];

export default function VentasPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [estadosSeleccionados, setEstadosSeleccionados] = React.useState<string[]>([]);
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  React.useEffect(() => { setPagina(1); }, [estadosSeleccionados]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ventas', debounced, pagina, estadosSeleccionados],
    queryFn: () =>
      obtenerPaginado<VentaLista>('/ventas', {
        limite: 30,
        pagina,
        ...(debounced ? { buscar: debounced } : {}),
        ...(estadosSeleccionados.length ? { estado: estadosSeleccionados.join(',') } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Ventas"
        descripcion="Historial de tickets emitidos."
        acciones={
          <Button asChild size="lg">
            <Link href="/pos"><Plus className="size-4" /> Nueva venta</Link>
          </Button>
        }
      />

      <Card className="p-4 space-y-4">
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
        <FacetFilter
          titulo="Estado"
          opciones={ESTADOS_FACET}
          seleccionadas={estadosSeleccionados}
          onCambiar={setEstadosSeleccionados}
        />
      </Card>

      <Card className="overflow-hidden">
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
            ) : isError || !data ? (
              <TableRow>
                <TableCell colSpan={8} className="p-8 text-center text-[hsl(var(--text-muted))]">
                  No se pudieron cargar las ventas: {mensajeError(error)}
                </TableCell>
              </TableRow>
            ) : data.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    ilustracion={<IlustracionVentas className="w-full h-full" />}
                    titulo="No hay ventas todavía"
                    descripcion="Cuando emitas tu primer ticket aparecerá aquí con su número, monto y cliente."
                    accion={{ label: '＋ Ir al POS', href: '/pos' }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.datos.map(v => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-[hsl(var(--surface-2))]/50"
                  onClick={() => { window.location.href = `/ventas/${v.id}`; }}
                >
                  <TableCell className="font-mono font-semibold">
                    <Link href={`/ventas/${v.id}`} onClick={e => e.stopPropagation()} className="hover:underline">
                      {v.numero}
                    </Link>
                  </TableCell>
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
    </div>
  );
}
