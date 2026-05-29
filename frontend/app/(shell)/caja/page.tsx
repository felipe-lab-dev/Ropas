'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Wallet,
  Lock,
  Unlock,
  Plus,
  Minus,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  Banknote,
  Trash2,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  DataTable,
  type ColumnaTabla,
  type TableState,
} from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { obtener, obtenerPaginado, eliminar, mensajeError } from '@/lib/api/client';
import { formatearFecha, formatearMoneda, cn } from '@/lib/utils';
import { useSesion } from '@/lib/store/sesion';
import { usePreferencias } from '@/lib/use-preferencias';
import { PageHeader } from '@/components/ui/page-header';
import { ReportesBoton } from '@/components/reportes/reportes-boton';
import { EmptyState } from '@/components/ui/empty-state';
import { EstadoError } from '@/components/ui/error-state';
import { KpiCard } from '@/components/caja/kpi-card';
import { DialogApertura } from '@/components/caja/dialog-apertura';
import { DialogCierre } from '@/components/caja/dialog-cierre';
import { DialogMovimiento } from '@/components/caja/dialog-movimiento';
import { CajaTabs } from '@/components/caja/caja-tabs';
import { etiquetaMedio, esMedioFisico } from '@/components/caja/medio-pago';
import {
  CATEGORIAS_INGRESO,
  CATEGORIAS_EGRESO,
  categoriaDef,
  type CategoriaMovimiento,
} from '@/components/caja/categorias';

interface Sucursal { id: string; nombre: string }

interface SesionCaja {
  id: string;
  estado: 'abierta' | 'cerrada' | 'con_diferencia';
  montoApertura: string;
  abiertaEn: string;
  sucursal: { id: string; nombre: string };
  cajero: { id: string; nombre: string };
}

interface MovimientoCaja {
  id: string;
  tipo: 'ingreso' | 'egreso' | 'retiro' | 'ajuste';
  categoria: CategoriaMovimiento | null;
  subCategoria: string | null;
  medio: string;
  moneda: string;
  monto: string;
  motivo: string;
  comprobante: string | null;
  contraparte: string | null;
  contraparteDocumento: string | null;
  creadoEn: string;
  creadoPor: { id: string; nombre: string } | null;
}

interface SaldoMonedaExtra {
  moneda: string;
  apertura: number;
  ingresos: number;
  egresos: number;
  efectivoEsperado: number;
}

interface TotalesSesion {
  sesionId: string;
  efectivoEsperado: number;
  porMoneda?: SaldoMonedaExtra[];
  ventas: { cantidad: number; total: number; totalCobrado: number; porMedio: Record<string, number> };
  ingresosManual: { total: number; porMedio: Record<string, number> };
  egresosManual: { total: number; porMedio: Record<string, number> };
}

type Flujo = 'todos' | 'fisico' | 'virtual';

const ESTADO_DEFAULT: TableState = {
  sort: { campo: 'creadoEn', dir: 'desc' },
};

