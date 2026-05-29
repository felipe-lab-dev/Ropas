'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Eye, MoreVertical, CreditCard, RotateCcw, Ban, Receipt, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DetalleSheet } from '@/components/ui/sheet';
import { obtenerPaginado, mensajeError } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { tienePermiso, useSesion } from '@/lib/store/sesion';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FacetFilter } from '@/components/ui/facet-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { IlustracionVentas } from '@/components/ui/empty-illustrations';
import {
  BadgeRentabilidad,
  tooltipRentabilidad,
  type RentabilidadVenta,
} from '@/lib/rentabilidad-ui';
import { VentaDetalle, type AccionVenta } from './venta-detalle';

interface VentaLista {
  id: string; numero: string;
  cliente?: { nombre: string } | null;
  vendedor: { nombre: string };
  sucursal: { nombre: string };
  estado: 'borrador' | 'confirmada' | 'pagada' | 'parcial' | 'anulada';
  esNotaDeVenta: boolean;
  total: string;
  totalPagado: string;
  creadoEn: string;
  _count: { items: number };
  /** URL del PDF del comprobante. Solo presente si el rol puede verlo (backend filtra). */
  pdfUrl?: string | null;
  /** Rentabilidad por venta (margen + nivel). El backend la calcula por página. */
  rentabilidad: RentabilidadVenta;
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

const COLUMNAS = 10;

export default function VentasPage() {
  return (
    <React.Suspense fallback={<div className="p-8" />}>
      <VentasContenido />
    </React.Suspense>
  );
}

function VentasContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verId = searchParams.get('ver');
  const permisos = useSesion(s => s.usuario?.permisos);

  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [estadosSeleccionados, setEstadosSeleccionados] = React.useState<string[]>([]);
  const [debounced, setDebounced] = React.useState('');

  // Drawer de detalle (reemplaza la antigua ruta /ventas/[id]).
  // La URL (?ver=<id>) es la fuente de verdad: así el botón/gesto "atrás"
  // del navegador cierra el drawer en vez de sacarte del módulo.
  const [ventaAbierta, setVentaAbierta] = React.useState<{ id: string; numero?: string } | null>(
    verId ? { id: verId } : null,
  );
  const [accionInicial, setAccionInicial] = React.useState<AccionVenta | null>(null);
  const pusheamos = React.useRef(false);

  React.useEffect(() => {
    if (verId) {
      setVentaAbierta(prev => (prev?.id === verId ? prev : { id: verId }));
    } else {
      setVentaAbierta(null);
      setAccionInicial(null);
      pusheamos.current = false;
    }
  }, [verId]);

  // Abrir desde la lista: push agrega entrada al historial → "atrás" cierra el drawer.
  const abrir = React.useCallback(
    (id: string, numero?: string, accion: AccionVenta | null = null) => {
      setAccionInicial(accion);
      setVentaAbierta({ id, numero });
      pusheamos.current = true;
      router.push(`/ventas?ver=${id}`, { scroll: false });
    },
    [router],
  );

  // Cambiar de venta dentro del drawer (historial del cliente): replace, no apila historial.
  const cambiarVenta = React.useCallback(
    (id: string) => {
      setAccionInicial(null);
      setVentaAbierta({ id });
      router.replace(`/ventas?ver=${id}`, { scroll: false });
    },
    [router],
  );

