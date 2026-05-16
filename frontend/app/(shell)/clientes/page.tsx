'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Users, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtenerPaginado } from '@/lib/api/client';
import { formatearMoneda, iniciales } from '@/lib/utils';

interface Cliente {
  id: string; nombre: string; documento?: string | null; tipoDocumento: string;
  telefono?: string | null; email?: string | null; ciudad?: string | null;
  totalCompras: string; ultimaCompraEn?: string | null;
}

export default function ClientesPage() {
  const [buscar, setBuscar] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(buscar), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading } = useQuery({
    queryKey: ['clientes', debounced],
    queryFn: () => obtenerPaginado<Cliente>('/clientes', { limite: 30, ...(debounced ? { buscar: debounced } : {}) }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-[hsl(var(--text-muted))]">Tu base de clientes registrados.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/clientes/nuevo"><Plus className="size-4" /> Nuevo cliente</Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
        <Input
          data-busqueda
          placeholder="Buscar por nombre, documento, email…"
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead className="text-right">Total compras</TableHead>
              <TableHead className="text-right pr-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data!.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Users className="size-8 mx-auto text-[hsl(var(--text-muted))] mb-2" />
                  <p className="text-sm text-[hsl(var(--text-muted))]">Aún no hay clientes registrados.</p>
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="size-9 rounded-full bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] grid place-items-center text-white text-xs font-bold">
                      {iniciales(c.nombre)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.documento ? <><span className="text-[hsl(var(--text-muted))] uppercase mr-1">{c.tipoDocumento}</span>{c.documento}</> : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--text-muted))]">
                    {c.email && <div>{c.email}</div>}
                    {c.telefono && <div>{c.telefono}</div>}
                  </TableCell>
                  <TableCell>{c.ciudad ?? '—'}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{formatearMoneda(c.totalCompras)}</TableCell>
                  <TableCell className="text-right pr-4">
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link href={`/clientes/${c.id}`}><Edit2 className="size-3.5" /></Link>
                    </Button>
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
