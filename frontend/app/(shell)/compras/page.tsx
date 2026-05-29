'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, PackageCheck, AlertCircle } from 'lucide-react';
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
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FacetFilter } from '@/components/ui/facet-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { EstadoError } from '@/components/ui/error-state';

interface CompraLista {
  id: string;
  numero: string;
  serie: string;
  numeroComprobante: string;
  tipoComprobante: string;
  proveedor: { id: string; razonSocial: string; documento: string };
  sucursal: { id: string; nombre: string };
  fechaEmision: string;
  fechaVencimiento?: string | null;
  total: string;
  totalPagado: string;
  estado: 'borrador' | 'recibida' | 'anulada';
  estadoPago: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  _count: { items: number; pagos: number };
}

const ESTADO_PAGO_FACET = [
  { valor: 'pendiente', label: 'Pendiente', color: 'hsl(35 90% 55%)' },
  { valor: 'parcial', label: 'Parcial', color: 'hsl(45 90% 60%)' },
  { valor: 'pagada', label: 'Pagada', color: 'hsl(150 55% 42%)' },
  { valor: 'vencida', label: 'Vencida', color: 'hsl(355 75% 55%)' },
];

const estadoPagoVariant = {
  pendiente: 'warning',
  parcial: 'warning',
  pagada: 'success',
  vencida: 'danger',
} as const;

export default function ComprasPage() {
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
    queryKey: ['compras', debounced, pagina, estados],
    queryFn: () =>
      obtenerPaginado<CompraLista>('/compras', {
        limite: 30,
        pagina,
        ...(debounced ? { buscar: debounced } : {}),
        ...(estados.length === 1 ? { estadoPago: estados[0] } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Compras"
        descripcion="Mercadería recibida de proveedores."
        acciones={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/compras/por-pagar"><AlertCircle className="size-4" /> Cuentas por pagar</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/compras/nueva"><Plus className="size-4" /> Nueva compra</Link>
            </Button>
          </div>
        }
      />

      <Card className="p-4 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            data-busqueda
            placeholder="Buscar por número, factura, proveedor…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-9"
          />
        </div>
        <FacetFilter
          titulo="Estado de pago"
          opciones={ESTADO_PAGO_FACET}
          seleccionadas={estados}
          onCambiar={setEstados}
        />
      </Card>

      {isError ? (
        <EstadoError
          titulo="No se pudieron cargar las compras"
          error={error}
          onReintentar={() => refetch()}
          reintentando={isFetching}
        />
      ) : (
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Comprobante</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha</TableHead>
              <TableHead className="hidden 2xl:table-cell">Vence</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right hidden xl:table-cell">Pagado</TableHead>
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
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    ilustracion={<PackageCheck className="size-20 text-[hsl(var(--brand-primary))/60]" />}
                    titulo="Aún no registraste compras"
                    descripcion="Cuando recibas mercadería de un proveedor, regístrala aquí para sumarla al stock."
                    accion={{ label: '＋ Nueva compra', href: '/compras/nueva' }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-semibold">{c.numero}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="uppercase text-[hsl(var(--text-muted))]">{c.tipoComprobante}</div>
                    <div>{c.serie}-{c.numeroComprobante}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{c.proveedor.razonSocial}</div>
                    <div className="text-xs text-[hsl(var(--text-muted))] font-mono">{c.proveedor.documento}</div>
                  </TableCell>
                  <TableCell className="text-xs hidden lg:table-cell">{formatearFecha(c.fechaEmision)}</TableCell>
                  <TableCell className="text-xs hidden 2xl:table-cell">{c.fechaVencimiento ? formatearFecha(c.fechaVencimiento) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatearMoneda(c.total)}</TableCell>
                  <TableCell className="text-right tabular-nums hidden xl:table-cell">{formatearMoneda(c.totalPagado)}</TableCell>
                  <TableCell>
                    {c.estado === 'anulada' ? (
                      <Badge variant="danger">Anulada</Badge>
                    ) : c.estado === 'borrador' ? (
                      <Badge variant="outline">Borrador</Badge>
                    ) : (
                      <Badge variant={estadoPagoVariant[c.estadoPago]}>{c.estadoPago}</Badge>
                    )}
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
