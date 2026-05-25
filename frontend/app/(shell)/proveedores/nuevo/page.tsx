'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { postear, mensajeError } from '@/lib/api/client';
import { ProveedorFormulario } from '../proveedor-formulario';
import { aPayloadApi, type ProveedorFormValues } from '../proveedor-schema';

export default function NuevoProveedorPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const mutar = useMutation({
    mutationFn: (valores: ProveedorFormValues) =>
      postear<{ id: string; razonSocial: string }>('/proveedores', aPayloadApi(valores)),
    onSuccess: data => {
      toast.success(`Proveedor "${data?.razonSocial ?? ''}" registrado`);
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      router.push('/proveedores');
    },
    onError: e => setError(mensajeError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Nuevo proveedor"
        descripcion="Registra los datos fiscales y de contacto. Se valida el formato del RUC/DNI/email antes de guardar."
        acciones={
          <Button variant="ghost" asChild>
            <Link href="/proveedores"><ArrowLeft className="size-4" /> Volver</Link>
          </Button>
        }
      />

      <ProveedorFormulario
        guardando={mutar.isPending}
        ctaLabel="Guardar proveedor"
        errorServidor={error}
        onGuardar={v => { setError(null); mutar.mutate(v); }}
        onCancelar={() => router.push('/proveedores')}
      />
    </div>
  );
}
