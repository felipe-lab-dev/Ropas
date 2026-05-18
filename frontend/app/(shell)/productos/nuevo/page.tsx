'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { obtener, postear, mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface Categoria {
  id: string;
  nombre: string;
}

interface Variante {
  talla: string;
  color: string;
  colorHex: string;
  sku: string;
  stockInicial: number;
  precioVenta: string;
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

export default function NuevoProductoPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [sku, setSku] = React.useState('');
  const [nombre, setNombre] = React.useState('');
  const [descripcion, setDescripcion] = React.useState('');
  const [categoriaId, setCategoriaId] = React.useState('');
  const [genero, setGenero] = React.useState('unisex');
  const [temporada, setTemporada] = React.useState('todo_el_anio');
  const [material, setMaterial] = React.useState('');
  const [cuidado, setCuidado] = React.useState('');
  const [precioVenta, setPrecioVenta] = React.useState('');
  const [precioCompra, setPrecioCompra] = React.useState('');
  const [tagsInput, setTagsInput] = React.useState('');

  const [tallasSel, setTallasSel] = React.useState<string[]>(['S', 'M', 'L']);
  const [coloresSel, setColoresSel] = React.useState<Array<{ nombre: string; hex: string }>>([
    { nombre: 'Negro', hex: '#111111' },
  ]);
  const [tallaInput, setTallaInput] = React.useState('');
  const [colorNombre, setColorNombre] = React.useState('');
  const [colorHex, setColorHex] = React.useState('#111111');

