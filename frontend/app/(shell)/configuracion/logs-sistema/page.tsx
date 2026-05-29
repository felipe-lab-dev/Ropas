'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DataTable,
  type ColumnaTabla,
  type TableState,
} from '@/components/ui/data-table';
import { logsSistemaApi, type ErrorSistema, type SeveridadLog } from '@/lib/api/logs-sistema';
import { mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const LIMITE = 30;

const ESTADO_DEFAULT: TableState = {
  sort: { campo: 'creadoEn', dir: 'desc' },
};

function formatearFecha(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function BadgeSeveridad({ s }: { s: SeveridadLog }) {
  const styles: Record<SeveridadLog, string> = {
    critical:
      'bg-[hsl(var(--brand-danger))]/15 text-[hsl(var(--brand-danger))] border-[hsl(var(--brand-danger))]/30',
    error:
      'bg-orange-500/15 text-orange-500 border-orange-500/30',
    warn: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  };
  const Icon = s === 'critical' ? ShieldAlert : s === 'error' ? AlertOctagon : AlertTriangle;
  return (
    <Badge variant="outline" className={cn('gap-1 font-semibold uppercase text-[10px]', styles[s])}>
      <Icon className="size-3" />
      {s}
    </Badge>
  );
}

function BadgeStatus({ code }: { code: number | null }) {
  if (code == null) return <span className="text-[hsl(var(--text-muted))]">—</span>;
  const tone =
    code >= 500
      ? 'text-[hsl(var(--brand-danger))]'
      : code >= 400
        ? 'text-yellow-600'
        : 'text-[hsl(var(--text-muted))]';
  return <span className={cn('font-mono font-semibold text-xs', tone)}>{code}</span>;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))]">
        {label}
      </div>
      <div className="text-sm mt-0.5 break-words">{children ?? '—'}</div>
    </div>
  );
}

