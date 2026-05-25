'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { mensajeError, obtener, postear } from '@/lib/api/client';
import { CuponFormulario } from '../cupon-formulario';
import { CuponPreview } from '../cupon-preview';
import { aPayloadApi, type CuponFormValues } from '../cupon-schema';

interface Plantilla {
  id: string;
  emoji: string;
  titulo: string;
  tagline: string;
  copyMarketing: string;
  diasVigenciaSugeridos: number;
  config: {
    nombre: string;
    tipoDescuento: 'porcentaje' | 'monto_fijo';
    valorDescuento: number;
    montoMinimoCompra: number | null;
    descuentoMaximo: number | null;
    usosMaximosPorCliente: number;
    usosMaximosTotal: number | null;
    segmento: string;
    aplicableA: string;
    disenoColorPrimario: string;
    disenoColorSecundario: string;
    disenoMensaje: string;
    disenoEmoji: string;
    plantilla: string;
    descripcion: string;
  };
}

export default function NuevoCuponPage() {
  const router = useRouter();
  const params = useSearchParams();
  const wizard = params.get('wizard');
  const [vista, setVista] = React.useState<'plantillas' | 'libre'>(
    wizard === 'plantillas' ? 'plantillas' : 'libre',
  );
  const [inicial, setInicial] = React.useState<Partial<CuponFormValues> | undefined>();
  const [error, setError] = React.useState<string | null>(null);
  const qc = useQueryClient();

  const { data: plantillas } = useQuery({
    queryKey: ['cupones-plantillas'],
    queryFn: () => obtener<Plantilla[]>('/cupones/plantillas'),
    staleTime: 5 * 60 * 1000,
  });

  const mutar = useMutation({
    mutationFn: (valores: CuponFormValues) =>
      postear<{ id: string; codigo: string }>('/cupones', aPayloadApi(valores)),
    onSuccess: data => {
      toast.success(`Cupón "${data?.codigo ?? ''}" creado`);
      qc.invalidateQueries({ queryKey: ['cupones'] });
      router.push(`/cupones/${data.id}`);
    },
    onError: e => setError(mensajeError(e)),
  });

  const mutarSugerirCodigo = useMutation({
    mutationFn: (prefijo: string) => obtener<{ codigo: string }>(`/cupones/codigo-sugerido?prefijo=${encodeURIComponent(prefijo)}`),
  });

  const aplicarPlantilla = async (p: Plantilla) => {
    const sugerencia = await mutarSugerirCodigo.mutateAsync(p.id.slice(0, 6));
    const ahora = new Date();
    const fin = new Date(ahora.getTime() + p.diasVigenciaSugeridos * 86400_000);
    const formatear = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    setInicial({
      codigo: sugerencia.codigo,
      nombre: p.config.nombre,
      descripcion: p.config.descripcion,
      tipoDescuento: p.config.tipoDescuento,
      valorDescuento: p.config.valorDescuento,
      montoMinimoCompra: p.config.montoMinimoCompra,
      descuentoMaximo: p.config.descuentoMaximo,
      fechaInicio: formatear(ahora),
      fechaFin: formatear(fin),
      usosMaximosTotal: p.config.usosMaximosTotal,
      usosMaximosPorCliente: p.config.usosMaximosPorCliente,
      segmento: p.config.segmento as never,
      aplicableA: p.config.aplicableA as never,
      campania: p.titulo,
      plantilla: p.id,
      disenoColorPrimario: p.config.disenoColorPrimario,
      disenoColorSecundario: p.config.disenoColorSecundario,
      disenoMensaje: p.config.disenoMensaje,
      disenoEmoji: p.config.disenoEmoji,
    });
    setVista('libre');
    toast.success(`Plantilla "${p.titulo}" aplicada — revisá y guardá`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={vista === 'plantillas' ? 'Plantillas brutales' : 'Nuevo cupón'}
        descripcion={
          vista === 'plantillas'
            ? '5 campañas pre-armadas por un experto en marketing. Solo elige y ajustá.'
            : 'Configurá el cupón al detalle. Vista previa en vivo a la derecha.'
        }
        acciones={
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/cupones"><ArrowLeft className="size-4" /> Volver</Link>
            </Button>
            <Button
              variant={vista === 'plantillas' ? 'default' : 'outline'}
              onClick={() => setVista('plantillas')}
              data-testid="vista-plantillas"
            >
              <Sparkles className="size-4" /> Plantillas
            </Button>
            <Button
              variant={vista === 'libre' ? 'default' : 'outline'}
              onClick={() => setVista('libre')}
              data-testid="vista-libre"
            >
              <Wand2 className="size-4" /> Desde cero
            </Button>
          </div>
        }
      />

      {vista === 'plantillas' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {!plantillas
            ? [...Array(5)].map((_, i) => <Card key={i} className="h-[420px] animate-pulse" />)
            : plantillas.map(p => (
                <Card key={p.id} className="overflow-hidden flex flex-col">
                  <div className="p-5 space-y-3 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{p.emoji}</div>
                      <div className="flex-1">
                        <h3 className="font-bold text-base">{p.titulo}</h3>
                        <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">{p.tagline}</p>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-[hsl(var(--text-muted))]">
                      {p.copyMarketing}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--surface-2))]">
                        {p.config.tipoDescuento === 'porcentaje'
                          ? `${p.config.valorDescuento}%`
                          : `S/ ${p.config.valorDescuento}`}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--surface-2))]">
                        {p.diasVigenciaSugeridos}d vigencia
                      </span>
                      {p.config.montoMinimoCompra && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--surface-2))]">
                          Mín S/ {p.config.montoMinimoCompra}
                        </span>
                      )}
                      {p.config.usosMaximosTotal && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--surface-2))]">
                          Máx {p.config.usosMaximosTotal} usos
                        </span>
                      )}
                    </div>
                    {/* Mini preview */}
                    <div className="flex justify-center pt-2">
                      <CuponPreview
                        codigo={`${p.id.slice(0, 4).toUpperCase()}-XXXX`}
                        nombre={p.config.nombre}
                        tipoDescuento={p.config.tipoDescuento}
                        valorDescuento={p.config.valorDescuento}
                        fechaFin={new Date(Date.now() + p.diasVigenciaSugeridos * 86400_000)}
                        montoMinimoCompra={p.config.montoMinimoCompra}
                        campania={p.titulo}
                        disenoColorPrimario={p.config.disenoColorPrimario}
                        disenoColorSecundario={p.config.disenoColorSecundario}
                        disenoMensaje={p.config.disenoMensaje}
                        disenoEmoji={p.config.disenoEmoji}
                        compacto
                      />
                    </div>
                  </div>
                  <div className="p-4 border-t border-[hsl(var(--border))]">
                    <Button
                      className="w-full"
                      onClick={() => aplicarPlantilla(p)}
                      disabled={mutarSugerirCodigo.isPending}
                      data-testid={`plantilla-${p.id}`}
                    >
                      Usar esta plantilla
                    </Button>
                  </div>
                </Card>
              ))}
        </div>
      ) : (
        <CuponFormulario
          inicial={inicial}
          guardando={mutar.isPending}
          ctaLabel="Crear cupón"
          errorServidor={error}
          onGuardar={v => { setError(null); mutar.mutate(v); }}
          onCancelar={() => router.push('/cupones')}
        />
      )}
    </div>
  );
}
