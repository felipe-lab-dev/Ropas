'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Save, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { obtener, obtenerPaginado, postear, mensajeError } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';
import { CampoTipoCambio, type FuenteTc } from '@/components/utilidades/campo-tipo-cambio';

interface Proveedor { id: string; razonSocial: string; documento: string; condicionPago: string; diasCredito: number }
interface Sucursal { id: string; nombre: string }
interface VarianteBuscable {
  id: string; sku: string; talla: string; color: string;
  producto: { id: string; nombre: string; sku: string; precioCompra?: string | null };
}

interface ItemCompra {
  varianteId: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  descuento: number;
}

export default function NuevaCompraPage() {
  const router = useRouter();
  const [proveedorId, setProveedorId] = React.useState('');
  const [sucursalId, setSucursalId] = React.useState('');
  const [tipoComprobante, setTipoComprobante] = React.useState<'factura' | 'boleta' | 'nota_ingreso' | 'guia_remision' | 'otro'>('factura');
  const [serie, setSerie] = React.useState('F001');
  const [numeroComprobante, setNumeroComprobante] = React.useState('');
  const [fechaEmision, setFechaEmision] = React.useState(new Date().toISOString().slice(0, 10));
  const [condicionPago, setCondicionPago] = React.useState<'contado' | 'credito_15' | 'credito_30' | 'credito_60'>('contado');
  const [items, setItems] = React.useState<ItemCompra[]>([]);
  const [busqueda, setBusqueda] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [notas, setNotas] = React.useState('');
  const [moneda, setMoneda] = React.useState<'PEN' | 'USD'>('PEN');
  const [tipoCambio, setTipoCambio] = React.useState<number | null>(null);
  const [fuenteTc, setFuenteTc] = React.useState<FuenteTc>('oficial');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(busqueda), 200);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data: proveedores } = useQuery({
    queryKey: ['proveedores-lista'],
    queryFn: () => obtenerPaginado<Proveedor>('/proveedores', { limite: 200 }),
  });
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  React.useEffect(() => {
    if (sucursales && !sucursalId && sucursales[0]) setSucursalId(sucursales[0].id);
  }, [sucursales, sucursalId]);

  const proveedor = proveedores?.datos.find(p => p.id === proveedorId);
  React.useEffect(() => {
    if (proveedor) {
      setCondicionPago(proveedor.condicionPago as any);
    }
  }, [proveedor]);

  const { data: resultados } = useQuery({
    queryKey: ['variantes-busqueda', debounced],
    enabled: debounced.length >= 2,
    queryFn: () =>
      obtenerPaginado<VarianteBuscable>('/inventario/buscar-variantes', {
        buscar: debounced, limite: 8,
      }).catch(() =>
        // Fallback: si el endpoint no existe, usar productos
        obtenerPaginado<any>('/productos', { buscar: debounced, limite: 8 }) as any,
      ),
  });

  const agregarItem = (v: VarianteBuscable) => {
    if (items.find(i => i.varianteId === v.id)) return;
    setItems(s => [
      ...s,
      {
        varianteId: v.id,
        descripcion: `${v.producto.nombre} · ${v.talla}/${v.color}`,
        cantidad: 1,
        costoUnitario: Number(v.producto.precioCompra ?? 0),
        descuento: 0,
      },
    ]);
    setBusqueda('');
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
        sucursalId,
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
      }),
    onSuccess: () => {
      toast.success('Compra registrada — stock e IGV asentados');
      router.push('/compras');
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const puede =
    proveedorId &&
    sucursalId &&
    serie &&
    numeroComprobante &&
    items.length > 0 &&
    (moneda === 'PEN' || (tipoCambio !== null && tipoCambio > 0));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Nueva compra"
        descripcion="Registra factura del proveedor — al confirmar suma stock y genera asientos contables."
        acciones={
          <Button variant="ghost" asChild>
            <Link href="/compras"><ArrowLeft className="size-4" /> Volver</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-5 space-y-4 xl:col-span-2">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--text-muted))]">Datos del comprobante</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Proveedor *</label>
              <select
                data-testid="select-proveedor-compra"
                className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
                value={proveedorId}
                onChange={e => setProveedorId(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {proveedores?.datos.map(p => (
                  <option key={p.id} value={p.id}>{p.razonSocial} · {p.documento}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Sucursal destino *</label>
              <select
                data-testid="select-sucursal-compra"
                className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
                value={sucursalId}
                onChange={e => setSucursalId(e.target.value)}
              >
                {sucursales?.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Tipo</label>
              <select
                className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
                value={tipoComprobante}
                onChange={e => setTipoComprobante(e.target.value as any)}
              >
                <option value="factura">Factura</option>
                <option value="boleta">Boleta</option>
                <option value="nota_ingreso">Nota de ingreso</option>
                <option value="guia_remision">Guía de remisión</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Serie</label>
                <Input
                  data-testid="input-serie-compra"
                  value={serie}
                  onChange={e => setSerie(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Número</label>
                <Input
                  data-testid="input-numero-comprobante-compra"
                  value={numeroComprobante}
                  onChange={e => setNumeroComprobante(e.target.value)}
                  placeholder="0000123"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Fecha emisión</label>
              <Input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Condición de pago</label>
              <select
                className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
                value={condicionPago}
                onChange={e => setCondicionPago(e.target.value as any)}
              >
                <option value="contado">Contado</option>
                <option value="credito_15">Crédito 15 días</option>
                <option value="credito_30">Crédito 30 días</option>
                <option value="credito_60">Crédito 60 días</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Moneda</label>
              <select
                data-testid="select-moneda-compra"
                className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
                value={moneda}
                onChange={e => setMoneda(e.target.value as 'PEN' | 'USD')}
              >
                <option value="PEN">PEN — Soles</option>
                <option value="USD">USD — Dólares</option>
              </select>
            </div>
            {moneda === 'USD' && (
              <CampoTipoCambio
                fecha={fechaEmision}
                valor={tipoCambio}
                fuente={fuenteTc}
                onCambio={(tc, f) => {
                  setTipoCambio(tc);
                  setFuenteTc(f);
                }}
                testId="campo-tipo-cambio-compra"
              />
            )}
          </div>

          <div className="pt-2 border-t border-[hsl(var(--border))] space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--text-muted))]">Ítems</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
              <Input
                data-testid="input-buscar-producto-compra"
                placeholder="Buscar producto / SKU / variante…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-9"
              />
              {resultados && (resultados as any).datos?.length > 0 && busqueda && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-lg max-h-64 overflow-auto">
                  {(resultados as any).datos.map((v: any) => (
                    <button
                      key={v.id}
                      type="button"
                      data-testid={`btn-agregar-producto-compra-${v.sku ?? v.id}`}
                      onClick={() => agregarItem(v)}
                      className="w-full px-3 py-2 text-left hover:bg-[hsl(var(--surface-2))] text-sm flex justify-between"
                    >
                      <span>
                        <span className="font-medium">{v.producto?.nombre ?? v.nombre}</span>
                        {v.talla && <span className="text-[hsl(var(--text-muted))]"> · {v.talla}/{v.color}</span>}
                      </span>
                      <span className="font-mono text-xs text-[hsl(var(--text-muted))]">{v.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--text-muted))]">
                Busca un producto arriba y se agregará a la lista.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={it.varianteId} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-[hsl(var(--border))] p-3">
                    <div className="col-span-5 text-sm">{it.descripcion}</div>
                    <div className="col-span-2">
                      <Input
                        type="number" min={1}
                        value={it.cantidad}
                        onChange={e => actualizar(i, { cantidad: Math.max(1, Number(e.target.value)) })}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number" step={0.01} min={0}
                        value={it.costoUnitario}
                        onChange={e => actualizar(i, { costoUnitario: Number(e.target.value) })}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2 text-right tabular-nums font-medium">
                      {formatearMoneda(it.cantidad * it.costoUnitario - it.descuento)}
                    </div>
                    <button
                      type="button"
                      className="col-span-1 text-[hsl(355_75%_60%)] hover:text-[hsl(355_75%_50%)]"
                      onClick={() => eliminar(i)}
                    >
                      <Trash2 className="size-4 mx-auto" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold">Notas</label>
            <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} />
          </div>
        </Card>

        <Card className="p-5 space-y-4 h-fit sticky top-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--text-muted))]">Totales</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(var(--text-muted))]">Base imponible</span>
              <span className="tabular-nums">{formatearMoneda(subtotal, moneda)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(var(--text-muted))]">IGV (18%)</span>
              <span className="tabular-nums">{formatearMoneda(igv, moneda)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[hsl(var(--border))] text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatearMoneda(total, moneda)}</span>
            </div>
            {moneda === 'USD' && tipoCambio ? (
              <div className="flex justify-between text-xs text-[hsl(var(--text-muted))]">
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
          <p className="text-[10px] text-[hsl(var(--text-muted))] text-center">
            Al confirmar: ingresa stock, recalcula costo promedio y genera asientos contables.
          </p>
        </Card>
      </div>
    </div>
  );
}