function Detalle({ e }: { e: ErrorSistema }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
        <Campo label="Tipo"><code className="text-xs">{e.tipo ?? '—'}</code></Campo>
        <Campo label="Método">{e.metodo ?? '—'}</Campo>
        <Campo label="IP">{e.ip ?? '—'}</Campo>
        <Campo label="Replica">{e.replica ?? '—'}</Campo>
        <Campo label="Usuario">{e.usuarioNombre ?? e.usuarioId ?? '—'}</Campo>
        <Campo label="Tenant">{e.tenantCodigo ?? '—'}</Campo>
        <Campo label="Status">{e.statusCode ?? '—'}</Campo>
        <Campo label="User-Agent">
          <span className="text-xs break-all">{e.userAgent ?? '—'}</span>
        </Campo>
      </div>

      {e.ruta && (
        <Campo label="Ruta">
          <code className="text-xs bg-[hsl(var(--surface-2))] px-2 py-1 rounded">{e.ruta}</code>
        </Campo>
      )}

      {e.stack && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] mb-1">
            Stack
          </div>
          <pre className="text-xs bg-[hsl(var(--surface-2))] p-3 rounded-lg overflow-auto max-h-72 scrollbar-thin font-mono leading-relaxed">
            {e.stack}
          </pre>
        </div>
      )}

      {e.requestBody != null && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] mb-1">
            Request body
          </div>
          <pre className="text-xs bg-[hsl(var(--surface-2))] p-3 rounded-lg overflow-auto max-h-48 scrollbar-thin font-mono">
            {JSON.stringify(e.requestBody, null, 2)}
          </pre>
        </div>
      )}

      {e.requestQuery != null && Object.keys(e.requestQuery as Record<string, unknown>).length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] mb-1">
            Query params
          </div>
          <pre className="text-xs bg-[hsl(var(--surface-2))] p-3 rounded-lg overflow-auto max-h-32 scrollbar-thin font-mono">
            {JSON.stringify(e.requestQuery, null, 2)}
          </pre>
        </div>
      )}

      {e.resuelto && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-xs">
          <div className="font-semibold text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" />
            Resuelto el {e.resueltoEn ? formatearFecha(e.resueltoEn) : '—'}
          </div>
          {e.notasResolucion && (
            <div className="mt-1 text-[hsl(var(--text-muted))]">{e.notasResolucion}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LogsSistemaPage() {
  const qc = useQueryClient();
  const [pagina, setPagina] = React.useState(1);
  const [buscar, setBuscar] = React.useState('');
  const [severidad, setSeveridad] = React.useState<SeveridadLog | ''>('');
  const [soloNoResueltos, setSoloNoResueltos] = React.useState(true);
  const [statusCode, setStatusCode] = React.useState('');
  const [filaExpandida, setFilaExpandida] = React.useState<string | null>(null);
  const [tablaEstado, setTablaEstado] = React.useState<TableState>(ESTADO_DEFAULT);

  // debounce para el search input
  const [buscarDebounced, setBuscarDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setBuscarDebounced(buscar), 400);
    return () => clearTimeout(t);
  }, [buscar]);

  const query = useQuery({
    queryKey: ['logs-sistema', { pagina, buscarDebounced, severidad, soloNoResueltos, statusCode }],
    queryFn: () =>
      logsSistemaApi.listar({
        pagina,
        limite: LIMITE,
        buscar: buscarDebounced || undefined,
        severidad: severidad || undefined,
        soloNoResueltos: soloNoResueltos || undefined,
        statusCode: statusCode || undefined,
      }),
    refetchInterval: 30_000,
  });

  const stats = useQuery({
    queryKey: ['logs-sistema', 'estadisticas'],
    queryFn: () => logsSistemaApi.estadisticas(),
    refetchInterval: 30_000,
  });

  const resolver = useMutation({
    mutationFn: (id: string) => logsSistemaApi.resolver(id),
    onSuccess: () => {
      toast.success('Marcado como resuelto');
      qc.invalidateQueries({ queryKey: ['logs-sistema'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });
  const reabrir = useMutation({
    mutationFn: (id: string) => logsSistemaApi.noResuelto(id),
    onSuccess: () => {
      toast.success('Reabierto');
      qc.invalidateQueries({ queryKey: ['logs-sistema'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });
  const eliminarLog = useMutation({
    mutationFn: (id: string) => logsSistemaApi.eliminar(id),
    onSuccess: () => {
      toast.success('Eliminado');
      qc.invalidateQueries({ queryKey: ['logs-sistema'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const columnas: ColumnaTabla<ErrorSistema>[] = React.useMemo(
    () => [
      {
        id: 'creadoEn',
        titulo: 'Fecha',
        width: 180,
        sortValor: f => f.creadoEn,
        render: f => (
          <div className="font-mono text-xs text-[hsl(var(--text-muted))]">
            {formatearFecha(f.creadoEn)}
          </div>
        ),
      },
      {
        id: 'severidad',
        titulo: 'Sev.',
        width: 110,
        render: f => <BadgeSeveridad s={f.severidad} />,
      },
      {
        id: 'statusCode',
        titulo: 'Status',
        align: 'right',
        width: 80,
        render: f => <BadgeStatus code={f.statusCode} />,
      },
      {
        id: 'metodo',
        titulo: 'Método',
        width: 80,
        render: f =>
          f.metodo ? (
            <code className="text-[10px] font-mono uppercase tracking-wide">{f.metodo}</code>
          ) : (
            '—'
          ),
      },
      {
        id: 'mensaje',
        titulo: 'Mensaje',
        width: 360,
        render: f => (
          <div className="min-w-0">
            <div className="text-sm font-medium truncate" title={f.mensaje}>
              {f.mensaje}
            </div>
            {f.ruta && (
              <div className="text-[10px] text-[hsl(var(--text-muted))] truncate font-mono mt-0.5">
                {f.ruta}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'usuario',
        titulo: 'Usuario',
        width: 160,
        render: f =>
          f.usuarioNombre || f.usuarioId ? (
            <span className="text-xs">{f.usuarioNombre ?? f.usuarioId}</span>
          ) : (
            <span className="text-[hsl(var(--text-muted))] text-xs">anónimo</span>
          ),
      },
      {
        id: 'replica',
        titulo: 'Replica',
        width: 120,
        colClassName: 'hidden xl:table-cell',
        render: f =>
          f.replica ? (
            <code className="text-[10px] font-mono text-[hsl(var(--text-muted))]">{f.replica}</code>
          ) : (
            '—'
          ),
      },
      {
        id: 'acciones',
        titulo: '',
        width: 130,
        movible: false,
        render: f => (
          <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
            {f.resuelto ? (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => reabrir.mutate(f.id)}
                title="Reabrir"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            ) : (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => resolver.mutate(f.id)}
                title="Marcar como resuelto"
                className="hover:text-green-600"
              >
                <CheckCircle2 className="size-3.5" />
              </Button>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                if (confirm('¿Eliminar definitivamente este log?')) eliminarLog.mutate(f.id);
              }}
              title="Eliminar"
              className="hover:text-[hsl(var(--brand-danger))]"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [resolver, reabrir, eliminarLog],
  );

  const filas = query.data?.datos ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Logs de Sistema"
        descripcion="Errores 5xx, 409/413/422 capturados en producción"
        acciones={
          <Button variant="outline" onClick={() => query.refetch()}>
            <RefreshCw className={cn('size-4', query.isFetching && 'animate-spin')} />
            Refrescar
          </Button>
        }
      />

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="text-[10px] uppercase text-[hsl(var(--text-muted))]">Total</div>
          <div className="text-2xl font-bold">{stats.data?.total ?? '—'}</div>
        </Card>
        <Card className="p-3 border-[hsl(var(--brand-danger))]/30">
          <div className="text-[10px] uppercase text-[hsl(var(--text-muted))]">No resueltos</div>
          <div className="text-2xl font-bold text-[hsl(var(--brand-danger))]">
            {stats.data?.noResueltos ?? '—'}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-[hsl(var(--text-muted))]">Críticos</div>
          <div className="text-2xl font-bold">{stats.data?.criticos ?? '—'}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-[hsl(var(--text-muted))]">Últimas 24h</div>
          <div className="text-2xl font-bold">{stats.data?.ultimas24h ?? '—'}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase text-[hsl(var(--text-muted))]">Última hora</div>
          <div className="text-2xl font-bold">{stats.data?.ultimaHora ?? '—'}</div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            value={buscar}
            onChange={e => {
              setBuscar(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por mensaje, ruta, tipo…"
            className="pl-9"
          />
        </div>

        <select
          value={severidad}
          onChange={e => {
            setSeveridad(e.target.value as SeveridadLog | '');
            setPagina(1);
          }}
          className="h-10 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-sm"
        >
          <option value="">Toda severidad</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
        </select>

        <Input
          value={statusCode}
          onChange={e => {
            setStatusCode(e.target.value.replace(/\D/g, ''));
            setPagina(1);
          }}
          placeholder="Status (500, 409…)"
          className="w-32"
          inputMode="numeric"
        />

        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={soloNoResueltos}
            onChange={e => {
              setSoloNoResueltos(e.target.checked);
              setPagina(1);
            }}
            className="rounded"
          />
          Solo no resueltos
        </label>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <DataTable
          columnas={columnas}
          filas={filas}
          getRowKey={f => f.id}
          estado={tablaEstado}
          onEstadoChange={setTablaEstado}
          cargando={query.isLoading}
          rowClassName={f =>
            cn(
              f.resuelto && 'opacity-50',
              f.severidad === 'critical' && 'border-l-2 border-l-[hsl(var(--brand-danger))]',
            )
          }
          filaExpandidaKey={filaExpandida}
          onToggleFilaExpandida={k => setFilaExpandida(p => (p === k ? null : k))}
          renderFilaExpandida={f => <Detalle e={f} />}
          vacioRender={
            <EmptyState
              icono={<CheckCircle2 className="size-6" />}
              titulo="Sin errores"
              descripcion={
                soloNoResueltos
                  ? 'No hay errores pendientes — todo en orden.'
                  : 'Todavía no se registraron errores.'
              }
            />
          }
        />
      </Card>

      {total > LIMITE && (
        <Pagination
          pagina={pagina}
          totalPaginas={Math.ceil(total / LIMITE)}
          total={total}
          limite={LIMITE}
          onCambiar={setPagina}
        />
      )}
    </div>
  );
}