  const cerrar = React.useCallback(() => {
    setVentaAbierta(null);
    setAccionInicial(null);
    if (pusheamos.current) {
      pusheamos.current = false;
      router.back();
    } else {
      router.replace('/ventas', { scroll: false });
    }
  }, [router]);

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
              <TableHead className="hidden lg:table-cell">Fecha</TableHead>
              <TableHead className="hidden lg:table-cell">Cliente</TableHead>
              <TableHead className="hidden xl:table-cell">Vendedor</TableHead>
              <TableHead className="hidden xl:table-cell">Sucursal</TableHead>
              <TableHead className="text-right hidden 2xl:table-cell">Items</TableHead>
              <TableHead className="text-right hidden md:table-cell">Rentab.</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  {Array(COLUMNAS).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError || !data ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="p-8 text-center text-[hsl(var(--text-muted))]">
                  No se pudieron cargar las ventas: {mensajeError(error)}
                </TableCell>
              </TableRow>
            ) : data.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="p-0">
                  <EmptyState
                    ilustracion={<IlustracionVentas className="w-full h-full" />}
                    titulo="No hay ventas todavía"
                    descripcion="Cuando emitas tu primer ticket aparecerá aquí con su número, monto y cliente."
                    accion={{ label: '＋ Ir al POS', href: '/pos' }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.datos.map(v => {
                const pendiente = parseFloat(v.total) - parseFloat(v.totalPagado);
                const puedePago =
                  tienePermiso(permisos, 'ventas:crear') &&
                  v.estado !== 'anulada' && v.estado !== 'pagada' && pendiente > 0.01;
                const puedeNC =
                  tienePermiso(permisos, 'notas-credito:crear') && v.estado !== 'anulada';
                const puedeAnular =
                  tienePermiso(permisos, 'ventas:anular') && v.estado !== 'anulada';
                const hayMenu = puedePago || puedeNC || puedeAnular;
                return (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer hover:bg-[hsl(var(--surface-2))]/50"
                    onClick={() => abrir(v.id, v.numero)}
                    data-testid="fila-venta"
                  >
                    <TableCell className="font-mono font-semibold">
                      <div className="flex items-center gap-2">
                        <span>{v.numero}</span>
                        {v.esNotaDeVenta && (
                          <Badge
                            variant="outline"
                            className="border-[hsl(35_90%_55%/0.4)] bg-[hsl(35_90%_55%/0.08)] text-[hsl(35_90%_55%)] text-[10px] font-sans font-medium px-1.5 py-0"
                            title="Nota de venta interna · no se envía a SUNAT"
                          >
                            NV
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-[hsl(var(--text-muted))] hidden lg:table-cell">{formatearFecha(v.creadoEn, 'completa')}</TableCell>
                    <TableCell className="hidden lg:table-cell">{v.cliente?.nombre ?? <span className="text-[hsl(var(--text-muted))]">Consumidor final</span>}</TableCell>
                    <TableCell className="hidden xl:table-cell">{v.vendedor.nombre}</TableCell>
                    <TableCell className="hidden xl:table-cell">{v.sucursal.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums hidden 2xl:table-cell">{v._count.items}</TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      <div className="flex justify-end">
                        <BadgeRentabilidad
                          nivel={v.rentabilidad?.nivel ?? 'sin_datos'}
                          margenPct={v.rentabilidad?.margenPct ?? null}
                          title={v.rentabilidad ? tooltipRentabilidad(v.rentabilidad) : 'Sin datos de rentabilidad'}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatearMoneda(v.total)}</TableCell>
                    <TableCell>
                      <Badge variant={estadoColor[v.estado]}>{v.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {v.pdfUrl && (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            title="Ver PDF del comprobante"
                            aria-label={`Ver PDF de ${v.numero}`}
                          >
                            <a href={v.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <FileText className="size-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => abrir(v.id, v.numero)}
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${v.numero}`}
                          data-testid="btn-ver-venta"
                        >
                          <Eye className="size-4" />
                        </Button>
                        {hayMenu && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Más acciones">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {puedePago && (
                                <DropdownMenuItem onSelect={() => abrir(v.id, v.numero, 'pago')}>
                                  <CreditCard /> Registrar pago
                                </DropdownMenuItem>
                              )}
                              {puedeNC && (
                                <DropdownMenuItem onSelect={() => abrir(v.id, v.numero, 'nc')}>
                                  <RotateCcw /> {v.esNotaDeVenta ? 'Devolución' : 'Nota de crédito'}
                                </DropdownMenuItem>
                              )}
                              {(puedePago || puedeNC) && puedeAnular && <DropdownMenuSeparator />}
                              {puedeAnular && (
                                <DropdownMenuItem variante="danger" onSelect={() => abrir(v.id, v.numero, 'anular')}>
                                  <Ban /> Anular venta
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
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
            limite={30}
            onCambiar={setPagina}
          />
        )}
      </Card>

      <DetalleSheet
        open={!!ventaAbierta}
        onOpenChange={o => { if (!o) cerrar(); }}
        titulo={ventaAbierta?.numero ?? 'Venta'}
        subtitulo="Detalle de venta"
        icono={<Receipt className="size-4" />}
        ancho="2xl"
      >
        {ventaAbierta && (
          <VentaDetalle
            ventaId={ventaAbierta.id}
            accionInicial={accionInicial}
            onAbrirVenta={id => cambiarVenta(id)}
          />
        )}
      </DetalleSheet>
    </div>
  );
}
