'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc' | null;

export interface ColumnaTabla<T> {
  /** Identificador estable usado para sort/order/widths/filtros. */
  id: string;
  /** Título visible en el header. */
  titulo?: string;
  /** Render del header. Si omitido se usa `titulo`. */
  renderHeader?: () => React.ReactNode;
  /** Render de la celda. */
  render: (fila: T, idx: number) => React.ReactNode;
  /** Habilita sort. Función que extrae el valor a comparar. */
  sortValor?: (fila: T) => number | string | null | undefined;
  /** Habilita filter funnel. */
  filter?: FilterDef<T>;
  /** Alineación de header y celda. */
  align?: 'left' | 'right' | 'center';
  /** Ancho inicial en px. Default 160. */
  width?: number;
  /** Ancho mínimo. Default 60. */
  minWidth?: number;
  /** Si false, no participa en drag/resize y queda fija (ej. acciones). */
  movible?: boolean;
  /** Clase extra para la celda. */
  cellClassName?: string;
  /** Clase extra aplicada a header y celdas (útil para `hidden xl:table-cell`). */
  colClassName?: string;
}

export type FilterDef<T> =
  | { tipo: 'texto'; getValor: (fila: T) => string | null | undefined }
  | { tipo: 'rango'; getValor: (fila: T) => number | null | undefined }
  | { tipo: 'select'; getValor: (fila: T) => string | null | undefined; opciones?: Array<{ valor: string; label: string }> };

export interface TableState {
  sort?: { campo: string; dir: 'asc' | 'desc' };
  orden?: string[]; // ids ordenados
  anchos?: Record<string, number>;
  filtros?: Record<string, FiltroValor>;
}
export type FiltroValor =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'rango'; min?: number; max?: number }
  | { tipo: 'select'; valor: string };

interface Props<T> {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  getRowKey: (fila: T) => string;
  estado: TableState;
  onEstadoChange: (siguiente: TableState | ((p: TableState) => TableState)) => void;
  rowClassName?: (fila: T) => string;
  /** Render opcional de una celda al inicio (ej. color strip). */
  renderRowAccent?: (fila: T) => React.ReactNode;
  vacioRender?: React.ReactNode;
  cargando?: boolean;
  cargandoFilas?: number;
  /** Render del panel expandido bajo la fila. Si se pasa, la fila es clickeable. */
  renderFilaExpandida?: (fila: T) => React.ReactNode;
  /** Key de la fila actualmente expandida (controlado por el padre). */
  filaExpandidaKey?: string | null;
  /** Llamado al click en la fila para toggle. */
  onToggleFilaExpandida?: (key: string) => void;
}

// ─── Utilidades ───────────────────────────────────────────────────────────

