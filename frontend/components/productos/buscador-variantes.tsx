'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, PackageCheck, PackageX, Boxes, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { obtenerPaginado } from '@/lib/api/client';
import { cn, formatearMoneda } from '@/lib/utils';
import { NuevaVarianteSheet, type VarianteCreada } from '@/components/productos/nueva-variante-sheet';

/**
 * Variante aplanada con su producto padre. Es el shape que consumen tanto el
 * POS como Compras: ambos buscan por producto y operan sobre la variante.
 */
export interface VarianteEncontrada {
  id: string;
  sku: string;
  talla: string;
  color: string;
  colorHex?: string | null;
  codigoBarras?: string | null;
  precioVenta?: string | null;
  stocks?: Array<{ sucursalId: string; disponible: number }>;
  producto: {
    id: string;
    nombre: string;
    sku: string;
    precioVenta: string;
    precioCompra?: string | null;
  };
}

/** Shape crudo que devuelve `GET /productos?buscar=`. */
interface ProductoApi {
  id: string;
  nombre: string;
  sku: string;
  precioVenta: string;
  precioCompra?: string | null;
  variantes: Array<{
    id: string;
    sku: string;
    talla: string;
    color: string;
    colorHex?: string | null;
    codigoBarras?: string | null;
    precioVenta?: string | null;
    stocks?: Array<{ sucursalId: string; disponible: number }>;
  }>;
}

type Contexto = 'venta' | 'compra';

interface BuscadorVariantesProps {
  /**
   * - `venta`: muestra precio de venta y stock; el stock agotado BLOQUEA la selección.
   * - `compra`: muestra costo y stock informativo; nunca bloquea (comprás para reponer).
   */
  contexto: Contexto;
  /** Texto del input (controlado por el padre: lo reusa para "Nuevo producto" y lo limpia al seleccionar). */
  value: string;
  onValueChange: (texto: string) => void;
  onSeleccionar: (variante: VarianteEncontrada) => void;
  /** En venta, sucursal contra la que se mide el stock disponible. */
  sucursalId?: string | null;
  /** IDs de variantes ya en el carrito/lista: se marcan como "agregado". */
  yaAgregados?: Set<string>;
  /**
   * Habilita la acción "+ Agregar talla/color" por producto en el dropdown:
   * crea una variante nueva en la BD y la agrega sin salir del flujo. Pensado
   * para Compras (reponés combinaciones que aún no existen). Off en POS.
   */
  permitirNuevaVariante?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Marca el input con `data-busqueda` para el atajo `/` del shell (solo POS). */
  registrarAtajo?: boolean;
  inputTestId?: string;
  /** Genera el data-testid de cada resultado (preserva contratos E2E existentes). */
  resultadoTestId?: (variante: VarianteEncontrada) => string;
  /** Acciones a la derecha del input (ej. botón "Escanear" del POS). */
  acciones?: React.ReactNode;
  className?: string;
  inputClassName?: string;
}

function stockEnSucursal(v: VarianteEncontrada, sucursalId?: string | null): number {
  if (!v.stocks) return 0;
  if (!sucursalId) return v.stocks.reduce((s, st) => s + st.disponible, 0);
  return v.stocks.find(s => s.sucursalId === sucursalId)?.disponible ?? 0;
}

function stockTotal(v: VarianteEncontrada): number {
  return (v.stocks ?? []).reduce((s, st) => s + st.disponible, 0);
}

