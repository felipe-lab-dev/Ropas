'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Layers, PackagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetalleSheet } from '@/components/ui/sheet';
import { postear, mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { TALLAS_SUGERIDAS, COLORES_SUGERIDOS } from '@/lib/catalogos-producto';

/** Variante recién creada que devuelve `POST /productos/:id/variantes`. */
export interface VarianteCreada {
  id: string;
  sku: string;
  talla: string;
  color: string;
  colorHex?: string | null;
  codigoBarras?: string | null;
  precioVenta?: string | null;
  stocks?: Array<{ sucursalId: string; disponible: number }>;
}

interface NuevaVarianteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Producto al que se le agrega la variante. */
  producto: { id: string; nombre: string } | null;
  /** Notifica la variante creada (el padre la agrega a la compra/venta). */
  onCreada: (variante: VarianteCreada) => void;
}

/**
 * Mini-selector para agregar UNA talla/color a un producto existente sin salir
 * del flujo de compra. Usa los MISMOS chips que el form de "Nuevo producto"
 * (fuente compartida en `catalogos-producto`) para que el usuario reconozca el
 * gesto. El stock NO se carga acá: lo ingresa la compra al confirmar
 * (`stockInicial: 0`), igual que el flujo de "Nuevo producto".
 */
export function NuevaVarianteSheet({
  open,
  onOpenChange,
  producto,
  onCreada,
}: NuevaVarianteSheetProps) {
  const qc = useQueryClient();

  const [talla, setTalla] = React.useState('');
  const [tallaInput, setTallaInput] = React.useState('');
  const [color, setColor] = React.useState<{ nombre: string; hex: string } | null>(null);
  const [colorNombre, setColorNombre] = React.useState('');
  const [colorHex, setColorHex] = React.useState('#111111');

  // Reiniciar el formulario cada vez que se abre.
  React.useEffect(() => {
    if (open) {
      setTalla('');
      setTallaInput('');
      setColor(null);
      setColorNombre('');
      setColorHex('#111111');
    }
  }, [open]);

  const crear = useMutation({
    mutationFn: () =>
      postear<VarianteCreada>(`/productos/${producto!.id}/variantes`, {
        talla: talla.trim(),
        color: color!.nombre,
        colorHex: color!.hex,
        stockInicial: 0,
      }),
    onSuccess: variante => {
      toast.success(`Variante ${variante.talla} · ${variante.color} agregada`);
      void qc.invalidateQueries({ queryKey: ['buscar-variantes'] });
      onCreada(variante);
      onOpenChange(false);
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const agregarTallaCustom = () => {
    const t = tallaInput.trim().toUpperCase();
    if (t) setTalla(t);
    setTallaInput('');
  };

  const agregarColorCustom = () => {
    const n = colorNombre.trim();
    if (n) setColor({ nombre: n, hex: colorHex });
    setColorNombre('');
  };

  const tallaEsCustom = talla !== '' && !TALLAS_SUGERIDAS.includes(talla);
  const colorEsCustom = !!color && !COLORES_SUGERIDOS.some(c => c.nombre === color.nombre);
  const puedeGuardar = talla.trim() !== '' && color !== null;

  return (
    <DetalleSheet
      open={open}
      onOpenChange={onOpenChange}
      titulo="Agregar variante"
      subtitulo={producto ? `a ${producto.nombre} · el stock lo ingresa la compra` : undefined}
      icono={<PackagePlus className="size-4" />}
      ancho="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[hsl(var(--text-muted))]">
            {puedeGuardar ? (
              <>
                Nueva: <span className="font-medium text-[hsl(var(--text))]">{talla} · {color!.nombre}</span>
              </>
            ) : (
              'Elegí una talla y un color'
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              data-testid="btn-guardar-nueva-variante"
              disabled={!puedeGuardar || crear.isPending}
              onClick={() => crear.mutate()}
            >
              <Plus className="size-4" />
              {crear.isPending ? 'Agregando…' : 'Agregar variante'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-4 sm:p-5 space-y-6" data-testid="sheet-nueva-variante">
        {/* ── Talla ─────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Talla</Label>
          <div className="flex flex-wrap gap-1.5">
            {TALLAS_SUGERIDAS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTalla(t)}
                className={cn(
                  'h-9 min-w-[44px] px-3 rounded-md text-sm font-semibold border transition-all',
                  talla === t
                    ? 'bg-[hsl(var(--brand-primary))] text-white border-[hsl(var(--brand-primary))] shadow-[0_2px_8px_hsl(var(--brand-primary)/0.3)]'
                    : 'bg-[hsl(var(--surface))] border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40',
                )}
              >
                {t}
              </button>
            ))}
            {tallaEsCustom && (
              <span className="inline-flex items-center gap-1 h-9 px-3 rounded-md text-sm font-semibold bg-[hsl(var(--brand-primary))] text-white">
                {talla}
                <button type="button" onClick={() => setTalla('')} aria-label="Quitar talla">
                  <X className="size-3" />
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={tallaInput}
              onChange={e => setTallaInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarTallaCustom(); } }}
              placeholder="Otra talla (ej. 38, EU42)"
              className="h-9 text-sm"
            />
            <Button type="button" size="sm" variant="outline" onClick={agregarTallaCustom}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Color ─────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-1.5">
            {COLORES_SUGERIDOS.map(c => {
              const activo = color?.nombre === c.nombre;
              return (
                <button
                  key={c.nombre}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-9 pl-1 pr-3 rounded-md text-sm font-medium border transition-all',
                    activo
                      ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40',
                  )}
                >
                  <span className="size-6 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                  {c.nombre}
                </button>
              );
            })}
            {colorEsCustom && color && (
              <span className="inline-flex items-center gap-1.5 h-9 pl-1 pr-2 rounded-md text-sm font-medium border border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10">
                <span className="size-6 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                {color.nombre}
                <button type="button" onClick={() => setColor(null)} aria-label="Quitar color">
                  <X className="size-3" />
                </button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="color"
              value={colorHex}
              onChange={e => setColorHex(e.target.value)}
              className="h-9 w-11 rounded-md border border-[hsl(var(--border))] cursor-pointer bg-transparent"
              aria-label="Elegir color personalizado"
            />
            <Input
              value={colorNombre}
              onChange={e => setColorNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarColorCustom(); } }}
              placeholder="Nombre del color (ej. Camel)"
              className="h-9 text-sm"
            />
            <Button type="button" size="sm" variant="outline" onClick={agregarColorCustom}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-[hsl(var(--text-muted))]">
          <Layers className="size-3.5 shrink-0 mt-px" />
          El SKU se genera automático. La variante queda en stock 0 y se llena con
          esta compra al confirmarla.
        </p>
      </div>
    </DetalleSheet>
  );
}
