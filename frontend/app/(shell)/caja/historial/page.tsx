'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Eye, History, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { obtenerPaginado, obtener } from '@/lib/api/client';
import { formatearFecha, formatearMoneda, iniciales } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { FacetFilter } from '@/components/ui/facet-filter';
import { CajaTabs } from '@/components/caja/caja-tabs';

interface Sucursal { id: string; nombre: string }
interface SesionItem {
  id: string;
  estado: 'abierta' | 'cerrada' | 'con_diferencia';
  montoApertura: string;
  montoCierre: string | null;
  diferencia: string | null;
  abiertaEn: string;
  cerradaEn: string | null;
  cajero: { id: string; nombre: string };
  sucursal: { id: string; nombre: string };
  _count: { ventas: number; movimientos: number };
}

const ESTADOS_FACET = [
  { valor: 'abierta', label: 'Abierta', color: 'hsl(150 55% 50%)' },
  { valor: 'cerrada', label: 'Cerrada', color: 'hsl(265 12% 60%)' },
  { valor: 'con_diferencia', label: 'Con diferencia', color: 'hsl(35 90% 55%)' },
];

const ESTADO_BADGE: Record<SesionItem['estado'], 'success' | 'outline' | 'warning'> = {
  abierta: 'success',
  cerrada: 'outline',
  con_diferencia: 'warning',
};

const ESTADO_LABEL: Record<SesionItem['estado'], string> = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  con_diferencia: 'Con diferencia',
};

export default function HistorialCajaPage() {
  const [pagina, setPagina] = React.useState(1);
  const [buscar, setBuscar] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [estados, setEstados] = React.useState<string[]>([]);
  const [sucursalId, setSucursalId] = React.useState('');
  const [desde, setDesde] = React.useState(
    new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10),
  );
  const [hasta, setHasta] = React.useState(new Date().toISOString().slice(0, 10));

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(buscar);
      setPagina(1);
    }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  React.useEffect(() => setPagina(1), [estados, sucursalId, desde, hasta]);

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['caja-sesiones', pagina, debounced, estados, sucursalId, desde, hasta],
    queryFn: () =>
      obtenerPaginado<SesionItem>('/caja/sesiones', {
        pagina,
        limite: 20,
        ...(debounced ? { buscar: debounced } : {}),
        ...(estados.length === 1 ? { estado: estados[0] } : {}),
        ...(sucursalId ? { sucursalId } : {}),
        ...(desde ? { desde: new Date(desde).toISOString() } : {}),
        ...(hasta ? { hasta: new Date(hasta + 'T23:59:59').toISOString() } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Cierres de caja"
        descripcion="Consulta de cierres anteriores, montos y movimientos."
      />

      <CajaTabs />

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
            <Input
              placeholder="Buscar por cajero o sucursal…"
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              className="pl-9"
            />
          </div>
          {sucursales && sucursales.length > 1 && (
            <Select
              value={sucursalId}
              onChange={e => setSucursalId(e.target.value)}
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[hsl(var(--text-muted))]">
              Desde
            </label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[hsl(var(--text-muted))]">
              Hasta
            </label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        </div>

        <FacetFilter
          titulo="Estado"
          opciones={ESTADOS_FACET}
          seleccionadas={estados}
          onCambiar={setEstados}
        />
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cajero</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Apertura / Cierre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Apertura</TableHead>
              <TableHead className="text-right">Cierre</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  {Array(10).fill(0).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data!.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <EmptyState
                    icono={<History className="size-6" />}
                    titulo="Sin sesiones en este rango"
                    descripcion="Ajusta el rango de fechas o limpia los filtros para ver resultados."
                  />
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold text-xs whitespace-nowrap">
                    {formatearFecha(s.abiertaEn)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-[hsl(var(--brand-primary))]/15 text-[hsl(var(--brand-accent))] grid place-items-center text-[10px] font-bold">
                        {iniciales(s.cajero.nombre)}
                      </div>
                      <span className="text-sm font-medium">{s.cajero.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.sucursal.nombre}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-[10px]">
                      <span className="text-[hsl(150_55%_60%)] font-bold">
                        INICIO: {new Date(s.abiertaEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[hsl(355_85%_70%)] font-bold">
                        FIN:{' '}
                        {s.cerradaEn
                          ? new Date(s.cerradaEn).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                          : '--:--'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_BADGE[s.estado]} className="uppercase text-[10px]">
                      {ESTADO_LABEL[s.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">
                    {formatearMoneda(s.montoApertura)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">
                    {s.montoCierre ? (
                      formatearMoneda(s.montoCierre)
                    ) : (
                      <span className="text-[hsl(var(--text-muted))]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">
                    {s.diferencia ? (
                      <span
                        className={
                          Math.abs(Number(s.diferencia)) < 0.01
                            ? 'text-[hsl(var(--text-muted))]'
                            : 'text-[hsl(35_90%_65%)] font-bold'
                        }
                      >
                        {formatearMoneda(s.diferencia)}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--text-muted))]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {s._count.ventas}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="icon-sm" title="Ver detalle">
                      <Link href={`/caja/historial/${s.id}`}>
                        <Eye className="size-4" />
                      </Link>
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
            limite={20}
            onCambiar={setPagina}
          />
        )}
      </Card>
    </div>
  );
}
