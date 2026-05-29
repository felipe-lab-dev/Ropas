'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Pencil, History, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { obtener } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';
import { colorCategoria } from '@/lib/color-categoria';
import { PanelInsightsProducto } from './panel-insights-producto';

interface VarianteDetalle {
  id: string;
  sku: string;
  talla: string;
  color: string;
  colorHex?: string | null;
  stocks: Array<{ disponible: number; sucursal: { nombre: string } }>;
}

interface ProductoDetalle {
  id: string;
  nombre: string;
  sku: string;
  codigo?: string | null;
  descripcion?: string | null;
  precioVenta: string;
  precioCompra?: string | null;
  activo: boolean;
  imagenes: string[];
  categoria: { id: string; nombre: string; slug?: string };
  marca?: { nombre: string } | null;
  variantes: VarianteDetalle[];
}

interface ProductoDetalleProps {
  productoId: string;
  onEditar: (id: string) => void;
  onKardex: (id: string) => void;
}

export function ProductoDetalle({ productoId, onEditar, onKardex }: ProductoDetalleProps) {
  const { data: p, isLoading, isError } = useQuery({
    queryKey: ['producto', productoId],
    queryFn: () => obtener<ProductoDetalle>(`/productos/${productoId}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="size-6 animate-spin text-[hsl(var(--brand-primary))]" />
      </div>
    );
  }
  if (isError || !p) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="size-10 mx-auto text-[hsl(var(--brand-warning))] mb-3" />
        <p className="font-medium">No se pudo cargar el producto</p>
      </div>
    );
  }

  const cat = colorCategoria(p.categoria.slug ?? p.categoria.nombre);
  const stockTotal = p.variantes.reduce(
    (acc, v) => acc + v.stocks.reduce((s, st) => s + st.disponible, 0),
    0,
  );

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Hero */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold tracking-tight">{p.nombre}</h2>
        {p.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border"
          style={{ background: cat.suave, color: cat.base, borderColor: `${cat.base}40` }}
        >
          <span className="size-1.5 rounded-full" style={{ background: cat.base }} />
          {p.categoria.nombre}
        </span>
        <span className="text-xs text-[hsl(var(--text-muted))] w-full font-mono">
          SKU {p.sku}
          {p.codigo && <span> · cód. {p.codigo}</span>}
          {p.marca && <span className="font-sans"> · {p.marca.nombre}</span>}
        </span>
      </div>

      {/* Precio / stock */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Precio de venta</p>
          <p className="text-xl font-black tracking-tight tabular-nums mt-1">{formatearMoneda(p.precioVenta)}</p>
          {p.precioCompra != null && (
            <p className="text-[11px] text-[hsl(var(--text-muted))] mt-0.5">
              Costo {formatearMoneda(p.precioCompra)}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Stock total</p>
          <p className={`text-xl font-black tracking-tight tabular-nums mt-1 ${stockTotal === 0 ? 'text-[hsl(var(--brand-danger))]' : ''}`}>
            {stockTotal}
          </p>
          <p className="text-[11px] text-[hsl(var(--text-muted))] mt-0.5">
            {p.variantes.length} variante{p.variantes.length === 1 ? '' : 's'}
          </p>
        </Card>
      </div>

      {/* Fotos + insights (reutiliza el panel existente) */}
      <PanelInsightsProducto productoId={p.id} imagenes={p.imagenes} nombre={p.nombre} />

      {/* Variantes y stock */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <Boxes className="size-4" />
          <h3 className="font-semibold text-sm">Variantes y stock</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variante</TableHead>
              <TableHead className="hidden sm:table-cell">SKU</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.variantes.map(v => {
              const stock = v.stocks.reduce((s, st) => s + st.disponible, 0);
              return (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-4 rounded-full border border-[hsl(var(--border))] shrink-0"
                        style={{ backgroundColor: v.colorHex ?? 'hsl(var(--surface-2))' }}
                        title={v.color}
                      />
                      <span className="text-sm font-medium">{v.talla} · {v.color}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-mono text-[11px] text-[hsl(var(--text-muted))]">
                    {v.sku}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`tabular-nums ${stock === 0 ? 'text-[hsl(var(--brand-danger))] font-semibold' : 'font-medium'}`}>
                      {stock}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {p.descripcion && (
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-2">Descripción</p>
          <p className="text-sm whitespace-pre-line">{p.descripcion}</p>
        </Card>
      )}

      {/* Barra de acciones fija al pie del drawer */}
      <div
        className="no-print sticky bottom-0 -mx-4 sm:-mx-5 -mb-5 mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface))]/95 px-4 sm:px-5 py-3 backdrop-blur"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Button variant="outline" size="sm" onClick={() => onKardex(p.id)}>
          <History className="size-4" /> Kardex
        </Button>
        <Button variant="outline" size="sm" onClick={() => onEditar(p.id)}>
          <Pencil className="size-4" /> Editar
        </Button>
      </div>
    </div>
  );
}
