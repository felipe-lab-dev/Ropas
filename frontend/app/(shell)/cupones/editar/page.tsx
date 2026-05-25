'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { actualizar, mensajeError, obtener } from '@/lib/api/client';
import { CuponFormulario } from '../cupon-formulario';
import { aPayloadApi, type CuponFormValues, CUPON_VACIO } from '../cupon-schema';

interface CuponDetalle {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: string;
  montoMinimoCompra: string | null;
  descuentoMaximo: string | null;
  fechaInicio: string;
  fechaFin: string;
  usosMaximosTotal: number | null;
  usosMaximosPorCliente: number;
  segmento: string;
  clientesElegiblesIds: string[];
  aplicableA: string;
  categoriasAplicablesIds: string[];
  productosAplicablesIds: string[];
  campania: string | null;
  plantilla: string | null;
  disenoColorPrimario: string;
  disenoColorSecundario: string;
  disenoMensaje: string | null;
  disenoEmoji: string | null;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function EditarCuponPage() {
  const router = useRouter();
  const id = useSearchParams().get('id') ?? '';
  const qc = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['cupon', id],
    queryFn: () => obtener<CuponDetalle>(`/cupones/${id}`),
    enabled: !!id,
  });

  const mutar = useMutation({
    mutationFn: (valores: CuponFormValues) => {
      const { codigo, ...payload } = aPayloadApi(valores);
      void codigo;
      return actualizar(`/cupones/${id}`, payload);
    },
    onSuccess: () => {
      toast.success('Cupón actualizado');
      qc.invalidateQueries({ queryKey: ['cupones'] });
      qc.invalidateQueries({ queryKey: ['cupon', id] });
      router.push(`/cupones/${id}`);
    },
    onError: e => setError(mensajeError(e)),
  });

  const inicial: Partial<CuponFormValues> | undefined = data
    ? {
        ...CUPON_VACIO,
        codigo: data.codigo,
        nombre: data.nombre,
        descripcion: data.descripcion ?? '',
        tipoDescuento: data.tipoDescuento,
        valorDescuento: Number(data.valorDescuento),
        montoMinimoCompra: data.montoMinimoCompra ? Number(data.montoMinimoCompra) : null,
        descuentoMaximo: data.descuentoMaximo ? Number(data.descuentoMaximo) : null,
        fechaInicio: toLocalInput(data.fechaInicio),
        fechaFin: toLocalInput(data.fechaFin),
        usosMaximosTotal: data.usosMaximosTotal,
        usosMaximosPorCliente: data.usosMaximosPorCliente,
        segmento: data.segmento as never,
        clientesElegiblesIds: data.clientesElegiblesIds,
        aplicableA: data.aplicableA as never,
        categoriasAplicablesIds: data.categoriasAplicablesIds,
        productosAplicablesIds: data.productosAplicablesIds,
        campania: data.campania ?? '',
        plantilla: data.plantilla ?? '',
        disenoColorPrimario: data.disenoColorPrimario,
        disenoColorSecundario: data.disenoColorSecundario,
        disenoMensaje: data.disenoMensaje ?? '',
        disenoEmoji: data.disenoEmoji ?? '',
      }
    : undefined;

  if (!id) {
    return (
      <Card className="p-6">
        <div>Falta el parámetro <code>id</code>.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={data ? `Editar cupón ${data.codigo}` : 'Editar cupón'}
        descripcion="El código no se puede cambiar para no romper referencias en ventas históricas."
        acciones={
          <Button variant="ghost" asChild>
            <Link href={`/cupones/${id}`}><ArrowLeft className="size-4" /> Volver al detalle</Link>
          </Button>
        }
      />

      {isLoading && <Skeleton className="h-96" />}
      {isError && (
        <Card className="p-4 text-sm text-[hsl(355_75%_75%)]">{mensajeError(queryError)}</Card>
      )}
      {data && (
        <CuponFormulario
          inicial={inicial}
          guardando={mutar.isPending}
          ctaLabel="Guardar cambios"
          errorServidor={error}
          modoEdicion
          onGuardar={v => { setError(null); mutar.mutate(v); }}
          onCancelar={() => router.push(`/cupones/${id}`)}
        />
      )}
    </div>
  );
}
