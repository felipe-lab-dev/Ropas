'use client';

import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingCart, X, Plus, Minus, ScanBarcode, CreditCard, Banknote, Smartphone, Tag, CheckCircle2, XCircle, AlertTriangle, UserPlus, User as UserIcon, Percent } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  precioVenta?: string | null;
  stocks?: Array<{ sucursalId: string; disponible: number }>;
}

interface ProductoBuscable {
  id: string;
  nombre: string;
  sku: string;
  precioVenta: string;
  variantes: VarianteBuscable[];
}

interface ItemCarrito {
  varianteId: string;
  productoNombre: string;
  talla: string;
  color: string;
  precioUnitario: number;
  cantidad: number;
  stockDisponible: number;
}

interface Sucursal { id: string; codigo: string; nombre: string }

interface SesionCajaResumen {
  id: string;
  sucursal: { id: string; nombre: string };
  cajero: { id: string; nombre: string };
}

interface ClienteResumen {
  id: string;
  nombre: string;
  documento: string | null;
  tipoDocumento: string;
}

function precioParaVariante(v: VarianteBuscable, p: ProductoBuscable): number {
  // Variante puede sobreescribir el precio base del producto (campo opcional).
  const base = v.precioVenta ?? p.precioVenta;
  return parseFloat(base ?? '0');
}

function stockEnSucursal(v: VarianteBuscable, sucursalId: string | null): number {
  if (!v.stocks || !sucursalId) return 0;
  return v.stocks.find(s => s.sucursalId === sucursalId)?.disponible ?? 0;
}

