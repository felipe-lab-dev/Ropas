'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { obtener, obtenerPaginado } from '@/lib/api/client';
import { formatearFecha, formatearNumero, cn } from '@/lib/utils';

interface ProductoBasico {
  id: string;
  sku: string;
  codigo: string | null;
  nombre: string;
  variantes: Array<{ id: string; sku: string; talla: string; color: string; colorHex: string | null }>;
}

interface MovimientoKardex {
  id: string;
  fecha: string;
  tipo: string;
  esEntrada: boolean;
  cantidad: number;
  stockAntes: number;
  stockDespues: number;
  notas: string | null;
  sucursal: { id: string; nombre: string };
  variante: { id: string; sku: string; talla: string; color: string; colorHex: string | null } | null;
  referencia: { tipo: string; id: string; numero?: string; fecha?: string; contraparte?: string } | null;
}

const ETIQUETAS_TIPO: Record<string, string> = {
  ingreso_compra: 'Compra',
  ingreso_devolucion: 'Devolución',
  ingreso_ajuste: 'Ajuste +',
  egreso_venta: 'Venta',
  egreso_merma: 'Merma',
  egreso_ajuste: 'Ajuste −',
  traslado_entrada: 'Traslado entra',
  traslado_salida: 'Traslado sale',
};

