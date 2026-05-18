'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtenerPaginado } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';

interface Proveedor {
  id: string;
  razonSocial: string;
  nombreComercial?: string | null;
  tipoDocumento: string;
  documento: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  condicionPago: string;
  diasCredito: number;
  totalComprado: string;
  deudaActual: string;
  activo: boolean;
}

const CONDICION_LABEL: Record<string, string> = {
  contado: 'Contado',
  credito_15: '15 días',
  credito_30: '30 días',
  credito_60: '60 días',
  credito_otro: 'Otro',
};

export default function ProveedoresPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading } = useQuery({
    queryKey: ['proveedores', debounced, pagina],
    queryFn: () =>
      obtenerPaginado<Proveedor>('/proveedores', {
        limite: 30,
        pagina,
        ...(debounced ? { buscar: debounced } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Proveedores"
        descripcion="Quiénes te abastecen, sus condiciones de pago y deuda pendiente."
        acciones={
          <Button asChild size="lg">
            <Link href="/proveedores/nuevo"><Plus className="size-4" /> Nuevo proveedor</Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
        <Input
          data-busqueda
          placeholder="Buscar por razón social, RUC, contacto…"
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Condición</TableHead>
              <TableHead className="text-right">Comprado</TableHead>
              <TableHead className="text-right">Deuda</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data!.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    ilustracion={<Truck className="size-20 text-[hsl(var(--brand-primary))/60]" />}
                    titulo="Aún no registraste proveedores"
                    descripcion="Agrega a tus proveedores para registrar compras y seguir tus cuentas por pagar."
                    accion={{ label: '＋ Nuevo proveedor', href: '/proveedores/nuevo' }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-semibold">{p.razonSocial}</div>
                    {p.nombreComercial && (
                      <div className="text-xs text-[hsl(var(--text-muted))]">{p.nombreComercial}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="uppercase text-[hsl(var(--text-muted))]">{p.tipoDocumento}</div>
                    <div>{p.documento}</div>
                  </TableCell>
                  <TableCell>
                    <div>{p.contacto ?? '—'}</div>
                    <div className="text-xs text-[hsl(var(--text-muted))]">
                      {p.telefono ?? p.email ?? ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.condicionPago === 'contado' ? 'default' : 'warning'}>
                      {CONDICION_LABEL[p.condicionPago] ?? p.condicionPago}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(p.totalComprado)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {Number(p.deudaActual) > 0 ? (
                      <span className="text-[hsl(355_75%_55%)]">{formatearMoneda(p.deudaActual)}</span>
                    ) : (
                      <span className="text-[hsl(var(--text-muted))]">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.activo ? 'success' : 'outline'}>
                      {p.activo ? 'Activo' : 'Inactivo'}
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
    </div>
  );
}