  const [variantes, setVariantes] = React.useState<Variante[]>([]);

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => obtener<Categoria[]>('/categorias'),
  });

  React.useEffect(() => {
    if (categorias?.length && !categoriaId && categorias[0]) {
      setCategoriaId(categorias[0].id);
    }
  }, [categorias, categoriaId]);

  function generarMatriz() {
    if (tallasSel.length === 0 || coloresSel.length === 0) {
      toast.error('Agrega al menos una talla y un color');
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
            sku: sku ? `${sku}-${talla}-${color.nombre.slice(0, 3).toUpperCase()}` : '',
            stockInicial: 0,
            precioVenta: '',
          },
        );
      }
    }
    setVariantes(nuevas);
  }

  const crear = useMutation({
    mutationFn: async () => {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const body = {
        sku: sku.trim(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        categoriaId,
        genero,
        temporada,
        material: material.trim() || undefined,
        cuidado: cuidado.trim() || undefined,
        precioVenta: Number(precioVenta),
        precioCompra: precioCompra ? Number(precioCompra) : undefined,
        tags: tags.length ? tags : undefined,
        variantes: variantes.map(v => ({
          talla: v.talla,
          color: v.color,
          colorHex: v.colorHex,
          sku: v.sku || undefined,
          stockInicial: Number(v.stockInicial) || 0,
          precioVenta: v.precioVenta ? Number(v.precioVenta) : undefined,
        })),
      };
      return postear('/productos', body);
    },
    onSuccess: () => {
      toast.success('Producto creado');
      void qc.invalidateQueries({ queryKey: ['productos'] });
      router.push('/productos');
    },
    onError: e => toast.error(mensajeError(e)),
  });

  function validar(): string | null {
    if (!sku.trim()) return 'SKU requerido';
    if (!nombre.trim()) return 'Nombre requerido';
    if (!categoriaId) return 'Selecciona una categoría';
    if (!precioVenta || Number(precioVenta) <= 0) return 'Precio de venta inválido';
    if (variantes.length === 0) return 'Genera al menos una variante (talla + color)';
    return null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validar();
    if (err) {
      toast.error(err);
      return;
    }
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

  const sinCategorias = categorias && categorias.length === 0;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PageHeader
        titulo="Nuevo producto"
        descripcion="Define la información básica y genera las variantes (talla × color)."
        acciones={
          <>
            <Button asChild variant="ghost" type="button">
              <Link href="/productos"><ArrowLeft className="size-4" /> Cancelar</Link>
            </Button>
            <Button type="submit" size="lg" disabled={crear.isPending}>
              {crear.isPending ? 'Guardando…' : 'Crear producto'}
            </Button>
          </>
        }
      />

      {sinCategorias && (
        <Card className="p-4 border-[hsl(var(--brand-warning))]/40 bg-[hsl(var(--brand-warning))]/5">
          <p className="text-sm">
            No tienes categorías creadas. Crea una primero desde el endpoint <code>/categorias</code> o
            pide al admin que las cargue.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Columna 1-2: Información básica */}
        <Card className="xl:col-span-3 p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
            Información del producto
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU base *</Label>
              <Input
                id="sku"
                value={sku}
                onChange={e => setSku(e.target.value.toUpperCase())}
                placeholder="POL-001"
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Polo manga corta"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Detalles del producto, fit, características…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select
                id="categoria"
                value={categoriaId}
                onChange={e => setCategoriaId(e.target.value)}
                required
              >
                <option value="" disabled>Selecciona…</option>
                {categorias?.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="genero">Género</Label>
              <Select id="genero" value={genero} onChange={e => setGenero(e.target.value)}>
                <option value="unisex">Unisex</option>
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
                <option value="ninio">Niño</option>
                <option value="ninia">Niña</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="temporada">Temporada</Label>
              <Select id="temporada" value={temporada} onChange={e => setTemporada(e.target.value)}>
                <option value="todo_el_anio">Todo el año</option>
                <option value="primavera">Primavera</option>
                <option value="verano">Verano</option>
                <option value="otonio">Otoño</option>
                <option value="invierno">Invierno</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="material">Material</Label>
              <Input
                id="material"
                value={material}
                onChange={e => setMaterial(e.target.value)}
                placeholder="100% algodón"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuidado">Cuidado</Label>
              <Input
                id="cuidado"
                value={cuidado}
                onChange={e => setCuidado(e.target.value)}
                placeholder="Lavar a máquina en agua fría"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="precioVenta">Precio venta (PEN) *</Label>
              <Input
                id="precioVenta"
                type="number"
                step="0.01"
                min="0"
                value={precioVenta}
                onChange={e => setPrecioVenta(e.target.value)}
                placeholder="89.90"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="precioCompra">Precio compra (PEN)</Label>
              <Input
                id="precioCompra"
                type="number"
                step="0.01"
                min="0"
                value={precioCompra}
                onChange={e => setPrecioCompra(e.target.value)}
                placeholder="45.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (separados por coma)</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="verano, oferta, nuevo"
            />
          </div>
        </Card>

        {/* Columna 3: Generador de variantes */}
        <Card className="xl:col-span-2 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
              Variantes
            </h2>
            <Badge variant="outline">{variantes.length} variante{variantes.length === 1 ? '' : 's'}</Badge>
          </div>

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
                <span
                  key={t}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-xs font-semibold bg-[hsl(var(--brand-primary))] text-white"
                >
                  {t}
                  <button type="button" onClick={() => toggleTalla(t)}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tallaInput}
                onChange={e => setTallaInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    agregarTallaCustom();
                  }
                }}
                placeholder="Talla custom (ej. 38, EU42)"
                className="h-8 text-xs"
              />
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
                  <button
                    key={c.nombre}
                    type="button"
                    onClick={() => toggleColor(c)}
                    className={cn(
                      'inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-md text-xs font-medium border transition-all',
                      activo
                        ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10'
                        : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40',
                    )}
                  >
                    <span
                      className="size-5 rounded-full border border-black/10"
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.nombre}
                  </button>
                );
              })}
              {coloresSel.filter(c => !COLORES_SUGERIDOS.find(x => x.nombre === c.nombre)).map(c => (
                <span
                  key={c.nombre}
                  className="inline-flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-md text-xs font-medium border border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10"
                >
                  <span className="size-5 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                  {c.nombre}
                  <button type="button" onClick={() => toggleColor(c)}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="color"
                value={colorHex}
                onChange={e => setColorHex(e.target.value)}
                className="h-8 w-10 rounded-md border border-[hsl(var(--border))] cursor-pointer bg-transparent"
              />
              <Input
                value={colorNombre}
                onChange={e => setColorNombre(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    agregarColorCustom();
                  }
                }}
                placeholder="Nombre del color"
                className="h-8 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={agregarColorCustom}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={generarMatriz} className="w-full">
            <Sparkles className="size-4" />
            Generar {tallasSel.length} × {coloresSel.length} = {tallasSel.length * coloresSel.length} variantes
          </Button>

          {variantes.length > 0 && (
            <div className="border border-[hsl(var(--border))] rounded-lg overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-xs">
                  <thead className="bg-[hsl(var(--surface-2))]/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-semibold">Variante</th>
                      <th className="text-left p-2 font-semibold">SKU</th>
                      <th className="text-right p-2 font-semibold">Stock</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantes.map((v, i) => (
                      <tr key={`${v.talla}-${v.color}`} className="border-t border-[hsl(var(--border))]">
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="size-4 rounded-full border border-black/10 shrink-0"
                              style={{ backgroundColor: v.colorHex }}
                            />
                            <span className="font-medium">{v.talla}</span>
                            <span className="text-[hsl(var(--text-muted))]">· {v.color}</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <Input
                            value={v.sku}
                            onChange={e => {
                              const nuevo = [...variantes];
                              nuevo[i] = { ...v, sku: e.target.value };
                              setVariantes(nuevo);
                            }}
                            placeholder="auto"
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={v.stockInicial}
                            onChange={e => {
                              const nuevo = [...variantes];
                              nuevo[i] = { ...v, stockInicial: Number(e.target.value) };
                              setVariantes(nuevo);
                            }}
                            className="h-7 text-xs text-right tabular-nums w-20 ml-auto"
                          />
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => setVariantes(variantes.filter((_, j) => j !== i))}
                            className="text-[hsl(var(--brand-danger))] hover:opacity-80"
                          >
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
        </Card>
      </div>
    </form>
  );
}
