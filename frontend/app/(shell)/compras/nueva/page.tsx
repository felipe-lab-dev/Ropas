'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowLeft, PackagePlus, Plus, Save, Trash2, Sparkles, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { DetalleSheet } from '@/components/ui/sheet';
import { obtener, obtenerPaginado, postear, mensajeError } from '@/lib/api/client';
import { invalidarStock } from '@/lib/api/invalidaciones';
import { formatearMoneda } from '@/lib/utils';
import { CampoTipoCambio, type FuenteTc } from '@/components/utilidades/campo-tipo-cambio';
import { BuscadorVariantes, type VarianteEncontrada } from '@/components/productos/buscador-variantes';
import { NuevaVarianteSheet, type VarianteCreada } from '@/components/productos/nueva-variante-sheet';
import { NuevoProductoCliente } from '@/app/(shell)/productos/nuevo/nuevo-producto-cliente';
import { NuevoProveedorContenido } from '@/app/(shell)/proveedores/nuevo/page';
import { useSesionCajaAbierta } from '@/lib/api/hooks/use-sesion-caja-abierta';

interface Sucursal { id: string; nombre: string }
interface Proveedor { id: string; razonSocial: string; documento: string; condicionPago: string; diasCredito: number }
interface ProductoDetalle {
  id: string; nombre: string; precioCompra?: string | null;
  variantes: Array<{ id: string; sku: string; talla: string; color: string }>;
}

interface ItemCompra {
  varianteId: string;
  productoId: string;
  productoNombre: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  descuento: number;
}

const fieldLabel = 'text-xs font-semibold text-[hsl(var(--text-muted))]';