export function BuscadorVariantes({
  contexto,
  value,
  onValueChange,
  onSeleccionar,
  sucursalId,
  yaAgregados,
  permitirNuevaVariante = false,
  placeholder = 'Buscar producto, SKU o código de barras…',
  autoFocus,
  registrarAtajo,
  inputTestId,
  resultadoTestId,
  acciones,
  className,
  inputClassName,
}: BuscadorVariantesProps) {
  const [debounced, setDebounced] = React.useState(value);
  const [enfocado, setEnfocado] = React.useState(false);
  const [activo, setActivo] = React.useState(0);
  const [nvProducto, setNvProducto] = React.useState<VarianteEncontrada['producto'] | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  const { data, isFetching } = useQuery({
    queryKey: ['buscar-variantes', debounced],
    enabled: debounced.trim().length >= 2,
    queryFn: () =>
      obtenerPaginado<ProductoApi>('/productos', { buscar: debounced, limite: 8 }),
  });

  // Aplanar productos → variantes. Cada fila del dropdown es una variante.
  const resultados = React.useMemo<VarianteEncontrada[]>(() => {
    const productos = data?.datos ?? [];
    return productos.flatMap(p =>
      (p.variantes ?? []).map(v => ({
        id: v.id,
        sku: v.sku,
        talla: v.talla,
        color: v.color,
        colorHex: v.colorHex,
        codigoBarras: v.codigoBarras,
        precioVenta: v.precioVenta,
        stocks: v.stocks,
        producto: {
          id: p.id,
          nombre: p.nombre,
          sku: p.sku,
          precioVenta: p.precioVenta,
          precioCompra: p.precioCompra ?? null,
        },
      })),
    );
  }, [data]);

  // Reiniciar el resaltado cuando cambian los resultados.
  React.useEffect(() => setActivo(0), [debounced]);

  const abierto = enfocado && debounced.trim().length >= 2;

  const esCompra = contexto === 'compra';

  const bloqueada = React.useCallback(
    (v: VarianteEncontrada) => !esCompra && stockEnSucursal(v, sucursalId) <= 0,
    [esCompra, sucursalId],
  );

  const seleccionar = (v: VarianteEncontrada) => {
    if (bloqueada(v)) return;
    onSeleccionar(v);
    onValueChange('');
  };

  // Productos distintos presentes en los resultados — sobre cada uno se puede
  // ofrecer "agregar variante".
  const productosEnResultados = React.useMemo(() => {
    const map = new Map<string, VarianteEncontrada['producto']>();
    for (const v of resultados) if (!map.has(v.producto.id)) map.set(v.producto.id, v.producto);
    return [...map.values()];
  }, [resultados]);

  const onVarianteCreada = (variante: VarianteCreada) => {
    if (!nvProducto) return;
    onSeleccionar({
      id: variante.id,
      sku: variante.sku,
      talla: variante.talla,
      color: variante.color,
      colorHex: variante.colorHex,
      codigoBarras: variante.codigoBarras,
      precioVenta: variante.precioVenta ?? null,
      stocks: variante.stocks?.map(s => ({ sucursalId: s.sucursalId, disponible: s.disponible })) ?? [],
      producto: nvProducto,
    });
    onValueChange('');
    setNvProducto(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!abierto || resultados.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo(i => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const v = resultados[activo];
      if (v) {
        e.preventDefault();
        seleccionar(v);
      }
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
          <Input
            {...(registrarAtajo ? { 'data-busqueda': true } : {})}
            data-testid={inputTestId}
            autoFocus={autoFocus}
            placeholder={placeholder}
            value={value}
            onChange={e => onValueChange(e.target.value)}
            onFocus={() => setEnfocado(true)}
            onBlur={() => setTimeout(() => setEnfocado(false), 150)}
            onKeyDown={onKeyDown}
            className={cn('pl-9', inputClassName)}
          />
        </div>
        {acciones}
      </div>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-xl"
          >
            {resultados.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[hsl(var(--text-muted))]">
                {isFetching ? 'Buscando…' : 'Sin coincidencias.'}
              </p>
            ) : (
              <>
              <ul className="max-h-[22rem] overflow-auto py-1 scrollbar-thin">
                {resultados.map((v, i) => {
                  const stock = esCompra
                    ? stockTotal(v)
                    : stockEnSucursal(v, sucursalId);
                  const sinStock = !esCompra && stock <= 0;
                  const precio = esCompra
                    ? v.producto.precioCompra
                    : v.precioVenta ?? v.producto.precioVenta;
                  const yaEsta = yaAgregados?.has(v.id) ?? false;
                  const resaltado = i === activo;

                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        data-testid={resultadoTestId?.(v)}
                        disabled={sinStock}
                        onMouseEnter={() => setActivo(i)}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => seleccionar(v)}
                        className={cn(
                          'grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors',
                          sinStock
                            ? 'opacity-45 cursor-not-allowed'
                            : 'cursor-pointer',
                          resaltado && !sinStock && 'bg-[hsl(var(--surface-2))]',
                        )}
                      >
                        {/* Swatch del color de la variante */}
                        <span
                          className="size-9 shrink-0 rounded-lg border border-[hsl(var(--border))]"
                          style={{ backgroundColor: v.colorHex ?? 'hsl(var(--surface-2))' }}
                          aria-hidden
                        />

                        {/* Nombre + meta (talla · color · SKU) */}
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {v.producto.nombre}
                            </span>
                            {yaEsta && (
                              <span className="shrink-0 rounded-full bg-[hsl(var(--brand-primary))]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--brand-primary))]">
                                agregado
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[hsl(var(--text-muted))]">
                            <span className="font-medium text-[hsl(var(--text))]/80">
                              {v.talla}
                            </span>
                            <span>· {v.color} ·</span>
                            <span className="font-mono">{v.sku}</span>
                          </span>
                        </span>

                        {/* Precio + pill de stock */}
                        <span className="flex flex-col items-end gap-1 text-right">
                          <span className="text-sm font-semibold tabular-nums">
                            {precio != null && Number(precio) > 0
                              ? formatearMoneda(precio)
                              : <span className="text-xs font-normal text-[hsl(var(--text-muted))]">sin costo</span>}
                          </span>
                          <PillStock contexto={contexto} stock={stock} sinStock={sinStock} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {permitirNuevaVariante && productosEnResultados.length > 0 && (
                <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/30">
                  {productosEnResultados.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`btn-nueva-variante-${p.id}`}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setEnfocado(false); setNvProducto(p); }}
                      className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-xs font-medium text-[hsl(var(--brand-primary))] transition-colors hover:bg-[hsl(var(--surface-2))]"
                    >
                      <Plus className="size-3.5 shrink-0" />
                      <span className="truncate">
                        ¿No está la talla/color? Agregar a <span className="font-semibold">{p.nombre}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <NuevaVarianteSheet
        open={nvProducto !== null}
        onOpenChange={abierto => { if (!abierto) setNvProducto(null); }}
        producto={nvProducto}
        onCreada={onVarianteCreada}
      />
    </div>
  );
}

function PillStock({
  contexto,
  stock,
  sinStock,
}: {
  contexto: Contexto;
  stock: number;
  sinStock: boolean;
}) {
  if (contexto === 'compra') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--text-muted))]">
        <Boxes className="size-3" />
        {stock} en stock
      </span>
    );
  }
  if (sinStock) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--brand-danger))]/12 px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--brand-danger))]">
        <PackageX className="size-3" />
        sin stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(140_60%_45%/0.14)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(140_60%_45%)]">
      <PackageCheck className="size-3" />
      {stock} disp.
    </span>
  );
}
