'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ScanLine, Search, Tag, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { mensajeError, obtenerPaginado, postear } from '@/lib/api/client';
import { ESTADO_LABEL, ESTADOS, SEGMENTO_LABEL, SEGMENTOS } from '../cupon-schema';

type EstadoCupon = (typeof ESTADOS)[number];
type SegmentoCupon = (typeof SEGMENTOS)[number];

interface CuponVigente {
  id: string;
  codigo: string;
  nombre: string;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: string;
  fechaFin: string;
  estado: EstadoCupon;
  segmento: SegmentoCupon | string;
  disenoColorPrimario: string;
  disenoEmoji?: string | null;
}

/**
 * Pantalla para que el operador valide un cupón sin pasar por el POS.
 * Útil para "ver si está vigente" antes de aceptarlo en una venta presencial.
 */
export default function CanjearCuponPage() {
  const [codigo, setCodigo] = React.useState('');
  const [enviado, setEnviado] = React.useState('');

  const { data: lista } = useQuery({
    queryKey: ['cupones-vigentes'],
    queryFn: () => obtenerPaginado<CuponVigente>('/cupones', { vigentes: 'true', limite: 8, pagina: 1 }),
  });
  const vigentes = lista?.datos ?? [];

  const buscar = useMutation({
    mutationFn: () =>
      postear<{
        valido: boolean;
        descuento: number;
        baseAplicable: number;
        mensaje: string;
      }>('/cupones/validar', {
        codigo: codigo.trim().toUpperCase(),
        items: [{ varianteId: '00000000-0000-0000-0000-000000000000', cantidad: 1, precioUnitario: 0 }],
      }),
  });

  const onValidar = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!codigo.trim()) return;
    setEnviado(codigo.trim().toUpperCase());
    buscar.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Canjear cupón"
        descripcion="Validá un código antes de aceptarlo en una venta. Para aplicar el descuento, pasalo al POS."
        acciones={
          <Button variant="ghost" asChild>
            <Link href="/cupones"><ArrowLeft className="size-4" /> Volver</Link>
          </Button>
        }
      />

      <Card className="p-6 max-w-2xl space-y-4">
        <form onSubmit={onValidar} className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
            <Input
              autoFocus
              data-testid="canjear-codigo"
              placeholder="Escanea o escribe el código del cupón…"
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              className="pl-9 font-mono uppercase text-lg h-12"
              maxLength={40}
              autoComplete="off"
            />
          </div>
          <Button size="lg" type="submit" disabled={!codigo.trim() || buscar.isPending} data-testid="canjear-validar">
            <Search className="size-4" /> Validar
          </Button>
        </form>

        {buscar.isPending && (
          <div className="p-4 rounded-md bg-[hsl(var(--surface-2))] text-sm">Validando…</div>
        )}

        {buscar.data && (
          <div
            className={`p-4 rounded-md border ${
              buscar.data.valido
                ? 'border-[hsl(140_60%_45%/0.4)] bg-[hsl(140_60%_45%/0.08)]'
                : 'border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)]'
            }`}
            data-testid="canjear-resultado"
          >
            <div className="flex items-start gap-3">
              {buscar.data.valido ? (
                <CheckCircle2 className="size-6 text-[hsl(140_70%_55%)] shrink-0 mt-0.5" />
              ) : (
                <XCircle className="size-6 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div
                  className={`font-bold ${
                    buscar.data.valido ? 'text-[hsl(140_70%_75%)]' : 'text-[hsl(355_75%_85%)]'
                  }`}
                >
                  {buscar.data.valido ? '✓ Cupón válido' : '✗ Cupón rechazado'}
                </div>
                <div
                  className={`text-sm mt-1 ${
                    buscar.data.valido ? 'text-[hsl(140_70%_85%)]' : 'text-[hsl(355_75%_85%)]'
                  }`}
                >
                  {buscar.data.mensaje}
                </div>
                {buscar.data.valido && enviado && (
                  <div className="mt-3 flex items-center gap-3">
                    <Button asChild size="sm">
                      <Link href={`/pos?cupon=${encodeURIComponent(enviado)}`}>
                        Llevar al POS
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/cupones?buscar=${encodeURIComponent(enviado)}`}>
                        Ver detalle
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {buscar.isError && (
          <div className="p-4 rounded-md border border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)] text-sm text-[hsl(355_75%_85%)]">
            {mensajeError(buscar.error)}
          </div>
        )}

        <div className="text-[11px] text-[hsl(var(--text-muted))] pt-2 border-t border-[hsl(var(--border))]">
          Nota: la validación rápida no aplica filtros de carrito (categorías/productos específicos).
          Para el cálculo exacto del descuento, usá el POS con el carrito real.
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">
          <Tag className="size-3.5" /> Cupones vigentes ahora
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {vigentes.length === 0 ? (
            <Card className="p-6 col-span-full text-sm text-[hsl(var(--text-muted))] text-center">
              No hay cupones activos ahora mismo.
            </Card>
          ) : (
            vigentes.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setCodigo(c.codigo);
                  setTimeout(() => onValidar(), 0);
                }}
                className="text-left p-4 rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/50 hover:bg-[hsl(var(--surface-2))]/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="size-9 rounded-md grid place-items-center text-base shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${c.disenoColorPrimario}, ${c.disenoColorPrimario}66)`,
                      color: '#fff',
                    }}
                  >
                    {c.disenoEmoji || '🏷️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-xs uppercase">{c.codigo}</div>
                    <div className="text-xs font-medium truncate">{c.nombre}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-bold text-sm">
                    {c.tipoDescuento === 'porcentaje' ? `${Number(c.valorDescuento)}%` : `S/ ${Number(c.valorDescuento).toFixed(0)}`}
                  </span>
                  <Badge variant="success" className="text-[10px]">
                    {ESTADO_LABEL[c.estado as EstadoCupon] ?? c.estado}
                  </Badge>
                </div>
                <div className="text-[10px] text-[hsl(var(--text-muted))] mt-1">
                  {SEGMENTO_LABEL[c.segmento as SegmentoCupon] ?? c.segmento}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