export function KardexCliente() {
  const search = useSearchParams();
  const id = search.get('id') ?? '';

  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setMonth(haceUnMes.getMonth() - 1);

  const [tipo, setTipo] = React.useState<'ambas' | 'entradas' | 'salidas'>('ambas');
  const [varianteId, setVarianteId] = React.useState('');
  const [fechaIni, setFechaIni] = React.useState(haceUnMes.toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = React.useState(hoy.toISOString().slice(0, 10));
  const [pagina, setPagina] = React.useState(1);

  const { data: producto } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => obtener<ProductoBasico>(`/productos/${id}`),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['kardex', id, tipo, varianteId, fechaIni, fechaFin, pagina],
    queryFn: () =>
      obtenerPaginado<MovimientoKardex>(`/productos/${id}/kardex`, {
        pagina,
        limite: 25,
        tipo,
        fechaIni,
        fechaFin,
        ...(varianteId ? { varianteId } : {}),
      }),
    enabled: !!id,
  });

  const totales = React.useMemo(() => {
    if (!data) return { entradas: 0, salidas: 0 };
    return data.datos.reduce(
      (acc, m) => {
        if (m.esEntrada) acc.entradas += m.cantidad;
        else acc.salidas += m.cantidad;
        return acc;
      },
      { entradas: 0, salidas: 0 },
    );
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Kardex"
        descripcion={
          producto
            ? `${producto.nombre} · ${producto.codigo ?? producto.sku}`
            : 'Cargando…'
        }
        acciones={
          <Button asChild variant="ghost">
            <Link href={`/productos/editar/?id=${id}`}><ArrowLeft className="size-4" /> Volver al producto</Link>
          </Button>
        }
      />

      {/* KPIs página actual */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-[hsl(var(--brand-success))]/15 grid place-items-center">
            <TrendingUp className="size-5 text-[hsl(var(--brand-success))]" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] font-semibold">Entradas (página)</div>
            <div className="text-xl font-bold tabular-nums">+{formatearNumero(totales.entradas)}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-[hsl(var(--brand-danger))]/15 grid place-items-center">
            <TrendingDown className="size-5 text-[hsl(var(--brand-danger))]" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] font-semibold">Salidas (página)</div>
            <div className="text-xl font-bold tabular-nums">−{formatearNumero(totales.salidas)}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-[hsl(var(--brand-primary))]/15 grid place-items-center">
            <Boxes className="size-5 text-[hsl(var(--brand-primary))]" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] font-semibold">Variantes</div>
            <div className="text-xl font-bold tabular-nums">{producto?.variantes.length ?? 0}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-[hsl(var(--surface-2))] grid place-items-center text-sm font-bold">
            {data?.total ?? '—'}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] font-semibold">Total movimientos</div>
            <div className="text-xs text-[hsl(var(--text-muted))]">en el rango seleccionado</div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="fechaIni">Desde</Label>
            <Input
              id="fechaIni"
              type="date"
              value={fechaIni}
              onChange={e => { setFechaIni(e.target.value); setPagina(1); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fechaFin">Hasta</Label>
            <Input
              id="fechaFin"
              type="date"
              value={fechaFin}
              onChange={e => { setFechaFin(e.target.value); setPagina(1); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <Select
              id="tipo"
              value={tipo}
              onChange={e => { setTipo(e.target.value as any); setPagina(1); }}
            >
              <option value="ambas">Todos</option>
              <option value="entradas">Solo entradas</option>
              <option value="salidas">Solo salidas</option>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="variante">Variante</Label>
            <Select
              id="variante"
              value={varianteId}
              onChange={e => { setVarianteId(e.target.value); setPagina(1); }}
            >
              <option value="">Todas las variantes</option>
              {producto?.variantes.map(v => (
                <option key={v.id} value={v.id}>
                  {v.talla} · {v.color} ({v.sku})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[hsl(var(--surface-2))]/40 text-[hsl(var(--text-muted))]">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Fecha</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Movimiento</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Variante</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Documento</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Contraparte</th>
                <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Sucursal</th>
                <th className="text-right px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Cantidad</th>
                <th className="text-right px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Stock</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i} className="border-t border-[hsl(var(--border))]">
                    {Array(8).fill(0).map((__, j) => (
                      <td key={j} className="px-3 py-2"><Skeleton className="h-4" /></td>
                    ))}
                  </tr>
                ))
              ) : data!.datos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-sm text-[hsl(var(--text-muted))]">
                    Sin movimientos en este rango de fechas.
                  </td>
                </tr>
              ) : (
                data!.datos.map(m => (
                  <tr key={m.id} className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))]/30">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{formatearFecha(m.fecha, 'completa')}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold',
                          m.esEntrada
                            ? 'bg-[hsl(var(--brand-success))]/15 text-[hsl(var(--brand-success))]'
                            : 'bg-[hsl(var(--brand-danger))]/15 text-[hsl(var(--brand-danger))]',
                        )}
                      >
                        {m.esEntrada
                          ? <ArrowDownToLine className="size-3" />
                          : <ArrowUpFromLine className="size-3" />}
                        {ETIQUETAS_TIPO[m.tipo] ?? m.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {m.variante ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: m.variante.colorHex ?? '#CCC' }}
                          />
                          <span className="font-medium">{m.variante.talla}</span>
                          <span className="text-[hsl(var(--text-muted))]">· {m.variante.color}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {m.referencia?.numero ?? '—'}
                    </td>
                    <td className="px-3 py-2 truncate max-w-[200px]">
                      {m.referencia?.contraparte ?? <span className="text-[hsl(var(--text-muted))]">—</span>}
                    </td>
                    <td className="px-3 py-2 text-[hsl(var(--text-muted))]">{m.sucursal.nombre}</td>
                    <td className={cn(
                      'px-3 py-2 text-right tabular-nums font-semibold',
                      m.esEntrada ? 'text-[hsl(var(--brand-success))]' : 'text-[hsl(var(--brand-danger))]',
                    )}>
                      {m.esEntrada ? '+' : '−'}{m.cantidad}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="text-[hsl(var(--text-muted))]">{m.stockAntes}</span>
                      <span className="text-[hsl(var(--text-muted))] mx-1">→</span>
                      <span className="font-semibold">{m.stockDespues}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > 0 && (
          <Pagination
            pagina={data.pagina}
            totalPaginas={data.totalPaginas}
            total={data.total}
            limite={25}
            onCambiar={setPagina}
          />
        )}
      </Card>
    </div>
  );
}
