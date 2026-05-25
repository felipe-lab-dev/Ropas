'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtenerPaginado, postear, mensajeError } from '@/lib/api/client';
import { formatearMoneda, iniciales } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { IlustracionClientes } from '@/components/ui/empty-illustrations';

type Clase = 'AA' | 'A' | 'B' | 'C' | 'D';

interface Cliente {
  id: string; nombre: string; documento?: string | null; tipoDocumento: string;
  telefono?: string | null; email?: string | null; ciudad?: string | null;
  totalCompras: string; ultimaCompraEn?: string | null;
  clasificacion: Clase | null;
}

interface ResultadoClasificacion {
  clientesTotales: number;
  clientesClasificados: number;
  distribucion: Record<Clase, number>;
}

const COLORES_CLASE: Record<Clase, { base: string; suave: string }> = {
  AA: { base: '#8b5cf6', suave: 'rgba(139,92,246,0.12)' },
  A:  { base: '#0ea5e9', suave: 'rgba(14,165,233,0.12)' },
  B:  { base: '#22c55e', suave: 'rgba(34,197,94,0.12)' },
  C:  { base: '#f59e0b', suave: 'rgba(245,158,11,0.12)' },
  D:  { base: '#94a3b8', suave: 'rgba(148,163,184,0.12)' },
};

const FILTRO_OPCIONES: Array<{ valor: '' | Clase; label: string }> = [
  { valor: '',   label: 'Todas las clases' },
  { valor: 'AA', label: 'AA — VIP' },
  { valor: 'A',  label: 'A — Top' },
  { valor: 'B',  label: 'B — Sólidos' },
  { valor: 'C',  label: 'C — Ocasionales' },
  { valor: 'D',  label: 'D — Fríos / sin compras' },
];

export default function ClientesPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debounced, setDebounced] = React.useState('');
  const [clase, setClase] = React.useState<'' | Clase>('');
  const qc = useQueryClient();

  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading } = useQuery({
    queryKey: ['clientes', debounced, pagina, clase],
    queryFn: () => obtenerPaginado<Cliente>('/clientes', {
      limite: 30,
      pagina,
      ...(debounced ? { buscar: debounced } : {}),
      ...(clase ? { clasificacion: clase } : {}),
    }),
  });

  const calcular = useMutation({
    mutationFn: () => postear<ResultadoClasificacion>('/clientes/clasificacion/calcular', {}),
    onSuccess: r => {
      const resumen = (['AA', 'A', 'B', 'C', 'D'] as Clase[])
        .map(c => `${c}:${r.distribucion[c] ?? 0}`)
        .join(' · ');
      toast.success(`Clasificación lista — ${resumen}`);
      void qc.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Clientes"
        descripcion="Tu base de clientes registrados, segmentados por clasificación RFM (AA · A · B · C · D)."
        acciones={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => calcular.mutate()}
              disabled={calcular.isPending}
              className="border-[hsl(var(--brand-primary))]/40 bg-gradient-to-r from-[hsl(var(--brand-primary))]/10 to-[#ec4899]/10 hover:from-[hsl(var(--brand-primary))]/20 hover:to-[#ec4899]/20"
            >
              {calcular.isPending
                ? <><Loader2 className="size-4 animate-spin" /> Calculando…</>
                : <><Zap className="size-4 text-[hsl(var(--brand-primary))]" /> Recalcular clasificación</>}
            </Button>
            <Button asChild size="lg">
              <Link href="/clientes/nuevo"><Plus className="size-4" /> Nuevo cliente</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            data-busqueda
            placeholder="Buscar por nombre, documento, email…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={clase}
          onChange={e => { setClase(e.target.value as '' | Clase); setPagina(1); }}
          className="h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-sm"
        >
          {FILTRO_OPCIONES.map(o => (
            <option key={o.valor} value={o.valor}>{o.label}</option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead className="text-center w-20">Clase</TableHead>
              <TableHead className="text-right">Total compras</TableHead>
              <TableHead className="text-right pr-4"></TableHead>
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
                    ilustracion={<IlustracionClientes className="w-full h-full" />}
                    titulo="Tu base de clientes está vacía"
                    descripcion="Registrá tus clientes para llevar el control de sus compras y fidelizar."
                    accion={{ label: '＋ Nuevo cliente', href: '/clientes/nuevo' }}
                  />
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
                  <TableCell className="text-center">
                    {c.clasificacion ? (() => {
                      const cc = COLORES_CLASE[c.clasificacion];
                      return (
                        <span
                          className="inline-block min-w-[28px] px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums border"
                          style={{ background: cc.suave, color: cc.base, borderColor: `${cc.base}40` }}
                          title={`Clase ${c.clasificacion}`}
                        >
                          {c.clasificacion}
                        </span>
                      );
                    })() : <span className="text-[10px] text-[hsl(var(--text-muted))]">—</span>}
                  </TableCell>
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
