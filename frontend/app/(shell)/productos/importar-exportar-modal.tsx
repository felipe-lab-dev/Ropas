'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Download, Upload, FileSpreadsheet, Clock, CheckCircle2, AlertTriangle, X,
  ArrowDownToLine, ArrowUpToLine, BookOpen, Loader2,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { obtenerPaginado, subirArchivos, mensajeError } from '@/lib/api/client';
import { api } from '@/lib/api/client';
import { formatearNumero } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ResultadoImportacion {
  totalFilas: number;
  exitosas: number;
  fallidas: number;
  creados: number;
  actualizados: number;
  errores: Array<{ fila: number; sku?: string; nombre?: string; error: string }>;
}

interface ItemHistorial {
  id: number;
  creadoEn: string;
  usuario: { id: string; nombre: string; email: string } | null;
  archivo: string;
  totalFilas: number;
  exitosas: number;
  fallidas: number;
  creados: number;
  actualizados: number;
}

interface Props {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}

type Tab = 'importar' | 'historial';

export function ImportarExportarModal({ abierto, onAbiertoChange }: Props) {
  const [tab, setTab] = React.useState<Tab>('importar');
  const [archivo, setArchivo] = React.useState<File | null>(null);
  const [resultado, setResultado] = React.useState<ResultadoImportacion | null>(null);
  const [arrastrando, setArrastrando] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (!abierto) {
      setArchivo(null);
      setResultado(null);
      setTab('importar');
    }
  }, [abierto]);

  const importar = useMutation({
    mutationFn: (file: File) =>
      subirArchivos<ResultadoImportacion>('/productos/importar', [file], 'archivo'),
    onSuccess: (data) => {
      setResultado(data);
      void qc.invalidateQueries({ queryKey: ['productos'] });
      void qc.invalidateQueries({ queryKey: ['productos-importaciones'] });
      if (data.fallidas === 0) {
        toast.success(`${data.creados} creados, ${data.actualizados} actualizados`);
      } else {
        toast.warning(`${data.exitosas} ok, ${data.fallidas} con error`);
      }
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const descargarPlantilla = async () => {
    try {
      const res = await api.get('/productos/importar/plantilla', { responseType: 'blob' });
      gatillarDescarga(res.data as Blob, 'plantilla-productos.csv');
    } catch (e) {
      toast.error(mensajeError(e));
    }
  };

  const exportar = async () => {
    try {
      const res = await api.get('/productos/exportar', { responseType: 'blob' });
      const fecha = new Date().toISOString().slice(0, 10);
      gatillarDescarga(res.data as Blob, `productos-${fecha}.csv`);
      toast.success('Exportación lista');
    } catch (e) {
      toast.error(mensajeError(e));
    }
  };

  const onSeleccionar = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('Solo se acepta archivo .csv');
      return;
    }
    setArchivo(f);
    setResultado(null);
  };

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent
        data-testid="modal-importar-exportar"
        className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[hsl(var(--border))] bg-gradient-to-r from-[hsl(var(--brand-primary))]/10 to-[#0ea5e9]/10">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-[hsl(var(--brand-primary))]" />
            Importar / Exportar Productos
          </DialogTitle>
          <DialogDescription>
            Importá productos desde CSV o exportá el catálogo actual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-[hsl(var(--border))] px-6">
          <button
            type="button"
            data-testid="tab-importar"
            onClick={() => setTab('importar')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
              tab === 'importar'
                ? 'border-[hsl(var(--brand-primary))] text-[hsl(var(--brand-primary))]'
                : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]',
            )}
          >
            <ArrowDownToLine className="size-4" /> Importar
          </button>
          <button
            type="button"
            data-testid="tab-historial"
            onClick={() => setTab('historial')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
              tab === 'historial'
                ? 'border-[hsl(var(--brand-primary))] text-[hsl(var(--brand-primary))]'
                : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]',
            )}
          >
            <Clock className="size-4" /> Historial
          </button>
          <div className="ml-auto py-1.5">
            <Button variant="outline" size="sm" onClick={exportar} data-testid="btn-exportar-catalogo">
              <ArrowUpToLine className="size-4" /> Exportar catálogo
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {tab === 'importar' && (
            <div className="space-y-4">
              <ManualImportacion />

              <div className="flex gap-2">
                <Button variant="outline" onClick={descargarPlantilla} data-testid="btn-descargar-plantilla">
                  <Download className="size-4" /> Descargar plantilla CSV
                </Button>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrando(false);
                  onSeleccionar(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  arrastrando
                    ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/5'
                    : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))]/50',
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  data-testid="input-archivo-csv"
                  onChange={(e) => onSeleccionar(e.target.files)}
                />
                <Upload className="size-8 mx-auto mb-2 text-[hsl(var(--text-muted))]" />
                {archivo ? (
                  <>
                    <p className="text-sm font-medium">{archivo.name}</p>
                    <p className="text-xs text-[hsl(var(--text-muted))]">
                      {(archivo.size / 1024).toFixed(1)} KB · click para reemplazar
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Arrastrá un CSV aquí o hacé click</p>
                    <p className="text-xs text-[hsl(var(--text-muted))]">
                      Hasta 10 MB. Formato esperado: el de la plantilla.
                    </p>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => onAbiertoChange(false)}>
                  <X className="size-4" /> Cerrar
                </Button>
                <Button
                  data-testid="btn-importar"
                  onClick={() => archivo && importar.mutate(archivo)}
                  disabled={!archivo || importar.isPending}
                >
                  {importar.isPending ? (
                    <><Loader2 className="size-4 animate-spin" /> Importando...</>
                  ) : (
                    <><Upload className="size-4" /> Importar</>
                  )}
                </Button>
              </div>

              {resultado && (
                <div data-testid="resultado-importacion">
                  <ResultadoBloque resultado={resultado} />
                </div>
              )}
            </div>
          )}

          {tab === 'historial' && <HistorialTab />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManualImportacion() {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <BookOpen className="size-4 text-[hsl(var(--brand-primary))]" /> Manual de Importación de Productos
      </h4>
      <ol className="space-y-2 text-xs text-[hsl(var(--text-muted))] list-decimal pl-5">
        <li>Descargá la <strong>plantilla CSV</strong> con el botón de abajo.</li>
        <li>Abrila en Excel, Google Sheets o cualquier editor de CSV. Mantené las cabeceras intactas.</li>
        <li>
          Columnas: <code className="px-1 bg-[hsl(var(--surface))] rounded">sku, codigo, nombre, categoria, marca, precioVenta, precioCompra, unidadMedida, descripcion</code>.
        </li>
        <li><strong>nombre</strong>, <strong>categoria</strong> y <strong>precioVenta</strong> son obligatorios. El resto es opcional.</li>
        <li>La <strong>categoría</strong> debe existir en el sistema (mismo nombre exacto). Si dejás <strong>marca</strong> en blanco se asume sin marca.</li>
        <li>Si el <strong>SKU</strong> ya existe en el sistema, el producto se <strong>actualiza</strong>. Si no existe o está vacío, se <strong>crea</strong>.</li>
        <li>Al crear, se agrega una variante "Única" automáticamente. Editá variantes después desde la ficha del producto.</li>
        <li>Filas vacías se ignoran. Errores por fila se muestran al final del proceso, sin abortar el resto.</li>
        <li>Formato del archivo: <strong>.csv</strong> en <strong>UTF-8</strong>. Si tu Excel guarda en otro encoding, exportá como "CSV UTF-8".</li>
      </ol>
    </div>
  );
}

