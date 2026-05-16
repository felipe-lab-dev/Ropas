'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { obtener } from '@/lib/api/client';

interface Sucursal {
  id: string; codigo: string; nombre: string;
  direccion?: string | null; telefono?: string | null;
  esPrincipal: boolean; activa: boolean;
}

export default function SucursalesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sucursales-listado'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sucursales</h1>
          <p className="text-[hsl(var(--text-muted))]">Tiendas físicas con stock independiente.</p>
        </div>
        <Button size="lg"><Plus className="size-4" /> Nueva sucursal</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-[hsl(var(--text-muted))] col-span-full py-12 text-center">
            <Building2 className="size-8 mx-auto mb-2" />
            Aún no hay sucursales configuradas.
          </p>
        ) : (
          data!.map(s => (
            <Card key={s.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="size-10 rounded-md bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--brand-primary))] grid place-items-center">
                    <Building2 className="size-5" />
                  </div>
                  {s.esPrincipal && <Badge variant="accent">Principal</Badge>}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{s.nombre}</h3>
                  <p className="text-xs text-[hsl(var(--text-muted))] font-mono uppercase">{s.codigo}</p>
                </div>
                {s.direccion && <p className="text-sm text-[hsl(var(--text-muted))]">{s.direccion}</p>}
                {s.telefono && <p className="text-sm font-mono">{s.telefono}</p>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
