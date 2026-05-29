'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, PackageCheck, AlertCircle, Eye, MoreVertical, CreditCard, Ban } from 'lucide-react';
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
import { obtenerPaginado } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { tienePermiso, useSesion } from '@/lib/store/sesion';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FacetFilter } from '@/components/ui/facet-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { EstadoError } from '@/components/ui/error-state';
import { CompraDetalle, type AccionCompra } from './compra-detalle';

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
  moneda: string;
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

const COLUMNAS = 9;

export default function ComprasPage() {
  return (
    <React.Suspense fallback={<div className="p-8" />}>
      <ComprasContenido />
    </React.Suspense>
  );
}

function ComprasContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verId = searchParams.get('ver');
  const permisos = useSesion(s => s.usuario?.permisos);

  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [estados, setEstados] = React.useState<string[]>([]);
  const [debounced, setDebounced] = React.useState('');

  // Drawer de detalle (Compras antes no tenía pantalla de detalle).
  const [compraAbierta, setCompraAbierta] = React.useState<{ id: string; numero?: string } | null>(
    verId ? { id: verId } : null,
  );
  const [accionInicial, setAccionInicial] = React.useState<AccionCompra | null>(null);
  const pusheamos = React.useRef(false);

  React.useEffect(() => {
    if (verId) {
      setCompraAbierta(prev => (prev?.id === verId ? prev : { id: verId }));
    } else {
      setCompraAbierta(null);
      setAccionInicial(null);
      pusheamos.current = false;
    }
  }, [verId]);

  const abrir = React.useCallback(
    (id: string, numero?: string, accion: AccionCompra | null = null) => {
      setAccionInicial(accion);
      setCompraAbierta({ id, numero });
      pusheamos.current = true;
      router.push(`/compras?ver=${id}`, { scroll: false });
    },
    [router],
  );

  const cerrar = React.useCallback(() => {
    setCompraAbierta(null);
    setAccionInicial(null);
    if (pusheamos.current) {
      pusheamos.current = false;
      router.back();
    } else {
      router.replace('/compras', { scroll: false });
    }
  }, [router]);

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
              <TableHead className="w-20 text-right">Acciones</TableHead>
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
            ) : data!.datos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNAS} className="p-0">
                  <EmptyState
                    ilustracion={<PackageCheck className="size-20 text-[hsl(var(--brand-primary))/60]" />}
                    titulo="Aún no registraste compras"
                    descripcion="Cuando recibas mercadería de un proveedor, regístrala aquí para sumarla al stock."
                    accion={{ label: '＋ Nueva compra', href: '/compras/nueva' }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data!.datos.map(c => {
                const pendiente = parseFloat(c.total) - parseFloat(c.totalPagado);
                const puedePagar =
                  tienePermiso(permisos, 'compras:pagar') &&
                  c.estado !== 'anulada' && c.estadoPago !== 'pagada' && pendiente > 0.01;
                const puedeAnular =
                  tienePermiso(permisos, 'compras:anular') && c.estado !== 'anulada';
                const hayMenu = puedePagar || puedeAnular;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-[hsl(var(--surface-2))]/50"
                    onClick={() => abrir(c.id, c.numero)}
                    data-testid="fila-compra"
                  >
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
                    <TableCell className="text-right tabular-nums font-bold">
                      {formatearMoneda(c.total, c.moneda)}
                      {c.moneda !== 'PEN' && (
                        <span className="ml-1 text-[10px] font-mono text-[hsl(var(--text-muted))]">{c.moneda}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden xl:table-cell">{formatearMoneda(c.totalPagado, c.moneda)}</TableCell>
                    <TableCell>
                      {c.estado === 'anulada' ? (
                        <Badge variant="danger">Anulada</Badge>
                      ) : c.estado === 'borrador' ? (
                        <Badge variant="outline">Borrador</Badge>
                      ) : (
                        <Badge variant={estadoPagoVariant[c.estadoPago]}>{c.estadoPago}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => abrir(c.id, c.numero)}
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${c.numero}`}
                          data-testid="btn-ver-compra"
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
                              {puedePagar && (
                                <DropdownMenuItem onSelect={() => abrir(c.id, c.numero, 'pago')}>
                                  <CreditCard /> Registrar pago
                                </DropdownMenuItem>
                              )}
                              {puedePagar && puedeAnular && <DropdownMenuSeparator />}
                              {puedeAnular && (
                                <DropdownMenuItem variante="danger" onSelect={() => abrir(c.id, c.numero, 'anular')}>
                                  <Ban /> Anular compra
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
      )}

      <DetalleSheet
        open={!!compraAbierta}
        onOpenChange={o => { if (!o) cerrar(); }}
        titulo={compraAbierta?.numero ?? 'Compra'}
        subtitulo="Detalle de compra"
        icono={<PackageCheck className="size-4" />}
        ancho="2xl"
      >
        {compraAbierta && <CompraDetalle compraId={compraAbierta.id} accionInicial={accionInicial} />}
      </DetalleSheet>
    </div>
  );
}