export default function PosPage() {
  const usuario = useSesion(s => s.usuario);
  const cuponInicial = useSearchParams().get('cupon') ?? '';
  const [carrito, setCarrito] = React.useState<ItemCarrito[]>([]);
  const [busqueda, setBusqueda] = React.useState('');
  const [debouncedBusqueda, setDebouncedBusqueda] = React.useState('');
  const [medioPago, setMedioPago] = React.useState<'efectivo' | 'tarjeta_debito' | 'yape'>('efectivo');
  const [sucursalId, setSucursalId] = React.useState<string>(usuario?.sucursalDefecto ?? '');
  const [codigoCupon, setCodigoCupon] = React.useState<string>(cuponInicial);
  const [cuponValidado, setCuponValidado] = React.useState<{
    valido: boolean;
    descuento: number;
    mensaje: string;
    codigo: string;
  } | null>(null);
  const [cliente, setCliente] = React.useState<ClienteResumen | null>(null);
  const [descuentoManual, setDescuentoManual] = React.useState<number>(0);
  const [buscarCliente, setBuscarCliente] = React.useState('');
  const [debouncedBuscarCliente, setDebouncedBuscarCliente] = React.useState('');
  const [popoverClienteAbierto, setPopoverClienteAbierto] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedBuscarCliente(buscarCliente), 200);
    return () => clearTimeout(t);
  }, [buscarCliente]);

  const { data: clientesEncontrados, isFetching: buscandoClientes } = useQuery({
    queryKey: ['pos-buscar-cliente', debouncedBuscarCliente],
    queryFn: () =>
      obtenerPaginado<ClienteResumen>('/clientes', {
        buscar: debouncedBuscarCliente,
        limite: 8,
      }),
    enabled: debouncedBuscarCliente.length >= 2,
  });

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

  // Sesión de caja abierta del cajero en la sucursal seleccionada.
  // Si no hay sesión abierta, la venta NO se asocia a una caja (queda fuera del cierre).
  const { data: sesionCaja } = useQuery({
    queryKey: ['caja-mi-sesion', sucursalId],
    queryFn: () =>
      obtener<SesionCajaResumen | null>('/caja/mi-sesion-abierta', {
        params: { sucursalId },
      }),
    enabled: !!sucursalId,
    retry: false,
  });

  // Cambiar de sucursal invalida el carrito: stock por sucursal no es portable.
  React.useEffect(() => {
    setCarrito([]);
  }, [sucursalId]);

  const { data: resultados } = useQuery({
    queryKey: ['pos-buscar', debouncedBusqueda],
    queryFn: () =>
      obtenerPaginado<ProductoBuscable>('/productos', {
        buscar: debouncedBusqueda,
        limite: 6,
      }),
    enabled: debouncedBusqueda.length >= 2,
  });

  const agregar = (v: VarianteBuscable, p: ProductoBuscable) => {
    const precio = precioParaVariante(v, p);
    const stockDisponible = stockEnSucursal(v, sucursalId);

    if (precio <= 0) {
      toast.error(`"${p.nombre}" no tiene precio configurado`);
      return;
    }
    if (stockDisponible <= 0) {
      toast.error(`Sin stock de "${p.nombre} · ${v.talla}/${v.color}" en esta sucursal`);
      return;
    }

    setCarrito(c => {
      const existe = c.find(i => i.varianteId === v.id);
      if (existe) {
        if (existe.cantidad >= stockDisponible) {
          toast.error(`Stock máximo alcanzado (${stockDisponible})`);
          return c;
        }
        return c.map(i => i.varianteId === v.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...c, {
        varianteId: v.id,
        productoNombre: p.nombre,
        talla: v.talla,
        color: v.color,
        precioUnitario: precio,
        cantidad: 1,
        stockDisponible,
      }];
    });
    setBusqueda('');
  };

  const cambiarCantidad = (varianteId: string, delta: number) => {
    setCarrito(c =>
      c.flatMap(i => {
        if (i.varianteId !== varianteId) return [i];
        const nueva = i.cantidad + delta;
        if (nueva <= 0) return [];
        if (nueva > i.stockDisponible) {
          toast.error(`Stock máximo: ${i.stockDisponible}`);
          return [i];
        }
        return [{ ...i, cantidad: nueva }];
      }),
    );
  };

  const remover = (varianteId: string) => setCarrito(c => c.filter(i => i.varianteId !== varianteId));
  const subtotal = carrito.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);
  const descuentoCupon = cuponValidado?.valido ? cuponValidado.descuento : 0;
  const descuentoEfectivo = Math.min(
    Math.max(0, descuentoManual),
    Math.max(0, subtotal - descuentoCupon),
  );
  const total = Math.round(Math.max(0, subtotal - descuentoCupon - descuentoEfectivo) * 100) / 100;

  // Revalidar el cupón cuando cambia el carrito
  const validarCupon = useMutation({
    mutationFn: () =>
      postear<{ valido: boolean; descuento: number; mensaje: string }>('/cupones/validar', {
        codigo: codigoCupon.trim().toUpperCase(),
        items: carrito.map(i => ({
          varianteId: i.varianteId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        })),
      }),
    onSuccess: res => {
      setCuponValidado({
        ...res,
        codigo: codigoCupon.trim().toUpperCase(),
      });
      if (res.valido) toast.success(`Cupón aplicado: -${formatearMoneda(res.descuento)}`);
    },
    onError: err => {
      toast.error(mensajeError(err));
      setCuponValidado(null);
    },
  });

  const quitarCupon = () => {
    setCodigoCupon('');
    setCuponValidado(null);
  };

  // Si cambia el carrito y hay cupón validado, re-validar automáticamente
  React.useEffect(() => {
    if (cuponValidado && carrito.length > 0 && codigoCupon) {
      validarCupon.mutate();
    } else if (carrito.length === 0) {
      setCuponValidado(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito.length, JSON.stringify(carrito.map(i => `${i.varianteId}:${i.cantidad}`))]);

  const cobrar = useMutation({
    mutationFn: () =>
      postear<{ numero: string }>('/ventas', {
        sucursalId,
        sesionCajaId: sesionCaja?.id ?? undefined,
        clienteId: cliente?.id ?? undefined,
        items: carrito.map(i => ({
          varianteId: i.varianteId, cantidad: i.cantidad, precioUnitario: i.precioUnitario,
        })),
        pagos: total > 0 ? [{ medio: medioPago, monto: total }] : [],
        descuento: descuentoEfectivo > 0 ? descuentoEfectivo : undefined,
        ...(cuponValidado?.valido ? { codigoCupon: cuponValidado.codigo } : {}),
      }),
    onSuccess: data => {
      toast.success(`Venta ${data.numero} registrada`);
      setCarrito([]);
      setCuponValidado(null);
      setCodigoCupon('');
      setDescuentoManual(0);
      setCliente(null);
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

        {sucursalId && sesionCaja === null && (
          <div className="flex items-center gap-3 rounded-lg border border-[hsl(35_90%_55%/0.4)] bg-[hsl(35_90%_55%/0.08)] px-4 py-3 text-sm">
            <AlertTriangle className="size-4 text-[hsl(35_90%_55%)] shrink-0" />
            <div className="flex-1">
              <p className="font-medium">No hay sesión de caja abierta</p>
              <p className="text-xs text-[hsl(var(--text-muted))]">
                Las ventas no quedarán asociadas al cierre de caja.{' '}
                <Link href="/caja" className="underline">Abrir caja</Link>
              </p>
            </div>
          </div>
        )}

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
                p.variantes.map(v => {
                  const stock = stockEnSucursal(v, sucursalId);
                  const precio = precioParaVariante(v, p);
                  const sinStock = stock <= 0;
                  return (
                    <button
                      key={v.id}
                      disabled={sinStock}
                      onClick={() => agregar(v, p)}
                      className={`text-left p-3 rounded-lg border bg-[hsl(var(--surface))] transition-all ${
                        sinStock
                          ? 'border-[hsl(var(--border))] opacity-50 cursor-not-allowed'
                          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/50 hover:bg-[hsl(var(--surface-2))]/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="size-10 rounded-md border border-[hsl(var(--border))]"
                          style={{ backgroundColor: v.colorHex ?? 'var(--surface-2)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.nombre}</div>
                          <div className="text-xs text-[hsl(var(--text-muted))]">
                            Talla {v.talla} · {v.color} · {formatearMoneda(precio)}
                          </div>
                        </div>
                        <div
                          className={`text-xs font-mono ${
                            sinStock
                              ? 'text-[hsl(var(--brand-danger))]'
                              : 'text-[hsl(var(--text-muted))]'
                          }`}
                        >
                          {sinStock ? 'sin stock' : `${stock} disp.`}
                        </div>
                      </div>
                    </button>
                  );
                }),
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
                  Carrito vacío. Busca productos arriba.
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
              {(descuentoCupon > 0 || descuentoEfectivo > 0) && (
                <div className="text-xs mt-1 space-y-0.5">
                  <p className="text-[hsl(var(--text-muted))]">
                    Subtotal {formatearMoneda(subtotal)}
                  </p>
                  {descuentoCupon > 0 && (
                    <p className="text-[hsl(140_70%_60%)] font-semibold">
                      Cupón -{formatearMoneda(descuentoCupon)}
                    </p>
                  )}
                  {descuentoEfectivo > 0 && (
                    <p className="text-[hsl(140_70%_60%)] font-semibold">
                      Descuento manual -{formatearMoneda(descuentoEfectivo)}
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                {carrito.length} item{carrito.length === 1 ? '' : 's'} · {carrito.reduce((s, i) => s + i.cantidad, 0)} unidades
              </p>
            </div>
          </div>

          {/* Bloque cliente */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] flex items-center gap-1.5">
              <UserIcon className="size-3.5" /> Cliente
            </p>
            {cliente ? (
              <div className="flex items-center justify-between gap-2 p-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{cliente.nombre}</div>
                  {cliente.documento && (
                    <div className="text-[10px] text-[hsl(var(--text-muted))] font-mono">
                      {cliente.tipoDocumento.toUpperCase()} {cliente.documento}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { setCliente(null); setBuscarCliente(''); }}
                  aria-label="Quitar cliente"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    data-testid="pos-buscar-cliente"
                    placeholder="DNI, RUC, nombre…"
                    value={buscarCliente}
                    onChange={e => {
                      setBuscarCliente(e.target.value);
                      setPopoverClienteAbierto(true);
                    }}
                    onFocus={() => setPopoverClienteAbierto(true)}
                    onBlur={() => setTimeout(() => setPopoverClienteAbierto(false), 150)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    title="Crear cliente"
                  >
                    <Link href="/clientes" target="_blank" rel="noopener">
                      <UserPlus className="size-4" />
                    </Link>
                  </Button>
                </div>
                {popoverClienteAbierto && debouncedBuscarCliente.length >= 2 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-lg max-h-60 overflow-auto">
                    {buscandoClientes && (
                      <p className="p-3 text-xs text-[hsl(var(--text-muted))]">Buscando…</p>
                    )}
                    {!buscandoClientes &&
                      (clientesEncontrados?.datos.length === 0 ? (
                        <p className="p-3 text-xs text-[hsl(var(--text-muted))]">
                          Sin coincidencias.
                        </p>
                      ) : (
                        clientesEncontrados?.datos.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setCliente(c);
                              setBuscarCliente('');
                              setPopoverClienteAbierto(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-[hsl(var(--surface-2))]/60"
                          >
                            <div className="text-sm font-medium">{c.nombre}</div>
                            {c.documento && (
                              <div className="text-[10px] text-[hsl(var(--text-muted))] font-mono">
                                {c.tipoDocumento.toUpperCase()} {c.documento}
                              </div>
                            )}
                          </button>
                        ))
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bloque descuento manual */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] flex items-center gap-1.5">
              <Percent className="size-3.5" /> Descuento manual
            </p>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={descuentoManual || ''}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setDescuentoManual(isNaN(v) || v < 0 ? 0 : v);
                }}
                placeholder="0.00"
                className="text-right tabular-nums"
              />
              <span className="text-xs text-[hsl(var(--text-muted))] whitespace-nowrap">
                {descuentoEfectivo !== descuentoManual && descuentoManual > 0
                  ? `efectivo ${formatearMoneda(descuentoEfectivo)}`
                  : 'monto'}
              </span>
            </div>
          </div>

          {/* Bloque cupón */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] flex items-center gap-1.5">
              <Tag className="size-3.5" /> Cupón
            </p>
            {cuponValidado?.valido ? (
              <div className="flex items-center justify-between gap-2 p-3 rounded-md border border-[hsl(140_60%_45%/0.4)] bg-[hsl(140_60%_45%/0.08)]">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="size-4 text-[hsl(140_70%_60%)] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-xs">{cuponValidado.codigo}</div>
                    <div className="text-[10px] text-[hsl(140_70%_75%)] truncate">{cuponValidado.mensaje}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={quitarCupon} aria-label="Quitar cupón">
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : cuponValidado && !cuponValidado.valido ? (
              <div className="p-3 rounded-md border border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)] flex items-start gap-2">
                <XCircle className="size-4 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[hsl(355_75%_85%)]">{cuponValidado.mensaje}</div>
                  <button
                    type="button"
                    onClick={quitarCupon}
                    className="text-[10px] underline mt-1 text-[hsl(355_75%_75%)]"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  data-testid="pos-codigo-cupon"
                  value={codigoCupon}
                  onChange={e => setCodigoCupon(e.target.value.toUpperCase())}
                  placeholder="Código del cupón"
                  className="font-mono uppercase"
                  maxLength={40}
                  disabled={carrito.length === 0 || validarCupon.isPending}
                />
                <Button
                  variant="outline"
                  type="button"
                  data-testid="pos-validar-cupon"
                  onClick={() => codigoCupon.trim() && validarCupon.mutate()}
                  disabled={!codigoCupon.trim() || carrito.length === 0 || validarCupon.isPending}
                >
                  {validarCupon.isPending ? '…' : 'Aplicar'}
                </Button>
              </div>
            )}
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
            disabled={carrito.length === 0 || cobrar.isPending || !sucursalId || total <= 0}
            onClick={() => cobrar.mutate()}
          >
            {cobrar.isPending ? 'Procesando…' : `Cobrar ${formatearMoneda(total)}`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
