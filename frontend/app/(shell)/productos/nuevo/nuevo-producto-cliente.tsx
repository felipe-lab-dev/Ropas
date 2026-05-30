'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SelectIconos, type OpcionIcono } from '@/components/ui/select-iconos';
import { ComboboxCreable } from '@/components/ui/combobox-creable';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { FormField } from '@/components/ui/form-field';
import { FormActions } from '@/components/ui/form-actions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IconoCategoria } from '@/components/ui/icono-categoria';
import { colorCategoria } from '@/lib/color-categoria';
import { GENEROS, MATERIALES, ICONO_MATERIAL_FALLBACK } from '@/lib/catalogos-producto';
import { obtener, postear, mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useValidacionForm } from '@/lib/use-validacion-form';
import {
  useUnidadesMedida,
  useTiposAfectacionIgv,
} from '@/lib/api/hooks/use-catalogos-sunat';

interface Categoria { id: string; nombre: string }
interface Variante {
  talla: string;
  color: string;
  colorHex: string;
  stockInicial: number;
}

const TALLAS_SUGERIDAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORES_SUGERIDOS: Array<{ nombre: string; hex: string }> = [
  { nombre: 'Negro', hex: '#111111' },
  { nombre: 'Blanco', hex: '#F8F8F8' },
  { nombre: 'Gris', hex: '#808080' },
  { nombre: 'Azul', hex: '#1E40AF' },
  { nombre: 'Rojo', hex: '#DC2626' },
  { nombre: 'Verde', hex: '#16A34A' },
  { nombre: 'Beige', hex: '#D4C5A0' },
  { nombre: 'Rosa', hex: '#EC4899' },
];

const VARIANTE_UNICA: Variante = {
  talla: 'Única',
  color: 'Único',
  colorHex: '#CCCCCC',
  stockInicial: 0,
};

type TabId = 'general' | 'variantes' | 'sunat' | 'avanzado';

interface FormState {
  nombre: string;
  categoriaId: string;
  precioVenta: string;
  modoVariantes: 'unica' | 'multiples';
  variantes: Variante[];
}

interface NuevoProductoClienteProps {
  /** Cuando se renderiza dentro de un Dialog: omite el PageHeader y la redirección. */
  modoModal?: boolean;
  /** Cierra el modal (cancelar). */
  onCerrar?: () => void;
  /** Notifica el id del producto recién creado (el padre suele abrir "editar"). */
  onCreado?: (id: string) => void;
  /** Precarga el nombre (ej. el término que el usuario buscaba en Compras). */
  nombreInicial?: string;
}

/**
 * Contenido reusable de "Nuevo producto".
 *  - `modoModal`: sin PageHeader; tras crear llama `onCreado(id)` (o `onCerrar`).
 *  - Página standalone (`/productos/nuevo`): header + redirección a editar.
 */
