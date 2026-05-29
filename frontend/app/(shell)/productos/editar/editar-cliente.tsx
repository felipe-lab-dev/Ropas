'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, History, Trash2, Plus, Check, X, Edit2, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { FormField } from '@/components/ui/form-field';
import { FormActions } from '@/components/ui/form-actions';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SelectIconos, type OpcionIcono } from '@/components/ui/select-iconos';
import { ComboboxCreable } from '@/components/ui/combobox-creable';
import { IconoCategoria } from '@/components/ui/icono-categoria';
import { colorCategoria } from '@/lib/color-categoria';
import { GENEROS, MATERIALES, ICONO_MATERIAL_FALLBACK } from '@/lib/catalogos-producto';
import { obtener, postear, actualizar, eliminar, subirArchivos, mensajeError } from '@/lib/api/client';
import { formatearMoneda, cn } from '@/lib/utils';
import { useValidacionForm } from '@/lib/use-validacion-form';
import {
  useUnidadesMedida,
  useTiposAfectacionIgv,
} from '@/lib/api/hooks/use-catalogos-sunat';

interface Categoria { id: string; nombre: string }
interface Variante {
  id: string;
  sku: string;
  talla: string;
  color: string;
  colorHex: string | null;
  codigoBarras: string | null;
  precioVenta: string | null;
  activo: boolean;
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
  imagenes: string[];
  variantes: Variante[];
  unidadMedidaCodigo: string;
  tipoAfectacionIgv: string;
}

type TabId = 'general' | 'imagenes' | 'variantes' | 'sunat';

interface FormStateValidacion {
  nombre: string;
  categoriaId: string;
  precioVenta: string;
}