export default function CajaPage() {
  const usuario = useSesion(s => s.usuario);
  const qc = useQueryClient();
  const [sucursalId, setSucursalId] = React.useState(usuario?.sucursalDefecto ?? '');
  const [modo, setModo] = React.useState<'ingreso' | 'egreso'>('ingreso');
  const [flujo, setFlujo] = React.useState<Flujo>('todos');
  const [categoria, setCategoria] = React.useState<CategoriaMovimiento | ''>('');
  const [buscar, setBuscar] = React.useState('');
  const [debouncedBuscar, setDebouncedBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [openApertura, setOpenApertura] = React.useState(false);
  const [openCierre, setOpenCierre] = React.useState(false);
  const [openMov, setOpenMov] = React.useState(false);
  const [tipoMov, setTipoMov] = React.useState<'ingreso' | 'egreso'>('ingreso');

  const [estadoTabla, setEstadoTabla] = usePreferencias<TableState>('caja-movs', ESTADO_DEFAULT);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedBuscar(buscar), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  // Reset categoría cuando cambias entre ingreso/egreso
  React.useEffect(() => { setCategoria(''); setPagina(1); }, [modo]);
  React.useEffect(() => { setPagina(1); }, [flujo, categoria, debouncedBuscar]);

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  React.useEffect(() => {
    if (sucursales && !sucursalId && sucursales[0]) setSucursalId(sucursales[0].id);
  }, [sucursales, sucursalId]);

  const sesionQ = useQuery({
    queryKey: ['caja-mi-sesion', sucursalId],
    queryFn: () =>
      obtener<SesionCaja | null>(`/caja/mi-sesion-abierta?sucursalId=${sucursalId}`),
    enabled: !!sucursalId,
  });
  const sesion = sesionQ.data;

  const totalesQ = useQuery({
    queryKey: ['caja-totales', sesion?.id],
    queryFn: () => obtener<TotalesSesion>(`/caja/sesiones/${sesion!.id}/totales`),
    enabled: !!sesion?.id,
  });

  const movimientosQ = useQuery({
    queryKey: ['caja-movimientos', sesion?.id, modo, flujo, categoria, debouncedBuscar, pagina],
    queryFn: () =>
      obtenerPaginado<MovimientoCaja>(`/caja/sesiones/${sesion!.id}/movimientos`, {
        tipo: modo,
        ...(flujo !== 'todos' ? { flujo } : {}),
        ...(categoria ? { categoria } : {}),
        ...(debouncedBuscar ? { buscar: debouncedBuscar } : {}),
        pagina,
        limite: 20,
      }),
    enabled: !!sesion?.id,
  });

  const saldoAnteriorYaRegistrado = React.useMemo(
    () => (movimientosQ.data?.datos ?? []).some(m => m.categoria === 'saldo_anterior'),
    [movimientosQ.data],
  );

  const eliminarMov = useMutation({
    mutationFn: (id: string) => eliminar(`/caja/movimientos/${id}`),
    onSuccess: () => {
      toast.success('Movimiento eliminado');
      qc.invalidateQueries({ queryKey: ['caja-movimientos', sesion?.id] });
      qc.invalidateQueries({ queryKey: ['caja-totales', sesion?.id] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const sumarNoEfectivo = (mapa: Record<string, number>) =>
    Object.entries(mapa).reduce((s, [m, v]) => (m === 'efectivo' ? s : s + v), 0);
  const ingEfectivo =
    (totalesQ.data?.ventas.porMedio['efectivo'] ?? 0) +
    (totalesQ.data?.ingresosManual.porMedio['efectivo'] ?? 0);
  const ingVirtual =
    sumarNoEfectivo(totalesQ.data?.ventas.porMedio ?? {}) +
    sumarNoEfectivo(totalesQ.data?.ingresosManual.porMedio ?? {});
  const egrEfectivo = totalesQ.data?.egresosManual.porMedio['efectivo'] ?? 0;
  const egrVirtual = sumarNoEfectivo(totalesQ.data?.egresosManual.porMedio ?? {});

  const categoriasDelModo = modo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  const columnas: ColumnaTabla<MovimientoCaja>[] = React.useMemo(
    () => [
      {
        id: 'creadoEn',
        titulo: 'Hora',
        width: 112,
        sortValor: m => m.creadoEn,
        render: m => (
          <span className="text-xs font-semibold tabular-nums whitespace-nowrap">
            {formatearFecha(m.creadoEn, 'completa')}
          </span>
        ),
      },
      {
        id: 'categoria',
        titulo: 'Categoría',
        width: 150,
        sortValor: m => m.categoria ?? '',
        render: m => {
          const def = categoriaDef(m.categoria);
          if (!def) return <span className="text-[hsl(var(--text-muted))]">—</span>;
          return (
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{def.icono}</span>
              <span className="text-xs font-semibold">{def.label}</span>
            </div>
          );
        },
      },
      {
        id: 'motivo',
        titulo: 'Detalle',
        width: 220,
        render: m => (
          <div className="flex flex-col">
            <span className="text-sm font-medium truncate">{m.motivo}</span>
            {m.contraparte && (
              <span className="text-[11px] text-[hsl(var(--text-muted))] truncate">
                {m.contraparte}
                {m.contraparteDocumento && (
                  <span className="font-mono ml-1">· {m.contraparteDocumento}</span>
                )}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'comprobante',
        titulo: 'N° comprobante',
        width: 130,
        colClassName: 'hidden lg:table-cell',
        render: m =>
          m.comprobante ? (
            <span className="text-xs font-mono">{m.comprobante}</span>
          ) : (
            <span className="text-xs text-[hsl(var(--text-muted))]">S/N</span>
          ),
      },
      {
        id: 'medio',
        titulo: 'Medio',
        width: 120,
        colClassName: 'hidden xl:table-cell',
        render: m => (
          <Badge
            variant={esMedioFisico(m.medio as never) ? 'success' : 'default'}
            className="uppercase text-[10px]"
          >
            {etiquetaMedio(m.medio)}
          </Badge>
        ),
      },
      {
        id: 'monto',
        titulo: 'Monto',
        align: 'right',
        width: 120,
        sortValor: m => Number(m.monto),
        render: m => (
          <span
            className={cn(
              'font-bold tabular-nums',
              modo === 'ingreso'
                ? 'text-[hsl(150_55%_60%)]'
                : 'text-[hsl(355_85%_70%)]',
            )}
          >
            {modo === 'egreso' ? '−' : '+'}
            {formatearMoneda(m.monto, m.moneda || 'PEN')}
            {m.moneda && m.moneda !== 'PEN' && (
              <span className="ml-1 text-[10px] font-mono text-[hsl(var(--text-muted))]">{m.moneda}</span>
            )}
          </span>
        ),
      },
      {
        id: 'acciones',
        titulo: '',
        width: 56,
        movible: false,
        render: m => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (confirm('¿Eliminar este movimiento?')) eliminarMov.mutate(m.id);
            }}
            className="text-[hsl(355_85%_70%)] hover:bg-[hsl(355_75%_55%)]/15"
            title="Eliminar"
          >
            <Trash2 className="size-3.5" />
          </Button>
        ),
      },
    ],
    [modo, eliminarMov],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Operaciones del día"
        descripcion="Estado de caja, ingresos y egresos de la sesión activa."
        acciones={
          <ReportesBoton
            recurso="caja"
            filtros={{ sucursalId: sucursalId || undefined }}
          />
        }
      />

      <CajaTabs />

      {/* Tarjeta de estado de caja */}
      <Card className="overflow-hidden">
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'size-12 rounded-xl grid place-items-center shadow-md',
                sesion
                  ? 'bg-[hsl(var(--brand-success))]/20 text-[hsl(150_55%_60%)]'
                  : 'bg-[hsl(var(--text-muted))]/15 text-[hsl(var(--text-muted))]',
              )}
            >
              <Wallet className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-tight">
                {sesion ? 'Caja abierta' : 'Caja cerrada'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant={sesion ? 'success' : 'outline'}>
                  {sesion ? 'ACTIVA' : 'SIN SESIÓN'}
                </Badge>
                {sesion && (
                  <>
                    <span className="text-xs text-[hsl(var(--text-muted))]">
                      Desde {formatearFecha(sesion.abiertaEn, 'completa')}
                    </span>
                    <span className="text-[hsl(var(--text-muted))]/40">·</span>
                    <span className="text-xs text-[hsl(var(--text-muted))]">
                      {sesion.cajero.nombre} · {sesion.sucursal.nombre}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!sesion && sucursales && sucursales.length > 1 && (
              <Select
                value={sucursalId}
                onChange={e => setSucursalId(e.target.value)}
                className="h-9"
              >
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </Select>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                sesionQ.refetch();
                totalesQ.refetch();
                movimientosQ.refetch();
              }}
              title="Actualizar"
            >
              <RefreshCw className="size-4" />
            </Button>
            {sesion ? (
              <Button variant="danger" onClick={() => setOpenCierre(true)}>
                <Lock className="size-4" /> Cerrar caja
              </Button>
            ) : (
              <Button onClick={() => setOpenApertura(true)} disabled={!sucursalId}>
                <Unlock className="size-4" /> Abrir caja
              </Button>
            )}
          </div>
        </div>
      </Card>

      {sesionQ.isError ? (
        <EstadoError
          titulo="No se pudo cargar el estado de la caja"
          error={sesionQ.error}
          onReintentar={() => sesionQ.refetch()}
          reintentando={sesionQ.isFetching}
        />
      ) : sesion ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {totalesQ.isLoading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
            ) : (
              <>
                <KpiCard
                  titulo="Ingresos efectivo"
                  monto={ingEfectivo}
                  detalle={`Ventas + manual · ${totalesQ.data?.ventas.cantidad ?? 0} ventas`}
                  icono={<Banknote className="size-5" />}
                  tono="success"
                  delay={0}
                />
                <KpiCard
                  titulo="Ingresos virtuales"
                  monto={ingVirtual}
                  detalle="Tarjeta · transferencia · billeteras"
                  icono={<CreditCard className="size-5" />}
                  tono="info"
                  delay={0.05}
                />
                <KpiCard
                  titulo="Egresos efectivo"
                  monto={egrEfectivo}
                  detalle="Salidas en efectivo"
                  icono={<ArrowUpFromLine className="size-5" />}
                  tono="danger"
                  delay={0.1}
                />
                <KpiCard
                  titulo="Egresos virtuales"
                  monto={egrVirtual}
                  detalle="Pagos por otros medios"
                  icono={<ArrowUpFromLine className="size-5" />}
                  tono="warning"
                  delay={0.15}
                />
              </>
            )}
          </div>

          {/* Resumen efectivo esperado */}
          {totalesQ.data && (
            <Card className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-bold">
                    Monto apertura
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-1">
                    {formatearMoneda(sesion ? Number(sesion.montoApertura) : 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-bold">
                    Total ventas
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-1">
                    {formatearMoneda(totalesQ.data.ventas.total)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--brand-accent))] font-bold">
                    Efectivo esperado en caja
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-1 text-[hsl(var(--brand-accent))]">
                    {formatearMoneda(totalesQ.data.efectivoEsperado)}
                  </p>
                </div>
              </div>
              {totalesQ.data.porMoneda && totalesQ.data.porMoneda.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex flex-wrap gap-6">
                  {totalesQ.data.porMoneda.map(pm => (
                    <div key={pm.moneda}>
                      <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-bold">
                        Efectivo esperado {pm.moneda}
                      </p>
                      <p className="text-lg font-bold tabular-nums mt-1">
                        {formatearMoneda(pm.efectivoEsperado, pm.moneda)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Toggle + filtros + tabla */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 p-4 border-b border-[hsl(var(--border))]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Toggle Ingresos/Egresos */}
                <SegmentedControl
                  size="lg"
                  ariaLabel="Tipo de movimiento"
                  value={modo}
                  onChange={setModo}
                  options={[
                    {
                      value: 'ingreso',
                      label: 'Ingresos',
                      icono: <ArrowDownToLine className="size-3.5" />,
                      activeClassName: 'bg-gradient-to-br from-[hsl(150_55%_42%)] to-[hsl(150_55%_32%)] text-white shadow-md',
                    },
                    {
                      value: 'egreso',
                      label: 'Egresos',
                      icono: <ArrowUpFromLine className="size-3.5" />,
                      activeClassName: 'bg-gradient-to-br from-[hsl(355_75%_55%)] to-[hsl(355_70%_42%)] text-white shadow-md',
                    },
                  ]}
                />

                <Button
                  variant={modo === 'ingreso' ? 'default' : 'danger'}
                  size="sm"
                  onClick={() => {
                    setTipoMov(modo);
                    setOpenMov(true);
                  }}
                >
                  {modo === 'ingreso' ? (
                    <>
                      <Plus className="size-4" /> Registrar ingreso
                    </>
                  ) : (
                    <>
                      <Minus className="size-4" /> Registrar egreso
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtros físico/virtual */}
                <SegmentedControl
                  size="md"
                  ariaLabel="Filtrar por flujo"
                  value={flujo}
                  onChange={setFlujo}
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'fisico', label: '💵 Físico' },
                    { value: 'virtual', label: '💳 Virtual' },
                  ]}
                />

                {/* Filtro categoría */}
                <Select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value as CategoriaMovimiento | '')}
                  className="h-8 text-xs max-w-[200px]"
                >
                  <option value="">Todas las categorías</option>
                  {categoriasDelModo.map(c => (
                    <option key={c.valor} value={c.valor}>
                      {c.icono} {c.label}
                    </option>
                  ))}
                </Select>

                {/* Buscar */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[hsl(var(--text-muted))] pointer-events-none" />
                  <Input
                    value={buscar}
                    onChange={e => setBuscar(e.target.value)}
                    placeholder="Buscar motivo, comprobante, contraparte…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {movimientosQ.isError ? (
              <div className="p-4">
                <EstadoError
                  titulo="No se pudieron cargar los movimientos"
                  error={movimientosQ.error}
                  onReintentar={() => movimientosQ.refetch()}
                  reintentando={movimientosQ.isFetching}
                />
              </div>
            ) : (
            <>
            <DataTable<MovimientoCaja>
              columnas={columnas}
              filas={movimientosQ.data?.datos ?? []}
              getRowKey={m => m.id}
              estado={estadoTabla}
              onEstadoChange={setEstadoTabla}
              cargando={movimientosQ.isLoading}
              vacioRender={
                <EmptyState
                  icono={
                    modo === 'ingreso' ? (
                      <ArrowDownToLine className="size-6" />
                    ) : (
                      <ArrowUpFromLine className="size-6" />
                    )
                  }
                  titulo={
                    modo === 'ingreso'
                      ? 'Sin ingresos manuales registrados'
                      : 'Sin egresos registrados'
                  }
                  descripcion={
                    modo === 'ingreso'
                      ? 'Las ventas se contabilizan automáticamente. Aquí registras saldo anterior, adelantos, cobros de crédito y otros ingresos manuales.'
                      : 'Registra salidas de dinero: pagos a proveedores, servicios, comisiones, movilidad, etc.'
                  }
                />
              }
            />
            {movimientosQ.data && movimientosQ.data.total > 0 && (
              <Pagination
                pagina={movimientosQ.data.pagina}
                totalPaginas={movimientosQ.data.totalPaginas}
                total={movimientosQ.data.total}
                limite={20}
                onCambiar={setPagina}
              />
            )}
            </>
            )}
          </Card>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <EmptyState
              icono={<Wallet className="size-6" />}
              titulo="No tienes una sesión de caja abierta"
              descripcion="Abre la caja con el monto inicial en efectivo para empezar a vender y registrar movimientos."
              accion={{
                label: 'Abrir caja',
                onClick: () => setOpenApertura(true),
              }}
            />
          </Card>
        </motion.div>
      )}

      {/* Dialogs */}
      {sucursalId && (
        <DialogApertura
          open={openApertura}
          onOpenChange={setOpenApertura}
          sucursalId={sucursalId}
          sucursalNombre={sucursales?.find(s => s.id === sucursalId)?.nombre}
        />
      )}
      {sesion && totalesQ.data && (
        <DialogCierre
          open={openCierre}
          onOpenChange={setOpenCierre}
          sesionId={sesion.id}
          efectivoEsperado={totalesQ.data.efectivoEsperado}
          porMoneda={totalesQ.data.porMoneda}
        />
      )}
      {sesion && (
        <DialogMovimiento
          open={openMov}
          onOpenChange={setOpenMov}
          sesionId={sesion.id}
          tipo={tipoMov}
          saldoAnteriorYaRegistrado={saldoAnteriorYaRegistrado}
        />
      )}
    </div>
  );
}
