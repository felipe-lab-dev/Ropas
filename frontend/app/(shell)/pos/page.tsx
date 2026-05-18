'use client';

import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingCart, X, Plus, Minus, ScanBarcode, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { obtener, obtenerPaginado, postear, mensajeError } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';
import { useSesion } from '@/lib/store/sesion';

interface VarianteBuscable {
  id: string;
  sku: string;
  talla: string;
  color: string;
  colorHex?: string | null;
  codigoBarras?: string | null;
  producto: { id: string; nombre: string; sku: string; precioVenta: string };
  stocks?: Array<{ disponible: number }>;
}

interface ItemCarrito {
  varianteId: string;
  productoNombre: string;
  talla: string;
  color: string;
  precioUnitario: number;
  cantidad: number;
}

interface Sucursal { id: string; codigo: string; nombre: string }

export default function PosPage() {
  const usuario = useSesion(s => s.usuario);
  const [carrito, setCarrito] = React.useState<ItemCarrito[]>([]);
  const [busqueda, setBusqueda] = React.useState('');
  const [debouncedBusqueda, setDebouncedBusqueda] = React.useState('');
  const [medioPago, setMedioPago] = React.useState<'efectivo' | 'tarjeta_debito' | 'yape'>('efectivo');
  const [sucursalId, setSucursalId] = React.useState<string>(usuario?.sucursalDefecto ?? '');

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedBusqueda(busqueda), 200);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  React.useEffect(() => {
    if (sucursales && !sucursalId && sucursales[0]) setSucursalId(sucursales[0].id);
  }, [sucursales, sucursalId]);

  const { data: resultados } = useQuery({
    queryKey: ['pos-buscar', debouncedBusqueda],
    queryFn: () =>
      obtenerPaginado<{
        id: string; nombre: string; sku: string;
        variantes: VarianteBuscable[];
      }>('/productos', { buscar: debouncedBusqueda, limite: 6 }),
    enabled: debouncedBusqueda.length >= 2,
  });

  const agregar = (v: VarianteBuscable, productoNombre: string) => {
    setCarrito(c => {
      const existe = c.find(i => i.varianteId === v.id);
      if (existe) {
        return c.map(i => i.varianteId === v.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...c, {
        varianteId: v.id,
        productoNombre,
        talla: v.talla,
        color: v.color,
        precioUnitario: parseFloat(v.producto.precioVenta),
        cantidad: 1,
      }];
    });
    setBusqueda('');
  };

  const cambiarCantidad = (varianteId: string, delta: number) => {
    setCarrito(c =>
      c.flatMap(i => {
        if (i.varianteId !== varianteId) return [i];
        const nueva = i.cantidad + delta;
        return nueva <= 0 ? [] : [{ ...i, cantidad: nueva }];
      }),
    );
  };

  const remover = (varianteId: string) => setCarrito(c => c.filter(i => i.varianteId !== varianteId));
  const subtotal = carrito.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);
  const total = subtotal;

  const cobrar = useMutation({
    mutationFn: () =>
      postear<{ numero: string }>('/ventas', {
        sucursalId,
        items: carrito.map(i => ({
          varianteId: i.varianteId, cantidad: i.cantidad, precioUnitario: i.precioUnitario,
        })),
        pagos: [{ medio: medioPago, monto: total }],
      }),
    onSuccess: data => {
      toast.success(`Venta ${data.numero} registrada`);
      setCarrito([]);
    },
    onError: err => toast.error(mensajeError(err)),
  });

  return (
    <div className="grid lg:grid-cols-[1fr_440px] gap-6 -m-8 p-8 min-h-[calc(100vh-3.5rem)]">
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="size-10 rounded-xl gradient-brand-accent grid place-items-center shadow-[0_4px_16px_hsl(var(--brand-primary)/0.35)]">
            <ShoppingCart className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">Punto de Venta</h1>
            <p className="text-xs text-[hsl(var(--text-muted))] mt-1">Atajo: <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--surface-2))] text-[10px] font-mono">/</kbd> para enfocar la búsqueda</p>
          </div>
          <Badge variant="accent" className="ml-2">POS</Badge>
        </motion.div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
            <Input
              autoFocus
              data-busqueda
              placeholder="Buscar producto por nombre, SKU o escanear código de barras…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="pl-9 h-12 text-base"
            />
          </div>
          <Button variant="outline" size="lg" className="px-4">
            <ScanBarcode className="size-4" /> Escanear
          </Button>
        </div>

        <AnimatePresence>
          {debouncedBusqueda.length >= 2 && resultados && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid sm:grid-cols-2 gap-3"
            >
              {resultados.datos.length === 0 && (
                <p className="col-span-2 text-sm text-[hsl(var(--text-muted))] py-6 text-center">
                  Sin coincidencias.
                </p>
              )}
              {resultados.datos.flatMap(p =>
                p.variantes.map(v => (
                  <button
                    key={v.id}
                    onClick={() => agregar({ ...v, producto: { id: p.id, nombre: p.nombre, sku: p.sku, precioVenta: '0' } } as any, p.nombre)}
                    className="text-left p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:border-[hsl(var(--brand-primary))]/50 hover:bg-[hsl(var(--surface-2))]/50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="size-10 rounded-md border border-[hsl(var(--border))]"
                        style={{ backgroundColor: v.colorHex ?? 'var(--surface-2)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.nombre}</div>
                        <div className="text-xs text-[hsl(var(--text-muted))]">
                          Talla {v.talla} · {v.color}
                        </div>
                      </div>
                    </div>
                  </button>
                )),
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-1">
            {carrito.length === 0 ? (
              <div className="py-20 text-center">
                <ShoppingCart className="size-12 mx-auto text-[hsl(var(--text-muted))]/50 mb-3" />
                <p className="text-sm text-[hsl(var(--text-muted))]">
                  Carrito vacío. Buscá productos arriba.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border))]">
                <AnimatePresence>
                  {carrito.map(i => (
                    <motion.div
                      key={i.varianteId}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-4 p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{i.productoNombre}</div>
                        <div className="text-xs text-[hsl(var(--text-muted))]">
                          Talla {i.talla} · {i.color} · {formatearMoneda(i.precioUnitario)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => cambiarCantidad(i.varianteId, -1)}>
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center font-mono font-bold">{i.cantidad}</span>
                        <Button variant="ghost" size="icon-sm" onClick={() => cambiarCantidad(i.varianteId, +1)}>
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <div className="w-24 text-right font-bold tabular-nums">
                        {formatearMoneda(i.precioUnitario * i.cantidad)}
                      </div>
                      <Button variant="ghost" size="icon-sm" className="text-[hsl(var(--brand-danger))]" onClick={() => remover(i.varianteId)}>
                        <X className="size-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden sticky top-20 self-start">
        <div className="h-1 gradient-brand-accent" />
        <div className="p-6 space-y-6">
          <div className="relative">
            <div className="absolute -top-2 -left-2 -right-2 -bottom-2 rounded-2xl bg-gradient-to-br from-[hsl(var(--brand-primary))]/8 to-[hsl(var(--brand-accent))]/4 pointer-events-none" />
            <div className="relative">
              <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-1 font-semibold">Total a cobrar</p>
              <motion.div
                key={total}
                initial={{ scale: 0.95, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black tracking-tighter tabular-nums bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))] bg-clip-text text-transparent"
              >
                {formatearMoneda(total)}
              </motion.div>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                {carrito.length} item{carrito.length === 1 ? '' : 's'} · {carrito.reduce((s, i) => s + i.cantidad, 0)} unidades
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] mb-2">Medio de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'efectivo', label: 'Efectivo', icon: Banknote },
                { value: 'tarjeta_debito', label: 'Tarjeta', icon: CreditCard },
                { value: 'yape', label: 'Yape/Plin', icon: Smartphone },
              ] as const).map(opt => {
                const activo = medioPago === opt.value;
                const Icon = opt.icon;
                return (
                  <motion.button
                    key={opt.value}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setMedioPago(opt.value)}
                    className={`p-3 rounded-lg border-2 text-xs font-semibold transition-all ${
                      activo
                        ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10 text-[hsl(var(--brand-primary))] shadow-[0_4px_14px_hsl(var(--brand-primary)/0.25)]'
                        : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40 hover:bg-[hsl(var(--surface-2))]/60'
                    }`}
                  >
                    <Icon className="size-5 mx-auto mb-1" />
                    {opt.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <Button
            size="xl"
            className="w-full glow-brand"
            disabled={carrito.length === 0 || cobrar.isPending || !sucursalId}
            onClick={() => cobrar.mutate()}
          >
            {cobrar.isPending ? 'Procesando…' : `Cobrar ${formatearMoneda(total)}`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