function aplicarSort<T>(filas: T[], cols: ColumnaTabla<T>[], sort?: TableState['sort']): T[] {
  if (!sort) return filas;
  const col = cols.find(c => c.id === sort.campo);
  if (!col?.sortValor) return filas;
  const factor = sort.dir === 'asc' ? 1 : -1;
  return [...filas].sort((a, b) => {
    const va = col.sortValor!(a);
    const vb = col.sortValor!(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
    return String(va).localeCompare(String(vb), 'es', { numeric: true }) * factor;
  });
}

function aplicarFiltros<T>(filas: T[], cols: ColumnaTabla<T>[], filtros?: Record<string, FiltroValor>): T[] {
  if (!filtros) return filas;
  return filas.filter(f => {
    for (const [campo, valor] of Object.entries(filtros)) {
      const col = cols.find(c => c.id === campo);
      if (!col?.filter) continue;
      const dato = col.filter.getValor(f);
      if (valor.tipo === 'texto' && valor.valor.trim()) {
        if (!String(dato ?? '').toLowerCase().includes(valor.valor.trim().toLowerCase())) return false;
      } else if (valor.tipo === 'rango') {
        const n = Number(dato ?? 0);
        if (valor.min !== undefined && n < valor.min) return false;
        if (valor.max !== undefined && n > valor.max) return false;
      } else if (valor.tipo === 'select' && valor.valor) {
        if (String(dato ?? '') !== valor.valor) return false;
      }
    }
    return true;
  });
}

function aplicarOrdenColumnas<T>(cols: ColumnaTabla<T>[], orden?: string[]): ColumnaTabla<T>[] {
  if (!orden || orden.length === 0) return cols;
  const movibles = cols.filter(c => c.movible !== false);
  const fijas = cols.filter(c => c.movible === false);
  const ordenadas: ColumnaTabla<T>[] = [];
  for (const id of orden) {
    const c = movibles.find(x => x.id === id);
    if (c) ordenadas.push(c);
  }
  // Agregar cualquier columna movible nueva no en `orden`
  for (const c of movibles) if (!orden.includes(c.id)) ordenadas.push(c);
  return [...ordenadas, ...fijas];
}

// ─── Header con sort + filter + resize + drag ─────────────────────────────

interface HeaderProps<T> {
  col: ColumnaTabla<T>;
  estado: TableState;
  onEstadoChange: Props<T>['onEstadoChange'];
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (id: string) => void;
  draggedId: string | null;
  hoverId: string | null;
}
function HeaderCelda<T>({
  col, estado, onEstadoChange,
  onDragStart, onDragOver, onDrop, draggedId, hoverId,
}: HeaderProps<T>) {
  const filtroActivo = estado.filtros?.[col.id];
  const [filtroAbierto, setFiltroAbierto] = React.useState(false);
  const filtroRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!filtroAbierto) return;
    const cerrar = (e: MouseEvent) => {
      if (filtroRef.current && !filtroRef.current.contains(e.target as Node)) {
        setFiltroAbierto(false);
      }
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [filtroAbierto]);

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const inicial = e.clientX;
    const anchoActual = estado.anchos?.[col.id] ?? col.width ?? 160;
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - inicial;
      const nuevo = Math.max(col.minWidth ?? 60, anchoActual + delta);
      onEstadoChange(p => ({ ...p, anchos: { ...(p.anchos ?? {}), [col.id]: nuevo } }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const ancho = estado.anchos?.[col.id] ?? col.width ?? 160;
  const arrastrable = col.movible !== false;
  const esArrastrada = draggedId === col.id;
  const esDropTarget = hoverId === col.id && draggedId !== col.id;

  return (
    <motion.th
      layout="position"
      layoutId={`th-${col.id}`}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      style={{ width: ancho, minWidth: col.minWidth ?? 60 }}
      className={cn(
        'relative px-2 py-2 xl:px-3 xl:py-2.5 text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))]/30 border-b border-[hsl(var(--border))] select-none',
        arrastrable && 'border-r border-[hsl(var(--border))]/60',
        col.align === 'right' && 'text-right',
        col.align === 'center' && 'text-center',
        esArrastrada && 'opacity-40 scale-95',
        esDropTarget && 'bg-[hsl(var(--brand-primary))]/15',
        col.colClassName,
      )}
      draggable={arrastrable}
      onDragStart={() => arrastrable && onDragStart(col.id)}
      onDragOver={e => arrastrable && onDragOver(e, col.id)}
      onDrop={() => arrastrable && onDrop(col.id)}
    >
      <div className={cn(
        'flex items-center gap-1 min-w-0',
        col.align === 'right' && 'justify-end',
        col.align === 'center' && 'justify-center',
      )}>
        {arrastrable && (
          <GripVertical className="size-3 shrink-0 opacity-0 group-hover:opacity-30 cursor-grab active:cursor-grabbing transition-opacity hover:!opacity-70" />
        )}
        <span
          className={cn(
            'truncate',
            col.align === 'left' || !col.align ? 'flex-1' : '',
          )}
          title={col.titulo}
        >
          {col.renderHeader ? col.renderHeader() : col.titulo}
        </span>
        {col.filter && (
          <div className="relative shrink-0" ref={filtroRef}>
            <button
              type="button"
              onClick={() => setFiltroAbierto(o => !o)}
              className={cn(
                'size-4 grid place-items-center rounded transition-colors',
                filtroActivo
                  ? 'text-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/15'
                  : 'text-[hsl(var(--text-muted))]/50 hover:text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))]',
              )}
              aria-label={`Filtrar ${col.titulo ?? col.id}`}
              title={`Filtrar ${col.titulo ?? col.id}`}
            >
              <Filter className={cn('size-2.5', filtroActivo && 'fill-current')} />
            </button>
            <AnimatePresence>
              {filtroAbierto && (
                <FiltroPopover
                  col={col}
                  estado={estado}
                  onEstadoChange={onEstadoChange}
                  cerrar={() => setFiltroAbierto(false)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      {arrastrable && (
        <div
          onMouseDown={startResize}
          aria-label={`Redimensionar columna ${col.titulo ?? col.id}`}
          className="group/resize absolute top-0 -right-[3px] h-full w-1.5 cursor-col-resize z-10"
        >
          <span className="absolute top-0 right-[3px] h-full w-px bg-[hsl(var(--border))]/70 group-hover/resize:right-[2px] group-hover/resize:w-[3px] group-hover/resize:bg-[hsl(var(--brand-primary))] group-active/resize:bg-[hsl(var(--brand-primary))] transition-all" />
        </div>
      )}
    </motion.th>
  );
}

function FiltroPopover<T>({
  col, estado, onEstadoChange, cerrar,
}: {
  col: ColumnaTabla<T>;
  estado: TableState;
  onEstadoChange: Props<T>['onEstadoChange'];
  cerrar: () => void;
}) {
  const filtro = estado.filtros?.[col.id];
  const actualizar = (nuevo: FiltroValor | undefined) => {
    onEstadoChange(p => {
      const filtros = { ...(p.filtros ?? {}) };
      if (nuevo === undefined) delete filtros[col.id];
      else filtros[col.id] = nuevo;
      return { ...p, filtros };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 2, scale: 0.97 }}
      transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
      className="absolute top-full right-0 mt-2 z-30 w-60 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-xl normal-case tracking-normal"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[hsl(var(--text))]">Filtrar por {col.titulo}</span>
        {filtro && (
          <button
            type="button"
            onClick={() => { actualizar(undefined); cerrar(); }}
            className="text-[10px] text-[hsl(var(--brand-danger))] hover:underline inline-flex items-center gap-0.5"
          >
            <X className="size-3" /> Limpiar
          </button>
        )}
      </div>
      {col.filter?.tipo === 'texto' && (
        <input
          autoFocus
          type="text"
          value={filtro?.tipo === 'texto' ? filtro.valor : ''}
          onChange={e => actualizar({ tipo: 'texto', valor: e.target.value })}
          placeholder="Contiene…"
          className="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-primary))]/15"
        />
      )}
      {col.filter?.tipo === 'rango' && (
        <div className="flex gap-2">
          <input
            type="number"
            value={filtro?.tipo === 'rango' && filtro.min !== undefined ? filtro.min : ''}
            onChange={e => {
              const v = e.target.value === '' ? undefined : Number(e.target.value);
              const actual = filtro?.tipo === 'rango' ? filtro : { tipo: 'rango' as const };
              actualizar({ ...actual, min: v });
            }}
            placeholder="Mín"
            className="w-full h-9 rounded-md border border-[hsl(var(--border))] px-2.5 text-xs"
          />
          <input
            type="number"
            value={filtro?.tipo === 'rango' && filtro.max !== undefined ? filtro.max : ''}
            onChange={e => {
              const v = e.target.value === '' ? undefined : Number(e.target.value);
              const actual = filtro?.tipo === 'rango' ? filtro : { tipo: 'rango' as const };
              actualizar({ ...actual, max: v });
            }}
            placeholder="Máx"
            className="w-full h-9 rounded-md border border-[hsl(var(--border))] px-2.5 text-xs"
          />
        </div>
      )}
      {col.filter?.tipo === 'select' && (
        <select
          autoFocus
          value={filtro?.tipo === 'select' ? filtro.valor : ''}
          onChange={e => {
            if (e.target.value === '') actualizar(undefined);
            else actualizar({ tipo: 'select', valor: e.target.value });
          }}
          className="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2.5 text-xs"
        >
          <option value="">Todos</option>
          {col.filter.opciones?.map(o => (
            <option key={o.valor} value={o.valor}>{o.label}</option>
          ))}
        </select>
      )}
    </motion.div>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────

export function DataTable<T>({
  columnas, filas, getRowKey, estado, onEstadoChange,
  rowClassName, renderRowAccent, vacioRender, cargando, cargandoFilas = 8,
  renderFilaExpandida, filaExpandidaKey, onToggleFilaExpandida,
}: Props<T>) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);

  const columnasOrdenadas = React.useMemo(
    () => aplicarOrdenColumnas(columnas, estado.orden),
    [columnas, estado.orden],
  );

  const filasProcesadas = React.useMemo(() => {
    const filtradas = aplicarFiltros(filas, columnas, estado.filtros);
    return aplicarSort(filtradas, columnas, estado.sort);
  }, [filas, columnas, estado.sort, estado.filtros]);

  const onDragStart = (id: string) => setDraggedId(id);
  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) setHoverId(id);
  };
  const onDrop = (idDestino: string) => {
    if (!draggedId || draggedId === idDestino) {
      setDraggedId(null); setHoverId(null); return;
    }
    const movibles = columnas.filter(c => c.movible !== false).map(c => c.id);
    const ordenActual = estado.orden && estado.orden.length === movibles.length
      ? estado.orden
      : movibles;
    const nuevo = [...ordenActual];
    const from = nuevo.indexOf(draggedId);
    const to = nuevo.indexOf(idDestino);
    if (from < 0 || to < 0) {
      setDraggedId(null); setHoverId(null); return;
    }
    nuevo.splice(from, 1);
    nuevo.splice(to, 0, draggedId);
    onEstadoChange(p => ({ ...p, orden: nuevo }));
    setDraggedId(null);
    setHoverId(null);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs xl:text-sm table-fixed" style={{ minWidth: '100%' }}>
        <thead className="group">
          <tr>
            {renderRowAccent && <th className="w-1 p-0" />}
            {columnasOrdenadas.map(col => (
              <HeaderCelda
                key={col.id}
                col={col}
                estado={estado}
                onEstadoChange={onEstadoChange}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                draggedId={draggedId}
                hoverId={hoverId}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            Array.from({ length: cargandoFilas }).map((_, i) => (
              <tr key={i} className="border-b border-[hsl(var(--border))]">
                {renderRowAccent && <td className="w-1 p-0" />}
                {columnasOrdenadas.map(c => (
                  <td key={c.id} className={cn('px-2 py-1.5 xl:px-3 xl:py-2.5', c.colClassName)}>
                    <div className="h-4 rounded bg-[hsl(var(--surface-2))] animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : filasProcesadas.length === 0 ? (
            <tr>
              <td
                colSpan={columnasOrdenadas.length + (renderRowAccent ? 1 : 0)}
                className="p-0"
              >
                {vacioRender ?? (
                  <div className="p-10 text-center text-sm text-[hsl(var(--text-muted))]">
                    Sin resultados.
                  </div>
                )}
              </td>
            </tr>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
<<<<<<< HEAD
              {filasProcesadas.map((fila, idx) => (
                <motion.tr
                  key={getRowKey(fila)}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(idx * 0.02, 0.16),
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className={cn(
                    'border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))]/30 transition-colors',
                    rowClassName?.(fila),
                  )}
                >
                  {renderRowAccent && <td className="p-0 w-1">{renderRowAccent(fila)}</td>}
                  {columnasOrdenadas.map(col => (
                    <motion.td
                      key={col.id}
                      layout="position"
                      layoutId={`td-${getRowKey(fila)}-${col.id}`}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className={cn(
                        'px-2 py-1.5 xl:px-3 xl:py-2.5 truncate',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.cellClassName,
                        col.colClassName,
                      )}
=======
              {filasProcesadas.flatMap((fila, idx) => {
                const key = getRowKey(fila);
                const expandida = renderFilaExpandida && filaExpandidaKey === key;
                const clickeable = !!renderFilaExpandida && !!onToggleFilaExpandida;
                const filaPrincipal = (
                  <motion.tr
                    key={key}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(idx * 0.02, 0.16),
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    data-testid="data-table-row"
                    data-row-key={key}
                    onClick={
                      clickeable
                        ? (e) => {
                            const target = e.target as HTMLElement;
                            // No expandir si el click vino de un control interactivo
                            if (target.closest('button, a, input, select, textarea, [role="button"]')) return;
                            onToggleFilaExpandida!(key);
                          }
                        : undefined
                    }
                    className={cn(
                      'border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-2))]/30 transition-colors',
                      clickeable && 'cursor-pointer',
                      expandida && 'bg-[hsl(var(--surface-2))]/40',
                      rowClassName?.(fila),
                    )}
                  >
                    {renderRowAccent && <td className="p-0 w-1">{renderRowAccent(fila)}</td>}
                    {columnasOrdenadas.map(col => (
                      <motion.td
                        key={col.id}
                        layout="position"
                        layoutId={`td-${key}-${col.id}`}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className={cn(
                          'px-3 py-2.5 truncate',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.cellClassName,
                        )}
                      >
                        {col.render(fila, idx)}
                      </motion.td>
                    ))}
                  </motion.tr>
                );

                if (!expandida) return [filaPrincipal];

                const filaPanel = (
                  <motion.tr
                    key={`${key}-expandida`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/20"
                  >
                    <td
                      colSpan={columnasOrdenadas.length + (renderRowAccent ? 1 : 0)}
                      className="p-0"
>>>>>>> 65ae9d4c94c89ae1d35f42faf90b8737aa47e1bc
                    >
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="p-4">{renderFilaExpandida!(fila)}</div>
                      </motion.div>
                    </td>
                  </motion.tr>
                );

                return [filaPrincipal, filaPanel];
              })}
            </AnimatePresence>
          )}
        </tbody>
      </table>
    </div>
  );
}
