'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, BookOpen, LayoutGrid, TrendingUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtener } from '@/lib/api/client';
import { api } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { ReportesBoton } from '@/components/reportes/reportes-boton';
import { EstadoError } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';

type Tab = 'diario' | 'mayor' | 'ventas' | 'compras' | 'estado' | 'periodos' | 'plan';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'diario',   label: 'Libro Diario',     icon: BookOpen },
  { id: 'mayor',    label: 'Libro Mayor',      icon: LayoutGrid },
  { id: 'ventas',   label: 'Registro Ventas',  icon: FileText },
  { id: 'compras',  label: 'Registro Compras', icon: FileText },
  { id: 'estado',   label: 'Estado Resultados', icon: TrendingUp },
  { id: 'periodos', label: 'Períodos',         icon: Calendar },
  { id: 'plan',     label: 'Plan de cuentas',  icon: LayoutGrid },
];

export default function ContabilidadPage() {
  const [tab, setTab] = React.useState<Tab>('diario');
  const hoy = new Date();
  const [anio, setAnio] = React.useState(hoy.getFullYear());
  const [mes, setMes] = React.useState(hoy.getMonth() + 1);

  const descargarPle = async (libro: string) => {
    const res = await api.get(`/contabilidad/exportar/ple`, {
      params: { libro, anio, mes },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LE${anio}${String(mes).padStart(2, '0')}_${libro}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Contabilidad"
        descripcion="Libros oficiales, asientos contables y exportación PLE para SUNAT."
        acciones={
          <div className="flex gap-2 items-center">
            <Input
              type="number" min={2020} max={2100}
              value={anio} onChange={e => setAnio(Number(e.target.value))}
              className="w-24"
            />
            <select
              className="h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
              value={mes} onChange={e => setMes(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m - 1]}</option>
              ))}
            </select>
            <ReportesBoton
              recurso="contabilidad"
              conRango={false}
              filtros={{
                desde: `${anio}-${String(mes).padStart(2, '0')}-01`,
                hasta: `${anio}-${String(mes).padStart(2, '0')}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`,
              }}
            />
          </div>
        }
      />

      <div className="flex gap-1 border-b border-[hsl(var(--border))] overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const activo = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activo
                  ? 'border-[hsl(var(--brand-primary))] text-[hsl(var(--brand-primary))]'
                  : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]',
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'diario'   && <LibroDiario anio={anio} mes={mes} onExportar={() => descargarPle('5.1')} />}
      {tab === 'mayor'    && <LibroMayor anio={anio} mes={mes} />}
      {tab === 'ventas'   && <RegistroVentas anio={anio} mes={mes} onExportar={() => descargarPle('14.1')} />}
      {tab === 'compras'  && <RegistroCompras anio={anio} mes={mes} onExportar={() => descargarPle('8.1')} />}
      {tab === 'estado'   && <EstadoResultados anio={anio} mes={mes} />}
      {tab === 'periodos' && <Periodos />}
      {tab === 'plan'     && <PlanCuentas />}
    </div>
  );
}