function ResultadoBloque({ resultado }: { resultado: ResultadoImportacion }) {
  const hayErrores = resultado.fallidas > 0;
  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-3',
      hayErrores
        ? 'border-amber-500/40 bg-amber-500/5'
        : 'border-emerald-500/40 bg-emerald-500/5',
    )}>
      <div className="flex items-center gap-2">
        {hayErrores ? (
          <AlertTriangle className="size-5 text-amber-500" />
        ) : (
          <CheckCircle2 className="size-5 text-emerald-500" />
        )}
        <span className="font-semibold text-sm">
          {hayErrores ? 'Importación parcial' : 'Importación exitosa'}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        <Pill label="Total" valor={resultado.totalFilas} />
        <Pill label="Creados" valor={resultado.creados} color="emerald" />
        <Pill label="Actualizados" valor={resultado.actualizados} color="sky" />
        <Pill label="OK" valor={resultado.exitosas} color="emerald" />
        <Pill label="Errores" valor={resultado.fallidas} color={hayErrores ? 'red' : 'muted'} />
      </div>
      {resultado.errores.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
          <table className="w-full text-xs">
            <thead className="bg-[hsl(var(--surface-2))]/40 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left">Fila</th>
                <th className="px-2 py-1.5 text-left">SKU / Nombre</th>
                <th className="px-2 py-1.5 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {resultado.errores.map((e, i) => (
                <tr key={i} className="border-t border-[hsl(var(--border))]">
                  <td className="px-2 py-1 font-mono">{e.fila}</td>
                  <td className="px-2 py-1">{e.sku || e.nombre || '—'}</td>
                  <td className="px-2 py-1 text-red-500">{e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pill({ label, valor, color = 'muted' }: { label: string; valor: number; color?: 'emerald' | 'sky' | 'red' | 'muted' }) {
  const cls = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    muted: 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text-muted))]',
  }[color];
  return (
    <div className={cn('rounded-md px-2 py-1.5', cls)}>
      <div className="text-lg font-bold tabular-nums">{formatearNumero(valor)}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function HistorialTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['productos-importaciones'],
    queryFn: () => obtenerPaginado<ItemHistorial>('/productos/importaciones/historial', { pagina: 1, limite: 50 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded bg-[hsl(var(--surface-2))]/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-red-500">No se pudo cargar el historial.</p>;
  }

  if (!data || data.datos.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="size-10 mx-auto mb-2 text-[hsl(var(--text-muted))] opacity-40" />
        <p className="text-sm text-[hsl(var(--text-muted))]">Sin importaciones registradas todavía.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] text-[hsl(var(--text-muted))]">
            <th className="px-2 py-2 text-left font-medium">Fecha</th>
            <th className="px-2 py-2 text-left font-medium">Usuario</th>
            <th className="px-2 py-2 text-left font-medium">Archivo</th>
            <th className="px-2 py-2 text-right font-medium">Total</th>
            <th className="px-2 py-2 text-right font-medium">Nuevos</th>
            <th className="px-2 py-2 text-right font-medium">Actualizados</th>
            <th className="px-2 py-2 text-right font-medium">Errores</th>
          </tr>
        </thead>
        <tbody>
          {data.datos.map(h => (
            <tr key={h.id} className="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--surface-2))]/30">
              <td className="px-2 py-1.5">{new Date(h.creadoEn).toLocaleString('es-PE')}</td>
              <td className="px-2 py-1.5">{h.usuario?.nombre ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono truncate max-w-[180px]">{h.archivo || '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatearNumero(h.totalFilas)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatearNumero(h.creados)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-sky-600 dark:text-sky-400">
                {formatearNumero(h.actualizados)}
              </td>
              <td className={cn(
                'px-2 py-1.5 text-right tabular-nums',
                h.fallidas > 0 ? 'text-red-500' : 'text-[hsl(var(--text-muted))]',
              )}>
                {formatearNumero(h.fallidas)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function gatillarDescarga(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