export function NuevoProductoCliente({ modoModal = false, onCerrar, onCreado, nombreInicial = '' }: NuevoProductoClienteProps = {}) {
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = React.useState<TabId>('general');

  const [codigo, setCodigo] = React.useState('');
  const [nombre, setNombre] = React.useState(nombreInicial);
  const [descripcion, setDescripcion] = React.useState('');
  const [categoriaId, setCategoriaId] = React.useState('');
  const [genero, setGenero] = React.useState('mujer');
  const [temporada, setTemporada] = React.useState('todo_el_anio');
  const [material, setMaterial] = React.useState('');
  const [precioVenta, setPrecioVenta] = React.useState('');
  const [precioCompra, setPrecioCompra] = React.useState('');

  const [modoVariantes, setModoVariantes] = React.useState<'unica' | 'multiples'>('unica');
  const [stockUnico, setStockUnico] = React.useState('0');

  const [tallasSel, setTallasSel] = React.useState<string[]>(['S', 'M', 'L']);
  const [coloresSel, setColoresSel] = React.useState<Array<{ nombre: string; hex: string }>>([
    { nombre: 'Negro', hex: '#111111' },
  ]);
  const [tallaInput, setTallaInput] = React.useState('');
  const [colorNombre, setColorNombre] = React.useState('');
  const [colorHex, setColorHex] = React.useState('#111111');

  const [variantes, setVariantes] = React.useState<Variante[]>([]);
  const [unidadMedidaCodigo, setUnidadMedidaCodigo] = React.useState('NIU');
  const [tipoAfectacionIgv, setTipoAfectacionIgv] = React.useState('gravado_onerosa');

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => obtener<Categoria[]>('/categorias'),
  });
  const { data: unidades } = useUnidadesMedida();
  const { data: tiposAfectacion } = useTiposAfectacionIgv();

  React.useEffect(() => {
    if (categorias?.length && !categoriaId && categorias[0]) {
      setCategoriaId(categorias[0].id);
    }
  }, [categorias, categoriaId]);

  const opcionesCategoria = React.useMemo<OpcionIcono[]>(
    () => (categorias ?? []).map((c) => ({
      valor: c.id,
      label: c.nombre,
      color: colorCategoria(c.nombre).base,
      icono: <IconoCategoria nombre={c.nombre} className="size-full" />,
    })),
    [categorias],
  );

  const validacion = useValidacionForm<FormState>({
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
      { id: 'variantes', label: 'Variantes', tabId: 'variantes',
        validar: d => d.modoVariantes === 'multiples' && d.variantes.length === 0
          ? 'Generá al menos una variante (talla × color)'
          : null },
    ],
    onAbrirTab: (t) => setTab(t as TabId),
  });

  const crear = useMutation({
    mutationFn: async () => {
      const variantesFinal: Variante[] =
        modoVariantes === 'unica'
          ? [{ ...VARIANTE_UNICA, stockInicial: Number(stockUnico) || 0 }]
          : variantes;

      const body = {
        codigo: codigo.trim() || undefined,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        categoriaId,
        genero,
        temporada,
        material: material.trim() || undefined,
        precioVenta: Number(precioVenta),
        precioCompra: precioCompra ? Number(precioCompra) : undefined,
        unidadMedidaCodigo,
        tipoAfectacionIgv,
        variantes: variantesFinal.map(v => ({
          talla: v.talla,
          color: v.color,
          colorHex: v.colorHex,
          stockInicial: Number(v.stockInicial) || 0,
        })),
      };
      return postear<{ id: string }>('/productos', body);
    },
    onSuccess: producto => {
      toast.success('Producto creado — agregá las imágenes');
      void qc.invalidateQueries({ queryKey: ['productos'] });
      if (modoModal) {
        if (onCreado) onCreado(producto.id);
        else onCerrar?.();
      } else {
        router.push(`/productos/editar/?id=${producto.id}`);
      }
    },
    onError: e => toast.error(mensajeError(e)),
  });

  function generarMatriz() {
    if (tallasSel.length === 0 || coloresSel.length === 0) {
      toast.error('Agregá al menos una talla y un color');
      return;
    }
    const nuevas: Variante[] = [];
    for (const talla of tallasSel) {
      for (const color of coloresSel) {
        const existente = variantes.find(v => v.talla === talla && v.color === color.nombre);
        nuevas.push(
          existente ?? {
            talla,
            color: color.nombre,
            colorHex: color.hex,
            stockInicial: 0,
          },
        );
      }
    }
    setVariantes(nuevas);
    validacion.limpiarError('variantes');
  }

  function onGuardar() {
    const r = validacion.validar({ nombre, categoriaId, precioVenta, modoVariantes, variantes });
    if (!r.valido) return;
    crear.mutate();
  }

  const toggleTalla = (t: string) =>
    setTallasSel(s => (s.includes(t) ? s.filter(x => x !== t) : [...s, t]));
  const toggleColor = (c: { nombre: string; hex: string }) =>
    setColoresSel(s =>
      s.find(x => x.nombre === c.nombre) ? s.filter(x => x.nombre !== c.nombre) : [...s, c],
    );
  const agregarTallaCustom = () => {
    const t = tallaInput.trim().toUpperCase();
    if (t && !tallasSel.includes(t)) setTallasSel(s => [...s, t]);
    setTallaInput('');
  };
  const agregarColorCustom = () => {
    const n = colorNombre.trim();
    if (n && !coloresSel.find(c => c.nombre === n)) {
      setColoresSel(s => [...s, { nombre: n, hex: colorHex }]);
    }
    setColorNombre('');
  };

  const erroresGeneral = ['nombre', 'categoriaId', 'precioVenta'].some(k => validacion.errores[k]);
  const erroresVariantes = !!validacion.errores.variantes;

  return (
    <div className={cn('space-y-6', !modoModal && 'max-w-5xl')}>
      {!modoModal && (
        <PageHeader
          titulo="Nuevo producto"
          descripcion="Datos esenciales primero. Las variantes son opcionales."
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList>
          <TabsTrigger value="general" data-testid="tab-general" errorBadge={erroresGeneral}>
            General
          </TabsTrigger>
          <TabsTrigger value="variantes" data-testid="tab-variantes" errorBadge={erroresVariantes}>
            Variantes
          </TabsTrigger>
          <TabsTrigger value="sunat" data-testid="tab-sunat">
            SUNAT
          </TabsTrigger>
          <TabsTrigger value="avanzado" data-testid="tab-avanzado">
            Avanzado
          </TabsTrigger>
        </TabsList>

        {/* ── General ───────────────────────────────────────────────────── */}
        <TabsContent value="general">
          <Card className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <FormField label="Código" htmlFor="codigo" className="md:col-span-3"
                hint="Opcional. SKU se genera automático.">
                <Input id="codigo" value={codigo} onChange={e => setCodigo(e.target.value)}
                  placeholder="Opcional" autoComplete="off" />
              </FormField>

              <FormField label="Nombre" htmlFor="nombre" requerido
                error={validacion.errores.nombre}
                className="md:col-span-6">
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={e => { setNombre(e.target.value); validacion.limpiarError('nombre'); }}
                  autoComplete="off"
                  autoFocus
                />
              </FormField>

              <FormField label="Categoría" htmlFor="categoria" requerido
                error={validacion.errores.categoriaId}
                className="md:col-span-3">
                <SelectIconos
                  id="categoria"
                  data-testid="select-categoria"
                  value={categoriaId}
                  onValueChange={v => { setCategoriaId(v); validacion.limpiarError('categoriaId'); }}
                  opciones={opcionesCategoria}
                  placeholder="Seleccioná…"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <FormField label="Precio venta (S/)" htmlFor="precioVenta" requerido
                error={validacion.errores.precioVenta}
                className="md:col-span-3">
                <Input id="precioVenta" type="number" step="0.01" min="0"
                  value={precioVenta}
                  onChange={e => { setPrecioVenta(e.target.value); validacion.limpiarError('precioVenta'); }}
                  placeholder="0.00" autoComplete="off" />
              </FormField>

              <FormField label="Costo (S/)" htmlFor="precioCompra" className="md:col-span-3">
                <Input id="precioCompra" type="number" step="0.01" min="0"
                  value={precioCompra} onChange={e => setPrecioCompra(e.target.value)}
                  placeholder="0.00" autoComplete="off" />
              </FormField>

              <FormField label="Género" htmlFor="genero" className="md:col-span-3">
                <SelectIconos
                  id="genero"
                  data-testid="select-genero"
                  value={genero}
                  onValueChange={setGenero}
                  opciones={GENEROS}
                />
              </FormField>

              <FormField label="Material" htmlFor="material" className="md:col-span-3">
                <ComboboxCreable
                  id="material"
                  data-testid="combobox-material"
                  value={material}
                  onChange={setMaterial}
                  opciones={MATERIALES}
                  iconoFallback={ICONO_MATERIAL_FALLBACK}
                  placeholder="Seleccioná o escribí…"
                  placeholderBuscar="Buscar o escribir material…"
                />
              </FormField>
            </div>
          </Card>
        </TabsContent>

        {/* ── Variantes ─────────────────────────────────────────────────── */}
        <TabsContent value="variantes">
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
                  Stock y variantes
                </h2>
                <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                  {modoVariantes === 'unica'
                    ? 'Producto simple, sin tallas ni colores.'
                    : 'Generá variantes de talla × color.'}
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-0.5 bg-[hsl(var(--surface-2))]/40">
                <button
                  type="button"
                  onClick={() => setModoVariantes('unica')}
                  className={cn(
                    'h-8 px-3 text-xs font-medium rounded-md transition-all',
                    modoVariantes === 'unica'
                      ? 'bg-[hsl(var(--surface))] shadow-sm text-[hsl(var(--text))]'
                      : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]',
                  )}
                >
                  Talla única
                </button>
                <button
                  type="button"
                  onClick={() => setModoVariantes('multiples')}
                  className={cn(
                    'h-8 px-3 text-xs font-medium rounded-md transition-all',
                    modoVariantes === 'multiples'
                      ? 'bg-[hsl(var(--surface))] shadow-sm text-[hsl(var(--text))]'
                      : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]',
                  )}
                >
                  Variantes (talla × color)
                </button>
              </div>
            </div>

            {modoVariantes === 'unica' ? (
              <FormField label="Stock inicial" htmlFor="stockUnico" className="max-w-xs">
                <Input id="stockUnico" type="number" min="0" value={stockUnico}
                  onChange={e => setStockUnico(e.target.value)} />
              </FormField>
            ) : (
              <div className="space-y-5 pt-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Tallas */}
                  <div className="space-y-2">
                    <Label>Tallas</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {TALLAS_SUGERIDAS.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTalla(t)}
                          className={cn(
                            'h-8 min-w-[40px] px-3 rounded-md text-xs font-semibold border transition-all',
                            tallasSel.includes(t)
                              ? 'bg-[hsl(var(--brand-primary))] text-white border-[hsl(var(--brand-primary))] shadow-[0_2px_8px_hsl(var(--brand-primary)/0.3)]'
                              : 'bg-[hsl(var(--surface))] border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40',
                          )}
                        >
                          {t}
                        </button>
                      ))}
                      {tallasSel.filter(t => !TALLAS_SUGERIDAS.includes(t)).map(t => (
                        <span key={t} className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-xs font-semibold bg-[hsl(var(--brand-primary))] text-white">
                          {t}
                          <button type="button" onClick={() => toggleTalla(t)}>
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={tallaInput} onChange={e => setTallaInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarTallaCustom(); } }}
                        placeholder="Talla custom (ej. 38, EU42)" className="h-8 text-xs" />
                      <Button type="button" size="sm" variant="outline" onClick={agregarTallaCustom}>
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Colores */}
                  <div className="space-y-2">
                    <Label>Colores</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {COLORES_SUGERIDOS.map(c => {
                        const activo = !!coloresSel.find(x => x.nombre === c.nombre);
                        return (
                          <button key={c.nombre} type="button" onClick={() => toggleColor(c)}
                            className={cn(
                              'inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-md text-xs font-medium border transition-all',
                              activo
                                ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10'
                                : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40',
                            )}>
                            <span className="size-5 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                            {c.nombre}
                          </button>
                        );
                      })}
                      {coloresSel.filter(c => !COLORES_SUGERIDOS.find(x => x.nombre === c.nombre)).map(c => (
                        <span key={c.nombre} className="inline-flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-md text-xs font-medium border border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10">
                          <span className="size-5 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                          {c.nombre}
                          <button type="button" onClick={() => toggleColor(c)}>
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="color" value={colorHex} onChange={e => setColorHex(e.target.value)}
                        className="h-8 w-10 rounded-md border border-[hsl(var(--border))] cursor-pointer bg-transparent" />
                      <Input value={colorNombre} onChange={e => setColorNombre(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarColorCustom(); } }}
                        placeholder="Nombre del color" className="h-8 text-xs" />
                      <Button type="button" size="sm" variant="outline" onClick={agregarColorCustom}>
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Button type="button" variant="outline" onClick={generarMatriz} className="w-full">
                  <Sparkles className="size-4" />
                  Generar {tallasSel.length} × {coloresSel.length} = {tallasSel.length * coloresSel.length} variantes
                </Button>

                {validacion.errores.variantes && (
                  <p className="text-xs text-[#ef4444]">{validacion.errores.variantes}</p>
                )}

                {variantes.length > 0 && (
                  <div className="border border-[hsl(var(--border))] rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-[hsl(var(--surface-2))]/40 border-b border-[hsl(var(--border))]">
                      <Badge variant="outline">{variantes.length} variantes generadas</Badge>
                      <span className="text-[10px] text-[hsl(var(--text-muted))]">SKU se genera automático al guardar</span>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
                      <table className="w-full text-xs">
                        <thead className="bg-[hsl(var(--surface-2))]/30 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-semibold">Variante</th>
                            <th className="text-right p-2 font-semibold">Stock</th>
                            <th className="p-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {variantes.map((v, i) => (
                            <tr key={`${v.talla}-${v.color}`} className="border-t border-[hsl(var(--border))]">
                              <td className="p-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="size-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: v.colorHex }} />
                                  <span className="font-medium">{v.talla}</span>
                                  <span className="text-[hsl(var(--text-muted))]">· {v.color}</span>
                                </div>
                              </td>
                              <td className="p-2">
                                <Input type="number" min="0" value={v.stockInicial}
                                  onChange={e => {
                                    const nuevo = [...variantes];
                                    nuevo[i] = { ...v, stockInicial: Number(e.target.value) };
                                    setVariantes(nuevo);
                                  }}
                                  className="h-7 text-xs text-right tabular-nums w-24 ml-auto" />
                              </td>
                              <td className="p-2">
                                <button type="button"
                                  onClick={() => setVariantes(variantes.filter((_, j) => j !== i))}
                                  className="text-[hsl(var(--brand-danger))] hover:opacity-80">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── SUNAT ─────────────────────────────────────────────────────── */}
        <TabsContent value="sunat">
          <Card className="p-6 space-y-5" data-testid="seccion-sunat">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
                Configuración SUNAT
              </h2>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                Unidad de medida e IGV para facturación electrónica. La mayoría de productos usa los defaults.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Unidad de medida (SUNAT Cat. 03)" htmlFor="unidadMedida"
                hint="Cómo se contabiliza la cantidad en la factura. Default: NIU (unidad).">
                <Select id="unidadMedida" value={unidadMedidaCodigo}
                  onChange={e => setUnidadMedidaCodigo(e.target.value)}
                  data-testid="select-unidad-medida">
                  {unidades?.map(u => (
                    <option key={u.codigo} value={u.codigo}>{u.codigo} — {u.nombre}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Tipo de afectación IGV (SUNAT Cat. 07)" htmlFor="tipoAfectacion"
                hint="Define si el producto está gravado, exonerado o inafecto al IGV.">
                <Select id="tipoAfectacion" value={tipoAfectacionIgv}
                  onChange={e => setTipoAfectacionIgv(e.target.value)}
                  data-testid="select-tipo-afectacion">
                  {tiposAfectacion?.map(t => (
                    <option key={t.codigo} value={t.codigo}>{t.sunatCodigo} — {t.nombre}</option>
                  ))}
                </Select>
              </FormField>
            </div>
          </Card>
        </TabsContent>

        {/* ── Avanzado ──────────────────────────────────────────────────── */}
        <TabsContent value="avanzado">
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
                Detalles adicionales
              </h2>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                Descripción, temporada — todo opcional.
              </p>
            </div>
            <FormField label="Descripción" htmlFor="descripcion">
              <Textarea id="descripcion" value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Detalles del producto, fit, características…" rows={3} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Temporada" htmlFor="temporada">
                <Select id="temporada" value={temporada} onChange={e => setTemporada(e.target.value)}>
                  <option value="todo_el_anio">Todo el año</option>
                  <option value="primavera">Primavera</option>
                  <option value="verano">Verano</option>
                  <option value="otonio">Otoño</option>
                  <option value="invierno">Invierno</option>
                </Select>
              </FormField>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <FormActions
        textoGuardar="Crear producto"
        onGuardar={onGuardar}
        guardando={crear.isPending}
        onCancelar={modoModal ? onCerrar : () => router.push('/productos')}
      />
    </div>
  );
}