function LibroDiario({ anio, mes, onExportar }: { anio: number; mes: number; onExportar: () => void }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['libro-diario', anio, mes],
    queryFn: () => obtener<any>(`/contabilidad/libro-diario?anio=${anio}&mes=${mes}`),
  });

  return (
    <Card className="overflow-hidden">
      <div className="p-4 flex justify-between items-center border-b border-[hsl(var(--border))]">
        <div>
          <div className="font-semibold">Libro Diario — {String(mes).padStart(2, '0')}/{anio}</div>
          {data && (
            <div className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
              Debe: {formatearMoneda(data.totales.debe)} · Haber: {formatearMoneda(data.totales.haber)}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onExportar}>
          <Download className="size-4" /> Exportar PLE 5.1
        </Button>
      </div>
      {isError ? (
        <div className="p-4">
          <EstadoError
            titulo="No se pudo cargar el libro diario"
            error={error}
            onReintentar={() => refetch()}
            reintentando={isFetching}
          />
        </div>
      ) : isLoading ? (
        <div className="p-6"><Skeleton className="h-32" /></div>
      ) : data?.asientos.length === 0 ? (
        <div className="p-12 text-center text-sm text-[hsl(var(--text-muted))]">
          No hay asientos en este período.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asiento</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead className="hidden lg:table-cell">Glosa</TableHead>
              <TableHead className="text-right">Debe</TableHead>
              <TableHead className="text-right">Haber</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.asientos.flatMap((a: any) =>
              a.detalles.map((d: any, i: number) => (
                <TableRow key={`${a.id}-${d.id}`}>
                  {i === 0 ? (
                    <TableCell rowSpan={a.detalles.length} className="font-mono text-xs align-top">
                      <div className="font-semibold">{a.numero}</div>
                      <Badge variant="outline" className="mt-1 text-[10px]">{a.tipoOperacion}</Badge>
                    </TableCell>
                  ) : null}
                  {i === 0 ? (
                    <TableCell rowSpan={a.detalles.length} className="text-xs align-top">{formatearFecha(a.fecha)}</TableCell>
                  ) : null}
                  <TableCell className="font-mono text-xs">
                    <span className="font-semibold">{d.cuentaCodigo}</span>
                    <span className="text-[hsl(var(--text-muted))] ml-2">{d.cuenta.nombre}</span>
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--text-muted))] hidden lg:table-cell">{d.glosa ?? a.glosa}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(d.debe) > 0 ? formatearMoneda(d.debe) : ''}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(d.haber) > 0 ? formatearMoneda(d.haber) : ''}</TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function LibroMayor({ anio, mes }: { anio: number; mes: number }) {
  const [cuenta, setCuenta] = React.useState('70111');
  const { data: plan } = useQuery({
    queryKey: ['plan-cuentas'],
    queryFn: () => obtener<any[]>('/contabilidad/plan-cuentas'),
  });
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['libro-mayor', cuenta, anio, mes],
    enabled: !!cuenta,
    queryFn: () => obtener<any>(`/contabilidad/libro-mayor?cuenta=${cuenta}&anio=${anio}&mes=${mes}`),
  });

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-[hsl(var(--border))]">
        <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Cuenta</label>
        <select
          className="mt-1 w-full md:w-96 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm font-mono"
          value={cuenta}
          onChange={e => setCuenta(e.target.value)}
        >
          {plan?.filter(c => c.aceptaMovimiento).map(c => (
            <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
          ))}
        </select>
      </div>
      {isError ? (
        <div className="p-4">
          <EstadoError
            titulo="No se pudo cargar el libro mayor"
            error={error}
            onReintentar={() => refetch()}
            reintentando={isFetching}
          />
        </div>
      ) : isLoading ? (
        <div className="p-6"><Skeleton className="h-32" /></div>
      ) : !data ? null : (
        <>
          <div className="px-4 py-2 bg-[hsl(var(--surface-2))]/40 text-xs text-[hsl(var(--text-muted))] flex justify-between">
            <span>Saldo inicial: <strong className="font-mono tabular-nums">{formatearMoneda(data.saldoInicial)}</strong></span>
            <span>Saldo final: <strong className="font-mono tabular-nums">{formatearMoneda(data.totales.saldoFinal)}</strong></span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Asiento</TableHead>
                <TableHead className="hidden lg:table-cell">Glosa</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.filas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-[hsl(var(--text-muted))]">
                    Sin movimientos en este período.
                  </TableCell>
                </TableRow>
              ) : (
                data.filas.map((f: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{formatearFecha(f.fecha)}</TableCell>
                    <TableCell className="font-mono text-xs">{f.asientoNumero}</TableCell>
                    <TableCell className="text-xs text-[hsl(var(--text-muted))] hidden lg:table-cell">{f.glosa}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.debe > 0 ? formatearMoneda(f.debe) : ''}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.haber > 0 ? formatearMoneda(f.haber) : ''}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatearMoneda(f.saldo)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
  );
}

function RegistroVentas({ anio, mes, onExportar }: { anio: number; mes: number; onExportar: () => void }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['reg-ventas', anio, mes],
    queryFn: () => obtener<any>(`/contabilidad/registro-ventas?anio=${anio}&mes=${mes}`),
  });
  return (
    <Card className="overflow-hidden">
      <div className="p-4 flex justify-between border-b border-[hsl(var(--border))]">
        <div className="font-semibold">Registro de Ventas — {String(mes).padStart(2, '0')}/{anio}</div>
        <Button variant="outline" size="sm" onClick={onExportar}>
          <Download className="size-4" /> Exportar PLE 14.1
        </Button>
      </div>
      {isError ? (
        <div className="p-4">
          <EstadoError
            titulo="No se pudo cargar el registro de ventas"
            error={error}
            onReintentar={() => refetch()}
            reintentando={isFetching}
          />
        </div>
      ) : isLoading ? <div className="p-6"><Skeleton className="h-32" /></div> : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Doc. cliente</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IGV</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.filas.map((f: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{formatearFecha(f.fecha)}</TableCell>
                  <TableCell className="font-mono text-xs">{f.comprobante}</TableCell>
                  <TableCell className="font-mono text-xs">{f.docCliente}</TableCell>
                  <TableCell className="text-sm">{f.nombreCliente}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(f.baseImponible)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(f.igv)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatearMoneda(f.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && (
            <div className="p-3 bg-[hsl(var(--surface-2))]/40 text-sm flex justify-end gap-6 font-mono tabular-nums">
              <span>Base: <strong>{formatearMoneda(data.totales.baseImponible)}</strong></span>
              <span>IGV: <strong>{formatearMoneda(data.totales.igv)}</strong></span>
              <span>Total: <strong>{formatearMoneda(data.totales.total)}</strong></span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function RegistroCompras({ anio, mes, onExportar }: { anio: number; mes: number; onExportar: () => void }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['reg-compras', anio, mes],
    queryFn: () => obtener<any>(`/contabilidad/registro-compras?anio=${anio}&mes=${mes}`),
  });
  return (
    <Card className="overflow-hidden">
      <div className="p-4 flex justify-between border-b border-[hsl(var(--border))]">
        <div className="font-semibold">Registro de Compras — {String(mes).padStart(2, '0')}/{anio}</div>
        <Button variant="outline" size="sm" onClick={onExportar}>
          <Download className="size-4" /> Exportar PLE 8.1
        </Button>
      </div>
      {isError ? (
        <div className="p-4">
          <EstadoError
            titulo="No se pudo cargar el registro de compras"
            error={error}
            onReintentar={() => refetch()}
            reintentando={isFetching}
          />
        </div>
      ) : isLoading ? <div className="p-6"><Skeleton className="h-32" /></div> : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emisión</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>RUC</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">IGV</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.filas.map((f: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{formatearFecha(f.fechaEmision)}</TableCell>
                  <TableCell className="font-mono text-xs">{f.serie}-{f.numero}</TableCell>
                  <TableCell className="font-mono text-xs">{f.docProveedor}</TableCell>
                  <TableCell className="text-sm">{f.razonSocial}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(f.baseImponible)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(f.igv)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatearMoneda(f.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && (
            <div className="p-3 bg-[hsl(var(--surface-2))]/40 text-sm flex justify-end gap-6 font-mono tabular-nums">
              <span>Base: <strong>{formatearMoneda(data.totales.baseImponible)}</strong></span>
              <span>IGV: <strong>{formatearMoneda(data.totales.igv)}</strong></span>
              <span>Total: <strong>{formatearMoneda(data.totales.total)}</strong></span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function EstadoResultados({ anio, mes }: { anio: number; mes: number }) {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ult = new Date(anio, mes, 0).getDate();
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${ult}`;
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['estado-resultados', desde, hasta],
    queryFn: () => obtener<any>(`/contabilidad/estado-resultados?desde=${desde}&hasta=${hasta}`),
  });
  if (isError) return (
    <EstadoError
      titulo="No se pudo cargar el estado de resultados"
      error={error}
      onReintentar={() => refetch()}
      reintentando={isFetching}
    />
  );
  if (isLoading || !data) return <Card className="p-6"><Skeleton className="h-32" /></Card>;
  const linea = (label: string, monto: number, fuerte = false) => (
    <div className={cn('flex justify-between py-2 border-b border-[hsl(var(--border))] text-sm', fuerte && 'font-bold text-base pt-3')}>
      <span>{label}</span>
      <span className="tabular-nums">{formatearMoneda(monto)}</span>
    </div>
  );
  return (
    <Card className="p-6 max-w-2xl">
      <div className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-1">Estado de Resultados</div>
      <div className="text-sm text-[hsl(var(--text-muted))] mb-4">Del {formatearFecha(desde)} al {formatearFecha(hasta)}</div>
      {linea('Ingresos por ventas', data.ingresos)}
      {linea('(–) Costo de ventas', data.costoVentas)}
      {linea('Utilidad bruta', data.utilidadBruta, true)}
      {linea('(–) Gastos operativos', data.gastos)}
      {linea('Utilidad operativa', data.utilidadOperativa, true)}
    </Card>
  );
}

function Periodos() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['periodos'],
    queryFn: () => obtener<any[]>('/contabilidad/periodos'),
  });
  return (
    <Card className="overflow-hidden">
      {isError ? (
        <div className="p-4">
          <EstadoError
            titulo="No se pudieron cargar los períodos contables"
            error={error}
            onReintentar={() => refetch()}
            reintentando={isFetching}
          />
        </div>
      ) : isLoading ? <div className="p-6"><Skeleton className="h-32" /></div> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cerrado el</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-sm text-[hsl(var(--text-muted))]">
                  Aún no hay períodos contables. Se crean automáticamente al registrar el primer asiento.
                </TableCell>
              </TableRow>
            ) : data?.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.anio}-{String(p.mes).padStart(2, '0')}</TableCell>
                <TableCell><Badge variant={p.estado === 'cerrado' ? 'outline' : 'success'}>{p.estado}</Badge></TableCell>
                <TableCell className="text-xs">{p.cerradoEn ? formatearFecha(p.cerradoEn) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function PlanCuentas() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['plan-cuentas'],
    queryFn: () => obtener<any[]>('/contabilidad/plan-cuentas'),
  });
  return (
    <Card className="overflow-hidden">
      {isError ? (
        <div className="p-4">
          <EstadoError
            titulo="No se pudo cargar el plan de cuentas"
            error={error}
            onReintentar={() => refetch()}
            reintentando={isFetching}
          />
        </div>
      ) : isLoading ? <div className="p-6"><Skeleton className="h-32" /></div> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Naturaleza</TableHead>
              <TableHead>Hoja</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((c: any) => (
              <TableRow key={c.codigo}>
                <TableCell className="font-mono font-semibold">{c.codigo}</TableCell>
                <TableCell style={{ paddingLeft: `${c.nivel * 12}px` }}>{c.nombre}</TableCell>
                <TableCell><Badge variant="outline">{c.tipo}</Badge></TableCell>
                <TableCell className="text-xs">{c.naturaleza}</TableCell>
                <TableCell>{c.aceptaMovimiento ? '✓' : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