export default function NuevaCompraPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [proveedorId, setProveedorId] = React.useState('');
  const [tipoComprobante, setTipoComprobante] = React.useState<'factura' | 'boleta' | 'nota_ingreso' | 'guia_remision' | 'otro'>('factura');
  const [serie, setSerie] = React.useState('F001');
  const [numeroComprobante, setNumeroComprobante] = React.useState('');
  const [fechaEmision, setFechaEmision] = React.useState(new Date().toISOString().slice(0, 10));
  const [condicionPago, setCondicionPago] = React.useState<'contado' | 'credito_15' | 'credito_30' | 'credito_60'>('contado');
  const [items, setItems] = React.useState<ItemCompra[]>([]);
  const [busqueda, setBusqueda] = React.useState('');
  const [notas, setNotas] = React.useState('');
  const [moneda, setMoneda] = React.useState<'PEN' | 'USD'>('PEN');
  const [tipoCambio, setTipoCambio] = React.useState<number | null>(null);
  const [fuenteTc, setFuenteTc] = React.useState<FuenteTc>('oficial');
  const [crearAbierto, setCrearAbierto] = React.useState(false);
  const [crearProveedorAbierto, setCrearProveedorAbierto] = React.useState(false);

  /** Tras crear un proveedor en el aside, refrescamos la lista y lo seleccionamos. */
  const onProveedorCreado = async (id: string) => {
    setCrearProveedorAbierto(false);
    await qc.invalidateQueries({ queryKey: ['proveedores-lista'] });
    setProveedorId(id);
  };

  const { data: proveedores } = useQuery({
    queryKey: ['proveedores-lista'],
    queryFn: () => obtenerPaginado<Proveedor>('/proveedores', { limite: 200 }),
  });

  // Sucursal principal del tenant (1 tenant = 1 sucursal; el backend la resuelve
  // igual, pero necesitamos el id para consultar la sesión de caja).
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });
  const sucursalId = sucursales?.[0]?.id;

  const { data: sesionCaja } = useSesionCajaAbierta(sucursalId);

  const proveedor = proveedores?.datos.find(p => p.id === proveedorId);
  React.useEffect(() => {
    if (proveedor) setCondicionPago(proveedor.condicionPago as typeof condicionPago);
  }, [proveedor]);

  const agregarItem = (v: VarianteEncontrada) => {
    if (items.find(i => i.varianteId === v.id)) return;
    setItems(s => [
      ...s,
      {
        varianteId: v.id,
        productoId: v.producto.id,
        productoNombre: v.producto.nombre,
        descripcion: `${v.producto.nombre} · ${v.talla}/${v.color}`,
        cantidad: 1,
        costoUnitario: Number(v.producto.precioCompra ?? 0),
        descuento: 0,
      },
    ]);
    setBusqueda('');
  };

  // Producto al que se le está agregando una variante desde una fila de la tabla.
  const [varianteFilaProducto, setVarianteFilaProducto] =
    React.useState<{ id: string; nombre: string } | null>(null);

  /**
   * Variante recién creada desde la fila: la agrega a la compra heredando el
   * costo de una fila hermana del mismo producto (si existe), porque suele ser
   * el mismo costo del proveedor para todas las tallas/colores.
   */
  const agregarVarianteCreadaEnFila = (variante: VarianteCreada) => {
    const producto = varianteFilaProducto;
    if (!producto) return;
    setItems(prev => {
      if (prev.find(i => i.varianteId === variante.id)) return prev;
      const costoHermano = prev.find(i => i.productoId === producto.id)?.costoUnitario ?? 0;
      return [
        ...prev,
        {
          varianteId: variante.id,
          productoId: producto.id,
          productoNombre: producto.nombre,
          descripcion: `${producto.nombre} · ${variante.talla}/${variante.color}`,
          cantidad: 1,
          costoUnitario: costoHermano,
          descuento: 0,
        },
      ];
    });
    setVarianteFilaProducto(null);
  };

  /** Tras crear un producto en el aside, traemos su detalle y agregamos sus variantes. */
  const onProductoCreado = async (id: string) => {
    try {
      const prod = await obtener<ProductoDetalle>(`/productos/${id}`);
      let agregadas = 0;
      setItems(prev => {
        const existentes = new Set(prev.map(i => i.varianteId));
        const nuevas: ItemCompra[] = (prod.variantes ?? [])
          .filter(v => !existentes.has(v.id))
          .map(v => ({
            varianteId: v.id,
            productoId: prod.id,
            productoNombre: prod.nombre,
            descripcion: `${prod.nombre} · ${v.talla}/${v.color}`,
            cantidad: 1,
            costoUnitario: Number(prod.precioCompra ?? 0),
            descuento: 0,
          }));
        agregadas = nuevas.length;
        return [...prev, ...nuevas];
      });
      if (agregadas > 0) toast.success(`«${prod.nombre}» agregado a la compra`);
      else toast.info(`«${prod.nombre}» se creó, pero no tiene variantes para agregar`);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setCrearAbierto(false);
      setBusqueda('');
    }
  };

  const actualizar = (i: number, patch: Partial<ItemCompra>) =>
    setItems(s => s.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const eliminar = (i: number) => setItems(s => s.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.costoUnitario - i.descuento, 0);
  const igv = subtotal * 0.18;
  const total = subtotal + igv;

  const mutar = useMutation({
    mutationFn: () =>
      postear('/compras', {
        proveedorId,
        tipoComprobante,
        serie,
        numeroComprobante,
        fechaEmision,
        condicionPago,
        moneda,
        tipoCambio: moneda === 'USD' ? (tipoCambio ?? 1) : 1,
        items: items.map(i => ({
          varianteId: i.varianteId,
          cantidad: i.cantidad,
          costoUnitario: i.costoUnitario,
          descuento: i.descuento,
        })),
        notas,
        confirmar: true,
        sesionCajaId: sesionCaja?.id,
      }),
    onSuccess: () => {
      toast.success('Compra registrada — stock e IGV asentados');
      // La compra ingresó stock: refrescamos las vistas que lo muestran.
      invalidarStock(qc);
      router.push('/compras');
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const puede =
    proveedorId &&
    serie &&
    numeroComprobante &&
    items.length > 0 &&
    (moneda === 'PEN' || (tipoCambio !== null && tipoCambio > 0)) &&
    sesionCaja !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Nueva compra"
        descripcion="Registra la factura del proveedor — al confirmar suma stock, recalcula costo y genera asientos."
        acciones={
          <Button variant="ghost" asChild>
            <Link href="/compras"><ArrowLeft className="size-4" /> Volver</Link>
          </Button>
        }
      />

      {sucursalId && sesionCaja === null && (
        <div className="flex items-center gap-3 rounded-lg border border-[hsl(35_90%_55%/0.4)] bg-[hsl(35_90%_55%/0.08)] px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-[hsl(35_90%_55%)] shrink-0" />
          <div className="flex-1">
            <p className="font-medium">No hay caja abierta</p>
            <p className="text-xs text-[hsl(var(--text-muted))]">
              No podés registrar una compra sin una sesión de caja abierta.{' '}
              <Link href="/caja" className="underline">Abrir caja</Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* ── Datos del comprobante ─────────────────────────────────────── */}
          <Card className="p-5 sm:p-6 space-y-5">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">
              Datos del comprobante
            </h3>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className={fieldLabel}>Proveedor *</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="btn-nuevo-proveedor-compra"
                  onClick={() => setCrearProveedorAbierto(true)}
                >
                  <UserPlus className="size-4" /> Nuevo proveedor
                </Button>
              </div>
              <Select
                data-testid="select-proveedor-compra"
                value={proveedorId}
                onChange={e => setProveedorId(e.target.value)}
              >
                <option value="">— Seleccionar proveedor —</option>
                {proveedores?.datos.map(p => (
                  <option key={p.id} value={p.id}>{p.razonSocial} · {p.documento}</option>
                ))}
              </Select>
              {proveedor && (
                <p className="text-[11px] text-[hsl(var(--text-muted))]">
                  Condición aplicada: <span className="font-medium text-[hsl(var(--text))]">
                    {condicionPago === 'contado' ? 'Contado' : `Crédito ${proveedor.diasCredito || 30} días`}
                  </span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className={fieldLabel}>Tipo</label>
                <Select value={tipoComprobante} onChange={e => setTipoComprobante(e.target.value as typeof tipoComprobante)}>
                  <option value="factura">Factura</option>
                  <option value="boleta">Boleta</option>
                  <option value="nota_ingreso">Nota de ingreso</option>
                  <option value="guia_remision">Guía de remisión</option>
                  <option value="otro">Otro</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel}>Serie</label>
                <Input
                  data-testid="input-serie-compra"
                  value={serie}
                  onChange={e => setSerie(e.target.value.toUpperCase())}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel}>Número</label>
                <Input
                  data-testid="input-numero-comprobante-compra"
                  value={numeroComprobante}
                  onChange={e => setNumeroComprobante(e.target.value)}
                  placeholder="0000123"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel}>Fecha emisión</label>
                <Input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <label className={fieldLabel}>Condición de pago</label>
                <Select value={condicionPago} onChange={e => setCondicionPago(e.target.value as typeof condicionPago)}>
                  <option value="contado">Contado</option>
                  <option value="credito_15">Crédito 15 días</option>
                  <option value="credito_30">Crédito 30 días</option>
                  <option value="credito_60">Crédito 60 días</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel}>Moneda</label>
                <div className="h-10 flex items-center">
                  <SegmentedControl
                    size="lg"
                    ariaLabel="Moneda de la compra"
                    value={moneda}
                    onChange={setMoneda}
                    options={[
                      { value: 'PEN', label: 'PEN · Soles', testId: 'btn-moneda-PEN' },
                      { value: 'USD', label: 'USD · Dólares', testId: 'btn-moneda-USD' },
                    ]}
                  />
                </div>
              </div>
              <AnimatePresence>
                {moneda === 'USD' && (
                  <motion.div
                    className="sm:col-span-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CampoTipoCambio
                      fecha={fechaEmision}
                      valor={tipoCambio}
                      fuente={fuenteTc}
                      onCambio={(tc, f) => { setTipoCambio(tc); setFuenteTc(f); }}
                      testId="campo-tipo-cambio-compra"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>

          {/* ── Ítems ─────────────────────────────────────────────────────── */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Ítems</h3>
                {items.length > 0 && (
                  <span className="text-[11px] text-[hsl(var(--text-muted))]">
                    · {items.length} {items.length === 1 ? 'producto' : 'productos'}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="btn-nuevo-producto-compra"
                onClick={() => setCrearAbierto(true)}
              >
                <PackagePlus className="size-4" /> Nuevo producto
              </Button>
            </div>

            <BuscadorVariantes
              contexto="compra"
              value={busqueda}
              onValueChange={setBusqueda}
              onSeleccionar={agregarItem}
              yaAgregados={new Set(items.map(i => i.varianteId))}
              permitirNuevaVariante
              placeholder="Buscar producto / SKU / variante…"
              inputTestId="input-buscar-producto-compra"
              resultadoTestId={v => `btn-agregar-producto-compra-${v.sku ?? v.id}`}
            />

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-10 text-center space-y-3">
                <Sparkles className="size-6 mx-auto text-[hsl(var(--text-muted))]/50" />
                <p className="text-sm text-[hsl(var(--text-muted))]">
                  Buscá un producto arriba para agregarlo.<br />
                  ¿No existe todavía? Usá <span className="font-medium text-[hsl(var(--text))]">Nuevo producto</span> y creálo sin salir de acá.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))]">
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-[hsl(var(--surface-2))]/40 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
                  <div className="col-span-5">Producto</div>
                  <div className="col-span-2 text-center">Cantidad</div>
                  <div className="col-span-2 text-center">Costo unit.</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                  <div className="col-span-1" />
                </div>
                <AnimatePresence initial={false}>
                  {items.map((it, i) => (
                    <motion.div
                      key={it.varianteId}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.18 }}
                      className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 border-t border-[hsl(var(--border))] first:border-0"
                    >
                      <div className="col-span-12 sm:col-span-5">
                        <div className="text-sm font-medium">{it.descripcion}</div>
                        <button
                          type="button"
                          data-testid={`btn-otra-variante-fila-${it.varianteId}`}
                          onClick={() => setVarianteFilaProducto({ id: it.productoId, nombre: it.productoNombre })}
                          className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--brand-primary))]/40 bg-[hsl(var(--brand-primary))]/10 px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--brand-primary))] shadow-sm transition-all hover:bg-[hsl(var(--brand-primary))]/20 hover:border-[hsl(var(--brand-primary))]/60"
                        >
                          <Plus className="size-3.5" /> Otra talla/color
                        </button>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number" min={1}
                          value={it.cantidad}
                          onChange={e => actualizar(i, { cantidad: Math.max(1, Number(e.target.value)) })}
                          className="h-9 text-center tabular-nums"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number" step={0.01} min={0}
                          value={it.costoUnitario}
                          onChange={e => actualizar(i, { costoUnitario: Number(e.target.value) })}
                          className="h-9 text-center tabular-nums"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2 text-right tabular-nums font-semibold">
                        {formatearMoneda(it.cantidad * it.costoUnitario - it.descuento, moneda)}
                      </div>
                      <button
                        type="button"
                        aria-label="Quitar ítem"
                        className="col-span-1 text-[hsl(var(--brand-danger,355_75%_60%))] hover:opacity-70 transition-opacity"
                        onClick={() => eliminar(i)}
                      >
                        <Trash2 className="size-4 mx-auto" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Card>

          {/* ── Notas ─────────────────────────────────────────────────────── */}
          <Card className="p-5 sm:p-6 space-y-1.5">
            <label className={fieldLabel}>Notas</label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Observaciones de la compra (opcional)…" />
          </Card>
        </div>

        {/* ── Totales (sticky) ────────────────────────────────────────────── */}
        <Card className="p-5 sm:p-6 space-y-4 h-fit sticky top-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Totales</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--text-muted))]">Base imponible</span>
              <span className="tabular-nums">{formatearMoneda(subtotal, moneda)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--text-muted))]">IGV (18%)</span>
              <span className="tabular-nums">{formatearMoneda(igv, moneda)}</span>
            </div>
            <div className="flex justify-between pt-2.5 border-t border-[hsl(var(--border))] text-lg font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatearMoneda(total, moneda)}</span>
            </div>
            {moneda === 'USD' && tipoCambio ? (
              <div className="flex justify-between text-xs text-[hsl(var(--text-muted))] pt-1">
                <span>Equivalente en soles (TC {tipoCambio})</span>
                <span className="tabular-nums" data-testid="equivalente-pen-compra">
                  {formatearMoneda(total * tipoCambio, 'PEN')}
                </span>
              </div>
            ) : null}
          </div>

          <Button
            size="lg"
            className="w-full"
            data-testid="btn-registrar-compra"
            disabled={!puede || mutar.isPending}
            onClick={() => mutar.mutate()}
          >
            <Save className="size-4" /> Registrar compra
          </Button>
          <p className="text-[10px] text-[hsl(var(--text-muted))] text-center leading-relaxed">
            Al confirmar: ingresa stock, recalcula costo promedio y genera asientos contables.
          </p>
        </Card>
      </div>

      {/* ── Crear producto sin salir de la compra (aside, no modal) ───────── */}
      <DetalleSheet
        open={crearAbierto}
        onOpenChange={setCrearAbierto}
        titulo="Nuevo producto"
        subtitulo="Se agrega a la compra al guardar · el stock lo ingresa la compra"
        icono={<PackagePlus className="size-4" />}
        ancho="4xl"
      >
        {crearAbierto && (
          <div className="p-4 sm:p-5" data-testid="aside-nuevo-producto-compra">
            <NuevoProductoCliente
              modoModal
              nombreInicial={busqueda}
              onCerrar={() => setCrearAbierto(false)}
              onCreado={onProductoCreado}
            />
          </div>
        )}
      </DetalleSheet>

      {/* ── Crear proveedor sin salir de la compra (aside, no modal) ──────── */}
      <DetalleSheet
        open={crearProveedorAbierto}
        onOpenChange={setCrearProveedorAbierto}
        titulo="Nuevo proveedor"
        subtitulo="Se selecciona en la compra al guardar"
        icono={<UserPlus className="size-4" />}
        ancho="2xl"
      >
        {crearProveedorAbierto && (
          <div className="p-4 sm:p-5" data-testid="aside-nuevo-proveedor-compra">
            <NuevoProveedorContenido
              modoModal
              onCerrar={() => setCrearProveedorAbierto(false)}
              onCreado={onProveedorCreado}
            />
          </div>
        )}
      </DetalleSheet>

      {/* ── Agregar talla/color a un producto ya en la compra (desde la fila) ── */}
      <NuevaVarianteSheet
        open={varianteFilaProducto !== null}
        onOpenChange={abierto => { if (!abierto) setVarianteFilaProducto(null); }}
        producto={varianteFilaProducto}
        onCreada={agregarVarianteCreadaEnFila}
      />
    </div>
  );
}
