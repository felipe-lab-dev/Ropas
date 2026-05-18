'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Boxes, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtenerPaginado } from '@/lib/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { IlustracionInventario } from '@/components/ui/empty-illustrations';

interface StockItem {
  id: string;
  disponible: number;
  reservado: number;
  stockMinimo: number;
  variante: {
    talla: string; color: string; colorHex?: string | null; codigoBarras?: string | null;
    producto: { sku: string; nombre: string; imagenes: string[] };
  };
  sucursal: { nombre: string };
}

export default function InventarioPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading } = useQuery({
    queryKey: ['stock', debounced, pagina],
    queryFn: () =>
      obtenerPaginado<StockItem>('/inventario/stock', {
        limite: 50, pagina, ...(debounced ? { buscar: debounced } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader titulo="Inventario" descripcion="Stock por variante y sucursal." />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
        <Input
          data-busqueda
          placeholder="Buscar por producto, SKU o código de barras…"
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Código barras</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead className="text-right">Disponible</TableHead>
              <TableHead className="text-right">Reservado</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(10)].map((_, i) => (
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
                    ilustracion={<IlustracionInventario className="w-full h-full" />}
                    titulo="Sin stock registrado"
                    descripcion="El inventario aparecerá aquí cuando crees productos con variantes y movimientos."
                    accion={{ label: 'Ir a Productos', href: '/productos' }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(s => {
                const critico = s.disponible <= s.stockMinimo;
                const agotado = s.disponible === 0;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.variante.producto.nombre}</div>
                      <div className="text-xs text-[hsl(var(--text-muted))] font-mono">{s.variante.producto.sku}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="size-4 rounded-full border border-[hsl(var(--border))]" style={{ backgroundColor: s.variante.colorHex ?? 'var(--surface-2)' }} />
                        <span className="text-sm">{s.variante.talla} · {s.variante.color}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.variante.codigoBarras ?? '—'}</TableCell>
                    <TableCell>{s.sucursal.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold">
                      <span className={agotado ? 'text-[hsl(var(--brand-danger))]' : critico ? 'text-[hsl(var(--brand-warning))]' : ''}>
                        {s.disponible}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[hsl(var(--text-muted))]">{s.reservado}</TableCell>
                    <TableCell className="text-right tabular-nums text-[hsl(var(--text-muted))]">{s.stockMinimo}</TableCell>
                    <TableCell>
                      {agotado ? (
                        <Badge variant="danger"><AlertTriangle className="size-3 mr-1" />Agotado</Badge>
                      ) : critico ? (
                        <Badge variant="warning">Bajo</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {data && (
          <Pagination
            pagina={data.pagina}
            totalPaginas={data.totalPaginas}
            total={data.total}
            limite={50}
            onCambiar={setPagina}
          />
        )}
      </Card>
    </div>
  );
}
