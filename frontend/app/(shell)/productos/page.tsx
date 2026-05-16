'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Package, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtenerPaginado } from '@/lib/api/client';
import { formatearMoneda, formatearNumero } from '@/lib/utils';

interface ProductoLista {
  id: string;
  sku: string;
  nombre: string;
  precioVenta: string;
  activo: boolean;
  imagenes: string[];
  categoria: { nombre: string };
  marca?: { nombre: string } | null;
  cantidadVariantes: number;
  stockTotal: number;
  variantes: Array<{ talla: string; color: string; colorHex?: string | null }>;
}

export default function ProductosPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debouncedBuscar, setDebouncedBuscar] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedBuscar(buscar), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading } = useQuery({
    queryKey: ['productos', pagina, debouncedBuscar],
    queryFn: () =>
      obtenerPaginado<ProductoLista>('/productos', {
        pagina,
        limite: 20,
        ...(debouncedBuscar ? { buscar: debouncedBuscar } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
          <p className="text-[hsl(var(--text-muted))]">
            Catálogo con variantes (talla, color, material).
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/productos/nuevo">
            <Plus className="size-4" /> Nuevo producto
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            data-busqueda
            placeholder="Buscar por nombre, SKU o material…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-9"
          />
        </div>
        {data && (
          <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums">
            {formatearNumero(data.total)} resultado{data.total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Variantes</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead></TableHead>
              <TableHead className="text-right pr-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  {Array(9).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data!.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <Package className="size-8 mx-auto text-[hsl(var(--text-muted))] mb-2" />
                  <p className="text-sm text-[hsl(var(--text-muted))]">
                    {debouncedBuscar ? 'Sin resultados.' : 'Aún no hay productos. Crea el primero.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="size-10 rounded-md bg-[hsl(var(--surface-2))] grid place-items-center overflow-hidden">
                      {p.imagenes[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagenes[0]} alt={p.nombre} className="size-full object-cover" />
                      ) : (
                        <Package className="size-4 text-[hsl(var(--text-muted))]" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.nombre}</div>
                    {p.marca && (
                      <div className="text-xs text-[hsl(var(--text-muted))]">{p.marca.nombre}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.categoria.nombre}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {p.variantes.slice(0, 4).map((v, i) => (
                        <span
                          key={i}
                          className="size-5 rounded-full border border-[hsl(var(--border))] shadow-sm"
                          title={`${v.talla} · ${v.color}`}
                          style={{ backgroundColor: v.colorHex ?? 'var(--surface-2)' }}
                        />
                      ))}
                      {p.variantes.length > 4 && (
                        <span className="text-xs text-[hsl(var(--text-muted))] ml-1">
                          +{p.variantes.length - 4}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                      {p.cantidadVariantes} variante{p.cantidadVariantes === 1 ? '' : 's'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={p.stockTotal === 0 ? 'text-[hsl(var(--brand-danger))] font-semibold' : ''}>
                      {p.stockTotal}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatearMoneda(p.precioVenta)}
                  </TableCell>
                  <TableCell>
                    {p.activo ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link href={`/productos/${p.id}`}>
                          <Edit2 className="size-3.5" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-[hsl(var(--brand-danger))]">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {data && data.totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[hsl(var(--text-muted))]">
            Página {data.pagina} de {data.totalPaginas} · {formatearNumero(data.total)} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
              ← Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={pagina >= data.totalPaginas} onClick={() => setPagina(p => p + 1)}>
              Siguiente →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
