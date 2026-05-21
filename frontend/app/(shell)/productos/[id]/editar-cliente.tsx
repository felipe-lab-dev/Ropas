'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { obtener, actualizar, eliminar, mensajeError } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';

interface Categoria { id: string; nombre: string }
interface Variante {
  id: string;
  sku: string;
  talla: string;
  color: string;
  colorHex: string | null;
  precioVenta: string | null;
  stocks: Array<{ sucursalId: string; disponible: number; sucursal?: { nombre: string } }>;
}
interface ProductoDetalle {
  id: string;
  sku: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  categoriaId: string;
  genero: string;
  temporada: string;
  material: string | null;
  cuidado: string | null;
  precioVenta: string;
  precioCompra: string | null;
  activo: boolean;
  variantes: Variante[];
}

export function EditarProductoCliente() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();

  const { data: producto, isLoading } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => obtener<ProductoDetalle>(`/productos/${id}`),
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => obtener<Categoria[]>('/categorias'),
  });

  const [form, setForm] = React.useState<Partial<ProductoDetalle>>({});
  const [confirmarEliminar, setConfirmarEliminar] = React.useState(false);

  React.useEffect(() => {
    if (producto) {
      setForm({
        codigo: producto.codigo ?? '',
        nombre: producto.nombre,
        descripcion: producto.descripcion ?? '',
        categoriaId: producto.categoriaId,
        genero: producto.genero,
        temporada: producto.temporada,
        material: producto.material ?? '',
        cuidado: producto.cuidado ?? '',
        precioVenta: producto.precioVenta,
        precioCompra: producto.precioCompra ?? '',
        activo: producto.activo,
      });
    }
  }, [producto]);

  const guardar = useMutation({
    mutationFn: () =>
      actualizar(`/productos/${id}`, {
        codigo: form.codigo?.toString().trim() || null,
        nombre: form.nombre,
        descripcion: form.descripcion?.toString().trim() || null,
        categoriaId: form.categoriaId,
        genero: form.genero,
        temporada: form.temporada,
        material: form.material?.toString().trim() || null,
        cuidado: form.cuidado?.toString().trim() || null,
        precioVenta: Number(form.precioVenta),
        precioCompra: form.precioCompra ? Number(form.precioCompra) : null,
        activo: form.activo,
      }),
    onSuccess: () => {
      toast.success('Producto actualizado');
      void qc.invalidateQueries({ queryKey: ['productos'] });
      void qc.invalidateQueries({ queryKey: ['producto', id] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const borrar = useMutation({
    mutationFn: () => eliminar(`/productos/${id}`),
    onSuccess: () => {
      toast.success('Producto eliminado');
      void qc.invalidateQueries({ queryKey: ['productos'] });
      router.push('/productos');
    },
    onError: e => toast.error(mensajeError(e)),
  });

  if (isLoading || !producto) {
    return <p className="text-sm text-[hsl(var(--text-muted))]">Cargando…</p>;
  }

  const stockTotal = producto.variantes.reduce(
    (acc, v) => acc + v.stocks.reduce((s, st) => s + st.disponible, 0),
    0,
  );

  return (
    <form
      onSubmit={e => { e.preventDefault(); guardar.mutate(); }}
      className="space-y-6 max-w-5xl"
    >
      <PageHeader
        titulo={producto.nombre}
        descripcion={
          producto.codigo
            ? `Código ${producto.codigo} · SKU ${producto.sku}`
            : `SKU ${producto.sku}`
        }
        acciones={
          <>
            <Button asChild variant="ghost" type="button">
              <Link href="/productos"><ArrowLeft className="size-4" /> Volver</Link>
            </Button>
            <Button asChild variant="outline" type="button">
              <Link href={`/productos/${id}/kardex`}><History className="size-4" /> Kardex</Link>
            </Button>
            <Button type="submit" size="lg" disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </>
        }
      />

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              value={form.codigo ?? ''}
              onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
            />
          </div>
          <div className="md:col-span-6 space-y-1.5">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={form.nombre ?? ''}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <Select
              id="categoria"
              value={form.categoriaId ?? ''}
              onChange={e => setForm(f => ({ ...f, categoriaId: e.target.value }))}
            >
              {categorias?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="precioVenta">Precio venta (S/)</Label>
            <Input
              id="precioVenta"
              type="number"
              step="0.01"
              min="0"
              value={form.precioVenta?.toString() ?? ''}
              onChange={e => setForm(f => ({ ...f, precioVenta: e.target.value }))}
            />
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="precioCompra">Costo (S/)</Label>
            <Input
              id="precioCompra"
              type="number"
              step="0.01"
              min="0"
              value={form.precioCompra?.toString() ?? ''}
              onChange={e => setForm(f => ({ ...f, precioCompra: e.target.value }))}
            />
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="genero">Género</Label>
            <Select
              id="genero"
              value={form.genero ?? 'unisex'}
              onChange={e => setForm(f => ({ ...f, genero: e.target.value }))}
            >
              <option value="mujer">Mujer</option>
              <option value="hombre">Hombre</option>
              <option value="unisex">Unisex</option>
              <option value="ninia">Niña</option>
              <option value="ninio">Niño</option>
            </Select>
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="material">Material</Label>
            <Input
              id="material"
              value={form.material?.toString() ?? ''}
              onChange={e => setForm(f => ({ ...f, material: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="descripcion">Descripción</Label>
          <Textarea
            id="descripcion"
            value={form.descripcion?.toString() ?? ''}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
            rows={3}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.activo ?? true}
              onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              className="size-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--brand-primary))]"
            />
            Activo (visible en POS y catálogo)
          </label>
        </div>
      </Card>

      {/* Variantes - solo lectura por ahora */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
            Variantes ({producto.variantes.length})
          </h2>
          <Badge variant="outline">Stock total: {stockTotal}</Badge>
        </div>
        <div className="border border-[hsl(var(--border))] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[hsl(var(--surface-2))]/40">
              <tr>
                <th className="text-left p-2 font-semibold">Variante</th>
                <th className="text-left p-2 font-semibold">SKU</th>
                <th className="text-right p-2 font-semibold">Stock</th>
                <th className="text-right p-2 font-semibold">Precio</th>
              </tr>
            </thead>
            <tbody>
              {producto.variantes.map(v => {
                const stock = v.stocks.reduce((s, st) => s + st.disponible, 0);
                return (
                  <tr key={v.id} className="border-t border-[hsl(var(--border))]">
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-4 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: v.colorHex ?? '#CCC' }}
                        />
                        <span className="font-medium">{v.talla}</span>
                        <span className="text-[hsl(var(--text-muted))]">· {v.color}</span>
                      </div>
                    </td>
                    <td className="p-2 font-mono text-[10px] text-[hsl(var(--text-muted))]">{v.sku}</td>
                    <td className={`p-2 text-right tabular-nums ${stock === 0 ? 'text-[hsl(var(--brand-danger))] font-semibold' : ''}`}>{stock}</td>
                    <td className="p-2 text-right tabular-nums">
                      {v.precioVenta ? formatearMoneda(v.precioVenta) : formatearMoneda(producto.precioVenta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[hsl(var(--text-muted))]">
          Para ajustar stock o agregar variantes, usa el módulo Inventario.
        </p>
      </Card>

      {/* Zona peligrosa */}
      <Card className="p-6 border-[hsl(var(--brand-danger))]/30 bg-[hsl(var(--brand-danger))]/5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--brand-danger))]">Eliminar producto</h2>
          <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
            Soft-delete. El producto deja de aparecer en POS y catálogo, pero el historial se conserva.
          </p>
        </div>
        {!confirmarEliminar ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmarEliminar(true)}
            className="border-[hsl(var(--brand-danger))]/40 text-[hsl(var(--brand-danger))] hover:bg-[hsl(var(--brand-danger))]/10"
          >
            <Trash2 className="size-4" /> Eliminar producto
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmarEliminar(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => borrar.mutate()}
              disabled={borrar.isPending}
              className="bg-[hsl(var(--brand-danger))] hover:bg-[hsl(var(--brand-danger))]/90"
            >
              <Trash2 className="size-4" />
              {borrar.isPending ? 'Eliminando…' : 'Sí, eliminar definitivamente'}
            </Button>
          </div>
        )}
      </Card>
    </form>
  );
}