export function EditarProductoCliente({
  idForzado,
  modoModal = false,
  onCerrar,
}: { idForzado?: string; modoModal?: boolean; onCerrar?: () => void } = {}) {
  const router = useRouter();
  const search = useSearchParams();
  const id = idForzado ?? search.get('id') ?? '';
  const qc = useQueryClient();

  const [tab, setTab] = React.useState<TabId>('general');
  const [confirmAbierto, setConfirmAbierto] = React.useState(false);

  const { data: producto, isLoading } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => obtener<ProductoDetalle>(`/productos/${id}`),
    enabled: !!id,
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => obtener<Categoria[]>('/categorias'),
  });

  const { data: unidades } = useUnidadesMedida();
  const { data: tiposAfectacion } = useTiposAfectacionIgv();

  const [form, setForm] = React.useState<Partial<ProductoDetalle>>({});
  const [agregandoVariante, setAgregandoVariante] = React.useState(false);
  const [varianteEditandoId, setVarianteEditandoId] = React.useState<string | null>(null);
  const [confirmandoBorrarVarId, setConfirmandoBorrarVarId] = React.useState<string | null>(null);

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
        unidadMedidaCodigo: producto.unidadMedidaCodigo ?? 'NIU',
        tipoAfectacionIgv: producto.tipoAfectacionIgv ?? 'gravado_onerosa',
      });
    }
  }, [producto]);

  const opcionesCategoria = React.useMemo<OpcionIcono[]>(
    () => (categorias ?? []).map((c) => ({
      valor: c.id,
      label: c.nombre,
      color: colorCategoria(c.nombre).base,
      icono: <IconoCategoria nombre={c.nombre} className="size-full" />,
    })),
    [categorias],
  );

  const validacion = useValidacionForm<FormStateValidacion>({
    reglas: [
      { id: 'nombre', label: 'Nombre', tabId: 'general',
        validar: d => d.nombre.trim() ? null : 'Ingresá un nombre',
        selectorFoco: '#nombre' },
      { id: 'categoriaId', label: 'Categoría', tabId: 'general',
        validar: d => d.categoriaId ? null : 'Seleccioná una categoría',
        selectorFoco: '#categoria' },
      { id: 'precioVenta', label: 'Precio de venta', tabId: 'general',
        validar: d => d.precioVenta && Number(d.precioVenta) > 0 ? null : 'Precio mayor a 0',
        selectorFoco: '#precioVenta' },
    ],
    onAbrirTab: (t) => setTab(t as TabId),
  });

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
        unidadMedidaCodigo: form.unidadMedidaCodigo,
        tipoAfectacionIgv: form.tipoAfectacionIgv,
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
      setConfirmAbierto(false);
      if (modoModal) onCerrar?.();
      else router.push('/productos');
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const subirImagenes = useMutation({
    mutationFn: (archivos: File[]) =>
      subirArchivos<{ imagenes: string[] }>(`/productos/${id}/imagenes`, archivos),
    onSuccess: () => {
      toast.success('Imágenes subidas');
      void qc.invalidateQueries({ queryKey: ['producto', id] });
      void qc.invalidateQueries({ queryKey: ['productos'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const eliminarImagen = useMutation({
    mutationFn: (url: string) =>
      eliminar<{ imagenes: string[] }>(`/productos/${id}/imagenes`, { params: { url } }),
    onSuccess: () => {
      toast.success('Imagen eliminada');
      void qc.invalidateQueries({ queryKey: ['producto', id] });
      void qc.invalidateQueries({ queryKey: ['productos'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const onArchivosSeleccionados = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) subirImagenes.mutate(files);
    e.target.value = '';
  };

  function onGuardar() {
    const r = validacion.validar({
      nombre: (form.nombre ?? '').toString(),
      categoriaId: (form.categoriaId ?? '').toString(),
      precioVenta: (form.precioVenta ?? '').toString(),
    });
    if (!r.valido) return;
    guardar.mutate();
  }

  if (!id) {
    return (
      <div className="p-8 space-y-2">
        <p className="text-sm text-[hsl(var(--brand-danger))]">Falta el parámetro id en la URL.</p>
        <Link href="/productos" className="text-sm underline">Volver a productos</Link>
      </div>
    );
  }

  if (isLoading || !producto) {
    return <p className="text-sm text-[hsl(var(--text-muted))]">Cargando…</p>;
  }

  const stockTotal = producto.variantes.reduce(
    (acc, v) => acc + v.stocks.reduce((s, st) => s + st.disponible, 0),
    0,
  );

  const erroresGeneral = ['nombre', 'categoriaId', 'precioVenta'].some(k => validacion.errores[k]);

  return (
    <div className={cn('space-y-6', !modoModal && 'max-w-5xl')}>
      {!modoModal && (
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
                <Link href={`/productos/kardex/?id=${id}`}><History className="size-4" /> Kardex</Link>
              </Button>
            </>
          }
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList>
          <TabsTrigger value="general" data-testid="tab-general" errorBadge={erroresGeneral}>
            General
          </TabsTrigger>
          <TabsTrigger value="imagenes" data-testid="tab-imagenes">
            Imágenes ({producto.imagenes?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="variantes" data-testid="tab-variantes">
            Variantes ({producto.variantes.length})
          </TabsTrigger>
          <TabsTrigger value="sunat" data-testid="tab-sunat">
            SUNAT
          </TabsTrigger>
        </TabsList>

        {/* ── General ─────────────────────────────────────────────────────── */}
        <TabsContent value="general">
          <Card className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <FormField label="Código" htmlFor="codigo" className="md:col-span-3">
                <Input id="codigo" value={form.codigo ?? ''}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
              </FormField>

              <FormField label="Nombre" htmlFor="nombre" requerido
                error={validacion.errores.nombre} className="md:col-span-6">
                <Input id="nombre" value={form.nombre ?? ''}
                  onChange={e => { setForm(f => ({ ...f, nombre: e.target.value })); validacion.limpiarError('nombre'); }} />
              </FormField>

              <FormField label="Categoría" htmlFor="categoria" requerido
                error={validacion.errores.categoriaId} className="md:col-span-3">
                <SelectIconos
                  id="categoria"
                  data-testid="select-categoria"
                  value={form.categoriaId ?? ''}
                  onValueChange={v => { setForm(f => ({ ...f, categoriaId: v })); validacion.limpiarError('categoriaId'); }}
                  opciones={opcionesCategoria}
                  placeholder="Seleccioná…"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <FormField label="Precio venta (S/)" htmlFor="precioVenta" requerido
                error={validacion.errores.precioVenta} className="md:col-span-3">
                <Input id="precioVenta" type="number" step="0.01" min="0"
                  value={form.precioVenta?.toString() ?? ''}
                  onChange={e => { setForm(f => ({ ...f, precioVenta: e.target.value })); validacion.limpiarError('precioVenta'); }} />
              </FormField>

              <FormField label="Costo (S/)" htmlFor="precioCompra" className="md:col-span-3">
                <Input id="precioCompra" type="number" step="0.01" min="0"
                  value={form.precioCompra?.toString() ?? ''}
                  onChange={e => setForm(f => ({ ...f, precioCompra: e.target.value }))} />
              </FormField>

              <FormField label="Género" htmlFor="genero" className="md:col-span-3">
                <SelectIconos
                  id="genero"
                  data-testid="select-genero"
                  value={form.genero ?? 'unisex'}
                  onValueChange={v => setForm(f => ({ ...f, genero: v }))}
                  opciones={GENEROS}
                />
              </FormField>

              <FormField label="Material" htmlFor="material" className="md:col-span-3">
                <ComboboxCreable
                  id="material"
                  data-testid="combobox-material"
                  value={form.material?.toString() ?? ''}
                  onChange={v => setForm(f => ({ ...f, material: v }))}
                  opciones={MATERIALES}
                  iconoFallback={ICONO_MATERIAL_FALLBACK}
                  placeholder="Seleccioná o escribí…"
                  placeholderBuscar="Buscar o escribir material…"
                />
              </FormField>
            </div>

            <FormField label="Descripción" htmlFor="descripcion">
              <Textarea id="descripcion" value={form.descripcion?.toString() ?? ''}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} />
            </FormField>

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
        </TabsContent>

        {/* ── Imágenes ───────────────────────────────────────────────────── */}
        <TabsContent value="imagenes">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
                  Imágenes ({producto.imagenes?.length ?? 0})
                </h2>
                <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                  JPG, PNG, WEBP o GIF — hasta 10 MB cada una. La primera se usa como portada.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={subirImagenes.isPending}
              >
                {subirImagenes.isPending ? (
                  <><Loader2 className="size-4 animate-spin" /> Subiendo…</>
                ) : (
                  <><ImagePlus className="size-4" /> Agregar imágenes</>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={onArchivosSeleccionados}
                className="hidden"
              />
            </div>

            {producto.imagenes && producto.imagenes.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {producto.imagenes.map((url, i) => (
                  <div
                    key={url}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Imagen ${i + 1}`} className="size-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-[hsl(var(--brand-primary))] text-white">
                        Portada
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => eliminarImagen.mutate(url)}
                      disabled={eliminarImagen.isPending}
                      className="absolute top-1.5 right-1.5 size-7 grid place-items-center rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-[hsl(var(--brand-danger))] transition-all"
                      title="Eliminar imagen"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-10 border-2 border-dashed border-[hsl(var(--border))] rounded-lg flex flex-col items-center justify-center gap-2 text-[hsl(var(--text-muted))] hover:border-[hsl(var(--brand-primary))]/40 hover:bg-[hsl(var(--brand-primary))]/5 transition-colors"
              >
                <ImagePlus className="size-8 opacity-50" />
                <span className="text-sm font-medium">Sin imágenes — clic para agregar</span>
              </button>
            )}
          </Card>
        </TabsContent>

        {/* ── Variantes ──────────────────────────────────────────────────── */}
        <TabsContent value="variantes">
          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
                  Variantes ({producto.variantes.length})
                </h2>
                <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                  Stock total: <span className="font-semibold">{stockTotal}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAgregandoVariante(true)}
                disabled={agregandoVariante}
              >
                <Plus className="size-3.5" /> Agregar variante
              </Button>
            </div>

            <div className="border border-[hsl(var(--border))] rounded-lg overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="bg-[hsl(var(--surface-2))]/40">
                  <tr>
                    <th className="text-left p-2 font-semibold">Variante</th>
                    <th className="text-left p-2 font-semibold">SKU</th>
                    <th className="text-left p-2 font-semibold">Código barras</th>
                    <th className="text-right p-2 font-semibold">Stock</th>
                    <th className="text-right p-2 font-semibold">Precio</th>
                    <th className="p-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {agregandoVariante && (
                    <FilaAgregarVariante
                      productoId={id}
                      precioBase={producto.precioVenta}
                      onCancel={() => setAgregandoVariante(false)}
                      onSaved={() => {
                        setAgregandoVariante(false);
                        void qc.invalidateQueries({ queryKey: ['producto', id] });
                        void qc.invalidateQueries({ queryKey: ['productos'] });
                      }}
                    />
                  )}
                  {producto.variantes.map(v =>
                    varianteEditandoId === v.id ? (
                      <FilaEditarVariante
                        key={v.id}
                        productoId={id}
                        variante={v}
                        precioBase={producto.precioVenta}
                        onCancel={() => setVarianteEditandoId(null)}
                        onSaved={() => {
                          setVarianteEditandoId(null);
                          void qc.invalidateQueries({ queryKey: ['producto', id] });
                          void qc.invalidateQueries({ queryKey: ['productos'] });
                        }}
                      />
                    ) : (
                      <FilaVariante
                        key={v.id}
                        productoId={id}
                        variante={v}
                        precioBase={producto.precioVenta}
                        onEditar={() => setVarianteEditandoId(v.id)}
                        confirmando={confirmandoBorrarVarId === v.id}
                        onPedirConfirmacion={() => setConfirmandoBorrarVarId(v.id)}
                        onCancelarConfirmacion={() => setConfirmandoBorrarVarId(null)}
                        onBorrado={() => {
                          setConfirmandoBorrarVarId(null);
                          void qc.invalidateQueries({ queryKey: ['producto', id] });
                          void qc.invalidateQueries({ queryKey: ['productos'] });
                        }}
                      />
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-[hsl(var(--text-muted))]">
              El stock se ajusta desde Inventario. Para eliminar una variante con stock, primero ajustá a 0.
            </p>
          </Card>
        </TabsContent>

        {/* ── SUNAT ──────────────────────────────────────────────────────── */}
        <TabsContent value="sunat">
          <Card className="p-6 space-y-5" data-testid="seccion-sunat">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
                Configuración SUNAT
              </h2>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                Unidad de medida e IGV para facturación electrónica.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Unidad de medida (SUNAT Cat. 03)" htmlFor="unidadMedida"
                hint="Cómo se contabiliza la cantidad en la factura. Default: NIU (unidad).">
                <Select id="unidadMedida" value={form.unidadMedidaCodigo ?? 'NIU'}
                  onChange={e => setForm(f => ({ ...f, unidadMedidaCodigo: e.target.value }))}
                  data-testid="select-unidad-medida">
                  {unidades?.map(u => (
                    <option key={u.codigo} value={u.codigo}>{u.codigo} — {u.nombre}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Tipo de afectación IGV (SUNAT Cat. 07)" htmlFor="tipoAfectacion"
                hint="Define si el producto está gravado, exonerado o inafecto al IGV.">
                <Select id="tipoAfectacion" value={form.tipoAfectacionIgv ?? 'gravado_onerosa'}
                  onChange={e => setForm(f => ({ ...f, tipoAfectacionIgv: e.target.value }))}
                  data-testid="select-tipo-afectacion">
                  {tiposAfectacion?.map(t => (
                    <option key={t.codigo} value={t.codigo}>{t.sunatCodigo} — {t.nombre}</option>
                  ))}
                </Select>
              </FormField>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <FormActions
        onGuardar={onGuardar}
        guardando={guardar.isPending}
        onEliminar={() => setConfirmAbierto(true)}
        eliminando={borrar.isPending}
        textoEliminar="Eliminar producto"
        onCancelar={modoModal ? onCerrar : () => router.push('/productos')}
        variante="sticky"
      />

      <DeleteConfirmDialog
        abierto={confirmAbierto}
        onAbiertoChange={setConfirmAbierto}
        titulo="Eliminar producto"
        nombreItem={producto.nombre}
        descripcion={
          <>
            Soft-delete. El producto y sus variantes dejan de aparecer en POS y catálogo,
            pero el historial se conserva. Se eliminará <strong>{producto.nombre}</strong>.
          </>
        }
        onConfirmar={() => borrar.mutate()}
        eliminando={borrar.isPending}
      />
    </div>
  );
}

function FilaVariante({
  productoId,
  variante,
  precioBase,
  onEditar,
  confirmando,
  onPedirConfirmacion,
  onCancelarConfirmacion,
  onBorrado,
}: {
  productoId: string;
  variante: Variante;
  precioBase: string;
  onEditar: () => void;
  confirmando: boolean;
  onPedirConfirmacion: () => void;
  onCancelarConfirmacion: () => void;
  onBorrado: () => void;
}) {
  const stock = variante.stocks.reduce((s, st) => s + st.disponible, 0);
  const borrar = useMutation({
    mutationFn: () => eliminar(`/productos/${productoId}/variantes/${variante.id}`),
    onSuccess: () => {
      toast.success('Variante eliminada');
      onBorrado();
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <tr className={cn('border-t border-[hsl(var(--border))]', !variante.activo && 'opacity-60')}>
      <td className="p-2">
        <div className="flex items-center gap-1.5">
          <span
            className="size-4 rounded-full border border-black/10 shrink-0"
            style={{ backgroundColor: variante.colorHex ?? '#CCC' }}
          />
          <span className="font-medium">{variante.talla}</span>
          <span className="text-[hsl(var(--text-muted))]">· {variante.color}</span>
          {!variante.activo && <Badge variant="outline" className="ml-1 text-[9px]">Inactiva</Badge>}
        </div>
      </td>
      <td className="p-2 font-mono text-[10px] text-[hsl(var(--text-muted))]">{variante.sku}</td>
      <td className="p-2 font-mono text-[10px] text-[hsl(var(--text-muted))]">{variante.codigoBarras ?? '—'}</td>
      <td className={cn('p-2 text-right tabular-nums', stock === 0 && 'text-[hsl(var(--brand-danger))] font-semibold')}>
        {stock}
      </td>
      <td className="p-2 text-right tabular-nums">
        {variante.precioVenta ? formatearMoneda(variante.precioVenta) : formatearMoneda(precioBase)}
      </td>
      <td className="p-2 text-right">
        {confirmando ? (
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelarConfirmacion}
              className="h-6 px-1.5 text-[10px]"
            >
              No
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => borrar.mutate()}
              disabled={borrar.isPending}
              className="h-6 px-1.5 text-[10px] bg-[hsl(var(--brand-danger))] hover:bg-[hsl(var(--brand-danger))]/90"
            >
              Sí
            </Button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon-sm" onClick={onEditar} title="Editar">
              <Edit2 className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onPedirConfirmacion}
              title="Eliminar"
              className="text-[hsl(var(--brand-danger))] hover:bg-[hsl(var(--brand-danger))]/10"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function FilaEditarVariante({
  productoId,
  variante,
  precioBase,
  onCancel,
  onSaved,
}: {
  productoId: string;
  variante: Variante;
  precioBase: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [talla, setTalla] = React.useState(variante.talla);
  const [color, setColor] = React.useState(variante.color);
  const [colorHex, setColorHex] = React.useState(variante.colorHex ?? '#CCCCCC');
  const [codigoBarras, setCodigoBarras] = React.useState(variante.codigoBarras ?? '');
  const [precio, setPrecio] = React.useState(variante.precioVenta ?? '');
  const [activo, setActivo] = React.useState(variante.activo);

  const guardar = useMutation({
    mutationFn: () =>
      actualizar(`/productos/${productoId}/variantes/${variante.id}`, {
        talla: talla.trim(),
        color: color.trim(),
        colorHex,
        codigoBarras: codigoBarras.trim() || null,
        precioVenta: precio === '' ? null : Number(precio),
        activo,
      }),
    onSuccess: () => {
      toast.success('Variante actualizada');
      onSaved();
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <tr className="border-t border-[hsl(var(--border))] bg-[hsl(var(--brand-primary))]/5">
      <td className="p-2">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={colorHex}
            onChange={e => setColorHex(e.target.value)}
            className="size-6 rounded border border-[hsl(var(--border))] cursor-pointer bg-transparent"
          />
          <Input value={talla} onChange={e => setTalla(e.target.value)} className="h-7 w-16 text-xs" />
          <Input value={color} onChange={e => setColor(e.target.value)} className="h-7 w-24 text-xs" />
        </div>
      </td>
      <td className="p-2 font-mono text-[10px] text-[hsl(var(--text-muted))]">{variante.sku}</td>
      <td className="p-2">
        <Input
          value={codigoBarras}
          onChange={e => setCodigoBarras(e.target.value)}
          placeholder="—"
          className="h-7 text-xs font-mono"
        />
      </td>
      <td className="p-2 text-right tabular-nums text-[hsl(var(--text-muted))]">
        {variante.stocks.reduce((s, st) => s + st.disponible, 0)}
      </td>
      <td className="p-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={precio?.toString() ?? ''}
          onChange={e => setPrecio(e.target.value)}
          placeholder={precioBase}
          className="h-7 text-xs text-right tabular-nums w-24 ml-auto"
        />
      </td>
      <td className="p-2 text-right">
        <div className="inline-flex items-center gap-0.5">
          <label className="inline-flex items-center gap-1 text-[10px] mr-1 cursor-pointer">
            <input
              type="checkbox"
              checked={activo}
              onChange={e => setActivo(e.target.checked)}
              className="size-3 accent-[hsl(var(--brand-primary))]"
            />
            Activa
          </label>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} title="Cancelar">
            <X className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || !talla.trim() || !color.trim()}
            title="Guardar"
          >
            <Check className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function FilaAgregarVariante({
  productoId,
  precioBase,
  onCancel,
  onSaved,
}: {
  productoId: string;
  precioBase: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [talla, setTalla] = React.useState('');
  const [color, setColor] = React.useState('');
  const [colorHex, setColorHex] = React.useState('#CCCCCC');
  const [codigoBarras, setCodigoBarras] = React.useState('');
  const [stockInicial, setStockInicial] = React.useState('0');
  const [precio, setPrecio] = React.useState('');

  const guardar = useMutation({
    mutationFn: () =>
      postear(`/productos/${productoId}/variantes`, {
        talla: talla.trim(),
        color: color.trim(),
        colorHex,
        codigoBarras: codigoBarras.trim() || undefined,
        stockInicial: Number(stockInicial) || 0,
        precioVenta: precio === '' ? undefined : Number(precio),
      }),
    onSuccess: () => {
      toast.success('Variante agregada');
      onSaved();
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <tr className="border-t border-[hsl(var(--border))] bg-[hsl(var(--brand-success))]/5">
      <td className="p-2">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={colorHex}
            onChange={e => setColorHex(e.target.value)}
            className="size-6 rounded border border-[hsl(var(--border))] cursor-pointer bg-transparent"
          />
          <Input
            value={talla}
            onChange={e => setTalla(e.target.value)}
            placeholder="Talla"
            className="h-7 w-16 text-xs"
            autoFocus
          />
          <Input
            value={color}
            onChange={e => setColor(e.target.value)}
            placeholder="Color"
            className="h-7 w-24 text-xs"
          />
        </div>
      </td>
      <td className="p-2 text-[10px] text-[hsl(var(--text-muted))]">auto</td>
      <td className="p-2">
        <Input
          value={codigoBarras}
          onChange={e => setCodigoBarras(e.target.value)}
          placeholder="—"
          className="h-7 text-xs font-mono"
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          min="0"
          value={stockInicial}
          onChange={e => setStockInicial(e.target.value)}
          className="h-7 text-xs text-right tabular-nums w-20 ml-auto"
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={precio}
          onChange={e => setPrecio(e.target.value)}
          placeholder={precioBase}
          className="h-7 text-xs text-right tabular-nums w-24 ml-auto"
        />
      </td>
      <td className="p-2 text-right">
        <div className="inline-flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} title="Cancelar">
            <X className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || !talla.trim() || !color.trim()}
            title="Agregar"
          >
            <Check className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
